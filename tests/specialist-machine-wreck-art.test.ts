import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { Renderer } from '../src/render.ts';
import {
  drawMachineWreck,
  drawMachineWrecks,
  projectMachineWreck,
} from '../src/machine-breakdown-wreck-art.ts';
import {
  specialistShutdownPose,
  drawSpecialistMachineWreck,
} from '../src/specialist-machine-wreck-art.ts';
import {
  specialistMachinePose,
  type SpecialistMachineKind,
} from '../src/specialist-machine-pose.ts';
import { drawSpecialistChassis } from '../src/specialist-machine-art.ts';
import type { MachineWreck } from '../src/machine-breakdown.ts';
import {
  specialistMachineTestFromUrl,
  specialistMachineTestRoom,
  prepareSpecialistMachineTest,
} from '../src/specialist-machines-test.ts';
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

function native(kind: SpecialistMachineKind, elite: 'plain' | 'twin' = 'plain', airborne = false) {
  const fixture = specialistMachineTestFromUrl(
    new URL(
      'https://test/?test=specialists&unit=' + kind + '&scene=wreckage&elite=' + elite + '&v=1',
    ),
  )!;
  assert(fixture);
  const g = new Game();
  g.startTest(fixture.checkpoint, specialistMachineTestRoom(fixture));
  assert(prepareSpecialistMachineTest(g, fixture));
  const e = g.enemies.find((enemy) => enemy.kind === kind)!;
  assert(e);
  e.spawn = 0;
  e.state = airborne ? 'airborne' : 'windup';
  e.timer = 0.05;
  if (airborne) {
    Matter.Body.setPosition(e.body, { x: 950, y: 420 });
    Matter.Body.setVelocity(e.body, { x: 2, y: -5 });
  }
  g.hitEnemy(e, 10000);
  const wreck = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id)!;
  assert(wreck, 'a real lethal hit must create a native specialist snapshot');
  return { g, e, wreck };
}
const draw = (wreck: MachineWreck, age: number, reduced = false) => {
  const c = canvas(),
    before = structuredClone(wreck);
  assert(drawMachineWreck(c.context, wreck, wreck.at + age, reduced));
  assert.deepEqual(wreck, before);
  assert.equal(c.depth, 0);
  assert.equal(c.values.globalAlpha, 0.85);
  return c.ops;
};

test('Charger shutdown retracts its actual ram and folds drive joints without rescaling the body', () => {
  const { wreck } = native('charger');
  const start = specialistShutdownPose(wreck.visual, 0)!,
    end = specialistShutdownPose(wreck.visual, 0.38)!;
  assert(start.ram > 0.2);
  assert.equal(end.ram, 0);
  assert(end.body.y > start.body.y + 2);
  assert.equal(end.legs.length, start.legs.length);
  assert.notDeepEqual(end.legs, start.legs);
  assert(end.legs.every((leg) => leg.planted));
  assert.equal(
    end.drive,
    specialistShutdownPose(wreck.visual, 1)!.drive,
    'drive coasts to a full stop',
  );
  assert.notDeepEqual(draw(wreck, 0.02), draw(wreck, 0.38));
  assert.deepEqual(
    draw(wreck, 0.38).filter((op) => op.name === 'scale'),
    draw(wreck, 0.02).filter((op) => op.name === 'scale'),
    'collapse retains the exact native split/facing scale while its joints change',
  );
});

test('Hopper shutdown releases the native compressed spring and folds the actual knee joints', () => {
  const { wreck } = native('hopper');
  const start = specialistShutdownPose(wreck.visual, 0)!,
    end = specialistShutdownPose(wreck.visual, 0.38)!;
  assert(start.compression > 0.5);
  assert.equal(end.compression, 0);
  assert.notDeepEqual(start.legs, end.legs);
  assert(end.legs.every((leg) => leg.planted));
  const ops = draw(wreck, 0.38);
  assert(
    ops.some((op) => op.name === 'quadraticCurveTo'),
    'released spring leaves a slack inert end',
  );
  assert.notDeepEqual(draw(wreck, 0.05), ops);
});

test('Sniper tripod buckles, tracking stops and Twin retains two actual long barrels', () => {
  for (const elite of ['plain', 'twin'] as const) {
    const { wreck } = native('sniper', elite);
    const start = specialistShutdownPose(wreck.visual, 0)!,
      end = specialistShutdownPose(wreck.visual, 0.38)!;
    assert.equal(end.tracking, false);
    assert.equal(end.locked, false);
    assert.equal(end.brace, 0);
    assert.deepEqual(end.breech, [0, 0]);
    assert.notDeepEqual(start.legs, end.legs);
    const ops = draw(wreck, 0.38);
    assert.equal(
      ops.filter(
        (op) => op.name === 'fillRect' && op.args[0] === 7 && op.args[2] === 30 && op.args[3] === 4,
      ).length,
      elite === 'twin' ? 2 : 1,
    );
    assert(
      (end.barrel > 0 && end.barrel < 0.4) || end.barrel > Math.PI - 0.4,
      'the barrel rests downward, not at an active aiming lock',
    );
  }
});

