import { spawnSync } from 'node:child_process';
import { constants } from 'node:os';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const startedAt = performance.now();
const root = fileURLToPath(new URL('../', import.meta.url));
const label = process.env.npm_lifecycle_event || 'build';
const steps = [
  ['scripts/default-library-assets.mjs', 'prepare'],
  ['scripts/prepare-examples-config.mjs'],
  ['scripts/prepare-demo-assets.mjs'],
  ['scripts/user-guide-assets.mjs', 'prepare'],
  ['node_modules/vite/bin/vite.js', 'build', ...process.argv.slice(2)],
  ['scripts/default-library-assets.mjs', 'verify'],
  ['scripts/user-guide-assets.mjs', 'verify'],
];

try {
  for (const args of steps) {
    const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
    if (result.error) console.error(result.error.message);
    const code = result.status ?? (result.signal ? 128 + (constants.signals[result.signal] || 1) : 1);
    if (code !== 0) {
      process.exitCode = code;
      break;
    }
  }
} finally {
  console.log(`Время сборки [${label}]: ${((performance.now() - startedAt) / 60000).toFixed(2)} мин.`);
}
