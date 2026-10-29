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
import { surfaceShutdownPose, drawSurfaceMachineWreck } from '../src/surface-machine-wreck-art.ts';
import { surfaceMachinePose } from '../src/surface-machine-pose.ts';
import { drawSurfaceChassis } from '../src/surface-machine-art.ts';
import { MACHINE_MAX_WRECKS, type MachineWreck } from '../src/machine-breakdown.ts';
import {
  surfaceMachinesTestFromUrl,
  surfaceMachinesTestRoom,
  prepareSurfaceMachinesTest,
  type SurfaceUnit,
  type SurfaceFace,
} from '../src/surface-machines-test.ts';
import { beginAnglerAttack, updateAngler } from '../src/angler.ts';
import { beginCrawlerAttack, updateWallcrawler } from '../src/wallcrawler.ts';
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

const kinds = ['angler', 'wallcrawler'] as const;
const faces = ['floor', 'wall', 'ceiling'] as const;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 900, y: 650 },
};
function course(kind: SurfaceUnit, face: SurfaceFace = 'wall', scene = 'wreckage') {
  const f = surfaceMachinesTestFromUrl(
    new URL(
      `https://test/?test=surface-machines&unit=${kind}&scene=${scene}${kind === 'wallcrawler' ? '&face=' + face : ''}&v=1`,
    ),
  )!;
  assert(f);
  const g = new Game();
  g.startTest(f.checkpoint, surfaceMachinesTestRoom(f));
  assert(prepareSurfaceMachinesTest(g, f));
  g.time = 1;
  const e = g.enemies.find((e) => e.kind === kind)!;
  assert(e);
  e.spawn = 0;
  e.timer = 0;
  return { g, e };
}
function native(kind: SurfaceUnit, face: SurfaceFace = 'wall') {
  const { g, e } = course(kind, face);
  g.machineBreakdown.update();
  g.hitEnemy(e, 100000);
  const wreck = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id)!;
  assert(wreck);
  return { g, e, wreck };
}
function fallen(face: SurfaceFace = 'ceiling') {
  const { g, e } = course('wallcrawler', face);
  const host = e.crawler!.support!;
  assert(host);
  g.machineBreakdown.update();
  g.destruction.hitBody(host, 100000, { x: 0, y: 1 });
  updateWallcrawler(g, e, 1 / 60);
  g.machineBreakdown.update();
  assert.equal(e.crawler!.support, undefined);
  assert(e.crawler!.vulnerable > 0);
  for (let n = 0; n < 8; n++) g.tick(1 / 60, idle);
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
const close = (a: number, b: number) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('Angler shutdown buckles the same stance, lowers its gimbal and closes inert exposure shutters', () => {
  const { wreck } = native('angler'),
    start = surfaceShutdownPose(wreck.visual, 0)!,
    end = surfaceShutdownPose(wreck.visual, 0.38)!;
  assert.equal(start.legs.length, 2);
  assert.equal(end.legs.length, start.legs.length);
  assert.notDeepEqual(start.legs, end.legs);
  assert.notDeepEqual(start.body, end.body);
  assert.notDeepEqual(start.gimbal.center, end.gimbal.center);
  assert.equal(end.energy, 0);
  assert.equal(end.exposure, 0);
  assert.equal(end.recoil, 0);
  assert.equal(end.wear, 2);
  assert.equal(end.mode, 'shutdown');
  assert(end.shutters.every((s) => s.open === 0));
  assert.deepEqual(
    surfaceShutdownPose(wreck.visual, 0.4),
    surfaceShutdownPose(wreck.visual, 0.8),
    'the inert mount stops after the brief shutdown',
  );
});
test('Wallcrawler floor, wall and ceiling deaths retain their actual captured mount basis and release all gripping feet', () => {
  const signatures = [];
  for (const face of faces) {
    const { wreck } = native('wallcrawler', face),
      start = surfaceShutdownPose(wreck.visual, 0)!,
      end = surfaceShutdownPose(wreck.visual, 0.38)!;
    assert.equal(start.legs.length, 4);
    assert.equal(start.pads.length, 4);
    assert.equal(start.grip, 0, 'shutdown releases grip immediately');
    assert.equal(end.grip, 0);
    assert(end.pads.every((p) => !p.planted));
    assert(end.legs.every((p) => !p.planted));
    assert.equal(end.energy, 0);
    assert.equal(end.exposure, 0);
    assert.equal(end.recoil, 0);
    assert.notDeepEqual(start.legs, end.legs);
    assert.notDeepEqual(start.pads, end.pads);
    assert.deepEqual(end.normal, start.normal);
    assert.deepEqual(end.tangent, start.tangent);
    close(end.angle - start.angle, start.forward * 0.19);
    signatures.push(JSON.stringify({ normal: end.normal, legs: end.legs, angle: end.angle }));
    assert.deepEqual(
      surfaceShutdownPose(wreck.visual, 0.4),
      surfaceShutdownPose(wreck.visual, 0.8),
    );
  }
  assert.equal(
    new Set(signatures).size,
    3,
    'three real mount orientations cannot become one upright wreck',
  );
});
test('already fallen Wallcrawler snapshots keep the captured falling orientation after native support destruction', () => {
  for (const face of ['wall', 'ceiling'] as const) {
    const { wreck } = fallen(face),
      live = surfaceMachinePose(wreck.visual),
      start = surfaceShutdownPose(wreck.visual, 0)!,
      end = surfaceShutdownPose(wreck.visual, 0.38)!;
    assert.equal(live.mode, 'fallen');
    assert.equal(live.grip, 0);
    close(start.angle, live.angle);
    close(end.angle - start.angle, start.forward * 0.19);
    assert.deepEqual(start.normal, live.normal);
    assert.deepEqual(end.normal, live.normal);
    assert(end.pads.every((p) => !p.planted));
    draw(wreck, 0.2);
  }
});
test('captured barrel rear hinges and exposure-shutter lengths remain exact during surface shutdown', () => {
  for (const { wreck } of [
    native('angler'),
    ...faces.map((face) => native('wallcrawler', face)),
    fallen(),
  ]) {
    const start = surfaceShutdownPose(wreck.visual, 0)!,
      end = surfaceShutdownPose(wreck.visual, 0.38)!;
    assert.equal(end.barrel.length, start.barrel.length);
    for (const axis of ['x', 'y'] as const) {
      const component = axis === 'x' ? Math.cos : Math.sin;
      close(
        start.barrel.origin[axis] -
          component(start.barrel.angle) * start.barrel.length -
          start.body[axis],
        end.barrel.origin[axis] - component(end.barrel.angle) * end.barrel.length - end.body[axis],
      );
    }
    for (let n = 0; n < start.shutters.length; n++)
      close(
        Math.hypot(
          start.shutters[n].to.x - start.shutters[n].from.x,
          start.shutters[n].to.y - start.shutters[n].from.y,
        ),
        Math.hypot(
          end.shutters[n].to.x - end.shutters[n].from.x,
          end.shutters[n].to.y - end.shutters[n].from.y,
        ),
      );
  }
});
test('surface wrecks draw the exact production chassis override with no live bank path, shot queues or warning footprints', () => {
  for (const { wreck } of [
    native('angler'),
    ...faces.map((face) => native('wallcrawler', face)),
    fallen(),
  ]) {
    const projection = projectMachineWreck(wreck, wreck.at + 0.2)!,
      pose = surfaceShutdownPose(wreck.visual, projection.age)!;
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
    drawSurfaceChassis(a.context, inactive, false, pose);
    assert(drawSurfaceMachineWreck(b.context, wreck, projection));
    assert.deepEqual(a.ops, b.ops);
    assert(draw(wreck, 0.2).length < 1600);
    assert.notDeepEqual(draw(wreck, 0.02), draw(wreck, 0.38));
  }
});
test('native Angler bank shots and Wallcrawler individual burst rounds survive owner death unchanged', () => {
  for (const kind of kinds) {
    const { g, e } = course(kind, 'wall', 'shutdowns');
    g.machineBreakdown.update();
    if (kind === 'angler') {
      assert(beginAnglerAttack(g, e));
      e.timer = 0;
      updateAngler(g, e, 1 / 60);
    } else {
      beginCrawlerAttack(g, e);
      for (let n = 0; n < 3; n++) {
        e.timer = 0;
        updateWallcrawler(g, e, 1 / 60);
      }
    }
    const shots = g.shots.filter((s) => s.damageCause?.enemy === kind);
    assert.equal(shots.length, kind === 'angler' ? 1 : 3);
    const records = shots.map((s) => ({
        shot: s,
        pos: { ...s.pos },
        vel: { ...s.vel },
        damage: s.damage,
        life: s.life,
      })),
      kills = g.kills;
    g.hitEnemy(e, 100000);
    assert.equal(g.kills, kills + 1);
    const wreck = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id)!;
    const bodies = Matter.Composite.allBodies(g.engine.world).map((b) => b.id),
      constraints = Matter.Composite.allConstraints(g.engine.world).length;
    draw(wreck, 0.3);
    for (const r of records) {
      assert(g.shots.includes(r.shot));
      assert.deepEqual(r.shot.pos, r.pos);
      assert.deepEqual(r.shot.vel, r.vel);
      assert.equal(r.shot.damage, r.damage);
      assert.equal(r.shot.life, r.life);
    }
    assert.deepEqual(
      Matter.Composite.allBodies(g.engine.world).map((b) => b.id),
      bodies,
    );
    assert.equal(Matter.Composite.allConstraints(g.engine.world).length, constraints);
    g.updateShots(1 / 60);
    assert(
      shots.some(
        (s) =>
          s.pos.x !== records.find((r) => r.shot === s)!.pos.x ||
          s.pos.y !== records.find((r) => r.shot === s)!.pos.y,
      ),
    );
    if (kind === 'angler') {
      const round = shots[0];
      for (let n = 0; n < 200 && !round.angler!.banked && g.shots.includes(round); n++) {
        g.time += 1 / 60;
        g.updateShots(1 / 60);
      }
      assert.equal(
        round.angler!.banked,
        true,
        'the actual pre-death bank plan completes after owner removal',
      );
    }
  }
});
test('wall and ceiling wrecks descend toward real floor support rather than remaining attached to their former face', () => {
  for (const face of faces) {
    const { g, e, wreck } = native('wallcrawler', face),
      host = e.crawler!.support!;
    assert(host);
    assert(wreck.landing?.available);
    if (face === 'floor') assert.equal(wreck.landing.bodyId, host.id);
    else {
      assert.notEqual(wreck.landing.bodyId, host.id);
      assert(wreck.landing.center.y > wreck.visual.position.y);
      assert(projectMachineWreck(wreck, wreck.at + 0.2)!.position.y >= wreck.visual.position.y);
    }
    const p = projectMachineWreck(wreck, wreck.at + 0.8)!;
    assert.deepEqual(p.position, wreck.landing.center);
    assert(p.settled);
    assert(draw(wreck, 0.8).some((op) => op.name === 'clip'));
  }
});
test('surface wrecks follow actual moving or sloped landing decks and clear quickly when that support is removed', () => {
  for (const kind of kinds) {
    const { g, wreck } = native(kind),
      landing = wreck.landing!;
    assert(landing);
    const deck = g.solidBodies.find((b) => b.id === landing.bodyId)!,
      before = { ...landing.point };
    Matter.Body.setPosition(deck, { x: deck.position.x + 20, y: deck.position.y - 17 });
    g.machineBreakdown.update();
    close(landing.point.x, before.x + 20);
    close(landing.point.y, before.y - 17);
    Matter.Body.setAngle(deck, -0.08);
    g.machineBreakdown.update();
    assert(Math.abs(landing.normal.x) > 0.05);
    assert(landing.normal.y < -0.9);
    assert.deepEqual(projectMachineWreck(wreck, wreck.at + 0.8)!.position, landing.center);
    g.terrain = g.terrain.filter((b) => b.id !== deck.id);
    g.machineBreakdown.update();
    assert.equal(landing.available, false);
    assert(wreck.lifetime <= 0.160001);
    assert.equal(projectMachineWreck(wreck, wreck.at + 0.161), null);
  }
});
test('no floor is invented under an unsupported native surface-machine death', () => {
  for (const kind of kinds) {
    const { g, e } = course(kind);
    for (const body of g.terrain) Matter.Composite.remove(g.engine.world, body);
    g.terrain = [];
    for (const prop of [...g.props.items]) g.props.remove(prop);
    g.hitEnemy(e, 100000);
    const wreck = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id)!;
    assert(wreck);
    assert.equal(wreck.landing, null);
    assert.equal(projectMachineWreck(wreck, wreck.at + 0.750001), null);
    assert(!draw(wreck, 0.2).some((op) => op.name === 'clip'));
  }
});
test('Reduced Effects keeps captured surface orientations still, readable and within the existing short lifetime', () => {
  const signatures = [];
  for (const { wreck } of [
    native('angler'),
    ...faces.map((face) => native('wallcrawler', face)),
    fallen(),
  ]) {
    assert.deepEqual(draw(wreck, 0.1, true), draw(wreck, 0.3, true));
    assert.notDeepEqual(draw(wreck, 0.1, true), draw(wreck, 0.1));
    assert.equal(projectMachineWreck(wreck, wreck.at + 0.900001, true), null);
    assert.equal(projectMachineWreck(wreck, wreck.at + 2.400001), null);
    signatures.push(JSON.stringify(draw(wreck, 0.1, true)));
  }
  assert(new Set(signatures).size >= 4);
});
test('surface wreck rendering is detached, finite, capped and cannot mutate collisions, projectiles, scores, audio, RNG or saves', () => {
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
      shots = structuredClone(g.shots),
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
      assert(a.ops.length > 50 && a.ops.length < 1600);
      assert.deepEqual(g.machineBreakdown.wrecks, records);
      assert.deepEqual(bodyState(), bodies);
      assert.deepEqual(g.shots, shots);
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
test('production Renderer keeps surface wrecks below native actors and warnings with exact Pause freeze', () => {
  const { g, wreck } = native('angler');
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
