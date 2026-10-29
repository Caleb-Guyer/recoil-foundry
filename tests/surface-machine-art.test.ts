import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import { machineBodySnapshot } from '../src/machine-breakdown-pose.ts';
import { surfaceMachinePose, type SurfaceMachineKind } from '../src/surface-machine-pose.ts';
import { drawSurfaceChassis } from '../src/surface-machine-art.ts';
import { drawMachineChassis, drawMachineContacts } from '../src/machine-breakdown-art.ts';
import { drawAngler } from '../src/angler-art.ts';
import { drawWallcrawler } from '../src/wallcrawler-art.ts';
import { ANGLER, anglerWarningPoints, updateAngler } from '../src/angler.ts';
import { CRAWLER, updateWallcrawler } from '../src/wallcrawler.ts';
import {
  surfaceMachinesTestFromUrl,
  surfaceMachinesTestRoom,
  prepareSurfaceMachinesTest,
  type SurfaceFace,
} from '../src/surface-machines-test.ts';

type Op = { name: string; args: unknown[] };
function canvas(warnings = false) {
  const ops: Op[] = [],
    stack: Record<string, unknown>[] = [],
    state: Record<string, unknown> = { globalAlpha: 0.85, lineWidth: 1 };
  const c = new Proxy({} as CanvasRenderingContext2D, {
    get(_, key) {
      if (Object.hasOwn(state, key)) return state[String(key)];
      return (...args: unknown[]) => {
        if (key === 'save') stack.push({ ...state });
        if (key === 'restore') {
          assert(stack.length);
          Object.keys(state).forEach((k) => delete state[k]);
          Object.assign(state, stack.pop());
        }
        for (const n of args) if (typeof n === 'number') assert(Number.isFinite(n), String(key));
        if (key === 'arc' || key === 'ellipse') assert(Number(args[2]) >= 0);
        if (key === 'fillRect' || key === 'strokeRect')
          assert(Number(args[2]) >= 0 && Number(args[3]) >= 0);
        assert(!['fillText', 'strokeText', 'drawImage', 'clearRect'].includes(String(key)));
        assert(warnings || key !== 'setLineDash', 'chassis adds no world warnings');
        ops.push({ name: String(key), args });
      };
    },
    set(_, key, value) {
      if (key === 'globalAlpha') assert(Number.isFinite(value) && value >= 0 && value <= 1);
      if (key === 'lineWidth') assert(Number.isFinite(value) && value > 0);
      state[String(key)] = value;
      ops.push({ name: 'style:' + String(key), args: [value] });
      return true;
    },
  });
  return {
    c,
    ops,
    get depth() {
      return stack.length;
    },
  };
}
const kinds = ['angler', 'wallcrawler'] as const;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1800, y: 500 },
};
function native(kind: SurfaceMachineKind, face: SurfaceFace = 'wall') {
  const f = surfaceMachinesTestFromUrl(
    new URL(
      'https://test/?test=surface-machines&unit=' +
        kind +
        (kind === 'wallcrawler' ? '&face=' + face : '') +
        '&v=1',
    ),
  )!;
  assert(f);
  const g = new Game();
  g.startTest(f.checkpoint, surfaceMachinesTestRoom(f));
  assert(prepareSurfaceMachinesTest(g, f));
  for (const actor of g.enemies) actor.spawn = 0;
  const e = g.enemies.find((e) => e.kind === kind)!;
  assert(e);
  return { g, e };
}
function until(g: Game, e: Enemy, condition: () => boolean, max = 480) {
  for (let i = 0; i < max && !condition(); i++) g.tick(1 / 60, idle);
  assert(
    condition(),
    JSON.stringify({
      hp: g.hp,
      mode: g.mode,
      time: g.time,
      state: e.state,
      timer: e.timer,
      pos: e.body.position,
      attacks: e.attacks,
      crawler: e.crawler
        ? { fired: e.crawler.fired, normal: e.crawler.normal, support: e.crawler.support?.id }
        : null,
      plan: e.angler?.plan?.bounce,
    }),
  );
}
const snapshot = (g: Game, e: Enemy) => machineBodySnapshot(e, g.time, g)!;
const close = (a: number, b: number) => assert(Math.abs(a - b) < 1e-7, a + ' != ' + b);
function numeric(v: unknown) {
  if (typeof v === 'number') assert(Number.isFinite(v));
  else if (Array.isArray(v)) v.forEach(numeric);
  else if (v && typeof v === 'object') Object.values(v).forEach(numeric);
}
function draw(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced = false, portrait = false) {
  if (e.angler) drawAngler(c, g, e, reduced, portrait);
  else drawWallcrawler(c, g, e, reduced, portrait);
}
function release(g: Game, e: Enemy) {
  e.timer = 0;
  if (e.angler) updateAngler(g, e, 1 / 60);
  else updateWallcrawler(g, e, 1 / 60);
  g.machineBreakdown.update();
}
function fill(g: Game, count: number) {
  for (let i = 0; i < count; i++)
    g.addShot({
      pos: { x: 40, y: 40 },
      vel: { x: 0, y: 0 },
      damage: 1,
      life: 10,
      radius: 2,
      friendly: false,
      bounces: 0,
    });
  assert.equal(g.shots.length, count);
}

