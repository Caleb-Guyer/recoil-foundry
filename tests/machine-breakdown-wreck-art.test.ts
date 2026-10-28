import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { Renderer } from '../src/render.ts';
import {
  machineShutdownPose,
  projectMachineWreck,
  drawMachineWreck,
  drawMachineWrecks,
} from '../src/machine-breakdown-wreck-art.ts';
import { MACHINE_MAX_WRECKS, type MachineWreck } from '../src/machine-breakdown.ts';
import { machinePose, type MachineKind } from '../src/machine-breakdown-pose.ts';
import {
  machineBreakdownTestFromUrl,
  machineBreakdownTestRoom,
  prepareMachineBreakdownTest,
} from '../src/machine-breakdown-test.ts';

type Op = { name: string; args: unknown[] };
function canvas(world = false) {
  const ops: Op[] = [],
    stack: Record<string, unknown>[] = [];
  const values: Record<string, unknown> = { globalAlpha: 0.85, lineWidth: 1 };
  const context = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, key) {
      if (key in values) return values[String(key)];
      if (key === 'createLinearGradient' || key === 'createRadialGradient')
        return () => ({ addColorStop() {} });
      if (key === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (key === 'measureText') return () => ({ width: 100 });
      return (...args: unknown[]) => {
        if (key === 'save') stack.push({ ...values });
        if (key === 'restore') {
          assert(stack.length > 0);
          Object.keys(values).forEach((k) => delete values[k]);
          Object.assign(values, stack.pop());
        }
        assert(
          args.every((n) => typeof n !== 'number' || Number.isFinite(n)),
          String(key) + ' must use finite geometry',
        );
        assert(
          world ||
            !['fillText', 'strokeText', 'drawImage', 'clearRect', 'setLineDash'].includes(
              String(key),
            ),
          'wrecks must not add captions, health bars or warning footprints',
        );
        if (key === 'arc' || key === 'ellipse') assert(Number(args[2]) >= 0);
        ops.push({ name: String(key), args });
      };
    },
    set(_target, key, value) {
      if (key === 'globalAlpha') assert(Number.isFinite(value) && value >= 0 && value <= 1);
      if (key === 'lineWidth') assert(Number.isFinite(value) && value > 0);
      values[String(key)] = value;
      ops.push({ name: 'style:' + String(key), args: [value] });
      return true;
    },
  });
  return {
    context,
    ops,
    values,
    get depth() {
      return stack.length;
    },
  };
}
function native(variant = 'plain') {
  const fixture = machineBreakdownTestFromUrl(
    new URL(
      'https://test/?test=machine-breakdown&scene=' +
        (variant === 'mixed' ? 'elites' : 'shutdowns') +
        '&unit=all&variant=' +
        variant +
        '&v=1',
    ),
  )!;
  assert(fixture);
  const g = new Game();
  g.startTest(fixture.checkpoint, machineBreakdownTestRoom(fixture));
  assert(prepareMachineBreakdownTest(g, fixture));
  const records: MachineWreck[] = [];
  for (const kind of ['runner', 'shooter', 'flyer'] as const) {
    const enemy = g.enemies.find((e) => e.kind === kind && e.body.position.x < 1500)!;
    assert(enemy);
    enemy.spawn = 0;
    g.hitEnemy(enemy, 10000);
    const wreck = g.machineBreakdown.wrecks.find((w) => w.visual.id === enemy.id)!;
    assert(wreck, 'a real lethal hit must produce the native bounded record');
    records.push(wreck);
  }
  return { g, records };
}
const one = (kind: MachineKind) => native().records.find((w) => w.visual.kind === kind)!;
const draw = (wreck: MachineWreck, age: number, reduced = false) => {
  const c = canvas(),
    before = structuredClone(wreck);
  drawMachineWreck(c.context, wreck, wreck.at + age, reduced);
  assert.deepEqual(wreck, before);
  assert.equal(c.depth, 0);
  assert.equal(c.values.globalAlpha, 0.85);
  return c.ops;
};

test('Runner knees buckle and Shooter stabilizers collapse through the shared native chassis pose', () => {
  for (const kind of ['runner', 'shooter'] as const) {
    const wreck = one(kind),
      original = structuredClone(wreck.visual);
    const start = machineShutdownPose(wreck.visual, 0),
      end = machineShutdownPose(wreck.visual, 0.38);
    assert.equal(start.legs.length, 2);
    assert.equal(end.legs.length, 2);
    assert(end.body.y > start.body.y + 3, 'shutdown lowers the native drive frame');
    assert.equal(end.wear, 2);
    assert.equal(end.brace, 0);
    assert.equal(end.receiver, 0);
    assert.equal(end.recover, false);
    for (let i = 0; i < 2; i++) {
      const a = start.legs[i],
        b = end.legs[i];
      assert(
        Math.hypot(b.hip.x - b.foot.x, b.hip.y - b.foot.y) <
          Math.hypot(a.hip.x - a.foot.x, a.hip.y - a.foot.y),
        'legs fold at their actual joints instead of a whole-body scale squash',
      );
      assert(b.planted);
    }
    assert.deepEqual(wreck.visual, original);
    assert.notDeepEqual(draw(wreck, 0.03), draw(wreck, 0.35));
  }
});

