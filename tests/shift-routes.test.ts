import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { testCheckpoint } from '../src/practice.ts';
import { getGun, loadCheckpoint } from '../src/rules.ts';
import { traceTorch } from '../src/torch.ts';
import { firstSolid } from '../src/collisions.ts';
import {
  ShiftRoutes,
  SHIFT_ROUTE_IDS,
  planShiftRoute,
  validShiftRouteSave,
  validReworkSnapshot,
  type ReworkSnapshot,
  type ShiftRouteId,
} from '../src/shift-routes.ts';
import { captureRework, shiftRouteLayout } from '../src/shift-route-layouts.ts';
import { drawShiftRoute } from '../src/shift-route-art.ts';
const { Body, Composite, Engine } = Matter;
const DT = 1 / 60;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1800, y: 720 },
};
function clean(g: Game) {
  Composite.clear(g.engine.world, false);
  Engine.clear(g.engine);
}
function attach(g: Game) {
  return (
    (g as Game & { shiftRoutes: ShiftRoutes }).shiftRoutes ??
    Object.assign(g, { shiftRoutes: new ShiftRoutes(g) }).shiftRoutes
  );
}
function source() {
  const g = new Game();
  g.startTest(testCheckpoint('SHIFT-SOURCE', 4));
  // An explicit post-clear fixture records actual native damage, not a played clear.
  for (const e of [...g.enemies]) g.hitEnemy(e, 1e9, undefined, true, false, false, 'cleanup');
  g.waves.clear();
  g.clear = true;
  const weak = g.destruction.pieces[0];
  if (weak) g.destruction.hitBody(weak.body, 1e6, { x: 0, y: 0 });
  const box = g.props.items.find((p) => p.kind === 'crate' || p.kind === 'cover');
  if (box) box.hp = Math.max(1, box.hp / 2);
  const result = captureRework(g);
  assert(result);
  assert(validReworkSnapshot(result));
  clean(g);
  return result;
}
function fixture(kind: ShiftRouteId) {
  const g = new Game();
  g.startTest(testCheckpoint('SHIFT-' + kind, 6));
  const routes = attach(g);
  if (kind === 'rework-loop') routes.lastRework = source();
  assert(routes.enter(kind));
  g.loadRoom();
  g.setMode('playing');
  return { g, routes };
}
test('route plans begin after zone one, remain deterministic and never fabricate a Rework source', () => {
  for (const stage of [0, 1, 2, 3, 19, 20, -1, NaN])
    assert.deepEqual(planShiftRoute('seed', stage, true), []);
  for (const stage of [4, 6, 10, 14, 18]) {
    assert.deepEqual(planShiftRoute('seed', stage, true), planShiftRoute('seed', stage, true));
    assert.equal(new Set(planShiftRoute('seed', stage, true)).size, 2);
    for (let n = 0; n < 30; n++) assert(!planShiftRoute('seed' + n, stage).includes('rework-loop'));
  }
});
test('all five selected routes use the native world, complete real patrols and keep floor recovery', () => {
  for (const kind of SHIFT_ROUTE_IDS) {
    const { g, routes } = fixture(kind);
    assert(routes.active, kind);
    assert.equal(g.level.id, 'shift-' + kind);
    assert(g.enemies.length >= 4, kind);
    assert.equal(g.level.spawns.length, g.enemies.length);
    assert.equal(g.level.boss, false);
    assert.equal(g.stage, 6);
    assert(g.terrain[0].bounds.min.y === 740);
    assert(g.enemies.every((e) => !e.workshopTarget && !e.allied));
    const actorBodies = [g.player, ...g.enemies.map((e) => e.body), ...g.props.bodies];
    for (const body of actorBodies) {
      assert.equal(
        Matter.Query.collides(body, g.terrain.slice(4)).length,
        0,
        kind + ': spawn must clear real terrain',
      );
      assert(body.position.x > 50 && body.position.x < 1900);
    }
    assert.equal(g.onCheckpoint.toString().includes('localStorage'), false);
    clean(g);
  }
});
test('Vacuum Docks applies actual gravity and drift, then restores ordinary physics on exit', () => {
  const { g, routes } = fixture('vacuum-docks');
  assert.equal(g.engine.gravity.y, 0.24);
  assert.equal(g.player.frictionAir, 0.001);
  Body.setPosition(g.player, { x: 260, y: 360 });
  Body.setVelocity(g.player, { x: 9, y: 0 });
  g.tick(DT, idle);
  assert(g.player.velocity.x > 8.9);
  assert(g.player.velocity.y > 0 && g.player.velocity.y < 0.12);
  const gravity = g.engine.gravity.y,
    time = g.time;
  g.setMode('paused');
  for (let i = 0; i < 60; i++) g.tick(DT, idle);
  assert.equal(g.time, time);
  assert.equal(g.engine.gravity.y, gravity);
  g.stage++;
  g.loadRoom();
  assert(!routes.active);
  assert.equal(g.engine.gravity.y, 1);
  assert.equal(g.player.frictionAir, 0.008);
  clean(g);
});
test('Turntable consoles rotate real SAT terrain by ninety degrees and never rotate through actors', () => {
  const { g, routes } = fixture('turntable-works'),
    rotor = routes.rotors[0],
    old = rotor.body.angle;
  Body.setPosition(g.player, rotor.console);
  assert(routes.interact());
  for (let i = 0; i < 80; i++) routes.beforeStep({ ...idle }, DT);
  assert(Math.abs(rotor.body.angle - old - Math.PI / 2) < 0.001);
  assert(rotor.body.bounds.max.y - rotor.body.bounds.min.y > 299);
  assert(firstSolid({ x: 400, y: 510 }, { x: 900, y: 510 }, { x: 2, y: 2 }, [rotor.body]));
  assert.equal(routes.state!.turns![0], 1);
  Body.setPosition(g.player, rotor.console);
  assert(routes.interact());
  Body.setPosition(g.player, { x: rotor.body.position.x + 60, y: rotor.body.position.y });
  const before = { ...g.player.position };
  for (let i = 0; i < 30; i++) routes.beforeStep({ ...idle }, DT);
  assert.deepEqual(g.player.position, before);
  assert(rotor.body.angle < Math.PI - 0.1, 'an occupied sweep must defer the physical rotation');
  assert.equal(Matter.Query.collides(rotor.body, [g.player]).length, 0);
  clean(g);
});
test('Prism mirrors reflect actual ordinary rounds, preserve speed, and retain conversion behavior', () => {
  const { g, routes } = fixture('prism-glassworks'),
    mirror = routes.mirrors[0];
  const normal = { x: -Math.SQRT1_2, y: -Math.SQRT1_2 };
  g.fire();
  const shot = g.shots[0],
    speed = Math.hypot(shot.vel.x, shot.vel.y);
  shot.pos = { x: mirror.body.position.x - 5, y: mirror.body.position.y - 5 };
  assert(routes.reflect(shot, mirror.body, normal));
  assert(Math.abs(Math.hypot(shot.vel.x, shot.vel.y) - speed) < 1e-8);
  assert(shot.vel.y < 0);
  assert.equal(shot.banks, 1);
  const reflected = { ...shot.vel };
  assert.equal(routes.mirrorDirection(g.terrain[0], normal, reflected), null);
  for (let i = 0; i < 3; i++) assert(routes.reflect(shot, mirror.body, normal));
  assert(!routes.reflect(shot, mirror.body, normal), 'finite per-shot reflection budget');
  assert(!routes.reflect({ ...shot, shell: { radius: 70, damage: 20 } }, mirror.body, normal));
  assert(!routes.reflect({ ...shot, rail: true }, mirror.body, normal));
  Body.setPosition(g.player, mirror.console);
  assert(routes.interact());
  for (let i = 0; i < 40; i++) routes.beforeStep({ ...idle }, DT);
  assert(Math.abs(mirror.body.angle) < 0.001);
  clean(g);
});
test('Express Airlocks keeps skipped patrols alive and its real gates prevent premature completion', () => {
  const { g, routes } = fixture('express-airlocks');
  assert(routes.pending);
  const first = routes.gates[0],
    second = routes.gates[1],
    native = [...g.enemies];
  assert(firstSolid({ x: 600, y: 700 }, { x: 710, y: 700 }, { x: 13, y: 18 }, g.terrain));
  Body.setPosition(g.player, first.console);
  assert(routes.interact());
  assert.equal(routes.state!.gates, 1);
  assert.equal(routes.bonus, 1);
  assert.deepEqual(g.enemies, native, 'opening is not a patrol clear');
  assert(!g.engine.world.bodies.includes(first.body));
  assert(g.engine.world.bodies.includes(second.body));
  Body.setPosition(g.player, second.console);
  assert(routes.interact());
  assert.equal(routes.bonus, 2);
  assert(!routes.pending);
  assert.equal(g.enemies.length, 6);
  assert(!g.clear);
  clean(g);
});
test('Rework records actual damage and returns to a reversed room with fresh native combat', () => {
  const actual = source(),
    { g, routes } = fixture('rework-loop');
  assert.deepEqual(routes.state!.rework, actual);
  assert.deepEqual(
    g.level.solids,
    actual.solids.map((s) => ({ ...s, x: 2000 - s.x - s.w })),
  );
  assert(g.enemies.length >= 4);
  for (const prop of actual.props)
    if (prop.hp !== undefined) {
      const kept = g.props.items.find(
        (p) =>
          Math.abs(p.body.position.x - (2000 - prop.x)) < 1 &&
          Math.abs(p.body.position.y - prop.y) < 1,
      );
      assert(kept);
      assert.equal(kept.hp, Math.min(kept.maxHp, prop.hp));
    }
  assert.equal(routes.bonus, 1);
  assert(!g.clear);
  clean(g);
});
test('Rework captures surviving authored terrain while leaving temporary supports and circuit bodies behind', () => {
  const g = new Game();
  g.startTest(testCheckpoint('SHIFT-SOURCE-TERRAIN', 4));
  g.clear = true;
  const before = captureRework(g);
  assert(before && before.solids.length > 0);
  const temporary = Matter.Bodies.rectangle(920, 530, 80, 16, { isStatic: true });
  g.terrain.push(temporary);
  Composite.add(g.engine.world, temporary);
  assert.deepEqual(
    captureRework(g),
    before,
    'temporary foam or a physical circuit device must not be preserved as a permanent wall',
  );
  const original = g.terrain
    .slice(4)
    .find((b) =>
      before.solids.some(
        (s) =>
          Math.abs(b.bounds.min.x - s.x) < 0.01 &&
          Math.abs(b.bounds.min.y - s.y) < 0.01 &&
          Math.abs(b.bounds.max.x - b.bounds.min.x - s.w) < 0.01 &&
          Math.abs(b.bounds.max.y - b.bounds.min.y - s.h) < 0.01,
      ),
    );
  assert(original);
  Composite.remove(g.engine.world, original);
  const after = captureRework(g);
  assert(after);
  assert.equal(
    after.solids.length,
    before.solids.length - 1,
    'a physically removed authored platform must stay absent',
  );
  clean(g);
});

