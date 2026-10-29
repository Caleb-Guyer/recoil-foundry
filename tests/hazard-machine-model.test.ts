import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import type { Level } from '../src/levels.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { machineBodySnapshot, machinePose, isMachineKind } from '../src/machine-breakdown-pose.ts';
import {
  hazardMachinePose,
  isHazardMachineKind,
  type HazardMachineKind,
} from '../src/hazard-machine-pose.ts';
import { SCRAPPER_STUN, updateScrapper } from '../src/scrapper.ts';
import { HARPOON_ANCHOR_HP, harpoonMuzzle } from '../src/harpooner.ts';
import { CHARGE_LIMIT, sapperMuzzle } from '../src/sapper.ts';
import { MACHINE_MAX_HITS, MACHINE_MAX_WRECKS } from '../src/machine-breakdown.ts';
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 700 },
};
const arena: Level = {
  id: 'hazard-native-model',
  name: 'Native hazard floor',
  area: 'reclamation',
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
function fixture(kind: HazardMachineKind, x = 1000) {
  const g = new Game(),
    cp = {
      version: 6 as const,
      seed: 'RF-C108-HAZARDMODEL',
      stage: 8,
      hp: 100,
      mods: [],
      kills: 0,
      elapsed: 0,
    };
  g.start(cp.seed, cp, null, { ...cp, rematchRoom: structuredClone(arena) });
  g.waves.clear();
  for (const guard of g.enemies) {
    guard.spawn = 0;
    guard.timer = 1000;
  }
  Matter.Body.setPosition(g.player, { x: kind === 'sapper' ? x + 450 : x - 500, y: 722 });
  const e = g.spawnEnemy(kind, x, 740 - ENEMY_STATS[kind].h / 2)!;
  assert(e);
  e.spawn = 0;
  e.timer = 0;
  g.machineBreakdown.update();
  return { g, e };
}
function step(g: Game, n = 1) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, idle);
}
function until(g: Game, condition: () => boolean, limit = 260) {
  for (let i = 0; i < limit && !condition(); i++) step(g);
  assert(
    condition(),
    JSON.stringify({
      time: g.time,
      hp: g.hp,
      enemies: g.enemies.map((e) => ({
        kind: e.kind,
        state: e.state,
        timer: e.timer,
        attacks: e.attacks,
        held: e.scrapper?.held?.body.id,
        phase: e.harpoon?.phase,
      })),
    }),
  );
}
function plain(value: unknown) {
  if (value === null || typeof value !== 'object') return;
  assert(
    Object.getPrototypeOf(value) === Object.prototype || Array.isArray(value),
    'detached plain presentation only',
  );
  for (const v of Object.values(value)) plain(v);
}
function finite(value: unknown) {
  if (typeof value === 'number') assert(Number.isFinite(value));
  else if (value && typeof value === 'object') for (const v of Object.values(value)) finite(v);
}
function scrap() {
  const f = fixture('scrapper');
  const crate = f.g.props.spawn('crate', 890, 717);
  step(f.g);
  assert.equal(f.e.scrapper!.held, crate);
  return { ...f, crate };
}
function latch() {
  const f = fixture('harpooner');
  until(f.g, () => f.e.harpoon!.phase === 'latched');
  f.g.hitStop = 0;
  return f;
}

test('hazard snapshots extend the thirteen existing families without replacing their data or accepted outcomes', () => {
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
  ] as const) {
    const { g } = fixture('scrapper');
    const e = g.spawnEnemy(kind, 500, 400)!;
    assert(e);
    e.spawn = 0;
    const s = machineBodySnapshot(e, g.time, g)!;
    assert.equal(s.hazardMachine, undefined);
    assert.equal(machinePose(s).kind, kind);
    plain(s);
  }
  for (const kind of ['scrapper', 'harpooner', 'sapper'] as const) {
    assert(isMachineKind(kind));
    assert(isHazardMachineKind(kind));
    const f = fixture(kind),
      s = machineBodySnapshot(f.e, f.g.time, f.g)!;
    assert(s.hazardMachine);
    assert.equal(hazardMachinePose(s).kind, kind);
    plain(s);
    finite(hazardMachinePose(s));
  }
  assert.equal(isHazardMachineKind('angler'), false);
  assert.equal(isHazardMachineKind('boss'), false);
});

