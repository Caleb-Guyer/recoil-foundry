import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import type { Level } from '../src/levels.ts';
import { CALLER } from '../src/caller.ts';
import { TRANSMISSION } from '../src/annex.ts';
import { machineBodySnapshot, machinePose, isMachineKind } from '../src/machine-breakdown-pose.ts';
import {
  signalMachinePose,
  isSignalMachineKind,
  type SignalMachineKind,
} from '../src/signal-machine-pose.ts';
import { MACHINE_MAX_HITS, MACHINE_MAX_WRECKS } from '../src/machine-breakdown.ts';
const { Body, Bodies, Composite } = Matter;
const DT = 1 / 60;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1200, y: 700 },
};
const room: Level = {
  id: 'signal-native-model',
  name: 'Signal native floor',
  area: 'cooling',
  annex: true,
  annexStation: {
    junction: { x: 700, y: 460 },
    port: { x: 1200, y: 285 },
    cable: 228,
    mount: 502,
    patrol: [850, 1100],
  },
  boss: false,
  mirrored: false,
  solids: [],
  spawns: [{ kind: 'shooter', x: 1850, y: 724 }],
  route: [],
  setpiece: { rosters: [[0]], weak: [], props: [] },
  hazards: [],
  vents: [],
  fans: [],
  coolant: [],
  counterweights: [],
};
function base() {
  const g = new Game(),
    cp = {
      version: 6 as const,
      seed: 'RF-C108-SIGNALMODEL',
      stage: 8,
      hp: 100,
      mods: [],
      kills: 0,
      elapsed: 0,
    };
  g.start(cp.seed, cp, null, { ...cp, rematchRoom: structuredClone(room) });
  g.waves.clear();
  for (const e of g.enemies) {
    e.spawn = 0;
    e.timer = 1000;
  }
  Body.setStatic(g.player, true);
  Body.setPosition(g.player, { x: 200, y: 722 });
  g.engine.gravity.y = 0;
  return g;
}
function fixture(kind: SignalMachineKind = 'caller') {
  const g = base(),
    e = g.spawnEnemy(kind, kind === 'caller' ? 600 : 900, 722)!;
  e.spawn = 0;
  e.timer = 0;
  g.machineBreakdown.update();
  return { g, e };
}
function update(g: Game, e: Enemy, dt = DT) {
  g.time += dt;
  g.updateEnemy(e, dt);
  g.machineBreakdown.update();
}
function until(g: Game, e: Enemy, condition: () => boolean, max = 300) {
  for (let n = 0; n < max && !condition(); n++) update(g, e);
  assert(condition(), 'native condition did not arrive');
}
function record(g: Game, e: Enemy) {
  until(g, e, () => e.caller?.phase === 'locked');
  return e.caller!;
}
function charge(g: Game, e: Enemy) {
  e.timer = 100;
  g.annex.readyAt = g.time;
  g.annex.update();
  g.machineBreakdown.update();
  assert.equal(g.annex.transmission?.owner, e);
  assert.equal(g.annex.transmission?.phase, 'charging');
  return g.annex.transmission!;
}
function releasePort(g: Game) {
  g.time = g.annex.transmission!.at;
  g.annex.update();
  g.machineBreakdown.update();
}
function snapshot(g: Game, e: Enemy) {
  return machineBodySnapshot(e, g.time, g)!;
}
function tick(g: Game, n = 1) {
  for (let i = 0; i < n; i++) g.tick(DT, idle);
}
function wall(g: Game, x: number, y: number, w: number, h: number) {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  return b;
}
function fill(g: Game, n: number) {
  for (let i = 0; i < n; i++)
    assert(
      g.addShot({
        pos: { x: 50, y: 100 },
        vel: { x: 1, y: 0 },
        damage: 1,
        life: 4,
        friendly: false,
        radius: 2,
        bounces: 0,
        pierce: 0,
        fragment: false,
        split: false,
      }),
    );
}
function plain(v: unknown) {
  if (!v || typeof v !== 'object') return;
  assert(Object.getPrototypeOf(v) === Object.prototype || Array.isArray(v));
  for (const x of Object.values(v)) plain(x);
}
function finite(v: unknown) {
  if (typeof v === 'number') assert(Number.isFinite(v));
  else if (v && typeof v === 'object') for (const x of Object.values(v)) finite(x);
}
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test('signal kinds complete ordinary eligibility while preserving all twenty-one prior family projections and boss exclusions', () => {
  for (const kind of [
    'runner',
    'shooter',
    'flyer',
    'charger',
    'hopper',
    'sniper',
    'shutter',
    'strider',
    'mortar',
    'repairer',
    'relay',
    'fabricator',
    'sentry',
    'scrapper',
    'harpooner',
    'sapper',
    'borer',
    'sifter',
    'skimmer',
    'angler',
    'wallcrawler',
  ] as const) {
    const g = base(),
      e = g.spawnEnemy(kind, 500, 400)!;
    e.spawn = 0;
    const s = snapshot(g, e);
    assert.equal(s.signalMachine, undefined);
    assert.equal(machinePose(s).kind, kind);
    plain(s);
  }
  for (const kind of ['caller', 'switchman'] as const) {
    const { g, e } = fixture(kind);
    assert(isMachineKind(kind) && isSignalMachineKind(kind));
    const s = snapshot(g, e);
    assert(s.signalMachine);
    plain(s);
    finite(signalMachinePose(s));
  }
  for (const boss of ['switchboard', 'auditor', 'boss', 'sorter']) assert(!isMachineKind(boss));
});

