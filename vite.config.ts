/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Two build targets:
 * - default: regular build for GitHub Pages (base path from BASE_PATH, e.g. "/modeltool/").
 * - "singlefile" mode: everything inlined into one index.html that runs from file://.
 */
export default defineConfig(({ mode }) => {
  const singleFile = mode === 'singlefile';
  return {
    base: singleFile ? './' : (process.env.BASE_PATH ?? './'),
    plugins: [react(), ...(singleFile ? [viteSingleFile()] : [])],
    build: {
      outDir: singleFile ? 'dist-single' : 'dist',
      chunkSizeWarningLimit: 4000,
    },
    test: {
      include: ['src/**/*.test.ts'],
      environment: 'node',
    },
  };
});
