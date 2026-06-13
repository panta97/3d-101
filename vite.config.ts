/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { readdirSync } from 'node:fs'

const root = import.meta.dirname

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
  resolve: {
    alias: { '@': resolve(root, 'src') },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        ...moduleEntries,
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