test('Caller snapshots follow actual sampled marks, three queue slots and locked playback without retargeting the saved marks', () => {
  const { g, e } = fixture();
  update(g, e);
  assert.equal(e.caller!.phase, 'recording');
  assert.deepEqual(e.caller!.marks, [{ x: 200, y: 722 }]);
  let p = signalMachinePose(snapshot(g, e));
  assert.equal(p.slots.filter((s) => s.recorded).length, 1);
  assert(p.slots[0].selected);
  assert(p.brace > 0);
  Body.setPosition(g.player, { x: 250, y: 650 });
  until(g, e, () => e.caller!.marks.length === 2);
  Body.setPosition(g.player, { x: 310, y: 590 });
  record(g, e);
  const marks = structuredClone(e.caller!.marks),
    s = snapshot(g, e);
  plain(s);
  assert.deepEqual(marks, [
    { x: 200, y: 722 },
    { x: 250, y: 650 },
    { x: 310, y: 590 },
  ]);
  assert(s.signalMachine!.caller!.target!.player);
  assert(s.signalMachine!.caller!.target!.valid);
  p = signalMachinePose(s);
  assert.equal(p.mode, 'locked');
  assert.equal(p.slots.filter((s) => s.pending).length, 3);
  Body.setPosition(g.player, { x: 1200, y: 400 });
  for (let n = 0; n < 3; n++) {
    until(g, e, () => e.attacks === n + 1);
    const event = snapshot(g, e).signalMachine!.discharges.at(-1)!;
    assert.equal(event.index, n);
    assert.equal(event.source, 'body');
    assert.equal(event.at, g.time);
    near(event.angle, Math.atan2(marks[n].y - e.body.position.y, marks[n].x - e.body.position.x));
    assert.deepEqual(event.muzzle, g.shots[n].pos);
    assert.deepEqual(event.origin, e.body.position);
    const pose = signalMachinePose(snapshot(g, e));
    assert(pose.recoil > 0.9);
    assert(pose.horn.diaphragm > 0.9);
    assert.deepEqual(pose.horn.lip, pose.barrel.origin);
  }
  assert.equal(e.caller!.phase, 'ready');
  assert.equal(e.caller!.marks.length, 0);
  assert.equal(
    g.machineBreakdown.getSignalMachine(e)!.cancellation,
    null,
    'the normal completed reset is not a cancellation',
  );
  assert.equal(signalMachinePose(snapshot(g, e)).slots.filter((s) => s.recorded).length, 0);
  const frozen = structuredClone(s);
  e.caller!.origin = { x: -1, y: -1 };
  e.caller!.marks.push({ x: 0, y: 0 });
  assert.deepEqual(s, frozen);
});

