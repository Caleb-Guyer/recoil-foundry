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
import { signalShutdownPose, drawSignalMachineWreck } from '../src/signal-machine-wreck-art.ts';
import { signalMachinePose } from '../src/signal-machine-pose.ts';
import { drawSignalChassis } from '../src/signal-machine-art.ts';
import { MACHINE_MAX_WRECKS, type MachineWreck } from '../src/machine-breakdown.ts';
import {
  signalMachinesTestFromUrl,
  signalMachinesTestRoom,
  prepareSignalMachinesTest,
  type SignalUnit,
} from '../src/signal-machines-test.ts';
import { CALLER, updateCaller } from '../src/caller.ts';
import { TRANSMISSION } from '../src/annex.ts';
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

const kinds = ['caller', 'switchman'] as const;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 900, y: 650 },
};
function course(kind: SignalUnit, scene = 'wreckage') {
  const f = signalMachinesTestFromUrl(
    new URL(`https://test/?test=signal-machines&unit=${kind}&scene=${scene}&v=1`),
  )!;
  assert(f);
  const g = new Game();
  g.startTest(f.checkpoint, signalMachinesTestRoom(f));
  assert(prepareSignalMachinesTest(g, f));
  g.time = 1;
  const e = [...g.enemies, ...g.factions.allies].find((e) => e.kind === kind)!;
  assert(e);
  e.spawn = 0;
  e.timer = 0;
  g.machineBreakdown.update();
  return { g, e };
}
function callerStep(g: Game, e: Enemy, dt: number) {
  g.time += dt;
  updateCaller(g, e, dt);
  g.machineBreakdown.update();
}
function recordCaller(g: Game, e: Enemy) {
  callerStep(g, e, 0.001);
  assert.equal(e.caller!.phase, 'recording');
  callerStep(g, e, CALLER.sample + 0.001);
  callerStep(g, e, CALLER.sample + 0.001);
  assert.equal(e.caller!.phase, 'locked');
  assert.equal(e.caller!.marks.length, 3);
}
function charge(g: Game, e: Enemy) {
  g.annex.readyAt = g.time;
  g.annex.update();
  assert.equal(g.annex.transmission?.owner, e);
  assert.equal(g.annex.transmission?.phase, 'charging');
  g.machineBreakdown.update();
}
function defeat(g: Game, e: Enemy) {
  if (e.allied) g.factions.hitAlly(e, 100000);
  else g.hitEnemy(e, 100000);
  const wreck = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id)!;
  assert(wreck, 'native lethal damage captures the signal rig');
  return wreck;
}
function native(kind: SignalUnit, scene = 'wreckage') {
  const { g, e } = course(kind, scene);
  if (scene !== 'friendly') {
    if (kind === 'caller') recordCaller(g, e);
    else charge(g, e);
  }
  return { g, e, wreck: defeat(g, e) };
}
function feedback() {
  const { g, e } = course('switchman');
  charge(g, e);
  e.hp = 20;
  g.machineBreakdown.update();
  assert(g.annex.interrupt());
  assert(e.hp <= 0);
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
function radioOff(p: ReturnType<typeof signalShutdownPose>) {
  assert(p);
  assert.equal(p.energy, 0);
  assert.equal(p.cancellation, 0);
  assert.equal(p.recoil, 0);
  assert.equal(p.horn.diaphragm, 0);
  assert.equal(p.antenna.charge, 0);
  assert.equal(p.antenna.locked, false);
  assert.equal(p.antenna.release, 0);
  assert.equal(p.antenna.feedback, 0);
  assert.equal(p.radio.charge, 0);
  assert.equal(p.radio.locked, false);
  assert.equal(p.radio.release, 0);
  assert.equal(p.radio.feedback, 0);
  assert(p.slots.every((s) => !s.recorded && !s.pending && !s.selected));
}

test('Caller shutdown buckles the actual horn pedestal and extinguishes the captured native three-mark recording queue', () => {
  const { wreck } = native('caller'),
    live = signalMachinePose(wreck.visual),
    start = signalShutdownPose(wreck.visual, 0)!,
    end = signalShutdownPose(wreck.visual, 0.38)!;
  assert.equal(live.slots.filter((s) => s.recorded).length, 3);
  assert.equal(start.legs.length, 2);
  assert.notDeepEqual(start.legs, end.legs);
  assert.notDeepEqual(start.body, end.body);
  assert.notEqual(start.horn.angle, end.horn.angle);
  assert.notDeepEqual(start.horn.lip, end.horn.lip);
  assert.equal(end.wear, 2);
  assert.equal(end.mode, 'shutdown');
  radioOff(start);
  radioOff(end);
  assert.deepEqual(
    start.slots.map((s) => s.index),
    live.slots.map((s) => s.index),
  );
  assert.deepEqual(signalShutdownPose(wreck.visual, 0.4), signalShutdownPose(wreck.visual, 0.8));
});
test('Switchman antenna and hand receiver collapse while the native pending remote transmission becomes inert corpse hardware', () => {
  const { wreck } = native('switchman'),
    live = signalMachinePose(wreck.visual),
    start = signalShutdownPose(wreck.visual, 0)!,
    end = signalShutdownPose(wreck.visual, 0.38)!;
  assert(wreck.visual.signalMachine!.switchman!.transmission?.valid);
  assert.notDeepEqual(start.antenna.tip, end.antenna.tip);
  assert.notDeepEqual(start.gimbal.center, end.gimbal.center);
  assert.notEqual(start.barrel.angle, end.barrel.angle);
  radioOff(start);
  radioOff(end);
  close(
    Math.hypot(live.antenna.tip.x - live.antenna.base.x, live.antenna.tip.y - live.antenna.base.y),
    Math.hypot(end.antenna.tip.x - end.antenna.base.x, end.antenna.tip.y - end.antenna.base.y),
  );
  assert.deepEqual(signalShutdownPose(wreck.visual, 0.4), signalShutdownPose(wreck.visual, 0.8));
});
test('body muzzle rear hinges and Caller horn axes retain exact lengths through a shutdown independently of the remote port', () => {
  for (const { wreck } of [
    native('caller'),
    native('switchman'),
    feedback(),
    ...kinds.map((k) => native(k, 'friendly')),
  ]) {
    const start = signalShutdownPose(wreck.visual, 0)!,
      end = signalShutdownPose(wreck.visual, 0.38)!;
    assert.equal(start.barrel.length, end.barrel.length);
    for (const axis of ['x', 'y'] as const) {
      const component = axis === 'x' ? Math.cos : Math.sin;
      close(
        start.barrel.origin[axis] -
          component(start.barrel.angle) * start.barrel.length -
          start.body[axis],
        end.barrel.origin[axis] - component(end.barrel.angle) * end.barrel.length - end.body[axis],
      );
    }
    close(
      Math.hypot(start.horn.lip.x - start.horn.throat.x, start.horn.lip.y - start.horn.throat.y),
      Math.hypot(end.horn.lip.x - end.horn.throat.x, end.horn.lip.y - end.horn.throat.y),
    );
    assert(
      Math.abs(end.barrel.origin.x) < 150 && Math.abs(end.barrel.origin.y) < 150,
      'the receiver stays at the body and never teleports to the Annex port',
    );
  }
});
test('signal wrecks reuse the exact production chassis override without recording marks, transmission warnings or remote projectiles', () => {
  for (const { wreck } of [
    native('caller'),
    native('switchman'),
    feedback(),
    ...kinds.map((k) => native(k, 'friendly')),
  ]) {
    const projection = projectMachineWreck(wreck, wreck.at + 0.2)!,
      pose = signalShutdownPose(wreck.visual, projection.age)!;
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
    drawSignalChassis(a.context, inactive, false, pose);
    assert(drawSignalMachineWreck(b.context, wreck, projection));
    assert.deepEqual(a.ops, b.ops);
    assert(draw(wreck, 0.2).length < 1700);
    assert.notDeepEqual(draw(wreck, 0.02), draw(wreck, 0.38));
  }
});
test('a Caller’s admitted round survives native owner defeat while its unplayed recorded marks cannot fire from the corpse', () => {
  const { g, e } = course('caller');
  recordCaller(g, e);
  callerStep(g, e, CALLER.lock + 0.001);
  assert.equal(e.caller!.next, 1);
  const shots = g.shots.filter((s) => s.damageCause?.enemy === 'caller');
  assert.equal(shots.length, 1);
  const s = shots[0],
    before = { pos: { ...s.pos }, vel: { ...s.vel }, damage: s.damage, life: s.life };
  const wreck = defeat(g, e);
  assert.equal(e.caller, undefined);
  draw(wreck, 0.25);
  assert(g.shots.includes(s));
  assert.deepEqual(
    { pos: { ...s.pos }, vel: { ...s.vel }, damage: s.damage, life: s.life },
    before,
  );
  g.updateShots(1 / 60);
  assert.notDeepEqual(s.pos, before.pos);
  const admitted = e.attacks;
  for (let n = 0; n < 150; n++) g.tick(1 / 60, idle);
  assert.equal(e.attacks, admitted);
  assert.equal(e.caller, undefined);
  assert(!g.enemies.includes(e));
});
test('Switchman body and remote-port rounds already in flight retain their native instances, velocities and damage after owner defeat', () => {
  const { g, e } = course('switchman');
  g.annex.updateSwitchman(e, 1 / 60);
  const body = g.shots.at(-1)!;
  assert(body);
  charge(g, e);
  const start = g.shots.length;
  g.time = g.annex.transmission!.at + 0.001;
  g.annex.update();
  g.machineBreakdown.update();
  assert.equal(g.annex.volleys, 1);
  const remote = g.shots.slice(start);
  assert.equal(remote.length, 3);
  const records = [body, ...remote].map((s) => ({
    shot: s,
    pos: { ...s.pos },
    vel: { ...s.vel },
    damage: s.damage,
    life: s.life,
  }));
  const wreck = defeat(g, e);
  draw(wreck, 0.3);
  for (const r of records) {
    assert(g.shots.includes(r.shot));
    assert.deepEqual(r.shot.pos, r.pos);
    assert.deepEqual(r.shot.vel, r.vel);
    assert.equal(r.shot.damage, r.damage);
    assert.equal(r.shot.life, r.life);
  }
  g.annex.update();
  assert.equal(g.annex.transmission, null);
  g.updateShots(1 / 60);
  assert(records.some((r) => r.shot.pos.x !== r.pos.x || r.shot.pos.y !== r.pos.y));
});
test('native owner death cancels a charging remote transmission and cannot create a later offscreen corpse volley', () => {
  const { g, e } = course('switchman');
  charge(g, e);
  const before = g.shots.length,
    volleys = g.annex.volleys,
    wreck = defeat(g, e);
  draw(wreck, 0.3);
  g.annex.update();
  assert.equal(g.annex.transmission, null);
  for (let n = 0; n < 8; n++) {
    g.time += TRANSMISSION.tell;
    g.annex.update();
  }
  assert.equal(g.annex.volleys, volleys);
  assert.equal(g.shots.length, before);
  assert(!g.enemies.includes(e));
});
test('real lethal junction feedback retains actual damage provenance but powers off all captured radio feedback hardware', () => {
  const { g, wreck } = feedback();
  assert.equal(g.annex.interruptions, 1);
  assert(wreck.visual.signalMachine!.feedback);
  assert.equal(wreck.visual.signalMachine!.feedback!.healthLost, 20);
  assert.equal(wreck.hit!.healthLost, 20);
  assert.equal(wreck.hit!.incoming, TRANSMISSION.feedback);
  radioOff(signalShutdownPose(wreck.visual, 0.1));
  g.annex.update();
  assert.equal(g.annex.transmission, null);
  assert.equal(g.annex.volleys, 0);
});
test('native blue allies die through actual faction damage without combat credit, glowing signals or lost faction identity', () => {
  for (const kind of kinds) {
    const { g, e } = course(kind, 'friendly');
    assert(e.allied && g.factions.allies.includes(e));
    const kills = g.kills,
      wreck = defeat(g, e);
    assert.equal(g.kills, kills);
    assert(!g.factions.allies.includes(e));
    assert.equal(wreck.visual.allied, true);
    const pose = signalShutdownPose(wreck.visual, 0.3)!;
    radioOff(pose);
    const c = canvas();
    drawSignalChassis(c.context, { ...wreck.visual, hp: 0 }, false, pose);
    assert(
      c.ops.some((op) => op.name === 'style:fillStyle' && op.args[0] === '#304d66'),
      'inert blue paint preserves the converted faction without active lights',
    );
    draw(wreck, 0.3);
  }
});
test('signal wrecks follow actual raised, moving and sloped landing supports and clear quickly when support disappears', () => {
  for (const kind of kinds) {
    const { g, wreck } = native(kind),
      landing = wreck.landing!;
    assert(landing);
    const deck = g.solidBodies.find((b) => b.id === landing.bodyId)!,
      before = { ...landing.point };
    assert(landing.point.y < 700, 'native raised course support is used');
    Matter.Body.setPosition(deck, { x: deck.position.x + 20, y: deck.position.y - 17 });
    g.machineBreakdown.update();
    close(landing.point.x, before.x + 20);
    close(landing.point.y, before.y - 17);
    Matter.Body.setAngle(deck, -0.08);
    g.machineBreakdown.update();
    assert(Math.abs(landing.normal.x) > 0.05);
    assert(landing.normal.y < -0.9);
    assert.deepEqual(projectMachineWreck(wreck, wreck.at + 0.8)!.position, landing.center);
    assert(draw(wreck, 0.8).some((op) => op.name === 'clip'));
    g.terrain = g.terrain.filter((b) => b.id !== deck.id);
    g.machineBreakdown.update();
    assert.equal(landing.available, false);
    assert(wreck.lifetime <= 0.160001);
    assert.equal(projectMachineWreck(wreck, wreck.at + 0.161), null);
  }
});
test('unsupported native signal deaths never invent a floor or platform', () => {
  for (const kind of kinds) {
    const { g, e } = course(kind);
    for (const body of g.terrain) Matter.Composite.remove(g.engine.world, body);
    g.terrain = [];
    for (const prop of [...g.props.items]) g.props.remove(prop);
    const wreck = defeat(g, e);
    assert.equal(wreck.landing, null);
    assert.equal(projectMachineWreck(wreck, wreck.at + 0.750001), null);
    assert(!draw(wreck, 0.2).some((op) => op.name === 'clip'));
  }
});
test('Reduced Effects leaves distinct hostile, blue and feedback shutdowns still and within the existing concise lifetime', () => {
  const signatures = [];
  for (const { wreck } of [
    native('caller'),
    native('switchman'),
    feedback(),
    ...kinds.map((k) => native(k, 'friendly')),
  ]) {
    assert.deepEqual(draw(wreck, 0.1, true), draw(wreck, 0.3, true));
    assert.notDeepEqual(draw(wreck, 0.1, true), draw(wreck, 0.1));
    assert.equal(projectMachineWreck(wreck, wreck.at + 0.900001, true), null);
    assert.equal(projectMachineWreck(wreck, wreck.at + 2.400001), null);
    radioOff(signalShutdownPose(wreck.visual, 0.1, true));
    signatures.push(JSON.stringify(draw(wreck, 0.1, true)));
  }
  assert(new Set(signatures).size >= 4);
});
test('signal wreck rendering stays detached, finite, bounded and cannot mutate physics, radio queues, projectiles, score, RNG, audio or saves', () => {
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
      kills = g.kills,
      radioState = () => {
        const t = g.annex.transmission;
        return t
          ? {
              owner: t.owner.id,
              phase: t.phase,
              at: t.at,
              aim: { ...t.aim },
              interrupted: t.interrupted,
            }
          : null;
      },
      radio = radioState();
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
      assert(a.ops.length > 50 && a.ops.length < 1700);
      assert.deepEqual(g.machineBreakdown.wrecks, records);
      assert.deepEqual(bodyState(), bodies);
      assert.deepEqual(g.shots, shots);
      assert.deepEqual(radioState(), radio);
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
test('production Renderer keeps signal wrecks beneath native actors and actual warnings with exact Pause freeze', () => {
  const { g, wreck } = native('caller');
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
