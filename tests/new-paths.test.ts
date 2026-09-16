import test from 'node:test';
import assert from 'node:assert/strict';
import {
  availableMods,
  getGun,
  loadCheckpoint,
  MODS,
  validBuild,
  rewardMods,
  seeded,
} from '../src/rules.ts';
import { NEW_PATH_MODS, NEW_PATH_PARENTS } from '../src/new-paths.ts';
import { withParents, maxCombos, branchTestFromUrl } from '../src/branch-builds.ts';
import { fixture, round, target, wall, advance, Body, Composite } from './branches-fixture.ts';
import { COLD } from '../src/cryogenic.ts';
import { STASIS } from '../src/stasis.ts';
import type { Game, Input, Enemy } from '../src/game.ts';

const input = (g: Game, extra: Partial<Input> = {}): Input => ({
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: g.aim,
  ...extra,
});
const tick = (g: Game, extra: Partial<Input> = {}) => {
  g.hitStop = 0;
  g.tick(1 / 60, input(g, extra));
};
function hit(g: Game, e: Enemy, extra = {}) {
  const s = round(g, {
    pos: { x: e.body.bounds.min.x - 5, y: e.body.position.y },
    vel: { x: 25, y: 0 },
    ...extra,
  });
  g.updateShots(1 / 60);
  g.shots = [];
  return s;
}

test('all thirteen upgrades have legal reachable prerequisites, mutually exclusive forks and save support', () => {
  assert.equal(NEW_PATH_MODS.length, 13);
  assert.equal(MODS.length, 100);
  for (const mod of NEW_PATH_MODS) {
    const build = withParents([], [mod.id])!;
    assert(build && validBuild(build), mod.id);
    assert(
      maxCombos().some((c) => c.mods.includes(mod.id)),
      mod.id,
    );
    if (NEW_PATH_PARENTS[mod.id]) assert(!availableMods([]).some((m) => m.id === mod.id));
    assert(
      loadCheckpoint({
        version: 6,
        seed: 'NEW-PATHS',
        stage: 0,
        hp: 100,
        mods: build,
        kills: 0,
        elapsed: 0,
      }),
    );
  }
  for (const roots of [
    ['coolant-rounds', 'suspension'],
    ['coolant-rounds', 'deadeye'],
    ['suspension', 'shellshock'],
    ['suspension', 'crossfire'],
  ]) {
    assert.equal(withParents([], roots), null);
    assert.equal(withParents([], roots.reverse()), null);
  }
  for (const pair of [
    ['deep-freeze', 'cold-snap'],
    ['crosshatch', 'tripline'],
  ]) {
    assert.equal(withParents([], pair), null);
    assert.equal(withParents([], pair.reverse()), null);
  }
  assert.equal(getGun(['coolant-rounds']).damage, getGun([]).damage * 0.8);
  for (const root of ['coolant-rounds', 'suspension']) {
    let mods = [root];
    for (let stage = 1; stage < 20; stage++) {
      const offers = rewardMods(mods, 1, seeded('paths-' + stage), { stage });
      assert.equal(offers.length, 1);
      mods.push(offers[0].id);
      assert(validBuild(mods));
    }
  }
});

