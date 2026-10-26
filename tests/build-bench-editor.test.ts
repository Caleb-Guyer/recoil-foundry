import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { MODS, getGun } from '../src/rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import { benchEdit, benchInspect, benchRows } from '../src/build-bench-model.ts';
import {
  benchListMarkup,
  benchLinksMarkup,
  benchRemovalMarkup,
} from '../src/build-bench-markup.ts';
import { inspectBuildChange } from '../src/upgrade-inspection.ts';
import { createUpgradeDemo, destroyUpgradeDemo, upgradeDemoInput } from '../src/upgrade-demo.ts';
const all = MODS.map((mod) => mod.id);
const name = (id: string) => MODS.find((mod) => mod.id === id)!.name;

test('unavailable collected fittings remain inspectable while undiscovered requirements remain unnamed', () => {
  const known = ['rail-spike'];
  const row = benchInspect('rail-spike', known, [])!;
  assert(row && !row.canAdd);
  const html = benchListMarkup([row], null);
  assert(html.includes('data-workshop-mod="rail-spike"'));
  assert(!html.includes(' disabled'), 'Inspecting a conflict is not disabled');
  assert(html.includes('aria-controls="bench-inspector"'));
  const links = benchLinksMarkup(row.requirements, known, [], true);
  assert(links.includes('uncollected requirement'));
  for (const id of row.requirements) {
    assert(!links.includes(name(id)));
    assert(!links.includes('data-bench-link="' + id + '"'));
  }
  assert.equal(benchInspect('cutting-torch', known, []), null);
});

test('known prerequisite and fusion paths are navigable and warn about complete removals before edits', () => {
  const build = ['deadeye', 'execute', 'rivet', 'fracture', 'capacitor', 'rail-spike', 'light'];
  const row = benchInspect('rail-spike', all, build)!;
  const links = benchLinksMarkup(row.requirements, all, build, true);
  for (const id of row.requirements) assert(links.includes('data-bench-link="' + id + '"'));
  const before = [...build];
  const edit = benchEdit(build, 'deadeye', all);
  const warning = benchRemovalMarkup(edit.removed);
  assert(edit.removed.length > 1);
  for (const id of edit.removed) assert(warning.includes(name(id)));
  assert(warning.includes('only when you confirm'));
  assert.deepEqual(build, before, 'Rendering the reviewed removal does not apply it');
  assert.deepEqual(edit.after, ['capacitor', 'light']);
});

test('fitted cards identify inspection state separately from a toggle or blocked fit action', () => {
  const rows = benchRows(all, ['scatter'], 'pistol', { facet: 'selected' });
  const html = benchListMarkup(rows, 'scatter');
  assert(html.includes('aria-expanded="true"'));
  assert(html.includes('data-fitted="true"'));
  assert(!html.includes('aria-pressed'), 'An inspect control must not promise a fitting toggle');
});

for (const gun of STARTING_GUN_IDS)
  test(`reviewed ${gun} removal compares complete legal guns through the real native demos`, () => {
    const before = ['deadeye', 'execute', 'rivet', 'fracture', 'capacitor', 'rail-spike', 'light'];
    const proposal = benchEdit(before, 'deadeye', all);
    const inspection = inspectBuildChange(
      before,
      proposal.after,
      MODS.find((mod) => mod.id === 'deadeye')!,
      gun,
    );
    assert.deepEqual(inspection.beforeMods, before);
    assert.deepEqual(inspection.afterMods, ['capacitor', 'light']);
    assert(inspection.connections[0].includes(name('rail-spike')));
    assert(!/NaN|Infinity|undefined/.test(JSON.stringify(inspection)));
    for (const mods of [inspection.beforeMods, inspection.afterMods]) {
      const g = createUpgradeDemo(mods, gun),
        writes: unknown[] = [];
      g.onCheckpoint = (save) => writes.push(save);
      g.onBossDefeated = () => writes.push('victory');
      g.onCommendation = () => writes.push('unlock');
      assert.deepEqual(g.gun, getGun(mods, gun));
      for (let step = 0; step < 90; step++) g.tick(1 / 60, upgradeDemoInput(g, step));
      assert.deepEqual(g.mods, mods);
      assert.deepEqual(writes, []);
      destroyUpgradeDemo(g);
      assert.equal(Matter.Composite.allBodies(g.engine.world).length, 0);
    }
  });

test('a complete beam cascade removal keeps the exact remaining gun rather than re-adding the inspected parent', () => {
  const before = ['cutting-torch', 'charge-lens', 'scatter', 'rapid'];
  const proposal = benchEdit(before, 'cutting-torch', all);
  const inspection = inspectBuildChange(
    before,
    proposal.after,
    MODS.find((mod) => mod.id === 'cutting-torch')!,
    'shotgun',
  );
  assert.deepEqual(inspection.beforeMods, before);
  assert(!inspection.afterMods.includes('cutting-torch'));
  assert(!inspection.afterMods.includes('charge-lens'));
  assert(inspection.afterMods.includes('scatter'));
  assert(inspection.changes.some((change) => change.label === 'Fire' && change.after === 'Rounds'));
});

for (const id of ['piston-lance', 'cable-saw'])
  for (const beam of [false, true])
    test(`${id} ${beam ? 'beam' : 'native'} removal and clear-all compare actual lost mechanics`, () => {
      const before = ['scatter', ...(beam ? ['cutting-torch'] : []), id];
      const mod = MODS.find((mod) => mod.id === id)!;
      const after = benchEdit(before, id, all).after;
      const removal = inspectBuildChange(before, after, mod, 'shotgun');
      assert(!removal.afterMods.includes(id));
      if (beam) {
        assert.deepEqual(
          removal.changes.find((change) => change.label === 'Beam energy'),
          {
            label: 'Beam energy',
            before: '+35% pulse energy / +1 penetration',
            after: 'Native pulse energy',
          },
        );
      } else if (id === 'cable-saw') {
        assert.deepEqual(
          removal.changes.find((change) => change.label === 'Return strike'),
          {
            label: 'Return strike',
            before: 'One 50% secondary pass',
            after: 'None',
          },
        );
      } else {
        assert(
          !removal.changes.some(
            (change) => change.label === 'Beam energy' || change.label === 'Return strike',
          ),
        );
      }
      const cleared = inspectBuildChange(before, [], mod, 'shotgun');
      assert.deepEqual(cleared.afterMods, []);
      assert(
        !cleared.changes.some(
          (change) => change.after.includes('+35%') || change.after.includes('50% secondary'),
        ),
      );
      if (beam)
        assert.equal(
          cleared.changes.find((change) => change.label === 'Beam energy')?.after,
          'No beam',
        );
    });

test('removing a Cable Saw retains an owned native Recall instead of reporting a lost return', () => {
  const before = ['recall', 'cable-saw'];
  const result = inspectBuildChange(
    before,
    ['recall'],
    MODS.find((mod) => mod.id === 'cable-saw')!,
    'pistol',
  );
  assert(!result.changes.some((change) => change.label === 'Return strike'));
});
