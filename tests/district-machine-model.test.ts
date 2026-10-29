import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import type { Level } from '../src/levels.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { updateReclamationEnemy } from '../src/reclamation.ts';
import { updateCoolingEnemy } from '../src/cooling.ts';
import {
  districtMachinePose,
  districtNativeAngles,
  type DistrictMachineKind,
} from '../src/district-machine-pose.ts';
import { machineBodySnapshot, machinePose, isMachineKind } from '../src/machine-breakdown-pose.ts';
import { MACHINE_MAX_HITS, MACHINE_MAX_WRECKS } from '../src/machine-breakdown.ts';
const units = ['borer', 'sifter', 'skimmer'] as const;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1500, y: 700 },
};
const room: Level = {
  id: 'district-native-model',
  name: 'District machine native floor',
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
function fixture(kind: DistrictMachineKind = 'borer') {
  const g = new Game(),
    cp = {
      version: 6 as const,
      seed: 'RF-C108-DISTRICTMODEL',
      stage: 8,
      hp: 100,
      mods: [],
      kills: 0,
      elapsed: 0,
    };
  g.start(cp.seed, cp, null, { ...cp, rematchRoom: structuredClone(room) });
  g.waves.clear();
  for (const guard of g.enemies) {
    guard.spawn = 0;
    guard.timer = 1000;
  }
  Matter.Body.setPosition(g.player, { x: 1100, y: 722 });
  const e = g.spawnEnemy(kind, 700, kind === 'borer' ? 724 : 430)!;
  assert(e);
  e.spawn = 0;
  e.timer = 0;
  if (kind === 'borer') Matter.Body.setVelocity(e.body, { x: 1, y: 0 });
  g.machineBreakdown.update();
  return { g, e };
}
function update(g: Game, e: Enemy) {
  if (e.kind === 'skimmer') updateCoolingEnemy(g, e);
  else updateReclamationEnemy(g, e, 1 / 60);
}
function warn(g: Game, e: Enemy) {
  e.timer = 0;
  update(g, e);
  assert.equal(e.state, 'windup');
  g.machineBreakdown.update();
}
function release(g: Game, e: Enemy) {
  e.timer = 0;
  update(g, e);
  g.machineBreakdown.update();
  assert.equal(e.state, 'recover');
}
function tick(g: Game, n = 1) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, idle);
}
function plain(value: unknown) {
  if (!value || typeof value !== 'object') return;
  assert(
    Object.getPrototypeOf(value) === Object.prototype || Array.isArray(value),
    'only detached plain data',
  );
  for (const v of Object.values(value)) plain(v);
}
function finite(value: unknown) {
  if (typeof value === 'number') assert(Number.isFinite(value));
  else if (value && typeof value === 'object') for (const v of Object.values(value)) finite(v);
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

test('district eligibility preserves all sixteen preceding machine snapshots and excludes regional bosses', () => {
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
  ] as const) {
    const { g } = fixture();
    const e = g.spawnEnemy(kind, 500, 400)!;
    assert(e);
    e.spawn = 0;
    const s = machineBodySnapshot(e, g.time, g)!;
    assert.equal(s.districtMachine, undefined);
    assert.equal(machinePose(s).kind, kind);
    plain(s);
  }
  for (const kind of units) {
    assert(isMachineKind(kind));
    const { g, e } = fixture(kind),
      s = machineBodySnapshot(e, g.time, g)!;
    assert(s.districtMachine);
    plain(s);
    finite(districtMachinePose(s));
  }
  for (const boss of ['sorter', 'condenser', 'boss']) assert.equal(isMachineKind(boss), false);
});

