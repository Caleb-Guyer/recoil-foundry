import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import type { Level } from '../src/levels.ts';
import { operatorSurfaceContact } from '../src/operator-surface.ts';
import { drawOperatorSurface } from '../src/operator-surface-art.ts';
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1700, y: 680 },
};
const level: Level = {
  id: 'operator-contact-native',
  name: 'Real contact course',
  area: 'cooling',
  boss: false,
  mirrored: false,
  solids: [{ x: 680, y: 660, w: 260, h: 22 }],
  spawns: [{ kind: 'shooter', x: 1850, y: 724 }],
  route: [],
  coolant: [{ x: 1000, y: 730, w: 430, h: 10 }],
  setpiece: { rosters: [[0]], weak: [], props: [] },
};
function fixture() {
  const g = new Game();
  const cp = {
    version: 6 as const,
    seed: 'RF-C108-OPCONTACT',
    stage: 8,
    hp: 100,
    mods: [],
    kills: 0,
    elapsed: 0,
  };
  g.start(cp.seed, cp, null, { ...cp, rematchRoom: structuredClone(level) });
  return g;
}
function place(g: Game, x: number, y: number, v = { x: 0, y: 0 }) {
  Matter.Body.setPosition(g.player, { x, y });
  Matter.Body.setVelocity(g.player, v);
  g.operatorSurface.reset();
  g.grounded = false;
  g.landingSpeed = 0;
}
function tick(g: Game, n: number, input: Input = idle) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, input);
}

test('materials come from actual polygon support and real coolant bounds, never area or stale grounded state', () => {
  const g = fixture();
  place(g, 140, 722);
  assert.equal(operatorSurfaceContact(g)!.surface, 'metal');
  place(g, 780, 642);
  assert.equal(operatorSurfaceContact(g)!.surface, 'grating');
  assert.equal(operatorSurfaceContact(g)!.point.y, 660);
  place(g, 1200, 722);
  assert.equal(operatorSurfaceContact(g)!.surface, 'coolant');
  place(g, 980, 722);
  assert.equal(operatorSurfaceContact(g)!.surface, 'metal');
  place(g, 1200, 670);
  g.grounded = true;
  assert.equal(operatorSurfaceContact(g), null, 'air above a pool is not wet contact');
  place(g, 780, 600);
  g.grounded = true;
  assert.equal(
    operatorSurfaceContact(g),
    null,
    'stale native grounded cannot create a floating step',
  );
  place(g, 1200, 722, { x: 0, y: -10 });
  assert.equal(operatorSurfaceContact(g), null, 'leaving support suppresses contact');
});

test('moving counterweights, conveyors and native props retain their real support identity and velocity', () => {
  const g = fixture();
  const cw = g.counterweights.spawn({ x: 520, y: 500, w: 200 });
  Matter.Body.setVelocity(cw.body, { x: 2, y: -0.4 });
  place(g, 520, 472);
  let c = operatorSurfaceContact(g)!;
  assert.equal(c.body, cw.body);
  assert.equal(c.surface, 'grating');
  assert.equal(c.supportVelocity.x, 2);
  const crate = g.props.spawn('crate', 420, 718);
  Matter.Body.setVelocity(crate.body, { x: 1.8, y: 0 });
  place(g, 420, 678);
  c = operatorSurfaceContact(g)!;
  assert.equal(c.body, crate.body);
  assert.equal(c.surface, 'metal');
  assert(Math.abs(c.supportVelocity.x - 1.8) < 1e-10);
  g.conveyors.items = [{ x: 60, y: 740, w: 480, speed: 2.4 }];
  place(g, 140, 722);
  c = operatorSurfaceContact(g)!;
  assert.equal(c.surface, 'grating');
  assert.equal(c.beltSpeed, 2.4);
  assert.equal(c.supportVelocity.x, 2.4);
});

