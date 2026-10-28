import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import type { Level } from '../src/levels.ts';
import { ENEMY_STATS, enemyShielded } from '../src/enemies.ts';
import { getGun } from '../src/rules.ts';
import { MACHINE_VARIANTS, type MachineVariant, type PatrolKind } from '../src/patrol-machines.ts';
import { machineAngles, machineTell } from '../src/patrol-machine-system.ts';
import { machineBodySnapshot, machinePose, isMachineKind } from '../src/machine-breakdown-pose.ts';
import {
  machineLanding,
  MACHINE_MAX_HITS,
  MACHINE_MAX_HITS_PER_ENEMY,
  MACHINE_MAX_WRECKS,
} from '../src/machine-breakdown.ts';
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1500, y: 500 },
};
const level: Level = {
  id: 'heavy-machine-native',
  name: 'Native heavy machines',
  area: 'cooling',
  boss: false,
  mirrored: false,
  solids: [{ x: 1100, y: 500, w: 350, h: 22 }],
  spawns: [{ kind: 'shooter', x: 1850, y: 724 }],
  route: [],
  setpiece: { rosters: [[0]], weak: [], props: [] },
  hazards: [],
  vents: [],
  fans: [],
  coolant: [],
  counterweights: [],
};
function fixture(gun: 'pistol' | 'shotgun' = 'pistol') {
  const g = new Game(),
    cp = {
      version: 6 as const,
      seed: 'RF-C108-HEAVYMODEL',
      stage: 8,
      startingGun: gun,
      hp: 100,
      mods: [],
      kills: 0,
      elapsed: 0,
    };
  g.start(cp.seed, cp, null, { ...cp, rematchRoom: structuredClone(level) });
  for (const e of g.enemies) e.spawn = 0;
  Matter.Body.setPosition(g.player, { x: 200, y: 722 });
  return g;
}
function enemy(
  g: Game,
  kind: PatrolKind,
  variant?: MachineVariant,
  x = 500,
  y = 740 - ENEMY_STATS[kind].h / 2,
) {
  const e = g.spawnEnemy(kind, x, y, undefined, undefined, undefined, undefined, variant)!;
  assert(e);
  e.spawn = 0;
  return e;
}
function plain(value: unknown) {
  if (value === null || typeof value !== 'object') return;
  assert(
    Object.getPrototypeOf(value) === Object.prototype || Array.isArray(value),
    'only detached plain presentation data',
  );
  for (const v of Object.values(value)) plain(v);
}
function tick(g: Game, n = 1) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, idle);
}
function warn(g: Game, e: Enemy) {
  e.timer = 0;
  g.patrolMachines.updateEnemy(e);
  assert.equal(e.state, 'windup');
  assert.equal(e.timer, machineTell(e));
  g.machineBreakdown.update();
}
function release(g: Game, e: Enemy) {
  e.timer = 0;
  g.patrolMachines.updateEnemy(e);
  g.machineBreakdown.update();
}
function kill(g: Game, e: Enemy) {
  g.hitEnemy(e, 100000, undefined, false);
  const w = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id);
  assert(w);
  return w;
}
const variants: { kind: PatrolKind; variant?: MachineVariant }[] = [
  { kind: 'shutter' },
  { kind: 'strider' },
  { kind: 'mortar' },
  ...Object.entries(MACHINE_VARIANTS).map(([variant, v]) => ({
    kind: v.kind,
    variant: variant as MachineVariant,
  })),
];

test('heavy snapshot extends eligibility without adding patrol data or changing the six existing chassis projections', () => {
  const g = fixture();
  for (const kind of ['runner', 'shooter', 'flyer', 'charger', 'hopper', 'sniper'] as const) {
    const e = g.spawnEnemy(kind, 500, 400)!;
    e.spawn = 0;
    const s = machineBodySnapshot(e, g.time, g)!;
    assert.equal(s.patrol, undefined);
    assert.equal(s.kind, kind);
    assert.equal(s.hull.x > 0, true);
    assert.equal(machinePose(s).kind, kind);
    plain(s);
  }
  for (const kind of ['shutter', 'strider', 'mortar']) assert(isMachineKind(kind));
  assert.equal(isMachineKind('interceptor'), false);
  assert.equal(isMachineKind('loader'), false);
});

