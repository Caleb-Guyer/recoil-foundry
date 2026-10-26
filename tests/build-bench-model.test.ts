import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BENCH_CATEGORIES,
  benchModTags,
  benchRows,
  benchInspect,
  benchEdit,
} from '../src/build-bench-model.ts';
import { MODS, availableMods, getGun, validBuild } from '../src/rules.ts';
import { withParents } from '../src/branch-builds.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';

const all = MODS.map((mod) => mod.id);

test('all 161 fittings have explicit mechanic membership or an authored inherited family', () => {
  const valid = BENCH_CATEGORIES.map((category) => category.id).filter((id) => id !== 'all');
  assert.equal(MODS.length, 161);
  for (const mod of MODS) {
    const tags = benchModTags(mod.id);
    assert(tags.length > 0, mod.id);
    assert.deepEqual(tags, [...new Set(tags)]);
    assert(
      tags.every((tag) => valid.includes(tag)),
      mod.id,
    );
  }
  assert(benchModTags('heat-exchanger').includes('heat'));
  assert(benchModTags('spring-step').includes('movement'));
  assert(benchModTags('reinforced-plate').includes('defense'));
  assert(benchModTags('resonator').includes('precision'));
  assert(benchModTags('gate-snare').includes('control'));
  assert(benchModTags('kinetic-liner').includes('banking'));
  assert.deepEqual(benchModTags('not-a-real-fitting'), []);
});

test('search reads real descriptions and complete contextual copy with literal multi-term matching', () => {
  assert(benchRows(all, [], 'pistol', { query: '75% slower' }).some((r) => r.mod.id === 'magnum'));
  assert(benchRows(all, [], 'pistol', { query: 'burning' }).some((r) => r.mod.id === 'flashpoint'));
  assert(
    benchRows(all, [], 'pistol', { query: '  THERMAL    beam  ' }).some(
      (r) => r.mod.id === 'thermal-runaway',
    ),
  );
  assert(
    benchRows(all, [], 'pistol', { query: 'banks' }).some((r) => r.mod.id === 'kinetic-liner'),
  );
  assert.deepEqual(benchRows(all, [], 'pistol', { query: '[not a regex]' }), []);
  const heat = benchRows(all, [], 'pistol', { category: 'heat' });
  assert(heat.some((r) => r.mod.id === 'thermal-budget'));
  assert(!heat.some((r) => r.mod.id === 'double-jump'));
  const movements = benchRows(all, [], 'pistol', { category: 'movement', query: 'launch' });
  assert(movements.some((r) => r.mod.id === 'spring-rivets'));
  assert(movements.every((r) => r.tags.includes('movement')));
});

test('discovery gating hides fittings and never names an undiscovered prerequisite in copy', () => {
  const known = ['thermal-runaway', 'light'];
  assert.equal(benchRows(known, [], 'pistol').length, 2);
  assert.equal(benchInspect('cutting-torch', known, []), null);
  const row = benchInspect('thermal-runaway', known, [])!;
  assert.deepEqual(row.missing, ['cutting-torch']);
  assert(row.reason.includes('1 uncollected requirement'));
  assert(!row.reason.includes('Cutting Torch'));
  assert.equal(row.canAdd, false);
  assert.deepEqual(row.followups, []);
  const proposal = benchEdit([], 'thermal-runaway', known);
  assert.equal(proposal.canApply, false);
  assert.deepEqual(proposal.after, []);
  assert.deepEqual(proposal.added, []);
  assert.equal(benchEdit([], 'cutting-torch', known).canApply, false);
  assert.equal(benchEdit([], 'not-a-fitting', known).canApply, false);
});

test('available followups and compatible facets use native paths, actual parents, and the picker limit', () => {
  const build = ['crossfire', 'afterimage', 'light'];
  assert.deepEqual(
    benchRows(all, build, 'pistol', { facet: 'selected' }).map((r) => r.mod.id),
    ['light', 'crossfire', 'afterimage'],
  );
  const compatible = benchRows(all, build, 'pistol', { facet: 'compatible' });
  assert(compatible.every((r) => r.compatible));
  assert(!compatible.some((r) => r.mod.id === 'deadeye'));
  const followups = benchRows(all, build, 'pistol', { facet: 'followups' });
  assert(followups.some((r) => r.mod.id === 'bloom'));
  assert(followups.some((r) => r.mod.id === 'parallax'));
  assert(!followups.some((r) => r.mod.id === 'deadeye'));
  assert(!followups.some((r) => r.selected));
  assert.deepEqual(
    benchRows(all, build, 'pistol', { facet: 'followups', limit: build.length }),
    [],
  );
  const full = benchInspect('rapid', all, build, 'pistol', 3)!;
  assert(full.compatible && !full.canAdd);
  assert.match(full.reason, /Build full/);
  assert.equal(benchEdit(build, 'rapid', all, 3).canApply, false);
  assert.equal(
    benchEdit(build, 'afterimage', all, 1).canApply,
    true,
    'Oversized limited builds can still be reduced',
  );
});