test('native Caller displacement, lost target and faction resets have distinct observed cancellations without fictitious releases', () => {
  for (const reason of ['displaced', 'target-lost', 'faction-changed']) {
    const { g, e } = fixture();
    const target = reason === 'target-lost' ? g.factions.spawn('runner', { x: 500, y: 722 }) : null;
    if (target) target.spawn = 0;
    record(g, e);
    if (reason === 'displaced') Body.translate(e.body, { x: 41, y: 0 });
    if (target) g.factions.removeAlly(target);
    if (reason === 'faction-changed') {
      e.allied = true;
      g.enemies = g.enemies.filter((a) => a !== e);
      g.factions.allies.push(e);
    }
    update(g, e);
    const s = snapshot(g, e),
      event = s.signalMachine!.cancellation!;
    assert.equal(e.caller!.phase, 'ready', reason);
    assert.equal(e.caller!.marks.length, 0);
    assert.equal(event.reason, reason);
    assert.equal(event.at, g.time);
    assert.deepEqual(s.signalMachine!.discharges, []);
    assert.equal(signalMachinePose(s).recoil, 0);
    assert.equal(g.shots.length, 0);
  }
  const { g, e } = fixture();
  record(g, e);
  until(g, e, () => e.attacks === 1);
  const round = g.shots[0];
  Body.translate(e.body, { x: 41, y: 0 });
  update(g, e);
  assert.equal(e.attacks, 1);
  assert.equal(g.shots[0], round);
  assert.equal(g.machineBreakdown.getSignalMachine(e)!.cancellation!.reason, 'displaced');
});

test('Caller actual full/partial-cap admission and close-cover impacts remain separate from the attempted three-shot counter', () => {
  for (const cap of [179, 180]) {
    const { g, e } = fixture();
    record(g, e);
    fill(g, cap);
    until(g, e, () => e.attacks === 3);
    const s = snapshot(g, e);
    assert.equal(g.shots.length, 180);
    assert.equal(s.signalMachine!.discharges.length, 180 - cap);
    assert.equal(signalMachinePose(s).recoil, 0, 'failed followups cannot restart recoil');
    if (cap === 179) assert.equal(s.signalMachine!.discharges[0].index, 0);
    assert.equal(s.signalMachine!.cancellation, null);
  }
  const { g, e } = fixture();
  record(g, e);
  wall(g, 578, 722, 8, 100);
  until(g, e, () => e.attacks === 3);
  assert.equal(g.shots.length, 0);
  assert.equal(snapshot(g, e).signalMachine!.discharges.length, 3);
  assert(snapshot(g, e).signalMachine!.discharges.every((d) => d.source === 'body'));
});

test('Switchman native .55 body lock braces its supported patrol and only its accepted body shot moves the receiver', () => {
  const { g, e } = fixture('switchman');
  e.timer = 0.9;
  update(g, e);
  const aim = { ...e.aim };
  assert(Math.abs(e.body.velocity.x) > 0);
  assert(snapshot(g, e).signalMachine!.grounded);
  e.timer = 0.5;
  Body.setPosition(g.player, { x: 1100, y: 650 });
  update(g, e);
  assert.deepEqual(e.aim, aim);
  assert.equal(e.body.velocity.x, 0);
  const locked = signalMachinePose(snapshot(g, e));
  assert.equal(locked.mode, 'body-lock');
  assert(locked.brace > 0);
  e.timer = 0;
  update(g, e);
  const s = snapshot(g, e),
    p = signalMachinePose(s),
    d = s.signalMachine!.discharges[0];
  assert.equal(e.attacks, 1);
  assert.equal(e.timer, 1.65);
  assert.equal(d.source, 'body');
  assert.equal(d.index, 0);
  assert.deepEqual(d.muzzle, g.shots[0].pos);
  assert.deepEqual(d.origin, e.body.position);
  assert(p.recoil > 0.9);
  assert.equal(p.radio.release, 0);
  assert.equal(p.radio.charge, 0);
  near(p.barrel.angle, Math.atan2(aim.y, aim.x));
});

