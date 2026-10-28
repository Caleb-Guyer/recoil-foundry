import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import { machineBodySnapshot } from '../src/machine-breakdown-pose.ts';
import { supportMachinePose, type SupportMachineKind } from '../src/support-machine-pose.ts';
import { drawSupportChassis } from '../src/support-machine-art.ts';
import { drawSupport } from '../src/teamwork-art.ts';
import { drawFabricator } from '../src/fabricator-art.ts';
import { SUPPORT } from '../src/teamwork.ts';
import { FABRICATOR_BUILD, sentryMuzzle } from '../src/fabricator.ts';
import {
  supportSystemsTestFromUrl,
  supportSystemsTestRoom,
  prepareSupportSystemsTest,
} from '../src/support-systems-test.ts';

type Op = { name: string; args: unknown[] };
function canvas(warnings = false) {
  const ops: Op[] = [],
    stack: Record<string, unknown>[] = [],
    state: Record<string, unknown> = { globalAlpha: 0.85, lineWidth: 1 };
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
        for (const n of args) if (typeof n === 'number') assert(Number.isFinite(n), String(key));
        if (key === 'arc' || key === 'ellipse') assert(Number(args[2]) >= 0);
        if (key === 'fillRect' || key === 'strokeRect')
          assert(Number(args[2]) >= 0 && Number(args[3]) >= 0);
        assert(!['fillText', 'strokeText', 'drawImage', 'clearRect'].includes(String(key)));
        assert(warnings || key !== 'setLineDash', 'chassis does not invent warning footprints');
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
const kinds = ['repairer', 'relay', 'fabricator', 'sentry'] as const;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1800, y: 500 },
};
function native(kind: SupportMachineKind) {
  const f = supportSystemsTestFromUrl(
    new URL('https://test/?test=support-systems&unit=' + kind + '&v=1'),
  )!;
  assert(f);
  const g = new Game();
  g.startTest(f.checkpoint, supportSystemsTestRoom(f));
  assert(prepareSupportSystemsTest(g, f));
  for (const e of g.enemies) e.spawn = 0;
  const e = g.enemies.find((e) => e.kind === kind)!;
  assert(e);
  g.time = 2;
  return { g, e };
}
const snapshot = (g: Game, e: Enemy) => machineBodySnapshot(e, g.time, g)!;
function link(g: Game, e: Enemy) {
  const target = g.enemies.find(
    (other) => other.kind === 'shooter' && other.body.position.x < 1400,
  )!;
  assert(target);
  e.support!.target = target.id;
  e.support!.phase = 'windup';
  e.support!.timer = SUPPORT.tell;
  e.state = 'windup';
  return target;
}
function draw(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced = false, portrait = false) {
  if (e.support) drawSupport(c, g, e, reduced, portrait);
  else drawFabricator(c, g, e, reduced, portrait);
}
const close = (a: number, b: number) => assert(Math.abs(a - b) < 1e-8, a + ' != ' + b);
function numeric(v: unknown) {
  if (typeof v === 'number') assert(Number.isFinite(v));
  else if (Array.isArray(v)) v.forEach(numeric);
  else if (v && typeof v === 'object') Object.values(v).forEach(numeric);
}

test('Repairer reservoir and pump follow actual finite repairs, including the last pulse whose native phase immediately finishes', () => {
  const { g, e } = native('repairer'),
    target = link(g, e);
  target.hp = target.maxHp - 30;
  g.machineBreakdown.update();
  e.support!.timer = 0;
  g.teamwork.tick(0.001);
  g.machineBreakdown.update();
  let s = snapshot(g, e),
    p = supportMachinePose(s);
  assert.equal(target.hp, target.maxHp - 22);
  assert.equal(p.reserve, 40 / 48);
  assert.equal(p.pulse, 1);
  assert(p.tools[0].active);
  assert.equal(s.supportMachine!.support!.pulse!.amount, 8);
  const targetAngle = Math.atan2(
    target.body.position.y - e.body.position.y,
    target.body.position.x - e.body.position.x,
  );
  close(p.tools[0].angle!, targetAngle);
  e.support!.remaining = 2;
  target.hp = target.maxHp - 2;
  e.support!.timer = 0;
  g.machineBreakdown.update();
  g.teamwork.tick(0.001);
  g.machineBreakdown.update();
  s = snapshot(g, e);
  p = supportMachinePose(s);
  assert.equal(target.hp, target.maxHp);
  assert.equal(p.reserve, 0);
  assert.equal(p.mode, 'spent');
  assert.equal(p.pulse, 1);
  assert.equal(s.supportMachine!.support!.partner, null);
  assert.equal(s.supportMachine!.support!.pulse!.amount, 2);
  close(p.tools[0].angle!, targetAngle);
});

