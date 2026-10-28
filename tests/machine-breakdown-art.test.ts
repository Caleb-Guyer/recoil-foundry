import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy } from '../src/game.ts';
import { Renderer } from '../src/render.ts';
import { enemyRemasterTestFromUrl } from '../src/enemy-encounters.ts';
import {
  machineBodySnapshot,
  machinePose,
  type MachineKind,
  type MachineBodySnapshot,
} from '../src/machine-breakdown-pose.ts';
import {
  drawMachineBody,
  drawMachineChassis,
  drawMachineContacts,
} from '../src/machine-breakdown-art.ts';
import { machineWear } from '../src/enemy-remaster-art.ts';
import { SPLIT_SCALE } from '../src/mutations.ts';
import { enemyPose } from '../src/combat-feel.ts';

type Op = { name: string; args: unknown[] };
function canvas() {
  let depth = 0;
  const ops: Op[] = [],
    saved: Record<string, unknown>[] = [];
  const values: Record<string, unknown> = { globalAlpha: 1, lineWidth: 1 };
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get(_, key) {
      if (Object.hasOwn(values, key)) return values[String(key)];
      return (...args: unknown[]) => {
        if (key === 'save') {
          saved.push({ ...values });
          depth++;
        }
        if (key === 'restore') {
          assert(depth > 0);
          depth--;
          Object.keys(values).forEach((k) => delete values[k]);
          Object.assign(values, saved.pop());
        }
        for (const n of args) if (typeof n === 'number') assert(Number.isFinite(n), String(key));
        if (key === 'arc' || key === 'ellipse') assert((args[2] as number) >= 0);
        if (key === 'fillRect' || key === 'strokeRect')
          assert((args[2] as number) >= 0 && (args[3] as number) >= 0);
        assert(!['fillText', 'strokeText', 'drawImage', 'clearRect'].includes(String(key)));
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
      return depth;
    },
  };
}
function actor(kind: MachineKind) {
  const g = new Game();
  const cp = enemyRemasterTestFromUrl(new URL('https://test/?test=enemies&unit=' + kind + '&v=1'))!;
  g.startTest(cp);
  const e = g.enemies.find((e) => e.kind === kind)!;
  assert(e);
  e.spawn = 0;
  g.time = 2;
  return { g, e };
}
function numeric(value: unknown) {
  if (typeof value === 'number') assert(Number.isFinite(value));
  else if (Array.isArray(value)) value.forEach(numeric);
  else if (value && typeof value === 'object') Object.values(value).forEach(numeric);
}
const snapshot = (g: Game, e: Enemy) => machineBodySnapshot(e, g.time)!;
const kinds: MachineKind[] = ['runner', 'shooter', 'flyer'];

test('native chase, locked windup, recovery and flight derive distinct articulated rigs', () => {
  for (const kind of kinds) {
    const { g, e } = actor(kind);
    Matter.Body.setVelocity(e.body, { x: 3, y: 0 });
    e.state = 'idle';
    const mobile = machinePose(snapshot(g, e));
    if (kind !== 'flyer') {
      assert.equal(mobile.legs.length, 2);
      assert(mobile.legs.every((l) => l.knee.x !== l.hip.x && l.knee.y !== l.foot.y));
      Matter.Body.translate(e.body, { x: 8, y: 0 });
      assert.notDeepEqual(mobile.legs, machinePose(snapshot(g, e)).legs);
    } else {
      g.time += 0.04;
      assert.notEqual(mobile.rotor, machinePose(snapshot(g, e)).rotor);
    }
    e.state = 'windup';
    e.timer = 0.1;
    const windup = machinePose(snapshot(g, e));
    assert(windup.brace > 0.5);
    if (kind === 'shooter') assert(windup.legs.every((l) => l.planted));
    e.state = 'recover';
    e.timer = 0.3;
    const recovery = machinePose(snapshot(g, e));
    assert(recovery.recover);
    assert(recovery.receiver > 1);
    assert.notDeepEqual(recovery, windup);
    e.state = 'airborne';
    Matter.Body.setVelocity(e.body, { x: -2, y: 5 });
    if (kind !== 'flyer') assert(machinePose(snapshot(g, e)).legs.every((l) => !l.planted));
  }
});

