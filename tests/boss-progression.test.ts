import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { reclaimerFinale, finalArsenalSeed } from '../src/boss-progression.ts';
import { getLevel } from '../src/levels.ts';
import { newCampaignSeed } from '../src/run-seed.ts';
import { getOvertimeLevel, overtimeSeed } from '../src/overtime.ts';
import {
  loadEncounters,
  practiceCheckpoint,
  practiceStage,
  testCheckpoint,
  testEncounterFromUrl,
  overtimeRooftopsTestFromUrl,
} from '../src/practice.ts';
import { UPRISING_FINALES } from '../src/uprising-model.ts';
import { uprisingTestFromUrl } from '../src/uprising-test.ts';
import { loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import { bossRemixFor } from '../src/boss-remix-rules.ts';
import { playRoom } from './room-pilot.ts';
import { snapshotPracticeWin, recordPracticeWin } from '../src/practice-records.ts';

const base = 'https://test.invalid/';
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1400, y: 300 },
};
function saveOf(g: Game) {
  let save: Checkpoint | null = null;
  g.onCheckpoint = (value) => (save = value);
  g.save();
  assert(save);
  const valid = loadCheckpoint(save);
  assert(valid);
  return valid;
}

test('revision 94 retains its briefly published boss order for Continue and replays', () => {
  assert(finalArsenalSeed(newCampaignSeed(undefined, () => 123)));
  const seen = new Set<string>();
  for (let i = 0; i < 80; i++) {
    const seed = 'RF-C94-ORDER-' + i;
    const bosses = [3, 7, 11, 15, 19].map((stage) => getLevel(seed, stage));
    assert.equal(bosses[4].spawns[0].kind, 'boss');
    assert.equal(bosses[4].area, 'rooftops');
    assert(['sorter', 'interceptor'].includes(bosses[3].spawns[0].kind));
    assert.equal(bosses[3].area, 'reclamation');
    assert(bosses.filter((l) => l.spawns[0].kind === 'interceptor').length <= 1);
    assert.equal(bosses.filter((l) => l.spawns[0].kind === 'boss').length, 1);
    seen.add(bosses[3].spawns[0].kind + ':' + bosses[3].mirrored);
    seen.add('final:' + bosses[4].mirrored);
    assert.deepEqual(getLevel(seed, 19), bosses[4]);
  }
  assert.equal(seen.size, 6, 'Both Reclamation choices and both mirrors remain available');
});

test('earlier Campaigns, Daily and legacy boss Practice retain their existing order', () => {
  for (const seed of ['RF-C93-OLD', 'RF-C91-OLD', 'legacy', 'RF-D90-2026-10-23']) {
    assert(!reclaimerFinale(seed));
    assert.equal(getLevel(seed, 19).spawns[0].kind, 'interceptor');
    assert.equal(practiceStage({ kind: 'interceptor', seed }), 19);
    assert.equal(practiceStage({ kind: 'boss', seed }), 15);
    const g = new Game();
    g.start(seed, testCheckpoint(seed, 19));
    assert.equal(g.enemies[0].kind, 'interceptor');
    assert.deepEqual(getOvertimeLevel(seed, 19, 5).spawns[0].kind, 'interceptor');
  }
});

for (const finale of UPRISING_FINALES)
  for (const remix of [undefined, 'boss-skybridge', 'boss-crossfire'] as const)
    test(`${finale}, ${remix ?? 'base'}: jobs keep the Reclaimer through Continue`, () => {
      const preset = uprisingTestFromUrl(new URL('?test=uprising&route=' + finale + '&v=2', base))!;
      assert(loadCheckpoint(preset));
      if (remix) {
        preset.seed = Array.from({ length: 80 }, (_, i) => 'RF-C94-JOBS-' + i).find(
          (s) => bossRemixFor(s, 'boss') === remix,
        )!;
        preset.encounters = 1;
        preset.bossRemixes = 1;
      }
      const g = new Game();
      g.start(preset.seed, preset);
      assert.equal(g.uprising.finale, finale);
      assert.equal(g.enemies[0].kind, 'boss');
      assert.equal(g.level.bossRemix, remix);
      const saved = saveOf(g),
        continued = new Game();
      continued.start(saved.seed, saved);
      assert.deepEqual(continued.level, g.level);
      assert.equal(continued.enemies[0].kind, 'boss');
      assert.equal(continued.hp, g.hp);
      assert.deepEqual(continued.mods, g.mods);
      if (finale === 'hunted') {
        assert(g.uprising.status.includes('Interceptor pursuit volleys'));
        const e = g.enemies[0];
        Matter.Body.setPosition(e.body, { x: 1400, y: 200 });
        Matter.Body.setPosition(g.player, { x: 1000, y: 200 });
        for (const count of [0, 1, 2, 3]) {
          e.state = 'idle';
          e.timer = 0;
          e.phase = 0;
          e.attacks = count;
          g.updateBoss(e);
          assert.equal(e.state, 'windup');
          assert.equal(e.attack, count % 2 ? 'fan' : 'aimed');
          assert(e.timer >= 0.7, 'Pursuit retains full attack warnings');
        }
      }
      const result = playRoom(continued, 180);
      assert(result.clear && result.hp > 0, JSON.stringify({ finale, remix, ...result }));
    });

