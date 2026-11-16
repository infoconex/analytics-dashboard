import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        app: resolve(import.meta.dirname, 'index.html'),
        embedded: resolve(import.meta.dirname, 'embed.html'),
        sampleHost: resolve(import.meta.dirname, 'sample-host.html'),
      },
    },
  },
  server: {
    port: 5173,
    // This Vite sample is frameable only by a page on its own origin.
    // Production deployments must enforce their own audited response policy.
    headers: { 'Content-Security-Policy': "frame-ancestors 'self'", 'X-Frame-Options': 'SAMEORIGIN' },
    proxy: {
      '/api': 'http://localhost:5055',
    },
  },
  preview: { headers: { 'Content-Security-Policy': "frame-ancestors 'self'", 'X-Frame-Options': 'SAMEORIGIN' } },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
