import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { Renderer } from '../src/render.ts';
import {
  drawMachineWreck,
  drawMachineWrecks,
  projectMachineWreck,
} from '../src/machine-breakdown-wreck-art.ts';
import { supportShutdownPose, drawSupportMachineWreck } from '../src/support-machine-wreck-art.ts';
import { supportMachinePose, type SupportMachineKind } from '../src/support-machine-pose.ts';
import { drawSupportChassis } from '../src/support-machine-art.ts';
import { MACHINE_MAX_WRECKS, type MachineWreck } from '../src/machine-breakdown.ts';
import {
  supportSystemsTestFromUrl,
  supportSystemsTestRoom,
  prepareSupportSystemsTest,
} from '../src/support-systems-test.ts';

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

const kinds = ['repairer', 'relay', 'fabricator', 'sentry'] as const;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 900, y: 650 },
};
function course(kind: SupportMachineKind, scene = 'wreckage') {
  const fixture = supportSystemsTestFromUrl(
    new URL('https://test/?test=support-systems&unit=' + kind + '&scene=' + scene + '&v=1'),
  )!;
  assert(fixture);
  const g = new Game();
  g.startTest(fixture.checkpoint, supportSystemsTestRoom(fixture));
  assert(prepareSupportSystemsTest(g, fixture));
  const e = g.enemies.find((e) => e.kind === kind)!;
  assert(e, 'private native course supplies ' + kind);
  e.spawn = 0;
  return { g, e, fixture };
}
function native(kind: SupportMachineKind) {
  const { g, e } = course(kind);
  g.hitEnemy(e, 100000);
  const wreck = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id)!;
  assert(wreck, 'native lethal hit captures ' + kind);
  return { g, e, wreck };
}
function loss(ready: boolean, ownerLost = false) {
  const { g } = course('fabricator', ready ? 'power-loss' : 'interruptions');
  const owner = g.enemies.find((e) => e.kind === 'fabricator')!;
  let frame = g.enemies.find((e) => e.sentry?.owner === owner.id);
  if (!frame) {
    owner.spawn = 0;
    owner.timer = 0;
    g.fabricators.updateBuilder(owner);
    frame = g.enemies.find((e) => e.sentry?.owner === owner.id);
  }
  assert(frame, 'native builder creates a frame');
  frame.spawn = 0;
  if (ready && !frame.sentry!.ready) {
    owner.timer = 0;
    g.fabricators.updateBuilder(owner);
  }
  assert.equal(frame.sentry!.ready, ready);
  if (!ready) owner.timer = 1.1;
  const hp = frame.hp,
    kills = g.kills,
    beforeBodies = Matter.Composite.allBodies(g.engine.world).length;
  if (ready || ownerLost) g.hitEnemy(owner, 100000);
  else g.hitEnemy(owner, 1);
  const wreck = g.machineBreakdown.wrecks.find((w) => w.visual.id === frame!.id)!;
  assert(wreck, 'native removal captures its non-scoring failure');
  return { g, frame, owner, wreck, hp, kills, beforeBodies };
}
function draw(wreck: MachineWreck, age: number, reduced = false) {
  const c = canvas(),
    before = structuredClone(wreck);
  assert(drawMachineWreck(c.context, wreck, wreck.at + age, reduced));
  assert.deepEqual(wreck, before);
  assert.equal(c.depth, 0);
  assert.equal(c.values.globalAlpha, 0.85);
  return c.ops;
}

test('four actual support deaths fold distinct existing tools, cells, frame and firing hardware', () => {
  for (const kind of kinds) {
    const { wreck } = native(kind);
    assert.equal(wreck.reason, 'combat');
    const start = supportShutdownPose(wreck.visual, 0)!,
      end = supportShutdownPose(wreck.visual, 0.38)!;
    assert.equal(end.energy, 0);
    assert.equal(end.wear, 2);
    assert.equal(end.brace, 0);
    assert.equal(end.pulse, 0);
    assert.equal(end.reserve, start.reserve);
    assert.deepEqual(end.cells, start.cells);
    assert.equal(end.assembly, start.assembly);
    assert.notDeepEqual(start.body, end.body);
    assert.equal(end.tools.length, start.tools.length);
    assert.equal(end.legs.length, start.legs.length);
    assert(end.tools.every((t) => !t.active));
    if (kind === 'repairer') {
      assert(start.tools.length > 0 && start.pods.length > 0);
      assert.notDeepEqual(start.tools, end.tools);
      assert.notDeepEqual(start.pods, end.pods);
    } else if (kind === 'relay') {
      assert.equal(end.coil, 0);
      assert.notDeepEqual(start.pods, end.pods);
    } else if (kind === 'fabricator') {
      assert(start.tools.length > 0);
      assert.notDeepEqual(start.tools, end.tools);
    } else {
      assert(end.barrel && start.barrel);
      assert.equal(end.barrel.length, start.barrel.length);
      assert.notDeepEqual(end.legs, start.legs);
      assert.notDeepEqual(end.barrel, start.barrel);
      assert.equal(end.barrel.recoil, 0);
    }
    assert.notDeepEqual(draw(wreck, 0.02), draw(wreck, 0.38));
    assert.deepEqual(
      supportShutdownPose(wreck.visual, 0.4),
      supportShutdownPose(wreck.visual, 0.8),
      'all powered motion stops after shutdown',
    );
  }
});

