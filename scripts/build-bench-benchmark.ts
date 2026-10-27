import { writeFileSync } from 'node:fs';
import { completeBuild } from '../src/branch-builds.ts';
import { benchRows } from '../src/build-bench-model.ts';
import { MODS } from '../src/rules.ts';

// Model computation only, measured on the current host. No universal UI timing
// claim and no wall-clock CI threshold: native equivalence is tested separately.
const known = MODS.map((mod) => mod.id);
const draft = completeBuild([], 'RF-C108-BENCH-SPEED')!;
const samples = Array.from({ length: 8 }, (_, n) => {
  const start = performance.now();
  const rows = benchRows(known, draft, 'pistol', {
    query: n % 2 ? 'recoil' : '',
    facet: n % 2 ? 'compatible' : 'all',
  });
  return { milliseconds: performance.now() - start, matches: rows.length };
});
const report = {
  note: 'Native model computation, excluding DOM layout and rendering; measured on this host, not a universal responsiveness guarantee.',
  runtime: process.version,
  platform: process.platform,
  collection: known.length,
  fitted: draft.length,
  samples,
  meanMs: samples.reduce((sum, row) => sum + row.milliseconds, 0) / samples.length,
  maxMs: Math.max(...samples.map((row) => row.milliseconds)),
};
const output = process.argv.find((arg) => arg.endsWith('.json'));
if (output) writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