test('specialist rendering reuses the exact shared inactive chassis and leaves ordinary dispatch untouched', () => {
  for (const kind of ['charger', 'hopper', 'sniper'] as const) {
    const { wreck } = native(kind),
      projection = projectMachineWreck(wreck, wreck.at + 0.25)!;
    const c = canvas(),
      p = specialistShutdownPose(wreck.visual, 0.25)!;
    const inactive = {
      ...wreck.visual,
      hp: 0,
      flash: 0,
      brace: 0,
      timer: 0,
      state: 'recover' as const,
      velocity: { x: 0, y: 0 },
    };
    drawSpecialistChassis(c.context, inactive, false, p);
    const combined = canvas();
    const returned = drawSpecialistMachineWreck(combined.context, wreck, projection);
    assert(returned);
    assert.deepEqual(
      combined.ops.slice(0, c.ops.length),
      c.ops,
      'body art is the production specialist rig, not a redraw',
    );
    const ordinary = structuredClone(wreck);
    ordinary.visual.kind = 'runner';
    const empty = canvas();
    assert.equal(drawSpecialistMachineWreck(empty.context, ordinary, projection), null);
    assert.deepEqual(empty.ops, []);
  }
});

test('airborne Hopper settles only on actual support; unsupported specialists never invent a floor', () => {
  const { wreck } = native('hopper', 'plain', true);
  assert(wreck.landing?.available);
  const start = projectMachineWreck(wreck, wreck.at)!,
    end = projectMachineWreck(wreck, wreck.at + 0.8)!;
  assert(end.position.y > start.position.y);
  assert.deepEqual(end.position, wreck.landing.center);
  assert(
    draw(wreck, 0.8).some((op) => op.name === 'clip'),
    'same real support clip is reused for specialists',
  );
  const unsupported = structuredClone(wreck);
  unsupported.landing = null;
  unsupported.visual.position.y = -1000;
  assert(projectMachineWreck(unsupported, unsupported.at + 0.6)!.position.y < -980);
  assert.equal(projectMachineWreck(unsupported, unsupported.at + 0.75), null);
  const empty = canvas();
  assert.equal(drawMachineWreck(empty.context, unsupported, unsupported.at + 0.75), false);
  assert.deepEqual(empty.ops, []);
});

test('Reduced Effects shows a fixed defeated specialist, then clears it within the existing concise lifetime', () => {
  for (const kind of ['charger', 'hopper', 'sniper'] as const) {
    const { wreck } = native(kind);
    assert.deepEqual(draw(wreck, 0.1, true), draw(wreck, 0.3, true));
    assert.notDeepEqual(draw(wreck, 0.1), draw(wreck, 0.1, true));
    assert.equal(projectMachineWreck(wreck, wreck.at + 0.9, true), null);
    assert.equal(projectMachineWreck(wreck, wreck.at + 2.4), null);
  }
});

test('native specialist rendering stays bounded, finite and read-only without RNG, new collisions, sound or profile callbacks', () => {
  for (const kind of ['charger', 'hopper', 'sniper'] as const) {
    const { g, wreck } = native(kind);
    g.time += 0.3;
    const before = structuredClone(g.machineBreakdown.wrecks),
      bodyIds = Matter.Composite.allBodies(g.engine.world).map((b) => b.id),
      health = g.hp,
      kills = g.kills;
    const random = Math.random,
      rng = g.rng;
    Math.random = g.rng = () => {
      throw new Error('rendering must not consume RNG');
    };
    g.onSound = () => {
      throw new Error('rendering must not play sound');
    };
    g.onCheckpoint = () => {
      throw new Error('rendering must not save');
    };
    try {
      const c = canvas();
      drawMachineWrecks(c.context, g);
      assert(c.ops.length > 100 && c.ops.length < 650);
      assert.equal(c.depth, 0);
      assert.deepEqual(g.machineBreakdown.wrecks, before);
      assert.deepEqual(
        Matter.Composite.allBodies(g.engine.world).map((b) => b.id),
        bodyIds,
      );
      assert.equal(g.hp, health);
      assert.equal(g.kills, kills);
      const pose = specialistMachinePose(wreck.visual);
      assert(pose.specialist);
      assert.equal(specialistShutdownPose(wreck.visual, 0.38)!.wear, 2);
    } finally {
      Math.random = random;
      g.rng = rng;
    }
  }
});

test('production Renderer keeps specialist wrecks below live bodies, the Operator and attack warnings, including Pause', () => {
  const { g } = native('sniper', 'twin');
  g.time += 0.4;
  const c = canvas(true),
    element = {
      getContext: () => c.context,
      getBoundingClientRect: () => ({ width: 960, height: 600 }),
    } as unknown as HTMLCanvasElement;
  const renderer = new Renderer(element, g);
  renderer.drawEnemies = () => c.ops.push({ name: 'layer:live', args: [] });
  renderer.drawPlayer = () => c.ops.push({ name: 'layer:player', args: [] });
  renderer.drawEnemyTells = () => c.ops.push({ name: 'layer:threats', args: [] });
  renderer.draw(1000, { camera: { x: 0, y: 0 }, scale: 1, player: true, navigation: false });
  const barrels = c.ops.findIndex(
    (op) => op.name === 'fillRect' && op.args[0] === 7 && op.args[2] === 30 && op.args[3] === 4,
  );
  const live = c.ops.findIndex((op) => op.name === 'layer:live'),
    player = c.ops.findIndex((op) => op.name === 'layer:player'),
    threats = c.ops.findIndex((op) => op.name === 'layer:threats');
  assert(barrels >= 0 && barrels < live && live < player && player < threats);
  const saved = structuredClone(g.machineBreakdown.wrecks),
    time = g.time;
  g.setMode('paused');
  for (let i = 0; i < 60; i++)
    g.tick(1 / 60, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: false,
      fire: false,
      aim: { x: 500, y: 400 },
    });
  assert.deepEqual(g.machineBreakdown.wrecks, saved);
  assert.equal(g.time, time);
  assert.equal(c.depth, 0);
});
