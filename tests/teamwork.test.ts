import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import { SUPPORT, crossesSupport, isSupport } from '../src/teamwork.ts';
import { teamworkLevel } from '../src/teamwork-layout.ts';
import { teamworkTestFromUrl } from '../src/teamwork-test.ts';
import { getLevel } from '../src/levels.ts';
import { loadCheckpoint, getGun, type Checkpoint } from '../src/rules.ts';
import { dailyForDate } from '../src/daily.ts';
import { snapshotRun, loadRunHistory } from '../src/run-history.ts';
import { encounterPlan, shapeEncounter, encounterDelays } from '../src/encounter-pacing.ts';
import { splitWaves } from '../src/reinforcements.ts';
import {
  fixture,
  target,
  round,
  advance,
  beam,
  wall,
  Body,
  Composite,
} from './branches-fixture.ts';
import { playRoom } from './room-pilot.ts';
import { loadLogbook, recordLogbook, logbookEntries } from '../src/logbook.ts';
import { archiveMark } from '../src/archive-art.ts';
import { ENEMY_GUIDES } from '../src/archive-art.ts';
import { MACHINE_LORE } from '../src/lore-factory.ts';
import { shotLight } from '../src/projectile-light.ts';

function pair(kind: 'repairer' | 'relay' = 'repairer', mods: string[] = []) {
  const g = fixture(mods),
    unit = target(g, 600, 300, kind),
    patrol = target(g, 900, 300);
  patrol.maxHp = 200;
  patrol.hp = 100;
  unit.hp = unit.maxHp = 80;
  return { g, unit, patrol };
}
function connect(g: Game) {
  g.teamwork.tick(1.01);
}
function ready(g: Game) {
  connect(g);
  g.teamwork.tick(SUPPORT.tell + 0.01);
}

test('new Campaigns introduce bounded physical pairs after zone one and preserve the rest of every roster', () => {
  const seen = new Set<string>(),
    later = new Set<number>();
  for (let i = 0; i < 40; i++) {
    const g = new Game();
    g.start('TEAMWORK-' + i, undefined, null, null, false, 0, false);
    for (let stage = 0; stage < 20; stage++) {
      g.stage = stage;
      g.loadRoom();
      const support = g.level.spawns.filter((s) => isSupport(s.kind));
      assert(support.length <= 1);
      if (stage < 6 || g.level.boss) assert.equal(support.length, 0);
      if (!support.length) continue;
      seen.add(support[0].kind);
      later.add(stage);
      if (stage < 10) assert.equal(support[0].kind, 'repairer');
      const members = g.level.spawns.filter((s) => s.teamwork);
      assert.equal(members.length, 2);
      assert.equal(members.filter((s) => isSupport(s.kind)).length, 1);
      assert(!members.some((s) => s.elite || s.squad));
      const [opening, reserve] = splitWaves(g.level, g.roomSeed, stage);
      shapeEncounter(opening, reserve, g.level, encounterPlan(g.level, g.roomSeed, stage));
      assert(!opening.some((s) => s.teamwork) || !reserve.some((s) => s.teamwork));
      const delays = encounterDelays(reserve, 1);
      const pairedDelays = reserve.flatMap((s, n) => (s.teamwork ? [delays[n]] : []));
      if (pairedDelays.length) assert.equal(pairedDelays[0], pairedDelays[1]);
      if (g.level.teamworkIntro) assert.equal(opening.filter((s) => s.teamwork).length, 2);
      assert.deepEqual(teamworkLevel(g, g.level), g.level, 'Do not inject a second support');
      const hull = support[0];
      assert(
        !g.level.solids.some(
          (b) =>
            hull.x + 14 > b.x &&
            hull.x - 14 < b.x + b.w &&
            hull.y + 14 > b.y &&
            hull.y - 14 < b.y + b.h,
        ),
      );
    }
  }
  assert.deepEqual([...seen].sort(), ['relay', 'repairer']);
  assert(later.has(14) && later.has(18));
  const g = new Game();
  g.start('TEAMWORK-0');
  g.stage = 6;
  const level = getLevel(g.seed, 6),
    before = structuredClone(level),
    shaped = teamworkLevel(g, level);
  assert.deepEqual(level, before);
  assert.equal(shaped.spawns.length, level.spawns.length);
  assert.deepEqual(shaped.solids, level.solids);
  assert.equal(shaped.spawns.filter((s, i) => s.kind !== level.spawns[i].kind).length, 1);
});

