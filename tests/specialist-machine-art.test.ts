import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import { Renderer } from '../src/render.ts';
import { ENEMY_STATS, CHARGE_TELL, HOP_TELL, SNIPER_TELL, TWIN_LOCK } from '../src/enemies.ts';
import { enemyPose } from '../src/combat-feel.ts';
import { machineBodySnapshot, machinePose } from '../src/machine-breakdown-pose.ts';
import { drawMachineChassis, drawMachineContacts } from '../src/machine-breakdown-art.ts';
import {
  specialistMachinePose,
  type SpecialistMachineKind,
} from '../src/specialist-machine-pose.ts';
import { drawSpecialistChassis } from '../src/specialist-machine-art.ts';
import {
  specialistMachineTestFromUrl,
  specialistMachineTestRoom,
  prepareSpecialistMachineTest,
} from '../src/specialist-machines-test.ts';
import { SPLIT_SCALE } from '../src/mutations.ts';

type Op = { name: string; args: unknown[] };
function canvas() {
  const ops: Op[] = [],
    stack: Record<string, unknown>[] = [],
    values: Record<string, unknown> = { globalAlpha: 1, lineWidth: 1 };
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get(_, key) {
      if (Object.hasOwn(values, key)) return values[String(key)];
      return (...args: unknown[]) => {
        if (key === 'save') stack.push({ ...values });
        if (key === 'restore') {
          assert(stack.length > 0);
          Object.keys(values).forEach((k) => delete values[k]);
          Object.assign(values, stack.pop());
        }
        for (const n of args) if (typeof n === 'number') assert(Number.isFinite(n), String(key));
        if (key === 'arc' || key === 'ellipse') assert((args[2] as number) >= 0);
        if (key === 'fillRect' || key === 'strokeRect')
          assert((args[2] as number) >= 0 && (args[3] as number) >= 0);
        assert(
          !['fillText', 'strokeText', 'drawImage', 'clearRect', 'setLineDash'].includes(
            String(key),
          ),
          'no captions or extra warning footprints',
        );
        ops.push({ name: String(key), args });
      };
    },
    set(_, key, value) {
      if (key === 'globalAlpha') assert(Number.isFinite(value) && value >= 0 && value <= 1);
      if (key === 'lineWidth') assert(Number.isFinite(value) && value > 0);
      values[String(key)] = value;
      ops.push({ name: 'style:' + String(key), args: [value] });
      return true;
    },
  });
  return {
    ctx,
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
  aim: { x: 1700, y: 500 },
};
function native(kind: SpecialistMachineKind, elite = 'plain') {
  const f = specialistMachineTestFromUrl(
    new URL('https://test/?test=specialists&unit=' + kind + '&elite=' + elite + '&v=1'),
  )!;
  const g = new Game();
  g.startTest(f.checkpoint, specialistMachineTestRoom(f));
  assert(prepareSpecialistMachineTest(g, f));
  const e = g.enemies.find((e) => e.kind === kind)!;
  assert(e);
  e.spawn = 0;
  Matter.Body.setPosition(e.body, { x: 600, y: 724 });
  Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
  g.time = 2;
  return { g, e };
}
const snapshot = (g: Game, e: Enemy) => machineBodySnapshot(e, g.time, g)!;
const kinds: SpecialistMachineKind[] = ['charger', 'hopper', 'sniper'];
function numeric(v: unknown) {
  if (typeof v === 'number') assert(Number.isFinite(v));
  else if (Array.isArray(v)) v.forEach(numeric);
  else if (v && typeof v === 'object') Object.values(v).forEach(numeric);
}

test('Charger ram/drive read native windup, rush and retained crash versus spent recovery after their timers overlap', () => {
  const { g, e } = native('charger');
  e.state = 'windup';
  e.timer = CHARGE_TELL;
  const first = specialistMachinePose(snapshot(g, e));
  e.timer = 0;
  const loaded = specialistMachinePose(snapshot(g, e));
  assert(loaded.ram > first.ram);
  e.state = 'rush';
  e.timer = 0.4;
  e.aim = { x: 1, y: 0 };
  g.machineBreakdown.update();
  Matter.Body.setPosition(e.body, { x: 1010, y: 724 });
  g.updateCharger(e);
  g.machineBreakdown.update();
  assert.equal(e.timer, 1.1);
  e.timer = 0.3;
  g.time += 0.8;
  const crash = specialistMachinePose(snapshot(g, e));
  assert.equal(crash.mode, 'crash');
  e.state = 'rush';
  e.timer = 0;
  g.machineBreakdown.update();
  g.updateCharger(e);
  g.machineBreakdown.update();
  assert.equal(e.timer, 0.6);
  e.timer = 0.3;
  const spent = specialistMachinePose(snapshot(g, e));
  assert.equal(spent.mode, 'spent');
  assert.notEqual(crash.ram, spent.ram);
  assert.notDeepEqual(crash.body, spent.body);
  g.machineBreakdown.reset();
  g.machineBreakdown.update();
  assert.equal(
    specialistMachinePose(snapshot(g, e)).mode,
    'recover',
    'unknown late state cannot invent a wall crash',
  );
});

