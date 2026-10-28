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
import { heavyShutdownPose, drawHeavyMachineWreck } from '../src/heavy-machine-wreck-art.ts';
import {
  heavyMachinePose,
  heavyTubeCount,
  type HeavyMachineKind,
} from '../src/heavy-machine-pose.ts';
import { drawHeavyChassis } from '../src/heavy-machine-art.ts';
import { MACHINE_MAX_WRECKS, type MachineWreck } from '../src/machine-breakdown.ts';
import { MACHINE_VARIANTS, type MachineVariant } from '../src/patrol-machines.ts';
import {
  heavyIndustryTestFromUrl,
  heavyIndustryTestRoom,
  prepareHeavyIndustryTest,
} from '../src/heavy-industry-test.ts';
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

function native(kind: HeavyMachineKind, variant: 'plain' | MachineVariant = 'plain') {
  const fixture = heavyIndustryTestFromUrl(
    new URL(
      'https://test/?test=heavy-industry&unit=' +
        kind +
        '&scene=wreckage&variant=' +
        variant +
        '&v=1',
    ),
  )!;
  assert(fixture);
  const g = new Game();
  g.startTest(fixture.checkpoint, heavyIndustryTestRoom(fixture));
  assert(prepareHeavyIndustryTest(g, fixture));
  const e = g.enemies.find((enemy) => enemy.kind === kind)!;
  assert(e);
  e.spawn = 0;
  e.state = 'windup';
  e.timer = 1.1;
  g.tick(1 / 60, {
    left: false,
    right: false,
    jump: false,
    jumpHeld: false,
    fire: false,
    aim: { x: 950, y: 530 },
  });
  g.hitEnemy(e, 10000);
  const wreck = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id)!;
  assert(wreck, 'a real native lethal hit creates the heavy snapshot');
  return { g, e, wreck };
}
const kinds = ['shutter', 'strider', 'mortar'] as const;
const draw = (wreck: MachineWreck, age: number, reduced = false) => {
  const c = canvas(),
    before = structuredClone(wreck);
  assert(drawMachineWreck(c.context, wreck, wreck.at + age, reduced));
  assert.deepEqual(wreck, before);
  assert.equal(c.depth, 0);
  assert.equal(c.values.globalAlpha, 0.85);
  return c.ops;
};

test('Shutter drive releases and the exact two rigid panels sag independently', () => {
  const { wreck } = native('shutter');
  const start = heavyShutdownPose(wreck.visual, 0)!,
    end = heavyShutdownPose(wreck.visual, 0.38)!;
  assert.equal(start.panels.length, 2);
  assert.equal(end.panels.length, 2);
  assert.equal(end.opening, 1);
  assert.equal(end.brace, 0);
  for (let i = 0; i < 2; i++) {
    assert.equal(end.panels[i].width, start.panels[i].width);
    assert.equal(end.panels[i].height, start.panels[i].height);
    assert.notDeepEqual(end.panels[i].position, start.panels[i].position);
    assert.notEqual(end.panels[i].angle, start.panels[i].angle);
  }
  assert.notEqual(
    end.panels[0].angle,
    end.panels[1].angle,
    'broken leaves sag differently instead of one intact shutter tilting',
  );
  assert.notDeepEqual(start.legs, end.legs);
  assert(end.legs.every((l) => l.planted));
  assert.equal(end.drive, heavyShutdownPose(wreck.visual, 1)!.drive);
  assert.notDeepEqual(draw(wreck, 0.02), draw(wreck, 0.38));
});

test('Strider support knees fold and its exact carriage/tubes fall without a body-scale squash', () => {
  const { wreck } = native('strider', 'strider-volley');
  const start = heavyShutdownPose(wreck.visual, 0)!,
    end = heavyShutdownPose(wreck.visual, 0.38)!;
  assert.equal(end.legs.length, 2);
  assert(end.body.y > start.body.y + 3);
  assert.notDeepEqual(end.legs, start.legs);
  assert.equal(end.barrels.length, 3);
  for (let i = 0; i < 3; i++) {
    assert.equal(end.barrels[i].length, start.barrels[i].length);
    assert.notEqual(end.barrels[i].angle, start.barrels[i].angle);
  }
  assert.deepEqual(
    draw(wreck, 0.38).filter((op) => op.name === 'scale'),
    draw(wreck, 0.02).filter((op) => op.name === 'scale'),
  );
});

test('Mortar Cart loses its loader and carriage, loosens wheels and lowers both real Twin tubes', () => {
  const { wreck } = native('mortar', 'mortar-twin');
  const start = heavyShutdownPose(wreck.visual, 0)!,
    end = heavyShutdownPose(wreck.visual, 0.38)!;
  assert.equal(start.wheels.length, 2);
  assert.equal(end.wheels.length, 2);
  assert.notDeepEqual(end.wheels, start.wheels);
  assert.equal(end.loader, 0);
  assert.equal(end.recoil, 0);
  assert.equal(end.barrels.length, 2);
  assert(
    Math.hypot(
      end.barrels[0].origin.x - end.barrels[1].origin.x,
      end.barrels[0].origin.y - end.barrels[1].origin.y,
    ) > 4,
    'two fallen Twin tubes remain individually visible',
  );
  for (let i = 0; i < 2; i++) {
    assert.equal(end.barrels[i].length, start.barrels[i].length);
    assert(
      Math.sin(end.barrels[i].angle) > 0,
      'dead muzzle faces down rather than keeping its firing arc',
    );
    assert.notDeepEqual(end.barrels[i].origin, start.barrels[i].origin);
  }
});

