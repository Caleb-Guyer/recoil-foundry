import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import { ENEMY_STATS, enemyShielded } from '../src/enemies.ts';
import { machineBodySnapshot } from '../src/machine-breakdown-pose.ts';
import {
  heavyMachinePose,
  heavyTubeCount,
  type HeavyMachineKind,
} from '../src/heavy-machine-pose.ts';
import { drawHeavyChassis } from '../src/heavy-machine-art.ts';
import { drawPatrolMachine, drawPatrolTell, drawPatrolShells } from '../src/patrol-machine-art.ts';
import { machineAngles, mortarPoint } from '../src/patrol-machine-system.ts';
import { MACHINE_VARIANTS, type MachineVariant } from '../src/patrol-machines.ts';
import {
  heavyIndustryTestFromUrl,
  heavyIndustryTestRoom,
  prepareHeavyIndustryTest,
} from '../src/heavy-industry-test.ts';

type Op = { name: string; args: unknown[] };
function canvas(warnings = false) {
  const ops: Op[] = [],
    stack: Record<string, unknown>[] = [],
    state: Record<string, unknown> = { globalAlpha: 0.9, lineWidth: 1 };
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
        for (const a of args) if (typeof a === 'number') assert(Number.isFinite(a), String(key));
        if (key === 'arc' || key === 'ellipse') assert(Number(args[2]) >= 0);
        if (key === 'fillRect' || key === 'strokeRect')
          assert(Number(args[2]) >= 0 && Number(args[3]) >= 0);
        assert(!['fillText', 'strokeText', 'drawImage', 'clearRect'].includes(String(key)));
        assert(warnings || key !== 'setLineDash', 'body does not invent warning footprints');
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
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1800, y: 500 },
};
function native(kind: HeavyMachineKind, variant: 'plain' | MachineVariant = 'plain') {
  const f = heavyIndustryTestFromUrl(
    new URL('https://test/?test=heavy-industry&unit=' + kind + '&variant=' + variant + '&v=1'),
  )!;
  assert(f);
  const g = new Game();
  g.startTest(f.checkpoint, heavyIndustryTestRoom(f));
  assert(prepareHeavyIndustryTest(g, f));
  const e = g.enemies.find((e) => e.kind === kind)!;
  assert(e);
  e.spawn = 0;
  g.time = 2;
  return { g, e };
}
const snapshot = (g: Game, e: Enemy) => machineBodySnapshot(e, g.time, g)!;
const configurations: [HeavyMachineKind, 'plain' | MachineVariant][] = [
  ['shutter', 'plain'],
  ['strider', 'plain'],
  ['mortar', 'plain'],
  ...Object.entries(MACHINE_VARIANTS).map(
    ([v, s]) => [s.kind, v] as [HeavyMachineKind, MachineVariant],
  ),
];
const close = (a: number, b: number) => assert(Math.abs(a - b) < 1e-8, a + ' != ' + b);
function numeric(v: unknown) {
  if (typeof v === 'number') assert(Number.isFinite(v));
  else if (Array.isArray(v)) v.forEach(numeric);
  else if (v && typeof v === 'object') Object.values(v).forEach(numeric);
}

test('Shutter leaves follow the native armor gate, including its later threshold than aim lock', () => {
  for (const variant of ['plain', 'shutter-fan', 'shutter-burst'] as const) {
    const { g, e } = native('shutter', variant);
    e.state = 'windup';
    for (const timer of [0.95, 0.41, 0.375, 0.35, 0.2, 0]) {
      e.timer = timer;
      const p = heavyMachinePose(snapshot(g, e));
      assert.equal(p.opening === 0, enemyShielded(e, { x: -e.facing, y: 0 }));
      assert.equal(p.panels.length, 2);
      if (timer > 0.35) assert.equal(p.opening, 0);
      else assert(p.opening >= 0.6);
    }
    e.state = 'recover';
    e.timer = 1.3;
    assert.equal(heavyMachinePose(snapshot(g, e)).opening, 1);
    e.state = 'idle';
    assert.equal(heavyMachinePose(snapshot(g, e)).opening, 0);
    if (variant === 'shutter-burst') {
      e.state = 'followup';
      e.timer = 0.36;
      assert.equal(heavyMachinePose(snapshot(g, e)).opening, 0);
      e.timer = 0.34;
      assert(heavyMachinePose(snapshot(g, e)).opening > 0);
    }
  }
});

