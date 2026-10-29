import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import { machineBodySnapshot } from '../src/machine-breakdown-pose.ts';
import { signalMachinePose, type SignalMachineKind } from '../src/signal-machine-pose.ts';
import { drawSignalChassis } from '../src/signal-machine-art.ts';
import { drawMachineChassis, drawMachineContacts } from '../src/machine-breakdown-art.ts';
import { drawCaller, drawCallerWarnings } from '../src/caller-art.ts';
import { drawSwitchman, drawAnnex } from '../src/annex-art.ts';
import { CALLER, updateCaller } from '../src/caller.ts';
import { TRANSMISSION } from '../src/annex.ts';
import {
  signalMachinesTestFromUrl,
  signalMachinesTestRoom,
  prepareSignalMachinesTest,
} from '../src/signal-machines-test.ts';

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
        assert(warnings || key !== 'setLineDash', 'chassis adds no world warnings');
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
const kinds = ['caller', 'switchman'] as const;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1800, y: 500 },
};
function native(kind: SignalMachineKind, scene = 'animations') {
  const f = signalMachinesTestFromUrl(
    new URL('https://test/?test=signal-machines&unit=' + kind + '&scene=' + scene + '&v=1'),
  )!;
  assert(f);
  const g = new Game();
  g.startTest(f.checkpoint, signalMachinesTestRoom(f));
  assert(prepareSignalMachinesTest(g, f));
  for (const actor of [...g.enemies, ...g.factions.allies]) actor.spawn = 0;
  const e = [...g.enemies, ...g.factions.allies].find((e) => e.kind === kind)!;
  assert(e);
  return { g, e };
}
const snapshot = (g: Game, e: Enemy) => machineBodySnapshot(e, g.time, g)!;
const close = (a: number, b: number) => assert(Math.abs(a - b) < 1e-7, a + ' != ' + b);
function numeric(v: unknown) {
  if (typeof v === 'number') assert(Number.isFinite(v));
  else if (Array.isArray(v)) v.forEach(numeric);
  else if (v && typeof v === 'object') Object.values(v).forEach(numeric);
}
function draw(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced = false, portrait = false) {
  if (e.kind === 'caller') drawCaller(c, g, e, reduced, portrait);
  else drawSwitchman(c, g, e, reduced, portrait);
}
function call(g: Game, e: Enemy, dt: number) {
  g.time += dt;
  updateCaller(g, e, dt);
  g.machineBreakdown.update();
}
function recording(g: Game, e: Enemy) {
  e.timer = 0;
  call(g, e, 0.001);
  assert.equal(e.caller!.phase, 'recording');
  return e.caller!;
}
function locked(g: Game, e: Enemy) {
  recording(g, e);
  call(g, e, CALLER.sample + 0.001);
  call(g, e, CALLER.sample + 0.001);
  assert.equal(e.caller!.phase, 'locked');
}
function charge(g: Game, e: Enemy) {
  e.timer = 100;
  g.annex.readyAt = g.time;
  g.annex.update();
  assert.equal(g.annex.transmission!.owner, e);
  assert.equal(g.annex.transmission!.phase, 'charging');
  g.machineBreakdown.update();
}
function fill(g: Game, n: number) {
  for (let i = 0; i < n; i++)
    g.addShot({
      pos: { x: 40, y: 40 },
      vel: { x: 0, y: 0 },
      damage: 1,
      life: 10,
      radius: 2,
      friendly: false,
      bounces: 0,
    });
  assert.equal(g.shots.length, n);
}