test('real Scrapper lift, locked aim and committed physical throw drive the copied grip and release event', () => {
  const { g, e, crate } = scrap();
  let s = machineBodySnapshot(e, g.time, g)!,
    p = hazardMachinePose(s);
  assert.equal(s.hazardMachine!.scrapper!.held!.id, crate.body.id);
  assert.deepEqual(s.hazardMachine!.scrapper!.anchor, e.scrapper!.tether!.pointA);
  assert.equal(p.mode, 'lift');
  assert.equal(p.arm!.grip, 1);
  assert.deepEqual(p.arm!.hand, {
    x: crate.body.position.x - e.body.position.x,
    y: crate.body.position.y - e.body.position.y,
  });
  until(g, () => e.scrapper!.phase === 'aim');
  s = machineBodySnapshot(e, g.time, g)!;
  assert.equal(hazardMachinePose(s).mode, 'aim');
  const copy = structuredClone(s);
  Matter.Body.setAngularVelocity(crate.body, 0.02);
  assert.deepEqual(s, copy);
  plain(s);
  until(g, () => e.attacks === 1);
  s = machineBodySnapshot(e, g.time, g)!;
  p = hazardMachinePose(s);
  assert.equal(s.hazardMachine!.scrapper!.held, null);
  assert.equal(s.hazardMachine!.releaseAt, g.time);
  assert.equal(s.hazardMachine!.interruptedAt, null);
  assert.equal(p.mode, 'throw');
  assert(p.release > 0.9);
  assert(p.arm!.grip < 0.01);
  assert(g.props.items.includes(crate));
  assert((crate.throwUntil ?? 0) > g.time);
  assert.equal(Matter.Composite.allConstraints(g.engine.world).length, 0);
});

test('interrupted native grips do not count or animate another accepted throw, including late prop-hit order', () => {
  for (const phase of ['lift', 'aim'] as const) {
    const { g, e, crate } = scrap();
    if (phase === 'aim') until(g, () => e.scrapper!.phase === 'aim');
    // The regular tick observes before updateShots; this models the same late prop-hit callback.
    g.machineBreakdown.update();
    g.props.hit(crate, 24, { x: -1, y: 0 });
    assert.equal(e.state, 'recover');
    assert.equal(e.timer, SCRAPPER_STUN);
    assert.equal(e.attacks, 0);
    assert.equal(e.scrapper!.held, null);
    step(g);
    const s = machineBodySnapshot(e, g.time, g)!;
    assert.equal(s.hazardMachine!.releaseAt, null);
    assert.equal(s.hazardMachine!.interruptedAt, g.time);
    assert.equal(hazardMachinePose(s).release, 0);
    assert.equal(hazardMachinePose(s).mode, 'stunned');
    assert.equal(Matter.Composite.allConstraints(g.engine.world).length, 0);
    assert(g.props.items.includes(crate));
  }
});

test('Scrapper defeat captures the held mechanism while native cleanup releases the original crate once', () => {
  const { g, e, crate } = scrap(),
    kills = g.kills;
  const hp = e.hp;
  g.hitEnemy(e, 100000, { x: 700, y: 724 }, false);
  const w = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id)!;
  assert(w);
  assert.equal(w.visual.hp, hp);
  assert.equal(w.visual.hazardMachine!.scrapper!.held!.id, crate.body.id);
  assert.equal(g.kills, kills + 1);
  assert.equal(e.scrapper!.held, null);
  assert(g.props.items.includes(crate));
  assert.equal(Matter.Composite.allConstraints(g.engine.world).length, 0);
  plain(w.visual);
  const frozen = structuredClone(w.visual);
  Matter.Body.setPosition(crate.body, { x: 1, y: 1 });
  assert.deepEqual(w.visual, frozen);
});

test('native Harpooner aim, accepted launch, physical latch and tension retain exact muzzle and target copies', () => {
  const { g, e } = fixture('harpooner');
  until(g, () => e.harpoon!.phase === 'aim');
  let s = machineBodySnapshot(e, g.time, g)!;
  assert.deepEqual(s.hazardMachine!.harpoon!.muzzle, harpoonMuzzle(e));
  assert.equal(s.hazardMachine!.releaseAt, null);
  until(g, () => e.attacks === 1);
  s = machineBodySnapshot(e, g.time, g)!;
  assert.equal(s.hazardMachine!.releaseAt, g.time);
  assert(hazardMachinePose(s).release > 0.9);
  assert.deepEqual(hazardMachinePose(s).barrel!.origin, {
    x: harpoonMuzzle(e).x - e.body.position.x,
    y: harpoonMuzzle(e).y - e.body.position.y,
  });
  until(g, () => e.harpoon!.phase === 'latched');
  s = machineBodySnapshot(e, g.time, g)!;
  assert(s.hazardMachine!.harpoon!.target!.isPlayer);
  assert.equal(s.hazardMachine!.harpoon!.anchorHp, HARPOON_ANCHOR_HP);
  assert.equal(
    s.hazardMachine!.harpoon!.span,
    Math.hypot(
      s.hazardMachine!.harpoon!.head.x - s.hazardMachine!.harpoon!.muzzle.x,
      s.hazardMachine!.harpoon!.head.y - s.hazardMachine!.harpoon!.muzzle.y,
    ),
  );
  const saved = structuredClone(s);
  step(g, 20);
  const tension = machineBodySnapshot(e, g.time, g)!.hazardMachine!.harpoon!.tension;
  assert(tension >= 0 && tension <= 1);
  assert.deepEqual(s, saved);
  plain(s);
});