test('Strider movement is velocity and distance based: still or carried machines never walk from the clock', () => {
  const { g, e } = native('strider');
  e.state = 'idle';
  e.timer = 1;
  Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
  const still = heavyMachinePose(snapshot(g, e));
  g.time += 100;
  assert.deepEqual(heavyMachinePose(snapshot(g, e)), still);
  Matter.Body.translate(e.body, { x: 8, y: 0 });
  const carried = heavyMachinePose(snapshot(g, e));
  assert.deepEqual(carried.legs, still.legs);
  assert.equal(carried.drive, 0);
  g.patrolMachines.updateEnemy(e);
  assert(Math.abs(e.body.velocity.x) > 0);
  const walk = heavyMachinePose(snapshot(g, e));
  assert(walk.legs.some((l) => l.planted));
  Matter.Body.translate(e.body, { x: 1, y: 0 });
  const step = heavyMachinePose(snapshot(g, e));
  const planted = walk.legs.findIndex((l, i) => l.planted && step.legs[i].planted);
  assert(planted >= 0);
  close(
    walk.legs[planted].foot.x + e.body.position.x - 1,
    step.legs[planted].foot.x + e.body.position.x,
  );
  e.state = 'windup';
  e.timer = 0.2;
  Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
  assert(heavyMachinePose(snapshot(g, e)).legs.every((l) => l.planted));
  Matter.Body.translate(e.body, { x: 0, y: -100 });
  assert(heavyMachinePose(snapshot(g, e)).legs.every((l) => !l.planted));
});

test('all native Shutter and Strider barrels retain actual shot-line endpoints and six variant identities', () => {
  for (const [kind, variant] of configurations.filter(([k]) => k !== 'mortar')) {
    const { g, e } = native(kind, variant);
    e.state = 'windup';
    e.timer = 0.2;
    e.aim = { x: 0.8, y: -0.6 };
    const p = heavyMachinePose(snapshot(g, e)),
      angles = machineAngles(e);
    assert.equal(p.barrels.length, heavyTubeCount(kind, e.patrol!.variant));
    for (const b of p.barrels) {
      const matching = angles.find(
        (a) => Math.abs(Math.atan2(Math.sin(a - b.angle), Math.cos(a - b.angle))) < 1e-8,
      );
      assert.notEqual(matching, undefined);
      close(b.origin.x, Math.cos(b.angle) * 26);
      close(b.origin.y, Math.sin(b.angle) * 26);
    }
    if (variant === 'strider-survey') assert.equal(p.barrels[0].length, 24);
    g.machineBreakdown.update();
    e.timer = 0;
    g.patrolMachines.updateEnemy(e);
    g.machineBreakdown.update();
    assert.equal(g.shots.length, angles.length);
    for (const shot of g.shots)
      assert(
        p.barrels.some(
          (b) =>
            Math.hypot(
              shot.pos.x - e.body.position.x - b.origin.x,
              shot.pos.y - e.body.position.y - b.origin.y,
            ) < 1e-8,
        ),
      );
    if (variant === 'shutter-burst') {
      assert.equal(e.state, 'followup');
      assert.equal(e.timer, 0.95);
      assert.equal(p.barrels.length, 2);
      assert.equal(angles.length, 1);
    }
  }
});