test('Relay coils charge on native windup, while cells disappear only for actual partner charge consumption', () => {
  const { g, e } = native('relay'),
    target = link(g, e);
  e.support!.timer = SUPPORT.tell / 2;
  assert.equal(supportMachinePose(snapshot(g, e)).coil, 0.5);
  e.support!.timer = 0;
  g.teamwork.tick(0.001);
  g.machineBreakdown.update();
  assert.equal(supportMachinePose(snapshot(g, e)).coil, 1);
  assert.deepEqual(supportMachinePose(snapshot(g, e)).cells, [true, true, true]);
  e.support!.timer = 0;
  g.teamwork.tick(0.001);
  g.machineBreakdown.update();
  assert.equal(e.support!.remaining, 3);
  assert.equal(supportMachinePose(snapshot(g, e)).pulse, 0);
  assert.deepEqual(supportMachinePose(snapshot(g, e)).cells, [true, true, true]);
  e.support!.phase = 'ready';
  e.support!.target = target.id;
  g.machineBreakdown.update();
  assert(g.teamwork.takeCharge(target));
  g.machineBreakdown.update();
  assert.deepEqual(supportMachinePose(snapshot(g, e)).cells, [true, true, false]);
  assert.equal(supportMachinePose(snapshot(g, e)).pulse, 1);
  assert.equal(supportMachinePose(snapshot(g, e), true).pulse, 0);
});

test('Fabricator articulated weld stroke and actual owned Sentry deployment derive the 2.2-second native construction clock', () => {
  const { g, e } = native('fabricator');
  e.timer = 0;
  g.fabricators.updateBuilder(e);
  const child = g.enemies.find((other) => other.sentry?.owner === e.id)!;
  assert(child);
  assert.equal(child.sentry!.ready, false);
  assert.equal(e.timer, FABRICATOR_BUILD);
  let p = supportMachinePose(snapshot(g, e));
  assert.equal(p.assembly, 0);
  assert.equal(p.mode, 'building');
  assert(p.tools.every((t) => t.active));
  e.timer = FABRICATOR_BUILD * 0.75;
  const quarter = supportMachinePose(snapshot(g, e));
  assert.equal(quarter.assembly, 0.25);
  assert.notEqual(quarter.tools[0].tip.y, p.tools[0].tip.y);
  assert.equal(supportMachinePose(snapshot(g, child)).assembly, 0.25);
  e.timer = FABRICATOR_BUILD * 0.5;
  p = supportMachinePose(snapshot(g, child));
  assert.equal(p.assembly, 0.5);
  assert.equal(p.barrel!.length, 18);
  assert.equal(supportMachinePose(snapshot(g, e), true).tools[0].tip.y, -12);
  e.timer = 0;
  g.fabricators.updateBuilder(e);
  assert(child.sentry!.ready);
  assert.equal(supportMachinePose(snapshot(g, child)).assembly, 1);
  assert.equal(supportMachinePose(snapshot(g, child)).barrel!.length, 26);
  assert.equal(supportMachinePose(snapshot(g, e)).mode, 'recover');
  assert.equal(e.fabricator!.built, 1);
});

test('Sentry barrel keeps the exact native muzzle and recoils for real discharge, never for support-loss recovery', () => {
  const { g, e } = native('sentry');
  e.state = 'windup';
  e.timer = 0.2;
  e.aim = { x: -0.8, y: -0.6 };
  g.machineBreakdown.update();
  const before = supportMachinePose(snapshot(g, e));
  assert.equal(before.receiver, 0);
  assert.equal(before.mode, 'locked');
  assert.deepEqual(before.barrel!.origin, { x: 0, y: -8 });
  close(before.barrel!.angle, Math.atan2(-0.6, -0.8));
  e.timer = 0;
  g.fabricators.updateSentry(e);
  g.machineBreakdown.update();
  assert.equal(g.shots.length, 1);
  const from = sentryMuzzle(e);
  close(g.shots[0].pos.x, from.x + e.aim.x * 26);
  close(g.shots[0].pos.y, from.y + e.aim.y * 26);
  const after = supportMachinePose(snapshot(g, e));
  assert(after.receiver > 1.9);
  assert(after.barrel!.recoil > 0.99);
  g.time += 0.12;
  assert(supportMachinePose(snapshot(g, e)).receiver < after.receiver);
  const loss = native('sentry');
  loss.e.state = 'windup';
  loss.e.timer = 0.2;
  loss.g.machineBreakdown.update();
  loss.g.fabricators.disrupt(loss.e.body);
  loss.g.machineBreakdown.update();
  assert.equal(loss.e.timer, 0.6);
  assert.equal(loss.g.shots.length, 0);
  assert.equal(supportMachinePose(snapshot(loss.g, loss.e)).barrel!.recoil, 0);
});