test('cold slows then decays, blocked shields and secondary fragments cannot stack it', () => {
  const g = fixture(['coolant-rounds']);
  const e = target(g);
  hit(g, e);
  assert(g.cryogenic.slow(e) < 1);
  const cold = g.cryogenic.states.get(e.id)!.cold;
  hit(g, e, { fragment: true });
  hit(g, e, { reflected: true });
  assert.equal(g.cryogenic.states.get(e.id)!.cold, cold);
  e.elite = 'shielded';
  e.facing = -1;
  hit(g, e);
  assert.equal(g.cryogenic.states.get(e.id)!.cold, cold);
  g.time += 5;
  g.cryogenic.update(5);
  assert.equal(g.cryogenic.slow(e), 1);
});
test('Deep Freeze has a finite stun and immunity without altering the physical body', () => {
  const g = fixture(['coolant-rounds', 'deep-freeze']);
  const e = target(g);
  Body.setStatic(e.body, false);
  for (let i = 0; i < 4; i++) hit(g, e);
  assert(g.cryogenic.frozen(e));
  assert(!e.body.isStatic);
  const until = g.cryogenic.states.get(e.id)!.frozen;
  for (let i = 0; i < 20; i++) hit(g, e);
  assert.equal(g.cryogenic.states.get(e.id)!.frozen, until);
  g.time = until + 0.01;
  assert(!g.cryogenic.frozen(e));
  for (let i = 0; i < 5; i++) hit(g, e);
  assert(!g.cryogenic.frozen(e));
  g.time += COLD.immunity;
  for (let i = 0; i < 4; i++) hit(g, e);
  assert(g.cryogenic.frozen(e));
});
test('Icebreaker spends a freeze once, creates bounded inert fragments and respects armor', () => {
  const g = fixture(['coolant-rounds', 'deep-freeze', 'icebreaker']);
  const e = target(g);
  for (let i = 0; i < 3; i++) hit(g, e);
  const hp = e.hp;
  round(g, { pos: { x: e.body.bounds.min.x - 5, y: 300 } });
  g.updateShots(1 / 60);
  assert(hp - e.hp > g.gun.damage * 2);
  assert.equal(g.shots.filter((s) => s.fragment).length, 3);
  assert(g.shots.filter((s) => s.fragment).every((s) => !s.recall && !s.stasis && s.damage <= 8));
  assert(!g.cryogenic.frozen(e));
  const second = e.hp;
  hit(g, e);
  assert(Math.abs(second - e.hp - g.gun.damage) < 0.001);
});
test('Cold Front spreads setup through clear space but not cover, and never bursts recursively', () => {
  const g = fixture(['coolant-rounds', 'cold-snap', 'cold-front']);
  const e = target(g),
    open = target(g, 640, 370),
    covered = target(g, 600, 180);
  wall(g, 600, 240, 110, 16);
  const hp = e.hp;
  for (let i = 0; i < 4; i++) hit(g, e);
  assert(hp - e.hp > g.gun.damage * 4);
  assert.equal(g.cryogenic.states.get(open.id)?.cold, 24);
  assert.equal(g.cryogenic.states.get(covered.id), undefined);
  assert.equal(open.hp, open.maxHp);
  const state = g.cryogenic.states.get(e.id)!;
  assert(state.immune > g.time);
});
for (const kind of [
  'loader',
  'crane',
  'press',
  'kiln',
  'sorter',
  'condenser',
  'turbine',
  'interceptor',
  'boss',
] as const)
  test(`cold gives ${kind} a capped vulnerable hit without changing its movement or attack state`, () => {
    const g = fixture(['coolant-rounds', 'deep-freeze', 'icebreaker']);
    const e = target(g, 600, 300, kind);
    e.state = 'windup';
    const original = e.state;
    for (let i = 0; i < COLD.threshold / 24; i++) hit(g, e, { damage: 10000 });
    assert(g.cryogenic.states.get(e.id)?.ready);
    assert.equal(g.cryogenic.slow(e), 1);
    assert(!g.cryogenic.frozen(e));
    const s = round(g);
    assert.equal(g.cryogenic.damage(e, s, 10000), 10000 + COLD.bonusCap);
    assert.equal(g.cryogenic.damage(e, s, 10000), 10000);
    assert.equal(e.state, original);
  });

