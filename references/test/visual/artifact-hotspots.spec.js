import { expect, test } from '@playwright/test'

test('tree hotspots explain verified features, focus the camera, and reset cleanly', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /商青铜神树/ }).click()

  const baseHotspot = page.getByRole('button', { name: '镂空山形底座' })
  await expect(baseHotspot).toBeVisible({ timeout: 60_000 })
  await baseHotspot.hover()
  await expect(page.locator('.artifact-hotspot-label', { hasText: '镂空山形底座' })).toBeVisible()
  await baseHotspot.click()

  const guide = page.getByRole('region', { name: '热点讲解' })
  await expect(guide.getByRole('heading', { name: '镂空山形底座' })).toBeVisible()
  await expect(guide.getByRole('link')).toHaveCount(0)
  await guide.getByRole('button', { name: '退出' }).click()
  await expect(guide).toHaveCount(0)

  await page.getByRole('button', { name: /商戴金面罩青铜人头像/ }).click()
  await expect(page.locator('.artifact-hotspot-marker')).toHaveCount(0)
})

test('tree guided tour starts with subtitles and exit restores hotspot interaction', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /商青铜神树/ }).click()

  const start = page.getByRole('button', { name: '开始参观' })
  await expect(start).toBeEnabled({ timeout: 60_000 })
  await start.click()
  await expect(page.locator('.artifact-tour-caption')).toContainText('文物全貌')
  await expect(page.getByRole('button', { name: '暂停导览' })).toBeVisible()
  await expect(page.getByRole('button', { name: '镂空山形底座' })).toBeDisabled()

  await page.getByRole('button', { name: '退出导览' }).click()
  await expect(page.getByRole('button', { name: '开始参观' })).toBeVisible()
  await expect(page.getByRole('button', { name: '镂空山形底座' })).toBeEnabled()

  await page.getByRole('button', { name: /商戴金面罩青铜人头像/ }).click()
  await expect(page.getByRole('button', { name: '开始参观' })).toHaveCount(0)
})

test('repeated hotspot changes do not exhaust WebGL contexts', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /商青铜神树/ }).click()

  const names = ['镂空山形底座', '三层枝与神鸟', '树侧铜龙']
  const hotspots = names.map((name) => page.getByRole('button', { name, exact: true }))
  for (const hotspot of hotspots) await expect(hotspot).toBeVisible({ timeout: 60_000 })
  await page.locator('canvas').evaluate((canvas) => {
    canvas.addEventListener('webglcontextlost', () => { canvas.dataset.contextLostEvent = 'true' })
  })

  for (let index = 0; index < 12; index += 1) {
    const name = names[index % names.length]
    await hotspots[index % hotspots.length].dispatchEvent('click')
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  }

  await page.waitForTimeout(1_500)
  const contextLost = await page.locator('canvas').evaluate((canvas) => canvas.dataset.contextLostEvent === 'true')
  expect(contextLost).toBe(false)
})
