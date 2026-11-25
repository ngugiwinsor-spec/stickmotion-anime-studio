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

  async function encode(options) {
    const {
      canvas, fps, frameCount, renderFrame, bitrate = 8000000,
      audioBuffer = null, onProgress = () => {}
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
    if (audioBuffer) {
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
        await audioSource.add(audioBuffer);
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
    encode
  });
})(window);