test('teamwork rules survive Continue and history while old saves, Daily and other isolated modes retain their rosters', () => {
  const g = new Game();
  let saved: Checkpoint | undefined;
  g.onCheckpoint = (s) => (saved = s);
  g.start('TEAMWORK-0');
  assert.equal(saved!.teamwork, 1);
  assert(loadCheckpoint(saved));
  g.stage = 6;
  g.loadRoom();
  g.save();
  const continued = new Game();
  continued.start(saved!.seed, saved);
  assert.equal(continued.teamwork.enabled, true);
  assert.deepEqual(continued.level.spawns, g.level.spawns);
  const old = { ...saved };
  delete old.teamwork;
  const legacy = new Game();
  legacy.start(old.seed!, old as Checkpoint);
  assert.equal(legacy.teamwork.enabled, false);
  assert(!legacy.level.spawns.some((s) => isSupport(s.kind)));
  g.setMode('dead');
  const recap = snapshotRun(g, 'teamwork-record')!;
  assert.equal(recap.teamwork, 1);
  assert.equal(loadRunHistory([recap])[0].teamwork, 1);
  assert.equal(loadRunHistory([{ ...recap, teamwork: 2 }]).length, 0);
  assert.equal(loadCheckpoint({ ...saved, teamwork: 2 }), null);
  assert.equal(loadCheckpoint({ ...saved, encounters: undefined }), null);
  const originalCourse = new Game();
  originalCourse.start('TEAMWORK-0', undefined, null, null, false, 0, false, [], null, 'pistol', 0);
  assert.equal(originalCourse.teamwork.enabled, false);
  const daily = new Game();
  daily.start(dailyForDate('2026-10-04').seed);
  assert.equal(daily.teamwork.enabled, false);
  assert.equal(loadCheckpoint({ ...saved, seed: daily.seed }), null);
  const isolated = new Game();
  isolated.startTest({ ...saved!, teamwork: undefined });
  assert.equal(isolated.teamwork.enabled, false);
  const workshop = new Game();
  workshop.startWorkshop([], []);
  assert.equal(workshop.teamwork.enabled, false);
  const practice = new Game();
  practice.start('TEAMWORK-0', undefined, { kind: 'loader', seed: 'TEAMWORK-0' });
  assert.equal(practice.teamwork.enabled, false);
});

test('bosses, jobs, quiet rooms, special introductions and Overtime cannot gain support pairs', () => {
  const g = new Game();
  g.start('TEAMWORK-0');
  g.stage = 6;
  const level = getLevel(g.seed, 6);
  for (const flag of [
    'boss',
    'detour',
    'freight',
    'crossing',
    'annex',
    'story',
    'shutdown',
    'courier',
    'floodgate',
    'sortingPit',
    'uprising',
    'fabricatorIntro',
    'anglerIntro',
    'crawlerIntro',
    'harpoonIntro',
    'sapperIntro',
  ]) {
    const excluded = { ...level, [flag]: true };
    assert.equal(teamworkLevel(g, excluded), excluded, flag);
  }
  for (const stage of [0, 1, 2, 3, 4, 5, 8, 12, 16]) {
    g.stage = stage;
    assert.equal(teamworkLevel(g, level), level);
  }
  g.stage = 6;
  g.overtime = { baseMods: 0, repairs: 0 };
  assert.equal(teamworkLevel(g, level), level);
});

test('repair warns before healing, respects max health and exhausts its finite supply', () => {
  const { g, unit, patrol } = pair();
  const sounds: string[] = [];
  g.onSound = (s) => sounds.push(s);
  connect(g);
  assert.equal(unit.support!.phase, 'windup');
  assert.equal(patrol.hp, 100);
  g.teamwork.tick(SUPPORT.tell - 0.02);
  assert.equal(patrol.hp, 100);
  g.teamwork.tick(0.03);
  assert.equal(patrol.hp, 108);
  for (let i = 0; i < 10; i++) g.teamwork.tick(0.71);
  assert.equal(patrol.hp, 148);
  assert.equal(unit.support!.phase, 'spent');
  assert.equal(unit.support!.target, undefined);
  g.teamwork.tick(20);
  assert.equal(patrol.hp, 148);
  assert(sounds.includes('repair-warn') && sounds.includes('repair-pulse'));
  const cap = pair();
  cap.patrol.hp = 197;
  ready(cap.g);
  assert.equal(cap.patrol.hp, 200);
  assert.equal(cap.unit.support!.remaining, 45);
});