test('Shutter frontal armor, rear damage and the real .35 opening gate stay separate from .4 aim lock', () => {
  const g = fixture(),
    e = enemy(g, 'shutter');
  e.facing = 1;
  const hp = e.hp;
  assert.equal(machineBodySnapshot(e, g.time, g)!.patrol!.closed, true);
  assert.equal(g.hitEnemy(e, 10, { x: 700, y: 720 }, false), true);
  let h = g.machineBreakdown.getHits(e.id).at(-1)!;
  assert.equal(e.hp, hp - 3);
  assert.equal(h.blocked, true);
  assert.equal(h.incoming, 10);
  assert.equal(h.applied, 3);
  assert.equal(h.healthLost, 3);
  assert.equal(h.absorbed, 7);
  assert.equal(machineBodySnapshot(e, g.time, g)!.patrol!.shieldFlash, 0.14);
  assert(h.contact && h.contact.local.x > 0 && h.contact.normal.x > 0.9);
  g.hitEnemy(e, 10, { x: 300, y: 720 }, false);
  h = g.machineBreakdown.getHits(e.id).at(-1)!;
  assert.equal(e.hp, hp - 13);
  assert.equal(h.blocked, false);
  assert.equal(h.healthLost, 10);
  assert.equal(h.absorbed, 0);
  for (const state of ['windup', 'followup'] as const) {
    e.state = state;
    e.timer = 0.4;
    assert.equal(
      machineBodySnapshot(e, g.time, g)!.patrol!.closed,
      true,
      'locked aim is still armored for .05 seconds',
    );
    e.timer = 0.35;
    assert.equal(enemyShielded(e, { x: -1, y: 0 }), false);
    assert.equal(machineBodySnapshot(e, g.time, g)!.patrol!.closed, false);
    const before = e.hp;
    g.hitEnemy(e, 10, { x: 700, y: 720 }, false);
    assert.equal(
      e.hp,
      before - 10,
      'open plate gives ordinary full damage, no invented weakspot bonus',
    );
  }
  e.state = 'recover';
  e.timer = 1.3;
  assert.equal(machineBodySnapshot(e, g.time, g)!.patrol!.closed, false);
});