test('shutdowns reuse the exact production chassis instead of drawing duplicate support bodies', () => {
  for (const kind of kinds) {
    const { wreck } = native(kind),
      projection = projectMachineWreck(wreck, wreck.at + 0.2)!;
    const pose = supportShutdownPose(wreck.visual, 0.2)!,
      inactive = {
        ...wreck.visual,
        hp: 0,
        flash: 0,
        brace: 0,
        timer: 0,
        state: 'recover' as const,
        velocity: { x: 0, y: 0 },
      };
    const a = canvas(),
      b = canvas();
    drawSupportChassis(a.context, inactive, false, pose);
    assert(drawSupportMachineWreck(b.context, wreck, projection));
    assert.deepEqual(b.ops, a.ops);
    assert(draw(wreck, 0.2).length < 1200, 'support hardware drawing is bounded');
  }
});

test('native Fabricator destruction powers down a healthy ready Sentry without inventing an extra kill or hit', () => {
  const { g, frame, wreck, hp, kills, beforeBodies } = loss(true);
  assert.equal(wreck.reason, 'owner-lost');
  assert.equal(wreck.hit, null);
  assert.equal(wreck.visual.hp, hp);
  assert(wreck.visual.hp > 0);
  assert.equal(wreck.visual.supportMachine?.sentry?.ready, true);
  assert.equal(wreck.visual.supportMachine?.sentry?.buildProgress, 1);
  assert.equal(g.kills, kills + 1, 'only the actually defeated Fabricator is credited');
  assert(!g.enemies.includes(frame));
  assert(Matter.Composite.allBodies(g.engine.world).length <= beforeBodies - 2);
  const actual = supportMachinePose(wreck.visual),
    end = supportShutdownPose(wreck.visual, 0.38, false, 0.38, 'owner-lost')!;
  assert.equal(end.wear, actual.wear, 'power loss does not fabricate lethal hull damage');
  assert.equal(end.energy, 0);
  assert.equal(end.assembly, 1);
  assert.equal(end.barrel?.length, 26);
  assert.notDeepEqual(end, supportShutdownPose(wreck.visual, 0.38, false, 0.38, 'combat'));
  const projection = projectMachineWreck(wreck, wreck.at + 0.25)!,
    a = canvas(),
    b = canvas();
  drawSupportChassis(
    a.context,
    { ...wreck.visual, flash: 0, brace: 0, timer: 0, state: 'recover', velocity: { x: 0, y: 0 } },
    false,
    supportShutdownPose(wreck.visual, 0.25, false, 0.38, 'owner-lost')!,
  );
  drawSupportMachineWreck(b.context, wreck, projection);
  assert.deepEqual(b.ops, a.ops, 'power loss passes factual positive HP to shared art');
});

test('native interruptions and owner loss preserve the captured incomplete assembly and actual health', () => {
  for (const ownerLost of [false, true]) {
    const { g, wreck, hp, kills } = loss(false, ownerLost);
    assert.equal(wreck.reason, ownerLost ? 'owner-lost' : 'interrupted');
    assert.equal(wreck.hit, null);
    assert.equal(wreck.visual.hp, hp);
    assert.equal(g.kills, kills + (ownerLost ? 1 : 0));
    assert.equal(wreck.visual.supportMachine?.sentry?.ready, false);
    const progress = wreck.visual.supportMachine?.sentry?.buildProgress;
    assert(progress !== undefined && progress > 0 && progress < 1);
    const start = supportMachinePose(wreck.visual),
      end = supportShutdownPose(wreck.visual, 0.38, false, 0.38, wreck.reason)!;
    assert.equal(end.assembly, progress);
    assert.equal(end.barrel?.length, start.barrel?.length);
    assert((end.barrel?.length ?? 100) < 26, 'an interrupted frame never acquires a finished gun');
    assert.equal(end.energy, 0);
    assert.equal(end.wear, start.wear);
    draw(wreck, 0.3);
  }
});