test('Hopper native support determines compression, airborne tuck and actual landing; a removed floor cannot preserve a planted pose', () => {
  const { g, e } = native('hopper');
  assert(g.enemyGrounded(e));
  assert.equal(snapshot(g, e).specialist!.grounded, true);
  e.state = 'windup';
  e.timer = HOP_TELL;
  const start = specialistMachinePose(snapshot(g, e));
  e.timer = 0.02;
  const compressed = specialistMachinePose(snapshot(g, e));
  assert(compressed.compression > start.compression);
  assert(compressed.legs.every((l) => l.planted));
  e.timer = 0;
  e.target = { x: 800, y: 724 };
  g.updateHopper(e);
  const up = specialistMachinePose(snapshot(g, e));
  assert.equal(up.mode, 'rise');
  assert(up.legs.every((l) => !l.planted));
  Matter.Body.setVelocity(e.body, { x: 1, y: 5 });
  Matter.Body.setPosition(e.body, { x: 630, y: 500 });
  const fall = specialistMachinePose(snapshot(g, e));
  assert.equal(fall.mode, 'fall');
  assert.notDeepEqual(up.legs, fall.legs);
  Matter.Body.setPosition(e.body, { x: 600, y: 724 });
  Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
  e.timer = 0;
  g.updateHopper(e);
  g.machineBreakdown.update();
  const land = specialistMachinePose(snapshot(g, e));
  assert.equal(land.mode, 'land');
  assert(land.grounded);
  assert(land.legs.every((l) => l.planted));
  Matter.Body.setPosition(e.body, { x: 600, y: 500 });
  assert(!specialistMachinePose(snapshot(g, e)).grounded);
  assert(specialistMachinePose(snapshot(g, e)).legs.every((l) => !l.planted));
  assert.equal(
    machineBodySnapshot(e, g.time)!.specialist!.grounded,
    false,
    'two-argument detached factory never invents support',
  );
});

test('Sniper hardware follows exact tracking locks, native first/second Twin shots and measured breech recovery', () => {
  const { g, e } = native('sniper', 'twin');
  e.state = 'windup';
  e.timer = SNIPER_TELL;
  assert(specialistMachinePose(snapshot(g, e)).tracking);
  e.timer = 0.32;
  const lock = specialistMachinePose(snapshot(g, e));
  assert(lock.locked && !lock.tracking);
  assert.equal(lock.legs.length, 3, 'all tripod posts have overridable joints');
  e.timer = 0;
  g.machineBreakdown.update();
  g.updateSniper(e);
  g.machineBreakdown.update();
  const firstSpent = specialistMachinePose(snapshot(g, e));
  assert.equal(e.state, 'followup');
  assert(firstSpent.breech[0] > 0.9);
  assert.equal(firstSpent.breech[1], 0);
  e.timer = TWIN_LOCK;
  assert.equal(specialistMachinePose(snapshot(g, e)).mode, 'second-lock');
  e.timer = 0;
  g.updateSniper(e);
  g.machineBreakdown.update();
  g.time += 0.15;
  const recovery = specialistMachinePose(snapshot(g, e));
  assert.equal(recovery.mode, 'breech');
  assert.equal(recovery.breech[0], 0);
  assert(recovery.breech[1] > 0.5);
  assert.equal(snapshot(g, e).specialist!.recovery, 'breech');
});

test('native support projection and draw calls leave Game, RNG, Matter IDs, save callbacks and audio untouched', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind);
    const grounded = g.enemyGrounded(e);
    const id = (Matter.Common as unknown as { _nextId: number })._nextId;
    const before = JSON.stringify({
      checkpoint: g.checkpointSnapshot(),
      body: {
        position: e.body.position,
        velocity: e.body.velocity,
        angle: e.body.angle,
        vertices: e.body.vertices.map((v) => ({ x: v.x, y: v.y })),
      },
      timer: e.timer,
      state: e.state,
      shots: g.shots,
      particles: g.particles,
    });
    g.rng = () => {
      throw new Error('draw consumed gameplay RNG');
    };
    g.onSound = () => {
      throw new Error('draw emitted audio');
    };
    g.onCheckpoint = () => {
      throw new Error('draw saved progress');
    };
    for (let i = 0; i < 3; i++) {
      const s = snapshot(g, e);
      assert.equal(s.specialist!.grounded, grounded);
      const a = canvas();
      drawMachineChassis(a.ctx, s, i === 1);
      drawSpecialistChassis(a.ctx, s, i === 1);
      assert.equal(a.depth, 0);
    }
    assert.equal(
      (Matter.Common as unknown as { _nextId: number })._nextId,
      id,
      'no temporary physics body allocation',
    );
    assert.equal(
      JSON.stringify({
        checkpoint: g.checkpointSnapshot(),
        body: {
          position: e.body.position,
          velocity: e.body.velocity,
          angle: e.body.angle,
          vertices: e.body.vertices.map((v) => ({ x: v.x, y: v.y })),
        },
        timer: e.timer,
        state: e.state,
        shots: g.shots,
        particles: g.particles,
      }),
      before,
    );
  }
});