test('wear retains actual 65/30 percent thresholds for every family and the native state is untouched', () => {
  for (const kind of kinds) {
    const { g, e } = actor(kind);
    for (const hp of [e.maxHp, e.maxHp * 0.65, e.maxHp * 0.3, 1]) {
      e.hp = hp;
      const before = JSON.stringify({
        hp: e.hp,
        state: e.state,
        p: e.body.position,
        v: e.body.velocity,
        aim: e.aim,
        timer: e.timer,
        shots: g.shots,
        rng: g.rng,
        checkpoint: g.checkpointSnapshot(),
      });
      const s = snapshot(g, e),
        a = canvas();
      drawMachineChassis(a.ctx, s);
      drawMachineBody(a.ctx, g, e, true);
      assert.equal(machinePose(s).wear, machineWear(e));
      assert.equal(a.depth, 0);
      assert.equal(
        JSON.stringify({
          hp: e.hp,
          state: e.state,
          p: e.body.position,
          v: e.body.velocity,
          aim: e.aim,
          timer: e.timer,
          shots: g.shots,
          rng: g.rng,
          checkpoint: g.checkpointSnapshot(),
        }),
        before,
      );
    }
  }
});

test('plain snapshots copy native hull, split scale and all variant identity without retaining enemy references', () => {
  const { g, e } = actor('runner');
  e.splitChild = true;
  Matter.Body.scale(e.body, SPLIT_SCALE, SPLIT_SCALE);
  Matter.Body.setAngle(e.body, 0.25);
  e.allied = true;
  e.elite = 'shielded';
  e.mutation = { kind: 'splitter', phase: 'tell', timer: 0.2, count: 2 };
  e.squad = { kind: 'shield', role: 'lead', connected: true, side: 1, planAt: 0, jumpAt: 0 };
  const s = snapshot(g, e),
    saved = structuredClone(s);
  assert.equal(s.scale, SPLIT_SCALE);
  assert.equal(s.splitChild, true);
  assert(Math.abs(s.hull.x - 30 * SPLIT_SCALE) < 0.01);
  assert.equal(s.bodyAngle, 0.25);
  assert.equal(s.facing, e.facing);
  assert.deepEqual(s.mutation, { kind: 'splitter', phase: 'tell', timer: 0.2, count: 2 });
  assert.deepEqual(s.squad, { kind: 'shield', role: 'lead', connected: true });
  e.aim.x = -e.aim.x;
  e.mutation.timer = 10;
  e.squad.connected = false;
  Matter.Body.translate(e.body, { x: 20, y: 20 });
  assert.deepEqual(s, saved);
});

test('all families, native identity layers, wear, aims and quiet poses render finite bounded geometry', () => {
  let count = 0;
  for (const kind of kinds) {
    const { g, e } = actor(kind);
    const variants = ['ordinary', 'elite', 'mutation', 'squad', 'split', 'allied'];
    for (const variant of variants) {
      e.elite =
        variant === 'elite'
          ? kind === 'runner'
            ? 'shielded'
            : kind === 'shooter'
              ? 'twin'
              : 'volatile'
          : undefined;
      e.mutation =
        variant === 'mutation'
          ? {
              kind: kind === 'runner' ? 'splitter' : kind === 'shooter' ? 'gunner' : 'blinker',
              phase: 'idle',
              timer: 0,
              count: 0,
            }
          : undefined;
      e.squad =
        variant === 'squad'
          ? { kind: 'flank', role: 'support', connected: true, side: 1, planAt: 0, jumpAt: 0 }
          : undefined;
      e.splitChild = variant === 'split';
      e.allied = variant === 'allied';
      for (const ratio of [1, 0.65, 0.3])
        for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
          for (const reduced of [false, true]) {
            e.hp = e.maxHp * ratio;
            e.aim = { x: Math.cos(angle), y: Math.sin(angle) };
            const s = snapshot(g, e),
              a = canvas();
            drawMachineChassis(a.ctx, s, reduced);
            numeric(machinePose(s, reduced));
            assert.equal(a.depth, 0);
            assert(a.ops.length < 500, 'bounded per-body operation budget');
            assert(
              a.ops.some((o) => o.name === 'arc'),
              'mechanical joints/housings',
            );
            assert(
              a.ops.some((o) => o.name === 'lineTo'),
              'connected physical links',
            );
            count++;
          }
    }
  }
  assert.equal(count, 432);
});