test('Flyer rotors lose speed, stop at shutdown and retain a separate broken blade', () => {
  const wreck = one('flyer'),
    s = wreck.visual;
  const early = machineShutdownPose(s, 0.05).rotor - machineShutdownPose(s, 0.04).rotor;
  const late = machineShutdownPose(s, 0.35).rotor - machineShutdownPose(s, 0.34).rotor;
  assert(early > late && late > 0);
  assert.equal(machineShutdownPose(s, 0.38).rotor, machineShutdownPose(s, 1.2).rotor);
  assert.equal(machineShutdownPose(s, 0.38).legs.length, 0);
  const ops = draw(wreck, 0.4);
  assert(
    ops.some((op) => op.name === 'fillRect' && op.args[2] === 12 && op.args[3] === 2),
    'broken blade remains a small inert part beside the native hull',
  );
});

test('native support centers bound descent and supported normal wrecks disappear by the model lifetime', () => {
  for (const wreck of native().records) {
    assert(wreck.landing?.available);
    assert.deepEqual(projectMachineWreck(wreck, wreck.at)!.position, wreck.visual.position);
    const settled = projectMachineWreck(wreck, wreck.at + 0.8)!;
    assert(settled.settled);
    assert.deepEqual(settled.position, wreck.landing.center);
    assert(
      projectMachineWreck(wreck, wreck.at + 1.4)!.alpha >
        projectMachineWreck(wreck, wreck.at + 2.2)!.alpha,
    );
    assert.equal(projectMachineWreck(wreck, wreck.at + 2.4), null);
    assert.deepEqual(draw(wreck, 2.4), []);
    assert.equal(projectMachineWreck(wreck, NaN), null);
    assert.equal(projectMachineWreck(wreck, wreck.at - 0.01), null);
  }
});

test('unsupported airborne wreckage fades near its real origin and never invents a world floor or ceiling landing', () => {
  const wreck = structuredClone(one('flyer'));
  wreck.landing = null;
  wreck.visual.position = { x: 800, y: -1000 };
  wreck.visual.velocity = { x: 1, y: -2 };
  const projected = projectMachineWreck(wreck, wreck.at + 0.6)!;
  assert(projected.position.y < -980);
  assert.equal(projected.settled, false);
  assert.equal(projectMachineWreck(wreck, wreck.at + 0.75), null);
  assert(
    !draw(wreck, 0.4).some((op) => op.name === 'clip'),
    'unknown support must not fabricate a clipping plane',
  );
});

test('support-plane clipping follows the actual contact and its normal without painting beneath platforms', () => {
  const wreck = one('shooter'),
    projection = projectMachineWreck(wreck, wreck.at + 0.8)!;
  assert(wreck.landing);
  const ops = draw(wreck, 0.8),
    clipAt = ops.findIndex((op) => op.name === 'clip');
  assert(clipAt > 0);
  const plane = ops.slice(0, clipAt).filter((op) => op.name === 'moveTo' || op.name === 'lineTo');
  assert.equal(plane.length, 4);
  const p = {
    x: (wreck.landing.point.x - projection.position.x) / wreck.visual.scale,
    y: (wreck.landing.point.y - projection.position.y) / wreck.visual.scale,
  };
  const normal = wreck.landing.normal;
  for (const [i, op] of plane.entries()) {
    const side = (Number(op.args[0]) - p.x) * normal.x + (Number(op.args[1]) - p.y) * normal.y;
    if (i < 2) assert(Math.abs(side) < 0.00001, 'clip boundary is the native surface');
    else assert(side > 0, 'clip retains the air above the native surface');
  }
});

test('removed supports use the shortened native remainder and cannot leave an enduring floating wreck', () => {
  const wreck = structuredClone(one('runner'));
  assert(wreck.landing);
  wreck.landing.available = false;
  wreck.lifetime = 1.16;
  const first = projectMachineWreck(wreck, wreck.at + 1)!;
  const later = projectMachineWreck(wreck, wreck.at + 1.1)!;
  assert(first.alpha > later.alpha);
  assert.deepEqual(first.position, later.position);
  assert.equal(projectMachineWreck(wreck, wreck.at + 1.16), null);
});

test('Reduced Effects keeps one concise static defeated silhouette and preserves real support', () => {
  for (const wreck of native().records) {
    assert.deepEqual(draw(wreck, 0.1, true), draw(wreck, 0.3, true));
    assert.deepEqual(
      projectMachineWreck(wreck, wreck.at + 0.1, true)!.position,
      wreck.landing!.center,
    );
    assert.equal(projectMachineWreck(wreck, wreck.at + 0.9, true), null);
    assert.notDeepEqual(draw(wreck, 0.1, true), draw(wreck, 0.1, false));
  }
});

