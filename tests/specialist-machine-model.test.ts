import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import type { Level } from '../src/levels.ts';
import { getGun } from '../src/rules.ts';
import { machineBodySnapshot } from '../src/machine-breakdown-pose.ts';
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
  aim: { x: 1600, y: 400 },
};
const level: Level = {
  id: 'specialist-machine-native',
  name: 'Native specialist machines',
  area: 'cooling',
  boss: false,
  mirrored: false,
  solids: [
    { x: 800, y: 600, w: 100, h: 140 },
    { x: 1100, y: 500, w: 350, h: 22 },
  ],
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
  const g = new Game();
  const cp = {
    version: 6 as const,
    seed: 'RF-C108-SPECIALISTS',
    stage: 8,
    startingGun: gun,
    hp: 100,
    mods: [],
    kills: 0,
    elapsed: 0,
  };
  g.start(cp.seed, cp, null, { ...cp, rematchRoom: structuredClone(level) });
  for (const e of g.enemies) e.spawn = 0;
  return g;
}
function enemy(
  g: Game,
  kind: 'charger' | 'hopper' | 'sniper',
  x = 500,
  y = 724,
  elite?: Enemy['elite'],
) {
  const e = g.spawnEnemy(kind, x, y, elite)!;
  assert(e);
  e.spawn = 0;
  return e;
}
function tick(g: Game, n = 1, input: Input = idle) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, input);
}
function plain(value: unknown) {
  if (value === null || typeof value !== 'object') return;
  assert(Object.getPrototypeOf(value) === Object.prototype || Array.isArray(value));
  for (const v of Object.values(value)) plain(v);
}
function kill(g: Game, e: Enemy) {
  g.hitEnemy(e, 100000, undefined, false);
  const w = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id);
  assert(w);
  return w;
}
function crash(g: Game, e: Enemy) {
  e.state = 'rush';
  e.timer = 0.4;
  e.aim = { x: 1, y: 0 };
  g.machineBreakdown.update();
  g.updateCharger(e);
  assert.equal(e.state, 'recover');
  assert.equal(e.timer, 1.1);
  g.machineBreakdown.update();
}

test('Charger frontal/native damage and real recover bonus are recorded exactly without an invented armor or weakspot rule', () => {
  const g = fixture(),
    e = enemy(g, 'charger', 780);
  crash(g, e);
  const hp = e.hp;
  g.hitEnemy(e, 10, { x: 700, y: 724 }, false);
  const hit = g.machineBreakdown.getHits(e.id).at(-1)!;
  assert.equal(e.hp, hp - 14);
  assert.equal(hit.incoming, 10);
  assert.equal(hit.applied, 14);
  assert.equal(hit.healthLost, 14);
  assert.equal(hit.absorbed, 0);
  assert.equal(hit.blocked, false);
  assert.equal(g.machineBreakdown.getSpecialist(e)!.recovery, 'crash');
  const shield = g.spawnEnemy('runner', 560, 724, 'shielded')!;
  shield.spawn = 0;
  shield.facing = 1;
  const before = shield.hp;
  assert.equal(g.hitEnemy(shield, 10, { x: 700, y: 724 }, false), true);
  const armored = g.machineBreakdown.getHits(shield.id).at(-1)!;
  assert.equal(shield.hp, before - 1);
  assert.equal(armored.absorbed, 9);
  assert.equal(armored.healthLost, 1);
  assert(armored.contact!.local.x > 0);
  g.hitEnemy(shield, 10, { x: 400, y: 724 }, false);
  const behind = g.machineBreakdown.getHits(shield.id).at(-1)!;
  assert.equal(behind.blocked, false);
  assert.equal(behind.healthLost, 10);
  assert.equal(behind.absorbed, 0);
  assert(behind.contact!.local.x < 0);
});

test('observed crash and spent recoveries retain their actual origin after native timers overlap; late observations stay unknown', () => {
  const a = fixture(),
    b = fixture(),
    charger = enemy(a, 'charger', 780),
    spent = enemy(b, 'charger', 400);
  crash(a, charger);
  spent.state = 'rush';
  spent.timer = 0;
  spent.aim = { x: 1, y: 0 };
  b.machineBreakdown.update();
  b.updateCharger(spent);
  b.machineBreakdown.update();
  assert.equal(spent.timer, 0.6);
  assert.equal(b.machineBreakdown.getSpecialist(spent)!.recovery, 'spent');
  tick(a, 43);
  tick(b, 13);
  assert(charger.timer > 0 && charger.timer < 0.6);
  assert(spent.timer > 0 && spent.timer < 0.6);
  assert.equal(a.machineBreakdown.getSpecialist(charger)!.recovery, 'crash');
  assert.equal(b.machineBreakdown.getSpecialist(spent)!.recovery, 'spent');
  const wreck = kill(a, charger);
  assert.equal(wreck.visual.specialist!.recovery, 'crash');
  assert.equal(wreck.visual.specialist!.enteredAt, 0);
  b.machineBreakdown.reset();
  b.machineBreakdown.update();
  assert.equal(
    b.machineBreakdown.getSpecialist(spent)!.recovery,
    null,
    'overlapping current timers never manufacture a collision history',
  );
});