test('support cannot target bosses, other support, allied units, elites or spawning machines', () => {
  for (const excluded of ['boss', 'support', 'ally', 'elite', 'spawning'] as const) {
    const { g, patrol } = pair();
    if (excluded === 'boss') patrol.kind = 'loader';
    if (excluded === 'support') patrol.kind = 'relay';
    if (excluded === 'ally') patrol.allied = true;
    if (excluded === 'elite') patrol.elite = 'shielded';
    if (excluded === 'spawning') patrol.spawn = 1;
    ready(g);
    assert.equal(patrol.hp, 100);
    assert(g.enemies.every((e) => e.support?.target === undefined));
  }
});

test('physical cover, range, death and reboot interrupt an established tether immediately', () => {
  for (const reason of ['cover', 'range', 'death', 'reboot'] as const) {
    const { g, unit, patrol } = pair();
    connect(g);
    assert.equal(unit.support!.target, patrol.id);
    if (reason === 'cover') wall(g, 750, 300, 40, 100);
    if (reason === 'range') Body.setPosition(patrol.body, { x: 1200, y: 300 });
    if (reason === 'death') g.hitEnemy(patrol, 10000);
    if (reason === 'reboot') patrol.allied = true;
    g.teamwork.tick(2);
    assert.equal(unit.support!.target, undefined);
    if (reason !== 'death') assert.equal(patrol.hp, 100);
  }
});

test('only one support connection exists at a time and pause freezes the warning', () => {
  const { g, unit, patrol } = pair();
  target(g, 650, 300, 'relay');
  connect(g);
  assert.equal(g.enemies.filter((e) => e.support?.target !== undefined).length, 1);
  const timer = unit.support!.timer;
  g.setMode('paused');
  g.teamwork.tick(10);
  assert.equal(unit.support!.timer, timer);
  assert.equal(patrol.hp, 100);
  g.setMode('playing');
  g.hitEnemy(unit, 1000);
  assert(g.enemies.every((e) => e.support?.target === undefined));
});

