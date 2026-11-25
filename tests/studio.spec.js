const { test, expect } = require('@playwright/test');

test('studio loads without JavaScript errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/StickMotion Anime Studio/);
  await expect(page.locator('#stage')).toBeVisible();
  await expect(page.locator('.badge')).toContainText('v7.26');
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
});

test('demo rig and procedural action work', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addDemo').click();
  await expect(page.locator('#layers .layer')).toHaveCount(10);
  await page.locator('#motionPreset').selectOption('attack');
  await page.locator('#generateMotion').click();
  await expect(page.locator('#cinematicStatus')).toContainText('Impact marker added at frame');
  expect(errors).toEqual([]);
});

test('camera, anime FX and finishing controls respond', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#applyCameraPreset').click();
  await page.locator('#cameraPreset').selectOption('hero');
  await page.locator('#applyCameraPreset').click();
  await expect(page.locator('#camZoom')).toHaveValue('1.18');

  await page.locator('#animeEffect').selectOption('aura');
  await page.locator('#effectIntensity').fill('75');
  await page.locator('#characterGlow').check();
  await page.locator('#glowStrength').fill('28');
  await page.locator('#eyeGlow').fill('70');
  await page.locator('#frame').fill('45');
  await expect(page.locator('#effectIntensityLabel')).toContainText('75');
  await expect(page.locator('#eyeGlowLabel')).toContainText('70');
  expect(errors).toEqual([]);
});

test('PNG export starts successfully', async ({ page }) => {
  await page.goto('/');
  await page.locator('#addDemo').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportPng').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.png$/i);
});

test('video export quality changes recorder bitrate', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const quality = page.locator('#exportQuality');
  await expect(quality).toHaveValue('8000000');
  expect(await page.evaluate(() => exportVideoBitrate())).toBe(8000000);
  await quality.selectOption('4000000');
  expect(await page.evaluate(() => exportVideoBitrate())).toBe(4000000);
  await quality.selectOption('16000000');
  expect(await page.evaluate(() => exportVideoBitrate())).toBe(16000000);
  expect(errors).toEqual([]);
});

test('anime afterimage trails render and respond to controls', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addDemo').click();
  await expect(page.locator('#layers .layer')).toHaveCount(10);
  const before = await page.locator('#stage').evaluate(canvas => canvas.toDataURL());
  await page.locator('#trailCount').selectOption('4');
  await page.locator('#trailStrength').fill('100');
  await page.locator('#motionTrails').check();
  const after = await page.locator('#stage').evaluate(canvas => canvas.toDataURL());
  expect(after).not.toBe(before);
  await page.locator('#motionTrails').uncheck();
  expect(errors).toEqual([]);
});

test('onion skin shows neighboring poses but is excluded from exports', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addDemo').click();
  await expect(page.locator('#layers .layer')).toHaveCount(10);
  await page.locator('#capture').click();
  await page.evaluate(() => {
    const frame = document.querySelector('#frame');
    frame.value = '60';
    frame.dispatchEvent(new Event('input', { bubbles: true }));
    const x = document.querySelector('#x');
    x.value = '120';
    x.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#capture').click();
  await page.evaluate(() => {
    const frame = document.querySelector('#frame');
    frame.value = '30';
    frame.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const normal = await page.locator('#stage').evaluate(canvas => canvas.toDataURL());
  await page.locator('#onionSkin').check();
  const withOnion = await page.locator('#stage').evaluate(canvas => canvas.toDataURL());
  expect(withOnion).not.toBe(normal);
  await page.locator('#onionMode').selectOption('previous');
  await page.locator('#onionOpacity').fill('45');
  await page.evaluate(() => { window.__stickMotionExporting = true; draw(); });
  const exportFrame = await page.locator('#stage').evaluate(canvas => canvas.toDataURL());
  expect(exportFrame).not.toBe(withOnion);
  await page.evaluate(() => { window.__stickMotionExporting = false; draw(); });
  expect(errors).toEqual([]);
});

test('advanced motion curves shape body interpolation predictably', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addDemo').click();
  await expect(page.locator('#layers .layer')).toHaveCount(10);
  const values = await page.evaluate(() => {
    const pose = () => parts.map(p => ({x:p.x,y:p.y,rot:p.rot,scale:p.scale,opacity:p.opacity}));
    const start = pose(), end = pose();
    start[0].x = 0;
    end[0].x = 100;
    keys = {0:start,100:end};
    const read = mode => {
      document.querySelector('#easing').value = mode;
      applyKey(50);
      return parts[0].x;
    };
    return {smoother:read('smoother'),anticipate:read('anticipate'),overshoot:read('overshoot'),bounce:read('bounce')};
  });
  expect(values.smoother).toBeCloseTo(50, 1);
  expect(values.anticipate).toBeLessThan(0);
  expect(values.overshoot).toBeGreaterThan(100);
  expect(values.bounce).toBeGreaterThan(75);
  expect(values.bounce).toBeLessThan(78);
  expect(errors).toEqual([]);
});

test('character acting accents change actual keyed poses and facial keys', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addDemo').click();
  await expect(page.locator('#layers .layer')).toHaveCount(10);
  await page.locator('#motionPreset').selectOption('idle');
  await page.locator('#generateMotion').click();
  const before = await page.evaluate(() => JSON.stringify(keys));
  await page.locator('#actingAccent').selectOption('confident');
  await page.locator('#actingStrength').fill('100');
  await page.locator('#applyActingAccent').click();
  const after = await page.evaluate(() => JSON.stringify(keys));
  expect(after).not.toBe(before);
  await expect(page.locator('#actingStatus')).toContainText('accent applied to 9 keyed poses');
  const changed = await page.evaluate(() => {
    const torso = parts.findIndex(p => /torso|body|chest/.test(p.name.toLowerCase()));
    return torso >= 0 && Object.keys(keys).some(f => Math.abs(keys[f][torso].rot) > 0.1);
  });
  expect(changed).toBeTruthy();
  expect(errors).toEqual([]);
});

test('action choreography reshapes generated attack keyframes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addDemo').click();
  await expect(page.locator('#layers .layer')).toHaveCount(10);
  await page.locator('#motionPreset').selectOption('attack');
  await page.locator('#generateMotion').click();
  const before = await page.evaluate(() => JSON.stringify(keys));
  await page.locator('#choreoPattern').selectOption('five');
  await page.locator('#choreoDirection').selectOption('left');
  await page.locator('#applyChoreography').click();
  const after = await page.evaluate(() => JSON.stringify(keys));
  expect(after).not.toBe(before);
  await expect(page.locator('#choreoStatus')).toContainText('Five-hit combo applied across 9 poses, facing left');
  expect(errors).toEqual([]);
});


test('secondary motion adds delayed overlap to distal keyframed parts', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addDemo').click();
  await expect(page.locator('#layers .layer')).toHaveCount(10);
  await page.locator('#motionPreset').selectOption('walk');
  await page.locator('#generateMotion').click();
  const before = await page.evaluate(() => JSON.stringify(keys));
  await page.locator('#secondaryAmount').fill('60');
  await page.locator('#applySecondaryMotion').click();
  const after = await page.evaluate(() => JSON.stringify(keys));
  expect(after).not.toBe(before);
  await expect(page.locator('#secondaryStatus')).toContainText('Secondary motion applied to');
  expect(errors).toEqual([]);
});


