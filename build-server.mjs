/**
 * Build script for the production Express server.
 *
 * Bundles server.ts and all its npm dependencies into a single CommonJS file
 * (dist-server/server.js) for use inside the packaged Electron app.
 *
 * KEY DETAIL — NODE_ENV is defined as "production" at bundle time so that
 * esbuild can statically evaluate:
 *
 *   if (process.env.NODE_ENV !== "production") { ... vite ... }
 *
 * and dead-strip the entire Vite dev-server branch (and its heavy imports).
 */

import { build } from 'esbuild';
import { mkdirSync } from 'fs';

mkdirSync('dist-server', { recursive: true });

await build({
  entryPoints: ['server.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'dist-server/server.js',
  // Hard-code NODE_ENV so the dead-code eliminator removes the Vite branch
  define: { 'process.env.NODE_ENV': '"production"' },
  // vite is only used in the dev branch; mark it external as a safety net
  external: ['vite', '@vitejs/plugin-react', '@tailwindcss/vite'],
  // esbuild CJS output already provides __dirname pointing to the output file's
  // directory, which is what we need for path.resolve(__dirname, '..', 'dist')
  sourcemap: true,
  logLevel: 'info',
});

console.log('Server build complete → dist-server/server.js');