test('Hopper snapshots preserve actual launch/flight, then observe native landing recovery without changing its target', () => {
  const g = fixture(),
    hopper = enemy(g, 'hopper', 450);
  hopper.state = 'windup';
  hopper.timer = 0;
  hopper.target = { x: 450, y: 724 };
  hopper.aim = { x: 0, y: -1 };
  g.machineBreakdown.update();
  g.updateHopper(hopper);
  assert.equal(hopper.state, 'airborne');
  assert(hopper.body.velocity.y < 0);
  g.machineBreakdown.update();
  const live = machineBodySnapshot(hopper, g.time, g)!;
  assert.equal(live.state, 'airborne');
  assert.equal(live.specialist!.grounded, false);
  assert.deepEqual(live.target, { x: 450, y: 724 });
  for (let i = 0; i < 150 && hopper.state !== 'recover'; i++) tick(g);
  assert.equal(hopper.state, 'recover');
  assert.equal(g.machineBreakdown.getSpecialist(hopper)!.recovery, 'landing');
  const w = kill(g, hopper);
  assert.equal(w.visual.state, 'recover');
  assert.equal(w.visual.specialist!.recovery, 'landing');
  assert(w.visual.specialist!.grounded);
  plain(w);
});

test('Twin Sniper native two-shot volley and breech recovery stay authoritative and are captured before lethal removal', () => {
  const g = fixture(),
    sniper = enemy(g, 'sniper', 600, 724, 'twin');
  sniper.state = 'windup';
  sniper.timer = 0;
  sniper.aim = { x: -1, y: 0 };
  g.machineBreakdown.update();
  const sounds: string[] = [];
  g.onSound = (kind) => sounds.push(kind);
  g.updateSniper(sniper);
  g.machineBreakdown.update();
  assert.equal(sniper.state, 'followup');
  assert.equal(sniper.timer, 0.65);
  assert(g.shots.length > 0);
  assert.equal(g.machineBreakdown.getSpecialist(sniper)!.recovery, null);
  for (let i = 0; i < 100 && sniper.state !== 'recover'; i++) tick(g);
  assert.equal(sniper.state, 'recover');
  assert.equal(sounds.filter((k) => k === 'snipe').length, 2);
  assert.equal(g.machineBreakdown.getSpecialist(sniper)!.recovery, 'breech');
  const hp = sniper.hp,
    w = kill(g, sniper);
  assert.equal(w.visual.elite, 'twin');
  assert.equal(w.visual.hp, hp);
  assert.equal(w.visual.state, 'recover');
  assert.equal(w.visual.specialist!.recovery, 'breech');
  assert(!g.enemies.includes(sniper));
  assert(!Matter.Composite.allBodies(g.engine.world).includes(sniper.body));
});

test('actual shotgun volleys and Piston Lance rounds use the same bounded specialist outcome path', () => {
  const volley = fixture('shotgun');
  Matter.Body.setPosition(volley.player, { x: 200, y: 400 });
  volley.aim = { x: 1000, y: 400 };
  const sniper = enemy(volley, 'sniper', 390, 400);
  sniper.hp = sniper.maxHp = 500;
  const hp = sniper.hp;
  volley.fire();
  assert(volley.shots.length > 1);
  for (let i = 0; i < 24; i++) {
    volley.time += 1 / 60;
    volley.updateShots(1 / 60);
  }
  assert(sniper.hp < hp);
  assert(volley.machineBreakdown.getHits(sniper.id).length <= MACHINE_MAX_HITS_PER_ENEMY);
  assert(
    volley.machineBreakdown
      .getHits(sniper.id)
      .every((h) => h.kind === 'sniper' && h.healthLost > 0 && h.contact),
  );
  const g = fixture();
  g.applyJobRefit(['piston-lance']);
  g.gun = getGun(g.mods);
  Matter.Body.setPosition(g.player, { x: 200, y: 400 });
  const hopper = enemy(g, 'hopper', 390, 400);
  hopper.hp = 1;
  const kills = g.kills;
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
  for (let i = 0; i < 30 && hopper.hp > 0; i++) {
    g.time += 1 / 60;
    g.updateShots(1 / 60);
  }
  assert(hopper.hp <= 0);
  assert.equal(g.kills, kills + 1);
  assert(g.machineBreakdown.wrecks.some((w) => w.visual.id === hopper.id));
  assert.equal(g.clear, false);
});