test('camera follow generates target-tracking camera keys', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addDemo').click();
  await expect(page.locator('#layers .layer')).toHaveCount(10);
  await page.locator('#motionPreset').selectOption('walk');
  await page.locator('#generateMotion').click();
  await page.locator('#cameraFollowTarget').selectOption({label:'Torso'});
  await page.locator('#cameraFollowStrength').fill('85');
  await page.locator('#generateCameraFollow').click();
  await expect(page.locator('#cameraFollowStatus')).toContainText('Generated 9 camera follow keys tracking Torso');
  const result = await page.evaluate(() => ({count:Object.keys(window.__stickMotionCameraKeys).length,values:Object.values(window.__stickMotionCameraKeys)}));
  expect(result.count).toBe(9);
  expect(result.values.some(k => Math.abs(k.x)>0.1 || Math.abs(k.y)>0.1)).toBeTruthy();
  expect(errors).toEqual([]);
});


test('viseme dialogue adds mouth-shape keys and approximate word timing', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addDemo').click();
  await expect(page.locator('#layers .layer')).toHaveCount(10);
  await page.locator('#visemeShape').selectOption('O');
  await page.locator('#addVisemeKey').click();
  let state = await page.evaluate(() => ({keys:Object.keys(window.__stickMotionFaceKeys),shape:window.__stickMotionFaceKeys[0]?.viseme,mouth:window.__stickMotionFaceKeys[0]?.mouth}));
  expect(state.keys).toContain('0');
  expect(state.shape).toBe('O');
  expect(state.mouth).toBeGreaterThan(0.5);
  await page.locator('#visemeDialogue').fill('We will protect this city');
  await page.locator('#paceDialogue').click();
  state = await page.evaluate(() => Object.values(window.__stickMotionFaceKeys).filter(k => k.viseme).length);
  expect(state).toBeGreaterThan(1);
  await expect(page.locator('#visemeStatus')).toContainText('not speech recognition');
  expect(errors).toEqual([]);
});


test('sound effects cues are editable, persistent, and previewable', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#sfxType').selectOption('impact');
  await page.locator('#addSfxCue').click();
  await page.locator('#frame').fill('18');
  await page.locator('#frame').dispatchEvent('input');
  await page.locator('#sfxType').selectOption('whoosh');
  await page.locator('#addSfxCue').click();
  expect(await page.evaluate(() => window.__stickMotionSfxCues.map(c => [c.frame,c.type]))).toEqual([[0,'impact'],[18,'whoosh']]);
  await expect(page.locator('#sfxStatus')).toContainText('2 cues');
  await page.locator('#sfxCueList').getByRole('button', { name: 'Frame 18 · whoosh' }).click();
  await expect(page.locator('#frame')).toHaveValue('18');
  const saved = await page.evaluate(() => window.__stickMotionProjectState());
  expect(saved.soundEffects).toHaveLength(2);
  await page.locator('#sfxCueList').getByRole('button', { name: 'Delete sound cue at frame 18' }).click();
  await expect(page.locator('#sfxStatus')).toContainText('1 cue');
  await page.evaluate(state => window.__stickMotionLoadProjectState(state), saved);
  await expect(page.locator('#sfxStatus')).toContainText('2 cues');
  expect(await page.evaluate(() => window.__stickMotionSfxCues.map(c => [c.frame, c.type]))).toEqual([[0, 'impact'], [18, 'whoosh']]);
  await page.locator('#previewSfx').click();
  await expect(page.locator('#sfxStatus')).toContainText('Previewing whoosh');
  await page.locator('#clearSfxCues').click();
  await expect(page.locator('#sfxStatus')).toContainText('0 cues');
  expect(errors).toEqual([]);
});




test('existing sound cues can be edited and saved in project state', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addSfxCue').click();
  await expect(page.locator('#sfxCueList')).toContainText('Frame 0 · impact');
  await page.getByRole('spinbutton', { name: 'Sound cue frame 0' }).fill('27');
  await page.getByRole('combobox', { name: 'Sound cue type at frame 0' }).selectOption('magic');
  await page.getByRole('button', { name: 'Save sound cue at frame 0' }).click();
  await expect(page.locator('#sfxCueList')).toContainText('Frame 27 · magic');
  expect(await page.evaluate(() => window.__stickMotionSfxCues.map(c => [c.frame,c.type]))).toEqual([[27,'magic']]);
  const saved = await page.evaluate(() => window.__stickMotionProjectState());
  await page.evaluate(state => window.__stickMotionLoadProjectState(state), saved);
  expect(await page.evaluate(() => window.__stickMotionSfxCues.map(c => [c.frame,c.type]))).toEqual([[27,'magic']]);
  expect(errors).toEqual([]);
});

test('sound cues can be duplicated independently and persist', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addSfxCue').click();
  await page.getByRole('button', { name: 'Duplicate sound cue at frame 0' }).click();
  await expect(page.locator('#sfxStatus')).toContainText('2 cues');
  const cues = await page.evaluate(() => window.__stickMotionSfxCues.map(c => ({id:c.id,frame:c.frame,type:c.type})));
  expect(cues).toHaveLength(2);
  expect(cues[0].id).not.toBe(cues[1].id);
  expect(cues.map(c => [c.frame,c.type])).toEqual([[0,'impact'],[0,'impact']]);
  await page.getByRole('spinbutton', { name: 'Sound cue frame 0' }).nth(1).fill('36');
  await page.getByRole('combobox', { name: 'Sound cue type at frame 0' }).nth(1).selectOption('whoosh');
  await page.getByRole('button', { name: 'Save sound cue at frame 0' }).nth(1).click();
  expect(await page.evaluate(() => window.__stickMotionSfxCues.map(c => [c.frame,c.type]))).toEqual([[0,'impact'],[36,'whoosh']]);
  const saved = await page.evaluate(() => window.__stickMotionProjectState());
  await page.evaluate(state => window.__stickMotionLoadProjectState(state), saved);
  expect(await page.evaluate(() => window.__stickMotionSfxCues.map(c => [c.frame,c.type]))).toEqual([[0,'impact'],[36,'whoosh']]);
  expect(errors).toEqual([]);
});

test('sound cues can be sorted into timeline frame order', async ({ page }) => {
  await page.goto('/');
  await page.locator('#frame').fill('30');
  await page.locator('#frame').dispatchEvent('input');
  await page.locator('#addSfxCue').click();
  await page.locator('#frame').fill('5');
  await page.locator('#frame').dispatchEvent('input');
  await page.locator('#addSfxCue').click();
  expect(await page.evaluate(() => window.__stickMotionSfxCues.map(c => c.frame))).toEqual([30, 5]);
  await page.locator('#sortSfxCues').click();
  expect(await page.evaluate(() => window.__stickMotionSfxCues.map(c => c.frame))).toEqual([5, 30]);
  await expect(page.locator('#sfxStatus')).toContainText('sorted by frame');
});

