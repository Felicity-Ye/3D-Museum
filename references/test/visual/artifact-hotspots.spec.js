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
  await expect(guide.getByRole('link', { name: /三星堆博物馆/ })).toHaveAttribute('href', 'https://www.sxd.cn/relics/')
  await guide.getByRole('button', { name: '退出热点观察' }).click()
  await expect(guide).toHaveCount(0)

  await page.getByRole('button', { name: /商戴金面罩青铜人头像/ }).click()
  await expect(page.locator('.artifact-hotspot-marker')).toHaveCount(0)
})