test('Angler bank gimbal, barrel and unchanged warning diamond follow the actual locked terrain plan and admitted round', () => {
  const { g, e } = native('angler');
  e.timer = 0;
  until(g, e, () => e.state === 'windup');
  const plan = e.angler!.plan!;
  assert(plan);
  const p = surfaceMachinePose(snapshot(g, e));
  close(p.barrel.origin.x + e.body.position.x, plan.start.x);
  close(p.barrel.origin.y + e.body.position.y, plan.start.y);
  assert.equal(p.recoil, 0);
  assert(p.shutters.every((s) => s.open === 0));
  const c = canvas(true),
    points = anglerWarningPoints(g, e);
  draw(c.c, g, e);
  assert.equal(c.depth, 0);
  assert(
    c.ops.some(
      (o) => o.name === 'moveTo' && o.args[0] === plan.start.x && o.args[1] === plan.start.y,
    ),
  );
  for (const q of points.slice(1))
    assert(c.ops.some((o) => o.name === 'lineTo' && o.args[0] === q.x && o.args[1] === q.y));
  if (points.length === 3)
    assert(
      c.ops.some(
        (o) =>
          o.name === 'moveTo' && o.args[0] === plan.bounce.x && o.args[1] === plan.bounce.y - 6,
      ),
    );
  g.shots = [];
  release(g, e);
  assert.equal(g.shots.length, 1);
  const shot = g.shots[0];
  assert(shot.angler);
  assert.deepEqual(shot.pos, plan.start);
  const fired = surfaceMachinePose(snapshot(g, e));
  assert(fired.recoil > 0.99);
  close(fired.barrel.origin.x + e.body.position.x, shot.pos.x);
  close(fired.barrel.origin.y + e.body.position.y, shot.pos.y);
  assert.equal(e.angler!.exposed, 0);
  assert(
    fired.shutters.every((s) => s.open === 0),
    'ordinary recovery cannot pretend to expose the native casing',
  );
});

test('breaking the real bank opens Angler shutters for the entire actual exposure interval, without a fake shot or early closing', () => {
  const { g, e } = native('angler');
  e.timer = 0;
  until(g, e, () => e.state === 'windup');
  const body = e.angler!.plan!.body;
  g.destruction.hitBody(body, 100000, { x: 0, y: 0 });
  updateAngler(g, e, 1 / 60);
  g.machineBreakdown.update();
  assert.equal(e.angler!.plan, undefined);
  assert.equal(e.attacks, 0);
  assert.equal(g.shots.length, 0);
  const opened = surfaceMachinePose(snapshot(g, e));
  assert(opened.shutters.every((s) => s.open === 1));
  assert.equal(opened.mode, 'exposed');
  assert.equal(opened.recoil, 0);
  updateAngler(g, e, ANGLER.exposed - 0.01);
  const almost = surfaceMachinePose(snapshot(g, e));
  assert(e.angler!.exposed > 0);
  assert.deepEqual(
    almost.shutters,
    opened.shutters,
    'native vulnerability remains fully visible until it actually ends',
  );
  updateAngler(g, e, 0.02);
  assert.equal(e.angler!.exposed, 0);
  assert(surfaceMachinePose(snapshot(g, e)).shutters.every((s) => s.open === 0));
});