test('Mortar traverse, loader and recoil derive real planned/released arcs while native launch points stay exact', () => {
  for (const variant of ['plain', 'mortar-twin', 'mortar-slow'] as const) {
    const { g, e } = native('mortar', variant);
    e.state = 'idle';
    e.timer = 0;
    g.patrolMachines.updateEnemy(e);
    assert(e.patrol!.arcs.length);
    const before = heavyMachinePose(snapshot(g, e)),
      arcs = structuredClone(e.patrol!.arcs);
    assert.equal(before.barrels.length, variant === 'mortar-twin' ? 2 : 1);
    before.barrels.forEach((b, i) => {
      const arc = arcs[i];
      close(b.origin.x + e.body.position.x, arc.from.x);
      close(b.origin.y + e.body.position.y, arc.from.y);
      const near = mortarPoint(arc, 1e-7),
        a = Math.atan2(near.y - arc.from.y, near.x - arc.from.x);
      assert(Math.abs(a - b.angle) < 1e-6);
    });
    g.machineBreakdown.update();
    e.timer = 0;
    g.patrolMachines.updateEnemy(e);
    g.machineBreakdown.update();
    assert.equal(g.patrolMachines.shells.length, arcs.length);
    const fire = heavyMachinePose(snapshot(g, e));
    assert(fire.recoil > 0.9);
    g.time += 0.2;
    assert(heavyMachinePose(snapshot(g, e)).recoil < fire.recoil);
    for (const shell of [...g.patrolMachines.shells])
      g.patrolMachines.trace(shell.pos, shell.pos, 1, 10);
    assert.equal(g.patrolMachines.shells.length, 0);
    const retained = snapshot(g, e);
    assert.equal(retained.patrol!.releaseArcs.length, arcs.length);
    const p = heavyMachinePose(retained);
    assert(p.barrels.every((b) => b.origin.x === 0 && b.origin.y === -26));
    if (variant === 'mortar-slow') assert.equal(p.barrels[0].length, 31);
  }
});

test('live body drawing leaves native warnings, shootable shell paths and blast footprints exactly unchanged', () => {
  for (const [kind, variant] of configurations) {
    const { g, e } = native(kind, variant);
    e.state = 'idle';
    e.timer = 0;
    g.patrolMachines.updateEnemy(e);
    const before = canvas(true);
    drawPatrolTell(before.c, g, e);
    drawPatrolShells(before.c, g);
    const body = canvas();
    drawPatrolMachine(body.c, g, e, false, false);
    const after = canvas(true);
    drawPatrolTell(after.c, g, e);
    drawPatrolShells(after.c, g);
    assert.deepEqual(after.ops, before.ops);
    assert.equal(body.depth, 0);
  }
});

test('all9 configurations render finite bounded family hardware across wear, aim, facing, reduced effects and portrait mode', () => {
  let rendered = 0;
  for (const [kind, variant] of configurations) {
    const { g, e } = native(kind, variant);
    for (const state of ['idle', 'windup', 'recover'] as Enemy['state'][])
      for (const ratio of [1, 0.65, 0.3])
        for (const facing of [-1, 1])
          for (const reduced of [false, true])
            for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
              e.state = state;
              e.timer = 0.2;
              e.hp = e.maxHp * ratio;
              e.facing = facing;
              e.aim = { x: Math.cos(angle), y: Math.sin(angle) };
              const s = snapshot(g, e),
                c = canvas();
              drawHeavyChassis(c.c, s, reduced);
              numeric(heavyMachinePose(s, reduced));
              assert.equal(c.depth, 0);
              assert(c.ops.length < 700);
              rendered++;
            }
    e.hp = 1;
    const portrait = canvas();
    drawPatrolMachine(portrait.c, g, e, true, false);
    assert(
      !portrait.ops.some(
        (o) => o.name === 'fillRect' && JSON.stringify(o.args) === '[-17,-28,34,3]',
      ),
      'portrait never adds live health bar',
    );
  }
  assert.equal(rendered, 1296);
});

test('read-only snapshots and chassis preserve RNG, physics IDs, native machine rig, HP, audio and saves', () => {
  for (const [kind, variant] of configurations) {
    const { g, e } = native(kind, variant);
    const id = (Matter.Common as unknown as { _nextId: number })._nextId;
    const capture = () =>
      JSON.stringify({
        save: g.checkpointSnapshot(),
        pos: e.body.position,
        vel: e.body.velocity,
        vertices: e.body.vertices.map((v) => ({ x: v.x, y: v.y })),
        state: e.state,
        timer: e.timer,
        hp: e.hp,
        patrol: e.patrol,
        shots: g.shots,
        shells: g.patrolMachines.shells,
        particles: g.particles,
      });
    const before = capture();
    g.rng = () => {
      throw Error('draw RNG');
    };
    g.onSound = () => {
      throw Error('draw sound');
    };
    g.onCheckpoint = () => {
      throw Error('draw save');
    };
    for (const reduced of [false, true]) {
      const c = canvas();
      drawPatrolMachine(c.c, g, e, false, reduced);
      assert.equal(c.depth, 0);
    }
    assert.equal(capture(), before);
    assert.equal((Matter.Common as unknown as { _nextId: number })._nextId, id);
  }
});