for (const { kind, variant } of variants)
  test(`${variant ?? kind} real native attack and pre-lethal snapshot keep exact variant, aim and outcomes`, () => {
    const g = fixture(),
      e = enemy(g, kind, variant);
    warn(g, e);
    const s = machineBodySnapshot(e, g.time, g)!,
      p = s.patrol!;
    assert.equal(p.variant, variant);
    assert.deepEqual(p.home, e.patrol!.home);
    assert.equal(p.walk, e.patrol!.walk);
    assert.equal(p.turnAt, e.patrol!.turnAt);
    assert.deepEqual(p.angles, machineAngles(e));
    assert.equal(p.tell, machineTell(e));
    assert.equal(p.recoveryEnteredAt, null);
    assert.equal(p.dischargeAt, null);
    assert.equal(p.grounded, true);
    assert.equal(p.supportY, 740);
    const planned = structuredClone(p.arcs),
      angles = [...p.angles];
    const bodyCount = Matter.Composite.allBodies(g.engine.world).length;
    g.time = 0.5;
    release(g, e);
    if (variant === 'shutter-burst') {
      assert.equal(e.state, 'followup');
      assert.equal(e.timer, 0.95);
      assert.equal(e.attacks, 0);
      assert.equal(g.shots.length, 1);
      assert.equal(g.machineBreakdown.getPatrol(e)!.recoveryEnteredAt, null);
      assert.equal(g.machineBreakdown.getPatrol(e)!.dischargeAt, 0.5);
      g.time = 1.45;
      release(g, e);
    }
    assert.equal(e.state, 'recover');
    assert.equal(e.attacks, 1);
    const fired = machineBodySnapshot(e, g.time, g)!.patrol!;
    assert.equal(fired.recoveryEnteredAt, g.time);
    assert.equal(fired.dischargeAt, g.time);
    assert.equal(e.timer, kind === 'mortar' ? 2.7 : variant === 'shutter-burst' ? 1.6 : 1.3);
    if (kind === 'mortar') {
      assert.equal(g.shots.length, 0);
      assert.deepEqual(fired.arcs, []);
      assert.equal(fired.shells.length, planned.length);
      assert.deepEqual(
        fired.shells.map((s) => s.arc),
        planned,
      );
      assert.deepEqual(fired.releaseArcs, planned);
      for (const shell of fired.shells) {
        assert.deepEqual(shell.pos, shell.arc.from);
        assert.equal(shell.age, 0);
      }
    } else {
      const count = variant === 'shutter-burst' ? 2 : angles.length;
      assert.equal(g.shots.length, count);
      for (const [i, shot] of g.shots.entries()) {
        const a = angles[variant === 'shutter-burst' ? 0 : i];
        const speed = Math.hypot(shot.vel.x, shot.vel.y);
        assert(Math.abs(shot.vel.x / speed - Math.cos(a)) < 1e-9);
        assert(Math.abs(shot.vel.y / speed - Math.sin(a)) < 1e-9);
        assert.equal(shot.damage, 15);
        assert.equal(shot.friendly, false);
      }
      assert.deepEqual(fired.shells, []);
      assert.deepEqual(fired.releaseArcs, []);
    }
    const before = e.hp,
      native = {
        timer: e.timer,
        aim: { ...e.aim },
        velocity: { ...e.body.velocity },
        attacks: e.attacks,
      };
    g.hitEnemy(e, 10, { x: 200, y: e.body.position.y }, false);
    const hit = g.machineBreakdown.getHits(e.id).at(-1)!;
    assert.equal(e.hp, before - 10);
    assert.equal(hit.healthLost, 10);
    assert.equal(hit.blocked, false);
    const w = kill(g, e);
    assert.equal(w.visual.kind, kind);
    assert.equal(w.visual.patrol!.variant, variant);
    assert.equal(w.visual.hp, before - 10);
    assert.equal(w.visual.state, 'recover');
    assert.equal(w.visual.timer, native.timer);
    assert.deepEqual(w.visual.aim, native.aim);
    assert.deepEqual(w.visual.velocity, native.velocity);
    assert.equal(w.visual.attacks, native.attacks);
    assert.equal(w.hit!.healthLost, before - 10);
    assert.equal(w.hit!.applied, 100000);
    assert.equal(w.hit!.absorbed, 0);
    assert(!g.enemies.includes(e));
    assert(!Matter.Composite.allBodies(g.engine.world).includes(e.body));
    assert.equal(Matter.Composite.allBodies(g.engine.world).length, bodyCount - 1);
    assert.equal(
      g.patrolMachines.shells.filter((s) => s.owner === e.id).length,
      0,
      'native defeat still cancels owned shells',
    );
    if (kind === 'mortar')
      assert.deepEqual(
        w.visual.patrol!.releaseArcs,
        planned,
        'capture precedes native shell removal',
      );
    assert.equal(g.machineBreakdown.getPatrol(e), null);
    plain(w);
  });