test('Wallcrawler has a separate real receiver recoil for each of its three individually admitted timed shots', () => {
  const { g, e } = native('wallcrawler');
  e.timer = 0;
  until(g, e, () => e.state === 'windup');
  const angles = [...e.crawler!.angles],
    origin = { ...e.crawler!.origin };
  assert.equal(angles.length, 3);
  g.shots = [];
  for (let i = 0; i < 3; i++) {
    if (i) {
      g.time += CRAWLER.burst;
      assert.equal(surfaceMachinePose(snapshot(g, e)).recoil, 0);
    }
    release(g, e);
    assert.equal(e.crawler!.fired, i + 1);
    assert.equal(g.shots.length, i + 1);
    const p = surfaceMachinePose(snapshot(g, e)),
      s = g.shots.at(-1)!;
    assert(p.recoil > 0.99);
    close(p.barrel.angle, angles[i]);
    close(s.pos.x, origin.x + Math.cos(angles[i]) * 26);
    close(s.pos.y, origin.y + Math.sin(angles[i]) * 26);
    close(p.barrel.origin.x + e.body.position.x, s.pos.x);
    close(p.barrel.origin.y + e.body.position.y, s.pos.y);
    assert.equal(snapshot(g, e).surfaceMachine!.discharges.at(-1)!.index, i);
  }
  assert.equal(e.attacks, 1);
  assert.equal(e.state, 'recover');
});

test('full caps cannot invent recoil; a partially available Wallcrawler burst records only its one admitted shot', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind);
    e.timer = 0;
    until(g, e, () => e.state === 'windup');
    fill(g, 180);
    release(g, e);
    assert.equal(g.shots.length, 180);
    assert.equal(surfaceMachinePose(snapshot(g, e)).recoil, 0);
    assert.equal(snapshot(g, e).surfaceMachine!.discharges.length, 0);
  }
  const { g, e } = native('wallcrawler');
  e.timer = 0;
  until(g, e, () => e.state === 'windup');
  fill(g, 179);
  release(g, e);
  assert.equal(g.shots.length, 180);
  assert.equal(snapshot(g, e).surfaceMachine!.discharges.length, 1);
  for (let i = 1; i < 3; i++) {
    g.time += CRAWLER.burst;
    release(g, e);
    assert.equal(surfaceMachinePose(snapshot(g, e)).recoil, 0);
    assert.equal(snapshot(g, e).surfaceMachine!.discharges.length, 1);
  }
  assert.equal(e.attacks, 1);
});

test('floor, wall and ceiling grip pads lie on the actual host plane and are not rotated twice with the armor', () => {
  for (const face of ['floor', 'wall', 'ceiling'] as const) {
    const { g, e } = native('wallcrawler', face),
      s = snapshot(g, e),
      p = surfaceMachinePose(s),
      contact = s.surfaceMachine!.crawler!.contact!;
    assert(contact);
    assert.equal(p.grip, 1);
    assert(p.pads.some((p) => p.planted));
    const n = e.crawler!.normal;
    close(p.angle, Math.atan2(n.y, n.x) + Math.PI / 2);
    assert.deepEqual(p.normal, n);
    for (const pad of p.pads.filter((p) => p.planted)) {
      const world = { x: pad.point.x + e.body.position.x, y: pad.point.y + e.body.position.y };
      close((world.x - contact.a.x) * n.x + (world.y - contact.a.y) * n.y, 0);
      assert(
        world.x >= Math.min(contact.a.x, contact.b.x) - 1e-7 &&
          world.x <= Math.max(contact.a.x, contact.b.x) + 1e-7,
      );
      assert(
        world.y >= Math.min(contact.a.y, contact.b.y) - 1e-7 &&
          world.y <= Math.max(contact.a.y, contact.b.y) + 1e-7,
      );
    }
    const c = canvas();
    drawSurfaceChassis(c.c, s);
    assert.equal(c.depth, 0);
  }
});