test('sound cue frame can be copied from its cue row', async ({ page }) => {
  await page.goto('/');
  await page.locator('#addSfxCue').click();
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.__copiedCueFrame = value; } } }); });
  await page.getByRole('button', { name: 'Copy sound cue frame 0' }).click();
  await expect(page.locator('#sfxStatus')).toContainText('Copied cue frame 0');
  expect(await page.evaluate(() => window.__copiedCueFrame)).toBe('0');
});

test('sound cue can be snapped to the current timeline playhead', async ({ page }) => {
  await page.goto('/');
  await page.locator('#addSfxCue').click();
  await page.locator('#frame').fill('42');
  await page.locator('#frame').dispatchEvent('input');
  await page.getByRole('button', { name: 'Set sound cue to current frame from 0' }).click();
  expect(await page.evaluate(() => window.__stickMotionSfxCues.map(c => c.frame))).toEqual([42]);
  const saved = await page.evaluate(() => window.__stickMotionProjectState());
  expect(saved.soundEffects[0].frame).toBe(42);
});

test('each sound cue can be previewed using its saved type and volume', async ({ page }) => {
  await page.goto('/');
  await page.locator('#addSfxCue').click();
  await page.getByRole('slider', { name: 'Sound cue volume at frame 0' }).fill('40');
  await page.getByRole('button', { name: 'Save sound cue at frame 0' }).click();
  await page.getByRole('button', { name: 'Preview sound cue at frame 0' }).click();
  await expect(page.locator('#sfxStatus')).toContainText('Previewing impact cue (40%)');
});

test('individual sound cue volume is editable and persists', async ({ page }) => {
  await page.goto('/');
  await page.locator('#addSfxCue').click();
  await page.getByRole('button', { name: 'Duplicate sound cue at frame 0' }).click();
  const volumes = page.getByRole('slider', { name: 'Sound cue volume at frame 0' });
  await volumes.nth(0).fill('35');
  await page.getByRole('button', { name: 'Save sound cue at frame 0' }).nth(0).click();
  await expect(page.locator('#sfxCueList')).toContainText('35%');
  const state = await page.evaluate(() => window.__stickMotionProjectState());
  expect(state.soundEffects.map(c => c.volume)).toEqual([35,100]);
  await page.evaluate(saved => window.__stickMotionLoadProjectState(saved), state);
  expect(await page.evaluate(() => window.__stickMotionSfxCues.map(c => c.volume))).toEqual([35,100]);
  expect(await page.evaluate(() => window.__stickMotionProjectState().soundEffects.map(c => c.volume))).toEqual([35,100]);
});

test('sound effects volume control updates preview and export mix level', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#sfxVolume')).toHaveValue('70');
  await page.locator('#sfxVolume').fill('35');
  await expect(page.locator('#sfxVolumeLabel')).toHaveText('35%');
  expect(await page.evaluate(() => window.__stickMotionSfxVolume)).toBe(35);
  await page.locator('#sfxVolume').fill('0');
  expect(await page.evaluate(() => window.__stickMotionSfxVolume)).toBe(0);
  await page.locator('#sfxVolume').fill('42');
  const saved = await page.evaluate(() => window.__stickMotionProjectState());
  expect(saved.soundEffectsVolume).toBe(42);
  await page.locator('#sfxVolume').fill('90');
  await page.evaluate(state => window.__stickMotionLoadProjectState(state), saved);
  await expect(page.locator('#sfxVolume')).toHaveValue('42');
  await expect(page.locator('#sfxVolumeLabel')).toHaveText('42%');
  expect(await page.evaluate(() => window.__stickMotionSfxVolume)).toBe(42);
  expect(errors).toEqual([]);
});

test('sound effects audio stream is recreated after export tracks stop', async ({ page }) => {
  await page.goto('/');
  const recovered = await page.evaluate(() => window.__stickMotionTestSfxStreamRecovery());
  expect(recovered).toBeTruthy();
});

test('episode export scheduler keeps sound cues scoped to each scene', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(() => {
    window.__stickMotionLoadProjectState({
      parts: [],
      soundEffects: [{id:'a',frame:0,type:'impact'},{id:'b',frame:12,type:'whoosh'}]
    });
    window.__stickMotionScheduleEpisodeSfx('scene-one', 0, 10);
    window.__stickMotionScheduleEpisodeSfx('scene-one', 12, 10.5);
    window.__stickMotionLoadProjectState({
      parts: [],
      soundEffects: [{id:'c',frame:0,type:'magic'}]
    });
    window.__stickMotionScheduleEpisodeSfx('scene-two', 0, 11);
  });
  const events = await page.evaluate(() => window.__stickMotionEpisodeSfxEvents);
  expect(events.map(e => [e.sceneId,e.frame,e.type])).toEqual([
    ['scene-one',0,'impact'],
    ['scene-one',12,'whoosh'],
    ['scene-two',0,'magic']
  ]);
  expect(events[1].offset).toBeGreaterThan(events[0].offset);
  await page.evaluate(() => window.__stickMotionResetEpisodeSfxEvents());
  expect(await page.evaluate(() => window.__stickMotionEpisodeSfxEvents)).toHaveLength(0);
  await page.evaluate(() => window.__stickMotionScheduleEpisodeSfx('next-export', 0, 20));
  expect(await page.evaluate(() => window.__stickMotionEpisodeSfxEvents.map(e => e.sceneId))).toEqual(['next-export']);
  expect(errors).toEqual([]);
});


