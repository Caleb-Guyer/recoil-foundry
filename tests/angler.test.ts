import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import {
  ANGLER,
  findAnglerPlan,
  beginAnglerAttack,
  updateAngler,
  anglerWarningPoints,
} from '../src/angler.ts';
import { addAngler } from '../src/angler-layout.ts';
import { getLevel } from '../src/levels.ts';
import { getOvertimeLevel } from '../src/overtime.ts';
import { anglerTestFromUrl } from '../src/practice.ts';
import { getGun, distance, loadCheckpoint } from '../src/rules.ts';
import { splitWaves } from '../src/reinforcements.ts';
import { squadSpawns } from '../src/squads.ts';
import { dodgePilot } from './combat-pilot.ts';
const { Body, Bodies, Composite, Query } = Matter;
const DT = 1 / 60;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1200, y: 600 },
};
function wall(g: Game, x: number, y: number, w: number, h: number) {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  return b;
}
function fixture(angle = 0) {
  const g = new Game();
  g.start('angler-fixture');
  g.waves.clear();
  g.hazards.clear();
  g.breaches.clear();
  g.destruction.clear();
  g.conveyors.clear();
  g.counterweights.clear();
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.stage = 5;
  g.mods = [];
  g.gun = getGun([]);
  g.hp = 100;
  g.engine.gravity.y = 0;
  Body.setPosition(g.player, { x: 1000, y: 600 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  const roof = wall(g, 700, 350, 700, 22);
  Body.setAngle(roof, angle);
  g.destruction.register(roof, { x: 350, y: 339, w: 700, h: 22 });
  wall(g, 700, 655, 100, 170);
  g.spawnEnemy('angler', 400, 600);
  const e = g.enemies[0];
  e.spawn = 0;
  e.timer = 0;
  return { g, e, roof };
}
function fire(f: ReturnType<typeof fixture>) {
  assert(beginAnglerAttack(f.g, f.e), 'no bank found');
  f.e.timer = 0;
  updateAngler(f.g, f.e, DT);
  const s = f.g.shots.at(-1)!;
  assert(s?.angler);
  return s;
}
function flight(g: Game, n = 160) {
  for (let i = 0; i < n && g.shots.length; i++) {
    g.time += DT;
    g.updateShots(DT);
  }
}
function preset(area = 'furnace', mirror = false, build = 'standard') {
  const p = anglerTestFromUrl(
    new URL(`https://test/?test=angler&area=${area}&mirror=${Number(mirror)}&build=${build}`),
  );
  assert(p);
  return p;
}

test('real single-bank geometry gets around low cover and hits the locked position on flat and tilted faces', () => {
  for (const angle of [0, -0.15, 0.15]) {
    const f = fixture(angle),
      plan = findAnglerPlan(f.g, f.e);
    assert(plan);
    assert.equal(plan.body, f.roof);
    assert(plan.bounce.y < 450);
    assert(plan.incoming.y < 0 && plan.outgoing.y > 0);
    const s = fire(f);
    flight(f.g);
    assert.equal(s.banks, 1);
    assert.equal(s.bounces, 0);
    assert.equal(f.g.hp, 85, `angle ${angle}`);
  }
});
test('tracking can change the path, but the final half-second locks both legs and lets a player dodge', () => {
  const f = fixture();
  assert(beginAnglerAttack(f.g, f.e));
  const original = { ...f.e.angler!.plan!.bounce };
  Body.setPosition(f.g.player, { x: 1100, y: 570 });
  f.g.time = 0.2;
  f.e.timer = 0.9;
  updateAngler(f.g, f.e, DT);
  const locked = f.e.angler!.plan!;
  assert(distance(original, locked.bounce) > 10);
  f.e.timer = ANGLER.lock;
  Body.setPosition(f.g.player, { x: 950, y: 690 });
  f.g.time = 0.8;
  updateAngler(f.g, f.e, DT);
  assert.equal(f.e.angler!.plan, locked);
  f.e.timer = 0;
  updateAngler(f.g, f.e, DT);
  flight(f.g);
  assert.equal(f.g.hp, 100);
});
test('breaking or rotating the selected face cancels the tell and exposes a solid enemy for 50% more damage', () => {
  for (const action of ['break', 'rotate', 'shift']) {
    const f = fixture();
    assert(beginAnglerAttack(f.g, f.e));
    const pos = { ...f.e.body.position };
    if (action === 'break') f.g.destruction.hitBody(f.roof, 1000, { x: 0, y: 0 });
    else if (action === 'rotate') Body.setAngle(f.roof, 0.01);
    else Body.translate(f.roof, { x: 2, y: 0 });
    updateAngler(f.g, f.e, DT);
    assert.equal(f.e.state, 'recover');
    assert.equal(f.e.angler!.plan, undefined);
    assert.equal(f.e.angler!.exposed, ANGLER.exposed);
    assert.equal(f.g.shots.length, 0);
    assert.deepEqual(f.e.body.position, pos);
    assert(!f.e.body.isSensor);
    const hp = f.e.hp;
    f.g.hitEnemy(f.e, 10);
    assert.equal(hp - f.e.hp, 15);
  }
});
test('losing the bank during flight cancels it; moving the surface after the bounce does not erase the outgoing round', () => {
  const a = fixture(),
    s = fire(a);
  Body.setAngle(a.roof, 0.01);
  flight(a.g);
  assert(s.life <= 0);
  assert.equal(a.g.hp, 100);
  assert(a.e.angler!.exposed > 0);
  const b = fixture(),
    round = fire(b);
  for (let i = 0; i < 100 && !round.angler!.banked; i++) {
    b.g.time += DT;
    b.g.updateShots(DT);
  }
  assert(round.angler!.banked);
  Body.setAngle(b.roof, 0.1);
  flight(b.g);
  assert.equal(b.g.hp, 85);
});
test('new cover clips the warning and stops a round instead of producing an unannounced bank', () => {
  const f = fixture();
  assert(beginAnglerAttack(f.g, f.e));
  const p = f.e.angler!.plan!,
    mid = { x: (p.start.x + p.bounce.x) / 2, y: (p.start.y + p.bounce.y) / 2 };
  wall(f.g, mid.x, mid.y, 30, 90);
  const warning = anglerWarningPoints(f.g, f.e);
  assert.equal(warning.length, 2);
  assert(distance(warning[1], p.start) < distance(p.bounce, p.start));
  f.e.timer = 0;
  updateAngler(f.g, f.e, DT);
  const s = f.g.shots[0];
  flight(f.g);
  assert.equal(s.banks, 0);
  assert.equal(f.g.hp, 100);
});
test('a crate or another enemy on the outgoing leg blocks the bank, and hostile rounds never inherit player effects', () => {
  for (const blocker of ['crate', 'enemy']) {
    const f = fixture();
    f.g.mods = ['ricochet', 'split', 'vector', 'afterburner'];
    f.g.gun = getGun(f.g.mods);
    assert(beginAnglerAttack(f.g, f.e));
    const p = f.e.angler!.plan!;
    const x = (p.bounce.x + 1000) / 2,
      y = (p.bounce.y + 600) / 2;
    if (blocker === 'crate') f.g.props.spawn('crate', x, y);
    else {
      f.g.spawnEnemy('shooter', x, y);
      f.g.enemies[1].spawn = 0;
    }
    const warning = anglerWarningPoints(f.g, f.e);
    assert.equal(warning.length, 3);
    assert(warning[2].x < 1000);
    f.e.timer = 0;
    updateAngler(f.g, f.e, DT);
    const s = f.g.shots[0];
    assert.equal(s.vector, undefined);
    assert.equal(s.pierce, 0);
    assert.equal(s.bankGrowth, 0);
    flight(f.g);
    assert.equal(s.banks, 1);
    assert.equal(f.g.hp, 100);
    assert.equal(f.g.shots.length, 0);
  }
});
test('a displaced or still-spawning Angler cannot fire from a stale muzzle', () => {
  const f = fixture();
  f.e.spawn = 0.2;
  assert(!beginAnglerAttack(f.g, f.e));
  f.e.spawn = 0;
  assert(beginAnglerAttack(f.g, f.e));
  Body.translate(f.e.body, { x: 20, y: 0 });
  f.e.timer = 0;
  updateAngler(f.g, f.e, DT);
  assert.equal(f.g.shots.length, 0);
  assert(f.e.angler!.exposed > 0);
});
test('Countershot reflects a bank round toward its owner without retaining the hostile bank or cancellation', () => {
  const f = fixture(),
    s = fire(f);
  f.g.addShot({
    pos: { ...s.pos },
    vel: { x: -s.vel.x, y: -s.vel.y },
    damage: 24,
    life: 2,
    friendly: true,
    radius: 3,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
    counter: 1,
  });
  f.g.updateShots(DT);
  assert(s.friendly && s.reflected);
  assert.equal(s.angler, undefined);
  assert.equal(s.bounces, 0);
  Body.setAngle(f.roof, 0.1);
  f.g.time += DT;
  f.g.updateShots(DT);
  assert.equal(f.e.angler!.exposed, 0);
  assert.equal(f.g.hp, 100);
});
test('a portal placed after firing redirects the round and removes its planned bank', () => {
  const f = fixture(),
    s = fire(f),
    p = s.angler!.plan;
  f.g.mods = ['fold'];
  f.g.gun = getGun(f.g.mods);
  assert(f.g.portals.place({ x: p.bounce.x, y: f.roof.bounds.max.y }));
  assert(f.g.portals.place({ x: 1400, y: 740 }));
  for (let i = 0; i < 80 && s.angler && s.life > 0; i++) {
    f.g.time += DT;
    f.g.updateShots(DT);
  }
  assert(s.life > 0);
  assert.equal(s.angler, undefined);
  assert.equal(s.bounces, 0);
  assert(s.pos.x > 1300);
  assert.equal(f.g.hp, 100);
});
test('a friendly shot breaking the bank earlier in the same update cancels the following hostile round', () => {
  const f = fixture(),
    s = fire(f);
  f.g.addShot({
    pos: { x: 700, y: 400 },
    vel: { x: 0, y: -100 },
    damage: 1000,
    life: 2,
    friendly: true,
    radius: 3,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
  const friendly = f.g.shots.at(-1)!;
  f.g.shots = [friendly, s];
  f.g.updateShots(DT);
  assert(s.life <= 0);
  assert(!f.g.terrain.includes(f.roof));
  assert(f.e.angler!.exposed > 0);
  assert.equal(f.g.hp, 100);
});
test('a steady counterweight is bankable; a moving one is rejected and tilting a locked one interrupts', () => {
  const f = fixture();
  Composite.remove(f.g.engine.world, f.roof);
  f.g.terrain = f.g.terrain.filter((b) => b !== f.roof);
  const beam = f.g.counterweights.spawn({ x: 700, y: 350, w: 700 });
  const plan = findAnglerPlan(f.g, f.e);
  assert(plan);
  assert.equal(plan.body, beam.body);
  assert(beginAnglerAttack(f.g, f.e, plan));
  Body.setAngle(beam.body, 0.03);
  updateAngler(f.g, f.e, DT);
  assert(f.e.angler!.exposed > 0);
  Body.setAngularVelocity(beam.body, 0.005);
  assert.notEqual(findAnglerPlan(f.g, f.e)?.body, beam.body);
});
test('the Angler stays physical against floors, walls and crates while seeking a bank', () => {
  const f = fixture();
  f.g.engine.gravity.y = 1;
  Body.setPosition(f.e.body, { x: 600, y: 716 });
  f.e.timer = 100;
  const crate = f.g.props.spawn('crate', 635, 717);
  Body.setStatic(crate.body, true);
  for (let i = 0; i < 180; i++) f.g.tick(DT, idle);
  assert(f.e.body.bounds.max.y < 742);
  assert(f.e.body.bounds.max.x < crate.body.bounds.min.x + 1);
  assert(!Query.collides(f.e.body, [crate.body]).some((c) => c.depth > 1));
});
test('pausing freezes a locked tell; restarting a test removes its rounds and exposure', () => {
  const f = fixture();
  assert(beginAnglerAttack(f.g, f.e));
  const timer = f.e.timer;
  f.g.setMode('paused');
  for (let i = 0; i < 100; i++) f.g.tick(DT, idle);
  assert.equal(f.e.timer, timer);
  assert.equal(f.g.shots.length, 0);
  f.g.startTest(preset());
  assert.equal(f.g.shots.length, 0);
  assert(f.g.enemies.every((e) => !e.angler?.plan && !e.angler?.exposed));
});
test('test links are legal, mirrored, deterministic checkpoints and reject conflicting modes', () => {
  for (const area of ['furnace', 'rooftops'])
    for (const mirror of [false, true])
      for (const build of ['standard', 'vector']) {
        const save = preset(area, mirror, build);
        assert(loadCheckpoint(save));
        const g = new Game();
        g.startTest(save);
        assert(g.testRun);
        assert.equal(g.level.mirrored, mirror);
        assert(g.level.spawns.some((s) => s.kind === 'angler'));
        if (area === 'rooftops') assert(g.level.counterweights);
        assert.deepEqual(save, preset(area, mirror, build));
      }
  for (const extra of [
    '&daily=2026-09-12',
    '&dv=51',
    '&test=angler',
    '&area=bad',
    '&build=bad',
    '&mirror=2',
    '&build=vector&build=standard',
  ])
    assert.equal(anglerTestFromUrl(new URL('https://test/?test=angler' + extra)), null);
});
test('seeded placement adds at most one, preserves elites and pairs, and avoids bosses and other introductions', () => {
  let total = 0;
  for (let i = 0; i < 24; i++)
    for (let stage = 0; stage < 20; stage++) {
      const seed = 'angler-roster-' + i,
        level = getLevel(seed, stage);
      const anglers = level.spawns.filter((s) => s.kind === 'angler');
      assert(anglers.length <= 1);
      total += anglers.length;
      if (stage < 5 || [7, 8, 11, 12, 15, 19].includes(stage) || level.freight || level.crossing)
        assert.equal(anglers.length, 0);
      assert.deepEqual(level, getLevel(seed, stage));
      assert.deepEqual(addAngler(level, seed, stage), level);
      const ot = getOvertimeLevel(seed, stage);
      assert(!ot.anglerIntro);
      const base = {
        ...level,
        anglerIntro: undefined,
        spawns: level.spawns.map((s) =>
          s.kind === 'angler' ? { ...s, kind: 'runner' as const } : s,
        ),
      };
      const added = addAngler(base, seed, stage);
      for (const s of squadSpawns(base.spawns, base, seed, stage).filter((s) => s.elite || s.squad))
        assert(added.spawns.some((a) => a.kind === s.kind && a.x === s.x && a.y === s.y));
    }
  assert(total > 50);
});
test('Furnace introduces the Angler alone and waits for its defeat before reinforcements', () => {
  const save = preset(),
    g = new Game();
  g.startTest(save);
  assert(g.level.anglerIntro);
  const waves = splitWaves(g.level, save.seed, 5);
  assert.equal(waves[0].length, 1);
  assert.equal(waves[0][0].kind, 'angler');
  Body.setStatic(g.player, true);
  g.hp = 10000;
  for (let i = 0; i < 1200; i++) g.tick(DT, idle);
  assert.equal(g.waves.phase, 'opening');
  assert.equal(g.enemies.length, 1);
  g.hitEnemy(g.enemies[0], 9999);
  for (let i = 0; i < 180; i++) g.tick(DT, idle);
  assert(g.enemies.length > 1);
});
test('real Furnace and rooftop test encounters stay completable with ordinary movement and shooting', () => {
  const results = [];
  for (const area of ['furnace', 'rooftops'])
    for (const mirror of [false, true]) {
      const g = new Game();
      g.startTest(preset(area, mirror));
      let frames = 0,
        attacks = 0,
        stuck = 0,
        lastX = g.player.position.x,
        advanceUntil = 0,
        climbX: number | undefined;
      for (; frames < 60 * 100 && !g.clear && g.mode === 'playing'; frames++) {
        const target = g.enemies
          .filter((e) => e.spawn <= 0)
          .sort(
            (a, b) =>
              distance(a.body.position, g.player.position) -
              distance(b.body.position, g.player.position),
          )[0];
        let input: Partial<Input> = target ? dodgePilot(g, target) : {};
        stuck = Math.abs(g.player.position.x - lastX) < 0.2 ? stuck + 1 : 0;
        lastX = g.player.position.x;
        if (
          target &&
          (stuck > 90 || g.time < advanceUntil || (g.time > 2 && Math.floor(g.time) % 4 < 2)) &&
          distance(g.lineEnd(g.player.position, target.body.position), target.body.position) > 1
        ) {
          if (stuck > 90) {
            advanceUntil = g.time + 0.65;
            stuck = 0;
          }
          const dx = target.body.position.x - g.player.position.x;
          const dir =
            Math.abs(dx) < 80 ? (g.player.position.x < g.worldWidth / 2 ? 1 : -1) : Math.sign(dx);
          input = { left: dir < 0, right: dir > 0, jump: g.grounded, fire: false };
          if (target.body.position.y < g.player.position.y - 200)
            input = {
              ...input,
              fire: true,
              aim: { x: g.player.position.x, y: g.player.position.y + 300 },
            };
        }
        if (target && target.body.position.y < g.player.position.y - 180) {
          const ceiling = g.terrain
            .filter(
              (b) =>
                b.bounds.max.y < g.player.position.y &&
                b.bounds.min.y > target.body.position.y &&
                g.player.position.x > b.bounds.min.x - 22 &&
                g.player.position.x < b.bounds.max.x + 22,
            )
            .sort((a, b) => b.bounds.max.y - a.bounds.max.y)[0];
          if (ceiling && climbX === undefined)
            climbX =
              g.player.position.x - ceiling.bounds.min.x <
              ceiling.bounds.max.x - g.player.position.x
                ? ceiling.bounds.min.x - 50
                : ceiling.bounds.max.x + 50;
          if (climbX !== undefined) {
            const dx = climbX - g.player.position.x;
            input = {
              left: dx < -10,
              right: dx > 10,
              jump: g.grounded,
              fire: !ceiling,
              aim: { x: g.player.position.x, y: g.player.position.y + 300 },
            };
          }
        } else climbX = undefined;
        g.tick(DT, { ...idle, ...input });
        attacks = Math.max(attacks, ...g.enemies.filter((e) => e.angler).map((e) => e.attacks));
      }
      results.push({
        area,
        mirror,
        clear: g.clear,
        hp: g.hp,
        frames,
        attacks,
        player: g.player.position,
        enemies: g.enemies.map((e) => ({
          kind: e.kind,
          hp: e.hp,
          pos: e.body.position,
          state: e.state,
        })),
      });
    }
  assert(
    results.every((r) => r.clear),
    JSON.stringify(results),
  );
});