test('native walking has bounded spatial footsteps; idle, air and passive belt carriage are quiet', () => {
  const g = fixture();
  const events: { kind: string; x?: number; y?: number }[] = [];
  g.onSound = (kind, at) => {
    if (kind.startsWith('operator-')) events.push({ kind, x: at?.x, y: at?.y });
  };
  tick(g, 60);
  assert.equal(events.length, 0, 'room entry and idling make no fake step');
  tick(g, 78, { ...idle, right: true });
  const walk = events.filter((e) => e.kind === 'operator-step-metal');
  assert(walk.length >= 2 && walk.length <= 6, JSON.stringify(events));
  assert(events.every((e) => Number.isFinite(e.x) && Number.isFinite(e.y)));
  assert(g.operatorSurface.marks.length <= 12);
  place(g, 140, 520, { x: 7, y: -3 });
  events.length = 0;
  tick(g, 8, { ...idle, right: true });
  assert.equal(events.length, 0, 'air movement is quiet');
  place(g, 140, 722);
  g.conveyors.items = [{ x: 0, y: 740, w: 600, speed: 2.4 }];
  events.length = 0;
  tick(g, 100);
  assert.equal(events.length, 0, 'a moving belt does not make idle boots walk');
});

test('actual braking creates one bounded scrape and truthful brake pose, independent of aim', () => {
  const g = fixture();
  const sounds: string[] = [];
  g.onSound = (kind) => {
    if (kind.startsWith('operator-')) sounds.push(kind);
  };
  tick(g, 25, { ...idle, right: true });
  const before = g.player.velocity.x;
  assert(before > 5);
  tick(g, 1, idle);
  assert(g.operatorSurface.braking > 0);
  assert(g.operatorSurface.diagnostics.skids <= 1);
  const frozen = { ...g.operatorSurface.diagnostics };
  const contact = g.operatorSurface.contact;
  g.setMode('paused');
  tick(g, 100, { ...idle, left: true });
  assert.deepEqual(g.operatorSurface.diagnostics, frozen);
  assert.equal(g.operatorSurface.contact, contact);
  g.setMode('playing');
  tick(g, 1);
  assert.equal(g.operatorSurface.braking, 0);
  tick(g, 30);
  Matter.Body.setVelocity(g.player, { x: 12, y: 0 });
  tick(g, 3, idle);
  assert(g.operatorSurface.diagnostics.skids >= 1);
  assert(sounds.filter((k) => k === 'operator-skid-metal').length <= 2);
});

test('real coolant landing adds one quiet splash while old landing thud and heavy haptic remain intact', () => {
  const g = fixture();
  place(g, 1200, 722);
  tick(g, 5);
  const sounds: string[] = [];
  const haptics: string[] = [];
  g.onSound = (kind) => sounds.push(kind);
  g.onHaptic = (kind) => haptics.push(kind);
  tick(g, 1, { ...idle, jump: true, jumpHeld: true });
  tick(g, 100, { ...idle, jumpHeld: true });
  assert.equal(g.mode, 'playing');
  assert.equal(operatorSurfaceContact(g)!.surface, 'coolant');
  assert.equal(sounds.filter((k) => k === 'operator-land-coolant').length, 1);
  assert.equal(sounds.filter((k) => k === 'land').length, 1);
  assert.equal(haptics.filter((k) => k === 'land').length, 1);
  assert.equal(g.operatorSurface.diagnostics.landings, 1);
});

test('teleports, room resets and menus cannot cash stored stride distance or landing speed', () => {
  const g = fixture();
  tick(g, 18, { ...idle, right: true });
  const sounds: string[] = [];
  g.onSound = (k) => {
    if (k.startsWith('operator-')) sounds.push(k);
  };
  Matter.Body.setPosition(g.player, { x: 1200, y: 722 });
  g.portals.revision++;
  tick(g, 1, { ...idle, right: true });
  assert.equal(sounds.length, 0);
  g.loadRoom();
  assert.equal(g.operatorSurface.marks.length, 0);
  assert.equal(g.operatorSurface.diagnostics.steps, 0);
  tick(g, 1);
  assert.equal(sounds.length, 0);
  for (const mode of ['upgrade', 'title', 'dead'] as const) {
    g.setMode(mode);
    tick(g, 20, { ...idle, right: true });
    assert.equal(sounds.length, 0);
  }
});