test('Pause freezes the native simulation pose; reduced effects never animate rotor or locomotion clocks', () => {
  for (const kind of kinds) {
    const { g, e } = actor(kind);
    Matter.Body.setVelocity(e.body, { x: 3, y: 0 });
    const before = machinePose(snapshot(g, e));
    g.setMode('paused');
    for (let i = 0; i < 30; i++)
      g.tick(1 / 60, {
        left: false,
        right: false,
        jump: false,
        jumpHeld: false,
        fire: false,
        aim: { x: 500, y: 500 },
      });
    assert.deepEqual(machinePose(snapshot(g, e)), before);
    const quiet = machinePose(snapshot(g, e), true);
    g.time += 100;
    Matter.Body.translate(e.body, { x: 50, y: 0 });
    assert.deepEqual(machinePose(snapshot(g, e), true), quiet);
  }
});

test('shutdown art can override folded joints and stopped rotors without mutating the live snapshot', () => {
  for (const kind of kinds) {
    const { g, e } = actor(kind),
      s = snapshot(g, e),
      original = structuredClone(s),
      p = machinePose(s);
    p.body = { x: 4, y: 8 };
    p.angle = 0.3;
    p.rotor = 0;
    p.legs = p.legs.map((l) => ({
      ...l,
      knee: { x: l.knee.x, y: 10 },
      foot: { x: l.foot.x, y: 12 },
      planted: true,
    }));
    const a = canvas();
    drawMachineChassis(a.ctx, s, false, p);
    assert.equal(a.depth, 0);
    assert.deepEqual(s, original);
  }
});

test('live gunner/flyer native barrel coordinates and elite/mutation/squad overlays remain independent of chassis motion', () => {
  for (const kind of ['shooter', 'flyer'] as MachineKind[]) {
    const { g, e } = actor(kind);
    e.state = 'windup';
    e.timer = 0.14;
    e.aim = { x: -0.8, y: 0.6 };
    const a = canvas(),
      canvasElement = {
        getContext: () => a.ctx,
        getBoundingClientRect: () => ({ width: 960, height: 600 }),
      } as unknown as HTMLCanvasElement;
    const renderer = new Renderer(canvasElement, g);
    renderer.drawEnemies();
    const native = canvas(),
      pose = enemyPose(e, false);
    native.ctx.save();
    native.ctx.rotate(Math.atan2(e.aim.y, e.aim.x));
    native.ctx.translate(-pose.brace * 2, 0);
    native.ctx.fillStyle = '#ee7965';
    native.ctx.fillRect(7, -3, 22, 6);
    if (pose.brace > 0) {
      native.ctx.fillStyle = '#ffe0a0';
      native.ctx.fillRect(9, -1, 6 * pose.brace, 2);
    }
    native.ctx.restore();
    assert(
      JSON.stringify(a.ops).includes(JSON.stringify(native.ops).slice(1, -1)),
      kind + ' exact native barrel subsequence',
    );
    assert.equal(a.depth, 0);
  }
});