test('Caller mechanical slots record three real positions and each admitted playback shot moves the horn diaphragm before the native reset clears the rack', () => {
  const { g, e } = native('caller');
  const r = recording(g, e);
  assert.equal(signalMachinePose(snapshot(g, e)).slots.filter((s) => s.pending).length, 1);
  Matter.Body.setPosition(g.player, { x: 480, y: 690 });
  call(g, e, CALLER.sample + 0.001);
  assert.equal(r.marks.length, 2);
  assert.equal(signalMachinePose(snapshot(g, e)).slots.filter((s) => s.pending).length, 2);
  Matter.Body.setPosition(g.player, { x: 520, y: 650 });
  call(g, e, CALLER.sample + 0.001);
  assert.equal(r.phase, 'locked');
  const marks = structuredClone(r.marks);
  assert.equal(signalMachinePose(snapshot(g, e)).slots.filter((s) => s.pending).length, 3);
  assert.equal(signalMachinePose(snapshot(g, e)).recoil, 0);
  const warnings = canvas(true);
  drawCallerWarnings(warnings.c, g);
  for (let i = 0; i < 3; i++)
    assert(
      warnings.ops.some(
        (o) =>
          o.name === 'arc' &&
          o.args[0] === marks[i].x &&
          o.args[1] === marks[i].y &&
          o.args[2] === 12 + i * 4,
      ),
    );
  for (let i = 0; i < 3; i++) {
    call(g, e, i === 0 ? CALLER.lock + 0.001 : CALLER.gap + 0.001);
    assert.equal(g.shots.length, i + 1);
    const p = signalMachinePose(snapshot(g, e)),
      shot = g.shots.at(-1)!;
    assert(p.recoil > 0.99);
    assert(p.horn.diaphragm > 0.99);
    close(p.barrel.origin.x + e.body.position.x, shot.pos.x);
    close(p.barrel.origin.y + e.body.position.y, shot.pos.y);
    assert.equal(snapshot(g, e).signalMachine!.discharges.at(-1)!.source, 'body');
    assert.equal(snapshot(g, e).signalMachine!.discharges.at(-1)!.index, i);
    assert.equal(p.slots.filter((s) => s.pending).length, 2 - i);
  }
  assert.equal(e.attacks, 3);
  assert.equal(r.phase, 'ready');
  assert.equal(r.marks.length, 0);
  assert(signalMachinePose(snapshot(g, e)).slots.every((s) => !s.recorded && !s.pending));
});

test('native displacement cancellation clears Caller record slots and cannot fake a new diaphragm discharge', () => {
  const { g, e } = native('caller');
  locked(g, e);
  g.machineBreakdown.update();
  Matter.Body.translate(e.body, { x: 45, y: 0 });
  call(g, e, 0.001);
  assert.equal(e.caller!.phase, 'ready');
  assert.equal(e.caller!.marks.length, 0);
  assert.equal(e.attacks, 0);
  assert.equal(g.shots.length, 0);
  const p = signalMachinePose(snapshot(g, e));
  assert.equal(p.recoil, 0);
  assert(p.cancellation > 0);
  assert(p.slots.every((s) => !s.recorded && !s.pending));
});

test('Switchman body shot and Annex remote release drive separate physical mechanisms and keep the exact body muzzle', () => {
  const { g, e } = native('switchman');
  e.timer = 0;
  g.annex.updateSwitchman(e, 1 / 60);
  g.machineBreakdown.update();
  assert.equal(g.shots.length, 1);
  let p = signalMachinePose(snapshot(g, e));
  assert(p.recoil > 0.99);
  assert.equal(p.radio.release, 0);
  close(p.barrel.origin.x + e.body.position.x, g.shots[0].pos.x);
  close(p.barrel.origin.y + e.body.position.y, g.shots[0].pos.y);
  g.time += 0.3;
  charge(g, e);
  g.time += TRANSMISSION.tell / 2;
  g.annex.update();
  g.machineBreakdown.update();
  p = signalMachinePose(snapshot(g, e));
  close(p.radio.charge, 0.5);
  assert(!p.radio.locked);
  assert.equal(p.recoil, 0);
  g.time += TRANSMISSION.tell / 2 - TRANSMISSION.lock / 2;
  g.annex.update();
  g.machineBreakdown.update();
  p = signalMachinePose(snapshot(g, e));
  assert(p.radio.locked);
  assert(p.antenna.locked);
  const port = { ...g.annex.port };
  g.time = g.annex.transmission!.at;
  g.annex.update();
  g.machineBreakdown.update();
  p = signalMachinePose(snapshot(g, e));
  assert.equal(g.annex.volleys, 1);
  assert(p.radio.release > 0.99);
  assert.equal(p.recoil, 0);
  assert.equal(p.barrel.recoil, 0);
  assert.equal(
    snapshot(g, e).signalMachine!.discharges.filter((d) => d.source === 'port').length,
    3,
  );
  for (const shot of g.shots.slice(1))
    assert(
      Math.hypot(shot.pos.x - port.x, shot.pos.y - port.y) > 25 &&
        Math.hypot(shot.pos.x - port.x, shot.pos.y - port.y) < 27,
    );
});

