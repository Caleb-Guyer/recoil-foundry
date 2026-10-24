import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { ENEMY_NAMES } from '../src/damage-cause.ts';
import {
  PRACTICE_BOSSES,
  practiceCheckpoint,
  testCheckpoint,
  testEncounterFromUrl,
  canPractice,
} from '../src/practice.ts';
import { finalArsenalSeed, reclaimerFinale } from '../src/boss-progression.ts';
import {
  FINAL_MOVES,
  finaleMove,
  finaleRecovery,
  finaleFollowups,
  finaleTestFromUrl,
  finalePreview,
} from '../src/final-arsenal.ts';
import { beginInterceptorAttack, interceptorAngles, interceptorLock } from '../src/interceptor.ts';
import { INTERCEPTOR_WEAPONS, fireWeapon, clearArsenal } from '../src/interceptor-weapons.ts';
import { getLevel } from '../src/levels.ts';
import { getOvertimeLevel, overtimeSeed } from '../src/overtime.ts';
import { newCampaignSeed } from '../src/run-seed.ts';
import { UPRISING_FINALES } from '../src/uprising-model.ts';
import { uprisingTestFromUrl } from '../src/uprising-test.ts';
import { currentRemixEncounter, remixEncounter, remixEncounters } from '../src/boss-remix-rules.ts';
import { loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import {
  snapshotPracticeWin,
  recordPracticeWin,
  PRACTICE_RULESET,
} from '../src/practice-records.ts';
import { playRoom } from './room-pilot.ts';

const { Body, Composite } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1400, y: 300 },
};
const preset = (q = '') => finaleTestFromUrl(new URL('https://test/?test=finale&v=1' + q))!;
function start(q = '') {
  const cp = preset(q);
  assert(cp && loadCheckpoint(cp));
  const g = new Game();
  g.start(cp.seed, cp, null, cp);
  return g;
}
function unit(overtime = false) {
  const g = start(overtime ? '&fight=overtime' : '');
  for (const prop of [...g.props.items]) g.props.remove(prop);
  g.hazards.clear();
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  const e = g.enemies[0];
  e.spawn = 0;
  Body.setPosition(e.body, { x: 700, y: 350 });
  Body.setStatic(e.body, true);
  Body.setPosition(g.player, { x: 1200, y: 690 });
  Body.setStatic(g.player, true);
  return { g, e };
}
function step(g: Game, n = 1) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, idle);
}

test('display names identify the mimic as Reclaimer and the security machine as Interceptor', () => {
  assert.equal(ENEMY_NAMES.interceptor, 'The Reclaimer');
  assert.equal(ENEMY_NAMES.boss, 'The Interceptor');
  assert.equal(PRACTICE_BOSSES.interceptor.name, ENEMY_NAMES.interceptor);
  assert.equal(PRACTICE_BOSSES.boss.name, ENEMY_NAMES.boss);
  assert.equal(
    testEncounterFromUrl(new URL('https://test/?test=reclaimer&v=3'))?.kind,
    'interceptor',
  );
  assert.equal(testEncounterFromUrl(new URL('https://test/?test=interceptor&v=3'))?.kind, 'boss');
});
test('revision 95 restores one final mimic, retains the earlier security boss and preserves revision 94', () => {
  assert(finalArsenalSeed(newCampaignSeed(undefined, () => 123)));
  assert(!reclaimerFinale('RF-C95-NEW'));
  assert(reclaimerFinale('RF-C94-SAVED'));
  const variants = new Set<string>();
  for (let i = 0; i < 60; i++) {
    const seed = 'RF-C95-ORDER-' + i;
    assert.equal(getLevel(seed, 19).spawns[0].kind, 'interceptor');
    const earlier = getLevel(seed, 15).spawns[0].kind;
    assert(['boss', 'sorter'].includes(earlier));
    variants.add(earlier);
    assert.equal(getOvertimeLevel(seed, 19, 5).spawns[0].kind, 'interceptor');
    assert(['boss', 'sorter'].includes(getOvertimeLevel(seed, 15, 5).spawns[0].kind));
    assert(finalArsenalSeed(overtimeSeed(seed)));
  }
  assert.equal(variants.size, 2);
  assert.equal(getLevel('RF-C94-SAVED', 19).spawns[0].kind, 'boss');
  assert.equal(getLevel('RF-C93-SAVED', 19).spawns[0].kind, 'interceptor');
});
test('nineteen attacks cycle without repeats; phase changes add unused weapons instead of restarting the introduction', () => {
  const { g, e } = unit();
  assert.deepEqual([...FINAL_MOVES].sort(), Object.keys(INTERCEPTOR_WEAPONS).sort());
  const state = e.interceptor!.finale!,
    seen = new Set<string>();
  for (const phase of [0, 1, 2]) {
    e.phase = phase;
    const count = phase === 0 ? 8 : phase === 1 ? 8 : 3;
    for (let i = 0; i < count; i++) {
      const move = finaleMove(g, e);
      assert(!seen.has(move), 'Repeated ' + move);
      seen.add(move);
      for (let n = 0; n < 10; n++) g.rng();
      assert.equal(finaleMove(g, e), move);
      e.interceptor!.move = move;
      finaleRecovery(g, e, 1.5);
    }
  }
  assert.equal(seen.size, 19);
  assert.equal(state.completed, 19);
  assert.notEqual(finaleMove(g, e), state.last);
});
for (const move of ['sweep', 'ringburst'] as const)
  for (const overtime of [false, true])
    test(`${move}, ${overtime ? 'NG+' : 'Campaign'}: each volley locks and fires exactly its advertised directions`, () => {
      const { g, e } = unit(overtime),
        rig = e.interceptor!;
      beginInterceptorAttack(g, e, move);
      const fired: number[][] = [];
      let current: number[] = [];
      g.enemyShot = (_e, a) => current.push(a);
      const volleys = finaleFollowups(g, e) + 1;
      for (let i = 0; i < volleys; i++) {
        const began = g.time,
          warning = e.timer;
        while (e.timer > interceptorLock(e) && g.mode === 'playing') step(g);
        const angles = interceptorAngles(e, g.level.bossRemix),
          aim = { ...e.aim };
        Body.setPosition(g.player, { x: 1200, y: 220 });
        current = [];
        const state = e.state;
        for (let frame = 0; frame < 120 && e.state === state && current.length === 0; frame++) {
          step(g);
          if (e.state === state) assert.deepEqual(e.aim, aim);
          if (g.time - began < warning - 1e-7) assert.equal(current.length, 0);
        }
        assert.deepEqual(current, angles);
        fired.push(current);
        if (i < volleys - 1) assert.equal(e.state, 'followup');
      }
      assert.equal(e.state, 'recover');
      assert.equal(fired.length, volleys);
      assert.equal(rig.volley, volleys - 1);
      assert.notDeepEqual(fired[0], fired[1]);
    });