test('Borer cover bracing copies the exact native eligible crate and tracks only real supported motion', () => {
  const { g, e } = fixture(),
    crate = g.props.spawn('crate', 760, 717);
  e.timer = 100;
  Matter.Body.setVelocity(e.body, { x: 2, y: 0 });
  update(g, e);
  let s = machineBodySnapshot(e, g.time, g)!;
  assert(Math.abs(e.body.velocity.x - 1.4) < 1e-10);
  assert.equal(s.districtMachine!.cover!.id, crate.body.id);
  assert.equal(s.districtMachine!.braced, true);
  assert.equal(districtMachinePose(s).coverBrace, 1);
  assert(s.districtMachine!.grounded);
  assert.notEqual(districtMachinePose(s).tread, 0);
  const copy = structuredClone(s);
  Matter.Body.translate(crate.body, { x: 2, y: 0 });
  assert.deepEqual(s, copy);
  Matter.Body.setPosition(g.player, { x: 300, y: 722 });
  s = machineBodySnapshot(e, g.time, g)!;
  assert.equal(s.districtMachine!.cover, null);
  assert.equal(s.districtMachine!.braced, false);
  Matter.Body.setPosition(g.player, { x: 1100, y: 722 });
  Matter.Body.setPosition(e.body, { x: 700, y: 400 });
  assert.equal(districtMachinePose(machineBodySnapshot(e, g.time, g)!).tread, 0);
});

for (const kind of units)
  test(
    kind + ' native three-shot attack preserves exact planned angles, accepted tips and recovery',
    () => {
      const { g, e } = fixture(kind);
      warn(g, e);
      const planned = districtNativeAngles(e);
      assert.equal(planned.length, 3);
      let s = machineBodySnapshot(e, g.time, g)!;
      assert.equal(s.districtMachine!.tell, kind === 'skimmer' ? 0.82 : 0.9);
      assert.equal(s.districtMachine!.lock, kind === 'skimmer' ? 0.34 : 0.5);
      assert.equal(s.districtMachine!.dischargeAt, null);
      g.time = 0.5;
      release(g, e);
      s = machineBodySnapshot(e, g.time, g)!;
      assert.equal(e.attacks, 1);
      assert.equal(g.shots.length, 3);
      assert.equal(s.districtMachine!.dischargeAt, 0.5);
      assert.deepEqual(s.districtMachine!.dischargeAngles, planned);
      assert.equal(s.districtMachine!.recoveryEnteredAt, 0.5);
      const p = districtMachinePose(s);
      assert.equal(p.ports.filter((p) => p.recoil > 0).length, 3);
      assert(p.recoil > 0.9);
      for (let i = 0; i < 3; i++) {
        assert(Math.abs(Math.atan2(g.shots[i].vel.y, g.shots[i].vel.x) - planned[i]) < 1e-8);
        assert.deepEqual(s.districtMachine!.dischargeMuzzles[i], g.shots[i].pos);
        assert.deepEqual(p.ports[i].origin, {
          x: g.shots[i].pos.x - e.body.position.x,
          y: g.shots[i].pos.y - e.body.position.y,
        });
      }
      plain(s);
      const frozen = structuredClone(s);
      g.shots[0].pos.x += 10;
      e.aim.x = 0;
      e.aim.y = 1;
      assert.deepEqual(s, frozen);
      const events = g.machineBreakdown.getDistrictMachine(e)!;
      events.dischargeAngles[0] = 123;
      events.dischargeMuzzles[0].x = -999;
      assert.notDeepEqual(g.machineBreakdown.getDistrictMachine(e), events);
    },
  );

test('native track and committed lock remain distinct for .5 reclamation and .34 cooling tells', () => {
  for (const kind of units) {
    const { g, e } = fixture(kind);
    warn(g, e);
    Matter.Body.setPosition(g.player, { x: 1000, y: 500 });
    e.timer = kind === 'skimmer' ? 0.5 : 0.7;
    update(g, e);
    const aim = { ...e.aim };
    Matter.Body.setPosition(g.player, { x: 600, y: 650 });
    e.timer = kind === 'skimmer' ? 0.34 : 0.5;
    update(g, e);
    assert.deepEqual(e.aim, aim);
    const s = machineBodySnapshot(e, g.time, g)!,
      p = districtMachinePose(s);
    assert(s.districtMachine!.locked);
    assert.equal(p.mode, 'locked');
    assert.equal(p.ports.length, 3);
    assert(p.ports.every((p) => p.open > 0 && p.recoil === 0));
  }
});