test('Pause freezes current machine hardware and Reduced Effects retains factual armor/lock state without secondary animation', () => {
  for (const [kind, variant] of configurations) {
    const { g, e } = native(kind, variant);
    e.state = 'windup';
    e.timer = 0.2;
    Matter.Body.setVelocity(e.body, { x: 1, y: 0 });
    const before = heavyMachinePose(snapshot(g, e));
    g.setMode('paused');
    for (let i = 0; i < 20; i++) g.tick(1 / 60, idle);
    assert.deepEqual(heavyMachinePose(snapshot(g, e)), before);
    const quiet = heavyMachinePose(snapshot(g, e), true);
    g.time += 1;
    assert.deepEqual(heavyMachinePose(snapshot(g, e), true), quiet);
  }
});

test('Cycle Shutter recoils for each actual native shot, while a cap-blocked Mortar release invents neither recoil nor loader delivery', () => {
  const { g, e } = native('shutter', 'shutter-burst');
  e.state = 'windup';
  e.timer = 0.2;
  g.machineBreakdown.update();
  e.timer = 0;
  g.patrolMachines.updateEnemy(e);
  g.machineBreakdown.update();
  assert.equal(e.state, 'followup');
  assert.equal(e.timer, 0.95);
  assert.equal(g.shots.length, 1);
  assert.equal(snapshot(g, e).patrol!.dischargeAt, g.time);
  assert(heavyMachinePose(snapshot(g, e)).recoil > 0.9);
  g.time += 0.15;
  assert(heavyMachinePose(snapshot(g, e)).recoil < 0.2);
  e.timer = 0;
  g.patrolMachines.updateEnemy(e);
  g.machineBreakdown.update();
  assert.equal(g.shots.length, 2);
  assert.equal(e.state, 'recover');
  assert(heavyMachinePose(snapshot(g, e)).recoil > 0.9);
  const cap = native('mortar', 'mortar-twin');
  cap.e.state = 'idle';
  cap.e.timer = 0;
  cap.g.patrolMachines.updateEnemy(cap.e);
  cap.g.machineBreakdown.update();
  const arc = structuredClone(cap.e.patrol!.arcs[0]),
    owner = cap.g.enemies.find((other) => other !== cap.e)!.id;
  cap.g.patrolMachines.shells = Array.from({ length: 12 }, () => ({
    owner,
    arc: structuredClone(arc),
    age: 0,
    pos: { ...arc.from },
    previous: { ...arc.from },
  }));
  cap.e.timer = 0;
  cap.g.patrolMachines.updateEnemy(cap.e);
  cap.g.machineBreakdown.update();
  assert.equal(cap.e.state, 'recover');
  assert.equal(cap.g.patrolMachines.shells.length, 12);
  assert.equal(snapshot(cap.g, cap.e).patrol!.releaseArcs.length, 0);
  assert.equal(snapshot(cap.g, cap.e).patrol!.dischargeAt, null);
  assert.equal(heavyMachinePose(snapshot(cap.g, cap.e)).recoil, 0);
  assert.equal(heavyMachinePose(snapshot(cap.g, cap.e)).loader, 0);
});

test('Reduced Effects freezes Mortar recovery hardware even while its real shell and native recovery remain active', () => {
  const { g, e } = native('mortar', 'mortar-twin');
  e.state = 'idle';
  e.timer = 0;
  g.patrolMachines.updateEnemy(e);
  g.machineBreakdown.update();
  e.timer = 0;
  g.patrolMachines.updateEnemy(e);
  g.machineBreakdown.update();
  const quiet = heavyMachinePose(snapshot(g, e), true);
  g.time += 1;
  assert.deepEqual(heavyMachinePose(snapshot(g, e), true), quiet);
});
