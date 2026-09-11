import { dodgePilot } from './combat-pilot.ts';
import { freightPilot } from './freight-pilot.ts';
import { FREIGHT } from '../src/freight-layout.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, WORLD, EXTRACTION_DURATION } from '../src/game.ts';
import { EXTRACTION } from '../src/escape-layout.ts';
import { CRANE_LOCK } from '../src/crane-ai.ts';
import type { Input } from '../src/game.ts';
import { getGun, MODS, distance, STAGES, availableMods } from '../src/rules.ts';
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
    cleared = false;
  g.onCheckpoint = (s) => {
    if (s) saves++;
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
for (const { seed, pressSpacing, pathMods, rewards } of [
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
    pressSpacing: 160,
    pathMods: ['deadeye', 'execute'],
    rewards: [
      'magnum',
      'deadeye',
      'leech',
      'execute',
      'ricochet',
      'airshot',
      'rapid',
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
    rewards: [
      'leech',
      'airshot',
      'scatter',
      'shellshock',
      'aftershock',
      'blast-surf',
      'chain-reaction',
      'landing',
      'backblast',
      'magnum',
      'ricochet',
      'rapid',
      'pierce',
      'burst',
      'banker',
    ],
  },
  {
    seed: 'path-run-65',
    pressSpacing: 160,
    pathMods: ['deadeye', 'execute', 'rivet', 'fracture', 'capacitor', 'reserve-cell'],
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
    seed: 'path-run-66',
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
    pathMods: ['shellshock', 'aftershock', 'blast-surf', 'chain-reaction', 'fuse', 'linked-fuse'],
    rewards: [
      'leech',
      'airshot',
      'scatter',
      'shellshock',
      'fuse',
      'aftershock',
      'rapid',
      'magnum',
      'light',
      'linked-fuse',
      'chain-reaction',
      'burst',
      'kick',
      'pierce',
      'blast-surf',
    ],
  },
])
  test(`combat reaches extraction: ${seed} ${pathMods[0]}${pathMods.length > 4 ? ' expanded build' : ''}`, () => {
    const g = new Game();
    g.start(seed);
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
      g.openReward = (enterDetour = false) => {
        openReward(enterDetour);
        const preferred = MODS.find((m) => m.id === extendedRewards[g.stage])!;
        assert(availableMods(g.mods).includes(preferred), 'Scripted offer is not legal');
        g.offers = [preferred, ...g.offers.filter((m) => m !== preferred)].slice(0, 3);
      };
    }
    let previousX = 140,
      stuck = 0,
      lastProgress = 0,
      lastKills = 0,
      clearAt = -1,
      directExitReady = false,
      takingLowerRoute = false,
      escapeSeen = false,
      pressDodgeUntil = 0,
      pressDirection = 1,
      pressReacted = false,
      craneDodgeUntil = 0,
      craneDirection = 1,
      loaderDodgeUntil = 0,
      loaderDirection = 1,
      loaderReacted = false;
    const priority = [
      ...pathMods,
      'leech',
      'magnum',
      'scatter',
      'rapid',
      'airshot',
      'burst',
      'backblast',
      'banker',
      'landing',
      'pierce',
      'ricochet',
      'light',
      'split',
      'kick',
      'crossfire',
      'bloom',
      'deadeye',
      'execute',
      'fold',
    ];
    for (let i = 0; i < 60 * 900 && g.mode !== 'dead' && g.mode !== 'won'; i++) {
      if (g.escape?.phase === 'extracting') {
        tick(g);
        continue;
      }
      if (g.freight.active && g.mode === 'playing') {
        g.tick(1 / 60, freightPilot(g));
        continue;
      }
      if (g.escape && !escapeSeen) {
        escapeSeen = true;
        clearAt = -1;
        stuck = 0;
        previousX = g.player.position.x;
      }
      if (g.mode === 'upgrade') {
        g.chooseMod(
          extendedRewards?.[g.stage] ??
            [...g.offers].sort(
              (a, b) =>
                (priority.includes(a.id) ? priority.indexOf(a.id) : Infinity) -
                (priority.includes(b.id) ? priority.indexOf(b.id) : Infinity),
            )[0].id,
        );
        clearAt = -1;
        lastProgress = g.time;
        directExitReady = false;
        takingLowerRoute = false;
        stuck = 0;
        previousX = g.player.position.x;
      }
      const p = g.player.position,
        e = [...g.enemies].sort(
          (a, b) =>
            distance(a.body.position, p) +
            (distance(g.lineEnd(p, a.body.position), a.body.position) > 1 ? 800 : 0) -
            (distance(b.body.position, p) +
              (distance(g.lineEnd(p, b.body.position), b.body.position) > 1 ? 800 : 0)),
        )[0];
      const exitX = g.escape ? EXTRACTION.x : 1910;
      const ep = e?.body.position ?? { x: exitX, y: 700 },
        // Heavy shells should lead a short movement, not predict an entire
        // long flight through the target's next landing or direction change.
        lead = Math.min(
          pathMods[0] === 'shellshock' ? 15 : Infinity,
          distance(p, ep) / g.gun.projectileSpeed,
        ),
        dx = ep.x - p.x,
        dy = p.y - ep.y;
      let aim = {
        x: ep.x + (e?.body.velocity.x ?? 0) * lead,
        y: ep.y + (e?.body.velocity.y ?? 0) * lead,
      };
      stuck = Math.abs(p.x - previousX) < 0.5 ? stuck + 1 : 0;
      previousX = p.x;
      let move = g.clear
        ? p.x < exitX - (g.escape ? 10 : 0)
          ? 1
          : p.x > exitX + (g.escape ? 10 : 50)
            ? -1
            : 0
        : dx > 240
          ? 1
          : dx < -240
            ? -1
            : Math.abs(dx) < 100
              ? dx < 0
                ? 1
                : -1
              : 0;
      if (!g.clear && (p.x < 100 || p.x > 1900)) move = p.x < 100 ? 1 : -1;
      if (g.kills !== lastKills) {
        lastKills = g.kills;
        lastProgress = g.time;
      }
      if (!g.clear && g.time - lastProgress > 5) move = Math.sin(g.time * 0.65) > 0 ? 1 : -1;
      // If cover blocks a distant target, stop recoil and take the next terrain waypoint.
      const navigate = g.clear || (g.time - lastProgress > 8 && distance(p, ep) > 500);
      const path = [...g.level.route, { x: exitX, y: 720 }];
      const way = navigate
        ? dx > 0
          ? path.find((q) => q.x > p.x + 35)
          : [...path].reverse().find((q) => q.x < p.x - 35)
        : undefined;
      if (way) move = way.x > p.x ? 1 : -1;
      const blocked =
        !!move && Query.ray(g.solidBodies, p, { x: p.x + move * 65, y: p.y }, 20).length > 0;
      const lift =
        (!navigate && ((!g.clear && dy > 70 && Math.abs(dx) < 500) || (blocked && stuck > 20))) ||
        // Keep climbing until the player's feet clear the ledge, rather than
        // cutting recoil while still pressed against its vertical face.
        !!(navigate && way && p.y > way.y - 12 && !g.grounded && stuck > 15);
      let jump = g.grounded && (i % 90 === 0 || blocked || stuck > 15 || lift);
      // Direct-fire builds hop off moving ground to hold a firing lane;
      // shell builds keep their existing trajectory into nearby cover.
      if (
        !g.clear &&
        !g.gun.shellshock &&
        g.grounded &&
        g.conveyors.items.some(
          (belt) =>
            Math.abs(g.player.bounds.max.y - belt.y) < 4 && p.x >= belt.x && p.x <= belt.x + belt.w,
        )
      )
        jump = true;
      if (lift && !g.grounded) aim = { x: p.x, y: p.y + 500 };
      if (g.clear) {
        if (clearAt < 0) clearAt = g.time;
        assert(
          g.time - clearAt < 35,
          `Exit unreachable in ${g.level.id}, stage ${g.stage}, at (${Math.round(p.x)}, ${Math.round(p.y)}), props ${JSON.stringify(g.props.items.map((p) => ({ kind: p.kind, pos: p.body.position })))}`,
        );
        jump = g.grounded && (blocked || stuck > 15 || !!(way && p.y - way.y > 50));
      }
      if (way && p.y - way.y > 50 && g.grounded) jump = true;
      let firing = !g.clear && (!navigate || (lift && !g.grounded));
      const breach = g.breaches.placement,
        hatch = breach?.panels.find((rect) => rect.w > rect.h);
      if (
        g.clear &&
        breach &&
        hatch &&
        p.x > Math.min(...breach.solids.map((rect) => rect.x)) - 10 &&
        p.x < Math.max(...breach.solids.map((rect) => rect.x + rect.w)) + 10 &&
        p.y > hatch.y - 90 &&
        p.y < hatch.y + 36
      ) {
        const center = hatch.x + hatch.w / 2;
        move = Math.abs(center - p.x) > 6 ? Math.sign(center - p.x) : 0;
        jump = false;
        aim = { x: p.x, y: p.y + 300 };
        firing =
          Math.abs(center - p.x) < 35 &&
          g.breaches.panels.some((panel) => panel.rect.w > panel.rect.h);
      }
      if (e?.kind === 'press') {
        move = dx > pressSpacing ? 1 : dx < -pressSpacing ? -1 : 0;
        jump = false;
        firing = true;
        aim = { ...e.body.position };
        const pressBlocked =
          move && Query.ray(g.solidBodies, p, { x: p.x + move * 65, y: p.y }, 20).length;
        if (g.grounded && (pressBlocked || stuck > 25)) jump = true;
        if (
          e.state === 'windup' &&
          e.timer <= (e.attack === 'flak' ? 0.38 : 0.65) &&
          !pressReacted
        ) {
          pressReacted = true;
          // Continue across the locked lanes rather than reversing into old bolts.
          pressDirection = p.x < 400 ? 1 : p.x > 1600 ? -1 : pressDirection;
          pressDodgeUntil = g.time + 1.1;
          jump = g.grounded;
        }
        if (e.state !== 'windup') pressReacted = false;
        if (g.time < pressDodgeUntil) {
          move = pressDirection;
          firing = false;
        }
        if (p.x < 160 || p.x > 1840) {
          move = p.x < 160 ? 1 : -1;
          firing = false;
        }
      }
      if (
        (e && ['borer', 'sifter'].includes(e.kind) && distance(g.lineEnd(p, ep), ep) < 1) ||
        e?.kind === 'sorter' ||
        e?.kind === 'boss' ||
        e?.kind === 'condenser' ||
        e?.kind === 'turbine' ||
        e?.kind === 'interceptor'
      ) {
        const choice = dodgePilot(g, e);
        move = Number(choice.right) - Number(choice.left);
        jump = choice.jump!;
        firing = choice.fire!;
        aim = choice.aim!;
      }
      if (e?.kind === 'crane') {
        // Use the docks boss pilot's visible warning reactions. Treating these
        // bosses as ordinary shooters made survival depend on arrival timing.
        move = dx > 320 ? 1 : dx < -320 ? -1 : 0;
        if (distance(g.lineEnd(p, ep), ep) > 1) move = Math.sign(dx);
        jump =
          g.grounded &&
          ((!!move && Query.ray(g.solidBodies, p, { x: p.x + move * 65, y: p.y }, 20).length > 0) ||
            stuck > 25);
        if (e.state === 'windup' && e.timer <= CRANE_LOCK) {
          if (e.attack === 'sweep') jump ||= g.grounded;
          else {
            craneDodgeUntil = g.time + 0.65;
            craneDirection = p.x < 1000 ? 1 : -1;
          }
        }
        if (g.time < craneDodgeUntil) move = craneDirection;
        firing = e.state !== 'rush' && !(e.state === 'windup' && e.timer <= CRANE_LOCK);
        aim = { ...ep };
      }
      // Single rounds keep distance and cross locked turret lanes; spread builds
      // retain the close-range movement and projectile dodge behavior below.
      if (e?.kind === 'loader' && g.gun.pellets === 1) {
        move = dx > 320 ? 1 : dx < -320 ? -1 : 0;
        if (distance(g.lineEnd(p, ep), ep) > 1) move = Math.sign(dx);
        jump =
          g.grounded &&
          !!move &&
          Query.ray(g.solidBodies, p, { x: p.x + move * 65, y: p.y }, 20).length > 0;
        aim = { ...ep };
        firing = true;
        if (e.state === 'windup' && e.timer <= 0.38 && !loaderReacted) {
          loaderReacted = true;
          loaderDodgeUntil = g.time + 0.9;
          loaderDirection = p.x < 400 ? 1 : p.x > 1600 ? -1 : Math.sign(dx);
          jump ||= g.grounded;
        }
        if (e.state !== 'windup') loaderReacted = false;
        if (g.time < loaderDodgeUntil) {
          move = loaderDirection;
          firing = false;
        }
        if (e.state === 'rush' && Math.abs(dx) < 300) jump ||= g.grounded;
        if (p.x < 160 || p.x > 1840) {
          move = p.x < 160 ? 1 : -1;
          firing = false;
        }
      }
      if (
        !g.clear &&
        e?.kind !== 'sorter' &&
        e?.kind !== 'borer' &&
        e?.kind !== 'sifter' &&
        e?.kind !== 'boss' &&
        e?.kind !== 'condenser' &&
        e?.kind !== 'turbine' &&
        e?.kind !== 'interceptor' &&
        e?.kind !== 'press' &&
        !(e?.kind === 'loader' && g.gun.pellets === 1) &&
        e?.kind !== 'crane'
      ) {
        const threat = g.shots.find((s) => {
          if (s.friendly) return false;
          const rx = s.pos.x - p.x,
            ry = s.pos.y - p.y;
          const vx = s.vel.x - g.player.velocity.x,
            vy = s.vel.y - g.player.velocity.y;
          const t = Math.max(0, Math.min(12, -(rx * vx + ry * vy) / (vx * vx + vy * vy || 1)));
          return Math.hypot(rx + vx * t, ry + vy * t) < 38;
        });
        if (threat) {
          jump = g.grounded;
          firing = false;
          move = threat.pos.x < p.x ? 1 : -1;
        }
      }
      if (g.clear && g.canDetour && p.x > 1700 && p.y < 442) {
        const vy = g.player.velocity.y;
        const landingFrames = (-vy + Math.sqrt(vy * vy + 2 * 0.278 * (442 - p.y))) / 0.278;
        if (p.x + g.player.velocity.x * landingFrames > 1880) takingLowerRoute = true;
      }
      if (g.clear && g.canDetour && takingLowerRoute) {
        // These runs verify the direct route. Land before the fork, then
        // walk below the steps instead of accidentally selecting the upper door.
        if (g.grounded && p.y > 690) directExitReady = true;
        move = directExitReady ? 1 : Math.abs(p.x - 1760) > 8 ? Math.sign(1760 - p.x) : 0;
        jump = false;
        firing = false;
      }
      // React to the visible drop lane just as to a locked projectile warning.
      const fallingLoad = g.cargo.items.find(
        (load) =>
          (load.cargo!.state === 'warning' ||
            (load.cargo!.state === 'loose' && load.body.velocity.y > 4)) &&
          p.y > load.body.position.y &&
          Math.abs(p.x - load.body.position.x) < 100,
      );
      if (fallingLoad) {
        move = p.x < fallingLoad.body.position.x ? -1 : 1;
        jump = false;
        firing = false;
      }
      // Large shell builds coast between volleys near the edge. Continuing to
      // shoot from a corner repeatedly propels the player back into that corner.
      if (g.stage >= 12 && g.gun.shellshock && !g.clear && !g.level.boss) {
        if (distance(p, ep) > 550 && !lift) firing = false;
        if (p.x < 180 || p.x > 1820) {
          move = p.x < 1000 ? 1 : -1;
          firing = false;
        }
        if (p.y < 200) firing = false;
      }
      tick(g, 1, {
        left: move < 0,
        right: move > 0,
        jump,
        fire: firing,
        aim,
      });
    }
    assert.equal(
      g.mode,
      'won',
      `Run stopped in ${g.level.id} at (${Math.round(g.player.position.x)}, ${Math.round(g.player.position.y)}), stage ${g.stage}, ${Math.round(g.time)}s, enemies: ${g.enemies.map((e) => e.kind + ':' + Math.round(e.hp)).join(', ')}, gun: ${g.mods.join(', ')}`,
    );
    assert(escapeSeen, 'The run bypassed the escape route');
    assert.equal(g.stage, STAGES - 1);
    assert.equal(g.mods.length, STAGES - 1);
    assert(g.mods.includes(pathMods[0]));
    for (const id of pathMods) assert(g.mods.includes(id), `Missing exercised upgrade: ${id}`);
    if (pathMods[0] === 'deadeye') assert(g.mods.includes('execute'));
    if (pathMods[0] === 'shellshock') {
      assert(g.mods.includes('aftershock'));
      assert(g.mods.includes('chain-reaction'));
    }
    assert(g.hp > 0);
  });