test('only admitted body or remote shots animate hardware when the native projectile cap is full or partially available', () => {
  const caller = native('caller');
  locked(caller.g, caller.e);
  fill(caller.g, 179);
  for (let i = 0; i < 3; i++)
    call(caller.g, caller.e, i === 0 ? CALLER.lock + 0.001 : CALLER.gap + 0.001);
  assert.equal(caller.g.shots.length, 180);
  assert.equal(snapshot(caller.g, caller.e).signalMachine!.discharges.length, 1);
  assert.equal(signalMachinePose(snapshot(caller.g, caller.e)).recoil, 0);
  for (const kind of kinds) {
    const f = native(kind);
    if (kind === 'caller') locked(f.g, f.e);
    fill(f.g, 180);
    if (kind === 'caller') call(f.g, f.e, CALLER.lock + 0.001);
    else {
      f.e.timer = 0;
      f.g.annex.updateSwitchman(f.e, 1 / 60);
      f.g.machineBreakdown.update();
    }
    assert.equal(signalMachinePose(snapshot(f.g, f.e)).recoil, 0);
  }
  const remote = native('switchman');
  charge(remote.g, remote.e);
  fill(remote.g, 180);
  remote.g.time = remote.g.annex.transmission!.at;
  remote.g.annex.update();
  remote.g.machineBreakdown.update();
  const p = signalMachinePose(snapshot(remote.g, remote.e));
  assert.equal(p.radio.release, 0);
  assert.equal(p.recoil, 0);
  assert.equal(remote.g.shots.length, 180);
});

test('shooting the real charging junction drives actual feedback damage and antenna response without a hand-receiver recoil', () => {
  const { g, e } = native('switchman');
  charge(g, e);
  g.time += 0.5;
  g.annex.update();
  g.machineBreakdown.update();
  const before = e.hp;
  assert(g.annex.interrupt());
  g.machineBreakdown.update();
  assert.equal(before - e.hp, TRANSMISSION.feedback);
  assert.equal(g.annex.interruptions, 1);
  assert.equal(g.shots.length, 0);
  const p = signalMachinePose(snapshot(g, e));
  assert(p.radio.feedback > 0.99);
  assert(p.antenna.feedback > 0.99);
  assert.equal(p.recoil, 0);
  assert.equal(p.radio.release, 0);
  assert.equal(snapshot(g, e).signalMachine!.feedback!.healthLost, TRANSMISSION.feedback);
  assert.equal(p.radio.charge, 0);
  const quiet = signalMachinePose(snapshot(g, e), true);
  assert.equal(quiet.radio.feedback, 0);
  assert.equal(quiet.recoil, 0);
});

test('patrol feet and firing braces follow native grounded velocity, while Annex scenery and Caller ground markers remain read-only', () => {
  const { g, e } = native('switchman');
  e.timer = 1.2;
  g.annex.updateSwitchman(e, 1 / 60);
  assert(Math.abs(e.body.velocity.x) > 0);
  const moving = signalMachinePose(snapshot(g, e));
  assert(moving.legs.some((l) => !l.planted));
  e.timer = 0.4;
  g.annex.updateSwitchman(e, 1 / 60);
  assert.equal(e.body.velocity.x, 0);
  assert(signalMachinePose(snapshot(g, e)).legs.every((l) => l.planted));
  charge(g, e);
  g.time += 0.8;
  g.annex.update();
  const before = canvas(true);
  drawAnnex(before.c, g, false);
  const body = canvas(true);
  draw(body.c, g, e);
  const after = canvas(true);
  drawAnnex(after.c, g, false);
  assert.deepEqual(after.ops, before.ops);
  assert.equal(body.depth, 0);
  const c = native('caller');
  locked(c.g, c.e);
  const a = canvas(true),
    b = canvas(true);
  drawCallerWarnings(a.c, c.g);
  draw(canvas(true).c, c.g, c.e);
  drawCallerWarnings(b.c, c.g);
  assert.deepEqual(a.ops, b.ops);
});

test('native friendly comparisons retain blue hardware and exact body emission with real enemies as targets', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind, 'friendly');
    assert(e.allied && g.factions.allies.includes(e));
    const c = canvas();
    drawSignalChassis(c.c, snapshot(g, e));
    assert(c.ops.some((o) => o.name === 'style:fillStyle' && o.args[0] === '#79bdff'));
    if (kind === 'caller') {
      e.timer = 0;
      call(g, e, 0.001);
      call(g, e, CALLER.sample + 0.001);
      call(g, e, CALLER.sample + 0.001);
      call(g, e, CALLER.lock + 0.001);
    } else {
      e.timer = 0;
      g.annex.updateSwitchman(e, 1 / 60);
      g.machineBreakdown.update();
    }
    assert(g.shots.some((s) => s.allied));
    assert(signalMachinePose(snapshot(g, e)).recoil > 0);
    assert.equal(c.depth, 0);
  }
});