test('conflict explanations identify real transformations, branches, paths, morphs and the one-fusion rule', () => {
  assert.match(benchInspect('cutting-torch', all, ['mass-driver'])!.reason, /Mass Driver/);
  assert.match(
    benchInspect('charge-lens', all, ['cutting-torch', 'prism-array'])!.reason,
    /Prism Array/,
  );
  assert.match(benchInspect('deadeye', all, ['shellshock'])!.reason, /Demolition.*Precision/);
  assert.match(benchInspect('seeker-rack', all, ['piston-lance'])!.reason, /Piston Lance/);
  const fusion = withParents([], ['orbit'])!;
  assert.match(benchInspect('catch-chamber', all, fusion)!.reason, /One fusion per build.*Orbit/);
  const requirements = benchInspect('pulse-chamber', all, [])!;
  assert.deepEqual(requirements.requirements, ['cutting-torch', 'burst']);
  assert.match(requirements.reason, /Cutting Torch.*Burst fire/);
  assert(!requirements.canAdd);
  assert.deepEqual(
    benchEdit([], 'pulse-chamber', all).after,
    [],
    'No automatic prerequisite fitting',
  );
});

test('dependency navigation exposes collected direct children and every fusion parent exactly once', () => {
  const row = benchInspect('cutting-torch', all, ['cutting-torch'])!;
  assert(row.followups.includes('thermal-runaway'));
  assert(row.followups.includes('pulse-chamber'));
  assert(
    !row.followups.includes('heat-exchanger'),
    'Navigation is direct; later descendants follow their own parents',
  );
  assert.deepEqual(
    benchInspect('cutting-torch', ['cutting-torch', 'pulse-chamber'], [])!.followups,
    ['pulse-chamber'],
  );
  const fusion = benchInspect('resonator', all, [])!;
  assert.deepEqual(fusion.requirements, ['pulse-chamber', 'relay-gate']);
  assert.deepEqual(fusion.missing, fusion.requirements);
  const prepared = withParents([], ['pulse-chamber', 'relay-gate'])!;
  assert(benchInspect('resonator', all, prepared)!.canAdd);
});

test('removal proposals show the complete cascade before changing a build, retaining unrelated fittings', () => {
  const build = Object.freeze(['crossfire', 'afterimage', 'parallax', 'rapid', 'light']);
  const row = benchInspect('crossfire', all, build)!;
  assert.deepEqual(row.removal, ['crossfire', 'afterimage', 'parallax']);
  const proposed = benchEdit(build, 'crossfire', all);
  assert.deepEqual(proposed.removed, row.removal);
  assert.deepEqual(proposed.after, ['rapid', 'light']);
  assert(proposed.canApply);
  assert.deepEqual(build, ['crossfire', 'afterimage', 'parallax', 'rapid', 'light']);
  const fusion = withParents([], ['resonator', 'light'])!;
  const remove = benchEdit(fusion, 'fold', all);
  assert(remove.removed.includes('relay-gate'));
  assert(remove.removed.includes('resonator'));
  assert(
    remove.after.includes('cutting-torch') &&
      remove.after.includes('pulse-chamber') &&
      remove.after.includes('light'),
  );
  assert(validBuild(remove.after));
});

test('every collected fitting can be legally previewed, fitted and removed for all six native guns', () => {
  for (const mod of MODS) {
    const build = withParents([], [mod.id]);
    assert(build, mod.id);
    const parents = build.filter((id) => id !== mod.id);
    for (const gun of STARTING_GUN_IDS) {
      const known = Object.freeze([...all]);
      const frozen = Object.freeze([...parents]);
      const row = benchInspect(mod.id, known, frozen, gun)!;
      assert(row.canAdd && row.compatible, mod.id + '/' + gun);
      assert(row.description && row.reason);
      const edit = benchEdit(frozen, mod.id, known);
      assert(edit.canApply && validBuild(edit.after));
      assert.deepEqual(edit.added, [mod.id]);
      assert.deepEqual(edit.removed, []);
      assert.deepEqual(frozen, parents);
      const output = getGun(edit.after, gun);
      assert(
        Object.values(output).every((value) => typeof value !== 'number' || Number.isFinite(value)),
        mod.id + '/' + gun,
      );
      const remove = benchEdit(edit.after, mod.id, known);
      assert(remove.canApply && validBuild(remove.after));
      assert.deepEqual(remove.after, parents);
      assert.deepEqual(remove.removed, [mod.id]);
      assert(!availableMods(edit.after, true).some((m) => m.id === mod.id));
    }
  }
});

test('authored weapon morph classification is searchable without revealing uncollected morphs', () => {
  const morphs = ['piston-lance', 'cable-saw', 'seeker-rack', 'foamcaster'];
  const rows = benchRows(all, [], 'pistol', { query: 'morph' });
  assert.deepEqual(
    rows.map((row) => row.mod.id),
    morphs,
  );
  assert(rows.every((row) => row.path === 'Weapon morph'));
  assert.deepEqual(
    benchRows(['light', 'piston-lance'], [], 'pistol', { query: 'weapon morph' }).map(
      (row) => row.mod.id,
    ),
    ['piston-lance'],
  );
  assert.deepEqual(benchRows(['light'], [], 'pistol', { query: 'morph' }), []);
});
