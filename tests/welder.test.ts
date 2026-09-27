import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { getOvertimeLevel } from '../src/overtime.ts';
import { planWelder, welderLevel, welderPair, welderPracticeLevel } from '../src/welder-layout.ts';
import { welderTestFromUrl } from '../src/welder-test.ts';
import { WELD_TELL, WELD_LIFE, WELDER_OPENING } from '../src/welder.ts';
import {
  loadCheckpoint,
  MOD_REQUIRES,
  isFusion,
  availableMods,
  type Checkpoint,
} from '../src/rules.ts';
import { OVERTIME_BUILDS, overtimeBuild } from '../src/overtime-balance.ts';
import { canPractice, loadEncounters, practiceCheckpoint } from '../src/practice.ts';
import { MACHINE_LORE } from '../src/lore-factory.ts';

const { Body, Composite, Query } = Matter;
const idle = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1200, y: 710 },
};
const preset = (q = '') => welderTestFromUrl(new URL('https://test/?test=welder' + q))!;
function arena() {
  const g = new Game();
  g.startTest(preset());
  for (const e of [...g.enemies]) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.hazards.clear();
  g.mutations.clear();
  // A controlled floor isolates attack geometry from the authored room hazards.
  for (const b of [...g.terrain])
    if (b.bounds.min.y < 739 && b.bounds.min.x >= 0 && b.bounds.max.x <= 2000) {
      Composite.remove(g.engine.world, b);
      g.terrain = g.terrain.filter((t) => t !== b);
    }
  for (const p of [...g.props.items]) g.props.remove(p);
  const e = g.spawnEnemy('welder', 1100, 710);
  e.spawn = 0;
  e.timer = 0;
  Body.setPosition(g.player, { x: 800, y: 721 });
  return { g, e };
}
function emptyExceptWelder(g: Game) {
  for (const e of [...g.enemies]) if (e.kind !== 'welder') Composite.remove(g.engine.world, e.body);
  g.enemies = g.enemies.filter((e) => e.kind === 'welder');
  g.waves.clear();
  g.mutations.clear();
}

test('Welder selection is deterministic, uncommon and replaces exactly one existing squad', () => {
  let count = 0;
  const areas = new Set<number>();
  for (let n = 0; n < 400; n++) {
    const seed = 'WELDER-' + n,
      s = planWelder(seed);
    assert.deepEqual(s, planWelder(seed));
    if (!s) continue;
    count++;
    areas.add(Math.floor(s.stage / 4));
    const level = getOvertimeLevel(seed, s.stage, 5),
      original = structuredClone(level);
    const pair = welderPair(level)!;
    assert(pair);
    assert(!level.boss);
    const replaced = welderLevel(level, s, s.stage);
    assert.equal(replaced.spawns.length, level.spawns.length - 1);
    assert.equal(replaced.spawns.filter((e) => e.kind === 'welder').length, 1);
    assert(!replaced.spawns.some((e) => e.squad));
    assert.deepEqual(level, original);
    assert.equal(welderLevel(level, s, s.stage + 1), level);
    for (const r of replaced.setpiece!.rosters) assert(r.every((i) => i < replaced.spawns.length));
    const b = pair.spawn;
    assert(
      !level.solids.some(
        (s) => b.x + 29 > s.x && b.x - 29 < s.x + s.w && b.y + 30 > s.y && b.y - 30 < s.y + s.h,
      ),
    );
    assert.equal(welderPracticeLevel(seed).spawns[0].kind, 'welder');
  }
  assert(count > 85 && count < 150, String(count));
  assert.equal(areas.size, 5);
});

test('all areas/builds have legal isolated previews and exactly one scheduled Welder', () => {
  for (const area of ['docks', 'furnace', 'cooling', 'reclamation', 'rooftops'])
    for (const build of Object.keys(OVERTIME_BUILDS)) {
      const s = preset('&area=' + area + '&build=' + build);
      assert(loadCheckpoint(s));
      const g = new Game();
      let writes = 0;
      g.onCheckpoint = () => writes++;
      g.startTest(s);
      const all = [...g.enemies.map((e) => e.kind), ...g.waves.doors.map((d) => d.spawn.kind)];
      assert.equal(all.filter((k) => k === 'welder').length, 1);
      assert.equal(g.level.area, area);
      assert.equal(writes, 0);
      g.startTest(g.testRun!);
      assert.deepEqual(g.testRun, s);
    }
});

test('Welder links reject mixed modes, duplicates and invalid values', () => {
  for (const suffix of [
    '&test=welder',
    '&daily=x',
    '&seed=x',
    '&workshop=1',
    '&build=__proto__',
    '&area=attic',
    '&area=docks&area=docks',
    '&build=beam&build=beam',
    '&mode=solo',
  ])
    assert.equal(welderTestFromUrl(new URL('https://test/?test=welder' + suffix)), null);
});

