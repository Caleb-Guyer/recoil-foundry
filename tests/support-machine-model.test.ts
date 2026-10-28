import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy } from '../src/game.ts';
import type { Level } from '../src/levels.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { SUPPORT } from '../src/teamwork.ts';
import { FABRICATOR_BUILD, sentryMuzzle } from '../src/fabricator.ts';
import {
  machineBodySnapshot,
  machinePose,
  machineSupportPartner,
  isMachineKind,
} from '../src/machine-breakdown-pose.ts';
import { MACHINE_MAX_HITS, MACHINE_MAX_WRECKS } from '../src/machine-breakdown.ts';

const arena: Level = {
  id: 'support-native-model',
  name: 'Native support floor',
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
function fixture() {
  const g = new Game(),
    cp = {
      version: 6 as const,
      seed: 'RF-C108-SUPPORTMODEL',
      stage: 8,
      hp: 100,
      mods: [],
      kills: 0,
      elapsed: 0,
      encounters: 1 as const,
      teamwork: 1 as const,
      fabricators: true as const,
    };
  g.start(cp.seed, cp, null, { ...cp, rematchRoom: structuredClone(arena) });
  for (const e of g.enemies) e.spawn = 0;
  Matter.Body.setPosition(g.player, { x: 1100, y: 722 });
  return g;
}
function actor(
  g: Game,
  kind: 'repairer' | 'relay' | 'fabricator' | 'sentry' | 'shooter' | 'runner',
  x = 700,
  y = 740 - ENEMY_STATS[kind].h / 2,
) {
  const e = g.spawnEnemy(kind, x, y)!;
  assert(e);
  e.spawn = 0;
  return e;
}
function plain(value: unknown) {
  if (!value || typeof value !== 'object') return;
  assert(
    Object.getPrototypeOf(value) === Object.prototype || Array.isArray(value),
    'detached plain presentation records',
  );
  for (const v of Object.values(value)) plain(v);
}
function support(kind: 'repairer' | 'relay') {
  const g = fixture(),
    e = actor(g, kind, 700, 610),
    target = actor(g, 'shooter', 900, 724);
  if (kind === 'repairer') target.hp -= 50;
  e.support!.timer = 0;
  g.teamwork.tick(1 / 60);
  g.machineBreakdown.update();
  assert.equal(e.support!.target, target.id);
  assert.equal(e.support!.phase, 'windup');
  return { g, e, target };
}
function startBuild() {
  const g = fixture(),
    e = actor(g, 'fabricator');
  e.timer = 0;
  g.fabricators.updateBuilder(e);
  const child = g.enemies.find((s) => s.sentry?.owner === e.id)!;
  assert(child && !child.sentry!.ready);
  g.machineBreakdown.update();
  return { g, e, child };
}
function completeBuild() {
  const f = startBuild();
  f.e.timer = 0;
  f.g.fabricators.updateBuilder(f.e);
  f.g.machineBreakdown.update();
  assert(f.child.sentry!.ready);
  return f;
}

test('four support chassis extend the detached model while earlier nine remain ordinary snapshots', () => {
  const g = fixture();
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
  ] as const) {
    const e = g.spawnEnemy(kind, 500, 400)!;
    e.spawn = 0;
    const s = machineBodySnapshot(e, g.time, g)!;
    assert.equal(s.supportMachine, undefined);
    assert.equal(machinePose(s).kind, kind);
    plain(s);
  }
  for (const kind of ['repairer', 'relay', 'fabricator', 'sentry'] as const) {
    assert(isMachineKind(kind));
    const e = actor(g, kind, 1000, 400),
      s = machineBodySnapshot(e, g.time, g)!;
    assert(s.supportMachine);
    assert.equal(machinePose(s).kind, kind);
    assert(s.hull.x > 0 && s.hull.y > 0);
    plain(s);
  }
  assert.equal(isMachineKind('reclaimer'), false);
});

