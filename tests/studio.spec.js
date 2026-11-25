const { test, expect } = require('@playwright/test');

test('studio loads without JavaScript errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/StickMotion Anime Studio/);
  await expect(page.locator('#stage')).toBeVisible();
  await expect(page.locator('.badge')).toContainText('v7.9');
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
  expect(errors).toEqual([]);
});
