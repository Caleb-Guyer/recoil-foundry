import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { type Input, type Shot } from '../src/game.ts';
import { ShiftUpgrades, SHIFT, mountPoint } from '../src/shift-upgrades.ts';
import { fixture, target, wall, round, Body, Composite } from './branches-fixture.ts';
import { getGun } from '../src/rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';

const DT = 1 / 60;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1400, y: 300 },
};
function setup(mods: string[]) {
  const g = fixture(mods),
    s = new ShiftUpgrades(g);
  Object.assign(g, { shiftUpgrades: s });
  g.time = 1;
  g.hitStop = 0;
  return { g, s };
}
function clean(g: ReturnType<typeof fixture>) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function mobile(
  g: ReturnType<typeof fixture>,
  x: number,
  y = 300,
  kind: Parameters<typeof target>[3] = 'shooter',
) {
  const e = target(g, x, y, kind);
  Body.setStatic(e.body, false);
  Body.setVelocity(e.body, { x: 0, y: 0 });
  return e;
}
function primary(
  g: ReturnType<typeof fixture>,
  s: ShiftUpgrades,
  event: number,
  extra: Partial<Shot> = {},
) {
  g.shotCount = event;
  const shot = round(g, extra);
  s.tag(shot);
  return shot;
}

test('Polarity alternates whole discharges, repels equal marks and attracts opposites without per-pellet refresh', () => {
  const { g, s } = setup(['polarity-rounds']),
    a = mobile(g, 500),
    b = mobile(g, 650);
  const shot = primary(g, s, 1);
  s.primaryHit(a, shot);
  s.primaryHit(b, shot);
  assert.equal(s.polarity.get(a.id)?.pole, 1);
  assert.equal(s.polarity.get(b.id)?.pole, 1);
  s.beforeIntegrate(DT);
  s.afterStep(DT, idle);
  assert(a.body.velocity.x < 0 && b.body.velocity.x > 0);
  const second = primary(g, s, 2);
  s.primaryHit(b, second);
  Body.setVelocity(a.body, { x: 0, y: 0 });
  Body.setVelocity(b.body, { x: 0, y: 0 });
  s.beforeIntegrate(DT);
  s.afterStep(DT, idle);
  assert(a.body.velocity.x > 0 && b.body.velocity.x < 0);
  const until = s.polarity.get(b.id)!.until;
  g.time += 0.3;
  s.primaryHit(b, second);
  assert.equal(s.polarity.get(b.id)?.until, until);
  g.time += SHIFT.polarityTime;
  s.beforeStep(DT, idle);
  assert.equal(s.polarity.size, 0);
  clean(g);
});

test('Polarity force is blocked by real cover and bosses resist without cancelling a committed attack', () => {
  const { g, s } = setup(['polarity-rounds']),
    a = mobile(g, 500),
    b = mobile(g, 650);
  s.primaryHit(a, primary(g, s, 1));
  s.primaryHit(b, primary(g, s, 2));
  const cover = wall(g, 575, 300, 20, 150);
  s.beforeIntegrate(DT);
  s.afterStep(DT, idle);
  assert.equal(a.body.velocity.x, 0);
  assert.equal(b.body.velocity.x, 0);
  Composite.remove(g.engine.world, cover);
  g.terrain = g.terrain.filter((body) => body !== cover);
  const boss = mobile(g, 800, 300, 'loader');
  boss.state = 'windup';
  boss.timer = 1.7;
  s.primaryHit(boss, primary(g, s, 3));
  s.beforeIntegrate(DT);
  s.afterStep(DT, idle);
  assert(Math.abs(boss.body.velocity.x) < Math.abs(a.body.velocity.x));
  assert.equal(boss.state, 'windup');
  assert.equal(boss.timer, 1.7);
  clean(g);
});