test('Suspension preserves Scattershot, Burst and rear volleys, applies immediate recoil and pauses only friendly rounds', () => {
  const mods = ['suspension', 'scatter', 'burst', 'backblast', 'backfire'];
  const g = fixture(mods);
  target(g, 1600);
  const hostile = round(g, { friendly: false, pos: { x: 1100, y: 100 }, vel: { x: -2, y: 0 } });
  tick(g, { fire: true });
  assert(g.player.velocity.x < 0);
  assert(g.stasis.stock.length >= 10);
  for (let i = 0; i < 10; i++) tick(g, { fire: true });
  assert(hostile.pos.x < 1100);
  assert(!hostile.stasis);
  assert(g.stasis.stock.length <= STASIS.limit);
  assert(g.stasis.stock.some((s) => s.stasis?.phase === 'parked'));
  tick(g, { fire: false });
  assert.equal(g.stasis.stock.length, 0);
  for (let i = 0; i < 40; i++) tick(g);
  assert.equal(g.stasis.stock.length, 0, 'queued burst rounds must launch after release');
});
test('stored rounds retain banks, pierce, Recall and Vector until release; stock and lifetime are bounded', () => {
  const g = fixture(['suspension', 'recall', 'retrace', 'vector', 'ricochet', 'pierce']);
  const s = round(g);
  advance(g, 25);
  assert.equal(s.stasis?.phase, 'parked');
  assert(!s.recall?.returning);
  assert.equal(s.bounces, 2);
  assert.equal(s.pierce, 3);
  assert.equal(s.vector?.time, 0);
  for (let i = 0; i < 60; i++) round(g);
  assert(g.stasis.stock.length <= STASIS.limit);
  advance(g, 250);
  assert.equal(g.stasis.stock.length, 0);
  assert(g.shots.every((s) => s.life > 0));
});
test('Crosshatch aims from real parked positions and the finisher rewards a consecutive hit streak only once', () => {
  const g = fixture(['suspension', 'crosshatch', 'thread-the-needle']);
  const shots = [round(g), round(g), round(g), round(g)];
  advance(g, 20);
  g.aim = { x: 900, y: 450 };
  g.stasis.release(shots);
  for (const s of shots) {
    const cross = s.vel.x * (g.aim.y - s.pos.y) - s.vel.y * (g.aim.x - s.pos.x);
    assert(Math.abs(cross) < 0.001);
  }
  g.stasis.hit(shots[0]);
  g.stasis.hit(shots[2]);
  assert.equal(g.stasis.damage(shots[3]), 1.25, 'the second missed round breaks the streak');
  assert.equal(g.stasis.damage(shots[3]), 1, 'piercing/returning cannot reuse the finisher');
});
test('Tripline and Chain Release trigger once through clear space, respect cover and expire', () => {
  const g = fixture(['suspension', 'tripline', 'chain-release']);
  const a = round(g),
    b = round(g);
  advance(g, 20);
  assert.equal(a.stasis?.phase, 'parked');
  const e = target(g, a.pos.x + 100, 300);
  wall(g, a.pos.x + 70, 300, 20, 200);
  advance(g);
  assert.equal(a.stasis?.phase, 'parked');
  assert.equal(b.stasis?.phase, 'parked');
  const obstacle = g.terrain.at(-1)!;
  Composite.remove(g.engine.world, obstacle);
  g.terrain.pop();
  advance(g);
  assert.equal(a.stasis?.phase, 'released');
  assert.equal(b.stasis?.phase, 'released');
  advance(g, 20);
  assert(e.hp < e.maxHp);
  const lonely = round(g, { pos: { x: 200, y: 100 } });
  advance(g, 260);
  assert(!g.shots.includes(lonely));
  assert.equal(g.stasis.stock.length, 0);
});
test('parked rounds cannot reflect enemy fire or build Drop Forge gravity while suspended', () => {
  const g = fixture(['suspension', 'countershot', 'mass-driver', 'drop-forge']);
  const s = round(g);
  advance(g, 20);
  const hostile = round(g, { friendly: false, pos: { ...s.pos }, vel: { x: 1, y: 0 } });
  advance(g);
  assert(!hostile.friendly);
  assert.equal(s.massDriver?.forge?.gravity, 0);
  g.stasis.release([s]);
  assert(s.massDriver);
  assert.equal(s.stasis?.phase, 'released');
});
test('pause does not launch a stored volley; room entry and terminal modes clear room-local state', () => {
  const g = fixture(['suspension', 'coolant-rounds']);
  const s = round(g);
  advance(g, 20);
  g.stasis.held = true;
  g.setMode('paused');
  tick(g);
  assert.equal(s.stasis?.phase, 'parked');
  g.setMode('playing');
  tick(g);
  assert.equal(s.stasis?.phase, 'parked');
  g.cryogenic.state(target(g));
  g.setMode('dead');
  assert.equal(g.stasis.stock.length, 0);
  assert.equal(g.cryogenic.states.size, 0);
  assert.equal(g.stasis.releases.size, 0);
});