test('all nine real heavy identities preserve their tube count and variant hardware in the shared production rig', () => {
  for (const kind of kinds) {
    const variants: ['plain' | MachineVariant, ...('plain' | MachineVariant)[]] = [
      'plain',
      ...Object.entries(MACHINE_VARIANTS)
        .filter(([, value]) => value.kind === kind)
        .map(([key]) => key as MachineVariant),
    ];
    for (const variant of variants) {
      const { wreck } = native(kind, variant),
        projection = projectMachineWreck(wreck, wreck.at + 0.25)!;
      assert.equal(wreck.visual.patrol?.variant, variant === 'plain' ? undefined : variant);
      const pose = heavyShutdownPose(wreck.visual, 0.25)!;
      assert.equal(
        pose.barrels.length,
        heavyTubeCount(kind, variant === 'plain' ? undefined : variant),
      );
      if (variant === 'strider-survey') assert(pose.barrels.every((b) => b.length === 24));
      if (variant === 'mortar-slow') assert(pose.barrels.every((b) => b.length === 31));
      const inactive = {
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
      drawHeavyChassis(a.context, inactive, false, pose);
      assert(drawHeavyMachineWreck(b.context, wreck, projection));
      assert.deepEqual(b.ops, a.ops, 'shutdown reuses the actual live rig with a pose override');
      assert(draw(wreck, 0.25).length < 850, 'variant geometry remains bounded');
    }
  }
});

test('heavy wrecks use the same actual support clip, air fallback and removed-support lifetime', () => {
  for (const kind of kinds) {
    const { wreck } = native(kind);
    assert(wreck.landing?.available);
    const projection = projectMachineWreck(wreck, wreck.at + 0.8)!;
    assert.deepEqual(projection.position, wreck.landing.center);
    assert(projection.settled);
    assert(draw(wreck, 0.8).some((op) => op.name === 'clip'));
    const unsupported = structuredClone(wreck);
    unsupported.landing = null;
    unsupported.visual.position.y = -1000;
    assert(projectMachineWreck(unsupported, unsupported.at + 0.6)!.position.y < -980);
    assert.equal(projectMachineWreck(unsupported, unsupported.at + 0.75), null);
    const removed = structuredClone(wreck);
    removed.landing!.available = false;
    removed.lifetime = 0.66;
    assert(
      projectMachineWreck(removed, removed.at + 0.5)!.alpha >
        projectMachineWreck(removed, removed.at + 0.6)!.alpha,
    );
    assert.equal(projectMachineWreck(removed, removed.at + 0.66), null);
  }
});

test('Reduced Effects keeps a distinct motionless defeated rig and the existing concise fade', () => {
  for (const kind of kinds) {
    const { wreck } = native(kind);
    assert.deepEqual(draw(wreck, 0.1, true), draw(wreck, 0.3, true));
    assert.notDeepEqual(draw(wreck, 0.1, true), draw(wreck, 0.1));
    assert.equal(projectMachineWreck(wreck, wreck.at + 0.9, true), null);
    assert.equal(projectMachineWreck(wreck, wreck.at + 2.4), null);
  }
});

test('heavy art is finite, bounded and read-only, with no new collision, shell, sound, RNG or profile effects', () => {
  for (const kind of kinds) {
    const { g, wreck } = native(kind);
    g.time += 0.3;
    const records = structuredClone(g.machineBreakdown.wrecks),
      bodies = Matter.Composite.allBodies(g.engine.world).map((b) => ({
        id: b.id,
        p: { ...b.position },
        v: { ...b.velocity },
      })),
      shells = structuredClone(g.patrolMachines.shells),
      hp = g.hp,
      kills = g.kills;
    const random = Math.random,
      rng = g.rng;
    Math.random = g.rng = () => {
      throw new Error('art cannot consume RNG');
    };
    g.onSound = () => {
      throw new Error('art cannot play sound');
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
      assert(a.ops.length > 100 && a.ops.length < 850);
      assert.deepEqual(g.machineBreakdown.wrecks, records);
      assert.deepEqual(g.patrolMachines.shells, shells);
      assert.equal(g.hp, hp);
      assert.equal(g.kills, kills);
      assert.deepEqual(
        Matter.Composite.allBodies(g.engine.world).map((b) => ({
          id: b.id,
          p: { ...b.position },
          v: { ...b.velocity },
        })),
        bodies,
      );
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

test('production Renderer leaves heavy wrecks beneath live actors, Operator and warnings, with exact Pause freeze', () => {
  const { g, wreck } = native('mortar', 'mortar-twin');
  g.time += 0.4;
  const projection = projectMachineWreck(wreck, g.time)!;
  const c = canvas(true),
    element = {
      getContext: () => c.context,
      getBoundingClientRect: () => ({ width: 960, height: 600 }),
    } as unknown as HTMLCanvasElement;
  const renderer = new Renderer(element, g);
  renderer.drawEnemies = () => c.ops.push({ name: 'layer:live', args: [] });
  renderer.drawPlayer = () => c.ops.push({ name: 'layer:player', args: [] });
  renderer.drawEnemyTells = () => c.ops.push({ name: 'layer:warnings', args: [] });
  renderer.draw(1000, { camera: { x: 0, y: 0 }, scale: 1, player: true, navigation: false });
  const corpse = c.ops.findIndex(
      (op) =>
        op.name === 'translate' &&
        op.args[0] === projection.position.x &&
        op.args[1] === projection.position.y,
    ),
    live = c.ops.findIndex((op) => op.name === 'layer:live'),
    player = c.ops.findIndex((op) => op.name === 'layer:player'),
    warnings = c.ops.findIndex((op) => op.name === 'layer:warnings');
  assert(corpse >= 0 && corpse < live && live < player && player < warnings);
  assert.equal(c.depth, 0);
  const before = structuredClone(g.machineBreakdown.wrecks),
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
  assert.equal(g.time, time);
  assert.deepEqual(g.machineBreakdown.wrecks, before);
});
