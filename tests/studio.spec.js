const { test, expect } = require('@playwright/test');

test('studio loads without JavaScript errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/StickMotion Anime Studio/);
  await expect(page.locator('#stage')).toBeVisible();
  await expect(page.locator('.badge')).toContainText('v6.9');
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