test('specialist snapshots detach native target/attack/phase, support and identity while retaining the correct hull and scale', () => {
  const { g, e } = native('sniper', 'twin');
  e.target = { x: 500, y: 700 };
  e.phase = 1;
  e.attacks = 2;
  e.squad = { kind: 'ambush', role: 'lead', connected: true, side: 1, planAt: 0, jumpAt: 0 };
  const s = snapshot(g, e),
    original = structuredClone(s);
  assert.deepEqual(s.target, e.target);
  assert.equal(s.attack, e.attack);
  assert.equal(s.phase, 1);
  assert.equal(s.attacks, 2);
  assert.equal(s.hull.x, ENEMY_STATS.sniper.w);
  assert.equal(s.hull.y, ENEMY_STATS.sniper.h);
  e.target.x += 100;
  e.squad.connected = false;
  Matter.Body.translate(e.body, { x: 20, y: -20 });
  assert.deepEqual(s, original);
});

test('all three specialist chassis render bounded finite geometry through native states, wear, aim, compatibility overlays and reduced effects', () => {
  let rendered = 0;
  for (const kind of kinds) {
    const { g, e } = native(kind, kind === 'sniper' ? 'twin' : 'plain');
    for (const state of [
      'idle',
      'windup',
      'rush',
      'recover',
      'airborne',
      'followup',
    ] as Enemy['state'][])
      for (const ratio of [1, 0.65, 0.3])
        for (const reduced of [false, true])
          for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
            e.state = state;
            e.timer = 0.2;
            e.hp = e.maxHp * ratio;
            e.aim = { x: Math.cos(angle), y: Math.sin(angle) };
            const s = snapshot(g, e),
              a = canvas();
            drawMachineChassis(a.ctx, s, reduced);
            numeric(machinePose(s, reduced));
            assert.equal(a.depth, 0);
            assert(a.ops.length < 600);
            assert(a.ops.some((o) => o.name === 'arc'));
            rendered++;
          }
  }
  assert.equal(rendered, 432);
});

test('native Sniper and Twin barrels preserve their exact preexisting command transforms and endpoints', () => {
  for (const elite of ['plain', 'twin']) {
    const { g, e } = native('sniper', elite);
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
      for (const reduced of [false, true]) {
        e.aim = { x: Math.cos(angle), y: Math.sin(angle) };
        e.state = 'windup';
        e.timer = 0.2;
        const a = canvas(),
          element = {
            getContext: () => a.ctx,
            getBoundingClientRect: () => ({ width: 960, height: 600 }),
          } as unknown as HTMLCanvasElement;
        const r = new Renderer(element, g);
        r.reduced = reduced;
        r.drawEnemies();
        const b = canvas(),
          pose = enemyPose(e, reduced);
        b.ctx.save();
        b.ctx.rotate(angle);
        b.ctx.translate(-pose.brace * 2, 0);
        if (elite === 'twin') {
          b.ctx.fillStyle = '#e9ac78';
          b.ctx.fillRect(7, -8, 30, 4);
          b.ctx.fillStyle = '#e9ac78';
          b.ctx.fillRect(7, 4, 30, 4);
        } else {
          b.ctx.fillStyle = '#e9ac78';
          b.ctx.fillRect(7, -3, 30, 4);
        }
        if (pose.brace > 0) {
          b.ctx.fillStyle = '#ffe0a0';
          b.ctx.fillRect(9, -1, 6 * pose.brace, 2);
        }
        b.ctx.restore();
        assert(
          JSON.stringify(a.ops).includes(JSON.stringify(b.ops).slice(1, -1)),
          elite + ' native muzzle commands unchanged',
        );
        assert.equal(a.depth, 0);
      }
  }
});

test('Pause and reduced poses freeze locomotion while keeping exact lock/readiness information', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind);
    e.state = 'windup';
    e.timer = 0.2;
    Matter.Body.setVelocity(e.body, { x: 2, y: 0 });
    const before = specialistMachinePose(snapshot(g, e));
    g.setMode('paused');
    for (let i = 0; i < 20; i++) g.tick(1 / 60, idle);
    assert.deepEqual(specialistMachinePose(snapshot(g, e)), before);
    const reduced = specialistMachinePose(snapshot(g, e), true);
    g.time += 1;
    assert.deepEqual(specialistMachinePose(snapshot(g, e), true), reduced);
  }
});
