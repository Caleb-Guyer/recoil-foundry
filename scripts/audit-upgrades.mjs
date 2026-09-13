// Run from the repository: node --experimental-strip-types scripts/audit-upgrades.mjs
// This inventories eligibility and base stats, not combat behavior or balance.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  MODS,
  MOD_PATHS,
  MOD_REQUIRES,
  FUSION_REQUIRES,
  compatibleMod,
  getGun,
  isFusion,
  validBuild,
} from '../src/rules.ts';

const packageInfo = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
const ids = new Set(MODS.map((mod) => mod.id));
assert.equal(ids.size, MODS.length, 'Duplicate upgrade ID');

function prerequisites(id) {
  return [...(MOD_REQUIRES[id] ? [MOD_REQUIRES[id]] : []), ...(FUSION_REQUIRES[id] ?? [])];
}

function expand(wanted) {
  const picked = new Set();
  const visiting = new Set();
  function visit(id) {
    assert(ids.has(id), `Unknown upgrade ${id}`);
    if (picked.has(id)) return;
    assert(!visiting.has(id), `Prerequisite cycle at ${id}`);
    visiting.add(id);
    prerequisites(id).forEach(visit);
    visiting.delete(id);
    picked.add(id);
  }
  wanted.forEach(visit);
  return [...picked];
}

function blockers(build) {
  const reasons = [];
  const paths = [...new Set(build.map((id) => MOD_PATHS[id]?.path).filter(Boolean))];
  if (paths.length > 1) reasons.push(`different paths: ${paths.sort().join(' + ')}`);
  if (build.filter(isFusion).length > 1) reasons.push('one fusion per build');
  for (let i = 0; i < build.length; i++) {
    for (let j = i + 1; j < build.length; j++) {
      const a = build[i],
        b = build[j];
      assert.equal(compatibleMod([a], b), compatibleMod([b], a), `Asymmetric exclusion: ${a}/${b}`);
      if (!compatibleMod([a], b))
        reasons.push(`conversion exclusion: ${[a, b].sort().join(' + ')}`);
    }
  }
  return reasons;
}

function sameGun(a, b) {
  const left = getGun(a),
    right = getGun(b);
  for (const key of Object.keys(left)) {
    const x = left[key],
      y = right[key];
    if (typeof x === 'number') {
      assert(Number.isFinite(x) && Number.isFinite(y), `Nonfinite stat: ${key}`);
      assert(
        Math.abs(x - y) <= 1e-10 * Math.max(1, Math.abs(x), Math.abs(y)),
        `Order-dependent ${key}: ${a}/${b}`,
      );
    } else assert.equal(x, y, `Order-dependent ${key}: ${a}/${b}`);
  }
}

for (const mod of MODS)
  assert(validBuild(expand([mod.id])), `Unreachable prerequisite chain: ${mod.id}`);
const rows = [];
let allowed = 0;
for (let i = 0; i < MODS.length; i++) {
  for (let j = i + 1; j < MODS.length; j++) {
    const a = MODS[i],
      b = MODS[j];
    const forward = expand([a.id, b.id]),
      reverse = expand([b.id, a.id]);
    const legal = validBuild(forward),
      reasons = blockers(forward);
    assert.equal(legal, validBuild(reverse), `Order-dependent eligibility: ${a.id}/${b.id}`);
    assert.equal(legal, reasons.length === 0, `Unexplained gate: ${a.id}/${b.id}`);
    if (legal) {
      allowed++;
      sameGun(forward, reverse);
    }
    rows.push([
      packageInfo.version,
      a.id,
      a.name,
      b.id,
      b.name,
      legal ? 'allowed with prerequisites' : 'blocked',
      reasons.join('; '),
      forward.join(' > '),
      reverse.join(' > '),
      legal ? 'equal within numerical tolerance' : 'not applicable',
      'eligibility and base stats only; combat interactions require separate checks',
    ]);
  }
}
const csvCell = (value) => `"${String(value).replaceAll('"', '""')}"`;
const header = [
  'game_version',
  'upgrade_a',
  'name_a',
  'upgrade_b',
  'name_b',
  'eligibility',
  'blockers_including_prerequisites',
  'a_first_dependency_order',
  'b_first_dependency_order',
  'base_stats_in_both_orders',
  'scope',
];
const output = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
await mkdir(new URL('../docs/', import.meta.url), { recursive: true });
await writeFile(new URL('../docs/upgrade-compatibility.csv', import.meta.url), output);
console.log(
  JSON.stringify(
    {
      version: packageInfo.version,
      upgrades: MODS.length,
      pairs: rows.length,
      allowed,
      blocked: rows.length - allowed,
      scope:
        'Dependency-closed pairs, both acquisition orders, base gun stats. Not a combat certification.',
    },
    null,
    2,
  ),
);
