/**
 * Sandbox verification (vite dev or preview server).
 *
 * The interesting failures here are ones neither tsc nor vitest can see, and
 * both actually happened while building it:
 *   - playback silently crawling because leftover frame time wasn't carried;
 *   - the canvas ResizeObserver chasing its own height, re-clearing the canvas
 *     every frame so the scene rendered *nothing* (ink === 0).
 * So this drives the real page and asserts on pixels and frame rate.
 *
 *   node scripts/smoke-sandbox.mjs [baseUrl]
 */

import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:5187'
const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

/** The classic capstone bug: move with the OLD velocity (explicit Euler). */
const BUGGY = `function spawnParticle(speed) {
  const dir = normalize3({ x: Math.random()*2-1, y: Math.random()*2-1, z: Math.random()*2-1 });
  return { pos: { x: 0, y: 0, z: 0 }, vel: scale3(dir, speed), age: 0 };
}
function updateParticle(p, gravity, dt) {
  const pos = add3(p.pos, scale3(p.vel, dt));
  const vel = add3(p.vel, scale3(gravity, dt));
  console.log('y =', pos.y);
  return { pos: pos, vel: vel, age: p.age + dt };
}`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`))

const frameNo = () => page.$eval('.sb-frame', (n) => Number(/frame (\d+)/.exec(n.textContent)[1]))

await page.goto(`${base}/sandbox/`, { waitUntil: 'networkidle' })
await page.waitForSelector('.cm-editor', { timeout: 15000 })
await page.click('.sb-load-solution')
await page.waitForTimeout(300)
check('reference solution compiles', (await page.textContent('.sb-status')).includes('compiled'))

// --- playback runs at the fixed 60 Hz, in real time ---
const t0 = Date.now()
const f0 = await frameNo()
await page.waitForTimeout(2000)
const fps = (await frameNo() - f0) / ((Date.now() - t0) / 1000)
check('sim advances at ~60 fps', fps > 45 && fps < 75, `${fps.toFixed(1)} frames/s`)

// --- the scene actually renders (guards the canvas-clearing regression) ---
const view = await page.evaluate(() => {
  const v = document.querySelector('.sb-view')
  const c = v.querySelector('canvas')
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  let lit = 0
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) lit++
  return { ink: lit / (c.width * c.height), fits: Math.abs(c.height - v.clientHeight) <= 1 }
})
check('canvas draws the scene', view.ink > 0.005, `${(view.ink * 100).toFixed(1)}% of pixels lit`)
check('canvas height tracks its pane', view.fits)

// --- transport: pause, step back, step forward ---
await page.click('.sb-play')
const paused = await frameNo()
await page.waitForTimeout(250)
check('pause stops the sim', (await frameNo()) === paused)
await page.click('.sb-back')
check('step back rewinds one frame', (await frameNo()) === paused - 1)
await page.click('.sb-fwd')
check('step forward advances one frame', (await frameNo()) === paused)

// --- determinism: the same frame index must replay identically ---
const stateAt = async (n) => {
  await page.click('.sb-reset')
  for (let i = 0; i < n; i++) await page.click('.sb-fwd')
  return page.$$eval('.sb-row', (rs) => rs.map((r) => r.textContent).join('|'))
}
const a = await stateAt(20)
const b = await stateAt(20)
check('replay is deterministic', a.length > 0 && a === b)

// --- the math trace catches the old-velocity bug, and logs are captured ---
await page.evaluate((code) => localStorage.setItem('3d101:sandbox:m01-fountain', code), BUGGY)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.sb-row', { timeout: 15000 })
await page.click('.sb-play') // pause
await page.click('.sb-row') // select a particle
await page.waitForTimeout(150)

const trace = await page.$$eval('.sb-trace-line', (ns) =>
  ns.map((n) => ({
    label: n.querySelector('.lbl')?.textContent,
    bad: n.classList.contains('is-bad'),
    note: n.querySelector('.note')?.textContent ?? '',
  })),
)
const posLine = trace.find((t) => t.label?.startsWith('pos'))
check('trace flags the old-velocity bug', !!posLine?.bad)
check('trace explains it', (posLine?.note ?? '').includes('explicit Euler'))
check('vel is still marked correct', trace.find((t) => t.label?.startsWith('vel'))?.bad === false)
check('console captures learner logs', (await page.$$('.sb-log')).length > 0)

// --- the Tests tab runs the same code through the timeout-protected worker ---
await page.click('.sb-tab[data-tab="tests"]')
await page.waitForSelector('.sb-test', { timeout: 10000 })
const failed = await page.$$eval('.sb-test.is-bad .t', (ns) => ns.map((n) => n.textContent))
check('tests tab fails the right test', failed.some((t) => t.includes('NEW velocity')), failed.join(', '))

check('no console errors', errors.length === 0, errors.join(' | '))

await browser.close()
console.log(failures.length ? `\n${failures.length} sandbox check(s) failed.` : '\nAll sandbox smoke checks passed.')
process.exit(failures.length ? 1 : 0)
