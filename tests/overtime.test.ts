import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, EXTRACTION_DURATION } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import { getOvertimeLevel, overtimeHealth, overtimeSeed } from '../src/overtime.ts';
import { getLevel } from '../src/levels.ts';
import { ENEMY_STATS, bossPhase, isBoss } from '../src/enemies.ts';
import { availableMods, getGun, loadCheckpoint, validBuild, STAGES } from '../src/rules.ts';
import type { Checkpoint } from '../src/rules.ts';
import {
  testCheckpoint,
  overtimeTestFromUrl,
  exitTestFromUrl,
  loadEncounters,
} from '../src/practice.ts';
import { dailyForDate } from '../src/daily.ts';
import { beginInterceptorAttack } from '../src/interceptor.ts';
import { REINFORCEMENT_TELL } from '../src/reinforcements.ts';
import { EXTRACTION, OVERTIME_LIFT, OVERTIME_STEPS } from '../src/escape-layout.ts';
const { Body, Query } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1000, y: 400 },
};
function tick(g: Game, n = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, { ...idle, ...input });
}
function overtime(area = 'docks') {
  return overtimeTestFromUrl(new URL('https://example.com/?test=overtime&area=' + area))!;
}
function clearedFinal() {
  const g = new Game();
  g.startTest(testCheckpoint('OVERTIME-40', 19));
  for (const e of [...g.enemies]) g.hitEnemy(e, 1e9);
  g.hitStop = 0;
  tick(g, 45);
  assert(g.clear);
  return g;
}
function boardOvertime(g: Game) {
  if (!g.escape) g.startEscape();
  assert(g.overtimeLift);
  Body.setPosition(g.player, { x: OVERTIME_LIFT.x, y: OVERTIME_LIFT.y - 18 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  for (let i = 0; i < 5 && g.escape?.phase === 'route'; i++) tick(g);
  assert.equal(g.escape?.destination, 'overtime');
  assert.equal(g.escape?.phase, 'extracting');
}
function rideOvertime(g: Game) {
  for (let i = 0; i < 170 && !g.overtime; i++) tick(g);
  assert(g.overtime);
}

test('Overtime rosters and layout mirrors repeat without changing the first lap', () => {
  for (let stage = 0; stage < STAGES; stage++) {
    const original = JSON.stringify(getLevel('OT-CHECK', stage));
    const a = getOvertimeLevel('OT-CHECK', stage);
    assert.deepEqual(a, getOvertimeLevel('OT-CHECK', stage));
    assert.equal(JSON.stringify(getLevel('OT-CHECK', stage)), original);
    assert.equal(a.area, getLevel('OT-CHECK', stage).area);
    if (a.boss) {
      assert.equal(a.spawns.length, 4);
      assert.equal(a.spawns.filter((s) => isBoss(s.kind)).length, 1);
      assert(loadEncounters([{ kind: a.spawns[0].kind, seed: overtimeSeed('OT-CHECK') }]).length);
    } else assert(a.spawns.filter((s) => s.elite).length >= 2);
  }
});

test('remixed enemy hulls and support entrances fit their real terrain anchors', () => {
  for (let seed = 0; seed < 12; seed++)
    for (let stage = 0; stage < 20; stage++) {
      const level = getOvertimeLevel('OT-HULL-' + seed, stage);
      for (const s of level.spawns) {
        const { w, h } = ENEMY_STATS[s.kind];
        assert(
          !level.solids.some(
            (b) =>
              s.x + w / 2 > b.x + 0.6 &&
              s.x - w / 2 < b.x + b.w - 0.6 &&
              s.y + h / 2 > b.y + 0.6 &&
              s.y - h / 2 < b.y + b.h - 0.6,
          ),
          `${level.id} ${s.kind} at ${s.x},${s.y}`,
        );
      }
    }
});

test('entering Overtime carries the exact gun, health, kills and clock and saves the new lap', () => {
  const g = clearedFinal();
  g.hp = 63;
  g.elapsed = 812;
  g.kills = 188;
  const mods = [...g.mods],
    gun = { ...g.gun };
  let saved: Checkpoint | null = null;
  g.testRun = null;
  g.onCheckpoint = (s) => (saved = s);
  assert(!g.startOvertime(), 'The boss room is no longer a New Game+ entrance');
  boardOvertime(g);
  g.elapsed = 812;
  rideOvertime(g);
  assert.equal(g.stage, 0);
  assert.deepEqual(g.mods, mods);
  assert.deepEqual(g.gun, gun);
  assert.equal(g.hp, 63);
  assert.equal(g.elapsed, 812);
  assert.equal(g.kills, 188);
  assert.deepEqual(g.overtime, { baseMods: 19, repairs: 0, remix: 1 });
  assert(saved);
  assert(loadCheckpoint(saved));
  const resumed = new Game();
  resumed.start(g.seed, loadCheckpoint(saved)!);
  assert.deepEqual(resumed.level, g.level);
  assert.deepEqual(resumed.mods, g.mods);
  assert.deepEqual(resumed.waves.doors, g.waves.doors);
  assert(!resumed.canDetour);
  assert(!resumed.canOvertime);
});

test('the final room leads to one departure bay, with ordinary jumps to its New Game+ elevator', () => {
  const exit = clearedFinal();
  Body.setPosition(exit.player, { x: 1915, y: 710 });
  Body.setVelocity(exit.player, { x: 0, y: 0 });
  tick(exit, 10);
  assert(exit.escape);
  assert.equal(exit.overtime, null);
  assert(exit.extractionLift && exit.overtimeLift);
  Body.setPosition(exit.player, { x: EXTRACTION.x, y: EXTRACTION.y - 18 });
  tick(exit, 170);
  assert.equal(exit.mode, 'won');
  assert.equal(exit.overtime, null);
  const g = clearedFinal();
  assert(!g.detourStepsReady && !g.canBranch);
  g.startEscape();
  // Traverse with the starting gun: the continuation must not require recoil upgrades.
  g.mods = [];
  g.gun = getGun([]);
  Body.setPosition(g.player, { x: 6600, y: 722 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  const path = [
    ...OVERTIME_STEPS.map((s) => ({ x: s.x + s.w / 2, y: s.y - 18 })),
    { x: OVERTIME_LIFT.x, y: OVERTIME_LIFT.y - 18 },
  ];
  let point = 0,
    previous = 6600,
    stuck = 0;
  for (let i = 0; i < 1200 && !g.overtime; i++) {
    const p = g.player.position,
      target = path[Math.min(point, path.length - 1)],
      dx = target.x - p.x;
    if (g.grounded && Math.abs(dx) < 22 && Math.abs(p.y - target.y) < 8) point++;
    stuck = Math.abs(p.x - previous) < 0.4 ? stuck + 1 : 0;
    previous = p.x;
    const move = dx > 8 ? 1 : dx < -8 ? -1 : 0;
    const blocked =
      move && Query.ray(g.solidBodies, p, { x: p.x + move * 50, y: p.y }, 24).length > 0;
    tick(g, 1, {
      left: move < 0,
      right: move > 0,
      jump: g.grounded && (p.y - target.y > 45 || !!blocked || stuck > 12),
    });
  }
  assert(g.overtime, JSON.stringify(g.player.position));
  assert.equal(g.stage, 0);
  assert.equal(g.escape, null);
  assert.equal(g.shotCount, 0);
});

test('New Game+ requires landing inside its deck and freezes the complete ride on pause', () => {
  const g = clearedFinal();
  g.startEscape();
  for (const pos of [
    { x: OVERTIME_LIFT.x, y: OVERTIME_LIFT.y - 180, vy: 0 },
    { x: OVERTIME_LIFT.x - OVERTIME_LIFT.w / 2 + 5, y: OVERTIME_LIFT.y - 18, vy: 0 },
    { x: OVERTIME_LIFT.x, y: OVERTIME_LIFT.y - 18, vy: -8 },
  ]) {
    Body.setPosition(g.player, pos);
    Body.setVelocity(g.player, { x: 0, y: pos.vy });
    tick(g);
    assert.equal(g.escape?.phase, 'route');
    assert(!g.startOvertime());
  }
  let wins = 0;
  g.onSound = (s) => {
    if (s === 'win') wins++;
  };
  boardOvertime(g);
  const hp = g.hp,
    elapsed = g.elapsed,
    shots = g.shotCount,
    y = g.player.position.y;
  g.damagePlayer(9999);
  g.fire();
  tick(g, 30, { right: true, fire: true, jump: true });
  assert.equal(g.hp, hp);
  assert.equal(g.elapsed, elapsed);
  assert.equal(g.shotCount, shots);
  assert.equal(g.player.position.x, OVERTIME_LIFT.x);
  assert(g.player.position.y < y);
  assert.equal(g.extractionLift!.position.y, EXTRACTION.y + EXTRACTION.h / 2);
  const depart = g.escape!.depart,
    at = { ...g.player.position };
  g.setMode('paused');
  tick(g, 120);
  assert.equal(g.escape!.depart, depart);
  assert.deepEqual(g.player.position, at);
  g.setMode('playing');
  tick(g, Math.floor((EXTRACTION_DURATION - depart) * 60) - 2);
  assert.equal(g.overtime, null);
  rideOvertime(g);
  assert.equal(wins, 0);
  assert.equal(g.elapsed, elapsed);
  assert.equal(g.overtimeLift, null);
  assert.equal(g.extractionLift, null);
});

test('Overtime is opt-in, unavailable in Daily or Practice, and cannot loop twice', () => {
  const g = new Game();
  assert(!g.startOvertime());
  const daily = dailyForDate('2026-09-11')!;
  g.start(daily.seed, testCheckpoint(daily.seed, 19));
  g.clear = true;
  g.enemies = [];
  g.waves.clear();
  assert(!g.canOvertime);
  assert(!g.startOvertime());
  g.startEscape();
  assert.equal(g.overtimeLift, null);
  assert(OVERTIME_STEPS.every((s) => !g.level.solids.some((b) => b.x === s.x && b.y === s.y)));
  g.startPractice({ kind: 'interceptor', seed: 'OT-PRACTICE' });
  assert(!g.canOvertime);
  const ot = clearedFinal();
  boardOvertime(ot);
  rideOvertime(ot);
  ot.stage = 19;
  ot.loadRoom();
  ot.clear = true;
  ot.enemies = [];
  ot.waves.clear();
  assert(!ot.canOvertime);
  assert(!ot.startOvertime());
  ot.startEscape();
  assert(ot.escape);
  assert.equal(ot.overtimeLift, null);
});

test('overpowered full builds still face upgraded health and late boss phases', () => {
  assert.equal(bossPhase(100, 100), 0);
  assert.equal(bossPhase(100, 100, true), 1);
  assert.equal(bossPhase(49, 100, true), 2);
  for (const stage of [3, 7, 11, 15, 19]) {
    const save = overtime();
    save.stage = stage;
    const g = new Game();
    g.startTest(save);
    const e = g.enemies[0];
    assert(isBoss(e.kind));
    assert.equal(e.phase, 1);
    assert.equal(e.maxHp, overtimeHealth(e.kind, stage));
    assert(e.maxHp >= 4200);
  }
});

test('support waves preserve their full warning and spawn grace, including after a fast boss kill', () => {
  const save = overtime();
  save.stage = 19;
  const g = new Game();
  g.startTest(save);
  const e = g.enemies[0];
  assert.equal(g.enemies.length, 1);
  assert(g.waves.pending);
  g.waves.update(8);
  assert.equal(g.waves.phase, 'opening');
  g.waves.update(1);
  assert.equal(g.waves.phase, 'warning');
  assert(g.waves.doors.every((d) => d.timer === REINFORCEMENT_TELL));
  g.hitEnemy(e, 1e9);
  g.hitStop = 0;
  tick(g, 20);
  assert.equal(g.enemies.length, 0);
  assert(!g.clear);
  tick(g, 26);
  assert(g.enemies.length > 0);
  assert(g.enemies.every((e) => e.spawn > 0));
  for (const e of [...g.enemies]) g.hitEnemy(e, 1e9);
  g.hitStop = 0;
  tick(g, 3);
  assert(g.clear);
});

test('Overtime increases ordinary projectile pressure without shortening locked tells', () => {
  const save = overtime();
  save.stage = 19;
  const g = new Game();
  g.startTest(save);
  const e = g.enemies[0];
  e.spawn = 0;
  beginInterceptorAttack(g, e, 'capacitor');
  const tell = e.timer;
  g.updateEnemy(e, 0.1);
  assert(Math.abs(e.timer - (tell - 0.1)) < 1e-8);
  g.spawnEnemy('shooter', 400, 150);
  const shooter = g.enemies.at(-1)!;
  shooter.spawn = 0;
  shooter.timer = 0.35;
  g.updateEnemy(shooter, 0.1);
  assert(Math.abs(shooter.timer - 0.25) < 1e-8);
  g.enemyShot(shooter, -Math.PI / 2);
  const shot = g.shots.at(-1)!;
  assert.equal(shot.damage, 26);
  assert.equal(Math.hypot(shot.vel.x, shot.vel.y), 12.5);
});

test('second-lap rewards are legal, finite and become repairs without stacking duplicate upgrades', () => {
  const g = new Game();
  // Commit to Rail spike before Overtime; every actual second-lap checkpoint
  // must remain legal as the growing pool delays its first exhausted reward.
  const initial = overtime();
  assert(availableMods(initial.mods).some((m) => m.id === 'rail-spike'));
  initial.mods.push('rail-spike');
  for (let i = 0; i < 3; i++) initial.mods.push(availableMods(initial.mods)[0].id);
  initial.detours = [0, 1, 2, 4];
  initial.overtime!.baseMods = initial.mods.length;
  g.startTest(initial);
  const base = g.mods.length;
  for (let stage = 0; stage < 19; stage++) {
    assert.equal(g.stage, stage);
    g.hp = 50;
    g.openReward();
    assert(g.offers.length > 0);
    assert.equal(
      g.offers.some((m) => m.id === 'repair'),
      availableMods(g.mods).length === 0,
    );
    const id = g.offers[0].id,
      before = g.mods.length;
    g.chooseMod(id);
    assert.equal(g.hp, id === 'repair' ? 74 : 62);
    assert.equal(g.mods.length, before + (id === 'repair' ? 0 : 1));
    assert(validBuild(g.mods));
    assert.equal(g.mods.length + g.overtime!.repairs, base + g.stage);
    const save: Checkpoint = {
      ...initial,
      stage: g.stage,
      mods: [...g.mods],
      overtime: { ...g.overtime! },
    };
    assert(loadCheckpoint(save));
  }
  // Independently exhaust the expanded pool to exercise the repair fallback.
  // No room transition is attempted past the real final stage.
  while (availableMods(g.mods).length) g.mods.push(availableMods(g.mods)[0].id);
  g.openReward();
  assert.deepEqual(
    g.offers.map((m) => m.id),
    ['repair'],
  );
  assert(!g.mods.includes('repair'));
  const count = g.mods.length;
  g.setMode('playing');
  g.chooseMod('repair');
  assert.equal(g.mods.length, count);
});

test('malformed lap state is rejected and earlier checkpoints still migrate', () => {
  const save = overtime();
  assert(loadCheckpoint(save));
  for (const bad of [
    null,
    true,
    [],
    {},
    { baseMods: 99, repairs: 0 },
    { baseMods: 19, repairs: -1 },
    { baseMods: 19, repairs: 1 },
  ])
    assert.equal(loadCheckpoint({ ...save, overtime: bad }), null);
  assert.equal(loadCheckpoint({ ...save, seed: 13 }), null);
  assert.equal(loadCheckpoint({ ...save, detours: null }), null);
  assert.equal(loadCheckpoint({ ...save, seed: dailyForDate('2026-09-11')!.seed }), null);
  const legacy = {
    ...save,
    version: 4,
    stage: 15,
    mods: save.mods.slice(0, 15),
    overtime: undefined,
  };
  const migrated = loadCheckpoint(legacy)!;
  assert.equal(migrated.stage, 19);
  assert.equal(migrated.missedUpgrades, 4);
  const g = new Game();
  g.start(migrated.seed, migrated);
  g.clear = true;
  g.enemies = [];
  g.waves.clear();
  boardOvertime(g);
  rideOvertime(g);
  let saved: Checkpoint | null = null;
  g.onCheckpoint = (s) => (saved = s);
  g.save();
  assert(loadCheckpoint(saved));
});

test('test links isolate saves, retries, unlocks and every starting area', () => {
  for (const area of ['docks', 'furnace', 'cooling', 'reclamation', 'rooftops']) {
    const save = overtime(area);
    assert(loadCheckpoint(save));
    const g = new Game();
    let writes = 0,
      wins = 0;
    g.onCheckpoint = () => writes++;
    g.onBossDefeated = () => wins++;
    g.startTest(save);
    assert.equal(g.level.area, area);
    assert(g.overtime);
    const layout = structuredClone(g.level);
    g.startTest(g.testRun!);
    assert.deepEqual(g.level, layout);
    g.save();
    assert.equal(writes, 0);
    assert.equal(wins, 0);
  }
  for (const query of [
    'test=overtime&daily=2026-09-11',
    'test=overtime&seed=abc',
    'test=overtime&test=overtime',
    'test=overtime&area=bad',
  ])
    assert.equal(overtimeTestFromUrl(new URL('https://example.com/?' + query)), null);
});

test('the exit elevator test starts at the shared bay and retries there without changing real saves', () => {
  const save = exitTestFromUrl(new URL('https://example.com/?test=exits'))!;
  assert(loadCheckpoint(save));
  const g = new Game();
  let writes = 0,
    victories = 0;
  g.onCheckpoint = () => writes++;
  g.onBossDefeated = () => victories++;
  g.startTest(save);
  assert.equal(g.player.position.x, 6600);
  assert(g.extractionLift && g.overtimeLift);
  const layout = structuredClone(g.level),
    build = [...g.mods];
  boardOvertime(g);
  rideOvertime(g);
  g.save();
  assert.deepEqual(g.mods, build);
  g.startTest(g.testRun!);
  assert.equal(g.player.position.x, 6600);
  assert.equal(g.overtime, null);
  assert.equal(g.escape?.phase, 'route');
  assert.deepEqual(g.level, layout);
  Body.setPosition(g.player, { x: EXTRACTION.x, y: EXTRACTION.y - 18 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  tick(g, 170);
  assert.equal(g.mode, 'won');
  assert.equal(writes, 0);
  assert.equal(victories, 0);
  for (const query of [
    'test=exits&test=exits',
    'test=exits&daily=2026-09-15',
    'test=exits&seed=abc',
    'test=exits&area=docks',
    'test=exits&mode=overtime',
  ])
    assert.equal(exitTestFromUrl(new URL('https://example.com/?' + query)), null);
});
