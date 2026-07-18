/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import { resolve } from 'node:path'
import { existsSync, readdirSync } from 'node:fs'

const root = import.meta.dirname

// Dev only: a bare `/playground` (no trailing slash) isn't matched to
// `/playground/index.html` by Vite's MPA server. Redirect such requests to the
// trailing-slash form so relative asset paths (base './') resolve correctly.
function trailingSlashRedirect(): Plugin {
  return {
    name: 'trailing-slash-redirect',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '/'
        const [path, query = ''] = url.split('?')
        // Skip if already ends in '/', has a file extension, or isn't a GET.
        if (
          req.method !== 'GET' ||
          path.endsWith('/') ||
          path.split('/').pop()?.includes('.')
        ) {
          return next()
        }
        if (existsSync(resolve(root, `.${path}`, 'index.html'))) {
          res.statusCode = 301
          res.setHeader('Location', `${path}/${query ? `?${query}` : ''}`)
          return res.end()
        }
        next()
      })
    },
  }
}

// Every modules/<name>/index.html becomes a build entry automatically.
const moduleEntries = Object.fromEntries(
  readdirSync(resolve(root, 'modules'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => [d.name, resolve(root, 'modules', d.name, 'index.html')]),
)

export default defineConfig({
  // Relative base so the static build works at any deploy subpath.
  base: './',
  appType: 'mpa',
  plugins: [trailingSlashRedirect()],
  resolve: {
    alias: { '@': resolve(root, 'src') },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        sandbox: resolve(root, 'sandbox/index.html'),
        playground: resolve(root, 'playground/index.html'),
        ...moduleEntries,
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