test('Cycle Shutter observes both real shot times, retains the first through followup/Pause, and clears after native recovery', () => {
  const g = fixture(),
    e = enemy(g, 'shutter', 'shutter-burst');
  warn(g, e);
  g.time = 0.25;
  release(g, e);
  assert.equal(g.shots.length, 1);
  assert.equal(e.state, 'followup');
  assert.equal(machineBodySnapshot(e, g.time, g)!.patrol!.dischargeAt, 0.25);
  g.time = 0.35;
  e.timer = 0.85;
  g.machineBreakdown.update();
  const saved = g.machineBreakdown.getPatrol(e)!;
  assert.equal(saved.dischargeAt, 0.25);
  saved.dischargeAt = -1;
  assert.equal(
    g.machineBreakdown.getPatrol(e)!.dischargeAt,
    0.25,
    'observation accessor is detached',
  );
  g.setMode('paused');
  tick(g, 30);
  g.machineBreakdown.update();
  assert.equal(g.time, 0.35);
  assert.equal(g.machineBreakdown.getPatrol(e)!.dischargeAt, 0.25);
  g.setMode('playing');
  g.time = 1.2;
  release(g, e);
  assert.equal(g.shots.length, 2);
  assert.equal(e.state, 'recover');
  assert.equal(g.machineBreakdown.getPatrol(e)!.dischargeAt, 1.2);
  assert.equal(g.machineBreakdown.getPatrol(e)!.recoveryEnteredAt, 1.2);
  e.timer = 0;
  g.patrolMachines.updateEnemy(e);
  g.machineBreakdown.update();
  assert.equal(e.state, 'idle');
  assert.equal(g.machineBreakdown.getPatrol(e)!.dischargeAt, null);
  const late = fixture(),
    unknown = enemy(late, 'shutter', 'shutter-burst');
  unknown.state = 'windup';
  unknown.timer = 0;
  late.patrolMachines.updateEnemy(unknown);
  assert.equal(unknown.state, 'followup');
  assert.equal(late.shots.length, 1);
  late.machineBreakdown.update();
  assert.equal(
    machineBodySnapshot(unknown, late.time, late)!.patrol!.dischargeAt,
    null,
    'late observation does not invent when a real shot fired',
  );
});

test('Mortar snapshot follows native track/lock, copies actual shells and retains only real release arcs through recovery', () => {
  const g = fixture(),
    e = enemy(g, 'mortar', 'mortar-twin');
  warn(g, e);
  const first = machineBodySnapshot(e, g.time, g)!.patrol!;
  Matter.Body.setPosition(g.player, { x: 350, y: 722 });
  e.timer = 0.7;
  g.patrolMachines.updateEnemy(e);
  const tracked = structuredClone(e.patrol!.arcs);
  assert.notDeepEqual(tracked, first.arcs);
  Matter.Body.setPosition(g.player, { x: 900, y: 722 });
  e.timer = 0.4;
  g.patrolMachines.updateEnemy(e);
  assert.deepEqual(e.patrol!.arcs, tracked, 'real aim lock retains old target');
  first.home.x = -999;
  first.arcs[0].from.x = -999;
  first.arcs[0].to.x = -999;
  assert.notEqual(e.patrol!.home.x, -999);
  assert.notEqual(e.patrol!.arcs[0].from.x, -999);
  assert.notEqual(e.patrol!.arcs[0].to.x, -999);
  g.time = 1;
  release(g, e);
  const fired = machineBodySnapshot(e, g.time, g)!.patrol!;
  fired.shells[0].arc.to.x = -555;
  fired.shells[0].pos.x = -555;
  fired.releaseArcs[0].from.x = -555;
  assert.notEqual(g.patrolMachines.shells[0].arc.to.x, -555);
  assert.notEqual(g.patrolMachines.shells[0].pos.x, -555);
  assert.notEqual(g.machineBreakdown.getPatrol(e)!.releaseArcs[0].from.x, -555);
  g.time += 0.25;
  g.patrolMachines.tick(0.25);
  const shell = g.patrolMachines.shells[0];
  g.patrolMachines.trace(
    { x: shell.pos.x, y: shell.pos.y - 2 },
    { x: shell.pos.x, y: shell.pos.y + 2 },
    3,
    10,
  );
  assert.equal(g.patrolMachines.shells.length, 1, 'real shells remain shootable');
  g.time += 0.2;
  e.timer -= 0.2;
  g.machineBreakdown.update();
  const after = machineBodySnapshot(e, g.time, g)!.patrol!;
  assert.equal(after.shells.length, 1);
  assert.deepEqual(after.releaseArcs, tracked);
  assert.equal(after.recoveryEnteredAt, 1);
  assert.equal(after.dischargeAt, 1);
  e.timer = 0;
  g.patrolMachines.updateEnemy(e);
  g.machineBreakdown.update();
  assert.equal(e.state, 'idle');
  assert.deepEqual(g.machineBreakdown.getPatrol(e)!.releaseArcs, []);
  assert.equal(machineBodySnapshot(e, g.time)!.patrol!.recoveryEnteredAt, null);
  assert.deepEqual(machineBodySnapshot(e, g.time)!.patrol!.shells, []);
});