test('Ricochet Harness reflects a fresh real terrain collision once per discharge and preserves Wallrunner grips', () => {
  const { g, s } = setup(['ricochet-harness']),
    face = wall(g, 240, 300, 30, 200);
  Body.setVelocity(g.player, { x: 2, y: 0 });
  g.shotCount = 1;
  s.beforeStep(DT, { ...idle, fire: true });
  const delta = s.recoilDelta({ x: -1, y: 0 }, 10);
  Body.setVelocity(g.player, { x: 2 + delta.x, y: delta.y });
  Body.setPosition(g.player, { x: 212, y: 300 });
  s.beforeIntegrate(DT);
  s.afterStep(DT, idle);
  assert(g.player.velocity.x < -8);
  assert.equal(g.combatReport.snapshot().activations?.['ricochet-harness'], 1);
  const rebound = { ...g.player.velocity };
  s.beforeIntegrate(DT);
  s.afterStep(DT, idle);
  assert.deepEqual(g.player.velocity, rebound);
  g.shotCount = 2;
  g.mobility.grip = { body: face, normal: { x: -1, y: 0 }, until: g.time + 0.2 };
  s.recoilDelta({ x: -1, y: 0 }, 12);
  Body.setVelocity(g.player, { x: 0, y: -0.3 });
  s.beforeIntegrate(DT);
  s.afterStep(DT, idle);
  assert.equal(g.player.velocity.x, 0);
  assert(Math.abs(g.player.velocity.y + 0.3) < 1e-10);
  clean(g);
});

test('Spring Rivets follow native supports, place once per airtime and launch from an actually touched pad', () => {
  const { g, s } = setup(['spring-rivets']),
    support = wall(g, 500, 500, 400, 30);
  const shot = primary(g, s, 1, { pos: { x: 500, y: 482.5 } });
  s.terrainHit(shot, support, { x: 0, y: -1 });
  s.terrainHit(primary(g, s, 2, { pos: { x: 550, y: 482.5 } }), support, { x: 0, y: -1 });
  assert.equal(s.rivets.length, 1);
  Body.translate(support, { x: 30, y: 0 });
  assert.equal(mountPoint(s.rivets[0]).x, 530);
  Body.setPosition(g.player, { x: 530, y: 467 });
  Body.setVelocity(g.player, { x: 0, y: -11.6 });
  g.grounded = false;
  s.afterGround({ ...idle, jump: true, jumpHeld: true }, true);
  assert(g.player.velocity.y <= -SHIFT.rivetLaunch);
  assert.equal(s.rivets.length, 0);
  assert.equal(g.combatReport.snapshot().activations?.['spring-rivets'], 1);
  assert.equal(g.grounded, false);
  s.afterGround({ ...idle, jump: true }, false);
  assert(g.player.velocity.y <= -SHIFT.rivetLaunch);
  clean(g);
});

test('Slip Gauge earns one charge from a genuine small-round near miss and augments an owned extra jump', () => {
  const { g, s } = setup(['slip-gauge', 'double-jump']);
  const hostile = round(g, {
    friendly: false,
    pos: { x: 210, y: 267 },
    prev: { x: 190, y: 267 },
    damage: 14,
    radius: 2.5,
  });
  s.beforeIntegrate(DT);
  s.afterStep(DT, idle);
  assert(s.slipReady);
  g.jumpBuffer = 0.1;
  g.jumpAt = 0;
  g.mobility.airJumpReady = true;
  const jump = { ...idle, right: true, jump: true, jumpHeld: true };
  g.mobility.update(jump);
  const vertical = g.player.velocity.y;
  s.afterGround(jump, false);
  assert.equal(g.mobility.airJumpReady, false);
  assert(g.player.velocity.y <= vertical && vertical < -10);
  assert(g.player.velocity.x >= 8);
  assert.equal(s.slipReady, false);
  assert.equal(g.combatReport.snapshot().activations?.['slip-gauge'], 1);
  s.beforeIntegrate(DT);
  s.afterStep(DT, idle);
  assert.equal(s.slipReady, false, 'the same lingering bullet never pays twice');
  hostile.life = 0;
  round(g, {
    friendly: false,
    pos: { x: 210, y: 267 },
    prev: { x: 190, y: 267 },
    damage: 80,
    radius: 9,
  });
  s.beforeIntegrate(DT);
  s.afterStep(DT, idle);
  assert.equal(s.slipReady, false);
  clean(g);
});