test('old Overtime saves never retroactively add the encounter', () => {
  const s = overtimeBuild('precision', 1, 'WELDER-51'),
    g = new Game();
  assert(planWelder(s.seed));
  assert(loadCheckpoint(s));
  g.start(s.seed, s);
  assert.equal(g.welder.state, null);
  assert(!g.level.spawns.some((s) => s.kind === 'welder'));
});

test('checkpoint validation rejects invalid stage, state, duplicate rewards and non-Overtime injection', () => {
  const s = preset();
  assert(loadCheckpoint(s));
  const variants: Checkpoint[] = [
    { ...s, welder: { ...s.welder!, stage: 19 } },
    { ...s, welder: { ...s.welder!, status: 'bogus' as never } },
    { ...s, welder: { ...s.welder!, status: 'claimed' } },
    { ...s, overtime: { ...s.overtime!, remix: 4 } },
    { ...s, version: 5 },
    { ...s, overtime: undefined },
  ];
  for (const value of variants) assert.equal(loadCheckpoint(value), null);
});

test('molten seams lock on warning, never hurt early, and can be cleared by jumping', () => {
  const { g, e } = arena();
  g.welder.updateEnemy(e, 0.01);
  assert.equal(e.state, 'windup');
  assert(g.welder.seams.length);
  const paths = g.welder.seams.map((s) => ({ a: { ...s.a }, b: { ...s.b } }));
  g.welder.update(WELD_TELL - 0.02);
  assert.equal(g.hp, 100);
  Body.setPosition(g.player, { x: 850, y: 650 });
  g.welder.update(0.04);
  assert.equal(g.hp, 100);
  assert.deepEqual(
    g.welder.seams.map((s) => ({ a: s.a, b: s.b })),
    paths,
  );
  Body.setPosition(g.player, { x: 800, y: 721 });
  g.welder.update(0.01);
  assert.equal(g.hp, 78);
  g.welder.update(0.01);
  assert.equal(g.hp, 78);
  g.welder.update(WELD_LIFE + 0.1);
  assert.equal(g.welder.seams.length, 0);
});

test('destroyed seam support cancels the attack and pause freezes the warning', () => {
  const { g, e } = arena();
  g.welder.traceSeams(e);
  const before = structuredClone(g.welder.seams.map((s) => s.age));
  g.setMode('paused');
  g.tick(1, idle);
  g.welder.update(1);
  assert.deepEqual(
    g.welder.seams.map((s) => s.age),
    before,
  );
  g.setMode('playing');
  const floor = g.welder.seams[0].support;
  g.terrain = g.terrain.filter((b) => b !== floor);
  g.welder.update(WELD_TELL + 0.01);
  assert.equal(g.hp, 100);
  assert.equal(g.welder.seams.length, 0);
});

test('barricades warn, cancel if occupied, remain short, and expire without rewards', () => {
  const { g, e } = arena();
  g.welder.planBarriers(e);
  assert.equal(g.welder.barriers.length, 2);
  const blocked = g.welder.barriers[0];
  Body.setPosition(g.player, { x: blocked.x, y: blocked.y });
  g.welder.update(WELD_TELL - 0.01);
  assert.equal(g.props.items.length, 0);
  g.welder.update(0.02);
  assert.equal(g.props.items.length, 1);
  const p = g.props.items[0];
  assert(p.welded);
  assert.equal(p.body.bounds.max.y - p.body.bounds.min.y, 84);
  assert.equal(Query.collides(g.player, [p.body]).length, 0);
  let rewards = 0;
  g.scrap.collect = () => {
    rewards++;
  };
  g.demolition.brokenProp = () => {
    rewards++;
  };
  g.props.hit(p, 1000, { x: 1, y: 0 });
  assert.equal(g.props.items.length, 0);
  assert.equal(rewards, 0);
  Body.setPosition(g.player, { x: 500, y: 721 });
  g.welder.planBarriers(e);
  g.welder.update(WELD_TELL);
  assert(g.props.items.length);
  g.time += 6.1;
  g.props.afterStep(0.01);
  assert.equal(g.props.items.length, 0);
  assert.equal(rewards, 0);
});

test('every major attack exposes the assembly and the arc direction stays committed', () => {
  for (let n = 0; n < 5; n++) {
    const { g, e } = arena();
    e.attacks = n;
    g.welder.updateEnemy(e, 0.01);
    const aim = { ...e.aim };
    Body.setPosition(g.player, { x: 1500, y: 200 });
    g.welder.updateEnemy(e, WELD_TELL - 0.01);
    assert.equal(e.state, 'windup');
    g.welder.updateEnemy(e, 0.02);
    assert.equal(e.state, 'recover');
    assert.equal(e.timer, WELDER_OPENING);
    assert.deepEqual(e.aim, aim);
    const hp = e.hp;
    g.hitEnemy(e, 100, undefined, false);
    assert.equal(hp - e.hp, 150);
    e.state = 'idle';
    const armored = e.hp;
    g.hitEnemy(e, 100, undefined, false);
    assert.equal(armored - e.hp, 55);
  }
});

