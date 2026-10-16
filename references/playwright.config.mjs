import { defineConfig } from '@playwright/test'

for (const key of ['NO_PROXY', 'no_proxy']) {
  const entries = (process.env[key] || '').split(',').filter(Boolean)
  for (const host of ['localhost', '127.0.0.1', '::1']) {
    if (!entries.includes(host)) entries.push(host)
  }
  process.env[key] = entries.join(',')
}

export default defineConfig({
  testDir: './test/visual',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.025,
      threshold: 0.18,
    },
  },
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    launchOptions: process.env.CHROME_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROME_EXECUTABLE_PATH, args: ['--use-gl=angle', '--use-angle=swiftshader'] }
      : undefined,
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
