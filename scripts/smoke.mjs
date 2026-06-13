/**
 * Browser-level smoke test for the exercise infrastructure (run against a
 * vite dev server): worker round-trip, timeout kill+respawn, panel reveal
 * flow, widget canvas presence, console error scan.
 *
 *   node scripts/smoke.mjs [baseUrl]
 */

import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:5187'
const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

const browser = await chromium.launch()
const page = await browser.newPage()
const consoleErrors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})
page.on('pageerror', (err) => consoleErrors.push(String(err)))

// --- module 1 page loads ---
await page.goto(`${base}/modules/01-vectors/`, { waitUntil: 'networkidle' })
check('module 1 page loads', (await page.title()).includes('3d-101'))
check('exercise panel mounted', (await page.locator('.exercise').count()) >= 1)
check('widget canvas present', (await page.locator('.widget canvas').count()) >= 1)

// --- runner API end-to-end in page context ---
const runnerResults = await page.evaluate(async () => {
  const { runner } = await import('/src/exercise/runner.ts')
  const good = await runner.run(
    '01/add',
    'function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }',
  )
  const bad = await runner.run('01/add', 'function add(a, b) { return { x: 0, y: 0 }; }')
  const syntax = await runner.run('01/add', 'function add(a, b { oops')
  const renamed = await runner.run('01/add', 'function plus(a, b) { return a; }')
  const t0 = performance.now()
  const loop = await runner.run('01/add', 'function add(a, b) { while (true) {} }')
  const loopMs = performance.now() - t0
  // Runner must survive the kill and serve the next run.
  const after = await runner.run(
    '01/add',
    'function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }',
  )
  return {
    good: good.kind,
    badKind: bad.kind,
    badFailCount: bad.kind === 'fail' ? bad.results.filter((r) => !r.pass).length : -1,
    syntax: syntax.kind,
    syntaxMsg: syntax.kind === 'compile-error' ? syntax.message.slice(0, 60) : '',
    renamed: renamed.kind,
    renamedMsg: renamed.kind === 'compile-error' ? renamed.message : '',
    loop: loop.kind,
    loopMs: Math.round(loopMs),
    after: after.kind,
  }
})
check('correct solution passes', runnerResults.good === 'pass')
check(
  'wrong solution fails tests',
  runnerResults.badKind === 'fail' && runnerResults.badFailCount >= 3,
  `${runnerResults.badFailCount} failing`,
)
check('syntax error reported', runnerResults.syntax === 'compile-error', runnerResults.syntaxMsg)
check(
  'renamed function gets friendly message',
  runnerResults.renamed === 'compile-error' && runnerResults.renamedMsg.includes('add'),
  runnerResults.renamedMsg,
)
check(
  'infinite loop times out ~2s',
  runnerResults.loop === 'timeout' && runnerResults.loopMs < 4000,
  `${runnerResults.loopMs}ms`,
)
check('runner survives kill (next run works)', runnerResults.after === 'pass')

// --- UI reveal flow ---
const panel = page.locator('.exercise').first()
await panel.scrollIntoViewIfNeeded()
await page.waitForSelector('.cm-editor', { timeout: 10_000 })
check('CodeMirror lazy-loaded', true)
await panel.locator('button.reveal').click()
await panel.locator('button.reveal').click() // two-step confirm
await page.waitForFunction(
  () => document.querySelector('.exercise .done')?.textContent?.includes('✓'),
  { timeout: 10_000 },
)
check('reveal → run → solved checkmark', true)
const passRows = await panel.locator('.test-row.pass').count()
check('all test rows pass after reveal', passRows >= 5, `${passRows} rows`)

// --- persistence ---
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.exercise .done')
const doneText = await page.locator('.exercise .done').first().textContent()
check('solved state persists across reload', doneText?.includes('✓') ?? false, doneText ?? '')

// --- home page ---
await page.goto(`${base}/`, { waitUntil: 'networkidle' })
check('home TOC renders 12 modules', (await page.locator('.toc-item').count()) === 12)

const realErrors = consoleErrors.filter((e) => !e.includes('favicon'))
check('no console errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

await browser.close()
if (failures.length) {
  console.error(`\nFAILED: ${failures.length} check(s): ${failures.join(', ')}`)
  process.exit(1)
}
console.log('\nAll smoke checks passed.')