test('support failures keep the existing real support clip and never invent a floor under an unsupported drone', () => {
  for (const kind of kinds) {
    const { wreck } = native(kind);
    assert(wreck.landing?.available);
    const p = projectMachineWreck(wreck, wreck.at + 0.8)!;
    assert.deepEqual(p.position, wreck.landing.center);
    assert(p.settled);
    assert(draw(wreck, 0.8).some((op) => op.name === 'clip'));
    const air = structuredClone(wreck);
    air.landing = null;
    air.visual.position.y = -1000;
    assert(projectMachineWreck(air, air.at + 0.6)!.position.y < -980);
    assert.equal(projectMachineWreck(air, air.at + 0.75), null);
    const lost = structuredClone(wreck);
    lost.landing!.available = false;
    lost.lifetime = 0.66;
    assert(
      projectMachineWreck(lost, lost.at + 0.5)!.alpha >
        projectMachineWreck(lost, lost.at + 0.6)!.alpha,
    );
    assert.equal(projectMachineWreck(lost, lost.at + 0.66), null);
  }
});

test('Reduced Effects keeps destroyed and unpowered outcomes as still, concise, recognizable silhouettes', () => {
  const wrecks = [...kinds.map((k) => native(k).wreck), loss(true).wreck, loss(false).wreck];
  for (const wreck of wrecks) {
    assert.deepEqual(draw(wreck, 0.1, true), draw(wreck, 0.3, true));
    assert.notDeepEqual(draw(wreck, 0.1, true), draw(wreck, 0.1));
    assert.equal(projectMachineWreck(wreck, wreck.at + 0.9, true), null);
    assert.equal(projectMachineWreck(wreck, wreck.at + 2.4), null);
  }
});

test('support failure art stays finite, bounded, pure and capped without RNG, physics, score, audio or profile callbacks', () => {
  for (const kind of kinds) {
    const { g, wreck } = native(kind);
    g.time += 0.3;
    const records = structuredClone(g.machineBreakdown.wrecks),
      bodyState = () =>
        Matter.Composite.allBodies(g.engine.world).map((b) => ({
          id: b.id,
          p: { ...b.position },
          v: { ...b.velocity },
        })),
      bodies = bodyState(),
      hp = g.hp,
      kills = g.kills;
    const random = Math.random,
      rng = g.rng;
    Math.random = g.rng = () => {
      throw new Error('art cannot use RNG');
    };
    g.onSound = () => {
      throw new Error('art cannot play audio');
    };
    g.onCheckpoint = () => {
      throw new Error('art cannot save');
    };
    try {
      const a = canvas(),
        b = canvas();
      drawMachineWrecks(a.context, g);
      drawMachineWrecks(b.context, g);
      assert.deepEqual(a.ops, b.ops);
      assert(a.ops.length > 50 && a.ops.length < 1200);
      assert.deepEqual(g.machineBreakdown.wrecks, records);
      assert.deepEqual(bodyState(), bodies);
      assert.equal(g.hp, hp);
      assert.equal(g.kills, kills);
      g.machineBreakdown.wrecks = Array.from({ length: 50 }, () => structuredClone(wreck));
      const capped = canvas();
      drawMachineWrecks(capped.context, g);
      assert.equal(capped.ops.filter((op) => op.name === 'clip').length, MACHINE_MAX_WRECKS);
    } finally {
      Math.random = random;
      g.rng = rng;
    }
  }
});

test('production Renderer draws support wrecks beneath native actors and warnings, with exact Pause freeze', () => {
  const { g, wreck } = native('fabricator');
  g.time += 0.4;
  const p = projectMachineWreck(wreck, g.time)!,
    c = canvas(true);
  const element = {
    getContext: () => c.context,
    getBoundingClientRect: () => ({ width: 960, height: 600 }),
  } as unknown as HTMLCanvasElement;
  const renderer = new Renderer(element, g);
  renderer.drawEnemies = () => c.ops.push({ name: 'layer:live', args: [] });
  renderer.drawPlayer = () => c.ops.push({ name: 'layer:player', args: [] });
  renderer.drawEnemyTells = () => c.ops.push({ name: 'layer:warnings', args: [] });
  renderer.draw(1000, { camera: { x: 0, y: 0 }, scale: 1, player: true, navigation: false });
  const corpse = c.ops.findIndex(
      (op) => op.name === 'translate' && op.args[0] === p.position.x && op.args[1] === p.position.y,
    ),
    live = c.ops.findIndex((op) => op.name === 'layer:live'),
    player = c.ops.findIndex((op) => op.name === 'layer:player'),
    warning = c.ops.findIndex((op) => op.name === 'layer:warnings');
  assert(corpse >= 0 && corpse < live && live < player && player < warning);
  assert.equal(c.depth, 0);
  const before = structuredClone(g.machineBreakdown.wrecks),
    time = g.time;
  g.setMode('paused');
  for (let i = 0; i < 60; i++) g.tick(1 / 60, idle);
  assert.equal(g.time, time);
  assert.deepEqual(g.machineBreakdown.wrecks, before);
});