test('native 179/180 projectile cap admission opens and recoils only actual accepted ports', () => {
  for (const kind of units)
    for (const n of [179, 180]) {
      const { g, e } = fixture(kind);
      warn(g, e);
      fill(g, n);
      g.time = 0.5;
      release(g, e);
      const s = machineBodySnapshot(e, g.time, g)!,
        p = districtMachinePose(s);
      assert.equal(e.attacks, 1);
      assert.equal(g.shots.length, 180);
      assert.equal(s.districtMachine!.dischargeAngles.length, 180 - n);
      assert.equal(s.districtMachine!.dischargeMuzzles.length, 180 - n);
      assert.equal(p.ports.filter((p) => p.recoil > 0).length, 180 - n);
      assert.equal(p.ports.filter((p) => p.open > 0).length, 180 - n);
      if (n === 180) {
        assert.equal(s.districtMachine!.dischargeAt, null);
        assert.equal(p.recoil, 0);
      } else {
        assert.equal(s.districtMachine!.dischargeAt, 0.5);
        assert(p.ports[0].recoil > 0.9);
        assert(p.ports.slice(1).every((p) => p.recoil === 0 && p.open === 0));
      }
    }
});

test('real close-cover muzzle impacts count as discharges while suppressed allied shots do not', () => {
  const { g, e } = fixture();
  warn(g, e);
  const crate = g.props.spawn('crate', 720, 724),
    hp = crate.hp;
  g.time = 0.5;
  release(g, e);
  assert(crate.hp < hp);
  assert.equal(g.shots.length, 0);
  assert.equal(machineBodySnapshot(e, g.time, g)!.districtMachine!.dischargeAngles.length, 3);
  for (const kind of units) {
    const f = fixture(kind),
      ally = f.g.factions.spawn(kind, { x: 700, y: 400 })!;
    assert(ally);
    ally.spawn = 0;
    ally.timer = 0;
    ally.rebootUntil = f.g.time + 10;
    f.g.mods = ['ghost-shift'];
    f.g.machineBreakdown.update();
    warn(f.g, ally);
    release(f.g, ally);
    assert.equal(ally.attacks, 1);
    assert.equal(f.g.shots.length, 0);
    const s = machineBodySnapshot(ally, f.g.time, f.g)!;
    assert(s.allied);
    assert.equal(s.districtMachine!.dischargeAt, null);
    assert.equal(districtMachinePose(s).recoil, 0);
  }
});

test('interrupted, unobserved and stale-pending recoveries never invent a launch', () => {
  for (const kind of units) {
    const { g, e } = fixture(kind);
    warn(g, e);
    e.state = 'recover';
    e.timer = 1.1;
    g.machineBreakdown.update();
    assert.equal(machineBodySnapshot(e, g.time, g)!.districtMachine!.dischargeAt, null);
    // A witnessed standalone shot without a completed controller attack cannot leak into a later cap-failed cycle.
    g.enemyShot(e, 0, 10, 10);
    assert.equal(g.shots.length, 1);
    g.time += 1;
    fill(g, 179);
    e.state = 'windup';
    e.timer = 0;
    update(g, e);
    g.machineBreakdown.update();
    assert.equal(e.attacks, 1);
    assert.equal(machineBodySnapshot(e, g.time, g)!.districtMachine!.dischargeAt, null);
  }
});