function drawTrail(g: ReturnType<typeof fixture>, s: ShiftUpgrades) {
  for (let i = 0; i < 9; i++) {
    g.time += DT;
    Body.setVelocity(g.player, { x: 8, y: 0 });
    s.beforeStep(DT, { ...idle, fire: true });
    s.recoilDelta({ x: -1, y: 0 }, 2);
    Body.translate(g.player, { x: 16, y: 0 });
    s.afterStep(DT, { ...idle, fire: true });
  }
  s.beforeStep(DT, idle);
}
test('Wake Wire is drawn by real recoil travel, damages a crossing target once and expires', () => {
  const { g, s } = setup(['wake-wire']);
  drawTrail(g, s);
  assert(s.wire && s.wire.points.length <= SHIFT.wirePoints);
  assert.equal(g.combatReport.snapshot().activations?.['wake-wire'], 1);
  const e = target(g, 270, 300),
    hp = e.hp;
  s.beforeIntegrate(DT);
  s.afterStep(DT, idle);
  assert(e.hp < hp);
  const after = e.hp;
  s.beforeIntegrate(DT);
  s.afterStep(DT, idle);
  assert.equal(e.hp, after);
  g.time += SHIFT.wireTime + 0.1;
  s.beforeStep(DT, idle);
  assert.equal(s.wire, null);
  clean(g);
});

test('Wake Wire cannot hit through solid cover that moves across an already armed path', () => {
  const { g, s } = setup(['wake-wire']);
  drawTrail(g, s);
  const e = target(g, 310, 300),
    hp = e.hp;
  wall(g, 280, 300, 20, 180);
  s.beforeIntegrate(DT);
  s.afterStep(DT, idle);
  assert.equal(e.hp, hp);
  clean(g);
});

test('False Silhouette creates one real acquisition target per airtime while committed attacks and bosses ignore it', () => {
  const { g, s } = setup(['false-silhouette']);
  Body.setVelocity(g.player, { x: 8, y: 0 });
  s.beforeStep(DT, { ...idle, fire: true });
  s.recoilDelta({ x: 1, y: 0 }, 18);
  Body.setVelocity(g.player, { x: -10, y: 0 });
  s.beforeIntegrate(DT);
  s.afterStep(DT, idle);
  assert(s.silhouette);
  assert.equal(g.combatReport.snapshot().activations?.['false-silhouette'], 1);
  const e = target(g, 600, 300);
  e.workshopTarget = undefined;
  e.state = 'idle';
  assert.deepEqual(s.decoyTarget(e), { x: 200, y: 300 });
  e.state = 'windup';
  assert.equal(s.decoyTarget(e), null);
  e.state = 'idle';
  wall(g, 400, 300, 20, 200);
  assert.equal(s.decoyTarget(e), null);
  const boss = target(g, 260, 300, 'loader');
  boss.state = 'idle';
  assert.equal(s.decoyTarget(boss), null);
  g.time += SHIFT.silhouetteTime + 0.1;
  s.beforeStep(DT, idle);
  assert.equal(s.silhouette, null);
  clean(g);
});

test('Gimbal Mount changes native recoil direction while preserving each actual gun and its projectile pattern', () => {
  for (const gun of STARTING_GUN_IDS) {
    const { g, s } = setup(['gimbal-mount']);
    g.startingGun = gun;
    g.gun = getGun(g.mods, gun);
    const original = structuredClone(g.gun);
    s.beforeStep(DT, { ...idle, right: true, fire: true });
    g.fire();
    assert(g.player.velocity.x > 0);
    assert(g.shots.every((shot) => shot.vel.x > 0));
    assert.deepEqual(g.gun, original);
    assert.equal(g.shots.length, gun === 'shotgun' ? 5 : gun === 'twinbore' ? 2 : 1);
    assert.deepEqual(s.recoilDelta({ x: 0, y: 1 }, 3), { x: 3, y: 0 });
    s.beforeStep(DT, idle);
    const neutral = s.recoilDelta({ x: 0, y: 1 }, 3);
    assert(Math.abs(neutral.x) < 1e-10 && neutral.y === -3);
    clean(g);
  }
});