test('mechanisms round-trip independent bounded save data without advancing the live run or consuming RNG', () => {
  for (const kind of SHIFT_ROUTE_IDS) {
    const { g, routes } = fixture(kind),
      before = g.rng;
    if (kind === 'turntable-works') routes.state!.turns![0] = 2;
    if (kind === 'prism-glassworks') routes.state!.mirrors![1] = 3;
    if (kind === 'express-airlocks') {
      routes.state!.gates = 1;
      routes.state!.rush = 1;
    }
    const save = routes.snapshot();
    assert(validShiftRouteSave(save));
    const other = new ShiftRoutes(g);
    other.start({ shiftRoute: save, shiftRework: routes.lastRework ?? undefined });
    assert.deepEqual(other.snapshot(), save);
    assert.equal(g.rng, before);
    save!.kind = 'vacuum-docks';
    assert.equal(other.state!.kind, kind);
    clean(g);
  }
  for (const bad of [
    { version: 1, kind: 'vacuum-docks', stage: 0 },
    { version: 1, kind: 'constructor', stage: 6 },
    { version: 1, kind: 'turntable-works', stage: 6, turns: [0, Infinity] },
    { version: 1, kind: 'prism-glassworks', stage: 6, mirrors: [0, 0, 0, 0] },
    { version: 1, kind: 'express-airlocks', stage: 6, gates: 1, rush: 2 },
    { version: 1, kind: 'rework-loop', stage: 6, rework: {} },
  ])
    assert(!validShiftRouteSave(bad));
});
test('route artwork is deterministic, bounded, state-balanced and never mutates gameplay', () => {
  for (const kind of SHIFT_ROUTE_IDS) {
    const { g, routes } = fixture(kind);
    const record = () => {
      const ops: unknown[][] = [],
        stack: unknown[] = [],
        styles: Record<string, unknown> = { globalAlpha: 1, lineWidth: 1 };
      const c = new Proxy({} as CanvasRenderingContext2D, {
        get(_t, k) {
          if (k === 'save') return () => stack.push({ ...styles });
          if (k === 'restore')
            return () => {
              assert(stack.length);
              Object.assign(styles, stack.pop());
            };
          if (k in styles) return styles[String(k)];
          return (...a: unknown[]) => {
            assert(a.filter((v) => typeof v === 'number').every(Number.isFinite));
            ops.push([k, ...a]);
          };
        },
        set(_t, k, v) {
          if (k === 'globalAlpha') assert(Number.isFinite(v) && v >= 0 && v <= 1);
          styles[String(k)] = v;
          return true;
        },
      });
      return { c, ops, stack };
    };
    const normal = record(),
      reduced = record(),
      state = routes.snapshot(),
      positions = g.terrain.map((b) => ({ ...b.position }));
    drawShiftRoute(normal.c, g);
    drawShiftRoute(reduced.c, g, true);
    assert.deepEqual(normal.ops, reduced.ops);
    assert(normal.ops.length > 0 && normal.ops.length < 180);
    assert.equal(normal.stack.length, 0);
    assert.deepEqual(routes.snapshot(), state);
    assert.deepEqual(
      g.terrain.map((b) => ({ ...b.position })),
      positions,
    );
    clean(g);
  }
});

