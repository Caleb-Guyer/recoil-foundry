import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input, type Enemy } from '../src/game.ts';
import { Renderer } from '../src/render.ts';
import {
  drawMachineWreck,
  drawMachineWrecks,
  projectMachineWreck,
} from '../src/machine-breakdown-wreck-art.ts';
import {
  districtShutdownPose,
  drawDistrictMachineWreck,
} from '../src/district-machine-wreck-art.ts';
import { districtMachinePose } from '../src/district-machine-pose.ts';
import { drawDistrictChassis } from '../src/district-machine-art.ts';
import { MACHINE_MAX_WRECKS, type MachineWreck } from '../src/machine-breakdown.ts';
import {
  districtMachinesTestFromUrl,
  districtMachinesTestRoom,
  prepareDistrictMachinesTest,
  type DistrictUnit,
} from '../src/district-machines-test.ts';
import { updateReclamationEnemy } from '../src/reclamation.ts';
import { updateCoolingEnemy } from '../src/cooling.ts';
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

const kinds = ['borer', 'sifter', 'skimmer'] as const;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 900, y: 650 },
};
function course(kind: DistrictUnit, scene = 'wreckage') {
  const f = districtMachinesTestFromUrl(
    new URL(`https://test/?test=district-machines&unit=${kind}&scene=${scene}&v=1`),
  )!;
  assert(f);
  const g = new Game();
  g.startTest(f.checkpoint, districtMachinesTestRoom(f));
  assert(prepareDistrictMachinesTest(g, f));
  g.time = 1;
  const e = g.enemies.find((e) => e.kind === kind)!;
  assert(e);
  e.spawn = 0;
  e.timer = 0;
  return { g, e };
}
function update(g: Game, e: Enemy) {
  if (e.kind === 'skimmer') updateCoolingEnemy(g, e);
  else updateReclamationEnemy(g, e, 1 / 60);
}
function begin(g: Game, e: Enemy) {
  for (let n = 0; n < 240 && e.state !== 'windup' && g.mode === 'playing'; n++)
    g.tick(1 / 60, idle);
  assert.equal(e.state, 'windup', 'native locomotion and cooldown reach a real warning');
}
function native(kind: DistrictUnit) {
  const { g, e } = course(kind);
  g.machineBreakdown.update();
  begin(g, e);
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
const close = (a: number, b: number) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('Borer drive locks and its captured receiver and compact volley hardware collapse without rescaling', () => {
  const { wreck } = native('borer'),
    start = districtShutdownPose(wreck.visual, 0)!,
    end = districtShutdownPose(wreck.visual, 0.38)!;
  assert.equal(end.energy, 0);
  assert.equal(end.coverBrace, 0);
  assert.equal(end.receiver, 0);
  assert.equal(end.recoil, 0);
  assert.equal(end.vent, 0);
  assert.equal(end.wear, 2);
  assert.equal(end.mode, 'shutdown');
  assert.notDeepEqual(start.body, end.body);
  assert.equal(start.ports.length, 3);
  assert.equal(end.ports.length, start.ports.length);
  assert(end.ports.every((p) => p.recoil === 0 && p.open === 0));
  assert.deepEqual(
    districtShutdownPose(wreck.visual, 0.4),
    districtShutdownPose(wreck.visual, 0.8),
    'drive and receiver stop after the brief shutdown',
  );
});
test('Sifter fans coast to a halt and the captured rigid fins sag through a supported controlled fall', () => {
  const { wreck } = native('sifter'),
    start = districtShutdownPose(wreck.visual, 0)!,
    end = districtShutdownPose(wreck.visual, 0.38)!;
  assert(start.rotors.length > 0 && start.fins.length > 0);
  assert.notDeepEqual(start.rotors, end.rotors);
  assert.notDeepEqual(start.fins, end.fins);
  for (let n = 0; n < start.rotors.length; n++)
    assert(
      (end.rotors[n].angle - start.rotors[n].angle) * Math.sign(start.rotors[n].center.x) > 0,
      'fans coast in the captured native directions',
    );
  assert.equal(end.bank, 0);
  assert.equal(end.energy, 0);
  for (let n = 0; n < start.fins.length; n++)
    close(
      Math.hypot(
        start.fins[n].tip.x - start.fins[n].base.x,
        start.fins[n].tip.y - start.fins[n].base.y,
      ),
      Math.hypot(end.fins[n].tip.x - end.fins[n].base.x, end.fins[n].tip.y - end.fins[n].base.y),
    );
  assert(wreck.landing);
  assert(wreck.landing.center.y > wreck.visual.position.y);
  const fall = projectMachineWreck(wreck, wreck.at + 0.2)!;
  assert(fall.position.y >= wreck.visual.position.y);
  assert.deepEqual(projectMachineWreck(wreck, wreck.at + 0.8)!.position, wreck.landing.center);
  assert.deepEqual(
    districtShutdownPose(wreck.visual, 0.4),
    districtShutdownPose(wreck.visual, 0.8),
  );
});
test('Skimmer impeller loses power while the same rigid louvers fold and all vents go dark', () => {
  const { wreck } = native('skimmer'),
    start = districtShutdownPose(wreck.visual, 0)!,
    end = districtShutdownPose(wreck.visual, 0.38)!;
  assert(start.rotors.length > 0 && start.louvers.length > 0);
  assert.notDeepEqual(start.rotors, end.rotors);
  assert.notDeepEqual(start.louvers, end.louvers);
  assert(
    end.rotors[0].angle < start.rotors[0].angle,
    'Skimmer impeller coasts in its native negative rotation',
  );
  assert(end.louvers.every((l) => l.open === 0));
  assert.equal(end.energy, 0);
  assert.equal(end.vent, 0);
  assert.equal(end.recoil, 0);
  for (let n = 0; n < start.louvers.length; n++)
    close(
      Math.hypot(
        start.louvers[n].to.x - start.louvers[n].from.x,
        start.louvers[n].to.y - start.louvers[n].from.y,
      ),
      Math.hypot(
        end.louvers[n].to.x - end.louvers[n].from.x,
        end.louvers[n].to.y - end.louvers[n].from.y,
      ),
    );
  assert.deepEqual(
    districtShutdownPose(wreck.visual, 0.4),
    districtShutdownPose(wreck.visual, 0.8),
  );
});
test('all failed volley ports retain their exact lengths and rear hinges as the body settles', () => {
  for (const kind of kinds) {
    const { wreck } = native(kind),
      start = districtShutdownPose(wreck.visual, 0)!,
      end = districtShutdownPose(wreck.visual, 0.38)!;
    for (let n = 0; n < start.ports.length; n++) {
      const a = start.ports[n],
        b = end.ports[n];
      assert.equal(a.length, b.length);
      for (const axis of ['x', 'y'] as const) {
        const component = axis === 'x' ? Math.cos : Math.sin;
        close(
          a.origin[axis] - component(a.angle) * a.length - start.body[axis],
          b.origin[axis] - component(b.angle) * b.length - end.body[axis],
        );
      }
    }
  }
});
test('District Machines wrecks use the exact production chassis override, no live warning footprints or extra projectile art', () => {
  for (const kind of kinds) {
    const { wreck } = native(kind),
      projection = projectMachineWreck(wreck, wreck.at + 0.2)!,
      pose = districtShutdownPose(wreck.visual, projection.age)!;
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
    drawDistrictChassis(a.context, inactive, false, pose);
    assert(drawDistrictMachineWreck(b.context, wreck, projection));
    assert.deepEqual(a.ops, b.ops);
    assert(draw(wreck, 0.2).length < 1600);
    assert.notDeepEqual(draw(wreck, 0.02), draw(wreck, 0.38));
  }
});
test('native released Borer, Sifter and Skimmer volleys persist unchanged after owner death and keep native collision updates', () => {
  for (const kind of kinds) {
    const { g, e } = course(kind);
    g.machineBreakdown.update();
    begin(g, e);
    e.timer = 0;
    update(g, e);
    assert.equal(e.attacks, 1);
    const shots = g.shots.filter((s) => s.damageCause?.enemy === kind);
    assert.equal(shots.length, 3);
    const actual = shots.map((s) => ({
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
    for (const item of actual) {
      assert(g.shots.includes(item.shot));
      assert.deepEqual(item.shot.pos, item.pos);
      assert.deepEqual(item.shot.vel, item.vel);
      assert.equal(item.shot.damage, item.damage);
      assert.equal(item.shot.life, item.life);
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
          s.pos.x !== actual.find((a) => a.shot === s)!.pos.x ||
          s.pos.y !== actual.find((a) => a.shot === s)!.pos.y,
      ),
      'released shots continue through native movement after owner removal',
    );
  }
});
test('captured district wreck support follows actual moving and sloped decks and clips against the real plane', () => {
  for (const kind of kinds) {
    const { g, wreck } = native(kind);
    assert(wreck.landing?.available);
    const landing = wreck.landing!,
      deck = g.solidBodies.find((b) => b.id === landing.bodyId)!;
    const before = { ...landing.point };
    Matter.Body.setPosition(deck, { x: deck.position.x + 20, y: deck.position.y - 17 });
    g.machineBreakdown.update();
    close(landing.point.x, before.x + 20);
    close(landing.point.y, before.y - 17);
    Matter.Body.setAngle(deck, -0.08);
    g.machineBreakdown.update();
    assert(Math.abs(landing.normal.x) > 0.05);
    assert(landing.normal.y < -0.9);
    const p = projectMachineWreck(wreck, wreck.at + 0.8)!;
    assert.deepEqual(p.position, landing.center);
    assert(p.settled);
    assert(draw(wreck, 0.8).some((op) => op.name === 'clip'));
  }
});
test('unsupported native floating deaths never invent a floor, and removed captured support expires promptly', () => {
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
    const supported = native(kind),
      landing = supported.wreck.landing!;
    assert(landing);
    supported.g.terrain = supported.g.terrain.filter((b) => b.id !== landing.bodyId);
    supported.g.machineBreakdown.update();
    assert.equal(landing.available, false);
    assert(supported.wreck.lifetime <= 0.160001);
    assert.equal(projectMachineWreck(supported.wreck, supported.wreck.at + 0.161), null);
  }
});
test('Reduced Effects keeps three distinct still shutdown outcomes within the existing concise lifetime', () => {
  const signatures = [];
  for (const kind of kinds) {
    const { wreck } = native(kind);
    assert.deepEqual(draw(wreck, 0.1, true), draw(wreck, 0.3, true));
    assert.notDeepEqual(draw(wreck, 0.1, true), draw(wreck, 0.1));
    assert.equal(projectMachineWreck(wreck, wreck.at + 0.900001, true), null);
    assert.equal(projectMachineWreck(wreck, wreck.at + 2.400001), null);
    signatures.push(JSON.stringify(draw(wreck, 0.1, true)));
  }
  assert.equal(new Set(signatures).size, 3);
});
test('District wreck geometry stays finite for zero, invalid and excessive shutdown times', () => {
  for (const kind of kinds) {
    const { wreck } = native(kind);
    for (const age of [-4, 0, 0.2, NaN, Infinity])
      for (const duration of [-1, 0, 0.38, NaN, Infinity]) {
        const pose = districtShutdownPose(wreck.visual, age, false, duration)!;
        const c = canvas();
        drawDistrictChassis(c.context, wreck.visual, false, pose);
        assert.equal(c.depth, 0);
      }
  }
});
test('district wreck drawing is detached, finite, capped and cannot mutate physics, projectiles, scores, audio, RNG or saves', () => {
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
test('production Renderer keeps district wrecks below actors and actual attack tells with exact Pause freeze', () => {
  const { g, wreck } = native('borer');
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