test('surface presentation does not mutate native physics, progression, native random stream or saves', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  const a = fixture(),
    b = fixture();
  b.operatorSurface.update = () => {};
  for (let i = 0; i < 110; i++) {
    const input = { ...idle, right: i < 75, jump: i === 40, jumpHeld: i < 48 };
    a.tick(1 / 60, input);
    b.tick(1 / 60, input);
  }
  assert.deepEqual(a.player.position, b.player.position);
  assert.deepEqual(a.player.velocity, b.player.velocity);
  assert.deepEqual(a.checkpointSnapshot(), b.checkpointSnapshot());
  assert.equal(a.rng(), b.rng());
  const c = new Proxy({ globalAlpha: 1 } as CanvasRenderingContext2D, {
    get(target, key) {
      if (key in target) return (target as any)[key];
      return (...args: unknown[]) =>
        assert(args.every((v) => typeof v !== 'number' || Number.isFinite(v)));
    },
    set(target, key, value) {
      if (key === 'globalAlpha') assert(value >= 0 && value <= 1);
      (target as any)[key] = value;
      return true;
    },
  });
  const before = JSON.stringify(a.operatorSurface.diagnostics);
  drawOperatorSurface(c, a, false);
  drawOperatorSurface(c, a, true);
  assert.equal(JSON.stringify(a.operatorSurface.diagnostics), before);
});

for (const material of ['grating', 'coolant'] as const)
  test('native steps use ' + material + ' only while boots contact its actual geometry', () => {
    const g = fixture();
    place(g, material === 'grating' ? 700 : 1060, material === 'grating' ? 642 : 722);
    tick(g, 4);
    const sounds: string[] = [];
    g.onSound = (kind) => {
      if (kind.startsWith('operator-step')) sounds.push(kind);
    };
    tick(g, 45, { ...idle, right: true, move: material === 'grating' ? 0.5 : 1 });
    assert(sounds.includes('operator-step-' + material), JSON.stringify(sounds));
    assert(sounds.every((kind) => kind === 'operator-step-' + material));
  });

test('Pause holds existing contact marks at the exact same frame without emitting new marks', () => {
  const g = fixture();
  place(g, 1060, 722);
  tick(g, 4);
  tick(g, 22, { ...idle, right: true });
  assert(g.operatorSurface.marks.length > 0, 'native movement creates the contact marks');
  const draw = () => {
    const ops: unknown[][] = [];
    const c = new Proxy(
      {
        globalAlpha: 1,
        lineWidth: 1,
        fillStyle: '',
        strokeStyle: '',
      } as unknown as CanvasRenderingContext2D,
      {
        get(target, key) {
          if (key in target) return (target as any)[key];
          return (...args: unknown[]) => ops.push([String(key), ...args]);
        },
        set(target, key, value) {
          (target as any)[key] = value;
          return true;
        },
      },
    );
    drawOperatorSurface(c, g, false);
    return ops;
  };
  const before = draw(),
    time = g.time,
    marks = JSON.stringify(g.operatorSurface.marks);
  assert(before.length > 2);
  g.setMode('paused');
  tick(g, 120, idle);
  assert.equal(g.time, time);
  assert.equal(JSON.stringify(g.operatorSurface.marks), marks);
  assert.deepEqual(draw(), before, 'visible splashes/skids stay frozen under Pause');
  g.setMode('title');
  assert.equal(draw().length, 0, 'menus still suppress contact effects');
});
