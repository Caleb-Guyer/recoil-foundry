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
  aim: { x: 1500, y: 500 },
};
const level: Level = {
  id: 'breakdown-native',
  name: 'Native machines',
  area: 'cooling',
  boss: false,
  mirrored: false,
  solids: [{ x: 700, y: 500, w: 300, h: 22 }],
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
  const g = new Game();
  const cp = {
    version: 6 as const,
    seed: 'RF-C108-BREAKDOWN',
    stage: 8,
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
  kind: 'runner' | 'shooter' | 'flyer' = 'runner',
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
  assert(
    Object.getPrototypeOf(value) === Object.prototype || Array.isArray(value),
    'only copied data survives a death',
  );
  for (const v of Object.values(value)) plain(v);
}

test('shield damage records real native absorbed/health outcomes and body-local hull contacts without a weakspot bonus', () => {
  const g = fixture(),
    e = enemy(g, 'runner', 500, 724, 'shielded');
  e.facing = 1;
  const before = e.hp;
  const blocked = g.hitEnemy(e, 10, { x: 700, y: 724 }, false);
  assert.equal(blocked, true);
  assert.equal(e.hp, before - 1);
  const hit = g.machineBreakdown.getHits(e.id)[0];
  assert.equal(hit.blocked, true);
  assert.equal(hit.incoming, 10);
  assert.equal(hit.applied, 1);
  assert.equal(hit.healthLost, 1);
  assert.equal(hit.absorbed, 9);
  assert(hit.contact && hit.contact.local.x > 0 && hit.contact.normal.x > 0.9);
  assert(Math.abs(hit.contact.local.x) <= 16);
  const state = {
    state: e.state,
    timer: e.timer,
    aim: { ...e.aim },
    velocity: { ...e.body.velocity },
  };
  g.hitEnemy(e, 10, { x: 300, y: 724 }, false);
  const open = g.machineBreakdown.getHits(e.id).at(-1)!;
  assert.equal(open.blocked, false);
  assert.equal(open.applied, 10);
  assert.equal(open.absorbed, 0);
  assert.equal(open.healthLost, 10);
  assert(open.contact && open.contact.local.x < 0 && open.contact.normal.x < -0.9);
  assert.deepEqual(
    { state: e.state, timer: e.timer, aim: { ...e.aim }, velocity: { ...e.body.velocity } },
    state,
    'a local reaction cannot stun, turn, push or interrupt AI',
  );
  g.hitEnemy(e, 1, undefined, false);
  assert.equal(
    g.machineBreakdown.getHits(e.id).at(-1)!.contact,
    null,
    'directionless damage invents no contact',
  );
});

test('fatal native outcomes preserve pre-lethal pose and exact identities as detached data', () => {
  const g = fixture();
  for (const [kind, elite] of [
    ['runner', 'shielded'],
    ['shooter', 'twin'],
    ['flyer', 'volatile'],
  ] as const) {
    const e = enemy(g, kind, 400 + g.kills * 100, kind === 'flyer' ? 300 : 724, elite);
    e.state = 'windup';
    e.timer = 0.23;
    e.facing = 1;
    Matter.Body.setVelocity(e.body, { x: 2.1, y: 0.3 });
    const hp = e.hp;
    g.hitEnemy(e, 100000, { x: e.body.position.x - 80, y: e.body.position.y }, false);
    const w = g.machineBreakdown.wrecks.at(-1)!;
    assert.equal(w.visual.id, e.id);
    assert.equal(w.visual.elite, elite);
    assert.equal(w.visual.kind, kind);
    assert.equal(w.visual.hp, hp);
    assert.equal(w.visual.state, 'windup');
    assert.equal(w.visual.timer, 0.23);
    assert.equal(w.hit!.healthLost, hp);
    assert.equal(w.hit!.absorbed, 0, 'overkill is not absorbed armor');
    assert(!g.enemies.includes(e));
    assert(!Matter.Composite.allBodies(g.engine.world).includes(e.body));
    assert.equal(g.machineBreakdown.getHits(e.id).length, 0);
    assert(w.landing && w.landing.point.y === 740);
    assert(w.visual.hull.x > 0 && w.visual.hull.y > 0);
    plain(w);
    const copied = JSON.stringify(w);
    e.aim.x = 99;
    e.body.position.x = -999;
    assert.equal(JSON.stringify(w), copied, 'removed source objects cannot alter the snapshot');
  }
});

test('actual split-child, mutation and squad variants keep their proportions and finite copied metadata', () => {
  const g = fixture();
  const split = g.spawnEnemy('runner', 440, 724, undefined, undefined, undefined, 'split-child')!;
  split.spawn = 0;
  const mutation = g.spawnEnemy('flyer', 550, 300, undefined, undefined, undefined, 'blinker')!;
  mutation.spawn = 0;
  const squad = g.spawnEnemy('shooter', 650, 724, undefined, undefined, {
    kind: 'shield',
    role: 'support',
  })!;
  squad.spawn = 0;
  assert.equal(split.splitChild, true);
  assert.equal(mutation.mutation?.kind, 'blinker');
  assert.equal(squad.squad?.role, 'support');
  for (const e of [split, mutation, squad]) g.hitEnemy(e, 100000, undefined, false);
  const a = g.machineBreakdown.wrecks.find((w) => w.visual.id === split.id)!;
  const b = g.machineBreakdown.wrecks.find((w) => w.visual.id === mutation.id)!;
  const c = g.machineBreakdown.wrecks.find((w) => w.visual.id === squad.id)!;
  assert(a.visual.splitChild && a.visual.scale === 0.6);
  assert(a.visual.hull.x < 30);
  assert.equal(b.visual.mutation!.kind, 'blinker');
  assert.equal(c.visual.squad!.kind, 'shield');
  assert.equal(c.visual.squad!.role, 'support');
  plain(g.machineBreakdown.wrecks);
});

test('support projection starts at the real actor, respects overhead platforms and follows actual moving support', () => {
  const g = fixture(),
    above = enemy(g, 'flyer', 820, 280),
    below = enemy(g, 'flyer', 820, 600);
  const high = machineLanding(g, machineBodySnapshot(above, g.time)!)!,
    low = machineLanding(g, machineBodySnapshot(below, g.time)!)!;
  assert.equal(high.point.y, 500);
  assert.equal(low.point.y, 740, 'a ceiling above the actor is not its landing surface');
  assert.equal(high.center.y, 500 - machineBodySnapshot(above, g.time)!.hull.y / 2);
  const crate = g.props.spawn('crate', 450, 600),
    e = enemy(g, 'flyer', 450, 350);
  g.hitEnemy(e, 10000, undefined, false);
  const wreck = g.machineBreakdown.wrecks.at(-1)!;
  assert.equal(wreck.landing!.bodyId, crate.body.id);
  const before = { ...wreck.landing!.point };
  Matter.Body.translate(crate.body, { x: 11, y: -7 });
  g.time += 0.02;
  g.machineBreakdown.update();
  assert.equal(wreck.landing!.point.x, before.x + 11);
  assert.equal(wreck.landing!.point.y, before.y - 7);
  g.props.remove(crate);
  g.time += 0.02;
  g.machineBreakdown.update();
  assert.equal(wreck.landing!.available, false);
  assert(wreck.lifetime < 0.3);
  const empty = fixture();
  for (const b of empty.terrain) Matter.Composite.remove(empty.engine.world, b);
  empty.terrain = [];
  empty.hazards.clear();
  const air = enemy(empty, 'flyer', 500, 300);
  assert.equal(
    machineLanding(empty, machineBodySnapshot(air, 0)!),
    null,
    'missing native support never becomes a made-up floor',
  );
});

test('native morph rounds kill through the same outcome hook and keep native kills/waves authoritative', () => {
  const g = fixture();
  g.applyJobRefit(['piston-lance']);
  g.gun = getGun(g.mods);
  Matter.Body.setPosition(g.player, { x: 200, y: 400 });
  const e = enemy(g, 'shooter', 390, 400);
  e.hp = 1;
  const kills = g.kills,
    pending = g.waves.pending;
  const s = g.addShot({
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
  })!;
  for (let i = 0; i < 30 && e.hp > 0; i++) {
    g.time += 1 / 60;
    g.updateShots(1 / 60);
  }
  assert(e.hp <= 0);
  assert.equal(g.kills, kills + 1);
  assert.equal(g.waves.pending, pending);
  assert.equal(g.clear, false);
  assert(g.machineBreakdown.wrecks.some((w) => w.visual.id === e.id));
  assert(s.life <= 1.4);
});

test('hostile projectiles capture real allied deaths without granting a kill or changing faction cleanup', () => {
  const g = fixture(),
    ally = g.factions.spawn('runner', { x: 600, y: 400 })!;
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
  const w = g.machineBreakdown.wrecks.at(-1)!;
  assert(w.visual.allied);
  assert.equal(w.visual.id, ally.id);
  assert.equal(w.hit!.healthLost, 3);
  const departing = g.factions.spawn('runner', { x: 650, y: 724 })!;
  departing.spawn = 0;
  g.factions.removeAlly(departing);
  assert(
    !g.machineBreakdown.wrecks.some((w) => w.visual.id === departing.id),
    'departures/despawns create no death',
  );
});

test('cleanup, bosses, spawning actors, recoil targets, workshop dummies and cinema create no records', () => {
  const g = fixture();
  const cleanup = enemy(g);
  g.hitEnemy(cleanup, 100000, undefined, false, true, true, 'cleanup');
  const spawning = enemy(g);
  spawning.spawn = 1;
  g.hitEnemy(spawning, 100000, undefined, false);
  const boss = g.spawnEnemy('loader', 800, 706)!;
  boss.spawn = 0;
  g.hitEnemy(boss, 100000, undefined, false);
  const dummy = enemy(g);
  dummy.workshopTarget = 'standard' as any;
  g.hitEnemy(dummy, 100000, undefined, false);
  const recoil = enemy(g);
  recoil.recoilTarget = 1;
  g.hitEnemy(recoil, 100000, undefined, false);
  assert.equal(g.machineBreakdown.wrecks.length, 0);
  assert.equal(g.machineBreakdown.diagnostics.hits, 0);
  const workshop = new Game();
  workshop.startWorkshop([], []);
  const target = workshop.enemies[0];
  if (target) workshop.hitEnemy(target, 100000, undefined, false);
  assert.equal(workshop.machineBreakdown.wrecks.length, 0);
  const cinema = new Game();
  cinema.startTest({
    version: 6,
    seed: 'RF-C108-BREAKCINEMA',
    stage: 19,
    hp: 100,
    mods: [],
    kills: 0,
    elapsed: 0,
  });
  assert(cinema.finale.cinema?.active, 'the native latest-finale director is presenting');
  const extra = enemy(cinema, 'runner', 500, 724);
  cinema.hitEnemy(extra, 100000, undefined, false);
  assert.equal(cinema.machineBreakdown.wrecks.length, 0);
  assert.equal(cinema.machineBreakdown.diagnostics.hits, 0);
});

test('multi-hit records, concurrent wrecks and long runs remain bounded without retaining removed enemies', () => {
  const g = fixture(),
    e = enemy(g);
  e.hp = e.maxHp = 1e8;
  for (let i = 0; i < 1000; i++) g.hitEnemy(e, 0.01, { x: 300, y: 724 }, false);
  assert.equal(g.machineBreakdown.getHits(e.id).length, MACHINE_MAX_HITS_PER_ENEMY);
  assert(g.machineBreakdown.diagnostics.hits <= MACHINE_MAX_HITS);
  const initialBodies = Matter.Composite.allBodies(g.engine.world).length;
  for (let i = 0; i < 500; i++) {
    const a = enemy(g, 'runner', 450, 724);
    g.hitEnemy(a, 100000, undefined, false);
    assert(g.machineBreakdown.wrecks.length <= MACHINE_MAX_WRECKS);
  }
  assert.equal(Matter.Composite.allBodies(g.engine.world).length, initialBodies);
  assert.equal(g.machineBreakdown.wrecks.length, MACHINE_MAX_WRECKS);
  plain(g.machineBreakdown.wrecks);
  g.time += 3;
  g.machineBreakdown.update();
  assert.equal(g.machineBreakdown.wrecks.length, 0);
  assert.equal(g.machineBreakdown.diagnostics.hits, 0);
});

test('pause and results hold exact records, while room/title resets release every presentation record', () => {
  const g = fixture(),
    e = enemy(g);
  g.hitEnemy(e, 100000, undefined, false);
  const before = JSON.stringify(g.machineBreakdown.wrecks);
  for (const mode of ['paused', 'dead', 'won'] as const) {
    g.setMode(mode);
    tick(g, 120);
    g.machineBreakdown.update();
    assert.equal(JSON.stringify(g.machineBreakdown.wrecks), before);
  }
  g.setMode('playing');
  g.loadRoom();
  assert.equal(g.machineBreakdown.wrecks.length, 0);
  const another = enemy(g);
  g.hitEnemy(another, 100000, undefined, false);
  g.setMode('title');
  assert.equal(g.machineBreakdown.wrecks.length, 0);
  assert.equal(g.machineBreakdown.diagnostics.hits, 0);
});

test('native saves, physics, AI, RNG, rewards, audio and wave state match with presentation recording disabled', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  const a = fixture(),
    b = fixture();
  b.machineBreakdown.beforeHit = () => null;
  b.machineBreakdown.hit = () => {};
  b.machineBreakdown.defeated = () => {};
  b.machineBreakdown.update = () => {};
  const x = enemy(a, 'runner', 500, 724, 'shielded'),
    y = enemy(b, 'runner', 500, 724, 'shielded');
  x.facing = y.facing = 1;
  const soundsA: string[] = [],
    soundsB: string[] = [];
  a.onSound = (k) => soundsA.push(k);
  b.onSound = (k) => soundsB.push(k);
  for (const damage of [3, 20, 10000]) {
    a.hitEnemy(x, damage, { x: 700, y: 724 });
    b.hitEnemy(y, damage, { x: 700, y: 724 });
  }
  tick(a, 20);
  tick(b, 20);
  assert.deepEqual(a.checkpointSnapshot(), b.checkpointSnapshot());
  assert.deepEqual(a.player.position, b.player.position);
  assert.deepEqual(a.player.velocity, b.player.velocity);
  assert.deepEqual(soundsA, soundsB);
  assert.equal(a.rng(), b.rng());
  assert.equal(a.waves.pending, b.waves.pending);
  assert.equal(
    Matter.Composite.allBodies(a.engine.world).length,
    Matter.Composite.allBodies(b.engine.world).length,
  );
  assert.equal(a.enemies.length, b.enemies.length);
});