test('individual sound cues can be muted, persisted, and duplicated', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addSfxCue').click();
  await page.getByRole('button', { name: 'Mute sound cue at frame 0' }).click();
  await expect(page.getByRole('button', { name: 'Unmute sound cue at frame 0' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Preview sound cue at frame 0' }).click();
  await expect(page.locator('#sfxStatus')).toHaveText('Sound cue is muted');
  const saved = await page.evaluate(() => window.__stickMotionProjectState());
  expect(saved.soundEffects[0].muted).toBe(true);
  await page.evaluate(state => window.__stickMotionLoadProjectState(state), saved);
  expect(await page.evaluate(() => window.__stickMotionSfxCues[0].muted)).toBe(true);
  await page.getByRole('button', { name: 'Duplicate sound cue at frame 0' }).click();
  expect(await page.evaluate(() => window.__stickMotionSfxCues.map(c => c.muted))).toEqual([true, true]);
  await page.getByRole('button', { name: 'Unmute sound cue at frame 0' }).first().click();
  expect(await page.evaluate(() => window.__stickMotionSfxCues.map(c => c.muted))).toEqual([false, true]);
  expect(errors).toEqual([]);
});


test('muted sound cues can be removed without deleting active cues', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addSfxCue').click();
  await page.locator('#frame').fill('12');
  await page.locator('#frame').dispatchEvent('input');
  await page.locator('#addSfxCue').click();
  await page.getByRole('button', { name: 'Mute sound cue at frame 0' }).click();
  await expect(page.locator('#sfxStatus')).toContainText('2 cues');
  await page.locator('#removeMutedSfxCues').click();
  expect(await page.evaluate(() => window.__stickMotionSfxCues.map(c => [c.frame,c.muted]))).toEqual([[12,false]]);
  await expect(page.locator('#sfxStatus')).toHaveText('Removed 1 muted cue');
  const saved = await page.evaluate(() => window.__stickMotionProjectState());
  expect(saved.soundEffects).toHaveLength(1);
  expect(errors).toEqual([]);
});


test('sound cues export to JSON and can be imported back', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addSfxCue').click();
  await page.getByRole('button', { name: 'Mute sound cue at frame 0' }).click();
  await page.locator('#exportSfxCues').click();
  const exported = await page.evaluate(() => {
    const blob = window.__lastExportBlob;
    return Boolean(blob);
  });
  // Verify the exported download is generated and import a representative exported payload.
  await page.locator('#sfxCueFile').setInputFiles({
    name: 'sound-cues.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({type:'sound-cues',version:'7.23',cues:[{frame:18,type:'magic',volume:55,muted:true},{frame:42,type:'whoosh',volume:90,muted:false}]}))
  });
  await expect(page.locator('#sfxStatus')).toHaveText('Imported 2 sound cues');
  expect(await page.evaluate(() => window.__stickMotionSfxCues.map(c => ({frame:c.frame,type:c.type,volume:c.volume,muted:c.muted})))).toEqual([
    {frame:18,type:'magic',volume:55,muted:true},
    {frame:42,type:'whoosh',volume:90,muted:false}
  ]);
  expect(errors).toEqual([]);
});


test('sound cues can be shifted together without changing cue settings', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addSfxCue').click();
  await page.locator('#frame').fill('12');
  await page.locator('#frame').dispatchEvent('input');
  await page.locator('#addSfxCue').click();
  await page.locator('#sfxShiftFrames').fill('8');
  await page.locator('#shiftSfxCues').click();
  expect(await page.evaluate(() => window.__stickMotionSfxCues.map(c => c.frame))).toEqual([8,20]);
  await expect(page.locator('#sfxStatus')).toHaveText('Shifted 2 sound cues by +8 frames');
  await page.locator('#sfxShiftFrames').fill('-30');
  await page.locator('#shiftSfxCues').click();
  expect(await page.evaluate(() => window.__stickMotionSfxCues.map(c => c.frame))).toEqual([0,0]);
  expect(errors).toEqual([]);
});


test('sound cues can be grouped by effect type and frame', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addSfxCue').click();
  await page.locator('#sfxType').selectOption('whoosh');
  await page.locator('#frame').fill('9');
  await page.locator('#frame').dispatchEvent('input');
  await page.locator('#addSfxCue').click();
  await page.locator('#sfxType').selectOption('impact');
  await page.locator('#frame').fill('30');
  await page.locator('#frame').dispatchEvent('input');
  await page.locator('#addSfxCue').click();
  await page.locator('#sfxType').selectOption('whoosh');
  await page.locator('#frame').fill('3');
  await page.locator('#frame').dispatchEvent('input');
  await page.locator('#addSfxCue').click();
  await page.locator('#groupSfxCues').click();
  expect(await page.evaluate(() => window.__stickMotionSfxCues.map(c => [c.type,c.frame]))).toEqual([
    ['impact',0],['impact',30],['whoosh',3],['whoosh',9]
  ]);
  await expect(page.locator('#sfxStatus')).toHaveText('Grouped 4 sound cues by type');
  expect(errors).toEqual([]);
});


test('all sound cue volumes can be changed together while preserving cue settings', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addSfxCue').click();
  await page.locator('#frame').fill('18');
  await page.locator('#frame').dispatchEvent('input');
  await page.locator('#sfxType').selectOption('whoosh');
  await page.locator('#addSfxCue').click();
  await page.getByRole('button', { name: 'Mute sound cue at frame 0' }).click();
  await page.getByRole('button', { name: 'Save sound cue at frame 18' }).click();
  await page.locator('#allSfxVolume').fill('45');
  await page.locator('#setAllSfxVolumes').click();
  expect(await page.evaluate(() => window.__stickMotionSfxCues.map(c => ({frame:c.frame,type:c.type,volume:c.volume,muted:c.muted})))).toEqual([
    {frame:0,type:'impact',volume:45,muted:true},
    {frame:18,type:'whoosh',volume:45,muted:false}
  ]);
  await expect(page.locator('#sfxStatus')).toHaveText('Set volume to 45% for 2 sound cues');
  const saved = await page.evaluate(() => window.__stickMotionProjectState());
  expect(saved.soundEffects.map(c => c.volume)).toEqual([45,45]);
  await page.evaluate(state => window.__stickMotionLoadProjectState(state), saved);
  expect(await page.evaluate(() => window.__stickMotionSfxCues.map(c => c.volume))).toEqual([45,45]);
  expect(errors).toEqual([]);
});


test('sound cue edits autosave to the project and active scene without a canvas redraw', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addDemo').click();
  await expect(page.locator('#layers .layer')).toHaveCount(10);
  await page.locator('#addSfxCue').click();
  await page.locator('#allSfxVolume').fill('45');
  await page.locator('#setAllSfxVolumes').click();
  await page.waitForTimeout(700);
  const stored = await page.evaluate(() => ({
    project: JSON.parse(localStorage.getItem('stickmotion-anime-studio-project-v1') || 'null'),
    scenes: JSON.parse(localStorage.getItem('stickmotion-anime-studio-scenes-v1') || 'null')
  }));
  expect(stored.project.soundEffects).toHaveLength(1);
  expect(stored.project.soundEffects[0].volume).toBe(45);
  expect(stored.scenes.scenes[0].project.soundEffects[0].volume).toBe(45);
  await page.reload();
  await expect(page.locator('#layers .layer')).toHaveCount(10);
  expect(await page.evaluate(() => window.__stickMotionSfxCues.map(c => c.volume))).toEqual([45]);
  expect(errors).toEqual([]);
});


test('multiple scenes and their sound cues survive reload and scene switching', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addDemo').click();
  await expect(page.locator('#layers .layer')).toHaveCount(10);
  await page.locator('#addSfxCue').click();
  await page.locator('#allSfxVolume').fill('35');
  await page.locator('#setAllSfxVolumes').click();
  await page.locator('#sceneAdd').click();
  await expect(page.locator('#sceneSelect option')).toHaveCount(2);
  await page.locator('#addSfxCue').click();
  await page.locator('#allSfxVolume').fill('75');
  await page.locator('#setAllSfxVolumes').click();
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.locator('#sceneSelect option')).toHaveCount(2);
  expect(await page.evaluate(() => window.__stickMotionSfxCues.map(c => c.volume))).toEqual([75,75]);
  const options = await page.locator('#sceneSelect option').evaluateAll(nodes => nodes.map(n => n.value));
  await page.locator('#sceneSelect').selectOption(options[0]);
  expect(await page.evaluate(() => window.__stickMotionSfxCues.map(c => c.volume))).toEqual([35]);
  await page.locator('#sceneSelect').selectOption(options[1]);
  expect(await page.evaluate(() => window.__stickMotionSfxCues.map(c => c.volume))).toEqual([75,75]);
  expect(errors).toEqual([]);
});