test('Welder death leaves other enemies alive and immediately clears only its own hazards', () => {
  const { g, e } = arena();
  g.welder.traceSeams(e);
  g.welder.planBarriers(e);
  g.welder.update(WELD_TELL);
  const normal = g.props.spawn('crate', 1700, 710),
    other = g.spawnEnemy('runner', 1500, 720);
  g.hitEnemy(e, 100000, undefined, false);
  assert(other.hp > 0);
  assert(g.enemies.includes(other));
  assert.equal(g.welder.seams.length, 0);
  assert(g.props.items.includes(normal));
  assert(!g.props.items.some((p) => p.welded));
});

test('bonus survives Continue, is build-focused, cannot reroll or double-claim, then grants the room reward', () => {
  const s = preset(),
    g = new Game();
  let saved: Checkpoint | null = null;
  g.onCheckpoint = (s) => {
    if (s) saved = structuredClone(s);
  };
  g.start(s.seed, s);
  emptyExceptWelder(g);
  const e = g.spawnEnemy('welder', 1000, 710);
  e.spawn = 0;
  g.hitEnemy(e, 100000, undefined, false);
  assert.equal(g.welder.state?.status, 'defeated');
  assert(loadCheckpoint(saved));
  const resumed = new Game();
  resumed.start(s.seed, saved!);
  assert(!resumed.level.spawns.some((s) => s.kind === 'welder'));
  emptyExceptWelder(g);
  g.clear = true;
  g.openReward();
  assert.equal(g.welderReward, true);
  assert(!g.canReroll);
  assert(loadCheckpoint(saved));
  const before = g.mods.length;
  assert(g.offers.some((m) => MOD_REQUIRES[m.id] || isFusion(m.id)));
  const choice = g.offers[0].id,
    rewardSave = structuredClone(saved!);
  const retry = new Game();
  retry.start(s.seed, rewardSave);
  assert(retry.welderReward);
  assert.deepEqual(
    retry.offers.map((m) => m.id),
    g.offers.map((m) => m.id),
  );
  g.chooseMod(choice);
  assert.equal(g.welder.state?.status, 'claimed');
  assert(!g.welderReward);
  assert.equal(g.stage, s.stage);
  assert.equal(g.mods.length, before + 1);
  assert(loadCheckpoint(saved));
  g.chooseMod(choice);
  assert.equal(g.mods.length, before + 1);
  g.chooseMod(g.offers[0].id);
  assert.equal(g.stage, s.stage + 1);
  assert.equal(g.mods.length, before + 2);
  assert(loadCheckpoint(saved));
  const damaged = structuredClone(rewardSave);
  damaged.reward!.rerolled = true;
  assert.equal(loadCheckpoint(damaged), null);
  damaged.reward!.rerolled = false;
  delete damaged.reward!.welder;
  assert.equal(loadCheckpoint(damaged), null);
});

test('Practice and lore are earned through a live defeat; previews and cleanup award neither', () => {
  const s = preset();
  for (const isolated of [false, true]) {
    const g = new Game();
    const seen: string[] = [],
      victories: string[] = [];
    g.onEnemyDefeated = (kind) => seen.push(kind);
    g.onBossDefeated = (kind) => victories.push(kind);
    if (isolated) g.startTest(s);
    else g.start(s.seed, s);
    const e = g.spawnEnemy('welder', 1000, 700);
    e.spawn = 0;
    g.hitEnemy(e, 100000, undefined, false);
    assert.equal(seen.includes('welder'), !isolated);
    assert.equal(victories.includes('welder'), !isolated);
  }
  const { g, e } = arena();
  g.testRun = null;
  let awards = 0;
  g.onEnemyDefeated = g.onBossDefeated = () => {
    awards++;
  };
  g.hitEnemy(e, 100000, undefined, false, false, false, 'cleanup');
  assert.equal(awards, 0);
  assert.equal(g.welder.state?.status, 'scheduled');
  const record = { kind: 'welder' as const, seed: s.seed };
  assert(!canPractice(record, []));
  assert(canPractice(record, [record]));
  assert.deepEqual(loadEncounters([record]), [record]);
  assert(MACHINE_LORE.welder[2].length > 300);
  const practice = new Game();
  practice.start(s.seed, practiceCheckpoint(record)!, record);
  assert(practice.practice);
  assert(practice.level.boss);
  assert.equal(practice.enemies.length, 1);
  assert.equal(practice.enemies[0].kind, 'welder');
  assert.equal(practice.waves.doors.length, 0);
});

test('reset and defeat clear all transient welding state without touching the saved schedule', () => {
  const { g, e } = arena();
  g.welder.traceSeams(e);
  g.welder.planBarriers(e);
  g.setMode('dead');
  assert.equal(g.welder.seams.length, 0);
  assert.equal(g.welder.barriers.length, 0);
  g.startTest(g.testRun!);
  assert.equal(g.welder.state?.status, 'scheduled');
});