test('broken Harpoon anchors recover without a fake second discharge or retained target', () => {
  const { g, e } = latch(),
    releaseAt = machineBodySnapshot(e, g.time, g)!.hazardMachine!.releaseAt,
    attacks = e.attacks;
  g.machineBreakdown.update();
  g.harpoons.hitAnchor(e, 10000);
  assert.equal(e.harpoon!.target, null);
  assert.equal(e.harpoon!.phase, 'ready');
  step(g);
  const s = machineBodySnapshot(e, g.time, g)!;
  assert.equal(e.attacks, attacks);
  assert.equal(s.hazardMachine!.releaseAt, releaseAt);
  assert.equal(s.hazardMachine!.interruptedAt, g.time);
  assert.equal(hazardMachinePose(s).mode, 'braking');
  assert(hazardMachinePose(s).brake > 0.9);
  const brake = hazardMachinePose(s).spool!.angle;
  g.time += 0.25;
  g.machineBreakdown.update();
  const settling = hazardMachinePose(machineBodySnapshot(e, g.time, g)!);
  assert(settling.brake > 0 && settling.brake < 0.9);
  assert.notEqual(settling.spool!.angle, brake);
  g.time += 0.5;
  g.machineBreakdown.update();
  assert.equal(hazardMachinePose(machineBodySnapshot(e, g.time, g)!).brake, 0);
  assert.equal(s.hazardMachine!.harpoon!.target, null);
});

test('blocked or displaced Harpooner tells never create an accepted launch', () => {
  const { g, e } = fixture('harpooner');
  e.timer = 0;
  g.harpoons.updateEnemy(e);
  g.machineBreakdown.update();
  assert.equal(e.harpoon!.phase, 'aim');
  Matter.Body.setPosition(e.body, { x: e.body.position.x + 30, y: e.body.position.y });
  e.timer = 0;
  g.harpoons.updateEnemy(e);
  g.machineBreakdown.update();
  const s = machineBodySnapshot(e, g.time, g)!;
  assert.equal(e.attacks, 0);
  assert.equal(e.harpoon!.phase, 'ready');
  assert.equal(s.hazardMachine!.releaseAt, null);
  assert.equal(hazardMachinePose(s).release, 0);
});

test('Harpooner owner destruction captures the latched rig but native release removes its force and target', () => {
  const { g, e } = latch(),
    kills = g.kills;
  g.hitEnemy(e, 100000, undefined, false);
  const w = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id)!;
  assert(w);
  assert.equal(w.visual.hazardMachine!.harpoon!.phase, 'latched');
  assert(w.visual.hazardMachine!.harpoon!.target!.isPlayer);
  assert.equal(e.harpoon!.phase, 'ready');
  assert.equal(e.harpoon!.target, null);
  assert.equal(g.kills, kills + 1);
  plain(w.visual);
});

