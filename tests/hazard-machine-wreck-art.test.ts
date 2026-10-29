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
import { hazardShutdownPose, drawHazardMachineWreck } from '../src/hazard-machine-wreck-art.ts';
import { hazardMachinePose } from '../src/hazard-machine-pose.ts';
import { drawHazardChassis } from '../src/hazard-machine-art.ts';
import { MACHINE_MAX_WRECKS, type MachineWreck } from '../src/machine-breakdown.ts';
import {
  hazardCrewTestFromUrl,
  hazardCrewTestRoom,
  prepareHazardCrewTest,
  type HazardUnit,
} from '../src/hazard-crew-test.ts';
import { updateScrapper } from '../src/scrapper.ts';
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

const kinds = ['scrapper', 'harpooner', 'sapper'] as const;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 900, y: 650 },
};
function course(kind: HazardUnit, scene = 'wreckage') {
  const f = hazardCrewTestFromUrl(
    new URL(`https://test/?test=hazard-crew&unit=${kind}&scene=${scene}&v=1`),
  )!;
  assert(f);
  const g = new Game();
  g.startTest(f.checkpoint, hazardCrewTestRoom(f));
  assert(prepareHazardCrewTest(g, f));
  g.time = 1;
  const e = g.enemies.find((e) => e.kind === kind)!;
  assert(e);
  e.spawn = 0;
  e.timer = 0;
  return { g, e };
}
function native(kind: HazardUnit) {
  const { g, e } = course(kind);
  if (kind === 'scrapper') updateScrapper(g, e);
  else if (kind === 'harpooner') g.harpoons.updateEnemy(e);
  else g.sappers.updateEnemy(e);
  g.machineBreakdown.update();
  g.hitEnemy(e, 100000);
  const wreck = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id)!;
  assert(wreck);
  return { g, e, wreck };
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