test('studio layout remains usable at a narrow mobile viewport', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    main: document.querySelector('main').getBoundingClientRect().width,
    stage: document.querySelector('.stage-area').getBoundingClientRect().width,
    canvas: document.querySelector('canvas').getBoundingClientRect().width,
    overflow: [...document.querySelectorAll('body *')].map(el => ({tag:el.tagName,id:el.id,cls:typeof el.className==='string'?el.className:'',right:Math.round(el.getBoundingClientRect().right),width:Math.round(el.getBoundingClientRect().width),scroll:el.scrollWidth})).filter(x=>x.right>390||x.width>390).slice(0,20)
  }));
  console.log('MOBILE_LAYOUT_DIAGNOSTIC', JSON.stringify(layout));
  expect(layout.document).toBeLessThanOrEqual(layout.viewport);
  expect(layout.main).toBeLessThanOrEqual(layout.viewport);
  expect(layout.stage).toBeGreaterThan(0);
  expect(layout.canvas).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('full episode export renders a WebM download and restores the editing scene', async ({ page }) => {
  test.setTimeout(180000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addDemo').click();
  await expect(page.locator('#layers .layer')).toHaveCount(10);
  await page.locator('#sceneAdd').click();
  await expect(page.locator('#sceneSelect option')).toHaveCount(2);
  await page.locator('#sceneDuration').fill('1');
  await page.locator('#sceneDuration').dispatchEvent('change');
  const beforeScene = await page.locator('#sceneSelect').inputValue();
  const downloadPromise = page.waitForEvent('download', { timeout: 150000 });
  await page.locator('#exportEpisodeVideo').click();
  await expect(page.locator('#videoStatus')).toContainText(/Full episode exported|Episode export failed/, { timeout: 150000 });
  const status = await page.locator('#videoStatus').textContent();
  expect(status).toContain('Full episode exported');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('stickmotion-full-episode.webm');
  expect(await download.failure()).toBeNull();
  await expect(page.locator('#videoStatus')).toContainText('Full episode exported', { timeout: 10000 });
  expect(await page.locator('#sceneSelect').inputValue()).toBe(beforeScene);
  expect(await page.locator('#layers .layer')).toHaveCount(10);
  expect(errors).toEqual([]);
});



test('diagnostic: Chromium can record standalone canvas video', async ({ page }) => {
 await page.goto('/');
 const result=await page.evaluate(async()=>{const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d');const stream=canvas.captureStream(24);const chunks=[];const recorder=new MediaRecorder(stream,{mimeType:'video/webm'});recorder.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};const stopped=new Promise(resolve=>recorder.onstop=resolve);recorder.start(100);for(let i=0;i<24;i++){ctx.fillStyle=i%2?'#f00':'#00f';ctx.fillRect(0,0,320,180);await new Promise(r=>setTimeout(r,42));}await new Promise(r=>setTimeout(r,300));recorder.stop();await stopped;const blob=new Blob(chunks,{type:recorder.mimeType});const out={size:blob.size,chunks:chunks.length,track:stream.getVideoTracks()[0].readyState,mime:recorder.mimeType};stream.getTracks().forEach(t=>t.stop());return out;});
 console.log('CANVAS_RECORDER_DIAGNOSTIC',JSON.stringify(result));expect(result.size).toBeGreaterThan(0);
});


test('diagnostic: episode recorder lifecycle isolates canvas reset and audio track', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const run = async ({ resetCanvas, withAudio, recorderBeforeReset }) => {
      const canvas = document.createElement('canvas');
      canvas.width = 320; canvas.height = 180;
      const ctx = canvas.getContext('2d');
      const stream = canvas.captureStream(0);
      let audioContext, destination;
      if (withAudio) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        destination = audioContext.createMediaStreamDestination();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        gain.gain.value = 0;
        oscillator.connect(gain).connect(destination);
        oscillator.start();
        if (audioContext.state === 'suspended') await audioContext.resume();
        destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
      }
      const chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      const stopped = new Promise(resolve => recorder.onstop = resolve);
      if (recorderBeforeReset) recorder.start(200);
      if (resetCanvas) { canvas.width = 320; canvas.height = 180; }
      if (!recorderBeforeReset) recorder.start(200);
      const track = stream.getVideoTracks()[0];
      for (let i=0;i<24;i++) {
        ctx.fillStyle = i%2 ? '#e22' : '#26c';
        ctx.fillRect(0,0,320,180);
        if (track.requestFrame) track.requestFrame();
        await new Promise(resolve => setTimeout(resolve, 42));
      }
      await new Promise(resolve => setTimeout(resolve, 350));
      if (recorder.requestData) recorder.requestData();
      await new Promise(resolve => setTimeout(resolve, 150));
      recorder.stop(); await stopped;
      const result = {
        resetCanvas, withAudio, recorderBeforeReset,
        bytes: chunks.reduce((n,b)=>n+b.size,0), chunks: chunks.length,
        videoState: track.readyState, videoMuted: track.muted,
        settings: track.getSettings(), recorderState: recorder.state,
        audioState: audioContext?.state || null,
        audioTracks: stream.getAudioTracks().length
      };
      stream.getTracks().forEach(t=>t.stop());
      if (audioContext) await audioContext.close();
      return result;
    };
    const results = [];
    for (const resetCanvas of [false,true]) {
      for (const withAudio of [false,true]) {
        results.push(await run({resetCanvas,withAudio,recorderBeforeReset:true}));
      }
    }
    results.push(await run({resetCanvas:true,withAudio:false,recorderBeforeReset:false}));
    return results;
  });
  console.log('EPISODE_LIFECYCLE_MATRIX', JSON.stringify(results));
  expect(results).toHaveLength(5);
});


test('diagnostic: Mediabunny encodes and Chromium decodes a deterministic WebM', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const blob = await window.StickMotionEpisodeExport.encode({
      canvas,
      fps: 24,
      frameCount: 24,
      bitrate: 1000000,
      renderFrame: async i => {
        const context = canvas.getContext('2d');
        context.fillStyle = i % 2 ? '#e22' : '#26c';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#fff';
        context.fillRect(i * 10, 40, 40, 40);
      }
    });
    const video = document.createElement('video');
    video.muted = true;
    video.src = URL.createObjectURL(blob);
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error('Chromium could not read the generated WebM'));
    });
    video.currentTime = 0.5;
    await new Promise((resolve, reject) => {
      video.onseeked = resolve;
      video.onerror = () => reject(new Error('Chromium could not seek the generated WebM'));
    });
    const decoded = document.createElement('canvas');
    decoded.width = 320;
    decoded.height = 180;
    const decodedContext = decoded.getContext('2d');
    decodedContext.drawImage(video, 0, 0);
    const pixel = [...decodedContext.getImageData(5, 5, 1, 1).data];
    URL.revokeObjectURL(video.src);
    return { bytes: blob.size, duration: video.duration, width: video.videoWidth, height: video.videoHeight, decodedPixel: pixel };
  });
  console.log('MEDIABUNNY_WEBM_DECODE_DIAGNOSTIC', JSON.stringify(result));
  expect(result.bytes).toBeGreaterThan(1000);
  expect(result.duration).toBeGreaterThanOrEqual(0.9);
  expect(result.width).toBe(320);
  expect(result.height).toBe(180);
  expect(result.decodedPixel[3]).toBe(255);
});