test('Sapper accepted launches drive ejection while interrupted and charge-cap rejected launches do not', () => {
  for (const action of ['accepted', 'displaced', 'capped'] as const) {
    const { g, e } = fixture('sapper', 700);
    e.timer = 0;
    g.sappers.updateEnemy(e);
    g.machineBreakdown.update();
    assert.equal(e.state, 'windup');
    assert(machineBodySnapshot(e, g.time, g)!.hazardMachine!.sapper!.arc.length > 0);
    if (action === 'displaced')
      Matter.Body.setPosition(e.body, { x: e.body.position.x + 30, y: e.body.position.y });
    if (action === 'capped')
      for (let n = 0; n < CHARGE_LIMIT; n++) {
        const q = g.sappers.launch(e, sapperMuzzle(e), { x: 0, y: -1 });
        assert(q);
        Matter.Body.setPosition(q.body, { x: 900 + n * 50, y: 400 });
      }
    // Record accepted setup charges before attempting the now cap-rejected windup.
    g.machineBreakdown.update();
    const attacks = e.attacks,
      at = g.machineBreakdown.getHazardMachine(e)!.releaseAt;
    e.timer = 0;
    g.sappers.updateEnemy(e);
    g.machineBreakdown.update();
    const s = machineBodySnapshot(e, g.time, g)!,
      p = hazardMachinePose(s);
    assert.deepEqual(s.hazardMachine!.sapper!.muzzle, sapperMuzzle(e));
    assert.deepEqual(p.barrel!.origin, {
      x: sapperMuzzle(e).x - e.body.position.x,
      y: sapperMuzzle(e).y - e.body.position.y,
    });
    if (action === 'accepted') {
      assert.equal(e.attacks, attacks + 1);
      assert.equal(s.hazardMachine!.releaseAt, g.time);
      assert(p.release > 0.9);
      assert.equal(g.sappers.items.length, 1);
    } else {
      assert.equal(e.attacks, attacks);
      assert.equal(s.hazardMachine!.releaseAt, at);
    }
  }
});

test('planted and loose native charges survive Sapper death with their exact remaining fuses and ownership', () => {
  const { g, e } = fixture('sapper', 700);
  e.timer = 100;
  const charge = g.sappers.launch(e, { x: 950, y: 400 }, { x: 0, y: 1 })!;
  assert(charge);
  g.machineBreakdown.update();
  const floor = g.terrain[0];
  charge.charge!.host = floor;
  charge.charge!.local = { x: 0, y: -20 };
  charge.charge!.normal = { x: 0, y: -1 };
  charge.charge!.hostAngle = floor.angle;
  Matter.Body.setStatic(charge.body, true);
  charge.body.isSensor = true;
  const savedFuse = charge.charge!.at,
    s = machineBodySnapshot(e, g.time, g)!;
  assert.equal(s.hazardMachine!.sapper!.charges[0].hostId, floor.id);
  plain(s);
  g.sappers.knock(charge, 15, { x: -1, y: 0 });
  assert(charge.charge!.loose);
  assert.equal(charge.charge!.at, savedFuse);
  const captured = machineBodySnapshot(e, g.time, g)!;
  assert(captured.hazardMachine!.sapper!.charges[0].loose);
  g.hitEnemy(e, 100000, undefined, false);
  assert(g.props.items.includes(charge));
  assert.equal(charge.charge!.at, savedFuse);
  assert.equal(charge.charge!.owner, e.id);
  assert(!charge.body.isStatic);
  const w = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id)!;
  assert.equal(w.visual.hazardMachine!.sapper!.charges[0].id, charge.body.id);
  plain(w.visual);
  const copy = structuredClone(w.visual);
  g.sappers.detonate(charge);
  assert(!g.props.items.includes(charge));
  assert.deepEqual(w.visual, copy);
});

test('snapshot and pose reads are pure, allocate no Matter IDs, hold during Pause and reduce optional motion', () => {
  for (const kind of ['scrapper', 'harpooner', 'sapper'] as const) {
    const { g, e } = kind === 'scrapper' ? scrap() : fixture(kind);
    const before = {
      hp: e.hp,
      state: e.state,
      timer: e.timer,
      attacks: e.attacks,
      position: { ...e.body.position },
      velocity: { ...e.body.velocity },
      force: { ...e.body.force },
      bodies: Matter.Composite.allBodies(g.engine.world).length,
      constraints: Matter.Composite.allConstraints(g.engine.world).length,
      checkpoint: g.checkpointSnapshot(),
    };
    const next = Matter.Common.nextId();
    for (let i = 0; i < 25; i++) {
      const s = machineBodySnapshot(e, g.time, g)!;
      plain(s);
      finite(hazardMachinePose(s));
      finite(hazardMachinePose(s, true));
    }
    assert.equal(Matter.Common.nextId(), next + 1);
    assert.deepEqual(
      {
        hp: e.hp,
        state: e.state,
        timer: e.timer,
        attacks: e.attacks,
        position: { ...e.body.position },
        velocity: { ...e.body.velocity },
        force: { ...e.body.force },
        bodies: Matter.Composite.allBodies(g.engine.world).length,
        constraints: Matter.Composite.allConstraints(g.engine.world).length,
        checkpoint: g.checkpointSnapshot(),
      },
      before,
    );
    const at = JSON.stringify(machineBodySnapshot(e, g.time, g));
    g.setMode('paused');
    step(g, 40);
    assert.equal(JSON.stringify(machineBodySnapshot(e, g.time, g)), at);
    const reduced = hazardMachinePose(machineBodySnapshot(e, g.time, g)!, true);
    assert.equal(reduced.release, 0);
    assert.equal(reduced.tread, 0);
    assert.equal(reduced.angle, 0);
  }
});

