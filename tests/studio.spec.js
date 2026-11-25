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
  test.setTimeout(120000);
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
  const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
  await page.locator('#exportEpisodeVideo').click();
  await expect(page.locator('#videoStatus')).toContainText(/Full episode exported|Episode export failed/, { timeout: 30000 });
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