test('Repairer tracks real reserve consumption including an immediately completed final pulse', () => {
  const { g, e, target } = support('repairer'),
    hp = target.hp;
  e.support!.timer = 0;
  g.teamwork.tick(1 / 60);
  g.machineBreakdown.update();
  let s = machineBodySnapshot(e, g.time, g)!;
  assert.equal(target.hp, hp + 8);
  assert.equal(s.supportMachine!.support!.remaining, 40);
  assert.equal(s.supportMachine!.support!.pulse!.amount, 8);
  assert.equal(s.supportMachine!.support!.pulse!.target!.id, target.id);
  // The native finish clears target and changes phase in this same controller call.
  e.support!.remaining = 5;
  target.hp = target.maxHp - 5;
  g.machineBreakdown.update();
  g.time += 0.7;
  e.support!.timer = 0;
  g.teamwork.tick(1 / 60);
  g.machineBreakdown.update();
  s = machineBodySnapshot(e, g.time, g)!;
  assert.equal(target.hp, target.maxHp);
  assert.equal(e.support!.phase, 'spent');
  assert.equal(e.support!.target, undefined);
  assert.equal(s.supportMachine!.support!.remaining, 0);
  assert.equal(s.supportMachine!.support!.partner, null);
  assert.equal(s.supportMachine!.support!.pulse!.amount, 5);
  assert.equal(s.supportMachine!.support!.pulse!.target!.hp, target.maxHp);
  assert.equal(s.supportMachine!.support!.pulse!.at, g.time);
  const saved = structuredClone(s);
  target.hp = 1;
  Matter.Body.setPosition(target.body, { x: 1, y: 1 });
  assert.deepEqual(s, saved);
  plain(s);
});

test('Relay ready expiry and severed links never consume a cell or invent a discharge', () => {
  for (const action of ['expire', 'cut', 'charge'] as const) {
    const { g, e, target } = support('relay');
    e.support!.timer = 0;
    g.teamwork.tick(1 / 60);
    g.machineBreakdown.update();
    assert.equal(e.support!.phase, 'ready');
    assert.equal(e.support!.remaining, SUPPORT.charges);
    if (action === 'expire') {
      e.support!.timer = 0;
      g.teamwork.tick(1 / 60);
    } else if (action === 'cut')
      g.teamwork.cutAlong({ x: 800, y: 550 }, { x: 800, y: 750 }, 2, true);
    else assert(g.teamwork.takeCharge(target));
    g.machineBreakdown.update();
    const s = machineBodySnapshot(e, g.time, g)!.supportMachine!.support!;
    assert.equal(s.remaining, action === 'charge' ? 2 : 3);
    assert.equal(s.partner, null);
    if (action === 'charge') {
      assert.equal(s.pulse!.amount, 1);
      assert.equal(s.pulse!.target!.id, target.id);
    } else assert.equal(s.pulse, null);
  }
});

test('support partner projection preserves frozen and pinned bodies and never allocates Matter ray hulls', () => {
  const { g, e, target } = support('relay');
  Matter.Body.setVelocity(target.body, { x: 3, y: -2 });
  g.cryogenic.states.set(target.id, {
    cold: 48,
    touched: g.time,
    frozen: g.time + 2,
    immune: 0,
    ready: false,
  });
  const before = {
    velocity: { ...target.body.velocity },
    force: { ...target.body.force },
    id: Matter.Common.nextId(),
  };
  assert.equal(machineSupportPartner(g, e), null);
  for (let i = 0; i < 20; i++) {
    machineBodySnapshot(e, g.time, g);
    g.machineBreakdown.update();
  }
  assert.deepEqual(target.body.velocity, before.velocity);
  assert.deepEqual(target.body.force, before.force);
  assert.equal(
    Matter.Common.nextId(),
    before.id + 1,
    'cosmetic snapshots allocate no temporary physics body',
  );
  g.cryogenic.states.clear();
  const floor = g.terrain[0];
  g.ballistics.pins.set(target.id, {
    pos: { ...target.body.position },
    surface: floor,
    surfacePos: { ...floor.position },
    until: g.time + 3,
    fractured: false,
  });
  assert.equal(machineSupportPartner(g, e), null);
  machineBodySnapshot(e, g.time, g);
  g.machineBreakdown.update();
  assert.deepEqual(target.body.velocity, before.velocity);
  assert.deepEqual(target.body.force, before.force);
  assert(g.ballistics.pins.has(target.id));
  const pin = g.ballistics.pins.get(target.id)!;
  pin.until = g.time - 1;
  assert(machineSupportPartner(g, e));
  assert(g.ballistics.pins.has(target.id), 'rendering does not delete expired native records');
});