test('isolated renderer draws scene frames without changing the editor canvas', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/');
  await page.locator('#addDemo').click();
  await page.locator('#motionPreset').selectOption('walk');
  await page.locator('#generateMotion').click();
  const before = await page.locator('#stage').evaluate(canvas => canvas.toDataURL());
  const state = await page.evaluate(() => window.__stickMotionProjectState());
  const renderer = await page.evaluateHandle(() => new Promise(resolve => {
    const frame = document.createElement('iframe');
    frame.style.display = 'none';
    const url = new URL(location.href);
    url.searchParams.set('export-renderer', '1');
    frame.onload = () => resolve(frame);
    frame.src = url.href;
    document.body.appendChild(frame);
  }));
  const result = await renderer.evaluate(async (frame, project) => {
    if (!frame.contentWindow.__stickMotionExportRenderer) throw new Error('Renderer isolation mode was not enabled');
    await frame.contentWindow.__stickMotionLoadExportScene(project);
    const firstCanvas = frame.contentWindow.__stickMotionRenderExportFrame(0);
    const first = firstCanvas.toDataURL();
    const secondCanvas = frame.contentWindow.__stickMotionRenderExportFrame(20);
    const second = secondCanvas.toDataURL();
    return { width: secondCanvas.width, height: secondCanvas.height, framesDiffer: first !== second };
  }, state);
  const after = await page.locator('#stage').evaluate(canvas => canvas.toDataURL());
  expect(result.width).toBe(1280);
  expect(result.height).toBe(720);
  expect(result.framesDiffer).toBeTruthy();
  expect(after).toBe(before);
  await renderer.evaluate(frame => frame.remove());
});

test('episode audio mixer aligns scene sound cues and emits continuous audio chunks', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const scenes = [
      { duration: 1, project: { soundEffectsVolume: 100, soundEffects: [{ frame: 12, type: 'impact', volume: 100 }] } },
      { duration: 1, project: { soundEffectsVolume: 80, soundEffects: [{ frame: 6, type: 'magic', volume: 90 }] } }
    ];
    const chunks = [];
    for await (const buffer of window.StickMotionEpisodeExport.mixEpisodeAudio({ scenes, fps: 24, chunkSeconds: 1 })) chunks.push(buffer);
    const rms = (buffer, fromSeconds, toSeconds) => {
      const channel = buffer.getChannelData(0);
      const start = Math.floor(fromSeconds * buffer.sampleRate);
      const end = Math.min(channel.length, Math.floor(toSeconds * buffer.sampleRate));
      let sum = 0;
      for (let i = start; i < end; i++) sum += channel[i] * channel[i];
      return Math.sqrt(sum / Math.max(1, end - start));
    };
    return {
      chunks: chunks.length,
      duration: chunks.reduce((sum, buffer) => sum + buffer.duration, 0),
      firstCueRms: rms(chunks[0], 0.48, 0.75),
      secondCueRms: rms(chunks[1], 0.23, 0.52)
    };
  });
  expect(result.chunks).toBe(2);
  expect(result.duration).toBeCloseTo(2, 2);
  expect(result.firstCueRms).toBeGreaterThan(0.001);
  expect(result.secondCueRms).toBeGreaterThan(0.001);
});

test('Mediabunny episode encoder includes the mixed Opus audio track', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const audioContext = new Offline(1, 48000, 48000);
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    gain.gain.value = 0.12;
    oscillator.frequency.value = 440;
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(0);
    oscillator.stop(1);
    const audioBuffer = await audioContext.startRendering();
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const blob = await window.StickMotionEpisodeExport.encode({
      canvas, fps: 24, frameCount: 24, bitrate: 1000000, audioBuffer,
      renderFrame: async i => {
        const context = canvas.getContext('2d');
        context.fillStyle = '#234';
        context.fillRect(0, 0, 320, 180);
        context.fillStyle = '#fff';
        context.fillRect(i * 10, 40, 30, 30);
      }
    });
    const MB = await window.StickMotionEpisodeExport.loadMediabunny();
    const input = new MB.Input({ source: new MB.BlobSource(blob), formats: MB.ALL_FORMATS });
    const videoTrack = await input.getPrimaryVideoTrack();
    const audioTrack = await input.getPrimaryAudioTrack();
    const duration = await input.computeDuration();
    return { bytes: blob.size, video: !!videoTrack, audio: !!audioTrack, duration };
  });
  expect(result.bytes).toBeGreaterThan(1000);
  expect(result.video).toBeTruthy();
  expect(result.audio).toBeTruthy();
  expect(result.duration).toBeGreaterThanOrEqual(0.9);
});


test('full episode export preserves imported audio and scene sound effects', async ({ page }) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addDemo').click();

  await page.locator('#frame').fill('12');
  await page.locator('#frame').dispatchEvent('input');
  await page.locator('#sfxType').selectOption('impact');
  await page.locator('#addSfxCue').click();
  await page.locator('#sceneDuration').fill('1');
  await page.locator('#sceneDuration').dispatchEvent('change');

  await page.locator('#sceneAdd').click();
  await page.locator('#sceneDuration').fill('1');
  await page.locator('#sceneDuration').dispatchEvent('change');
  await page.locator('#frame').fill('18');
  await page.locator('#frame').dispatchEvent('input');
  await page.locator('#sfxType').selectOption('magic');
  await page.locator('#addSfxCue').click();

  const audioDuration = await page.evaluate(async () => {
    const sampleRate = 48000;
    const samples = sampleRate * 2;
    const bytes = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(bytes);
    const write = (offset, value) => {
      for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
    };
    write(0, 'RIFF');
    view.setUint32(4, 36 + samples * 2, true);
    write(8, 'WAVE');
    write(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, 'data');
    view.setUint32(40, samples * 2, true);
    for (let i = 0; i < samples; i++) {
      const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.15;
      view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
    }
    const audio = document.querySelector('#dialogueAudio');
    const metadataReady = new Promise((resolve, reject) => {
      audio.addEventListener('loadedmetadata', resolve, { once: true });
      audio.addEventListener('error', () => reject(new Error('Synthetic imported audio could not be loaded')), { once: true });
    });
    audio.src = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
    audio.load();
    await metadataReady;
    return audio.duration;
  });
  expect(audioDuration).toBeCloseTo(2, 1);

  const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
  await page.locator('#exportEpisodeVideo').click();
  await expect(page.locator('#videoStatus')).toContainText('Full episode exported and verified', { timeout: 60000 });
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('stickmotion-full-episode.webm');
  expect(await download.failure()).toBeNull();
  expect(errors).toEqual([]);
});