test('owned Annex tracking/lock and actual port events remain detached from handheld recoil, aim and muzzle even during simultaneous fire', () => {
  const { g, e } = fixture('switchman');
  e.timer = 0;
  update(g, e);
  const body = structuredClone(signalMachinePose(snapshot(g, e)).barrel),
    t = charge(g, e);
  const other = g.spawnEnemy('switchman', 1400, 722)!;
  other.spawn = 0;
  g.machineBreakdown.update();
  assert.equal(snapshot(g, other).signalMachine!.switchman!.transmission, null);
  Body.setPosition(g.player, { x: 400, y: 600 });
  g.time = t.at - 0.8;
  g.annex.update();
  g.machineBreakdown.update();
  const tracked = { ...t.aim };
  assert(signalMachinePose(snapshot(g, e)).radio.charge > 0);
  Body.setPosition(g.player, { x: 1300, y: 500 });
  g.time = t.at - TRANSMISSION.lock + 0.00001;
  g.annex.update();
  g.machineBreakdown.update();
  assert.deepEqual(t.aim, tracked);
  assert(signalMachinePose(snapshot(g, e)).radio.locked);
  releasePort(g);
  const s = snapshot(g, e),
    events = s.signalMachine!.discharges.filter((d) => d.source === 'port'),
    p = signalMachinePose(s);
  assert.equal(g.annex.volleys, 1);
  assert.equal(events.length, 3);
  assert.equal(g.shots.length, 4);
  for (let n = 0; n < 3; n++) {
    assert.equal(events[n].index, n);
    assert.deepEqual(events[n].origin, g.annex.port);
    assert.deepEqual(events[n].muzzle, g.shots[n + 1].pos);
  }
  assert.equal(p.recoil, 0);
  assert(p.radio.release > 0.9);
  near(p.barrel.angle, body.angle);
  near(p.barrel.origin.x, body.origin.x);
  near(p.barrel.origin.y, body.origin.y);
  const frozen = structuredClone(s),
    copy = g.machineBreakdown.getSignalMachine(e)!;
  copy.discharges[0].origin.x = -100;
  copy.discharges.at(-1)!.muzzle.y = -100;
  t.aim.x = 123;
  g.level.annexStation!.port.x += 100;
  assert.deepEqual(s, frozen);
  assert.notDeepEqual(copy, g.machineBreakdown.getSignalMachine(e));
  plain(s);
});

test('remote Annex full and partial caps or actual muzzle impacts animate only the port lanes that really discharge', () => {
  for (const cap of [179, 180]) {
    const { g, e } = fixture('switchman');
    charge(g, e);
    fill(g, cap);
    releasePort(g);
    const s = snapshot(g, e),
      p = signalMachinePose(s),
      events = s.signalMachine!.discharges;
    assert.equal(g.annex.volleys, 1, 'native attempted-volley count is unchanged');
    assert.equal(g.shots.length, 180);
    assert.equal(events.length, 180 - cap);
    assert.equal(p.recoil, 0);
    assert.equal(p.barrel.recoil, 0);
    if (cap === 180) assert.equal(p.radio.release, 0);
    else {
      assert.equal(events[0].index, 0);
      assert(p.radio.release > 0.9);
    }
  }
  const { g, e } = fixture('switchman');
  charge(g, e);
  wall(g, g.annex.port.x - 12, g.annex.port.y + 5, 8, 80);
  releasePort(g);
  assert.equal(g.shots.length, 0);
  assert.equal(snapshot(g, e).signalMachine!.discharges.length, 3);
  assert.equal(signalMachinePose(snapshot(g, e)).recoil, 0);
  assert(signalMachinePose(snapshot(g, e)).radio.release > 0.9);
});