test('a cap-rejected native Mortar release and late-observed recoveries never invent a shell or release history', () => {
  const g = fixture();
  for (let i = 0; i < 6; i++) {
    const e = enemy(g, 'mortar', 'mortar-twin', 500 + i * 60);
    // Enter the real native planner at its warning state; no synthetic arcs or shells.
    e.state = 'windup';
    e.timer = 1.2;
    g.patrolMachines.updateEnemy(e);
    g.machineBreakdown.update();
    release(g, e);
  }
  assert.equal(g.patrolMachines.shells.length, 12);
  const blocked = enemy(g, 'mortar');
  blocked.state = 'windup';
  blocked.timer = 1.2;
  g.patrolMachines.updateEnemy(blocked);
  assert.equal(blocked.patrol!.arcs.length, 1);
  g.machineBreakdown.update();
  release(g, blocked);
  const p = machineBodySnapshot(blocked, g.time, g)!.patrol!;
  assert.equal(blocked.state, 'recover');
  assert.equal(p.recoveryEnteredAt, g.time);
  assert.equal(p.dischargeAt, null);
  assert.deepEqual(p.shells, []);
  assert.deepEqual(p.releaseArcs, []);
  const fresh = fixture(),
    e = enemy(fresh, 'mortar');
  e.state = 'windup';
  e.timer = 1.2;
  fresh.patrolMachines.updateEnemy(e);
  e.timer = 0;
  fresh.patrolMachines.updateEnemy(e);
  fresh.machineBreakdown.update();
  const late = machineBodySnapshot(e, fresh.time, fresh)!.patrol!;
  assert.equal(late.shells.length, 1);
  assert.equal(late.recoveryEnteredAt, null);
  assert.equal(late.dischargeAt, null);
  assert.deepEqual(late.releaseArcs, []);
});

for (const kind of ['shutter', 'strider', 'mortar'] as const)
  test(`${kind} native raised/overhead/moving support projection never becomes a body or assumed floor`, () => {
    const g = fixture(),
      high = enemy(g, kind, undefined, 1250, 350),
      low = enemy(g, kind, undefined, 1250, 600);
    assert.equal(machineLanding(g, machineBodySnapshot(high, 0, g)!)!.point.y, 500);
    assert.equal(machineLanding(g, machineBodySnapshot(low, 0, g)!)!.point.y, 740);
    const crate = g.props.spawn('crate', 400, 600),
      e = enemy(g, kind, undefined, 400, 350),
      w = kill(g, e);
    assert.equal(w.landing!.bodyId, crate.body.id);
    const old = { ...w.landing!.point },
      bodies = Matter.Composite.allBodies(g.engine.world).length;
    Matter.Body.translate(crate.body, { x: 8, y: -4 });
    g.time = 0.02;
    g.machineBreakdown.update();
    assert.deepEqual(w.landing!.point, { x: old.x + 8, y: old.y - 4 });
    assert.equal(Matter.Composite.allBodies(g.engine.world).length, bodies);
    g.props.remove(crate);
    g.time = 0.04;
    g.machineBreakdown.update();
    assert.equal(w.landing!.available, false);
    assert(w.lifetime < 0.3);
  });

