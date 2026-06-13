# Deploying 3d-101 to Netlify

3d-101 is a **static, multi-page site** built by Vite. The whole course
(home page + each module page + the CodeMirror editor, Web Worker, math
library, and KaTeX assets) compiles to plain files under `dist/`. There is
no server, no database, and no runtime backend — Netlify just serves the
folder. That makes deployment about as simple as it gets.

The repo ships a [`netlify.toml`](./netlify.toml) that already encodes the
build command, publish directory, Node version, and caching/CSP decisions,
so most of this is automatic.

---

## TL;DR

```bash
# one-time
npm install -g netlify-cli
netlify login

# from the project root
npm run build          # produces ./dist
netlify deploy --prod  # uploads ./dist to your site
```

Or connect the Git repo in the Netlify UI and every push to your main
branch deploys itself. Details below.

---

## What gets deployed

`npm run build` runs `tsc --noEmit && vite build` and writes a fully static
tree to `dist/`:

```
dist/
├── index.html                       # course home / TOC
├── modules/
│   ├── 01-vectors/index.html
│   ├── 02-dot-cross-planes/index.html
│   └── 03-matrices/index.html
└── assets/                          # hashed JS/CSS/fonts, the worker chunk,
                                     # the lazy-loaded CodeMirror + KaTeX bundles
```

Netlify serves `dist/modules/01-vectors/index.html` at the clean URL
`/modules/01-vectors/` automatically — no redirect rules required.

---

## Prerequisites

- A free [Netlify account](https://app.netlify.com).
- Node 22 locally if you want to build before deploying (the CI build on
  Netlify pins Node 22 via `netlify.toml`).
- The project building cleanly: `npm install && npm run build` should exit 0
  and leave a populated `dist/`.

---

## Option A — Continuous deploy from Git (recommended)

Best for ongoing work: every push builds and publishes automatically, with
deploy previews for pull requests.

1. Push this repo to GitHub / GitLab / Bitbucket. (The project isn't
   committed yet — `git init`, commit, and push first.)
2. In Netlify: **Add new site → Import an existing project**, pick the repo.
3. Netlify reads `netlify.toml` and pre-fills the settings. Confirm:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Node version:** 22 (from `NODE_VERSION` in `netlify.toml`)
4. Click **Deploy**. Netlify installs deps, runs the build, and publishes
   `dist/`. Future pushes to the production branch redeploy; PRs get their
   own preview URLs.

You don't need to set anything in the UI that `netlify.toml` already
specifies — the file wins.

---

## Option B — Manual deploy with the Netlify CLI

Best for a quick one-off deploy without wiring up Git.

```bash
npm install -g netlify-cli
netlify login                     # opens a browser to authorize

# First time: create/link a site (follow the prompts).
netlify init                      # or: netlify link  (to attach an existing site)

# Build locally, then ship the result:
npm run build
netlify deploy --prod --dir=dist
```

- Drop `--prod` to publish to a temporary **draft URL** first — useful to
  eyeball a change before promoting it. Re-run with `--prod` to go live.
- `--dir=dist` is redundant when `netlify.toml` is present, but explicit is
  fine.

---

## Option C — Drag-and-drop (zero tooling)

Quickest possible path for a one-off:

1. Run `npm run build` locally.
2. Go to <https://app.netlify.com/drop> and drag the **`dist/` folder** onto
   the page.

Netlify hosts it instantly. There's no Git link and no automatic rebuilds —
re-drag a fresh `dist/` to update.

---

## Why the config looks the way it does

Two settings in `netlify.toml` are load-bearing for this particular app;
don't "tidy them away":

- **No Content-Security-Policy header.** The interactive exercises compile
  the learner's code in the browser with `new Function`, run the tests in a
  module Web Worker, and drive live canvas visualizations. A strict CSP
  (`script-src` without `'unsafe-eval'`, or a `worker-src` that blocks
  same-origin/blob workers) would silently break "Run tests." Netlify adds
  no CSP by default, so the config just leaves it alone. If your org
  mandates a CSP, it must allow `'unsafe-eval'` and same-origin workers.

- **No SPA fallback redirect.** This is a multi-page app, not a single-page
  app. Each module is a real HTML file. The usual `/* → /index.html`
  Netlify redirect would shadow every module page with the home page, so
  it's deliberately absent.

- **Relative asset base.** `vite.config.ts` sets `base: './'`, so the build
  works whether it's served from a domain root or a subpath. No change
  needed for Netlify's root-domain hosting, but it keeps subpath/preview
  deploys safe.

- **Immutable caching for `/assets/*`.** Vite fingerprints those filenames,
  so they're cached for a year; HTML keeps Netlify's default short cache so
  new deploys appear immediately.

---

## Verifying a deploy

After it goes live, click through:

1. The **home page** lists 12 modules with the first three linked.
2. Each linked module page (`/modules/01-vectors/` etc.) loads, the
   canvases render, and the math (KaTeX) typesets.
3. Open an exercise, hit **Run tests** (or **Reveal solution**) — the tests
   should run and the visualization should pick up your code. If "Run
   tests" hangs or errors in the console about `eval`/workers, a CSP is
   being injected somewhere upstream (proxy, org policy) — see above.

For a scripted check you can point the existing smoke test at the live URL:

```bash
node scripts/smoke-all.mjs https://your-site.netlify.app
```

It walks every module page, reveals and runs all 22 exercises, drags the
canvases, and asserts the console stays clean.

---

## Custom domain (optional)

In **Site configuration → Domain management**, add your domain and follow
Netlify's DNS instructions (either point a CNAME at the Netlify subdomain or
delegate the domain to Netlify DNS). HTTPS is provisioned automatically via
Let's Encrypt.