test('real junction feedback records exact accepted health loss, not a volley, including pre-lethal source capture', () => {
  for (const hp of [100, 20]) {
    const { g, e } = fixture('switchman');
    e.hp = hp;
    e.maxHp = 100;
    charge(g, e);
    const kills = g.kills;
    assert(g.annex.interrupt());
    const w = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id),
      s = w?.visual ?? snapshot(g, e),
      event = s.signalMachine!.feedback!;
    assert.equal(event.at, g.time);
    assert.equal(event.healthLost, Math.min(hp, 42));
    assert.deepEqual(event.from, g.annex.junction);
    assert.equal(s.signalMachine!.switchman!.transmission!.interrupted, true);
    assert.deepEqual(s.signalMachine!.discharges, []);
    assert.equal(g.annex.volleys, 0);
    assert.equal(g.shots.length, 0);
    assert(signalMachinePose(s).radio.feedback > 0);
    assert.equal(signalMachinePose(s).recoil, 0);
    if (hp === 20) {
      assert(w);
      assert.equal(w.visual.hp, 20);
      assert.equal(w.hit!.healthLost, 20);
      assert.equal(g.kills, kills + 1);
      assert.equal(g.machineBreakdown.getSignalMachine(e), null);
    } else {
      assert(!w);
      assert.equal(e.hp, 58);
      g.hitEnemy(e, 1, undefined, false);
      assert.equal(snapshot(g, e).signalMachine!.feedback!.healthLost, 42);
    }
  }
  const { g, e } = fixture('switchman');
  e.elite = 'shielded';
  e.facing = -1;
  charge(g, e);
  const hp = e.hp;
  assert(g.annex.interrupt());
  near(hp - e.hp, 4.2);
  near(snapshot(g, e).signalMachine!.feedback!.healthLost, 4.2);
});

test('cancelled or friendly transmissions never invent remote recoil, shots or feedback', () => {
  const f = fixture('switchman');
  charge(f.g, f.e);
  f.g.annex.interrupt();
  f.g.time += 0.5;
  f.g.machineBreakdown.update();
  assert.equal(signalMachinePose(snapshot(f.g, f.e)).radio.release, 0);
  assert.equal(signalMachinePose(snapshot(f.g, f.e)).recoil, 0);
  const g = base(),
    ally = g.factions.spawn('switchman', { x: 900, y: 722 })!;
  ally.spawn = 0;
  ally.timer = 100;
  g.machineBreakdown.update();
  charge(g, ally);
  assert.equal(g.annex.interrupt(), false);
  assert.equal(snapshot(g, ally).signalMachine!.feedback, null);
  ally.rebootUntil = g.time + 10;
  g.mods = ['ghost-shift'];
  releasePort(g);
  assert.equal(g.annex.volleys, 1);
  assert.equal(g.shots.length, 0);
  assert.deepEqual(snapshot(g, ally).signalMachine!.discharges, []);
  const dead = fixture('switchman');
  charge(dead.g, dead.e);
  dead.g.hitEnemy(dead.e, 100000, undefined, false);
  dead.g.annex.update();
  assert.equal(dead.g.annex.transmission, null);
  assert.equal(dead.g.shots.length, 0);
});