test('current earned Practice uses fifteen fittings for the Interceptor and nineteen for the Reclaimer', () => {
  for (const [kind, stage] of [
    ['interceptor', 15],
    ['boss', 19],
  ] as const) {
    const encounter = { kind, seed: 'RF-C94-PRACTICE' };
    assert.equal(loadEncounters([encounter]).length, 1);
    assert.equal(practiceStage(encounter), stage);
    for (const build of [null, testCheckpoint('all', 19).mods]) {
      const cp = practiceCheckpoint(encounter, build, testCheckpoint('all', 19).mods)!;
      assert(loadCheckpoint(cp));
      assert.equal(cp.stage, stage);
      assert.equal(cp.mods.length, stage);
      const g = new Game();
      assert(g.startPractice(encounter, build, testCheckpoint('all', 19).mods));
      assert.equal(g.stage, stage);
      assert.equal(g.enemies[0].kind, kind);
      assert.equal(g.level.area, kind === 'boss' ? 'rooftops' : 'reclamation');
    }
  }
});

test('new Overtime ends with the Reclaimer and preserves boss order through saved reconstruction', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const seed = 'RF-C94-OVERTIME-' + i;
    assert(reclaimerFinale(overtimeSeed(seed)));
    const earlier = getOvertimeLevel(seed, 15, 5);
    assert(['interceptor', 'sorter'].includes(earlier.spawns[0].kind));
    seen.add(earlier.spawns[0].kind);
    const last = getOvertimeLevel(seed, 19, 5);
    assert.equal(last.spawns[0].kind, 'boss');
    assert.equal(last.id, 'reclaimer-storm-relay');
    assert(last.conductors?.length);
    assert.equal(last.spawns.length, 4, 'Overtime keeps its staged support roster');
  }
  assert.equal(seen.size, 2);
  for (const mirror of [0, 1]) {
    const preset = overtimeRooftopsTestFromUrl(
      new URL('?test=overtime-rooftops&room=reclaimer&v=2&mirror=' + mirror, base),
    )!;
    assert.equal(getOvertimeLevel(preset.seed, 19, 5).mirrored, !!mirror);
  }
  const cp = overtimeRooftopsTestFromUrl(
    new URL('?test=overtime-rooftops&room=reclaimer&v=2', base),
  )!;
  assert(loadCheckpoint(cp));
  const g = new Game();
  g.start(cp.seed, cp);
  const saved = saveOf(g),
    continued = new Game();
  continued.start(saved.seed, saved);
  assert.deepEqual(continued.level, g.level);
  assert.equal(continued.enemies[0].kind, 'boss');
  assert.deepEqual(continued.mods, g.mods);
  const result = playRoom(continued, 180);
  assert(result.clear && result.hp > 0, JSON.stringify(result));
});

test('new direct boss links are isolated, retain the right stage and grant no earned victory', () => {
  for (const [name, stage, kind] of [
    ['reclaimer', 19, 'boss'],
    ['interceptor', 15, 'interceptor'],
  ] as const) {
    const encounter = testEncounterFromUrl(new URL('?test=' + name + '&v=2', base))!;
    assert(encounter);
    const cp = practiceCheckpoint(encounter)!;
    assert(loadCheckpoint(cp));
    const g = new Game();
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.start(cp.seed, cp, encounter, cp);
    assert.equal(writes, 0);
    assert.equal(g.stage, stage);
    assert.equal(g.enemies[0].kind, kind);
    assert.equal(g.mods.length, stage);
    assert.equal(snapshotPracticeWin(g, true), null);
    g.save();
    assert.equal(writes, 0);
    for (let frame = 0; frame < 60; frame++) g.tick(1 / 60, idle);
    assert(Number.isFinite(g.player.position.x));
  }
});

for (const kind of ['boss', 'interceptor'] as const)
  test(`${kind}: current fight clears with ordinary inputs and its earned Practice score is valid`, () => {
    const g = new Game();
    assert(g.startPractice({ kind, seed: 'RF-C94-PRACTICE' }));
    const result = playRoom(g, 180);
    assert(result.clear && result.hp > 0, JSON.stringify({ kind, ...result }));
    for (let frame = 0; frame < 90 && g.mode !== 'won'; frame++) g.tick(1 / 60, idle);
    assert.equal(g.mode, 'won');
    const win = snapshotPracticeWin(g, true);
    assert(win);
    assert.equal(recordPracticeWin([], win).records.length, 1);
  });
