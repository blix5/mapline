// Precomputes the GeoJSON simplification that used to run synchronously on the client
// at module-evaluation time, before React mounted. The inputs are static, so the result
// is identical on every load — there is no reason to pay for it in the browser.
//
// Tolerances match the original calls in libs/map/LambertConformalConicMap.js.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const simplify = require('simplify-geojson');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Sources live outside public/ so they are never served to the browser.
const sourceDir = join(root, 'geodata', 'source');
const outDir = join(root, 'public', 'map', 'geojson', 'simplified');

const JOBS = [
  { from: 'land_low.geojson', to: 'land_low.json', tolerance: 0.04 },
  { from: 'lakes_low.geojson', to: 'lakes_low.json', tolerance: 0.04 },
  { from: 'rivers_low.geojson', to: 'rivers_low.json', tolerance: 0.04 },
  { from: 'land_medium.geojson', to: 'land_medium.json', tolerance: 0.02 },
  { from: 'lakes_medium.geojson', to: 'lakes_medium.json', tolerance: 0.02 },
  { from: 'rivers_medium.geojson', to: 'rivers_medium.json', tolerance: 0.02 },
];

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

await mkdir(outDir, { recursive: true });

for (const job of JOBS) {
  const source = join(sourceDir, job.from);
  const target = join(outDir, job.to);
  const raw = await readFile(source, 'utf8');
  const simplified = simplify(JSON.parse(raw), job.tolerance);
  const output = JSON.stringify(simplified);
  await writeFile(target, output);
  const before = (await stat(source)).size;
  console.log(`${job.from.padEnd(32)} ${kb(before).padStart(10)} -> ${kb(output.length).padStart(10)}  (tolerance ${job.tolerance})`);
}

console.log(`\nWrote ${JOBS.length} files to public/map/geojson/simplified/`);