test('Lockdown marks actual supporting surfaces, freezes its targets, then arms only those zones', () => {
  for (const overtime of [false, true]) {
    const { g, e } = unit(overtime);
    beginInterceptorAttack(g, e, 'lockdown');
    const zones = structuredClone(e.interceptor!.zones);
    assert.equal(zones.length, overtime ? 4 : 3);
    assert(zones.every((z) => z.x >= 100 && z.x <= 1900 && z.y === 732));
    Body.setPosition(g.player, { x: 1600, y: 300 });
    step(g, 30);
    assert.deepEqual(e.interceptor!.zones, zones);
    assert.equal(e.interceptor!.charges.length, 0);
    for (let frame = 0; frame < 100 && e.state === 'windup'; frame++) step(g);
    assert.deepEqual(
      e.interceptor!.charges.map((c) => c.pos),
      zones,
    );
    assert(e.interceptor!.charges.every((c) => c.left >= 0.64));
    assert.equal(e.interceptor!.zones.length, 0);
    for (const x of [100, 1900]) {
      Body.setPosition(g.player, { x, y: 690 });
      beginInterceptorAttack(g, e, 'lockdown');
      const marked = e.interceptor!.zones;
      assert(marked.every((p, i) => i === 0 || p.x - marked[i - 1].x >= 210));
    }
  }
});
test('NG+ opens its complete arsenal and escalates followups, damage and linked recoveries', () => {
  const normal = unit(),
    plus = unit(true);
  const seen = new Set<string>();
  for (let i = 0; i < 19; i++) {
    const move = finaleMove(plus.g, plus.e);
    assert(!seen.has(move));
    seen.add(move);
    plus.e.interceptor!.move = move;
    finaleRecovery(plus.g, plus.e, 1.5);
  }
  assert.equal(seen.size, 19);
  normal.e.phase = plus.e.phase = 2;
  normal.e.interceptor!.move = plus.e.interceptor!.move = 'sweep';
  assert(finaleFollowups(plus.g, plus.e) > finaleFollowups(normal.g, normal.e));
  normal.e.interceptor!.finale!.chain = plus.e.interceptor!.finale!.chain = 0;
  assert(finaleRecovery(plus.g, plus.e, 1.5) < finaleRecovery(normal.g, normal.e, 1.5));
  for (const { g, e } of [normal, plus]) fireWeapon(g, e, 'aimed', e.body.position, [0]);
  assert(plus.g.shots[0].damage > normal.g.shots[0].damage);
  assert(plus.e.maxHp > normal.e.maxHp);
});
test('pause, hitstop, phase transitions and death cannot leave unmarked arsenal effects behind', () => {
  const { g, e } = unit();
  beginInterceptorAttack(g, e, 'lockdown');
  const before = JSON.stringify({ zones: e.interceptor!.zones, timer: e.timer });
  g.setMode('paused');
  step(g, 120);
  assert.equal(JSON.stringify({ zones: e.interceptor!.zones, timer: e.timer }), before);
  g.setMode('playing');
  g.hitStop = 0.5;
  step(g, 10);
  assert.equal(JSON.stringify({ zones: e.interceptor!.zones, timer: e.timer }), before);
  g.hitStop = 0;
  e.hp = e.maxHp * 0.3;
  step(g);
  assert.equal(e.state, 'transition');
  assert.equal(e.interceptor!.zones.length, 0);
  beginInterceptorAttack(g, e, 'lockdown');
  clearArsenal(g, e);
  assert.equal(e.interceptor!.zones.length + e.interceptor!.charges.length, 0);
  g.hitEnemy(e, 999999);
  step(g, 60);
  assert.equal(g.hp, 100);
});
test('current arena Practice and old score identities remain distinct and playable', () => {
  assert.equal(PRACTICE_RULESET, 5);
  for (const id of ['boss-skybridge', 'boss-crossfire'] as const) {
    const record = currentRemixEncounter(id),
      g = new Game();
    const found = { version: 1, seen: [id] };
    assert(!canPractice(record, remixEncounters(found, false)));
    assert(canPractice(record, remixEncounters(found, true)));
    assert(canPractice(remixEncounter(id), remixEncounters(found, true)));
    assert.equal(record.kind, 'interceptor');
    assert(practiceCheckpoint(record));
    assert(g.startPractice(record));
    assert(g.enemies[0].interceptor?.finale);
    assert.equal(g.enemies[0].kind, 'interceptor');
    const result = playRoom(g, 180);
    assert(result.clear && result.hp > 0, JSON.stringify({ id, ...result }));
    for (let frame = 0; frame < 90 && g.mode !== 'won'; frame++) step(g);
    const win = snapshotPracticeWin(g, true);
    assert(win);
    assert.equal(recordPracticeWin([], win).records.length, 1);
  }
});
test('strict finale links build legal isolated scenes, honor mirrors and never write Continue', () => {
  for (const arena of ['relay', 'skybridge', 'crossfire'])
    for (const mirror of [0, 1]) {
      const cp = preset('&arena=' + arena + '&mirror=' + mirror);
      assert(cp && loadCheckpoint(cp));
      const g = new Game();
      let writes = 0;
      g.onCheckpoint = () => writes++;
      g.start(cp.seed, cp, null, cp);
      assert.equal(g.enemies[0].kind, 'interceptor');
      assert.equal(g.level.mirrored, !!mirror);
      g.save();
      assert.equal(writes, 0);
      assert(finalePreview(cp.seed));
    }
  for (const q of [
    '&fight=bad',
    '&phase=4',
    '&attack=bad',
    '&mirror=2',
    '&arena=bad',
    '&v=3',
    '&phase=2&phase=3',
    '&hp=999',
    '&fight=overtime&arena=crossfire',
    '&fight=overtime&phase=1',
  ])
    assert.equal(finaleTestFromUrl(new URL('https://test/?test=finale' + q)), null, q);
});
for (const finale of UPRISING_FINALES)
  test(finale + ' keeps the same Reclaimer and its job consequence in fresh Campaigns', () => {
    const cp = uprisingTestFromUrl(
      new URL('https://test/?test=uprising&route=' + finale + '&v=2'),
    )!;
    cp.seed = 'RF-C95-JOB-' + finale;
    const g = new Game();
    g.start(cp.seed, cp);
    assert.equal(g.uprising.finale, finale);
    assert.equal(g.enemies[0].kind, 'interceptor');
    const e = g.enemies[0];
    e.interceptor!.finale!.completed = 2;
    e.phase = 2;
    if (finale === 'mutiny') {
      e.interceptor!.move = 'sweep';
      assert.equal(finaleFollowups(g, e), 0);
    }
    if (finale === 'isolated')
      for (let i = 0; i < 40; i++) {
        const move = finaleMove(g, e);
        assert(!['ringburst', 'lockdown', 'shockwave', 'afterimage'].includes(move));
        e.interceptor!.move = move;
        finaleRecovery(g, e, 1.5);
      }
    let save: Checkpoint | null = null;
    g.onCheckpoint = (s) => (save = s);
    g.save();
    assert(save && loadCheckpoint(save));
    const continued = new Game();
    continued.start(cp.seed, save);
    assert.equal(continued.enemies[0].kind, 'interceptor');
    assert.deepEqual(continued.level, g.level);
    const result = playRoom(continued, 180);
    assert(result.clear && result.hp > 0, JSON.stringify({ finale, ...result }));
  });
