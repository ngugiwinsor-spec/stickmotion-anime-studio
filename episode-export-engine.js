/* StickMotion episode export engine
 * Uses Mediabunny/WebCodecs for deterministic frame-timestamped WebM output.
 * Mediabunny is loaded lazily so the editor does not pay the download cost until export.
 */
(function (global) {
  'use strict';

  const MEDIABUNNY_URL = 'https://github.com/Vanilagy/mediabunny/releases/download/v1.66.4/mediabunny.min.cjs';
  let libraryPromise = null;

  async function loadMediabunny() {
    if (global.Mediabunny) return global.Mediabunny;
    if (!libraryPromise) {
      libraryPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = MEDIABUNNY_URL;
        script.async = true;
        script.onload = () => global.Mediabunny
          ? resolve(global.Mediabunny)
          : reject(new Error('Mediabunny loaded without its browser API'));
        script.onerror = () => reject(new Error('Could not load the WebM export engine. Check your internet connection and try again.'));
        document.head.appendChild(script);
      }).catch(error => {
        libraryPromise = null;
        throw error;
      });
    }
    return libraryPromise;
  }


  async function decodeAudioUrl(url) {
    if (!url) return null;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Could not read the imported audio file.');
    const bytes = await response.arrayBuffer();
    const AudioContextClass = global.AudioContext || global.webkitAudioContext;
    if (!AudioContextClass) throw new Error('This browser cannot decode the imported audio.');
    const context = new AudioContextClass();
    try {
      return await context.decodeAudioData(bytes.slice(0));
    } finally {
      await context.close().catch(() => {});
    }
  }

  function addOfflineCue(context, destination, cue, chunkStart, masterVolume) {
    const type = cue.type;
    const duration = type === 'whoosh' ? 0.43 : type === 'magic' ? 0.66 : 0.23;
    const elapsed = Math.max(0, chunkStart - cue.start);
    if (elapsed >= duration) return;
    const when = Math.max(0, cue.start - chunkStart);
    const remaining = duration - elapsed;
    const cueLevel = Math.max(0, Math.min(100, Number(cue.volume) || 0)) / 100;
    const master = Math.max(0, Math.min(100, Number(masterVolume) || 0)) / 100;
    const peak = 0.24 * master * cueLevel;
    if (peak > 0.0001) {
      const starts = { impact:150, whoosh:620, magic:420, step:95, alert:880 };
      const ends = { impact:42, whoosh:90, magic:1100, step:48, alert:440 };
      const startHz = starts[type] || starts.impact;
      const endHz = ends[type] || ends.impact;
      const progress = Math.min(1, elapsed / duration);
      const currentHz = startHz * Math.pow(endHz / startHz, progress);
      const oscillator = context.createOscillator();
      oscillator.type = type === 'whoosh' ? 'sawtooth' : type === 'magic' ? 'sine' : type === 'step' ? 'triangle' : 'square';
      oscillator.frequency.setValueAtTime(currentHz, when);
      oscillator.frequency.exponentialRampToValueAtTime(endHz, when + remaining);
      const gain = context.createGain();
      const attack = 0.012;
      const currentGain = elapsed < attack
        ? 0.0001
        : Math.max(0.0001, peak * Math.pow(0.0001 / peak, (elapsed - attack) / Math.max(0.001, duration - attack)));
      gain.gain.setValueAtTime(currentGain, when);
      if (elapsed < attack) gain.gain.exponentialRampToValueAtTime(peak, when + (attack - elapsed));
      gain.gain.exponentialRampToValueAtTime(0.0001, when + remaining);
      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.start(when);
      oscillator.stop(when + remaining);
    }

    if ((type === 'impact' || type === 'step') && elapsed < 0.09) {
      const amplitude = (type === 'impact' ? 0.22 : 0.12) * master * cueLevel;
      if (amplitude > 0.0001) {
        const sampleRate = context.sampleRate;
        const noiseBuffer = context.createBuffer(1, Math.ceil(sampleRate * 0.09), sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const source = context.createBufferSource();
        source.buffer = noiseBuffer;
        const gain = context.createGain();
        const noiseElapsed = elapsed;
        const currentGain = Math.max(0.0001, amplitude * Math.pow(0.0001 / amplitude, noiseElapsed / 0.09));
        gain.gain.setValueAtTime(currentGain, when);
        gain.gain.exponentialRampToValueAtTime(0.0001, when + Math.min(remaining, 0.09 - noiseElapsed));
        source.connect(gain);
        gain.connect(destination);
        source.start(when, noiseElapsed, Math.min(remaining, 0.09 - noiseElapsed));
      }
    }
  }

  function addAmbientMusic(context, destination, chunkStart, chunkDuration, totalDuration) {
    // A soft, royalty-free synthesized ambient bed. Chords are scheduled on the
    // absolute episode clock so chunk boundaries do not restart the progression.
    const progression = [[220,261.63,329.63],[174.61,220,261.63],[196,246.94,293.66],[164.81,196,246.94]];
    const chordSeconds = 4;
    const chunkEnd = chunkStart + chunkDuration;
    const chordCount = Math.ceil(totalDuration / chordSeconds);
    for (let chordIndex = 0; chordIndex < chordCount; chordIndex++) {
      const chordStart = chordIndex * chordSeconds;
      const chordEnd = Math.min(totalDuration, chordStart + chordSeconds);
      if (chordEnd <= chunkStart || chordStart >= chunkEnd) continue;
      const localStart = Math.max(0, chordStart - chunkStart);
      const localEnd = Math.min(chunkDuration, chordEnd - chunkStart);
      const duration = Math.max(0.02, localEnd - localStart);
      const chord = progression[chordIndex % progression.length];
      chord.forEach((frequency, noteIndex) => {
        const oscillator = context.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency * (noteIndex === 2 ? 2 : 1);
        const gain = context.createGain();
        const level = noteIndex === 0 ? 0.025 : 0.014;
        const attack = Math.min(0.22, duration * 0.2);
        gain.gain.setValueAtTime(0.0001, localStart);
        gain.gain.linearRampToValueAtTime(level, localStart + attack);
        gain.gain.setValueAtTime(level, Math.max(localStart + attack, localEnd - 0.18));
        gain.gain.linearRampToValueAtTime(0.0001, localEnd);
        oscillator.connect(gain);
        gain.connect(destination);
        oscillator.start(localStart);
        oscillator.stop(localEnd);
      });
    }
    // Quiet plucked notes make the bed musical without masking speech.
    const melody = [440,392,329.63,392,523.25,440,392,329.63];
    for (let noteTime = chunkStart; noteTime < totalDuration && noteTime < chunkEnd; noteTime += 0.5) {
      const local = noteTime - chunkStart;
      const oscillator = context.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.value = melody[Math.floor(noteTime / 0.5) % melody.length];
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, local);
      gain.gain.linearRampToValueAtTime(0.018, local + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, Math.min(chunkDuration, local + 0.34));
      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.start(local);
      oscillator.stop(Math.min(chunkDuration, local + 0.35));
    }
  }

  async function* mixEpisodeAudio(options) {
    const {
      audioBuffer = null, audioOffset = 0, backgroundMusic = false, scenes = [], fps = 24,
      sampleRate = 48000, chunkSeconds = 5
    } = options || {};
    const events = [];
    let startFrame = 0;
    for (const scene of scenes) {
      const count = Math.max(1, Math.ceil((Number(scene.duration) || 5) * fps));
      const state = scene.project || {};
      const cues = Array.isArray(state.soundEffects) ? state.soundEffects : [];
      for (const cue of cues) {
        const cueFrame = Math.max(0, Math.floor(Number(cue.frame) || 0));
        if (cue.muted || cueFrame >= count) continue;
        events.push({
          start: (startFrame + cueFrame) / fps,
          type: cue.type,
          volume: cue.volume ?? 100,
          masterVolume: state.soundEffectsVolume ?? 70
        });
      }
      startFrame += count;
    }
    const totalDuration = startFrame / fps;
    if (!audioBuffer && !events.length && !backgroundMusic) return;
    const OfflineContext = global.OfflineAudioContext || global.webkitOfflineAudioContext;
    if (!OfflineContext) throw new Error('This browser cannot mix episode audio.');
    for (let chunkStart = 0; chunkStart < totalDuration; chunkStart += chunkSeconds) {
      const duration = Math.min(chunkSeconds, totalDuration - chunkStart);
      const frameCount = Math.max(1, Math.ceil(duration * sampleRate));
      const context = new OfflineContext(2, frameCount, sampleRate);
      if (audioBuffer) {
        const sourceOffset = Math.max(0, Number(audioOffset) || 0) + chunkStart;
        const remainingAudio = audioBuffer.duration - sourceOffset;
        if (remainingAudio > 0) {
          const source = context.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(context.destination);
          source.start(0, sourceOffset, Math.min(duration, remainingAudio));
        }
      }
      if (backgroundMusic) addAmbientMusic(context, context.destination, chunkStart, duration, totalDuration);
      const chunkEnd = chunkStart + duration;
      for (const cue of events) {
        const cueDuration = cue.type === 'whoosh' ? 0.43 : cue.type === 'magic' ? 0.66 : 0.23;
        if (cue.start < chunkEnd && cue.start + cueDuration > chunkStart) {
          addOfflineCue(context, context.destination, cue, chunkStart, cue.masterVolume);
        }
      }
      yield await context.startRendering();
    }
  }

  async function encode(options) {
    const {
      canvas, fps, frameCount, renderFrame, bitrate = 8000000,
      audioBuffer = null, audioBuffers = null, onProgress = () => {}
    } = options || {};
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Episode export needs a canvas.');
    if (!Number.isFinite(fps) || fps < 1 || fps > 60) throw new Error('Choose a frame rate between 1 and 60 FPS.');
    if (!Number.isInteger(frameCount) || frameCount < 1) throw new Error('Episode contains no frames.');
    if (typeof renderFrame !== 'function') throw new Error('Episode frame renderer is missing.');

    const MB = await loadMediabunny();
    if (typeof VideoEncoder === 'undefined') throw new Error('This browser does not support WebCodecs video encoding.');

    const target = new MB.BufferTarget();
    const output = new MB.Output({ format: new MB.WebMOutputFormat(), target });
    const videoSource = new MB.CanvasSource(canvas, {
      codec: 'vp8',
      quality: new MB.Quality({ bitrate: Math.max(500000, Number(bitrate) || 8000000) })
    });
    output.addVideoTrack(videoSource, { frameRate: fps });

    let audioSource = null;
    if (audioBuffer || audioBuffers) {
      audioSource = new MB.AudioBufferSource({
        codec: 'opus',
        quality: new MB.Quality({ bitrate: 128000 })
      });
      output.addAudioTrack(audioSource);
    }

    let finalized = false;
    try {
      await output.start();
      if (audioSource) {
        if (audioBuffer) await audioSource.add(audioBuffer);
        else if (audioBuffers) for await (const buffer of audioBuffers) await audioSource.add(buffer);
        audioSource.close();
      }
      for (let i = 0; i < frameCount; i++) {
        await renderFrame(i);
        await videoSource.add(i / fps, 1 / fps);
        if (i % Math.max(1, Math.floor(fps / 2)) === 0 || i === frameCount - 1) {
          onProgress((i + 1) / frameCount, i + 1, frameCount);
        }
      }
      videoSource.close();
      await output.finalize();
      finalized = true;
      const buffer = target.buffer;
      if (!buffer || buffer.byteLength < 100) throw new Error('The encoder produced an empty WebM file.');
      return new Blob([buffer], { type: 'video/webm' });
    } catch (error) {
      try { videoSource.close(); } catch (_) {}
      try { audioSource?.close(); } catch (_) {}
      if (!finalized && typeof output.cancel === 'function') {
        try { await output.cancel(); } catch (_) {}
      }
      throw error;
    }
  }

  global.StickMotionEpisodeExport = Object.freeze({
    version: 'mediabunny-1.66.4',
    loadMediabunny,
    decodeAudioUrl,
    mixEpisodeAudio,
    encode
  });
})(window);