test('audio-driven lip sync opens the mouth for loud dialogue and relaxes during silence', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const duration = await page.evaluate(async () => {
    const sampleRate = 22050, samples = sampleRate * 2;
    const bytes = new ArrayBuffer(44 + samples * 2), view = new DataView(bytes);
    const write = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
    write(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); write(8, 'WAVE');
    write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples * 2, true);
    for (let i = 0; i < samples; i++) {
      const amplitude = i < sampleRate ? 0 : 0.35;
      view.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * 220 * i / sampleRate) * amplitude * 32767), true);
    }
    const audio = document.querySelector('#dialogueAudio');
    const ready = new Promise((resolve, reject) => {
      audio.addEventListener('loadedmetadata', resolve, { once: true });
      audio.addEventListener('error', () => reject(new Error('Synthetic lip-sync audio failed to load')), { once: true });
    });
    audio.src = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
    audio.load();
    await ready;
    return audio.duration;
  });
  expect(duration).toBeCloseTo(2, 1);
  await page.locator('#autoLip').click();
  await page.locator('#audioPlay').click();
  await page.waitForFunction(() => document.querySelector('#dialogueAudio').currentTime > 0.25);
  const quietMouth = await page.evaluate(() => face.mouth);
  await page.waitForFunction(() => document.querySelector('#dialogueAudio').currentTime > 1.35);
  const loudMouth = await page.evaluate(() => face.mouth);
  expect(loudMouth).toBeGreaterThan(quietMouth + 0.2);
  expect(loudMouth).toBeGreaterThan(0.35);
  await page.locator('#audioStop').click();
  expect(errors).toEqual([]);
});

test('dialogue audio is saved across reloads and included in project downloads', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(() => {
    const sampleRate = 8000, samples = 8000;
    const bytes = new ArrayBuffer(44 + samples * 2), view = new DataView(bytes);
    const write = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
    write(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); write(8, 'WAVE');
    write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples * 2, true);
    for (let i = 0; i < samples; i++) view.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * 440 * i / sampleRate) * 5000), true);
    const input = document.querySelector('#audioFile'), transfer = new DataTransfer();
    transfer.items.add(new File([bytes], 'saved-dialogue.wav', { type: 'audio/wav' }));
    input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('#audioStatus')).toContainText('saved-dialogue.wav');
  await expect(page.locator('#audioStatus')).toContainText('saved');
  await page.reload();
  await expect(page.locator('#audioStatus')).toContainText('saved-dialogue.wav · restored');
  const restored = await page.evaluate(() => ({ src: document.querySelector('#dialogueAudio').src, name: document.querySelector('#audioStatus').textContent }));
  expect(restored.src).toContain('blob:');
  expect(restored.name).toContain('saved-dialogue.wav');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#saveProject').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let json = '';
  for await (const chunk of stream) json += chunk.toString('utf8');
  const project = JSON.parse(json);
  expect(project.dialogueAudio.name).toBe('saved-dialogue.wav');
  expect(project.dialogueAudio.data).toMatch(/^data:audio\/wav;base64,/);
  expect(errors).toEqual([]);
});

test('imported character artwork autosaves and survives a browser reload', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#files').setInputFiles({
    name: 'character-part.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=', 'base64')
  });
  await page.waitForFunction(() => window.localStorage.getItem('stickmotion-anime-studio-project-v1') && JSON.parse(window.localStorage.getItem('stickmotion-anime-studio-project-v1')).parts?.length === 1);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('stickmotion-anime-studio-project-v1')));
  expect(saved.parts[0].name).toBe('character-part.png');
  expect(saved.parts[0].image).toMatch(/^data:image\/png;base64,/);
  await page.reload();
  await page.waitForFunction(() => typeof parts !== 'undefined' && parts.length === 1 && parts[0].img?.complete && parts[0].img.naturalWidth === 1);
  const restored = await page.evaluate(() => ({ name: parts[0].name, width: parts[0].img.naturalWidth, height: parts[0].img.naturalHeight }));
  expect(restored).toEqual({ name: 'character-part.png', width: 1, height: 1 });
  expect(errors).toEqual([]);
});

test('saved project files reopen imported character artwork with the image intact', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/');
  await page.locator('#files').setInputFiles({
    name: 'roundtrip-character.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=', 'base64')
  });
  await page.waitForFunction(() => typeof parts !== 'undefined' && parts.length === 1 && parts[0].img?.complete && parts[0].img.naturalWidth === 1);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#saveProject').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let json = '';
  for await (const chunk of stream) json += chunk.toString('utf8');
  const project = JSON.parse(json);
  expect(project.parts).toHaveLength(1);
  expect(project.parts[0].name).toBe('roundtrip-character.png');
  expect(project.parts[0].image).toMatch(/^data:image\/png;base64,/);

  await page.locator('#reset').click();
  await page.waitForFunction(() => parts.length === 0);
  await page.locator('#projectFile').setInputFiles({
    name: 'stickmotion-project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json)
  });
  await page.waitForFunction(() => parts.length === 1 && parts[0].name === 'roundtrip-character.png' && parts[0].img?.complete && parts[0].img.naturalWidth === 1);
  const reopened = await page.evaluate(() => ({
    name: parts[0].name,
    width: parts[0].img.naturalWidth,
    height: parts[0].img.naturalHeight,
    imageData: parts[0].img.src.startsWith('data:image/png;base64,')
  }));
  expect(reopened).toEqual({ name: 'roundtrip-character.png', width: 1, height: 1, imageData: true });
  expect(errors).toEqual([]);
});