test('native construction shares the actual frame, origin, partial progress and completed owner', () => {
  const { g, e, child } = startBuild();
  e.timer = FABRICATOR_BUILD / 2;
  g.machineBreakdown.update();
  const b = machineBodySnapshot(e, g.time, g)!,
    s = machineBodySnapshot(child, g.time, g)!;
  assert.equal(b.supportMachine!.fabricator!.frame!.id, child.id);
  assert.equal(b.supportMachine!.fabricator!.frame!.buildProgress, 0.5);
  assert.equal(s.supportMachine!.sentry!.ownerId, e.id);
  assert.equal(s.supportMachine!.sentry!.owner!.id, e.id);
  assert.equal(s.supportMachine!.sentry!.buildProgress, 0.5);
  assert.equal(s.supportMachine!.sentry!.ready, false);
  assert.deepEqual(s.supportMachine!.sentry!.muzzle, sentryMuzzle(child));
  plain(b);
  plain(s);
  const saved = structuredClone(b);
  e.fabricator!.origin!.x += 8;
  Matter.Body.setPosition(child.body, { x: child.body.position.x + 1, y: child.body.position.y });
  assert.deepEqual(b, saved);
});

test('Sentry recoil is established only by its native firing counter, never an interrupted aim', () => {
  for (const action of ['fire', 'disrupt', 'support-loss'] as const) {
    const { g, e, child } = completeBuild();
    child.timer = 0;
    g.fabricators.updateSentry(child);
    g.machineBreakdown.update();
    assert.equal(child.state, 'windup');
    if (action === 'fire') {
      child.timer = 0;
      g.fabricators.updateSentry(child);
      assert(g.shots.some((s) => s.sentryOwner === e.id));
    } else if (action === 'disrupt') g.fabricators.disrupt(child.body);
    else {
      Matter.Body.setPosition(child.body, {
        x: child.body.position.x,
        y: child.body.position.y - 10,
      });
      g.fabricators.updateSentry(child);
    }
    g.machineBreakdown.update();
    const s = machineBodySnapshot(child, g.time, g)!.supportMachine!.sentry!;
    assert.equal(child.state, 'recover');
    assert.equal(s.dischargeAt, action === 'fire' ? g.time : null);
    assert.equal(child.attacks, action === 'fire' ? 1 : 0);
    assert.deepEqual(s.muzzle, sentryMuzzle(child));
    assert(s.owner && s.owner.id === e.id);
  }
});