test('Momentum Exchange transfers bounded real velocity once per volley and never interrupts a boss tell', () => {
  const { g, s } = setup(['momentum-exchange']),
    e = mobile(g, 600);
  Body.setVelocity(g.player, { x: 12, y: -4 });
  Body.setVelocity(e.body, { x: -6, y: 0 });
  const shot = primary(g, s, 1);
  s.primaryHit(e, shot);
  s.beforeIntegrate(DT);
  assert(g.player.velocity.x < 3 && e.body.velocity.x > 4);
  assert.equal(g.combatReport.snapshot().activations?.['momentum-exchange'], 1);
  const pv = { ...g.player.velocity },
    ev = { ...e.body.velocity };
  s.primaryHit(e, primary(g, s, 1));
  assert.deepEqual(g.player.velocity, pv);
  assert.deepEqual(e.body.velocity, ev);
  g.time += 1;
  const boss = mobile(g, 800, 300, 'loader');
  boss.state = 'windup';
  boss.timer = 1.3;
  Body.setVelocity(g.player, { x: 15, y: -3 });
  s.primaryHit(boss, primary(g, s, 2));
  s.beforeIntegrate(DT);
  assert.deepEqual(g.player.velocity, { x: 15, y: -3 });
  assert(Math.abs(boss.body.velocity.x) <= 0.1000000001);
  assert.equal(boss.state, 'windup');
  assert.equal(boss.timer, 1.3);
  clean(g);
});

test('Offset Nozzle moves a whole paid discharge to one real surface and charging previews cannot consume it', () => {
  const { g, s } = setup(['offset-nozzle']),
    surface = wall(g, 500, 300, 20, 200);
  const hit = primary(g, s, 1, { pos: { x: 487.5, y: 300 } });
  s.terrainHit(hit, surface, { x: -1, y: 0 });
  assert(s.nozzle);
  const base = { x: 200, y: 297 },
    d = { x: 1, y: 0 };
  assert.deepEqual(s.origin(base, d), base);
  g.shotCount = 2;
  assert.deepEqual(s.origin(base, d, false), base);
  assert.equal(s.nozzle.used, undefined);
  const remote = s.origin(base, d);
  assert(remote.x > base.x + 250 && remote.x < surface.bounds.min.x);
  assert.deepEqual(s.origin(base, d), remote);
  const next = primary(g, s, 2, { pos: { x: remote.x, y: remote.y } });
  g.shotCount = 3;
  assert.deepEqual(s.origin(base, d), base);
  assert.equal(s.nozzle, null);
  s.terrainHit(next, surface, { x: -1, y: 0 });
  assert.equal(s.nozzle, null, 'remote fire cannot manufacture another remote muzzle');
  clean(g);
});

test('Momentum Battery stores only actual grounded recoil and releases it into one native grounded jump', () => {
  const { g, s } = setup(['momentum-battery']);
  g.grounded = true;
  for (let i = 0; i < 30; i++) {
    g.time += 0.5;
    Body.setVelocity(g.player, { x: 0, y: 0 });
    s.beforeStep(DT, { ...idle, fire: true });
    g.fire();
  }
  assert.equal(s.battery, SHIFT.batteryCap);
  Body.setVelocity(g.player, { x: 2, y: -11.6 });
  g.grounded = false;
  s.afterGround({ ...idle, jump: true, jumpHeld: true }, true);
  assert(g.player.velocity.y < -18);
  assert.equal(s.battery, 0);
  const launched = g.player.velocity.y;
  s.afterGround({ ...idle, jump: true }, false);
  assert.equal(g.player.velocity.y, launched);
  s.recoilDelta({ x: 1, y: 0 }, 20);
  assert.equal(s.battery, 0);
  clean(g);
});

test('secondary shots cannot mint marks or surfaces and paused updates cannot advance state or forces', () => {
  const ids = [
    'polarity-rounds',
    'spring-rivets',
    'offset-nozzle',
    'momentum-exchange',
    'momentum-battery',
  ];
  const { g, s } = setup(ids),
    e = mobile(g, 600),
    surface = wall(g, 800, 300, 20, 200);
  for (const extra of [{ fragment: true }, { echo: true }, { reflected: true }, { allied: true }]) {
    const shot = primary(g, s, 1, { ...extra, pos: { x: 787.5, y: 300 } });
    s.primaryHit(e, shot);
    s.terrainHit(shot, surface, { x: -1, y: 0 });
  }
  assert.equal(s.polarity.size, 0);
  assert.equal(s.rivets.length, 0);
  assert.equal(s.nozzle, null);
  g.grounded = true;
  s.recoilDelta({ x: 1, y: 0 }, 5);
  const battery = s.battery;
  g.setMode('paused');
  s.recoilDelta({ x: 1, y: 0 }, 5);
  s.beforeStep(DT, { ...idle, fire: true });
  s.beforeIntegrate(DT);
  s.afterStep(DT, idle);
  assert.equal(s.battery, battery);
  assert.deepEqual(e.body.velocity, { x: 0, y: 0 });
  s.reset();
  assert.equal(s.battery, 0);
  assert.equal(s.polarity.size, 0);
  assert.equal(s.rivets.length, 0);
  assert.equal(s.wire, null);
  assert.equal(s.nozzle, null);
  assert.equal(s.silhouette, null);
  clean(g);
});