test('real projectiles sever a tether only on their travelled side of cover', () => {
  for (const blocked of [false, true]) {
    const { g, unit } = pair();
    connect(g);
    if (blocked) wall(g, 750, 240, 80, 20);
    round(g, { pos: { x: 750, y: 180 }, vel: { x: 0, y: 40 } });
    advance(g, 4);
    assert.equal(unit.support!.target !== undefined, blocked);
  }
  assert(crossesSupport({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }, 0));
  assert(!crossesSupport({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, 0));
});

test('beam pulses cut exposed tethers while solid cover blocks the beam first', () => {
  const { g, unit } = pair('repairer', ['cutting-torch']);
  connect(g);
  Body.setPosition(g.player, { x: 750, y: 180 });
  g.aim = { x: 750, y: 500 };
  const cover = wall(g, 750, 240, 80, 20);
  beam(g, 0.2);
  assert(unit.support!.target !== undefined);
  Composite.remove(g.engine.world, cover);
  g.terrain = g.terrain.filter((b) => b !== cover);
  beam(g, 0.2);
  assert.equal(unit.support!.target, undefined);
});

test('relay charges one native shot without speeding it up or stacking; three uses exhaust it', () => {
  const { g, unit, patrol } = pair('relay');
  connect(g);
  g.enemyShot(patrol, 0, 9, 20);
  assert.equal(g.shots.at(-1)!.damage, 20);
  g.teamwork.tick(SUPPORT.tell + 0.01);
  assert.equal(unit.support!.phase, 'ready');
  for (let i = 0; i < 3; i++) {
    if (i) {
      g.teamwork.tick(SUPPORT.cooldown + 0.01);
      g.teamwork.tick(SUPPORT.tell + 0.01);
    }
    g.enemyShot(patrol, 0, 9, 20);
    const charged = g.shots.at(-1)!;
    assert.equal(charged.damage, 26);
    assert.equal(charged.vel.x, 9);
    assert.equal(charged.supportCharged, true);
    assert.equal(shotLight(charged, [])!.color, '#efc477');
    g.enemyShot(patrol, 0, 9, 20);
    assert.equal(g.shots.at(-1)!.damage, 20);
    assert.equal(g.shots.at(-1)!.supportCharged, undefined);
  }
  assert.equal(unit.support!.phase, 'spent');
  assert.equal(unit.support!.remaining, 0);
});

test('relay expiry, shooting its tether and blocking a muzzle cannot leave a hidden charged attack', () => {
  const expired = pair('relay');
  ready(expired.g);
  expired.g.teamwork.tick(SUPPORT.ready + 0.01);
  expired.g.enemyShot(expired.patrol, 0, 9, 20);
  assert.equal(expired.g.shots.at(-1)!.damage, 20);
  assert.equal(expired.unit.support!.remaining, 3);
  const cut = pair('relay');
  ready(cut.g);
  cut.g.teamwork.cutAlong({ x: 750, y: 200 }, { x: 750, y: 400 }, 3, true);
  cut.g.enemyShot(cut.patrol, 0, 9, 20);
  assert.equal(cut.g.shots.at(-1)!.damage, 20);
  const blocked = pair('relay');
  ready(blocked.g);
  wall(blocked.g, 925, 300, 10, 90);
  blocked.g.enemyShot(blocked.patrol, 0, 9, 20);
  assert.equal(blocked.g.shots.length, 0);
  assert.equal(blocked.unit.support!.remaining, 3);
});

test('enemy rounds cannot cut the tether, and frozen or carried support cannot keep working', () => {
  const { g, unit, patrol } = pair();
  connect(g);
  g.teamwork.cutAlong({ x: 750, y: 200 }, { x: 750, y: 400 }, 3, false);
  assert.equal(unit.support!.target, patrol.id);
  g.cryogenic.states.set(unit.id, {
    cold: 0,
    touched: g.time,
    frozen: g.time + 10,
    immune: 0,
    ready: true,
  });
  g.teamwork.tick(2);
  assert.equal(unit.support!.target, undefined);
  assert.equal(patrol.hp, 100);
});

test('room reload and terminal states remove connections and reset the room supply', () => {
  for (const mode of ['dead', 'won', 'title'] as const) {
    const { g, unit } = pair();
    ready(g);
    g.setMode(mode);
    assert.equal(unit.support!.target, undefined);
  }
  const g = new Game();
  g.startTest(teamworkTestFromUrl(new URL('https://test/?test=teamwork'))!);
  const first = g.enemies.find((e) => e.support)!;
  assert(first);
  first.support!.remaining = 1;
  g.loadRoom();
  const next = g.enemies.find((e) => e.support)!;
  assert(next !== first);
  assert.equal(next.support!.remaining, SUPPORT.budget);
});

test('both new machines use native archive images, complete lore and hidden discovery states', () => {
  const blank = loadLogbook(null);
  for (const kind of ['repairer', 'relay'] as const) {
    assert(ENEMY_GUIDES[kind]);
    assert.equal(MACHINE_LORE[kind].length, 3);
    assert(archiveMark('enemy:' + kind).includes('data-archive-image="enemy:' + kind + '"'));
    const g = pair(kind).g;
    const found = recordLogbook(blank, g, kind);
    assert(found.enemies.includes(kind));
    assert(logbookEntries([], found, []).some((e) => e.id === 'enemy:' + kind));
    assert(!blank.enemies.includes(kind));
  }
});

test('isolated links accept only one known unit/gun and cannot mix Campaign or other test parameters', () => {
  const save = teamworkTestFromUrl(
    new URL('https://test/?test=teamwork&unit=relay&gun=nailgun&v=1'),
  )!;
  assert(loadCheckpoint(save));
  assert.equal(save.stage, 10);
  assert.equal(save.startingGun, 'nailgun');
  for (const q of [
    'test=teamwork&unit=bad',
    'test=teamwork&gun=bad',
    'test=teamwork&unit=relay&unit=repair',
    'test=teamwork&seed=x',
    'test=teamwork&daily=x',
    'test=teamwork&v=2',
  ])
    assert.equal(teamworkTestFromUrl(new URL('https://test/?' + q)), null);
});

for (const gun of ['pistol', 'shotgun', 'nailgun'] as const)
  for (const unit of ['repair', 'relay'] as const)
    test(`${gun} clears the real ${unit} introduction with ordinary movement and firing`, () => {
      const g = new Game(),
        save = teamworkTestFromUrl(new URL(`https://test/?test=teamwork&unit=${unit}&gun=${gun}`))!;
      let writes = 0,
        awards = 0;
      g.onCheckpoint = () => writes++;
      g.onCommendation = () => awards++;
      g.startTest(save);
      assert(g.enemies.some((e) => e.support));
      assert.equal(g.startingGun, gun);
      assert.deepEqual(g.gun, getGun(save.mods, gun));
      const result = playRoom(g, 150);
      assert(
        result.clear && g.hp > 0,
        JSON.stringify({
          gun,
          unit,
          hp: g.hp,
          enemies: g.enemies.map((e) => ({ kind: e.kind, hp: e.hp, p: e.body.position })),
        }),
      );
      assert.equal(writes, 0);
      assert.equal(awards, 0);
    });