test('actual local damage outcomes, cleanup isolation, repeated deaths and room reset stay bounded', () => {
  const { g, e } = fixture('sapper');
  g.hitEnemy(e, 3, { x: 700, y: 724 }, false);
  const hit = g.machineBreakdown.getHits(e.id)[0];
  assert.equal(hit.healthLost, 3);
  assert(hit.contact);
  const map = (g.machineBreakdown as unknown as { hazardMachines: Map<number, unknown> })
    .hazardMachines;
  for (let n = 0; n < 130; n++) {
    const actor = g.spawnEnemy((['scrapper', 'harpooner', 'sapper'] as const)[n % 3], 800, 724)!;
    assert(actor);
    actor.spawn = 0;
    g.machineBreakdown.update();
    g.hitEnemy(actor, 100000, undefined, false);
    assert(!map.has(actor.id));
    assert(map.size <= MACHINE_MAX_HITS);
    assert(g.machineBreakdown.wrecks.length <= MACHINE_MAX_WRECKS);
  }
  const cleanup = g.spawnEnemy('harpooner', 900, 724)!;
  cleanup.spawn = 0;
  g.hitEnemy(cleanup, 100000, undefined, false, true, true, 'cleanup');
  assert(!g.machineBreakdown.wrecks.some((w) => w.visual.id === cleanup.id));
  g.loadRoom();
  assert.equal(map.size, 0);
  assert.equal(g.machineBreakdown.wrecks.length, 0);
});

test('native working hazards retain physics, audio, rewards, random stream and saves with presentation disabled', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  for (const kind of ['scrapper', 'harpooner', 'sapper'] as const) {
    const a = fixture(kind),
      b = fixture(kind),
      soundsA: string[] = [],
      soundsB: string[] = [],
      rewardsA: string[] = [],
      rewardsB: string[] = [];
    b.g.machineBreakdown.beforeHit = () => null;
    b.g.machineBreakdown.hit = () => {};
    b.g.machineBreakdown.defeated = () => {};
    b.g.machineBreakdown.update = () => {};
    a.g.onSound = (k) => soundsA.push(k);
    b.g.onSound = (k) => soundsB.push(k);
    a.g.onEnemyDefeated = (k) => rewardsA.push(k);
    b.g.onEnemyDefeated = (k) => rewardsB.push(k);
    for (const { g, e } of [a, b]) {
      if (kind === 'scrapper') g.props.spawn('crate', 890, 717);
      until(g, () => e.attacks === 1);
      for (let i = 0; i < 20; i++)
        hazardMachinePose(machineBodySnapshot(e, g.time, g)!, i % 2 === 0);
      if (kind === 'harpooner') {
        until(g, () => e.harpoon!.phase === 'latched');
        g.hitStop = 0;
        g.harpoons.hitAnchor(e, 10000);
        step(g);
      }
      g.hitEnemy(e, 100000, { x: 700, y: 724 }, false);
    }
    assert.deepEqual(a.g.checkpointSnapshot(), b.g.checkpointSnapshot());
    assert.deepEqual(a.g.player.position, b.g.player.position);
    assert.deepEqual(a.g.player.velocity, b.g.player.velocity);
    assert.deepEqual(soundsA, soundsB);
    assert.deepEqual(rewardsA, rewardsB);
    assert.equal(a.g.rng(), b.g.rng());
    assert.equal(a.g.waves.pending, b.g.waves.pending);
    const props = (g: Game) =>
      g.props.items.map((p) => ({
        kind: p.kind,
        hp: p.hp,
        position: { ...p.body.position },
        velocity: { ...p.body.velocity },
        isStatic: p.body.isStatic,
        throwUntil: p.throwUntil,
        charge: p.charge
          ? { owner: p.charge.owner, at: p.charge.at, born: p.charge.born, loose: p.charge.loose }
          : null,
      }));
    assert.deepEqual(props(a.g), props(b.g));
    assert.equal(
      Matter.Composite.allBodies(a.g.engine.world).length,
      Matter.Composite.allBodies(b.g.engine.world).length,
    );
    assert.equal(
      Matter.Composite.allConstraints(a.g.engine.world).length,
      Matter.Composite.allConstraints(b.g.engine.world).length,
    );
  }
});