test('ordinary pistol inputs clear all five route patrols with native health and real interactions', () => {
  const reports = [];
  for (const kind of SHIFT_ROUTE_IDS) {
    const { g, routes } = fixture(kind);
    let frames = 0;
    let tour = 1;
    let climb: { body: Matter.Body; launch: number; target: number } | null = null;
    while (g.mode === 'playing' && !g.clear && frames < 7200) {
      const p = g.player.position;
      const enemies = g.enemies.filter((e) => e.hp > 0);
      const visible = enemies.filter(
        (e) => !firstSolid(p, e.body.position, { x: 1, y: 1 }, g.solidBodies),
      );
      const target = (visible.length ? visible : enemies).sort(
        (a, b) =>
          Math.hypot(a.body.position.x - p.x, a.body.position.y - p.y) -
          Math.hypot(b.body.position.x - p.x, b.body.position.y - p.y),
      )[0];
      const gate =
        routes.kind === 'express-airlocks' ? routes.gates[routes.state!.gates ?? 0] : null;
      const goal =
        gate && p.x < gate.console.x + 40
          ? gate.console
          : (target?.body.position ?? { x: 1840, y: 720 });
      const dx = goal.x - p.x,
        nearGate = !!gate && Math.hypot(gate.console.x - p.x, gate.console.y - p.y) < 70;
      const sign = Math.sign(dx) || 1;
      const obstacle = firstSolid(
        { x: p.x, y: p.y - 3 },
        { x: p.x + sign * 65, y: p.y - 3 },
        { x: 13, y: 14 },
        g.terrain,
      );
      let jump = nearGate || (g.grounded && (!!obstacle || goal.y < p.y - 45) && frames % 12 === 0);
      let aim = target ? { ...target.body.position } : { x: 1840, y: 700 };
      let fire = !!target && visible.includes(target);
      let movement =
        Math.abs(dx) > (gate ? 45 : 100)
          ? sign
          : target && Math.abs(target.body.position.x - p.x) < 90
            ? -sign
            : Math.sin(frames / 70);
      if (
        climb &&
        (!target ||
          target.id !== climb.target ||
          target.body.position.y > climb.body.bounds.min.y + 5)
      )
        climb = null;
      if (
        !gate &&
        !climb &&
        target &&
        !visible.includes(target) &&
        target.body.position.y < p.y - 45
      ) {
        const blocked = firstSolid(p, target.body.position, { x: 1, y: 1 }, g.terrain);
        if (blocked && blocked.body.bounds.min.y > 150) {
          climb = {
            target: target.id,
            body: blocked.body,
            launch:
              p.x < blocked.body.position.x
                ? blocked.body.bounds.min.x - 36
                : blocked.body.bounds.max.x + 36,
          };
        }
      }
      if (climb) {
        const b = climb.body.bounds;
        if (p.y < b.min.y - 29) {
          movement = Math.sign((target?.body.position.x ?? b.min.x + 35) - p.x);
          if (p.x > b.min.x + 14 && p.x < b.max.x - 14) climb = null;
        } else {
          movement = Math.abs(climb.launch - p.x) > 6 ? Math.sign(climb.launch - p.x) : 0;
          if (g.grounded && Math.abs(climb.launch - p.x) < 14) jump = true;
        }
      }
      if (gate) climb = null;
      if (!gate && target && !visible.includes(target) && target.body.position.y > p.y + 45) {
        const down = firstSolid(p, target.body.position, { x: 1, y: 1 }, g.terrain);
        if (down) movement = p.x < down.body.position.x ? -1 : 1;
      }
      const cover = firstSolid(p, goal, { x: 1, y: 1 }, g.props.bodies);
      if (cover && Math.hypot(cover.body.position.x - p.x, cover.body.position.y - p.y) < 150) {
        aim = { ...cover.body.position };
        fire = true;
      }
      if (frames > 1800) {
        climb = null;
        if (p.x > 1820) tour = -1;
        if (p.x < 170) tour = 1;
        movement = tour;
        jump = g.grounded && frames % 12 === 0;
      }
      g.tick(DT, {
        left: movement < -0.15,
        right: movement > 0.15,
        jump,
        jumpHeld: true,
        fire,
        aim,
      });
      assert(Number.isFinite(g.player.position.x) && Number.isFinite(g.player.position.y), kind);
      frames++;
    }
    const combatCleared = g.clear;
    for (let i = 0; combatCleared && g.mode === 'playing' && i < 1800; i++) {
      const p = g.player.position;
      const blocked = firstSolid(
        { x: p.x, y: p.y - 3 },
        { x: p.x + 65, y: p.y - 3 },
        { x: 13, y: 14 },
        g.solidBodies,
      );
      const cover = blocked && g.props.items.find((prop) => prop.body === blocked.body);
      const jump = g.grounded && !!blocked && i % 8 === 0;
      const fire = !!cover || (!g.grounded && p.y < 580);
      const aim = cover ? { ...cover.body.position } : { x: p.x, y: p.y - 700 };
      g.tick(DT, { left: false, right: true, jump, jumpHeld: true, fire, aim });
    }
    reports.push({
      kind,
      exited: g.mode === 'upgrade',
      clear: combatCleared,
      hp: g.hp,
      time: g.time,
      enemies: g.enemies.map((e) => [
        e.kind,
        e.hp,
        Math.round(e.body.position.x),
        Math.round(e.body.position.y),
      ]),
      pos: { ...g.player.position },
    });
    clean(g);
  }
  assert(
    reports.every((r) => r.clear && r.exited && r.hp > 0),
    JSON.stringify(reports),
  );
});

