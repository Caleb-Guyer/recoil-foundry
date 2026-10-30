import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import { Renderer } from '../src/render.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import {
  drawMachineWreck,
  drawMachineWrecks,
  projectMachineWreck,
} from '../src/machine-breakdown-wreck-art.ts';
import {
  overseerShutdownPose,
  drawOverseerMachineWreck,
} from '../src/overseer-machine-wreck-art.ts';
import { overseerMachinePose, type OverseerMachineKind } from '../src/overseer-machine-pose.ts';
import { drawOverseerChassis } from '../src/overseer-machine-art.ts';
import { MACHINE_MAX_WRECKS, type MachineWreck } from '../src/machine-breakdown.ts';
import { welderTestFromUrl } from '../src/welder-test.ts';
import { WELD_TELL } from '../src/welder.ts';
import { switchboardTestFromUrl } from '../src/switchboard-layout.ts';
import { SIGNAL } from '../src/switchboard.ts';
import { auditorTestFromUrl } from '../src/auditor-layout.ts';
import { AUDITOR_VISIT, AUDITOR_RECALL, AUDITOR_WARNING } from '../src/auditor.ts';
import { round } from './branches-fixture.ts';
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

const kinds = ['welder', 'switchboard', 'auditor'] as const;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1100, y: 710 },
};
function floorOnly(g: Game) {
  for (const b of [...g.terrain])
    if (b.bounds.min.y < 739 && b.bounds.min.x >= 0 && b.bounds.max.x <= 2000) {
      Matter.Composite.remove(g.engine.world, b);
      g.terrain = g.terrain.filter((t) => t !== b);
    }
  for (const p of [...g.props.items]) g.props.remove(p);
}
function course(kind: OverseerMachineKind, recall = false) {
  const cp =
    kind === 'welder'
      ? welderTestFromUrl(new URL('https://test/?test=welder'))!
      : kind === 'switchboard'
        ? switchboardTestFromUrl(new URL('https://test/?test=switchboard&build=gun&mirror=0'))!
        : auditorTestFromUrl(
            new URL('https://test/?test=auditor&phase=' + (recall ? 'hunt' : 'final')),
          )!;
  assert(cp);
  const g = new Game();
  g.startTest(cp);
  g.time = 1;
  if (kind !== 'switchboard') {
    for (const e of [...g.enemies]) Matter.Composite.remove(g.engine.world, e.body);
    g.enemies = [];
    g.waves.clear();
    g.hazards.clear();
    g.mutations.clear();
  }
  floorOnly(g);
  let e: Enemy;
  if (kind === 'welder') {
    e = g.spawnEnemy('welder', 1100, 710);
    e.welder = { attack: 'seam', jumpAt: 0, stepAt: 0 };
  } else if (kind === 'switchboard') {
    e = g.enemies.find((e) => e.kind === 'switchboard')!;
    Matter.Body.setPosition(e.body, { x: 1400, y: 300 });
    g.engine.gravity.y = 0;
  } else {
    g.clear = false;
    g.auditor.update(2);
    assert(g.auditor.door);
    g.auditor.update(AUDITOR_WARNING + 0.01);
    e = g.auditor.enemy!;
    assert(e);
    Matter.Body.setPosition(e.body, { x: 1100, y: 711 });
  }
  assert(e);
  e.spawn = 0;
  e.timer = 0;
  Matter.Body.setPosition(g.player, { x: 500, y: 700 });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  g.machineBreakdown.update();
  return { g, e };
}
function welderAttack(g: Game, e: Enemy, attack: 'seam' | 'cover' | 'arc') {
  e.state = 'idle';
  e.timer = 0;
  e.attacks = attack === 'seam' ? 0 : attack === 'arc' ? 1 : 2;
  g.welder.updateEnemy(e, 0.001);
  assert.equal(e.state, 'windup');
  assert.equal(e.welder!.attack, attack);
  if (attack === 'arc') {
    e.timer = 0;
    g.time += WELD_TELL;
    g.welder.updateEnemy(e, 0.001);
  } else {
    g.time += WELD_TELL + 0.01;
    g.welder.update(WELD_TELL + 0.01);
  }
  g.machineBreakdown.update();
}
function switchStep(g: Game, e: Enemy, seconds: number) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    g.time += 1 / 60;
    g.switchboard.update(e, 1 / 60);
  }
  g.machineBreakdown.update();
}
function switchPlan(g: Game, e: Enemy, attack = 2) {
  e.attacks = attack;
  g.switchboard.begin(e);
  g.machineBreakdown.update();
  assert(e.switchboard!.plans.length);
}
function auditorFire(g: Game, e: Enemy) {
  e.auditor!.attack = 'burst';
  e.state = 'windup';
  e.timer = 0;
  g.auditor.updateEnemy(e, 0.001);
  assert.equal(e.state, 'rush');
  g.time += 0.01;
  g.auditor.updateEnemy(e, 0.001);
  g.machineBreakdown.update();
  assert.equal(e.auditor!.fired, 1);
  assert(g.shots.some((s) => s.auditorOwner === e.id));
}
function defeat(g: Game, e: Enemy) {
  g.hitEnemy(e, 1e9);
  const w = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id)!;
  assert(w, 'only real lethal damage captures a wreck');
  return w;
}
function native(kind: OverseerMachineKind) {
  const { g, e } = course(kind);
  if (kind === 'welder') welderAttack(g, e, 'seam');
  else if (kind === 'switchboard') switchPlan(g, e);
  else auditorFire(g, e);
  return { g, e, wreck: defeat(g, e) };
}
function close(a: number, b: number) {
  assert(Math.abs(a - b) < 1e-8, `${a} must equal ${b}`);
}
function inert(p: ReturnType<typeof overseerShutdownPose>) {
  assert(p);
  assert.equal(p.energy, 0);
  assert.equal(p.mode, 'shutdown');
  assert.equal(p.recoil, 0);
  assert.equal(p.deploy, 0);
  assert.equal(p.interruption, 0);
  assert.equal(p.receiver, 0);
  assert.equal(p.torch.heat, 0);
  assert.equal(p.torch.opening, 0);
  assert.equal(p.caseLatch.open, 0);
  assert.equal(p.caseLatch.recall, 0);
  assert(p.channels.every((c) => c.charge === 0 && !c.locked && c.release === 0 && !c.mobile));
  assert(p.magazine.every((m) => !m.loaded && !m.selected));
}
function draw(w: MachineWreck, age: number, reduced = false) {
  const c = canvas();
  assert(drawMachineWreck(c.context, w, w.at + age, reduced));
  assert.equal(c.depth, 0);
  return c.ops;
}