test('Retrace follows a bank in reverse, cannot replenish banks, and damages the outward target again', () => {
  const g = fixture(['recall', 'retrace', 'ricochet', 'pierce']);
  Body.setPosition(g.player, { x: 200, y: 180 });
  wall(g, 520, 300, 20, 300);
  const e = target(g, 455, 280);
  const s = round(g, { pos: { x: 350, y: 200 }, vel: { x: 24, y: 18 }, pierce: 10 });
  let banked = false,
    returned = false;
  for (let frame = 0; frame < 100 && s.life > 0; frame++) {
    advance(g);
    banked ||= s.banks > 0;
    returned ||= !!s.recall?.returning;
  }
  assert(banked && returned);
  assert(s.bounces <= 1);
  assert.equal(s.banks, 1);
  assert(e.hp < e.maxHp);
  assert(s.life <= 0);
});
test('Retrace reuses linked portal crossings without sweeping damage across the teleport gap', () => {
  const g = fixture(['recall', 'retrace', 'fold', 'pierce']);
  assert(g.portals.place({ x: 600, y: 740 }));
  assert(g.portals.place({ x: 1100, y: 740 }));
  const gap = target(g, 850, 700);
  const s = round(g, { pos: { x: 600, y: 680 }, vel: { x: 0, y: 25 }, pierce: 10 });
  let crossed = false,
    returned = false;
  for (let i = 0; i < 60 && s.life > 0; i++) {
    advance(g);
    crossed ||= s.pos.x > 1000;
    returned ||= crossed && !!s.recall?.returning && s.pos.x < 700;
  }
  assert(crossed && returned);
  assert.equal(gap.hp, gap.maxHp);
});
test('Retrace stops at newly inserted cover and cannot replay a rewired portal', () => {
  for (const changed of ['cover', 'portal']) {
    const g = fixture(['recall', 'retrace', 'fold', 'rewire']);
    assert(g.portals.place({ x: 600, y: 740 }));
    assert(g.portals.place({ x: 1100, y: 740 }));
    const s = round(g, { pos: { x: 600, y: 680 }, vel: { x: 0, y: 25 } });
    advance(g, 8);
    assert(s.pos.x > 1000);
    if (changed === 'portal') assert(g.portals.place({ x: 1500, y: 740 }));
    else wall(g, 1100, 680, 100, 15);
    advance(g, 80);
    assert(s.life <= 0);
  }
});

test('Air Brake uses a real trigger release, once per jump, and grants one stronger launch', () => {
  const g = fixture(['kick', 'air-brake']);
  target(g, 1500);
  tick(g, { fire: true });
  const speed = Math.abs(g.player.velocity.x);
  tick(g);
  assert(g.mobility.brakeUsed && g.mobility.launchReady);
  assert(Math.abs(g.player.velocity.x) < speed * 0.5);
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.fireRound();
  assert(Math.abs(g.player.velocity.x) > g.gun.recoil * 1.3);
  assert(!g.mobility.launchReady);
  g.mobility.update(input(g, { fire: true }));
  g.mobility.update(input(g));
  assert(!g.mobility.launchReady);
  g.grounded = true;
  g.mobility.update(input(g));
  assert(!g.mobility.brakeUsed);
});
test('Wallrunner requires recoil into a wall and a new surface before regripping it', () => {
  const g = fixture(['light', 'wallrunner']);
  wall(g, 170, 300, 20, 500);
  Body.setPosition(g.player, { x: 194, y: 300 });
  g.mobility.update(input(g));
  assert.equal(g.mobility.grip, null);
  g.mobility.shot({ x: 1, y: 0 });
  g.mobility.update(input(g));
  assert(g.mobility.grip);
  g.jumpBuffer = 0.1;
  g.mobility.update(input(g, { jump: true }));
  assert(g.player.velocity.x > 0 && g.player.velocity.y < 0);
  assert.equal(g.mobility.grip, null);
  g.mobility.shot({ x: 1, y: 0 });
  g.mobility.update(input(g));
  assert.equal(g.mobility.grip, null);
  wall(g, 300, 300, 20, 500);
  Body.setPosition(g.player, { x: 276, y: 300 });
  g.mobility.update(input(g));
  g.mobility.shot({ x: -1, y: 0 });
  g.mobility.update(input(g));
  assert(g.mobility.grip);
  g.time += 0.4;
  g.mobility.update(input(g));
  assert.equal(g.mobility.grip, null);
});
test('new test presets retry exactly and never write campaign saves or unlock encounters', () => {
  for (const build of [
    'icebreaker',
    'coldfront',
    'crosshatch',
    'tripline',
    'retrace',
    'wallrunner',
    'airbrake',
  ]) {
    const save = branchTestFromUrl(new URL('https://test/?test=branches&build=' + build))!;
    assert(save && loadCheckpoint(save));
    const g = fixture([]);
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.onBossDefeated = () => writes++;
    g.startTest(save);
    g.save();
    g.startTest(g.testRun!);
    assert.deepEqual(g.mods, save.mods);
    assert.equal(writes, 0);
  }
});