test('actual local contacts and65/30 health wear replace broad outline flash without changing the signal mechanics', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind),
      max = e.maxHp;
    g.hitEnemy(e, max * 0.36, { x: e.body.position.x - 80, y: e.body.position.y }, false);
    assert.equal(signalMachinePose(snapshot(g, e)).wear, 1);
    assert(g.machineBreakdown.getHits(e.id).at(-1)!.contact);
    const a = canvas();
    drawSignalChassis(a.c, snapshot(g, e));
    e.flash = 0;
    const b = canvas();
    drawSignalChassis(b.c, snapshot(g, e));
    assert.deepEqual(a.ops, b.ops);
    const contact = canvas();
    drawMachineContacts(contact.c, g, e, false);
    assert(contact.ops.some((o) => o.name === 'arc' && o.args[2] === 2.8));
    g.hitEnemy(e, max * 0.35, { x: e.body.position.x + 80, y: e.body.position.y }, false);
    assert(e.hp > 0);
    assert.equal(signalMachinePose(snapshot(g, e)).wear, 2);
  }
});

test('both signal families render finite bounded hardware across wear, state, facing, vertical aim, factions and Reduced Effects', () => {
  let count = 0;
  for (const kind of kinds) {
    const { g, e } = native(kind);
    for (const state of ['idle', 'windup', 'recover'] as Enemy['state'][])
      for (const ratio of [1, 0.65, 0.3])
        for (const facing of [-1, 1])
          for (const reduced of [false, true])
            for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
              e.state = state;
              e.timer = 0.2;
              e.hp = e.maxHp * ratio;
              e.facing = facing;
              e.allied = facing < 0;
              e.aim = { x: Math.cos(angle), y: Math.sin(angle) };
              const s = snapshot(g, e),
                p = signalMachinePose(s, reduced),
                c = canvas();
              numeric(p);
              drawSignalChassis(c.c, s, reduced, p);
              assert.equal(c.depth, 0);
              assert(c.ops.length < 900);
              const common = canvas();
              drawMachineChassis(common.c, s, reduced);
              assert.deepEqual(common.ops, c.ops);
              count++;
            }
    const portrait = canvas();
    draw(portrait.c, g, e, false, true);
    assert.equal(portrait.depth, 0);
    assert(
      !portrait.ops.some(
        (o) => o.name === 'fillRect' && o.args[3] === 2 && Number(o.args[2]) >= 32,
      ),
    );
  }
  assert.equal(count, 288);
});

test('body and telegraph rendering preserve native target/record/radio state, physics IDs, RNG, shots, saves and audio', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind);
    if (kind === 'caller') locked(g, e);
    else charge(g, e);
    const capture = () =>
      JSON.stringify({
        save: g.checkpointSnapshot(),
        pos: e.body.position,
        vel: e.body.velocity,
        state: e.state,
        timer: e.timer,
        hp: e.hp,
        aim: e.aim,
        caller: e.caller
          ? {
              phase: e.caller.phase,
              marks: e.caller.marks,
              clock: e.caller.clock,
              next: e.caller.next,
              origin: e.caller.origin,
              target: e.caller.target?.id,
            }
          : null,
        transmission: g.annex.transmission
          ? {
              owner: g.annex.transmission.owner.id,
              phase: g.annex.transmission.phase,
              at: g.annex.transmission.at,
              aim: g.annex.transmission.aim,
              interrupted: g.annex.transmission.interrupted,
            }
          : null,
        shots: g.shots,
        particles: g.particles,
      });
    const before = capture(),
      id = (Matter.Common as unknown as { _nextId: number })._nextId;
    g.rng = () => {
      throw Error('draw RNG');
    };
    g.onSound = () => {
      throw Error('draw audio');
    };
    g.onCheckpoint = () => {
      throw Error('draw save');
    };
    for (const reduced of [false, true]) {
      const c = canvas(true);
      draw(c.c, g, e, reduced);
      if (kind === 'caller') drawCallerWarnings(c.c, g);
      else drawAnnex(c.c, g, reduced);
      assert.equal(c.depth, 0);
    }
    assert.equal(capture(), before);
    assert.equal((Matter.Common as unknown as { _nextId: number })._nextId, id);
  }
});

test('Pause freezes signal hardware and Reduced Effects suppresses secondary recoil/feedback without losing recorded state', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind);
    if (kind === 'caller') {
      locked(g, e);
      call(g, e, CALLER.lock + 0.001);
    } else {
      charge(g, e);
      g.annex.interrupt();
      g.machineBreakdown.update();
    }
    const before = signalMachinePose(snapshot(g, e));
    g.setMode('paused');
    for (let i = 0; i < 20; i++) g.tick(1 / 60, idle);
    assert.deepEqual(signalMachinePose(snapshot(g, e)), before);
    const a = canvas();
    drawSignalChassis(a.c, snapshot(g, e), true);
    g.time += 1;
    const b = canvas();
    drawSignalChassis(b.c, snapshot(g, e), true);
    assert.deepEqual(a.ops, b.ops);
  }
});