test('native projectiles and beams reflect at Prism surfaces while an earlier wall still blocks both', () => {
  const { g, routes } = fixture('prism-glassworks'),
    mirror = routes.mirrors[0].body;
  const shotStart = { x: 300, y: mirror.position.y };
  g.addShot({
    pos: { ...shotStart },
    vel: { x: 40, y: 0 },
    damage: 24,
    life: 1.4,
    friendly: true,
    radius: 2.5,
    bounces: 0,
    pierce: 0,
    bankGrowth: 0,
    fragment: false,
    split: false,
  });
  const shot = g.shots.at(-1)!;
  for (let i = 0; i < 12; i++) {
    g.time += DT;
    g.updateShots(DT);
  }
  assert(shot.banks >= 1);
  assert(shot.vel.y < 0);
  assert(shot.pos.y < mirror.position.y);
  const start = {
    from: shotStart,
    dir: { x: 1, y: 0 },
    remaining: 1000,
    banks: 0,
    pierce: 0,
    gain: 1,
    radius: 1.5,
  };
  const rays = traceTorch(g, false, 0, 12, { used: false }, start);
  assert(rays.length >= 2);
  assert.equal(rays[0].body, mirror);
  assert(rays[1].dir.y < 0);
  const barrier = Matter.Bodies.rectangle(450, mirror.position.y, 20, 150, { isStatic: true });
  g.terrain.push(barrier);
  Composite.add(g.engine.world, barrier);
  const blocked = traceTorch(g, false, 0, 12, { used: false }, start);
  assert.equal(blocked.length, 1);
  assert.equal(blocked[0].body, barrier);
  clean(g);
});
test('native Continue reconstructs selected machinery and real Rework damage without writing profile progress', () => {
  for (const kind of SHIFT_ROUTE_IDS) {
    const { g, routes } = fixture(kind);
    if (kind === 'turntable-works') routes.state!.turns![0] = 1;
    if (kind === 'prism-glassworks') routes.state!.mirrors![0] = 2;
    if (kind === 'express-airlocks') {
      routes.state!.gates = 1;
      routes.state!.rush = 1;
    }
    const cp = g.checkpointSnapshot();
    assert(cp);
    assert(loadCheckpoint(cp), kind + ': legal checkpoint');
    const other = new Game();
    let writes = 0;
    other.onCheckpoint = () => writes++;
    other.startTest(cp);
    assert.equal(other.level.id, g.level.id);
    assert.deepEqual(other.shiftRoutes.snapshot(), routes.snapshot());
    assert.equal(other.shiftRoutes.pending, routes.kind === 'express-airlocks');
    if (kind === 'vacuum-docks') assert.equal(other.engine.gravity.y, 0.24);
    if (kind === 'turntable-works')
      assert(Math.abs(other.shiftRoutes.rotors[0].body.angle - Math.PI / 2) < 0.001);
    if (kind === 'prism-glassworks')
      assert(Math.abs(other.shiftRoutes.mirrors[0].body.angle - Math.PI / 4) < 0.001);
    assert.equal(writes, 0);
    clean(g);
    clean(other);
  }
});

test('old seeds and Daily runs cannot acquire routes, and a finished route never leaks into the next room save', () => {
  for (const seed of ['RF-C106-OLD', 'RF-D91-2026-10-25']) {
    const g = new Game();
    g.startTest(testCheckpoint(seed, 6));
    const routes = attach(g);
    assert(!routes.enabled);
    assert.deepEqual(routes.choices(), []);
    assert(!routes.enter('vacuum-docks'));
    g.clear = true;
    assert(!routes.remember());
    assert.equal(routes.lastRework, null);
    assert.equal(routes.snapshot(), undefined);
    clean(g);
  }
  const { g, routes } = fixture('turntable-works'),
    saved = routes.snapshot();
  assert(saved);
  g.stage++;
  assert.equal(routes.snapshot(), undefined);
  assert.equal(g.checkpointSnapshot().shiftRoute, undefined);
  clean(g);
});