test('interrupted half-built frames get detached noncombat shutdowns without scoring a kill', () => {
  for (const method of ['hit', 'disrupt'] as const) {
    const { g, e, child } = startBuild();
    e.timer = FABRICATOR_BUILD * 0.7;
    g.machineBreakdown.update();
    const kills = g.kills,
      built = e.fabricator!.built,
      hp = g.hp;
    if (method === 'hit') g.hitEnemy(e, 1, undefined, false);
    else g.fabricators.disrupt(e.body);
    const w = g.machineBreakdown.wrecks.find((w) => w.visual.id === child.id)!;
    assert(w);
    assert.equal(w.reason, 'interrupted');
    assert.equal(w.hit, null);
    assert(Math.abs(w.visual.supportMachine!.sentry!.buildProgress - 0.3) < 1e-10);
    assert.equal(w.visual.supportMachine!.sentry!.owner!.id, e.id);
    assert.equal(e.fabricator!.frame, undefined);
    assert.equal(e.fabricator!.built, built);
    assert(!g.enemies.includes(child));
    assert(!Matter.Composite.allBodies(g.engine.world).includes(child.body));
    assert.equal(g.kills, kills);
    assert.equal(g.hp, hp);
    plain(w.visual);
    g.machineBreakdown.update();
    assert.equal(g.machineBreakdown.getSupportMachine(e)!.interruptedAt, g.time);
    const copy = structuredClone(w.visual);
    e.timer = 123;
    Matter.Body.setPosition(e.body, { x: 50, y: 50 });
    assert.deepEqual(w.visual, copy);
  }
});

test('owner death captures complete and partially built child context after owner leaves enemies', () => {
  for (const ready of [false, true]) {
    const { g, e, child } = ready ? completeBuild() : startBuild();
    if (!ready) e.timer = FABRICATOR_BUILD * 0.6;
    g.machineBreakdown.update();
    const kills = g.kills;
    g.hitEnemy(e, 100000, undefined, false);
    assert(!g.enemies.includes(e));
    assert(!g.enemies.includes(child));
    assert.equal(g.kills, kills + 1, 'only native owner destruction counts as a kill');
    const w = g.machineBreakdown.wrecks.find((w) => w.visual.id === child.id)!;
    assert(w);
    assert.equal(w.reason, 'owner-lost');
    assert.equal(w.hit, null);
    assert.equal(w.visual.supportMachine!.sentry!.ready, ready);
    assert.equal(w.visual.supportMachine!.sentry!.owner!.id, e.id);
    assert(Math.abs(w.visual.supportMachine!.sentry!.buildProgress - (ready ? 1 : 0.4)) < 1e-10);
    assert.equal(g.machineBreakdown.wrecks.filter((w) => w.visual.id === child.id).length, 1);
    plain(w.visual);
  }
});

test('cleanup is silent and combat Sentry destruction remains its native non-scoring outcome', () => {
  for (const method of ['cleanup', 'combat'] as const) {
    const { g, child } = completeBuild(),
      kills = g.kills;
    if (method === 'cleanup') g.fabricators.clear();
    else g.hitEnemy(child, 100000, undefined, false);
    assert(!g.enemies.includes(child));
    assert.equal(g.kills, kills);
    const w = g.machineBreakdown.wrecks.find((w) => w.visual.id === child.id);
    if (method === 'cleanup') assert.equal(w, undefined);
    else {
      assert(w);
      assert.equal(w.reason, 'combat');
    }
  }
});

test('support observations, hits and wrecks stay bounded and reset across native room boundaries', () => {
  const g = fixture();
  const models = (g.machineBreakdown as unknown as { supportMachines: Map<number, unknown> })
    .supportMachines;
  for (let i = 0; i < 180; i++) {
    const e = actor(g, 'relay', 500 + (i % 20) * 3, 400);
    g.machineBreakdown.update();
    assert(models.size <= MACHINE_MAX_HITS);
    g.hitEnemy(e, 100000, undefined, false);
    assert(!models.has(e.id), 'dead actors do not leave support observers behind');
  }
  assert.equal(g.machineBreakdown.wrecks.length, MACHINE_MAX_WRECKS);
  for (let i = 0; i < 10; i++) actor(g, 'relay', 600 + i * 3, 400);
  g.machineBreakdown.update();
  assert.equal(models.size, 10);
  g.machineBreakdown.reset();
  assert.equal(models.size, 0);
  assert.equal(g.machineBreakdown.wrecks.length, 0);
});