test('actual blocked and health-loss contacts draw distinct hull-local outcomes, while directionless damage invents no contact', () => {
  const { g, e } = actor('runner');
  e.elite = 'shielded';
  e.facing = 1;
  g.hitEnemy(e, 10, { x: e.body.position.x + 100, y: e.body.position.y });
  const block = g.machineBreakdown.getHits(e.id).at(-1)!;
  assert(block.blocked && block.contact && block.absorbed > 0 && block.healthLost > 0);
  const a = canvas();
  drawMachineContacts(a.ctx, g, e, false);
  assert(a.ops.some((o) => o.name === 'style:strokeStyle' && o.args[0] === '#dfc69b'));
  assert.equal(a.depth, 0);
  g.machineBreakdown.reset();
  e.elite = undefined;
  g.hitEnemy(e, 5, { x: e.body.position.x - 100, y: e.body.position.y });
  const b = canvas();
  drawMachineContacts(b.ctx, g, e, false);
  assert(b.ops.some((o) => o.name === 'style:fillStyle' && o.args[0] === '#172327'));
  assert.notDeepEqual(a.ops, b.ops);
  assert.equal(b.depth, 0);
  g.machineBreakdown.reset();
  g.hitEnemy(e, 2);
  assert.equal(g.machineBreakdown.getHits(e.id).at(-1)!.contact, null);
  const c = canvas();
  drawMachineContacts(c.ctx, g, e, false);
  assert(!c.ops.some((o) => o.name === 'arc' || o.name === 'lineTo'));
  g.time += 0.25;
  const expired = canvas();
  drawMachineContacts(expired.ctx, g, e, false);
  assert(!expired.ops.some((o) => o.name === 'arc' || o.name === 'lineTo'));
});

test('native identity glyphs and allegiance survive replacement of only their family base body', () => {
  for (const kind of kinds) {
    const { g, e } = actor(kind),
      a = canvas(),
      canvasElement = {
        getContext: () => a.ctx,
        getBoundingClientRect: () => ({ width: 960, height: 600 }),
      } as unknown as HTMLCanvasElement;
    const renderer = new Renderer(canvasElement, g);
    e.elite = kind === 'runner' ? 'shielded' : kind === 'shooter' ? 'twin' : 'volatile';
    e.mutation = {
      kind: kind === 'runner' ? 'splitter' : kind === 'shooter' ? 'gunner' : 'blinker',
      phase: 'idle',
      timer: 0,
      count: 0,
    };
    e.squad = { kind: 'flank', role: 'support', connected: true, side: 1, planAt: 0, jumpAt: 0 };
    renderer.drawEnemies();
    const hasRect = (r: number[]) =>
      a.ops.some((o) => o.name === 'fillRect' && JSON.stringify(o.args) === JSON.stringify(r));
    assert(hasRect([-7, 9, 4, 3]) && hasRect([3, 9, 4, 3]), 'native connected squad marks');
    if (kind === 'runner') {
      assert(hasRect([-14, -14, 28, 28]), 'native splitter body identity');
      assert(
        a.ops.some((o) => o.name === 'lineTo' && JSON.stringify(o.args) === '[28,18]'),
        'native front shield',
      );
    }
    if (kind === 'shooter') {
      assert(hasRect([7, -8, 30, 4]) && hasRect([7, 4, 30, 4]), 'native twin barrels');
      assert(hasRect([-23, -14, 10, 28]), 'native gunner backpack');
    }
    if (kind === 'flyer')
      assert(
        a.ops.some((o) => o.name === 'style:strokeStyle' && o.args[0] === '#bd9fde'),
        'native blinker braces',
      );
    e.allied = true;
    e.mutation = undefined;
    e.squad = undefined;
    a.ops.length = 0;
    renderer.drawEnemies();
    assert(
      a.ops.some((o) => o.name === 'style:fillStyle' && o.args[0] === '#79b9e0'),
      'all three ally chassis, including volatile, carry the explicit blue body palette',
    );
    assert(
      !a.ops.some(
        (o) => o.name === 'style:fillStyle' && ['#df846e', '#ee7965'].includes(String(o.args[0])),
      ),
      'an allied body and its barrels never keep hostile red',
    );
    if (kind !== 'flyer')
      assert(
        a.ops.some((o) => o.name === 'style:fillStyle' && o.args[0] === '#6bb7ff'),
        'existing blue target lamp and native barrel remain',
      );
    assert.equal(a.depth, 0);
  }
});

test('volatile fuse pose follows its existing full native tell instead of the ordinary gunner brace clock', () => {
  const { g, e } = actor('flyer');
  e.elite = 'volatile';
  e.state = 'windup';
  e.timer = 0.45;
  assert.equal(machinePose(snapshot(g, e)).brace, 0.5);
  e.timer = 0.9;
  assert.equal(machinePose(snapshot(g, e)).brace, 0);
  e.timer = 0;
  assert.equal(machinePose(snapshot(g, e)).brace, 1);
});