test('native corner movement changes the support normal, then breaking the real host cancels the queue and makes unplanted falling hardware', () => {
  const { g, e } = native('wallcrawler', 'wall');
  e.timer = 100;
  const before = { ...e.crawler!.normal };
  until(g, e, () => e.crawler!.normal.x !== before.x || e.crawler!.normal.y !== before.y);
  const corner = surfaceMachinePose(snapshot(g, e));
  assert.equal(corner.grip, 1);
  assert.notDeepEqual(corner.normal, before);
  const body = e.crawler!.support!,
    position = { ...e.body.position };
  g.destruction.hitBody(body, 100000, { x: 0, y: -1 });
  g.machineBreakdown.update();
  assert.equal(e.crawler!.support, undefined);
  assert.deepEqual(e.body.position, position);
  assert.equal(e.crawler!.angles.length, 0);
  const dropped = surfaceMachinePose(snapshot(g, e));
  assert.equal(dropped.mode, 'fallen');
  assert.equal(dropped.grip, 0);
  assert(dropped.pads.every((p) => !p.planted));
  assert(e.crawler!.vulnerable > 0);
  g.hitStop = 0;
  for (let i = 0; i < 10; i++) g.tick(1 / 60, idle);
  assert(e.body.position.y > position.y);
  assert.notEqual(surfaceMachinePose(snapshot(g, e)).angle, dropped.angle);
  assert.equal(e.attacks, 0);
});

test('queued Wallcrawler warnings shrink after real shots and portraits suppress all native world paths and health bars', () => {
  const { g, e } = native('wallcrawler');
  e.timer = 0;
  until(g, e, () => e.state === 'windup');
  release(g, e);
  const c = canvas(true);
  draw(c.c, g, e);
  for (const angle of e.crawler!.angles.slice(e.crawler!.fired)) {
    const from = {
      x: e.crawler!.origin.x + Math.cos(angle) * 26,
      y: e.crawler!.origin.y + Math.sin(angle) * 26,
    };
    assert(c.ops.some((o) => o.name === 'moveTo' && o.args[0] === from.x && o.args[1] === from.y));
  }
  for (const kind of kinds) {
    const f = native(kind);
    f.e.timer = 0;
    until(f.g, f.e, () => f.e.state === 'windup');
    f.e.hp = 1;
    const portrait = canvas();
    draw(portrait.c, f.g, f.e, false, true);
    assert.equal(portrait.depth, 0);
    assert(!portrait.ops.some((o) => o.name === 'fillRect' && o.args[2] === 32 && o.args[3] === 3));
  }
});

test('actual local hit contacts and65/30 wear replace whole-body flash for both surface machines', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind),
      max = e.maxHp;
    g.hitEnemy(e, max * 0.36, { x: e.body.position.x - 80, y: e.body.position.y }, false);
    assert.equal(surfaceMachinePose(snapshot(g, e)).wear, 1);
    assert(g.machineBreakdown.getHits(e.id).at(-1)!.contact);
    const a = canvas();
    drawSurfaceChassis(a.c, snapshot(g, e));
    e.flash = 0;
    const b = canvas();
    drawSurfaceChassis(b.c, snapshot(g, e));
    assert.deepEqual(a.ops, b.ops);
    const contact = canvas();
    drawMachineContacts(contact.c, g, e, false);
    assert(contact.ops.some((o) => o.name === 'arc' && o.args[2] === 2.8));
    g.hitEnemy(e, max * 0.35, { x: e.body.position.x + 80, y: e.body.position.y }, false);
    assert(e.hp > 0);
    assert.equal(surfaceMachinePose(snapshot(g, e)).wear, 2);
  }
});