test('actual shield, twin and mutation identities remain inert and never draw active energy warnings', () => {
  const mixed = native('mixed').records;
  const shield = mixed.find((w) => w.visual.elite === 'shielded')!;
  const twin = mixed.find((w) => w.visual.elite === 'twin')!;
  assert(shield && twin);
  assert(
    draw(shield, 0.5).some((op) => op.name === 'style:strokeStyle' && op.args[0] === '#69716b'),
  );
  assert.equal(
    draw(twin, 0.5).filter((op) => op.name === 'fillRect' && op.args[2] === 29 && op.args[3] === 4)
      .length,
    2,
  );
  for (const wreck of [...mixed, ...native('mutations').records]) {
    const ops = draw(wreck, 0.5);
    assert(
      !ops.some((op) =>
        op.args.some((arg) => ['#ffdaa1', '#ffe0a0', '#f3c68b', '#ffdb9b'].includes(String(arg))),
      ),
      'dead rigs have no active attack lamps',
    );
    assert(ops.some((op) => op.name === 'style:fillStyle' && op.args[0] === '#3c4849'));
  }
});

test('drawing is deterministic, finite, bounded and cannot advance physics, gameplay callbacks or RNG', () => {
  const { g, records } = native('mutations');
  g.time += 0.5;
  const bodies = Matter.Composite.allBodies(g.engine.world).map((b) => ({
    id: b.id,
    position: { ...b.position },
    velocity: { ...b.velocity },
  }));
  const before = structuredClone(g.machineBreakdown.wrecks),
    snapshot = g.checkpointSnapshot();
  const original = Math.random,
    rng = g.rng;
  Math.random = () => {
    throw new Error('wreck drawing must not sample random');
  };
  g.rng = () => {
    throw new Error('wreck drawing must not consume run RNG');
  };
  g.onSound = () => {
    throw new Error('wreck drawing must not sound');
  };
  g.onCheckpoint = () => {
    throw new Error('wreck drawing must not save');
  };
  try {
    const a = canvas(),
      b = canvas();
    drawMachineWrecks(a.context, g);
    drawMachineWrecks(b.context, g);
    assert.deepEqual(a.ops, b.ops, 'an identical paused clock produces identical wrecks');
    assert(a.ops.length < records.length * 550);
    assert.equal(a.depth, 0);
    assert.equal(b.depth, 0);
    assert.deepEqual(g.machineBreakdown.wrecks, before);
    assert.deepEqual(g.checkpointSnapshot(), snapshot);
    assert.deepEqual(
      Matter.Composite.allBodies(g.engine.world).map((body) => ({
        id: body.id,
        position: { ...body.position },
        velocity: { ...body.velocity },
      })),
      bodies,
    );
    g.machineBreakdown.wrecks = Array.from({ length: 100 }, () => structuredClone(records[0]));
    const capped = canvas();
    drawMachineWrecks(capped.context, g);
    assert.equal(capped.ops.filter((op) => op.name === 'clip').length, MACHINE_MAX_WRECKS);
  } finally {
    Math.random = original;
    g.rng = rng;
  }
});

test('the production Renderer paints actual wrecks beneath live actors, the Operator and hostile warning layers', () => {
  const { g } = native();
  g.time += 0.5;
  const a = canvas(true);
  const element = {
    getContext: () => a.context,
    getBoundingClientRect: () => ({ width: 960, height: 600 }),
  } as unknown as HTMLCanvasElement;
  const renderer = new Renderer(element, g);
  renderer.drawEnemies = () => {
    a.ops.push({ name: 'layer:live', args: [] });
  };
  renderer.drawPlayer = () => {
    a.ops.push({ name: 'layer:operator', args: [] });
  };
  renderer.drawEnemyTells = () => {
    a.ops.push({ name: 'layer:threats', args: [] });
  };
  renderer.draw(1000, { camera: { x: 0, y: 0 }, scale: 1, player: true, navigation: false });
  const inactive = a.ops.findIndex(
    (op) => op.name === 'style:fillStyle' && op.args[0] === '#3c4849',
  );
  const live = a.ops.findIndex((op) => op.name === 'layer:live');
  const player = a.ops.findIndex((op) => op.name === 'layer:operator');
  const threats = a.ops.findIndex((op) => op.name === 'layer:threats');
  assert(inactive >= 0 && inactive < live && live < player && player < threats);
  assert.equal(a.depth, 0);
  g.setMode('paused');
  const snapshot = structuredClone(g.machineBreakdown.wrecks),
    time = g.time;
  for (let i = 0; i < 30; i++)
    g.tick(1 / 60, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: false,
      fire: false,
      aim: { x: 600, y: 400 },
    });
  assert.equal(g.time, time);
  assert.deepEqual(g.machineBreakdown.wrecks, snapshot);
});
