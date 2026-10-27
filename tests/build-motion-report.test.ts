import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConnections,
  combatReportMenu,
  measuredBuildHighlights,
  BUILD_ACTIVATION_UNITS,
} from '../src/combat-report-menu.ts';
import { BUILD_ACTIVATION_IDS, type CombatResults } from '../src/combat-report.ts';
import { MODS } from '../src/rules.ts';
import { withParents } from '../src/branch-builds.ts';
const results = (activations: CombatResults['activations'] = {}): CombatResults => ({
  version: 1,
  fromStage: 0,
  heatTransfers: 0,
  bankCharges: 0,
  armorBlocks: 0,
  bloodworkHealing: 0,
  activations,
  activationFromStage: 0,
});
const run = (mods: string[] = [], combatResults?: CombatResults) => ({
  mods,
  seed: 'RF-C108-motion-report',
  startingGun: 'pistol' as const,
  elapsed: 120,
  kills: 5,
  combatResults,
});
test('authored units cover every measured mechanic and all names are real catalog fittings', () => {
  assert.deepEqual(Object.keys(BUILD_ACTIVATION_UNITS).sort(), [...BUILD_ACTIVATION_IDS].sort());
  for (const id of BUILD_ACTIVATION_IDS) assert(MODS.some((m) => m.id === id));
});
test('new morphs and fusions take visible explanation slots in their actual combined gun', () => {
  for (const id of [
    'piston-lance',
    'cable-saw',
    'seeker-rack',
    'foamcaster',
    'catch-chamber',
    'gate-snare',
    'hot-wire',
    'ghost-shift',
    'windmill',
    'scrap-comet',
  ]) {
    const mods = withParents([], [id])!;
    assert(mods);
    const connections = buildConnections(run(mods));
    assert(
      connections.some((c) => c.title.includes(MODS.find((m) => m.id === id)!.name)),
      id,
    );
    assert(connections.length <= 3);
  }
  assert(!combatReportMenu(run()).includes('Catch Chamber'));
});
test('highlights show at most three measured actions without fabricated damage or duplicate mechanisms', () => {
  const r = results({
    'piston-lance': 8,
    'offset-nozzle': 2,
    'momentum-battery': 1,
    'catch-chamber': 3,
  });
  r.bankCharges = 2;
  const highlights = measuredBuildHighlights(run([], r));
  assert.equal(highlights.length, 3);
  assert.equal(new Set(highlights.map((h) => h.id)).size, 3);
  assert(highlights.some((h) => h.id === 'catch-chamber' && h.value === 3));
  assert(highlights.some((h) => h.id === 'offset-nozzle' && h.value === 2));
  assert(highlights.some((h) => h.id === 'momentum-battery' && h.value === 1));
  const html = combatReportMenu(run(['piston-lance', 'offset-nozzle', 'momentum-battery'], r));
  assert.match(html, /Measured build highlights/);
  assert.match(html, /remote volleys fired/);
  assert(!/DPS|damage contributed|best upgrade/i.test(html));
});
test('unavailable historical counters and genuine measured zero stay distinct', () => {
  const r = results();
  delete r.activations;
  delete r.activationFromStage;
  const old = combatReportMenu(run(['piston-lance'], r));
  assert.match(old, /activations weren’t recorded/);
  assert(!old.includes('0 piston discharges'));
  const fresh = combatReportMenu(run(['piston-lance'], results()));
  assert.match(fresh, /0 piston discharges/);
  assert(!fresh.includes('Measured build highlights'));
  const partial = combatReportMenu(
    run(['piston-lance'], {
      ...results({ 'piston-lance': 2 }),
      activationPartial: true,
      activationFromStage: 6,
    }),
  );
  assert.match(partial, /recorded from room 7/);
  assert.match(partial, /Earlier activity is unavailable/);
});