test('all surface rigs render bounded finite hardware across three mount faces, state, wear, aim, faction and Reduced Effects', () => {
  let count = 0;
  for (const [kind, face] of [
    ['angler', 'floor'],
    ['wallcrawler', 'floor'],
    ['wallcrawler', 'wall'],
    ['wallcrawler', 'ceiling'],
  ] as [SurfaceMachineKind, SurfaceFace][]) {
    const { g, e } = native(kind, face);
    for (const state of ['idle', 'windup', 'recover'] as Enemy['state'][])
      for (const ratio of [1, 0.65, 0.3])
        for (const facing of [-1, 1])
          for (const reduced of [false, true])
            for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
              e.state = state;
              e.timer = 0.2;
              e.hp = e.maxHp * ratio;
              e.facing = facing;
              e.allied = facing < 0;
              e.aim = { x: Math.cos(angle), y: Math.sin(angle) };
              const s = snapshot(g, e),
                p = surfaceMachinePose(s, reduced),
                c = canvas();
              numeric(p);
              drawSurfaceChassis(c.c, s, reduced, p);
              assert.equal(c.depth, 0);
              assert(c.ops.length < 900);
              const shared = canvas();
              drawMachineChassis(shared.c, s, reduced);
              assert.deepEqual(shared.ops, c.ops);
              count++;
            }
  }
  assert.equal(count, 576);
});

test('read-only body and warning rendering preserve real physics, host/plan state, RNG, shots, saves and audio', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind);
    e.timer = 0;
    until(g, e, () => e.state === 'windup');
    const capture = () =>
      JSON.stringify({
        save: g.checkpointSnapshot(),
        state: e.state,
        timer: e.timer,
        hp: e.hp,
        pos: e.body.position,
        vel: e.body.velocity,
        aim: e.aim,
        plan: e.angler
          ? {
              exposed: e.angler.exposed,
              origin: e.angler.plan?.origin,
              bounce: e.angler.plan?.bounce,
              body: e.angler.plan?.body.id,
            }
          : null,
        crawler: e.crawler
          ? {
              normal: e.crawler.normal,
              support: e.crawler.support?.id,
              origin: e.crawler.origin,
              angles: e.crawler.angles,
              fired: e.crawler.fired,
              travel: e.crawler.travel,
            }
          : null,
        shots: g.shots,
        particles: g.particles,
        props: g.props.items.map((p) => ({
          id: p.body.id,
          pos: p.body.position,
          vel: p.body.velocity,
          hp: p.hp,
        })),
      });
    const before = capture(),
      id = (Matter.Common as unknown as { _nextId: number })._nextId;
    g.rng = () => {
      throw Error('draw RNG');
    };
    g.onSound = () => {
      throw Error('draw audio');
    };
    g.onCheckpoint = () => {
      throw Error('draw save');
    };
    for (const reduced of [false, true]) {
      const c = canvas(true);
      draw(c.c, g, e, reduced);
      assert.equal(c.depth, 0);
    }
    assert.equal(capture(), before);
    assert.equal((Matter.Common as unknown as { _nextId: number })._nextId, id);
  }
});

test('Pause freezes articulated hardware and Reduced Effects suppresses secondary release motion while retaining true mount/exposure', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind);
    e.timer = 0;
    until(g, e, () => e.state === 'windup');
    release(g, e);
    const p = surfaceMachinePose(snapshot(g, e));
    g.setMode('paused');
    for (let i = 0; i < 20; i++) g.tick(1 / 60, idle);
    assert.deepEqual(surfaceMachinePose(snapshot(g, e)), p);
    const a = canvas();
    drawSurfaceChassis(a.c, snapshot(g, e), true);
    g.time += 1;
    const b = canvas();
    drawSurfaceChassis(b.c, snapshot(g, e), true);
    assert.deepEqual(a.ops, b.ops);
  }
});