test('all three real Overseer defeats fold distinct captured production rigs into dark inert wrecks', () => {
  const signatures = [];
  for (const kind of kinds) {
    const { wreck } = native(kind),
      a = overseerShutdownPose(wreck.visual, 0)!,
      b = overseerShutdownPose(wreck.visual, 0.38)!;
    inert(a);
    inert(b);
    assert.equal(b.kind, kind);
    assert.equal(b.wear, 2);
    assert.notDeepEqual(a.body, b.body);
    assert.notDeepEqual(a.legs, b.legs);
    assert.notEqual(a.barrel.angle, b.barrel.angle);
    assert.deepEqual(
      overseerShutdownPose(wreck.visual, 0.4),
      overseerShutdownPose(wreck.visual, 0.8),
    );
    signatures.push(JSON.stringify(draw(wreck, 0.38)));
  }
  assert.equal(new Set(signatures).size, 3);
});
test('Welder shutdown preserves both real arm-link lengths and keeps its falling nozzle connected to the torch', () => {
  const { wreck } = native('welder'),
    a = overseerShutdownPose(wreck.visual, 0)!,
    b = overseerShutdownPose(wreck.visual, 0.38)!;
  for (const p of [a, b]) {
    inert(p);
    assert.deepEqual(p.torch.tip, p.barrel.origin);
    close(p.barrel.origin.x - Math.cos(p.barrel.angle) * p.barrel.length, p.gimbal.center.x);
    close(p.barrel.origin.y - Math.sin(p.barrel.angle) * p.barrel.length, p.gimbal.center.y);
  }
  for (const key of ['elbow', 'tip'] as const) {
    const from = key === 'elbow' ? 'shoulder' : 'elbow';
    close(
      Math.hypot(a.torch[key].x - a.torch[from].x, a.torch[key].y - a.torch[from].y),
      Math.hypot(b.torch[key].x - b.torch[from].x, b.torch[key].y - b.torch[from].y),
    );
  }
  assert.notDeepEqual(a.torch.elbow, b.torch.elbow);
  assert.notDeepEqual(
    a.tracks.map((t) => t.phase),
    b.tracks.map((t) => t.phase),
  );
  assert.deepEqual(
    a.tracks.map((t) => t.center),
    b.tracks.map((t) => t.center),
  );
  const support = wreck.visual.overseerMachine!.supportY!;
  for (const track of b.tracks)
    assert(
      wreck.visual.position.y + (track.center.y + 8) * wreck.visual.scale <= support + 0.000001,
    );
  assert.equal(a.barrel.length, b.barrel.length);
});
test('native hot Welder seams are captured before cleanup without reigniting or retaining corpse damage', () => {
  const { g, e } = course('welder');
  welderAttack(g, e, 'seam');
  assert(g.welder.seams.some((s) => s.ignited));
  const seams = g.welder.seams.map((s) => ({
      a: { ...s.a },
      b: { ...s.b },
      supportId: s.support.id,
    })),
    w = defeat(g, e);
  assert(w.visual.overseerMachine!.welder!.seams.some((s) => s.ignited));
  assert.deepEqual(
    w.visual.overseerMachine!.welder!.seams.map((s) => ({
      a: s.a,
      b: s.b,
      supportId: s.supportId,
    })),
    seams,
  );
  assert.equal(g.welder.seams.length, 0);
  assert.equal(g.welder.barriers.length, 0);
  draw(w, 0.3);
  const hp = g.hp;
  g.welder.update(10);
  assert.equal(g.hp, hp);
  assert.equal(g.welder.seams.length, 0);
  inert(overseerShutdownPose(w.visual, 0.2));
});
test('native Welder barriers and their real deployed cover are captured, then removed exactly once by owner defeat', () => {
  const { g, e } = course('welder');
  welderAttack(g, e, 'cover');
  const walls = g.props.items.filter((p) => p.welded);
  assert.equal(walls.length, 2);
  const original = walls.map((p) => ({
      id: p.body.id,
      hp: p.hp,
      position: { ...p.body.position },
    })),
    w = defeat(g, e);
  assert.deepEqual(
    w.visual.overseerMachine!.welder!.walls.map((p) => ({
      id: p.id,
      hp: p.hp,
      position: p.position,
    })),
    original,
  );
  assert(!g.props.items.some((p) => p.welded));
  assert.equal(g.welder.barriers.length, 0);
  draw(w, 0.3);
  g.welder.update(10);
  assert(!g.props.items.some((p) => p.welded));
});
test('ordinary Welder arc rounds retain native instances and velocities through owner defeat; corpse drawing adds none', () => {
  const { g, e } = course('welder');
  welderAttack(g, e, 'arc');
  const shots = g.shots.filter((s) => s.damageCause?.enemy === 'welder');
  assert.equal(shots.length, 5);
  const records = shots.map((s) => ({
      shot: s,
      pos: { ...s.pos },
      vel: { ...s.vel },
      damage: s.damage,
      life: s.life,
    })),
    w = defeat(g, e);
  draw(w, 0.3);
  for (const r of records) {
    assert(g.shots.includes(r.shot));
    assert.deepEqual(r.shot.pos, r.pos);
    assert.deepEqual(r.shot.vel, r.vel);
    assert.equal(r.shot.damage, r.damage);
    assert.equal(r.shot.life, r.life);
  }
  g.updateShots(1 / 60);
  assert(records.some((r) => r.shot.pos.x !== r.pos.x || r.shot.pos.y !== r.pos.y));
});
test('Switchboard captures actual recording and lock state but powers off every corpse channel after native plan cleanup', () => {
  const { g, e } = course('switchboard');
  switchPlan(g, e);
  Matter.Body.setPosition(g.player, { x: 620, y: 650 });
  switchStep(g, e, 0.31);
  Matter.Body.setPosition(g.player, { x: 730, y: 610 });
  switchStep(g, e, 0.31);
  const r = e.switchboard!;
  assert(r.plans[0].locked && !r.plans[0].cut);
  assert.equal(r.plans[0].marks.length, 3);
  const plans = structuredClone(r.plans),
    w = defeat(g, e);
  assert.equal(e.switchboard, undefined);
  assert.equal(w.visual.overseerMachine!.switchboard!.plans.length, plans.length);
  assert.deepEqual(w.visual.overseerMachine!.switchboard!.plans[0].marks, plans[0].marks);
  assert(overseerMachinePose(w.visual).channels.some((c) => c.locked));
  inert(overseerShutdownPose(w.visual, 0.2));
});
test('actual lethal junction feedback retains bounded health-loss provenance, with no false corpse transmission', () => {
  const { g, e } = course('switchboard');
  switchPlan(g, e, 0);
  const slot = e.switchboard!.plans[0].slot;
  e.hp = 50;
  assert(g.switchboard.interrupt(slot));
  const w = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id)!;
  assert(w);
  assert.equal(w.hit!.healthLost, 50);
  assert.equal(w.visual.overseerMachine!.switchboard!.interruptions, 1);
  assert.equal(w.visual.overseerMachine!.switchboard!.plans[0].cut, true);
  assert(w.visual.overseerMachine!.interruptions.some((i) => i.kind === 'junction-cut'));
  assert.equal(e.switchboard, undefined);
  inert(overseerShutdownPose(w.visual, 0.1));
});
test('Switchboard owner defeat keeps native hostile sender-shot cleanup and preserves reflected friendly rounds', () => {
  const { g, e } = course('switchboard');
  switchPlan(g, e, 1);
  switchStep(g, e, 1.42);
  assert(g.shots.some((s) => s.signalOwner === e.id && !s.friendly));
  const reflected = round(g, { reflected: true, signalOwner: e.id }),
    unowned = round(g, { pos: { x: 300, y: 300 } }),
    w = defeat(g, e);
  assert(!g.shots.some((s) => s.signalOwner === e.id && !s.friendly));
  assert(g.shots.includes(reflected) && g.shots.includes(unowned));
  const count = g.shots.length;
  draw(w, 0.2);
  assert.equal(g.shots.length, count);
  assert.equal(e.switchboard, undefined);
});
test('Auditor actual defeat preserves the partial native burst snapshot and removes only its sender-owned bullets', () => {
  const { g, e } = course('auditor');
  auditorFire(g, e);
  const unowned = round(g, { pos: { x: 300, y: 300 } }),
    w = defeat(g, e),
    a = w.visual.overseerMachine!.auditor!;
  assert(a.owned);
  assert.equal(a.fired, 1);
  assert.equal(a.rounds, 3);
  assert(!g.shots.some((s) => s.auditorOwner === e.id));
  assert(g.shots.includes(unowned));
  assert.equal(g.auditor.state!.status, 'defeated');
  assert.equal(g.auditor.enemy, null);
  inert(overseerShutdownPose(w.visual, 0.2));
  assert(overseerMachinePose(w.visual).magazine.some((m) => m.loaded));
  assert.equal(g.machineBreakdown.wrecks.filter((x) => x.visual.id === e.id).length, 1);
});
test('Auditor timed recall is a living departure, never a corpse, defeat reward or duplicated owned projectile', () => {
  const { g, e } = course('auditor', true);
  auditorFire(g, e);
  g.hitEnemy(e, 100);
  const hp = e.hp,
    kills = g.kills;
  g.auditor.age = AUDITOR_VISIT;
  g.auditor.update(0.01);
  assert(g.auditor.recall > 0 && e.state === 'return');
  g.machineBreakdown.update();
  assert.equal(g.machineBreakdown.wrecks.length, 0);
  assert(g.shots.some((s) => s.auditorOwner === e.id));
  g.auditor.update(AUDITOR_RECALL);
  g.machineBreakdown.update();
  assert.equal(g.auditor.enemy, null);
  assert(g.auditor.state!.retreated);
  assert.equal(g.auditor.state!.status, 'hunting');
  assert.equal(g.auditor.state!.hp, hp);
  assert.equal(g.kills, kills);
  assert.equal(g.machineBreakdown.wrecks.length, 0);
  assert(!g.shots.some((s) => s.auditorOwner === e.id));
  assert(!g.enemies.includes(e));
  assert.equal(drawMachineWrecks(canvas().context, g), undefined);
});
test('lethal player damage during Auditor recall remains a genuine defeat with exactly one inert captured rig', () => {
  const { g, e } = course('auditor', true);
  g.auditor.age = AUDITOR_VISIT;
  g.auditor.update(0.01);
  assert(g.auditor.recall > 0);
  const w = defeat(g, e);
  assert(w.visual.overseerMachine!.auditor!.returning);
  assert.equal(g.auditor.state!.status, 'defeated');
  assert.equal(g.auditor.recall, 0);
  assert.equal(g.auditor.enemy, null);
  assert.equal(g.machineBreakdown.wrecks.filter((x) => x.visual.id === e.id).length, 1);
  inert(overseerShutdownPose(w.visual, 0.2));
});
test('Overseer wrecks reuse the exact production chassis override without live signals, tools, recall or world props', () => {
  for (const kind of kinds) {
    const { wreck } = native(kind),
      projection = projectMachineWreck(wreck, wreck.at + 0.2)!,
      pose = overseerShutdownPose(wreck.visual, projection.age)!,
      inactive = {
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
    drawOverseerChassis(a.context, inactive, false, pose);
    assert(drawOverseerMachineWreck(b.context, wreck, projection));
    assert.deepEqual(a.ops, b.ops);
    assert(a.ops.length > 50 && a.ops.length < 2500);
    assert.notDeepEqual(draw(wreck, 0.02), draw(wreck, 0.38));
  }
});
test('Overseer wrecks use actual raised, moving and sloped supports and fade when those supports disappear', () => {
  for (const kind of kinds) {
    const { g, e } = course(kind);
    const deck = Matter.Bodies.rectangle(1100, 650, 300, 20, { isStatic: true });
    g.terrain.push(deck);
    Matter.Composite.add(g.engine.world, deck);
    Matter.Body.setPosition(e.body, { x: 1100, y: 640 - ENEMY_STATS[kind].h / 2 });
    Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
    g.machineBreakdown.update();
    const w = defeat(g, e),
      landing = w.landing!;
    assert(landing);
    assert.equal(landing.bodyId, deck.id);
    assert(landing.point.y < 700);
    const before = { ...landing.point };
    Matter.Body.setPosition(deck, { x: 1120, y: 633 });
    g.machineBreakdown.update();
    close(landing.point.x, before.x + 20);
    close(landing.point.y, before.y - 17);
    Matter.Body.setAngle(deck, -0.08);
    g.machineBreakdown.update();
    assert(Math.abs(landing.normal.x) > 0.05 && landing.normal.y < -0.9);
    assert.deepEqual(projectMachineWreck(w, w.at + 0.8)!.position, landing.center);
    assert(draw(w, 0.8).some((o) => o.name === 'clip'));
    g.terrain = g.terrain.filter((b) => b !== deck);
    g.machineBreakdown.update();
    assert(!landing.available);
    assert(w.lifetime <= 0.160001);
    assert.equal(projectMachineWreck(w, w.at + 0.161), null);
  }
});
test('unsupported Overseer deaths do not invent a floor, seam, signal port or audit case', () => {
  for (const kind of kinds) {
    const { g, e } = course(kind);
    for (const b of g.terrain) Matter.Composite.remove(g.engine.world, b);
    g.terrain = [];
    for (const p of [...g.props.items]) g.props.remove(p);
    const w = defeat(g, e);
    assert.equal(w.landing, null);
    assert.equal(projectMachineWreck(w, w.at + 0.750001), null);
    assert(!draw(w, 0.2).some((o) => o.name === 'clip'));
  }
});
test('Reduced Effects holds fixed, distinct Overseer corpse silhouettes inside the existing short lifetime', () => {
  const signatures = [];
  for (const kind of kinds) {
    const { wreck } = native(kind);
    assert.deepEqual(draw(wreck, 0.1, true), draw(wreck, 0.3, true));
    assert.notDeepEqual(draw(wreck, 0.1, true), draw(wreck, 0.1));
    assert.equal(projectMachineWreck(wreck, wreck.at + 0.900001, true), null);
    assert.equal(projectMachineWreck(wreck, wreck.at + 2.400001), null);
    inert(overseerShutdownPose(wreck.visual, 0.1, true));
    signatures.push(JSON.stringify(draw(wreck, 0.1, true)));
  }
  assert.equal(new Set(signatures).size, 3);
});
test('Overseer corpse drawing is detached, deterministic, finite and capped without RNG, physics, score, audio or save effects', () => {
  for (const kind of kinds) {
    const { g, wreck } = native(kind);
    g.time += 0.3;
    const records = structuredClone(g.machineBreakdown.wrecks),
      bodies = () =>
        Matter.Composite.allBodies(g.engine.world).map((b) => ({
          id: b.id,
          p: { ...b.position },
          v: { ...b.velocity },
        })),
      before = bodies(),
      shots = structuredClone(g.shots),
      hp = g.hp,
      kills = g.kills,
      audit = structuredClone(g.auditor.state),
      random = Math.random,
      rng = g.rng;
    Math.random = g.rng = () => {
      throw Error('art cannot use RNG');
    };
    g.onSound = () => {
      throw Error('art cannot play sound');
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
      assert(a.ops.length > 50 && a.ops.length < 2500);
      assert.deepEqual(g.machineBreakdown.wrecks, records);
      assert.deepEqual(bodies(), before);
      assert.deepEqual(g.shots, shots);
      assert.deepEqual(g.auditor.state, audit);
      assert.equal(g.hp, hp);
      assert.equal(g.kills, kills);
      g.machineBreakdown.wrecks = Array.from({ length: 50 }, () => structuredClone(wreck));
      const capped = canvas();
      drawMachineWrecks(capped.context, g);
      assert.equal(capped.ops.filter((o) => o.name === 'clip').length, MACHINE_MAX_WRECKS);
    } finally {
      Math.random = random;
      g.rng = rng;
    }
  }
});
test('production Renderer retains Overseer corpse layering below actors and warnings with exact Pause freeze', () => {
  const { g, wreck } = native('welder');
  g.time += 0.4;
  const p = projectMachineWreck(wreck, g.time)!,
    c = canvas(true),
    element = {
      getContext: () => c.context,
      getBoundingClientRect: () => ({ width: 960, height: 600 }),
    } as unknown as HTMLCanvasElement,
    renderer = new Renderer(element, g);
  renderer.drawEnemies = () => c.ops.push({ name: 'layer:live', args: [] });
  renderer.drawPlayer = () => c.ops.push({ name: 'layer:player', args: [] });
  renderer.drawEnemyTells = () => c.ops.push({ name: 'layer:warnings', args: [] });
  renderer.draw(1000, { camera: { x: 0, y: 0 }, scale: 1, player: true, navigation: false });
  const corpse = c.ops.findIndex(
      (o) => o.name === 'translate' && o.args[0] === p.position.x && o.args[1] === p.position.y,
    ),
    live = c.ops.findIndex((o) => o.name === 'layer:live'),
    player = c.ops.findIndex((o) => o.name === 'layer:player'),
    warning = c.ops.findIndex((o) => o.name === 'layer:warnings');
  assert(corpse >= 0 && corpse < live && live < player && player < warning);
  assert.equal(c.depth, 0);
  const before = structuredClone(g.machineBreakdown.wrecks),
    time = g.time;
  g.setMode('paused');
  for (let i = 0; i < 60; i++) g.tick(1 / 60, idle);
  assert.equal(g.time, time);
  assert.deepEqual(g.machineBreakdown.wrecks, before);
});
test('cleanup, spawn protection and later room resets never retain or reward an Overseer wreck', () => {
  for (const kind of kinds) {
    const { g, e } = course(kind);
    g.hitEnemy(e, 1e9, undefined, false, false, false, 'cleanup');
    assert.equal(g.machineBreakdown.wrecks.length, 0);
    const x = course(kind);
    x.e.spawn = 1;
    x.g.hitEnemy(x.e, 1e9);
    assert.equal(x.g.machineBreakdown.wrecks.length, 0);
    const y = native(kind);
    assert.equal(y.g.machineBreakdown.wrecks.length, 1);
    y.g.loadRoom();
    assert.equal(y.g.machineBreakdown.wrecks.length, 0);
  }
});
