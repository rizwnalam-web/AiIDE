/**
 * Build script for the Electron main process and preload script.
 *
 * Outputs CommonJS bundles to dist-electron/.
 * A dist-electron/package.json is written with "type":"commonjs" so that
 * Node.js correctly treats the output as CJS despite the root package.json
 * declaring "type":"module".
 */

import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'fs';

const OUT_DIR = 'dist-electron';

// Ensure the output directory exists and override the module type
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  `${OUT_DIR}/package.json`,
  JSON.stringify({ type: 'commonjs' }, null, 2)
);

const shared = {
  bundle: true,
  platform: /** @type {'node'} */ ('node'),
  format: /** @type {'cjs'} */ ('cjs'),
  // electron is a runtime peer — never bundle it
  external: ['electron'],
  sourcemap: true,
  logLevel: /** @type {'info'} */ ('info'),
};

await Promise.all([
  build({
    ...shared,
    entryPoints: ['electron/main.ts'],
    outfile: `${OUT_DIR}/main.js`,
  }),
  build({
    ...shared,
    entryPoints: ['electron/preload.ts'],
    outfile: `${OUT_DIR}/preload.js`,
  }),
]);

console.log('Electron build complete →', OUT_DIR);
