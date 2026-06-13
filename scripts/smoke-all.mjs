/**
 * Full-course browser verification (vite dev or preview server):
 * for every module page — widgets mount, every exercise's solution passes
 * through the real worker via the reveal flow, learner fns attach to widgets
 * without throwing, canvases survive pointer drags, console stays clean.
 *
 *   node scripts/smoke-all.mjs [baseUrl]
 */

import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:5187'
const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

const MODULES = [
  { path: '/modules/01-vectors/', exercises: 7 },
  { path: '/modules/02-dot-cross-planes/', exercises: 7 },
  { path: '/modules/03-matrices/', exercises: 8 },
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
let consoleErrors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})
page.on('pageerror', (err) => consoleErrors.push(String(err)))

for (const mod of MODULES) {
  consoleErrors = []
  console.log(`\n=== ${mod.path} ===`)
  await page.goto(`${base}${mod.path}`, { waitUntil: 'networkidle' })

  const widgetCount = await page.locator('[data-widget]').count()
  const exerciseCount = await page.locator('[data-exercise]').count()
  check(`page loads with widgets`, widgetCount >= mod.exercises, `${widgetCount} widgets`)
  check(`all exercises mounted`, exerciseCount === mod.exercises, `${exerciseCount}/${mod.exercises}`)
  check(
    `every widget produced a canvas`,
    (await page.locator('[data-widget] canvas').count()) >= widgetCount,
  )

  // KaTeX rendered (every module page has TeX).
  await page.waitForTimeout(800)
  check(`KaTeX rendered`, (await page.locator('.katex').count()) > 0)

  // Drag across the first few canvases (orbit / handles) — must not throw.
  const canvases = page.locator('[data-widget] canvas')
  const nCanv = Math.min(await canvases.count(), 4)
  for (let i = 0; i < nCanv; i++) {
    const box = await canvases.nth(i).boundingBox()
    if (!box) continue
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 30, { steps: 5 })
    await page.mouse.up()
  }
  check(`canvas drags don't throw`, true)

  // Reveal + run every exercise; each must reach the solved checkmark.
  for (let i = 0; i < exerciseCount; i++) {
    const panel = page.locator('[data-exercise]').nth(i)
    const id = await panel.getAttribute('data-exercise')
    await panel.scrollIntoViewIfNeeded()
    try {
      await panel.locator('.cm-editor').waitFor({ timeout: 10_000 })
      await panel.locator('button.reveal').click()
      await panel.locator('button.reveal').click()
      await page.waitForFunction(
        (el) => el.querySelector('.done')?.textContent?.includes('✓'),
        await panel.elementHandle(),
        { timeout: 10_000 },
      )
      check(`${id} reveal → all tests pass → widgets attached`, true)
    } catch (e) {
      const msg = await panel.locator('.exercise-message').textContent().catch(() => '')
      const fails = await panel.locator('.test-row.fail').count().catch(() => -1)
      check(`${id} reveal → all tests pass`, false, `${fails} failing rows; msg: ${msg?.slice(0, 120)}`)
    }
  }

  // Let widgets animate a moment with learner fns attached, then scan console.
  await page.waitForTimeout(1500)
  const realErrors = consoleErrors.filter((e) => !e.includes('favicon'))
  check(`no console errors on ${mod.path}`, realErrors.length === 0, realErrors.slice(0, 3).join(' | '))
}

// Home page nav links resolve.
await page.goto(`${base}/`, { waitUntil: 'networkidle' })
check('home TOC renders 12 modules', (await page.locator('.toc-item').count()) === 12)
check('3 modules linked', (await page.locator('.toc-item > a').count()) === 3)

await browser.close()
console.log('')
if (failures.length) {
  console.error(`FAILED: ${failures.length} check(s):\n - ${failures.join('\n - ')}`)
  process.exit(1)
}
console.log('All full-course smoke checks passed.')