test('native ambush squad and hostile-projectile allied specialist deaths keep copied family identity without granting friendly kill credit', () => {
  const g = fixture();
  const sniper = g.spawnEnemy('sniper', 470, 724, undefined, undefined, {
    kind: 'ambush',
    role: 'lead',
  })!;
  sniper.spawn = 0;
  const hopper = g.spawnEnemy('hopper', 590, 724, undefined, undefined, {
    kind: 'ambush',
    role: 'support',
  })!;
  hopper.spawn = 0;
  assert.equal(sniper.squad!.role, 'lead');
  assert.equal(hopper.squad!.role, 'support');
  const a = kill(g, sniper),
    b = kill(g, hopper);
  assert.equal(a.visual.squad!.kind, 'ambush');
  assert.equal(a.visual.squad!.role, 'lead');
  assert.equal(
    b.visual.squad,
    undefined,
    'native partner death already removed the living support tag',
  );
  const pair = fixture();
  const lead = pair.spawnEnemy('sniper', 470, 724, undefined, undefined, {
    kind: 'ambush',
    role: 'lead',
  })!;
  lead.spawn = 0;
  const support = pair.spawnEnemy('hopper', 590, 724, undefined, undefined, {
    kind: 'ambush',
    role: 'support',
  })!;
  support.spawn = 0;
  const firstSupport = kill(pair, support);
  assert.equal(firstSupport.visual.squad!.role, 'support');
  assert.equal(firstSupport.visual.squad!.kind, 'ambush');
  assert.equal(lead.squad, undefined, 'snapshot capture does not prevent native squad cleanup');
  const ally = g.factions.spawn('hopper', { x: 600, y: 400 })!;
  ally.spawn = 0;
  ally.hp = 3;
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
  assert(ally.hp <= 0);
  assert(!g.factions.allies.includes(ally));
  assert.equal(g.kills, kills);
  const w = g.machineBreakdown.wrecks.find((w) => w.visual.id === ally.id)!;
  assert(w.visual.allied);
  assert.equal(w.visual.kind, 'hopper');
  assert.equal(w.hit!.healthLost, 3);
  plain(g.machineBreakdown.wrecks);
});

for (const kind of ['charger', 'hopper', 'sniper'] as const)
  test(
    kind +
      ' wrecks use real raised, overhead, moving and removed support rather than an assumed floor',
    () => {
      const g = fixture(),
        high = enemy(g, kind, 1250, 350),
        low = enemy(g, kind, 1250, 600);
      assert.equal(machineLanding(g, machineBodySnapshot(high, 0, g)!)!.point.y, 500);
      assert.equal(machineLanding(g, machineBodySnapshot(low, 0, g)!)!.point.y, 740);
      const crate = g.props.spawn('crate', 400, 600),
        e = enemy(g, kind, 400, 350),
        w = kill(g, e);
      assert.equal(w.landing!.bodyId, crate.body.id);
      const old = { ...w.landing!.point };
      Matter.Body.translate(crate.body, { x: 9, y: -5 });
      g.time += 0.02;
      g.machineBreakdown.update();
      assert.equal(w.landing!.point.x, old.x + 9);
      assert.equal(w.landing!.point.y, old.y - 5);
      g.props.remove(crate);
      g.time += 0.02;
      g.machineBreakdown.update();
      assert.equal(w.landing!.available, false);
      assert(w.lifetime < 0.3);
    },
  );

test('specialist cleanup, dummies, spawning and real cinema actors create no false deaths; caps and Pause/results/reset stay bounded', () => {
  const g = fixture();
  for (const kind of ['charger', 'hopper', 'sniper'] as const) {
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
    seed: 'RF-C108-SPECIALCINEMA',
    stage: 19,
    hp: 100,
    mods: [],
    kills: 0,
    elapsed: 0,
  });
  assert(cinema.finale.cinema?.active);
  for (const kind of ['charger', 'hopper', 'sniper'] as const) {
    const e = enemy(cinema, kind);
    cinema.hitEnemy(e, 100000, undefined, false);
  }
  assert.equal(cinema.machineBreakdown.wrecks.length, 0);
  const target = enemy(g, 'charger');
  target.hp = target.maxHp = 1e8;
  for (let i = 0; i < 300; i++) g.hitEnemy(target, 0.01, { x: 300, y: 724 }, false);
  assert.equal(g.machineBreakdown.getHits(target.id).length, MACHINE_MAX_HITS_PER_ENEMY);
  assert(g.machineBreakdown.diagnostics.hits <= MACHINE_MAX_HITS);
  const bodies = Matter.Composite.allBodies(g.engine.world).length;
  for (let i = 0; i < 150; i++) {
    const e = enemy(g, (['charger', 'hopper', 'sniper'] as const)[i % 3]);
    kill(g, e);
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
  g.loadRoom();
  assert.equal(g.machineBreakdown.diagnostics.hits, 0);
  assert.equal(g.machineBreakdown.getSpecialist(target), null);
  kill(g, enemy(g, 'sniper'));
  g.setMode('title');
  assert.equal(g.machineBreakdown.wrecks.length, 0);
});

test('specialist presentation leaves native HP, AI, physics, random stream, rewards, audio and saves unchanged', (t) => {
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
  for (const kind of ['charger', 'hopper', 'sniper'] as const) {
    const x = enemy(a, kind, 500),
      y = enemy(b, kind, 500);
    if (kind === 'charger') {
      x.state = y.state = 'recover';
      x.timer = y.timer = 0.4;
    }
    for (const damage of [10, 10000]) {
      a.hitEnemy(x, damage, { x: 300, y: 724 });
      b.hitEnemy(y, damage, { x: 300, y: 724 });
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
