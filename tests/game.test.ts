import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, WORLD } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import { getGun, MODS, distance, STAGES } from '../src/rules.ts';
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
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
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
    Body.setPosition(g.player, { x: 1910, y: 700 });
    tick(g);
    assert.equal(g.mode, 'playing');
    for (const e of [...g.enemies]) g.hitEnemy(e, 9999);
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
  assert.equal(g.mode, 'won');
  assert.equal(g.mods.length, STAGES - 1);
  assert.equal(saves, STAGES - 1);
  assert(cleared);
});
test('checkpoint reconstructs the same modified gun and fresh room', () => {
  const g = new Game();
  g.start('saved', {
    version: 3,
    seed: 'saved',
    stage: 3,
    hp: 56,
    mods: ['scatter', 'rapid', 'kick'],
    kills: 17,
    elapsed: 40,
  });
  assert.equal(g.hp, 56);
  assert.equal(g.stage, 3);
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
for (const seed of ['A', 'D'])
  test('a combat run reaches the final exit with normal health and real input: ' + seed, () => {
    const g = new Game();
    g.start(seed);
    let previousX = 140,
      stuck = 0,
      lastProgress = 0,
      lastKills = 0,
      clearAt = -1;
    const priority = [
      'leech',
      'magnum',
      'scatter',
      'rapid',
      'airshot',
      'pierce',
      'ricochet',
      'light',
      'split',
      'kick',
    ];
    for (let i = 0; i < 60 * 240 && g.mode !== 'dead' && g.mode !== 'won'; i++) {
      if (g.mode === 'upgrade') {
        g.chooseMod(
          [...g.offers].sort((a, b) => priority.indexOf(a.id) - priority.indexOf(b.id))[0].id,
        );
        clearAt = -1;
        lastProgress = g.time;
        stuck = 0;
        previousX = g.player.position.x;
      }
      const p = g.player.position,
        e = [...g.enemies].sort(
          (a, b) => distance(a.body.position, p) - distance(b.body.position, p),
        )[0];
      const ep = e?.body.position ?? { x: 1910, y: 700 },
        lead = distance(p, ep) / 30,
        dx = ep.x - p.x,
        dy = p.y - ep.y;
      let aim = {
        x: ep.x + (e?.body.velocity.x ?? 0) * lead,
        y: ep.y + (e?.body.velocity.y ?? 0) * lead,
      };
      stuck = Math.abs(p.x - previousX) < 0.5 ? stuck + 1 : 0;
      previousX = p.x;
      let move = g.clear
        ? p.x < 1910
          ? 1
          : p.x > 1960
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
      const navigate = !g.clear && g.time - lastProgress > 8 && distance(p, ep) > 500;
      const path = g.level.route;
      const way = navigate
        ? dx > 0
          ? path.find((q) => q.x > p.x + 35)
          : [...path].reverse().find((q) => q.x < p.x - 35)
        : undefined;
      if (way) move = way.x > p.x ? 1 : -1;
      const blocked =
        !!move && Query.ray(g.terrain, p, { x: p.x + move * 65, y: p.y }, 20).length > 0;
      const lift =
        (!navigate && ((!g.clear && dy > 70 && Math.abs(dx) < 500) || (blocked && stuck > 20))) ||
        !!(navigate && way && p.y - way.y > 75 && !g.grounded && stuck > 15);
      let jump = g.grounded && (i % 90 === 0 || blocked || stuck > 15 || lift);
      if (lift && !g.grounded) aim = { x: p.x, y: p.y + 500 };
      if (g.clear) {
        if (clearAt < 0) clearAt = g.time;
        assert(g.time - clearAt < 35, `Exit unreachable in ${g.level.id}`);
        jump = g.grounded && (blocked || stuck > 15);
      }
      if (way && p.y - way.y > 50 && g.grounded) jump = true;
      tick(g, 1, {
        left: move < 0,
        right: move > 0,
        jump,
        fire: (!g.clear && !navigate) || (lift && !g.grounded),
        aim,
      });
    }
    assert.equal(g.mode, 'won');
    assert.equal(g.stage, STAGES - 1);
    assert.equal(g.mods.length, STAGES - 1);
    assert(g.hp > 0);
  });