test('support presentation preserves native HP, physics, rewards, audio, RNG and saved builds through real assembly and owner loss', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  const a = fixture(),
    b = fixture();
  b.machineBreakdown.beforeHit = () => null;
  b.machineBreakdown.hit = () => {};
  b.machineBreakdown.defeated = () => {};
  b.machineBreakdown.removed = () => {};
  b.machineBreakdown.update = () => {};
  const soundsA: string[] = [],
    soundsB: string[] = [],
    rewardsA: string[] = [],
    rewardsB: string[] = [];
  a.onSound = (k) => soundsA.push(k);
  b.onSound = (k) => soundsB.push(k);
  a.onEnemyDefeated = (k) => rewardsA.push(k);
  b.onEnemyDefeated = (k) => rewardsB.push(k);
  for (const kind of ['repairer', 'relay'] as const) {
    const owners = [actor(a, kind, 700, 610), actor(b, kind, 700, 610)],
      targets = [actor(a, 'shooter', 900, 724), actor(b, 'shooter', 900, 724)];
    for (const [i, g] of [a, b].entries()) {
      const e = owners[i],
        target = targets[i];
      if (kind === 'repairer') target.hp -= 50;
      e.support!.timer = 0;
      g.teamwork.tick(1 / 60);
      g.machineBreakdown.update();
      e.support!.timer = 0;
      g.teamwork.tick(1 / 60);
      g.machineBreakdown.update();
      if (kind === 'relay') assert(g.teamwork.takeCharge(target));
      const hp = e.hp,
        body = {
          position: { ...e.body.position },
          velocity: { ...e.body.velocity },
          force: { ...e.body.force },
        },
        rig = structuredClone(e.support);
      for (let n = 0; n < 15; n++) machinePose(machineBodySnapshot(e, g.time, g)!, n % 2 === 0);
      assert.equal(e.hp, hp);
      assert.deepEqual(
        {
          position: { ...e.body.position },
          velocity: { ...e.body.velocity },
          force: { ...e.body.force },
        },
        body,
      );
      assert.deepEqual(e.support, rig);
      g.hitEnemy(e, 100000, undefined, false);
      g.hitEnemy(target, 100000, undefined, false);
    }
  }
  for (const g of [a, b]) {
    const e = actor(g, 'fabricator');
    e.timer = 0;
    g.fabricators.updateBuilder(e);
    g.machineBreakdown.update();
    assert(e.fabricator!.frame !== undefined);
    e.timer = FABRICATOR_BUILD * 0.7;
    g.hitEnemy(e, 1, undefined, false);
    g.machineBreakdown.update();
    e.state = 'idle';
    e.timer = 0;
    g.time += 1;
    g.fabricators.updateBuilder(e);
    g.machineBreakdown.update();
    const child = g.enemies.find((other) => other.sentry?.owner === e.id)!;
    assert(child);
    e.timer = 0;
    g.fabricators.updateBuilder(e);
    g.machineBreakdown.update();
    child.timer = 0;
    g.fabricators.updateSentry(child);
    g.machineBreakdown.update();
    child.timer = 0;
    g.fabricators.updateSentry(child);
    g.machineBreakdown.update();
    g.hitEnemy(e, 100000, undefined, false);
    assert(!g.enemies.includes(child));
  }
  assert.deepEqual(a.checkpointSnapshot(), b.checkpointSnapshot());
  assert.deepEqual(a.player.position, b.player.position);
  assert.deepEqual(a.player.velocity, b.player.velocity);
  assert.deepEqual(soundsA, soundsB);
  assert.deepEqual(rewardsA, rewardsB);
  assert.deepEqual(a.shots, b.shots);
  assert.equal(a.rng(), b.rng());
  assert.equal(a.waves.pending, b.waves.pending);
  assert.equal(a.enemies.length, b.enemies.length);
  assert.equal(
    Matter.Composite.allBodies(a.engine.world).length,
    Matter.Composite.allBodies(b.engine.world).length,
  );
});