test('the actual Crosshatch finisher arrives after the converging volley and earns its damage', () => {
  const g = fixture(['suspension', 'crosshatch', 'thread-the-needle', 'scatter']);
  const e = target(g, 800, 300);
  g.aim = { ...e.body.position };
  g.stasis.held = true;
  g.fireRound();
  const expected = g.shots.reduce((sum, s) => sum + s.damage, 0);
  advance(g, 20);
  assert.equal(g.stasis.stock.length, 5);
  const hp = e.hp;
  g.stasis.input(false);
  assert.equal(g.shots.filter((s) => s.stasis?.phase === 'queued').length, 1);
  advance(g, 50);
  assert(hp - e.hp > expected * 1.15, String(hp - e.hp));
  assert(hp - e.hp <= expected * 1.21);
});

test('ordinary early enemies can actually freeze before the base gun kills them', () => {
  const g = fixture(['coolant-rounds', 'deep-freeze']);
  const e = target(g);
  e.hp = e.maxHp = 70;
  for (let i = 0; i < 3; i++) hit(g, e);
  assert(e.hp > 0 && g.cryogenic.frozen(e));
});

test('Deep Freeze improves boss cold damage even though bosses cannot be frozen', () => {
  const damage = [[], ['deep-freeze']].map((extra) => {
    const g = fixture(['coolant-rounds', ...extra]);
    const e = target(g, 600, 300, 'loader');
    for (let i = 0; i < 4; i++) hit(g, e);
    assert(!g.cryogenic.frozen(e));
    return e.maxHp - e.hp;
  });
  assert(damage[1] > damage[0]);
});

test('Retrace hits an enemy once outward and once on its recorded return', () => {
  const g = fixture(['recall', 'retrace', 'pierce', 'homecoming']);
  const e = target(g, 500, 300);
  let hits = 0;
  const original = g.hitEnemy.bind(g);
  g.hitEnemy = (enemy, damage, from, feedback) => {
    if (enemy === e) hits++;
    return original(enemy, damage, from, feedback);
  };
  const s = round(g);
  advance(g, 100);
  assert.equal(hits, 2);
  assert(s.life <= 0);
});

test('Air Brake works with a continuous beam and pause cannot manufacture a brake', () => {
  const g = fixture(['deadeye', 'cutting-torch', 'kick', 'air-brake']);
  target(g, 1500);
  Body.setPosition(g.player, { x: 1000, y: 300 });
  for (let i = 0; i < 12; i++) tick(g, { fire: true });
  g.setMode('paused');
  g.setMode('playing');
  tick(g);
  assert(!g.mobility.brakeUsed);
  for (let i = 0; i < 12; i++) tick(g, { fire: true });
  tick(g);
  assert(g.mobility.brakeUsed && g.mobility.launchReady);
  for (let i = 0; i < Math.ceil(g.gun.interval * 60) + 1 && g.mobility.launchReady; i++)
    tick(g, { fire: true });
  assert(!g.mobility.launchReady);
});

test('cold and parked ammunition leave live boss attacks and hostile projectiles active', () => {
  for (const build of ['icebreaker', 'crosshatch', 'tripline']) {
    const g = fixture([]);
    g.startTest(
      branchTestFromUrl(new URL(`https://test/?test=branches&build=${build}&room=boss`))!,
    );
    const boss = g.enemies.find((e) => e.kind === 'interceptor')!;
    let attacked = false,
      hostile = false;
    for (let frame = 0; frame < 1200 && g.mode === 'playing'; frame++) {
      tick(g, { fire: frame % 90 < 70, aim: { ...boss.body.position } });
      attacked ||= boss.attacks > 0 || boss.state === 'recover';
      hostile ||= g.shots.some((s) => !s.friendly);
    }
    assert(attacked && hostile, build);
    assert(g.hp < 100, build + ' cannot neutralize the boss by holding fire in place');
    assert.equal(g.cryogenic.slow(boss), 1);
    assert(!g.cryogenic.frozen(boss));
  }
});