test('without steering upgrades native high-recoil vectors remain exact rather than imposing another strength cap', () => {
  const { g, s } = setup([]);
  const aim = { x: 0.2, y: Math.sqrt(0.96) };
  const delta = s.recoilDelta(aim, 70);
  assert.equal(delta.x, -14);
  assert.equal(delta.y, -aim.y * 70);
  clean(g);
});

test('actual beam pulses keep native gun geometry and Gimbal movement across all six starting tools', () => {
  for (const gun of STARTING_GUN_IDS) {
    const { g, s } = setup(['gimbal-mount', 'cutting-torch', 'scatter']);
    g.startingGun = gun;
    g.gun = getGun(g.mods, gun);
    s.beforeStep(DT, { ...idle, right: true, fire: true });
    g.ballistics.charge(DT, true);
    g.torch.beforeStep(DT, true);
    g.torch.afterStep(DT);
    assert(g.player.velocity.x > 0);
    assert.equal(new Set(g.torch.segments.map((seg) => seg.ray ?? 0)).size, g.gun.pellets);
    assert.deepEqual(g.gun, getGun(g.mods, gun));
    clean(g);
  }
});

test('native beam impact copies retain a pulse’s takeoff state instead of earning a fresh airborne rivet per frame', () => {
  const { g, s } = setup(['spring-rivets', 'cutting-torch']);
  wall(g, 500, 300, 20, 200);
  g.grounded = true;
  s.beforeStep(DT, { ...idle, fire: true });
  g.ballistics.charge(DT, true);
  g.torch.beforeStep(DT, true);
  const pulse = g.shotCount;
  g.grounded = false;
  g.torch.afterStep(DT);
  assert.equal(s.rivets.length, 0);
  for (let i = 0; i < 20 && g.shotCount === pulse; i++) {
    g.time += DT;
    g.ballistics.charge(DT, true);
    g.torch.beforeStep(DT, true);
    g.torch.afterStep(DT);
  }
  assert(g.shotCount > pulse);
  assert.equal(s.rivets.length, 1);
  clean(g);
});

test('remote nozzle originates real native projectile volleys and beams, without splitting a volley across origins', () => {
  for (const gun of STARTING_GUN_IDS) {
    const { g, s } = setup(['offset-nozzle', 'scatter']);
    g.startingGun = gun;
    g.gun = getGun(g.mods, gun);
    const surface = wall(g, 500, 300, 20, 200);
    s.terrainHit(primary(g, s, 1, { pos: { x: 487.5, y: 300 } }), surface, { x: -1, y: 0 });
    g.shots = [];
    g.aim = { x: -100, y: 300 };
    g.fire();
    assert.equal(g.shots.length, g.gun.pellets * g.gun.lanes);
    assert(g.shots.every((shot) => shot.pos.x > 450 && shot.vel.x < 0));
    assert.equal(new Set(g.shots.map((shot) => shot.pos.x)).size, 1);
    clean(g);
  }
  const { g, s } = setup(['offset-nozzle', 'cutting-torch']);
  const surface = wall(g, 500, 300, 20, 200);
  s.terrainHit(primary(g, s, 1, { pos: { x: 487.5, y: 300 } }), surface, { x: -1, y: 0 });
  g.shots = [];
  g.aim = { x: -100, y: 300 };
  const e = target(g, 350, 300),
    hp = e.hp;
  g.ballistics.charge(DT, true);
  g.torch.beforeStep(DT, true);
  g.torch.afterStep(DT);
  assert(g.torch.segments[0].a.x > 480);
  assert(e.hp < hp, 'the remote beam must use its native collision and damage');
  clean(g);
});