test('native blue contact and hostile rounds create exactly one local contact and captured wreck before Caller cleanup, with no kill credit', () => {
  for (const kind of ['caller', 'switchman'] as const) {
    const g = base(),
      ally = g.factions.spawn(kind, { x: 600, y: 722 })!;
    ally.spawn = 0;
    ally.timer = 0;
    update(g, ally);
    const kills = g.kills;
    g.addShot({
      pos: { x: 550, y: 722 },
      vel: { x: 35, y: 0 },
      damage: 10,
      life: 1,
      friendly: false,
      radius: 3,
      bounces: 0,
      pierce: 0,
      fragment: false,
      split: false,
    });
    g.time += DT;
    g.updateShots(DT);
    assert.equal(g.machineBreakdown.getHits(ally.id).length, 1);
    assert(g.machineBreakdown.getHits(ally.id)[0].contact);
    const attacker = g.spawnEnemy('runner', ally.body.position.x - 20, ally.body.position.y)!;
    attacker.spawn = 0;
    ally.hp = 3;
    const state = kind === 'caller' ? structuredClone(ally.caller) : null;
    g.factions.contact(attacker);
    const wrecks = g.machineBreakdown.wrecks.filter((w) => w.visual.id === ally.id);
    assert.equal(wrecks.length, 1);
    const w = wrecks[0];
    assert(w.visual.allied);
    assert.equal(w.hit!.healthLost, 3);
    assert(w.hit!.contact);
    assert.equal(g.kills, kills);
    if (state) assert.equal(w.visual.signalMachine!.caller!.phase, state.phase);
    assert.equal(ally.caller, undefined);
    assert(!g.factions.allies.includes(ally));
  }
});

test('native blue expiry and cleanup remain silent while already admitted body and port rounds survive owner death unchanged', () => {
  const g = base(),
    ally = g.factions.spawn('caller', { x: 600, y: 722 })!;
  ally.spawn = 0;
  ally.rebootUntil = g.time;
  g.machineBreakdown.update();
  g.factions.beforeStep(DT);
  g.machineBreakdown.update();
  assert(!g.factions.allies.includes(ally));
  assert.equal(g.machineBreakdown.wrecks.length, 0);
  const f = fixture('switchman');
  f.e.timer = 0;
  update(f.g, f.e);
  charge(f.g, f.e);
  releasePort(f.g);
  const shots = [...f.g.shots],
    positions = shots.map((s) => ({ ...s.pos }));
  f.g.hitEnemy(f.e, 100000, undefined, false);
  assert.deepEqual(f.g.shots, shots);
  assert.equal(f.g.machineBreakdown.wrecks.filter((w) => w.visual.id === f.e.id).length, 1);
  f.g.time += DT;
  f.g.updateShots(DT);
  assert(shots.some((s, i) => s.pos.x !== positions[i].x || s.pos.y !== positions[i].y));
});

test('signal snapshots and poses are detached and pure, allocate no Matter IDs, freeze on Pause and suppress secondary Reduced motion', () => {
  for (const kind of ['caller', 'switchman'] as const) {
    const { g, e } = fixture(kind);
    if (kind === 'caller') {
      record(g, e);
      until(g, e, () => e.attacks === 1);
    } else {
      charge(g, e);
      releasePort(g);
    }
    const before = {
        hp: e.hp,
        state: e.state,
        timer: e.timer,
        aim: { ...e.aim },
        position: { ...e.body.position },
        velocity: { ...e.body.velocity },
        force: { ...e.body.force },
        shots: g.shots.map((s) => ({ pos: { ...s.pos }, vel: { ...s.vel }, life: s.life })),
        checkpoint: g.checkpointSnapshot(),
      },
      id = Matter.Common.nextId();
    for (let n = 0; n < 25; n++) {
      const s = snapshot(g, e);
      plain(s);
      finite(signalMachinePose(s));
      finite(signalMachinePose(s, true));
    }
    assert.equal(Matter.Common.nextId(), id + 1);
    assert.deepEqual(
      {
        hp: e.hp,
        state: e.state,
        timer: e.timer,
        aim: { ...e.aim },
        position: { ...e.body.position },
        velocity: { ...e.body.velocity },
        force: { ...e.body.force },
        shots: g.shots.map((s) => ({ pos: { ...s.pos }, vel: { ...s.vel }, life: s.life })),
        checkpoint: g.checkpointSnapshot(),
      },
      before,
    );
    const s = snapshot(g, e),
      reduced = signalMachinePose(s, true);
    assert.equal(reduced.recoil, 0);
    assert.equal(reduced.radio.release, 0);
    assert.deepEqual(reduced, signalMachinePose({ ...s, time: s.time + 0.5 }, true));
    const saved = JSON.stringify(s);
    g.setMode('paused');
    tick(g, 30);
    assert.equal(JSON.stringify(snapshot(g, e)), saved);
  }
});

