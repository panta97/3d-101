import { TOC } from './page'

/**
 * Per-module section menu. Module prose is hand-authored HTML with no section
 * data model, so the outline is derived from the page's <h2>s at runtime and
 * every heading gets a linkable id.
 */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Heading text with the section number stripped off. */
function headingTitle(h2: HTMLHeadingElement): string {
  const clone = h2.cloneNode(true) as HTMLHeadingElement
  clone.querySelector('.secnum')?.remove()
  return clone.textContent!.trim()
}

/**
 * A derived id follows the heading text, so rewording a heading silently
 * breaks links to it. To pin a section's URL for good, hand-write an `id` on
 * the <h2> — an authored id always wins.
 */
function sectionId(h2: HTMLHeadingElement, moduleNum: number): string {
  const secnum = h2.querySelector('.secnum')?.textContent?.trim() ?? ''
  const numbered = /^(\d+)\.(\d+)$/.exec(secnum)
  const prefix = numbered ? `${numbered[1]}-${numbered[2]}` : `${moduleNum}`
  return `${prefix}-${slugify(headingTitle(h2))}`
}

function moduleSwitcher(moduleNum: number): HTMLElement {
  const details = document.createElement('details')
  details.className = 'page-nav-modules'
  const items = TOC.map((entry) => {
    const inner = `<span class="n">${entry.num}</span><span class="t">${entry.title}</span>`
    const current = entry.num === moduleNum ? ' aria-current="page"' : ''
    return entry.slug
      ? `<li><a href="../${entry.slug}/"${current}>${inner}</a></li>`
      : `<li class="is-stub"><span>${inner}</span></li>`
  }).join('')
  details.innerHTML = `
    <summary>Module ${moduleNum} of ${TOC.length}</summary>
    <ul>${items}</ul>
  `
  return details
}

/**
 * Exercise editors and widget canvases only size themselves once they scroll
 * into view, and that moves everything below them — so a jump made before the
 * page has settled overshoots its heading. Re-pin the target whenever the
 * layout shifts under it, until it holds still or the reader takes the scroll.
 */
function pinToHash(): void {
  const target = document.getElementById(decodeURIComponent(location.hash.slice(1)))
  if (!target) return

  const offsetOf = () => Math.round(target.getBoundingClientRect().top + window.scrollY)
  let offset = offsetOf()
  const deadline = performance.now() + 2000

  const reader = new AbortController()
  const release = () => reader.abort()
  const opts = { signal: reader.signal, passive: true }
  addEventListener('wheel', release, opts)
  addEventListener('touchstart', release, opts)
  addEventListener('keydown', release, opts)

  const tick = () => {
    if (reader.signal.aborted) return
    // Scrolling never changes a document-space offset — only a reflow does.
    const now = offsetOf()
    if (now !== offset) {
      offset = now
      target.scrollIntoView()
    }
    if (performance.now() < deadline) requestAnimationFrame(tick)
    else release()
  }
  requestAnimationFrame(tick)
}

export function buildSectionNav(moduleNum: number): void {
  const headings = [...document.querySelectorAll<HTMLHeadingElement>('main.prose h2')]
  if (!headings.length) return

  const seen = new Set<string>()
  const links = new Map<string, HTMLAnchorElement>()

  const list = document.createElement('ol')
  list.className = 'page-nav-sections'

  for (const h2 of headings) {
    if (!h2.id) {
      let id = sectionId(h2, moduleNum)
      for (let n = 2; seen.has(id); n++) id = `${sectionId(h2, moduleNum)}-${n}`
      h2.id = id
    }
    seen.add(h2.id)

    const link = document.createElement('a')
    link.href = `#${h2.id}`
    link.innerHTML = `
      <span class="n">${h2.querySelector('.secnum')?.textContent ?? ''}</span>
      <span class="t">${headingTitle(h2)}</span>
    `

    // After the menu entry: the anchor's "#" is part of the heading's text.
    const anchor = document.createElement('a')
    anchor.className = 'heading-anchor'
    anchor.href = `#${h2.id}`
    anchor.textContent = '#'
    anchor.setAttribute('aria-label', 'Link to this section')
    h2.append(anchor)

    links.set(h2.id, link)

    const li = document.createElement('li')
    li.append(link)
    list.append(li)
  }

  const nav = document.createElement('nav')
  nav.className = 'page-nav'
  nav.setAttribute('aria-label', 'Section navigation')
  nav.append(moduleSwitcher(moduleNum))
  const label = document.createElement('p')
  label.className = 'page-nav-label'
  label.textContent = 'On this page'
  nav.append(label, list)
  document.body.append(nav)

  // Collapsed layout: the header button opens the same nav as a dropdown.
  const toggle = document.querySelector<HTMLButtonElement>('.page-nav-toggle')
  if (toggle) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open')
      toggle.setAttribute('aria-expanded', String(open))
    })
    nav.addEventListener('click', (e) => {
      if ((e.target as Element).closest('a')) {
        nav.classList.remove('is-open')
        toggle.setAttribute('aria-expanded', 'false')
      }
    })
  }

  let active: HTMLAnchorElement | null = null
  const setActive = (link: HTMLAnchorElement | undefined) => {
    if (!link || link === active) return
    active?.classList.remove('is-active')
    link.classList.add('is-active')
    active = link
  }

  // A heading is "current" once it passes under the header and until the next
  // one does — so track the lowest heading still above the top of the viewport.
  const visible = new Set<string>()
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id)
        else visible.delete(entry.target.id)
      }
      const first = headings.find((h) => visible.has(h.id))
      if (first) setActive(links.get(first.id))
    },
    { rootMargin: '-72px 0px -70% 0px' },
  )
  for (const h2 of headings) observer.observe(h2)

  addEventListener('hashchange', () => {
    setActive(links.get(decodeURIComponent(location.hash.slice(1))))
    pinToHash()
  })

  if (location.hash) {
    setActive(links.get(decodeURIComponent(location.hash.slice(1))))
    pinToHash()
  }
}