test('Scrapper shutdown lowers its actual clamp, releases its grip and stops its tracked drive', () => {
  const { wreck } = native('scrapper'),
    start = hazardShutdownPose(wreck.visual, 0)!,
    end = hazardShutdownPose(wreck.visual, 0.38)!;
  assert(start.arm && end.arm);
  assert(end.arm.hand.y > start.arm.hand.y);
  assert.notDeepEqual(start.arm.elbow, end.arm.elbow);
  assert.equal(end.arm.grip, 0);
  assert.equal(end.energy, 0);
  assert.equal(end.release, 0);
  assert.equal(end.strain, 0);
  assert.equal(end.wear, 2);
  assert.equal(end.mode, 'shutdown');
  assert.notDeepEqual(start.body, end.body);
  assert.deepEqual(hazardShutdownPose(wreck.visual, 0.4), hazardShutdownPose(wreck.visual, 0.8));
});
test('Harpooner shutdown slackens its captured winch and settles the same barrel without drawing a detached active anchor', () => {
  const { wreck } = native('harpooner'),
    start = hazardShutdownPose(wreck.visual, 0)!,
    end = hazardShutdownPose(wreck.visual, 0.38)!;
  assert(start.spool && end.spool && start.barrel && end.barrel);
  assert.notEqual(start.spool.angle, end.spool.angle);
  assert.equal(end.spool.tension, 0);
  assert.notEqual(start.barrel.angle, end.barrel.angle);
  assert.equal(end.barrel.length, start.barrel.length);
  assert.equal(end.barrel.recoil, 0);
  assert.equal(end.energy, 0);
  assert.equal(end.release, 0);
  assert.deepEqual(hazardShutdownPose(wreck.visual, 0.4), hazardShutdownPose(wreck.visual, 0.8));
});
test('Sapper shutdown folds its actual launcher and leaves an inert empty mechanism', () => {
  const { wreck } = native('sapper'),
    start = hazardShutdownPose(wreck.visual, 0)!,
    end = hazardShutdownPose(wreck.visual, 0.38)!;
  assert(start.loader && end.loader && start.barrel && end.barrel);
  assert.notDeepEqual(start.loader.seat, end.loader.seat);
  assert.equal(end.loader.stroke, 0);
  assert.equal(end.loader.charge, false);
  assert.equal(end.barrel.length, start.barrel.length);
  assert.notEqual(start.barrel.angle, end.barrel.angle);
  assert.equal(end.energy, 0);
  assert.equal(end.release, 0);
  assert.equal(end.brace, 0);
  assert.deepEqual(hazardShutdownPose(wreck.visual, 0.4), hazardShutdownPose(wreck.visual, 0.8));
});
test('failed barrels rotate around their actual captured rear hinges while the hull settles', () => {
  for (const kind of ['harpooner', 'sapper'] as const) {
    const { wreck } = native(kind),
      start = hazardShutdownPose(wreck.visual, 0)!,
      end = hazardShutdownPose(wreck.visual, 0.38)!;
    for (const axis of ['x', 'y'] as const) {
      const component = axis === 'x' ? Math.cos : Math.sin;
      const initial =
        start.barrel!.origin[axis] -
        component(start.barrel!.angle) * start.barrel!.length -
        start.body[axis];
      const final =
        end.barrel!.origin[axis] -
        component(end.barrel!.angle) * end.barrel!.length -
        end.body[axis];
      assert(Math.abs(initial - final) < 1e-8, 'rear hinge follows the same captured chassis');
    }
  }
});
test('hazard wrecks reuse the exact production chassis override and retain no live warnings or ghost hazards', () => {
  for (const kind of kinds) {
    const { wreck } = native(kind),
      projection = projectMachineWreck(wreck, wreck.at + 0.2)!,
      pose = hazardShutdownPose(wreck.visual, projection.age)!;
    const inactive = {
        ...wreck.visual,
        hp: 0,
        flash: 0,
        brace: 0,
        timer: 0,
        state: 'recover' as const,
        velocity: { x: 0, y: 0 },
      },
      a = canvas(),
      b = canvas();
    drawHazardChassis(a.context, inactive, false, pose);
    assert(drawHazardMachineWreck(b.context, wreck, projection));
    assert.deepEqual(a.ops, b.ops);
    assert(draw(wreck, 0.2).length < 1400);
    assert.notDeepEqual(draw(wreck, 0.02), draw(wreck, 0.38));
    assert.equal(pose.arm?.grip === undefined || Number.isFinite(pose.arm.grip), true);
  }
});
test('a real Scrapper death drops only its native grip: its existing crate remains physical and rendering cannot duplicate it', () => {
  const { g, e } = course('scrapper');
  updateScrapper(g, e);
  assert(e.scrapper!.held);
  const crate = e.scrapper!.held!,
    id = crate.body.id,
    kills = g.kills;
  g.hitEnemy(e, 100000);
  assert.equal(e.scrapper!.held, null);
  assert.equal(e.scrapper!.tether, null);
  assert.equal(g.kills, kills + 1);
  assert(g.props.items.includes(crate));
  const bodies = Matter.Composite.allBodies(g.engine.world).map((b) => b.id);
  const state = { p: { ...crate.body.position }, v: { ...crate.body.velocity }, hp: crate.hp };
  const wreck = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id)!;
  draw(wreck, 0.25);
  assert.equal(g.props.items.filter((p) => p.body.id === id).length, 1);
  assert.deepEqual(
    Matter.Composite.allBodies(g.engine.world).map((b) => b.id),
    bodies,
  );
  assert.deepEqual(
    { p: { ...crate.body.position }, v: { ...crate.body.velocity }, hp: crate.hp },
    state,
  );
});
test('native Harpooner death releases its line and a captured flight never recreates a live anchor or tether', () => {
  const { g, e } = course('harpooner');
  g.harpoons.updateEnemy(e);
  assert.equal(e.harpoon!.phase, 'aim');
  e.timer = 0;
  g.harpoons.updateEnemy(e);
  assert.equal(e.harpoon!.phase, 'flight');
  g.machineBreakdown.update();
  g.hitEnemy(e, 100000);
  assert.equal(e.harpoon!.phase, 'ready');
  assert.equal(e.harpoon!.target, null);
  const wreck = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id)!,
    world = Matter.Composite.allBodies(g.engine.world).map((b) => b.id),
    constraints = Matter.Composite.allConstraints(g.engine.world).length;
  draw(wreck, 0.3);
  assert.equal(e.harpoon!.phase, 'ready');
  assert.equal(e.harpoon!.target, null);
  assert.deepEqual(
    Matter.Composite.allBodies(g.engine.world).map((b) => b.id),
    world,
  );
  assert.equal(Matter.Composite.allConstraints(g.engine.world).length, constraints);
});
test('an actually released Sapper charge keeps its existing fuse and native detonation after its owner dies', () => {
  const { g, e } = course('sapper');
  g.sappers.updateEnemy(e);
  assert.equal(e.state, 'windup');
  e.timer = 0;
  g.sappers.updateEnemy(e);
  const charge = g.sappers.items.find((p) => p.charge?.owner === e.id);
  assert(charge);
  const fuse = charge.charge!.at,
    id = charge.body.id;
  g.hitEnemy(e, 100000);
  assert(g.props.items.includes(charge));
  const wreck = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id)!;
  const state = {
    p: { ...charge.body.position },
    v: { ...charge.body.velocity },
    fuse: charge.charge!.at,
  };
  draw(wreck, 0.3);
  assert.deepEqual(
    { p: { ...charge.body.position }, v: { ...charge.body.velocity }, fuse: charge.charge!.at },
    state,
  );
  assert.equal(g.sappers.items.filter((p) => p.body.id === id).length, 1);
  g.time = fuse + 0.001;
  g.sappers.afterStep();
  assert(!g.props.items.includes(charge));
  assert.equal(g.sappers.effects.length, 1, 'only native fuse detonation creates its explosion');
});
test('hazard wrecks follow actual moving support, clip at that plane and never invent an unsupported floor', () => {
  for (const kind of kinds) {
    const { g, wreck } = native(kind);
    assert(wreck.landing?.available);
    const landing = wreck.landing!,
      deck = g.solidBodies.find((b) => b.id === landing.bodyId)!;
    const before = { ...landing.point };
    Matter.Body.setPosition(deck, { x: deck.position.x + 20, y: deck.position.y - 17 });
    g.machineBreakdown.update();
    assert.equal(landing.point.x, before.x + 20);
    assert.equal(landing.point.y, before.y - 17);
    const p = projectMachineWreck(wreck, wreck.at + 0.8)!;
    assert.deepEqual(p.position, landing.center);
    assert(p.settled);
    assert(draw(wreck, 0.8).some((op) => op.name === 'clip'));
    const air = structuredClone(wreck);
    air.landing = null;
    air.visual.position.y = -1000;
    assert(projectMachineWreck(air, air.at + 0.6)!.position.y < -980);
    assert.equal(projectMachineWreck(air, air.at + 0.75), null);
    landing.available = false;
    wreck.lifetime = 0.66;
    assert(
      projectMachineWreck(wreck, wreck.at + 0.5)!.alpha >
        projectMachineWreck(wreck, wreck.at + 0.6)!.alpha,
    );
    assert.equal(projectMachineWreck(wreck, wreck.at + 0.66), null);
  }
});
test('Reduced Effects leaves each defeated mechanism still and recognizable within the existing concise lifetime', () => {
  for (const kind of kinds) {
    const { wreck } = native(kind);
    assert.deepEqual(draw(wreck, 0.1, true), draw(wreck, 0.3, true));
    assert.notDeepEqual(draw(wreck, 0.1, true), draw(wreck, 0.1));
    assert.equal(projectMachineWreck(wreck, wreck.at + 0.900001, true), null);
    assert.equal(projectMachineWreck(wreck, wreck.at + 2.400001), null);
  }
});
test('hazard wreck drawing is detached, finite, bounded and pure without collisions, scores, sounds, RNG or profile callbacks', () => {
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
      throw Error('art cannot use RNG');
    };
    g.onSound = () => {
      throw Error('art cannot play audio');
    };
    g.onCheckpoint = () => {
      throw Error('art cannot save');
    };
    try {
      const a = canvas(),
        b = canvas();
      drawMachineWrecks(a.context, g);
      drawMachineWrecks(b.context, g);
      assert.deepEqual(a.ops, b.ops);
      assert(a.ops.length > 50 && a.ops.length < 1400);
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
test('production Renderer keeps hazard wrecks beneath actors and hostile tells with exact Pause freeze', () => {
  const { g, wreck } = native('scrapper');
  g.time += 0.4;
  const p = projectMachineWreck(wreck, g.time)!,
    c = canvas(true),
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