test('signal histories and records are bounded, expire, prune and reset without extending native cleanup', () => {
  const { g, e } = fixture('switchman');
  for (let n = 0; n < 12; n++) {
    g.enemyShot(e, 0);
    g.time += 0.01;
  }
  assert.equal(g.machineBreakdown.getSignalMachine(e)!.discharges.length, 6);
  g.time += 0.8;
  g.machineBreakdown.update();
  assert.deepEqual(g.machineBreakdown.getSignalMachine(e)!.discharges, []);
  const model = g.machineBreakdown as unknown as { signalMachines: Map<number, unknown> };
  for (let n = 0; n < 110; n++) {
    const a = g.spawnEnemy('caller', 500, 400)!;
    a.spawn = 0;
    g.machineBreakdown.signalDischarge(a, 0, a.body.position, { x: 526, y: 400 });
    assert(model.signalMachines.size <= MACHINE_MAX_HITS);
    g.enemies = g.enemies.filter((x) => x !== a);
    Composite.remove(g.engine.world, a.body);
  }
  g.machineBreakdown.update();
  assert.equal(model.signalMachines.size, 1);
  const kills = g.kills;
  g.hitEnemy(e, 100000, undefined, false, false, false, 'cleanup');
  g.machineBreakdown.update();
  assert(!model.signalMachines.has(e.id));
  assert.equal(g.kills, kills);
  assert.equal(g.machineBreakdown.wrecks.length, 0);
  for (let n = 0; n < 20; n++) {
    const a = g.spawnEnemy('caller', 500, 400)!;
    a.spawn = 0;
    g.hitEnemy(a, 100000, undefined, false);
  }
  assert(g.machineBreakdown.wrecks.length <= MACHINE_MAX_WRECKS);
  g.loadRoom();
  assert.equal(model.signalMachines.size, 0);
  assert.equal(g.machineBreakdown.wrecks.length, 0);
});

test('native signal AI, projectiles, audio, rewards, RNG, bodies and checkpoint outcomes match with presentation hooks disabled', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  for (const kind of ['caller', 'switchman'] as const) {
    const a = fixture(kind),
      b = fixture(kind),
      sa: string[] = [],
      sb: string[] = [],
      ra: string[] = [],
      rb: string[] = [];
    b.g.machineBreakdown.beforeHit = () => null;
    b.g.machineBreakdown.hit = () => {};
    b.g.machineBreakdown.defeated = () => {};
    b.g.machineBreakdown.update = () => {};
    b.g.machineBreakdown.signalDischarge = () => {};
    a.g.onSound = (k) => sa.push(k);
    b.g.onSound = (k) => sb.push(k);
    a.g.onEnemyDefeated = (k) => ra.push(k);
    b.g.onEnemyDefeated = (k) => rb.push(k);
    for (const { g, e } of [a, b]) {
      if (kind === 'caller') {
        record(g, e);
        until(g, e, () => e.attacks === 3);
      } else {
        e.timer = 0;
        update(g, e);
        charge(g, e);
        releasePort(g);
      }
      for (let n = 0; n < 15; n++) signalMachinePose(snapshot(g, e), n % 2 === 0);
      g.hitEnemy(e, 100000, { x: 300, y: 722 }, false);
      tick(g, 15);
    }
    assert.deepEqual(a.g.checkpointSnapshot(), b.g.checkpointSnapshot());
    assert.deepEqual(a.g.player.position, b.g.player.position);
    assert.deepEqual(a.g.player.velocity, b.g.player.velocity);
    assert.deepEqual(a.g.shots, b.g.shots);
    assert.deepEqual(sa, sb);
    assert.deepEqual(ra, rb);
    assert.equal(a.g.rng(), b.g.rng());
    assert.equal(a.g.waves.pending, b.g.waves.pending);
    assert.equal(
      Composite.allBodies(a.g.engine.world).length,
      Composite.allBodies(b.g.engine.world).length,
    );
  }
});