test('actual shotgun volleys and fitted Piston Lance rounds still use bounded native heavy hit/death outcomes', () => {
  const volley = fixture('shotgun');
  Matter.Body.setPosition(volley.player, { x: 200, y: 400 });
  volley.aim = { x: 1000, y: 400 };
  const strider = enemy(volley, 'strider', 'strider-volley', 390, 400);
  strider.hp = strider.maxHp = 500;
  volley.fire();
  assert(volley.shots.length > 1);
  for (let i = 0; i < 24; i++) {
    volley.time += 1 / 60;
    volley.updateShots(1 / 60);
  }
  assert(strider.hp < 500);
  assert(volley.machineBreakdown.getHits(strider.id).length <= MACHINE_MAX_HITS_PER_ENEMY);
  assert(
    volley.machineBreakdown
      .getHits(strider.id)
      .every((h) => h.kind === 'strider' && h.healthLost > 0 && h.contact),
  );
  const g = fixture();
  g.applyJobRefit(['piston-lance']);
  g.gun = getGun(g.mods);
  Matter.Body.setPosition(g.player, { x: 200, y: 400 });
  const mortar = enemy(g, 'mortar', 'mortar-slow', 390, 400);
  mortar.hp = 1;
  const before = g.kills;
  g.addShot({
    pos: { x: 300, y: 400 },
    vel: { x: 24, y: 0 },
    damage: g.gun.damage,
    life: 1.4,
    friendly: true,
    radius: 2.5,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
  for (let i = 0; i < 30 && mortar.hp > 0; i++) {
    g.time += 1 / 60;
    g.updateShots(1 / 60);
  }
  assert(mortar.hp <= 0);
  assert.equal(g.kills, before + 1);
  assert.equal(g.clear, false);
  assert.equal(
    g.machineBreakdown.wrecks.find((w) => w.visual.id === mortar.id)!.visual.patrol!.variant,
    'mortar-slow',
  );
});

test('real allied heavy deaths retain native identity without friendly kill credit', () => {
  for (const kind of ['shutter', 'strider', 'mortar'] as const) {
    const g = fixture(),
      e = g.factions.spawn(kind, { x: 600, y: 400 })!;
    e.spawn = 0;
    e.hp = 3;
    const kills = g.kills;
    g.addShot({
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
    g.time += 1 / 60;
    g.updateShots(1 / 60);
    assert(e.hp <= 0);
    assert(!g.factions.allies.includes(e));
    assert.equal(g.kills, kills);
    const w = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id)!;
    assert(w.visual.allied);
    assert.equal(w.visual.kind, kind);
    assert(w.visual.patrol);
    assert.equal(w.hit!.healthLost, 3);
    plain(w);
  }
});

test('heavy cleanup/dummy/cinema guards, live-hit and wreck caps, pause/results and room/title reset preserve presentation bounds', () => {
  const g = fixture();
  for (const kind of ['shutter', 'strider', 'mortar'] as const) {
    const clean = enemy(g, kind);
    g.hitEnemy(clean, 100000, undefined, false, true, true, 'cleanup');
    const dummy = enemy(g, kind);
    dummy.workshopTarget = 'standard' as any;
    g.hitEnemy(dummy, 100000, undefined, false);
    const spawning = enemy(g, kind);
    spawning.spawn = 1;
    g.hitEnemy(spawning, 100000, undefined, false);
  }
  assert.equal(g.machineBreakdown.wrecks.length, 0);
  const cinema = new Game();
  cinema.startTest({
    version: 6,
    seed: 'RF-C108-HEAVYCINEMA',
    stage: 19,
    hp: 100,
    mods: [],
    kills: 0,
    elapsed: 0,
  });
  assert(cinema.finale.cinema?.active);
  for (const kind of ['shutter', 'strider', 'mortar'] as const)
    killExcluded(cinema, enemy(cinema, kind));
  function killExcluded(game: Game, e: Enemy) {
    game.hitEnemy(e, 100000, undefined, false);
    assert.equal(game.machineBreakdown.wrecks.length, 0);
  }
  const target = enemy(g, 'shutter');
  target.hp = target.maxHp = 1e8;
  for (let i = 0; i < 300; i++) g.hitEnemy(target, 0.01, { x: 300, y: 720 }, false);
  assert.equal(g.machineBreakdown.getHits(target.id).length, MACHINE_MAX_HITS_PER_ENEMY);
  assert(g.machineBreakdown.diagnostics.hits <= MACHINE_MAX_HITS);
  const bodies = Matter.Composite.allBodies(g.engine.world).length;
  for (let i = 0; i < 160; i++) {
    kill(g, enemy(g, (['shutter', 'strider', 'mortar'] as const)[i % 3]));
    assert(g.machineBreakdown.wrecks.length <= MACHINE_MAX_WRECKS);
  }
  assert.equal(Matter.Composite.allBodies(g.engine.world).length, bodies);
  const frozen = JSON.stringify(g.machineBreakdown.wrecks);
  for (const mode of ['paused', 'dead', 'won'] as const) {
    g.setMode(mode);
    tick(g, 30);
    g.machineBreakdown.update();
    assert.equal(JSON.stringify(g.machineBreakdown.wrecks), frozen);
  }
  g.setMode('playing');
  g.time += 3;
  g.machineBreakdown.update();
  assert.equal(g.machineBreakdown.wrecks.length, 0);
  g.machineBreakdown.update();
  assert(g.machineBreakdown.getPatrol(target));
  g.loadRoom();
  assert.equal(g.machineBreakdown.getPatrol(target), null);
  assert.equal(g.machineBreakdown.diagnostics.hits, 0);
  kill(g, enemy(g, 'strider'));
  g.setMode('title');
  assert.equal(g.machineBreakdown.wrecks.length, 0);
});

test('snapshot reads allocate no Matter bodies and leave native HP, AI, collision hulls, RNG, rewards, audio and checkpoint unchanged', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  const a = fixture(),
    b = fixture();
  b.machineBreakdown.beforeHit = () => null;
  b.machineBreakdown.hit = () => {};
  b.machineBreakdown.defeated = () => {};
  b.machineBreakdown.update = () => {};
  const soundsA: string[] = [],
    soundsB: string[] = [],
    rewardsA: string[] = [],
    rewardsB: string[] = [];
  a.onSound = (k) => soundsA.push(k);
  b.onSound = (k) => soundsB.push(k);
  a.onEnemyDefeated = (k) => rewardsA.push(k);
  b.onEnemyDefeated = (k) => rewardsB.push(k);
  for (const { kind, variant } of variants) {
    const x = enemy(a, kind, variant),
      y = enemy(b, kind, variant);
    warn(a, x);
    warn(b, y);
    const before = {
      hp: x.hp,
      state: x.state,
      timer: x.timer,
      aim: { ...x.aim },
      patrol: structuredClone(x.patrol),
      position: { ...x.body.position },
      velocity: { ...x.body.velocity },
      vertices: x.body.vertices.map((v) => ({ x: v.x, y: v.y })),
    };
    const next = Matter.Common.nextId;
    let allocated = 0;
    const mock = t.mock.method(Matter.Common, 'nextId', () => {
      allocated++;
      return next();
    });
    for (let i = 0; i < 30; i++) machinePose(machineBodySnapshot(x, a.time, a)!, i % 2 === 0);
    mock.mock.restore();
    assert.equal(allocated, 0);
    assert.deepEqual(
      {
        hp: x.hp,
        state: x.state,
        timer: x.timer,
        aim: { ...x.aim },
        patrol: structuredClone(x.patrol),
        position: { ...x.body.position },
        velocity: { ...x.body.velocity },
        vertices: x.body.vertices.map((v) => ({ x: v.x, y: v.y })),
      },
      before,
    );
    release(a, x);
    release(b, y);
    if (variant === 'shutter-burst') {
      release(a, x);
      release(b, y);
    }
    assert.deepEqual(a.shots, b.shots);
    assert.deepEqual(a.patrolMachines.shells, b.patrolMachines.shells);
    for (const damage of [10, 100000]) {
      a.hitEnemy(x, damage, { x: 200, y: x.body.position.y });
      b.hitEnemy(y, damage, { x: 200, y: y.body.position.y });
    }
  }
  tick(a, 25);
  tick(b, 25);
  assert.deepEqual(a.checkpointSnapshot(), b.checkpointSnapshot());
  assert.deepEqual(a.player.position, b.player.position);
  assert.deepEqual(a.player.velocity, b.player.velocity);
  assert.deepEqual(soundsA, soundsB);
  assert.deepEqual(rewardsA, rewardsB);
  assert.equal(a.rng(), b.rng());
  assert.equal(a.waves.pending, b.waves.pending);
  assert.equal(a.enemies.length, b.enemies.length);
  assert.equal(
    Matter.Composite.allBodies(a.engine.world).length,
    Matter.Composite.allBodies(b.engine.world).length,
  );
});
