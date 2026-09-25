import { playCampaign } from './campaign-pilot.ts';
import { dodgePilot } from './combat-pilot.ts';
import { pressurePilot } from './pressure-pilot.ts';
import { CRAWLER } from '../src/wallcrawler.ts';
import { overtimeTestFromUrl } from '../src/practice.ts';
import { freightPilot } from './freight-pilot.ts';
import { FREIGHT } from '../src/freight-layout.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, WORLD, EXTRACTION_DURATION } from '../src/game.ts';
import { EXTRACTION } from '../src/escape-layout.ts';
import { CRANE_LOCK } from '../src/crane-ai.ts';
import type { Input } from '../src/game.ts';
import { getGun, MODS, distance, STAGES, availableMods, isSalvage, seeded } from '../src/rules.ts';
const { Body, Composite, Query } = Matter;
const input = (p: Partial<Input> = {}): Input => ({
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1000, y: 680 },
  ...p,
});
function tick(g: Game, n = 1, p: Partial<Input> = {}) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, input(p));
}
function clean(g: Game, platforms = false) {
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  if (platforms) {
    for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
    g.terrain = g.terrain.slice(0, 4);
  }
}
function ready() {
  const g = new Game();
  g.start('physics');
  clean(g, true);
  tick(g, 60);
  return g;
}
test('movement accelerates promptly and stops cleanly on the floor', () => {
  const g = ready(),
    x = g.player.position.x;
  assert(g.grounded);
  tick(g, 20, { right: true });
  assert(g.player.position.x > x + 95);
  tick(g, 20);
  assert(Math.abs(g.player.velocity.x) < 0.15);
  assert.equal(g.player.inertia, Infinity);
});
test('held jumps are taller than taps, and downward shots add substantial lift', () => {
  const heights = [false, true, 'recoil'].map((kind) => {
    const g = ready(),
      start = g.player.position.y;
    let min = start;
    for (let i = 0; i < 100; i++) {
      tick(g, 1, {
        jump: i === 0,
        jumpHeld: kind !== false || i === 0,
        fire: kind === 'recoil' && i < 60,
        aim: { x: g.player.position.x, y: 1000 },
      });
      min = Math.min(min, g.player.position.y);
    }
    return start - min;
  });
  assert(heights[0] > 45 && heights[0] < 120);
  assert(heights[1] > heights[0] + 70);
  assert(heights[2] > heights[1] + 180);
});
test('airborne recoil is much stronger and steering retains boosted momentum', () => {
  const ground = ready();
  Body.setVelocity(ground.player, { x: 0, y: 0 });
  ground.aim = { x: 1000, y: ground.player.position.y };
  ground.fire();
  const groundKick = Math.abs(ground.player.velocity.x);
  const air = ready();
  Body.setPosition(air.player, { x: 1000, y: 200 });
  Body.setVelocity(air.player, { x: 0, y: 0 });
  air.grounded = false;
  air.aim = { x: 1500, y: 200 };
  air.fire();
  assert(Math.abs(air.player.velocity.x) > groundKick * 4);
  Body.setVelocity(air.player, { x: 16, y: 0 });
  tick(air, 8, { right: true });
  assert(air.player.velocity.x > 14);
});
test('firing has camera impulse and short muzzle flash which settle afterward', () => {
  const g = ready();
  g.fire();
  assert(g.shake >= 2);
  assert(g.muzzle > 0);
  assert(Math.abs(g.kick.x) > 0);
  tick(g, 30);
  assert(g.shake < 0.01);
  assert.equal(g.muzzle, 0);
});
test('the one gun fires indefinitely and scatter adds one recoil impulse per trigger', () => {
  const g = ready();
  tick(g, 600, { fire: true });
  assert(g.shotCount > 40);
  g.mods = ['scatter'];
  g.gun = getGun(g.mods);
  g.grounded = false;
  g.shots = [];
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.aim = { x: g.player.position.x + 300, y: g.player.position.y };
  g.fire();
  assert.equal(g.shots.length, 5);
  assert(Math.abs(g.player.velocity.x + g.gun.recoil) < 0.001);
});
test('a jump tap survives a kill impact pause', () => {
  const g = ready();
  g.hitStop = 0.035;
  tick(g, 1, { jump: true });
  tick(g, 4);
  assert(g.player.velocity.y < -8);
});
test('a quick click survives an impact pause and fires exactly once', () => {
  const g = ready();
  g.hitStop = 0.035;
  tick(g, 1, { firePressed: true, fire: false });
  tick(g, 10);
  assert.equal(g.shotCount, 1);
});
test('upgrade offers depend on the seed and room, not shots fired', () => {
  const a = ready(),
    b = ready();
  tick(a, 120, { fire: true });
  a.openReward();
  b.openReward();
  assert.deepEqual(a.offers, b.offers);
});
test('fresh runs reset jump release timing and keep the first recoil boost', () => {
  const g = ready();
  g.jumpAt = 100;
  g.start('fresh');
  clean(g, true);
  Body.setPosition(g.player, { x: 900, y: 250 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  tick(g, 1, { fire: true, jumpHeld: false, aim: { x: 900, y: 1000 } });
  const initial = g.player.velocity.y;
  tick(g, 1, { jumpHeld: false });
  assert.equal(g.jumpAt, -100);
  assert(g.player.velocity.y < initial * 0.8);
});
test('boundary containment cancels outward speed and preserves tangential momentum', () => {
  const g = ready();
  Body.setPosition(g.player, { x: -4, y: 200 });
  Body.setVelocity(g.player, { x: -15, y: -8 });
  g.containPlayer();
  assert(g.player.vertices.every((v) => v.x >= -0.01));
  assert.equal(g.player.velocity.x, 0);
  assert.equal(g.player.velocity.y, -8);
  Body.setPosition(g.player, { x: 500, y: -4 });
  Body.setVelocity(g.player, { x: 12, y: -18 });
  g.containPlayer();
  assert(g.player.vertices.every((v) => v.y >= -0.01));
  assert.equal(g.player.velocity.x, 12);
  assert.equal(g.player.velocity.y, 0);
});
test('piercing rounds hit successive enemies while cover stops a normal round', () => {
  const g = ready();
  g.spawnEnemy('shooter', 800, 350);
  g.spawnEnemy('shooter', 845, 350);
  for (const e of g.enemies) e.spawn = 0;
  const enemies = [...g.enemies];
  g.addShot({
    pos: { x: 760, y: 350 },
    vel: { x: 130, y: 0 },
    damage: 20,
    life: 2,
    friendly: true,
    radius: 2,
    bounces: 0,
    pierce: 2,
    fragment: false,
    split: false,
  });
  g.updateShots(1 / 60);
  assert(enemies.every((e) => e.hp < e.maxHp));
  assert.equal(enemies[0].maxHp - enemies[0].hp, 20);
  const wall = Matter.Bodies.rectangle(950, 350, 4, 100, { isStatic: true });
  Composite.add(g.engine.world, wall);
  g.terrain.push(wall);
  g.spawnEnemy('shooter', 1000, 350);
  const target = g.enemies.at(-1)!;
  target.spawn = 0;
  g.shots = [];
  g.addShot({
    pos: { x: 900, y: 350 },
    vel: { x: 150, y: 0 },
    damage: 30,
    life: 2,
    friendly: true,
    radius: 2,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
  g.updateShots(1 / 60);
  assert.equal(target.hp, target.maxHp);
  assert.equal(g.shots.length, 0);
});
test('splinter rounds split only once and fragments never recurse', () => {
  const g = ready();
  g.mods = ['split'];
  g.gun = getGun(g.mods);
  g.fire();
  const s = g.shots[0];
  g.splitShot(s);
  assert.equal(g.shots.length, 4);
  g.splitShot(s);
  for (const fragment of g.shots.filter((s) => s.fragment)) g.splitShot(fragment);
  assert.equal(g.shots.length, 4);
});
test('damage grants brief immunity and lethal damage freezes the run', () => {
  const g = ready();
  let cleared = false;
  g.onCheckpoint = (s) => {
    if (!s) cleared = true;
  };
  g.damagePlayer(20);
  g.damagePlayer(20);
  assert.equal(g.hp, 80);
  g.time += 0.76;
  g.damagePlayer(999);
  assert.equal(g.mode, 'dead');
  assert(cleared);
  const elapsed = g.elapsed,
    shots = g.shotCount;
  tick(g, 100, { right: true, fire: true });
  assert.equal(g.elapsed, elapsed);
  assert.equal(g.shotCount, shots);
});
test('cleared exits advance automatically and choices modify the same gun', () => {
  const g = new Game();
  g.start('progress');
  let saves = 0,
    rewardsSaved = 0,
    reforgeSaves = 0,
    cleared = false;
  g.onCheckpoint = (s) => {
    if (s?.reward) rewardsSaved++;
    else if (s?.reforgeRoom) reforgeSaves++;
    else if (s) saves++;
    else cleared = true;
  };
  for (let stage = 0; stage < STAGES; stage++) {
    assert.equal(g.stage, stage);
    Body.setPosition(g.player, g.freight.active ? { x: 1000, y: 682 } : { x: 1910, y: 700 });
    tick(g);
    assert.equal(g.mode, 'playing');
    for (let i = 0; i < (g.freight.active ? 3000 : 300) && !g.clear; i++) {
      for (const e of [...g.enemies]) g.hitEnemy(e, 9999);
      tick(g);
    }
    assert(g.clear, 'The room did not finish after defeating both groups');
    if (g.freight.active) {
      Body.setPosition(g.player, { x: 1910, y: FREIGHT.dock - 18 });
      Body.setVelocity(g.player, { x: 0, y: 0 });
    }
    tick(g, 40);
    if (stage < STAGES - 1) {
      assert.equal(g.mode, 'upgrade');
      assert.equal(g.offers.length, 3);
      const id = g.offers[0].id;
      g.chooseMod(id);
      assert(g.mods.includes(id));
      assert.deepEqual(g.gun, getGun(g.mods));
      assert.equal(g.mode, 'playing');
      const count = g.mods.length;
      g.chooseMod(id);
      assert.equal(g.mods.length, count);
    }
  }
  assert.equal(g.mode, 'playing');
  assert.equal(g.escape?.phase, 'route');
  assert.equal(g.mods.length, STAGES - 1);
  assert.equal(saves, STAGES);
  assert.equal(reforgeSaves, g.reforge.state ? 1 : 0);
  assert.equal(rewardsSaved, STAGES - 1);
  assert(!cleared);
  Body.setPosition(g.player, { x: EXTRACTION.x, y: EXTRACTION.y - 18 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  tick(g, 3);
  assert.equal(g.escape?.phase, 'extracting');
  tick(g, Math.ceil(EXTRACTION_DURATION * 60) + 3);
  assert.equal(g.mode, 'won');
  assert(cleared);
});
test('checkpoint reconstructs the same modified gun and fresh room', () => {
  const g = new Game();
  g.start('saved', {
    version: 5,
    seed: 'saved',
    stage: 4,
    hp: 56,
    mods: ['scatter', 'rapid', 'kick'],
    kills: 17,
    elapsed: 40,
  });
  assert.equal(g.hp, 56);
  assert.equal(g.stage, 4);
  assert.equal(g.gun.pellets, 5);
  assert(g.gun.interval < 0.22);
  assert.equal(g.shots.length, 0);
  assert.equal(Composite.allConstraints(g.engine.world).length, 0);
});
test('extreme recoil combos remain inside the arena with bounded effects', () => {
  for (const mods of [
    MODS.map((m) => m.id),
    ['magnum', 'scatter', 'rapid', 'kick', 'split'],
    ['rapid', 'scatter', 'ricochet', 'pierce', 'split'],
  ]) {
    const g = new Game();
    g.start('stress');
    g.stage = STAGES - 1;
    g.loadRoom();
    g.mods = mods;
    g.gun = getGun(mods);
    g.enemies[0].hp = 1e9;
    for (let i = 0; i < 1800; i++) {
      g.hurtAt = g.time;
      const p = g.player.position;
      tick(g, 1, {
        left: i % 240 >= 120,
        right: i % 240 < 120,
        jump: g.grounded && i % 40 === 0,
        fire: true,
        aim: { x: p.x + Math.cos(i * 0.02) * 600, y: p.y + Math.sin(i * 0.02) * 600 },
      });
      assert.equal(g.mode, 'playing');
      assert(g.player.vertices.every((v) => v.x >= -0.01 && v.x <= WORLD.width + 0.01));
      assert(g.player.vertices.every((v) => v.y >= -0.01 && v.y <= WORLD.floor + 0.01));
      assert(g.shots.length <= 180);
      assert(g.particles.length <= 220);
    }
    for (const b of Composite.allBodies(g.engine.world))
      assert(Number.isFinite(b.position.x) && Number.isFinite(b.position.y));
  }
});
// Keep representative builds covering each path as the route expands.
// Only offers are scripted: every upgrade is earned through an actual room clear.
// New builds below exercise every new mechanic. Weighted pool/retry coverage lives in build-paths and daily.
for (const { seed, pressSpacing, pathMods, rewards, overtimeRun, fusion, highRoads } of [
  {
    seed: 'path-run-65',
    pressSpacing: 220,
    pathMods: ['wrecking-ball', 'flashpoint', 'slipstream'],
    rewards: [
      'leech',
      'airshot',
      'magnum',
      'ramjet',
      'crossfire',
      'rapid',
      'scatter',
      'cinder',
      'light',
      'kick',
      'burst',
      'crosswind',
      'wrecking-ball',
      'flashpoint',
      'slipstream',
      'backblast',
      'bloom',
      'convergence',
      'redline',
    ],
  },
  {
    seed: 'path-run-65',
    pressSpacing: 220,
    pathMods: ['ramjet', 'cinder', 'crosswind'],
    rewards: [
      'leech',
      'airshot',
      'magnum',
      'ramjet',
      'crossfire',
      'rapid',
      'scatter',
      'cinder',
      'light',
      'kick',
      'burst',
      'crosswind',
      'pierce',
      'backblast',
      'bloom',
      'convergence',
      'redline',
      'countershot',
      'reprisal',
    ],
  },
  {
    seed: 'path-run-65',
    pressSpacing: 220,
    pathMods: ['arc-coil', 'daisy-chain', 'crossfire'],
    rewards: [
      'leech',
      'airshot',
      'arc-coil',
      'crossfire',
      'rapid',
      'daisy-chain',
      'magnum',
      'scatter',
      'light',
      'kick',
      'burst',
      'pierce',
      'backblast',
      'bloom',
      'convergence',
      'redline',
      'capacitor',
      'countershot',
      'reprisal',
    ],
  },
  {
    seed: 'path-run-65',
    pressSpacing: 220,
    pathMods: ['tether', 'snapback', 'crossfire'],
    rewards: [
      'leech',
      'airshot',
      'tether',
      'crossfire',
      'rapid',
      'snapback',
      'magnum',
      'scatter',
      'light',
      'kick',
      'burst',
      'pierce',
      'backblast',
      'bloom',
      'convergence',
      'redline',
      'capacitor',
      'countershot',
      'reprisal',
    ],
  },
  {
    seed: 'path-run-65',
    pressSpacing: 160,
    fusion: 'rail-spike',
    pathMods: ['deadeye', 'execute', 'rail-spike'],
    rewards: [
      'pierce',
      'airshot',
      'leech',
      'deadeye',
      'burst',
      'execute',
      'magnum',
      'capacitor',
      'rail-spike',
      'rapid',
      'kick',
      'scatter',
      'light',
      'ricochet',
      'split',
      'landing',
      'redline',
      'reserve-cell',
      'backblast',
    ],
  },
  {
    seed: 'path-run-66',
    pressSpacing: 230,
    fusion: 'orbit',
    pathMods: ['crossfire', 'bloom', 'orbit'],
    rewards: [
      'magnum',
      'rapid',
      'leech',
      'ricochet',
      'banker',
      'burst',
      'airshot',
      'crossfire',
      'recall',
      'orbit',
      'bloom',
      'scatter',
      'kick',
      'pierce',
      'light',
      'split',
      'homecoming',
      'afterimage',
      'parallax',
    ],
  },
  {
    seed: 'path-run-65',
    pressSpacing: 160,
    fusion: 'implosion',
    pathMods: ['shellshock', 'aftershock', 'blast-surf', 'chain-reaction', 'implosion'],
    rewards: [
      'leech',
      'airshot',
      'magnum',
      'shellshock',
      'aftershock',
      'blast-surf',
      'chain-reaction',
      'fuse',
      'implosion',
      'light',
      'countershot', // Defensive counterfire supports the slow planted-shell build.
      'scatter',
      'ricochet',
      'rapid',
      'pierce',
      'burst',
      'banker',
      'linked-fuse',
      'shockfront',
    ],
  },
  {
    seed: 'OVERTIME-40',
    pressSpacing: 240,
    pathMods: ['deadeye', 'execute'],
    overtimeRun: true,
    rewards: [
      'burst',
      'rail-spike',
      'deadlock',
      'countershot',
      'reprisal',
      'banker',
      'backfire',
      'shatter',
      'breach',
      'tether',
      'snapback',
      'fold',
      'rewire',
      'slingshot',
      'recall',
      'homecoming',
      'arc-coil',
      'daisy-chain',
      'grindshot',
    ],
  },
  {
    seed: 'path-run-65',
    pressSpacing: 160,
    pathMods: ['deadeye', 'execute'],
    rewards: [
      'pierce',
      'airshot',
      'leech',
      'deadeye',
      'burst',
      'execute',
      'magnum',
      'rapid',
      'kick',
      'scatter',
      'light',
      'ricochet',
      'split',
      'landing',
      'redline',
    ],
  },
  {
    seed: 'path-run-66',
    pressSpacing: 230,
    pathMods: ['crossfire', 'bloom'],
    rewards: [
      'magnum',
      'rapid',
      'leech',
      'ricochet',
      'banker',
      'burst',
      'airshot',
      'crossfire',
      'bloom',
      'scatter',
      'kick',
      'pierce',
      'light',
      'split',
      'landing',
    ],
  },
  {
    seed: 'path-run-93',
    highRoads: [1, 5, 9, 13, 17],
    pressSpacing: 160,
    pathMods: ['deadeye', 'execute'],
    rewards: [
      'magnum',
      'rapid', // Aerial rooms reward frequent corrections before committing to Precision.
      'leech',
      'deadeye',
      'execute',
      'airshot',
      'ricochet',
      'banker',
      'scatter',
      'burst',
      'kick',
      'pierce',
      'light',
      'split',
      'redline',
    ],
  },
  {
    seed: 'path-run-65',
    pressSpacing: 160,
    pathMods: ['shellshock', 'aftershock', 'blast-surf', 'chain-reaction'],
    highRoads: [13],
    rewards: [
      'leech',
      'airshot',
      'magnum',
      'shellshock',
      'aftershock',
      'blast-surf',
      'chain-reaction',
      'light', // Take steering before the moving Reclaimer; earn Landing gear afterward.
      'countershot',
      'scatter',
      'rapid', // Shorten recovery before the Condenser can flank the old cover pocket.
      'reprisal',
      'pierce',
      'burst',
      'ricochet',
      'banker',
    ],
  },
  {
    seed: 'path-run-65',
    pressSpacing: 160,
    pathMods: ['deadeye', 'execute', 'rivet', 'fracture', 'capacitor', 'reserve-cell'],
    highRoads: [1, 5, 9, 13, 17],
    rewards: [
      'magnum',
      'airshot',
      'leech',
      'deadeye',
      'rivet',
      'fracture',
      'rapid',
      'capacitor',
      'reserve-cell',
      'execute',
      'kick',
      'scatter',
      'burst',
      'light',
      'pierce',
    ],
  },
  {
    // Updated full-run fixture for the changing Loader arena. The base and
    // Orbit builds still exercise path-run-66; every build must reach extraction.
    seed: 'path-run-65',
    pressSpacing: 230,
    pathMods: [
      'crossfire',
      'afterimage',
      'parallax',
      'recall',
      'homecoming',
      'countershot',
      'reprisal',
    ],
    rewards: [
      'magnum',
      'rapid',
      'leech',
      'crossfire',
      'afterimage',
      'parallax',
      'airshot',
      'scatter',
      'burst',
      'countershot',
      'reprisal',
      'kick',
      'pierce',
      'recall',
      'homecoming',
    ],
  },
  {
    seed: 'path-run-65',
    pressSpacing: 220,
    pathMods: [
      'shellshock',
      'aftershock',
      'blast-surf',
      'chain-reaction',
      'fuse',
      'linked-fuse',
      'shockfront',
    ],
    rewards: [
      'leech',
      'airshot',
      'magnum',
      'shellshock',
      'fuse',
      'aftershock',
      'rapid',
      'scatter',
      'light',
      'linked-fuse',
      'chain-reaction',
      'burst',
      'kick',
      'pierce',
      'blast-surf',
      'backblast',
      'redline',
      'shockfront',
      'capacitor',
    ],
  },
])
  test(`combat reaches extraction: ${seed} ${pathMods[0]}${fusion ? ' fusion ' + fusion : pathMods.length > 4 ? ' expanded build' : ''}`, (t) => {
    const random = Math.random;
    Math.random = seeded(seed + ':particles');
    t.after(() => {
      Math.random = random;
    });
    // Start from fresh-page Matter IDs: pair ordering must not depend on how
    // many bodies an earlier test created, or whether this test runs alone.
    const common = Matter.Common as typeof Matter.Common & { _nextId: number; _seed: number };
    common._nextId = 0;
    common._seed = 0;
    const g = new Game();
    g.start(seed);
    // Keep this weapon-progression battery on its original event-free course.
    // Area event combat, objectives and rewards have their own ordinary-input tests.
    g.areaEvents.state = null;
    // Keep this weapon-progression battery on its pre-Fabricator roster.
    // Dedicated ordinary-input room tests cover Fabricator combat and both layouts.
    g.fabricators.enabled = false;
    // Keep this scripted weapon-progression course stable. Story rooms have
    // separate ordinary-input clears in both orientations and traversal tests.
    g.story.state = null;
    if (overtimeRun)
      g.startTest(overtimeTestFromUrl(new URL('https://example.com/?test=overtime'))!);
    const extendedRewards = rewards && [...rewards];
    if (extendedRewards) {
      for (const id of [
        'light',
        'burst',
        'kick',
        'backblast',
        'redline',
        'backfire',
        'capacitor',
        'reserve-cell',
        'landing',
        'banker',
        'breach',
        'shatter',
      ]) {
        if (extendedRewards.length >= STAGES - 1) break;
        if (availableMods(extendedRewards).some((m) => m.id === id)) extendedRewards.push(id);
      }
      const openReward = g.openReward.bind(g);
      g.openReward = (enterDetour = false, route) => {
        openReward(enterDetour, route);
        if (extendedRewards[g.stage] === 'repair') {
          assert.deepEqual(
            g.offers.map((m) => m.id),
            ['repair'],
          );
          return;
        }
        const preferred = MODS.find((m) => m.id === extendedRewards[g.stage])!;
        if (isSalvage(preferred.id))
          assert(g.offers.includes(preferred), 'Salvage must be earned from the actual boss');
        assert(
          availableMods(g.mods, true).includes(preferred),
          `Scripted offer ${preferred?.id} is not legal at stage ${g.stage}, detour ${g.detour}, owned ${g.mods.join(',')}`,
        );
        g.offers = [preferred, ...g.offers.filter((m) => m !== preferred)].slice(0, 3);
      };
    }
    const {
      escapeSeen,
      fusionUsed,
      tetherUsed,
      arcUsed,
      flashUsed,
      slipUsed,
      cinderUsed,
      windUsed,
    } = playCampaign(g, { pathMods, fusion, extendedRewards, highRoads, pressSpacing });

    assert.equal(
      g.mode,
      'won',
      `Run stopped in ${g.level.id} at (${Math.round(g.player.position.x)}, ${Math.round(g.player.position.y)}), stage ${g.stage}, ${Math.round(g.time)}s, cause: ${JSON.stringify(g.deathCause)}, enemies: ${g.enemies.map((e) => e.kind + ':' + Math.round(e.hp)).join(', ')}, gun: ${g.mods.join(', ')}`,
    );
    assert(escapeSeen, 'The run bypassed the escape route');
    assert.equal(g.stage, STAGES - 1);
    assert.equal(g.mods.length + (g.overtime?.repairs ?? 0), STAGES - 1 + (overtimeRun ? 19 : 0));
    assert(g.mods.includes(pathMods[0]));
    for (const id of pathMods) assert(g.mods.includes(id), `Missing exercised upgrade: ${id}`);
    if (pathMods[0] === 'deadeye') assert(g.mods.includes('execute'));
    if (pathMods[0] === 'shellshock') {
      assert(g.mods.includes('aftershock'));
      assert(g.mods.includes('chain-reaction'));
    }
    assert(g.hp > 0);
    if (fusion) assert(fusionUsed, `The run never used ${fusion}`);
    if (pathMods[0] === 'tether') assert(tetherUsed, 'The run never formed a tether');
    if (pathMods[0] === 'wrecking-ball')
      assert(flashUsed && slipUsed, 'The full run must trigger firebursts and ride gusts');
    if (pathMods[0] === 'ramjet')
      assert(cinderUsed && windUsed, 'The full run must use both surface burns and wind');
    if (pathMods[0] === 'arc-coil') assert(arcUsed, 'The run never discharged Arc Coil');
  });