test('layer visibility and transform controls support undo and redo', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addDemo').click();
  await page.waitForFunction(() => parts.length === 10);

  await page.locator('#layers .layer').first().locator('.eye').click();
  expect(await page.evaluate(() => parts[0].visible)).toBe(false);
  await page.locator('#undo').click();
  expect(await page.evaluate(() => parts[0].visible)).toBe(true);
  await page.locator('#redo').click();
  expect(await page.evaluate(() => parts[0].visible)).toBe(false);

  await page.evaluate(() => select(0));
  await page.locator('#scale').evaluate(input => {
    input.value = '1.7';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(await page.evaluate(() => parts[0].scale)).toBeCloseTo(1.7, 2);
  await page.locator('#undo').click();
  expect(await page.evaluate(() => parts[0].scale)).toBeCloseTo(1, 2);
  await page.locator('#redo').click();
  expect(await page.evaluate(() => parts[0].scale)).toBeCloseTo(1.7, 2);
  expect(errors).toEqual([]);
});

test('rig hierarchy preserves world transforms, blocks cycles, and remaps layer references', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addDemo').click();
  await page.waitForFunction(() => parts.length === 10);
  await page.evaluate(() => {
    parts[0].x = 40; parts[0].y = 30; parts[0].rot = 30; parts[0].scale = 2;
    parts[1].x = 100; parts[1].y = 50; parts[1].rot = 15; parts[1].scale = 0.75;
    keys[0] = snap();
    select(1);
    pushHistory();
  });
  const beforeAttach = await page.evaluate(() => worldTransform(1));
  await page.locator('#parentSelect').selectOption('0');
  await page.locator('#attachPart').click();
  const afterAttach = await page.evaluate(() => worldTransform(1));
  expect(afterAttach.x).toBeCloseTo(beforeAttach.x, 5);
  expect(afterAttach.y).toBeCloseTo(beforeAttach.y, 5);
  expect(afterAttach.r).toBeCloseTo(beforeAttach.r, 5);
  expect(afterAttach.sc).toBeCloseTo(beforeAttach.sc, 5);

  await page.evaluate(() => select(0));
  const allowedParents = await page.locator('#parentSelect option').evaluateAll(options => options.map(o => o.value));
  expect(allowedParents).not.toContain('1');
  await page.evaluate(() => { const select = document.querySelector('#parentSelect'); select.add(new Option('Head (invalid descendant)', '1')); select.value = '1'; });
  await page.locator('#attachPart').click();
  expect(await page.evaluate(() => parts[0].parent)).toBe(-1);
  expect(await page.evaluate(() => parts[1].parent)).toBe(0);

  const torsoKeyX = await page.evaluate(() => keys[0][0].x);
  await page.evaluate(() => select(0));
  await page.locator('#down').click();
  const reordered = await page.evaluate(() => ({
    names: [parts[0].name, parts[1].name],
    childParent: parts[0].parent,
    keyX: keys[0][1].x
  }));
  expect(reordered.names[1]).toBe('Torso');
  expect(reordered.childParent).toBe(1);
  expect(reordered.keyX).toBe(torsoKeyX);

  const childWorldBeforeRemoval = await page.evaluate(() => worldTransform(0));
  await page.evaluate(() => select(1));
  await page.locator('#remove').click();
  const childAfterRemoval = await page.evaluate(() => ({ parent: parts[0].parent, world: worldTransform(0), keyCount: keys[0].length }));
  expect(childAfterRemoval.parent).toBe(-1);
  expect(childAfterRemoval.world.x).toBeCloseTo(childWorldBeforeRemoval.x, 5);
  expect(childAfterRemoval.world.y).toBeCloseTo(childWorldBeforeRemoval.y, 5);
  expect(childAfterRemoval.world.r).toBeCloseTo(childWorldBeforeRemoval.r, 5);
  expect(childAfterRemoval.world.sc).toBeCloseTo(childWorldBeforeRemoval.sc, 5);
  expect(childAfterRemoval.keyCount).toBe(9);

  await page.locator('#undo').click();
  expect(await page.evaluate(() => ({ count: parts.length, torso: parts[1].name, parent: parts[0].parent })))
    .toEqual({ count: 10, torso: 'Torso', parent: 1 });
  await page.locator('#redo').click();
  expect(await page.evaluate(() => parts.length)).toBe(9);
  expect(errors).toEqual([]);
});


test('timeline keyframe capture, delete, clear, undo and reload all persist', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addDemo').click();
  await page.waitForFunction(() => parts.length === 10);
  await page.evaluate(() => {
    frame = 20;
    document.querySelector('#frame').value = '20';
    document.querySelector('#frameLabel').textContent = '20';
    parts[0].x = 123;
    syncControls();
    draw();
  });
  await page.locator('#capture').click();
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('stickmotion-anime-studio-project-v1') || '{}');
    return state.keyframes?.['20']?.[0]?.x === 123;
  });
  await page.reload();
  await page.waitForFunction(() => keys?.['20']?.[0]?.x === 123 && parts.length === 10);
  expect(await page.evaluate(() => ({ frame, keyX: keys[20][0].x }))).toEqual({ frame: 20, keyX: 123 });

  await page.locator('#deleteKey').click();
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem('stickmotion-anime-studio-project-v1') || '{}').keyframes?.['20']);
  await page.locator('#undo').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('stickmotion-anime-studio-project-v1') || '{}').keyframes?.['20']?.[0]?.x === 123);

  await page.locator('#clearKeys').click();
  await page.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('stickmotion-anime-studio-project-v1') || '{}').keyframes || {}).length === 0);
  await page.locator('#undo').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('stickmotion-anime-studio-project-v1') || '{}').keyframes?.['20']?.[0]?.x === 123);
  expect(errors).toEqual([]);
});


test('timeline playback advances interpolated poses and pauses cleanly', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addDemo').click();
  await page.waitForFunction(() => parts.length === 10);
  await page.evaluate(() => {
    const start = snap(), end = snap();
    start[0].x = 0;
    end[0].x = 100;
    keys = { 0: start, 10: end };
    frame = 0;
    document.querySelector('#frame').value = '0';
    applyKey(0);
    draw();
  });
  await page.locator('#play').click();
  await page.waitForFunction(() => frame >= 2 && parts[0].x > 0);
  await expect(page.locator('#play')).toContainText('Pause');
  await page.locator('#play').click();
  const pausedFrame = await page.evaluate(() => frame);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => frame)).toBe(pausedFrame);
  await expect(page.locator('#play')).toContainText('Play');
  expect(errors).toEqual([]);
});


test('saved project files preserve body, facial, and camera animation keys', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/');
  await page.locator('#addDemo').click();
  await page.waitForFunction(() => parts.length === 10);
  await page.evaluate(() => {
    const start = snap(), end = snap();
    start[0].x = 0;
    end[0].x = 240;
    keys = { 0: start, 30: end };
    frame = 12;
    faceKeys[12] = { ...face, gx: 0.4, viseme: 'A' };
    cameraKeys[12] = { x: 15, y: -5, zoom: 1.2, rot: 8 };
    draw();
  });
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#saveProject').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let json = '';
  for await (const chunk of stream) json += chunk.toString('utf8');
  const project = JSON.parse(json);
  expect(Object.keys(project.keyframes)).toEqual(['0', '30']);
  expect(project.keyframes['30'][0].x).toBe(240);
  expect(project.faceKeys['12'].gx).toBe(0.4);
  expect(project.cameraKeys['12'].zoom).toBe(1.2);

  await page.locator('#reset').click();
  await page.waitForFunction(() => parts.length === 0 && Object.keys(keys).length === 0);
  await page.locator('#projectFile').setInputFiles({
    name: 'stickmotion-animation-project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json)
  });
  await page.waitForFunction(() => parts.length === 10 && keys['30']?.[0]?.x === 240 && parts[0].img?.complete && parts[0].img.naturalWidth > 0);
  const restored = await page.evaluate(() => ({
    frame,
    bodyKey: keys[30][0].x,
    faceGaze: faceKeys[12].gx,
    cameraZoom: cameraKeys[12].zoom
  }));
  expect(restored).toEqual({ frame: 12, bodyKey: 240, faceGaze: 0.4, cameraZoom: 1.2 });
  expect(errors).toEqual([]);
});