test('pre-lethal district snapshots preserve the accepted volley and native projectiles keep flying after owner death', () => {
  for (const kind of units) {
    const { g, e } = fixture(kind);
    warn(g, e);
    release(g, e);
    const shots = [...g.shots],
      positions = shots.map((s) => ({ ...s.pos })),
      hp = e.hp,
      kills = g.kills;
    g.hitEnemy(e, 100000, { x: 500, y: 500 }, false);
    const w = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id)!;
    assert(w);
    assert.equal(w.visual.hp, hp);
    assert.equal(w.visual.districtMachine!.dischargeAngles.length, 3);
    assert.equal(g.kills, kills + 1);
    assert.deepEqual(g.shots, shots);
    assert(shots.every((s) => g.shots.includes(s)));
    plain(w.visual);
    g.time += 1 / 60;
    g.updateShots(1 / 60);
    assert(shots.some((s, i) => s.pos.x !== positions[i].x || s.pos.y !== positions[i].y));
    assert.equal(g.machineBreakdown.getDistrictMachine(e), null);
  }
});

test('shield absorption, native mutation restrictions and hostile allied deaths preserve identities and credit', () => {
  const { g } = fixture();
  const shield = g.spawnEnemy('borer', 500, 400, 'shielded')!;
  shield.spawn = 0;
  shield.facing = 1;
  const hp = shield.hp;
  g.hitEnemy(shield, 10, { x: 700, y: 400 }, false);
  const h = g.machineBreakdown.getHits(shield.id)[0];
  assert.equal(h.blocked, true);
  assert.equal(h.healthLost, 1);
  assert.equal(shield.hp, hp - 1);
  assert(h.contact);
  const split = g.spawnEnemy('sifter', 900, 400, undefined, undefined, undefined, 'split-child')!;
  split.spawn = 0;
  const s = machineBodySnapshot(split, g.time, g)!;
  assert.equal(s.scale, 1, 'native Sifter cannot become a runner split child');
  assert.equal(split.splitChild, undefined);
  const scaled = districtMachinePose({ ...s, scale: 0.6 });
  finite(scaled);
  assert(
    Math.abs(scaled.ports[0].origin.x - (s.districtMachine!.muzzles[0].x - s.position.x) / 0.6) <
      1e-10,
  );
  finite(districtMachinePose(s));
  for (const kind of units) {
    const f = fixture(kind),
      ally = f.g.factions.spawn(kind, { x: 600, y: 400 })!;
    ally.spawn = 0;
    ally.hp = 3;
    const kills = f.g.kills;
    f.g.addShot({
      pos: { x: 550, y: 400 },
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
    f.g.time += 1 / 60;
    f.g.updateShots(1 / 60);
    const w = f.g.machineBreakdown.wrecks.find((w) => w.visual.id === ally.id)!;
    assert(w && w.visual.allied);
    assert.equal(f.g.kills, kills);
    assert(!f.g.factions.allies.includes(ally));
  }
});

test('district projection is pure, allocates no Matter IDs, freezes in Pause and holds Reduced discharge hardware still', () => {
  for (const kind of units) {
    const { g, e } = fixture(kind);
    warn(g, e);
    release(g, e);
    const before = {
      hp: e.hp,
      state: e.state,
      timer: e.timer,
      aim: { ...e.aim },
      position: { ...e.body.position },
      velocity: { ...e.body.velocity },
      force: { ...e.body.force },
      checkpoint: g.checkpointSnapshot(),
      shots: g.shots.map((s) => ({ ...s.pos })),
    };
    const next = Matter.Common.nextId();
    for (let i = 0; i < 25; i++) {
      const s = machineBodySnapshot(e, g.time, g)!;
      plain(s);
      finite(districtMachinePose(s));
      finite(districtMachinePose(s, true));
    }
    assert.equal(Matter.Common.nextId(), next + 1);
    assert.deepEqual(
      {
        hp: e.hp,
        state: e.state,
        timer: e.timer,
        aim: { ...e.aim },
        position: { ...e.body.position },
        velocity: { ...e.body.velocity },
        force: { ...e.body.force },
        checkpoint: g.checkpointSnapshot(),
        shots: g.shots.map((s) => ({ ...s.pos })),
      },
      before,
    );
    const s = machineBodySnapshot(e, g.time, g)!,
      at = JSON.stringify(s);
    g.setMode('paused');
    tick(g, 30);
    assert.equal(JSON.stringify(machineBodySnapshot(e, g.time, g)), at);
    const reduced = districtMachinePose(s, true),
      later = districtMachinePose({ ...s, time: s.time + 0.5 }, true);
    assert.deepEqual(reduced, later);
    assert.equal(reduced.recoil, 0);
    assert.equal(reduced.tread, 0);
    assert.equal(reduced.bank, 0);
  }
});

test('district records and pending accepted events stay bounded, expire, and release on cleanup/reset', () => {
  const { g } = fixture();
  const models = g.machineBreakdown as unknown as {
    districtMachines: Map<number, unknown>;
    districtReleases: Map<number, unknown>;
  };
  for (let n = 0; n < 140; n++) {
    const e = g.spawnEnemy(units[n % 3], 700, 400)!;
    assert(e);
    e.spawn = 0;
    g.machineBreakdown.update();
    g.hitEnemy(e, 100000, undefined, false);
    assert(!models.districtMachines.has(e.id));
    assert(!models.districtReleases.has(e.id));
    assert(models.districtMachines.size <= MACHINE_MAX_HITS);
    assert(g.machineBreakdown.wrecks.length <= MACHINE_MAX_WRECKS);
  }
  const actor = g.spawnEnemy('borer', 900, 400)!;
  actor.spawn = 0;
  g.enemyShot(actor, 0, 10, 10);
  assert(models.districtReleases.has(actor.id));
  g.time += 1 / 60;
  g.machineBreakdown.update();
  assert(!models.districtReleases.has(actor.id));
  g.hitEnemy(actor, 100000, undefined, false, true, true, 'cleanup');
  assert(!g.machineBreakdown.wrecks.some((w) => w.visual.id === actor.id));
  g.loadRoom();
  assert.equal(models.districtMachines.size, 0);
  assert.equal(models.districtReleases.size, 0);
  assert.equal(g.machineBreakdown.wrecks.length, 0);
});

test('native district physics, projectiles, audio, rewards, random stream and saves match with presentation disabled', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  for (const kind of units) {
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
    b.g.machineBreakdown.districtDischarge = () => {};
    a.g.onSound = (k) => soundsA.push(k);
    b.g.onSound = (k) => soundsB.push(k);
    a.g.onEnemyDefeated = (k) => rewardsA.push(k);
    b.g.onEnemyDefeated = (k) => rewardsB.push(k);
    for (const { g, e } of [a, b]) {
      if (kind === 'borer') g.props.spawn('crate', 760, 717);
      warn(g, e);
      for (let i = 0; i < 15; i++)
        districtMachinePose(machineBodySnapshot(e, g.time, g)!, i % 2 === 0);
      release(g, e);
      g.hitEnemy(e, 100000, { x: 500, y: 400 }, false);
      tick(g, 15);
    }
    assert.deepEqual(a.g.checkpointSnapshot(), b.g.checkpointSnapshot());
    assert.deepEqual(a.g.player.position, b.g.player.position);
    assert.deepEqual(a.g.player.velocity, b.g.player.velocity);
    assert.deepEqual(a.g.shots, b.g.shots);
    assert.deepEqual(soundsA, soundsB);
    assert.deepEqual(rewardsA, rewardsB);
    assert.equal(a.g.rng(), b.g.rng());
    assert.equal(a.g.waves.pending, b.g.waves.pending);
    assert.equal(
      Matter.Composite.allBodies(a.g.engine.world).length,
      Matter.Composite.allBodies(b.g.engine.world).length,
    );
  }
});