function experiment(g: ReturnType<typeof fixture>, evolutions: string[]) {
  const progress: string[] = [];
  Object.assign(g, {
    shiftRun: {
      hasEvolution: (id: string) => evolutions.includes(id),
      progress: (kind: string) => progress.push(kind),
    },
  });
  return progress;
}
function rebound(g: ReturnType<typeof fixture>, s: ShiftUpgrades, event: number) {
  Body.setPosition(g.player, { x: 200, y: 300 });
  Body.setVelocity(g.player, { x: 2, y: 0 });
  g.shotCount = event;
  s.beforeStep(DT, { ...idle, fire: true });
  const delta = s.recoilDelta({ x: -1, y: 0 }, 10);
  Body.setVelocity(g.player, { x: 2 + delta.x, y: delta.y });
  Body.setPosition(g.player, { x: 212, y: 300 });
  s.afterStep(DT, idle);
}
test('Polarity and Momentum Exchange produce native displacement after ordinary AI steering, not just changed counters', () => {
  const a = setup(['polarity-rounds']),
    b = setup([]);
  const aa = mobile(a.g, 600, 300, 'flyer'),
    ab = mobile(a.g, 750, 300, 'flyer');
  const ba = mobile(b.g, 600, 300, 'flyer'),
    bb = mobile(b.g, 750, 300, 'flyer');
  a.s.primaryHit(aa, primary(a.g, a.s, 1));
  a.s.primaryHit(ab, primary(a.g, a.s, 1));
  a.g.shots = [];
  b.g.shots = [];
  for (let i = 0; i < 3; i++) {
    a.g.tick(DT, idle);
    b.g.tick(DT, idle);
  }
  assert(aa.body.position.x < ba.body.position.x - 0.1);
  assert(ab.body.position.x > bb.body.position.x + 0.1);
  clean(a.g);
  clean(b.g);
  const x = setup(['momentum-exchange']),
    e = mobile(x.g, 600, 300, 'flyer');
  Body.setVelocity(x.g.player, { x: 15, y: -3 });
  x.s.primaryHit(e, primary(x.g, x.s, 1));
  x.g.shots = [];
  const start = e.body.position.x;
  x.g.tick(DT, idle);
  assert(e.body.position.x > start + 3);
  clean(x.g);
});

test('Field Experiment Double Return earns two physical rebounds per discharge and never a third', () => {
  const { g, s } = setup(['ricochet-harness']),
    progress = experiment(g, ['double-return']);
  wall(g, 240, 300, 30, 200);
  wall(g, 100, 300, 30, 200);
  rebound(g, s, 1);
  assert(g.player.velocity.x < 0);
  g.time += 0.05;
  Body.setPosition(g.player, { x: 128, y: 300 });
  s.beforeStep(DT, idle);
  s.afterStep(DT, idle);
  assert(g.player.velocity.x > 0);
  g.time += 0.05;
  Body.setPosition(g.player, { x: 212, y: 300 });
  s.beforeStep(DT, idle);
  s.afterStep(DT, idle);
  assert(g.player.velocity.x > 0, 'the third wall contact cannot refund another rebound');
  assert.deepEqual(progress, ['rebound', 'rebound']);
  clean(g);
});

test('Field Experiment Impact Echo damages exposed ordinary targets with a real finite cooldown and cover boundary', () => {
  const { g, s } = setup(['ricochet-harness']),
    progress = experiment(g, ['impact-echo']);
  wall(g, 240, 300, 30, 200);
  const exposed = target(g, 190, 360),
    hidden = target(g, 280, 300),
    boss = target(g, 180, 300, 'loader');
  const hp = exposed.hp;
  rebound(g, s, 1);
  assert(exposed.hp < hp);
  assert.equal(hidden.hp, hidden.maxHp);
  assert.equal(boss.hp, boss.maxHp);
  const once = exposed.hp;
  g.time += 0.1;
  rebound(g, s, 2);
  assert.equal(exposed.hp, once);
  assert.deepEqual(progress, ['rebound', 'rebound']);
  clean(g);
});