test('native support link rings and plus/bolt cues and Sentry aim origins remain precise; portraits suppress world tells', () => {
  for (const kind of ['repairer', 'relay'] as const) {
    const { g, e } = native(kind),
      target = link(g, e),
      a = canvas(true),
      b = canvas(true);
    draw(a.c, g, e);
    draw(b.c, g, e, true);
    for (const result of [a, b]) {
      assert(
        result.ops.some(
          (o) =>
            o.name === 'moveTo' &&
            o.args[0] === e.body.position.x &&
            o.args[1] === e.body.position.y,
        ),
      );
      assert(
        result.ops.some(
          (o) =>
            o.name === 'lineTo' &&
            o.args[0] === target.body.position.x &&
            o.args[1] === target.body.position.y,
        ),
      );
      assert(
        result.ops.some(
          (o) =>
            o.name === 'arc' &&
            o.args[0] === target.body.position.x &&
            o.args[1] === target.body.position.y &&
            o.args[2] === 23,
        ),
      );
      assert.equal(result.depth, 0);
    }
    const portrait = canvas();
    draw(portrait.c, g, e, false, true);
    assert.equal(portrait.depth, 0);
    assert(!portrait.ops.some((o) => o.name === 'arc' && o.args[2] === 23));
  }
  const { g, e } = native('sentry');
  e.state = 'windup';
  e.timer = 0.2;
  e.aim = { x: -1, y: 0 };
  const c = canvas(true);
  draw(c.c, g, e);
  const from = sentryMuzzle(e),
    end = g.lineEnd(from, { x: from.x + e.aim.x * 1300, y: from.y + e.aim.y * 1300 }, 4);
  assert(c.ops.some((o) => o.name === 'moveTo' && o.args[0] === from.x && o.args[1] === from.y));
  assert(c.ops.some((o) => o.name === 'lineTo' && o.args[0] === end.x && o.args[1] === end.y));
  const portrait = canvas();
  draw(portrait.c, g, e, false, true);
  assert.equal(portrait.depth, 0);
});

test('all four rigs render bounded finite family hardware across damage wear, facing, vertical aim, reduced effects and portraits', () => {
  let count = 0;
  for (const kind of kinds) {
    const { g, e } = native(kind);
    if (e.support) link(g, e);
    for (const state of ['idle', 'windup', 'recover'] as Enemy['state'][])
      for (const ratio of [1, 0.65, 0.3])
        for (const facing of [-1, 1])
          for (const reduced of [false, true])
            for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
              e.state = state;
              e.timer = 0.2;
              e.hp = e.maxHp * ratio;
              e.facing = facing;
              e.aim = { x: Math.cos(a), y: Math.sin(a) };
              const s = snapshot(g, e),
                p = supportMachinePose(s, reduced),
                c = canvas();
              numeric(p);
              assert.equal(p.wear, ratio === 1 ? 0 : ratio === 0.65 ? 1 : 2);
              drawSupportChassis(c.c, s, reduced, p);
              assert.equal(c.depth, 0);
              assert(c.ops.length < 700);
              count++;
            }
    const portrait = canvas();
    draw(portrait.c, g, e, false, true);
    assert.equal(portrait.depth, 0);
    assert(
      !portrait.ops.some(
        (o) => o.name === 'fillRect' && JSON.stringify(o.args) === '[-16,-28,32,3]',
      ),
    );
  }
  assert.equal(count, 576);
});

test('rendering a linked or frozen partner is read-only: RNG, Matter IDs, velocities, controller state, HP, audio and saves remain untouched', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind);
    const target = e.support ? link(g, e) : null;
    const capture = () =>
      JSON.stringify({
        save: g.checkpointSnapshot(),
        enemies: g.enemies.map((other) => ({
          pos: other.body.position,
          vel: other.body.velocity,
          state: other.state,
          timer: other.timer,
          hp: other.hp,
          support: other.support,
          fabricator: other.fabricator,
          sentry: other.sentry,
        })),
        shots: g.shots,
        particles: g.particles,
      });
    g.rng = () => {
      throw Error('draw RNG');
    };
    g.onSound = () => {
      throw Error('draw sound');
    };
    g.onCheckpoint = () => {
      throw Error('draw save');
    };
    if (target) {
      Matter.Body.setVelocity(target.body, { x: 3, y: -1 });
      g.cryogenic.state(target).frozen = g.time + 2;
    }
    const before = capture(),
      id = (Matter.Common as unknown as { _nextId: number })._nextId;
    for (const reduced of [false, true]) {
      const c = canvas(true);
      draw(c.c, g, e, reduced);
      assert.equal(c.depth, 0);
    }
    assert.equal(capture(), before);
    assert.equal((Matter.Common as unknown as { _nextId: number })._nextId, id);
    if (target) {
      assert.deepEqual(target.body.velocity, { x: 3, y: -1 });
      assert.equal(snapshot(g, e).supportMachine!.support!.partner, null);
    }
  }
});

test('Pause freezes hardware and Reduced effects holds secondary movement while preserving actual supplies and lock state', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind);
    if (e.support) link(g, e);
    e.state = 'windup';
    e.timer = 0.2;
    Matter.Body.setVelocity(e.body, { x: 1, y: 0 });
    const before = supportMachinePose(snapshot(g, e));
    g.setMode('paused');
    for (let i = 0; i < 20; i++) g.tick(1 / 60, idle);
    assert.deepEqual(supportMachinePose(snapshot(g, e)), before);
    const quiet = supportMachinePose(snapshot(g, e), true);
    g.time += 1;
    assert.deepEqual(supportMachinePose(snapshot(g, e), true), quiet);
  }
});
