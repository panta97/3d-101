import './styles.css'
import { buildSectionNav } from './nav'

export interface TocEntry {
  num: number
  /** Directory name under modules/, or null while the module is unbuilt. */
  slug: string | null
  title: string
  blurb: string
}

export const TOC: TocEntry[] = [
  {
    num: 1,
    slug: '01-vectors',
    title: 'Vectors: The Atoms of 3D',
    blurb: 'Points vs displacements; add, subtract, scale, length, normalize, lerp — in 2D, then 3D.',
  },
  {
    num: 2,
    slug: '02-dot-cross-planes',
    title: 'Dot, Cross, and Planes',
    blurb: 'Alignment, projection, field-of-view tests, surface normals, signed distance, reflection.',
  },
  {
    num: 3,
    slug: '03-matrices',
    title: 'Matrices: Transforming Space',
    blurb: 'Columns as basis vectors, composition, the homogeneous trick, Mat4 and TRS hierarchies.',
  },
  {
    num: 4,
    slug: '04-coordinate-spaces-camera',
    title: 'Coordinate Spaces & the Camera',
    blurb: 'Model, world and view space; change of basis; cheap rigid inverses; lookAt.',
  },
  {
    num: 5,
    slug: '05-projection',
    title: 'Projection: 3D onto the Screen',
    blurb: 'The perspective divide, the projection matrix, NDC, viewport — project3() demystified.',
  },
  {
    num: 6,
    slug: null,
    title: 'Triangles, Depth & Rasterization',
    blurb: 'Edge functions (cross2 returns!), barycentric coordinates, z-buffer, backface culling.',
  },
  {
    num: 7,
    slug: null,
    title: 'Light: Your First Real Shaders',
    blurb: 'Lambert, Blinn-Phong; flat vs Gouraud vs per-pixel; why normals need the inverse-transpose.',
  },
  {
    num: 8,
    slug: null,
    title: 'Textures & Interpolation',
    blurb: 'UVs, bilinear filtering, perspective-correct interpolation.',
  },
  {
    num: 9,
    slug: null,
    title: 'Rotation Done Right: Quaternions',
    blurb: 'Feel gimbal lock break your wrists, then fix it: axis-angle, quaternions, slerp.',
  },
  {
    num: 10,
    slug: null,
    title: 'Ray Tracing I: Casting Rays',
    blurb: 'o + t·d; ray vs plane, sphere and triangle; hard shadows.',
  },
  {
    num: 11,
    slug: null,
    title: 'Ray Tracing II: Bounce the World',
    blurb: 'Recursion, mirrors, refraction, sampling.',
  },
  {
    num: 12,
    slug: null,
    title: 'From Software to Silicon',
    blurb: 'Map everything you hand-built onto real GPU shaders.',
  },
]

interface PageOptions {
  /** Module number (1-based) when initializing a module page; omit on the home page. */
  module?: number
  /** Path back to the site root. Defaults from `module`; set it on other subpages (/sandbox/). */
  root?: string
  /** Header breadcrumb for pages that aren't modules. */
  breadcrumb?: string
}

/** Path prefix back to the site root from the current page. */
function rootPrefix(opts: PageOptions): string {
  return opts.root ?? (opts.module ? '../../' : './')
}

function hrefFor(entry: TocEntry, opts: PageOptions): string | null {
  if (!entry.slug) return null
  return `${rootPrefix(opts)}modules/${entry.slug}/`
}

function buildHeader(opts: PageOptions): HTMLElement {
  const header = document.createElement('header')
  header.className = 'site-header'
  const current = opts.module ? TOC[opts.module - 1] : null
  const crumb = current ? `Module ${current.num} — ${current.title}` : opts.breadcrumb
  header.innerHTML = `
    <a class="site-title" href="${rootPrefix(opts)}">3d-101</a>
    ${crumb ? `<span class="site-breadcrumb">${crumb}</span>` : ''}
    ${current ? `<button class="page-nav-toggle" aria-expanded="false">Sections</button>` : ''}
  `
  return header
}

function buildFooterNav(opts: PageOptions): HTMLElement | null {
  if (!opts.module) return null
  const prev = TOC[opts.module - 2]
  const next = TOC[opts.module]
  const nav = document.createElement('nav')
  nav.className = 'module-nav'

  const prevHref = prev ? hrefFor(prev, opts) : rootPrefix(opts)
  const prevLabel = prev ? `← Module ${prev.num}: ${prev.title}` : '← Course home'
  const nextHref = next ? hrefFor(next, opts) : null
  const nextLabel = next
    ? nextHref
      ? `Module ${next.num}: ${next.title} →`
      : `Module ${next.num}: ${next.title} (coming next)`
    : ''

  nav.innerHTML = `
    <a class="module-nav-prev" href="${prevHref ?? rootPrefix(opts)}">${prevLabel}</a>
    ${
      next
        ? nextHref
          ? `<a class="module-nav-next" href="${nextHref}">${nextLabel}</a>`
          : `<span class="module-nav-next is-stub">${nextLabel}</span>`
        : ''
    }
  `
  return nav
}

/**
 * Shared page bootstrap: injects header + prev/next nav and typesets any
 * TeX in the prose ($…$ inline, $$…$$ display) with KaTeX.
 */
export function initPage(opts: PageOptions = {}): void {
  // Inline SVG favicon — one place for every page, no asset to copy around.
  const icon = document.createElement('link')
  icon.rel = 'icon'
  icon.href =
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="%231b1f27"/><path d="M6 24 L16 6 L26 24" stroke="%2361afef" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="6" r="3" fill="%23e5c07b"/></svg>`.replaceAll('%23', '#'),
    )
  document.head.append(icon)

  document.body.prepend(buildHeader(opts))
  const footerNav = buildFooterNav(opts)
  if (footerNav) document.body.append(footerNav)

  // Before KaTeX, so section titles are read as authored.
  if (opts.module) buildSectionNav(opts.module)

  // The Lezer parser is only loaded on pages that actually contain a code block.
  if (document.querySelector('.prose pre > code')) {
    void import('./highlight').then(({ highlightCodeBlocks }) => highlightCodeBlocks())
  }

  // KaTeX is only loaded on pages that actually contain TeX.
  if (document.body.textContent?.includes('$')) {
    void Promise.all([
      import('katex/contrib/auto-render'),
      import('katex/dist/katex.min.css'),
    ]).then(([{ default: renderMathInElement }]) => {
      renderMathInElement(document.body, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
        ],
        // Never typeset inside code or the editor.
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
        ignoredClasses: ['cm-editor', 'exercise'],
        throwOnError: false,
      })
    })
  }
}