test('Field Experiment spring outcomes expand real mounts or strengthen the actual consumed launch', () => {
  for (const evolution of ['twin-mounts', 'loaded-spring']) {
    const { g, s } = setup(['spring-rivets']),
      progress = experiment(g, [evolution]);
    const support = wall(g, 500, 500, 500, 30);
    for (let i = 0; i < 5; i++) {
      g.grounded = true;
      s.afterGround(idle, false);
      g.grounded = false;
      s.terrainHit(primary(g, s, i + 1, { pos: { x: 400 + i * 40, y: 482.5 } }), support, {
        x: 0,
        y: -1,
      });
    }
    assert.equal(s.rivets.length, evolution === 'twin-mounts' ? 4 : 2);
    const pad = s.rivets.at(-1)!,
      point = mountPoint(pad);
    Body.setPosition(g.player, { x: point.x, y: point.y - 18 });
    Body.setVelocity(g.player, { x: 0, y: -11.6 });
    s.afterGround({ ...idle, jump: true, jumpHeld: true }, true);
    assert(g.player.velocity.y <= (evolution === 'loaded-spring' ? -19 : -16));
    assert.deepEqual(progress, ['pad']);
    clean(g);
  }
});

test('Field Experiment Deep Reserve holds two separately earned grazes and spends exactly one per real burst', () => {
  const { g, s } = setup(['slip-gauge']),
    progress = experiment(g, ['deep-reserve']);
  for (let i = 0; i < 2; i++) {
    round(g, {
      friendly: false,
      pos: { x: 210, y: 267 },
      prev: { x: 190, y: 267 },
      damage: 14,
      radius: 2.5,
    });
    s.afterStep(DT, idle);
  }
  assert.equal(s.slipCharges, 2);
  s.afterGround({ ...idle, jump: true, right: true }, false);
  assert.equal(s.slipCharges, 1);
  g.time += DT;
  s.afterGround({ ...idle, jump: true, left: true }, false);
  assert.equal(s.slipCharges, 0);
  assert.deepEqual(progress, ['slip', 'slip']);
  clean(g);
});

test('Field Experiment Counterstep fires one native short shot that hurts a target without minting primary procs', () => {
  const { g, s } = setup(['slip-gauge', 'polarity-rounds', 'spring-rivets', 'offset-nozzle']);
  const progress = experiment(g, ['counterstep']);
  round(g, {
    friendly: false,
    pos: { x: 210, y: 267 },
    prev: { x: 190, y: 267 },
    damage: 14,
    radius: 2.5,
  });
  s.afterStep(DT, idle);
  const e = target(g, 270, 300),
    hp = e.hp;
  s.afterGround({ ...idle, jump: true, right: true }, false);
  const shots = g.shots.filter((shot) => shot.friendly);
  assert.equal(shots.length, 1);
  assert(shots[0].fragment && shots[0].life <= 0.22 && shots[0].damage <= 45);
  for (let i = 0; i < 4; i++) {
    g.time += DT;
    g.updateShots(DT);
  }
  assert(e.hp < hp);
  assert.equal(s.polarity.size, 0);
  assert.equal(s.rivets.length, 0);
  assert.equal(s.nozzle, null);
  assert.deepEqual(progress, ['slip']);
  clean(g);
});

test('False Silhouette responds to an actual unmodified native recoil reversal on every starting tool', () => {
  for (const gun of STARTING_GUN_IDS) {
    const { g, s } = setup(['false-silhouette']);
    g.startingGun = gun;
    g.gun = getGun(g.mods, gun);
    Body.setVelocity(g.player, { x: g.gun.recoil * 0.5, y: 0 });
    g.tick(DT, { ...idle, fire: true });
    assert(g.shotCount > 0, `${gun}: native gun fired`);
    assert(g.player.velocity.x < 0, `${gun}: the paid kick reversed flight`);
    assert(s.silhouette, `${gun}: stock recoil can leave a decoy without a Kick prerequisite`);
    assert(s.silhouette.until <= g.time + SHIFT.silhouetteTime);
    clean(g);
  }
});

test('False Silhouette rejects ordinary steering and recoil that did not itself reverse flight', () => {
  const { g, s } = setup(['false-silhouette']);
  Body.setVelocity(g.player, { x: -g.gun.recoil * 0.5, y: 0 });
  g.tick(DT, { ...idle, fire: true });
  assert(g.shotCount > 0);
  assert.equal(s.silhouette, null, 'a kick along existing flight creates no decoy');
  g.setMode('paused');
  g.setMode('playing');
  for (let frame = 0; frame < 90; frame++)
    g.tick(DT, { ...idle, left: frame < 45, right: frame >= 45 });
  assert.equal(
    s.silhouette,
    null,
    'walking inputs without a fresh reversing discharge create no decoy',
  );
  clean(g);
});
