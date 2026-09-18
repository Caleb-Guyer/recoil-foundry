import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { fabricatorLevel, fabricatorTestFromUrl } from '../src/fabricator-layout.ts';
import { FABRICATOR_BUILD, FABRICATOR_LIMIT, SENTRY_TELL, SENTRY_LOCK } from '../src/fabricator.ts';
import { getLevel, type Solid } from '../src/levels.ts';
import { getGun, loadCheckpoint } from '../src/rules.ts';
import { splitWaves } from '../src/reinforcements.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { dailyForDate } from '../src/daily.ts';
import { playRoom } from './room-pilot.ts';

const { Body, Bodies, Composite, Query } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 900, y: 720 },
};
function preset(q = '') {
  return fabricatorTestFromUrl(new URL('https://test/?test=fabricator' + q))!;
}
function step(g: Game, n = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, { ...idle, ...input });
}
function fixture() {
  const g = new Game();
  g.startTest(preset());
  g.waves.clear();
  g.hazards.clear();
  g.breaches.clear();
  g.conveyors.clear();
  g.destruction.clear();
  g.magnets.items = [];
  g.pressure.clear();
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.level.solids = [];
  g.level.magnets = [];
  g.level.coolant = [];
  Body.setPosition(g.player, { x: 1100, y: 722 });
  const e = g.spawnEnemy('fabricator', 700, 724)!;
  e.spawn = 0;
  e.timer = 0;
  return { g, e };
}
function wall(g: Game, s: Solid) {
  const b = Bodies.rectangle(s.x + s.w / 2, s.y + s.h / 2, s.w, s.h, { isStatic: true });
  Composite.add(g.engine.world, b);
  g.terrain.push(b);
  g.level.solids.push(s);
  return b;
}
function begin() {
  const { g, e } = fixture();
  step(g, 2);
  const s = g.enemies.find((other) => other.sentry)!;
  assert(s && !s.sentry!.ready, 'construction should start in free floor space');
  return { g, e, s };
}
function complete() {
  const f = begin();
  step(f.g, Math.ceil(FABRICATOR_BUILD * 60) + 2);
  assert(f.s.sentry?.ready);
  return f;
}

test('Fabricator introduction is solo, seeded, and preserves roster, elites and support anchors', () => {
  for (let i = 0; i < 40; i++) {
    const g = new Game();
    const p = preset();
    p.seed = 'FABRICATOR-85-' + i;
    g.startTest(p);
    const original = getLevel(p.seed, 13);
    if (original.setpiece) {
      assert(!g.level.fabricatorIntro);
      continue;
    }
    assert(g.level.fabricatorIntro);
    assert.equal(g.level.spawns.length, original.spawns.length);
    assert.deepEqual(
      g.level.spawns.filter((s) => s.elite),
      original.spawns.filter((s) => s.elite),
    );
    assert.equal(g.level.spawns.filter((s) => s.kind === 'fabricator').length, 1);
    assert.equal(g.enemies.length, 1);
    assert.equal(g.enemies[0].kind, 'fabricator');
    const pos = g.enemies[0].body.position;
    assert.equal(Query.collides(g.enemies[0].body, g.solidBodies).length, 0);
    assert(
      g.terrain.some(
        (b) =>
          Math.abs(b.bounds.min.y - pos.y - 16) < 2 &&
          pos.x > b.bounds.min.x &&
          pos.x < b.bounds.max.x,
      ),
    );
    assert.deepEqual(
      splitWaves(g.level, g.roomSeed, 13)[0].map((s) => s.kind),
      ['fabricator'],
    );
  }
  const a = new Game(),
    b = new Game();
  a.startTest(preset());
  b.startTest(preset('&mirror=1'));
  assert.notEqual(a.level.mirrored, b.level.mirrored);
});

test('later replacements stay sparse, deterministic and singular without changing earlier rooms or special encounters', () => {
  let count = 0;
  for (let i = 0; i < 60; i++)
    for (const stage of [12, 14, 16, 17, 18, 19]) {
      const g = new Game();
      g.start('FABRICATOR-85-' + i);
      g.stage = stage;
      const level = getLevel(g.seed, stage);
      g.level = level;
      g.areaEvents.state = null;
      const changed = fabricatorLevel(g, level),
        n = changed.spawns.filter((s) => s.kind === 'fabricator').length;
      assert(n <= 1);
      assert.equal(changed.spawns.length, level.spawns.length);
      assert.deepEqual(changed, fabricatorLevel(g, level));
      if (stage === 12 || level.boss) assert.equal(n, 0);
      else count += n;
    }
  assert(count > 25 && count < 200, String(count));
  for (const prop of [
    'boss',
    'detour',
    'freight',
    'crossing',
    'courier',
    'floodgate',
    'anglerIntro',
    'crawlerIntro',
    'harpoonIntro',
    'sapperIntro',
  ] as const) {
    const { g } = fixture();
    const level = { ...getLevel(g.seed, 13), [prop]: true };
    assert.equal(fabricatorLevel(g, level), level, prop);
  }
});

test('unrelated tests, Workshop, Practice, events and New Game+ retain their encounters', () => {
  const { g } = fixture(),
    level = getLevel(g.seed, 13);
  g.testRun = { ...preset(), seed: 'OTHER-TEST' };
  g.seed = 'OTHER-TEST';
  assert.equal(fabricatorLevel(g, level), level);
  g.testRun = null;
  g.seed = 'FABRICATOR-85-4';
  g.workshop.active = true;
  assert.equal(fabricatorLevel(g, level), level);
  g.workshop.active = false;
  g.overtime = { baseMods: 7, repairs: 0 };
  assert.equal(fabricatorLevel(g, level), level);
  g.overtime = null;
  g.practice = { kind: 'sorter', seed: 'practice' };
  assert.equal(fabricatorLevel(g, level), level);
  g.practice = null;
  g.areaEvents.state = {
    kind: 'turf',
    area: 3,
    relays: [],
    caches: [],
    commander: false,
    rerolls: 0,
  };
  assert.equal(fabricatorLevel(g, level), level);
});

test('construction takes the full tell and cannot shoot or deal contact damage before activation', () => {
  const { g, e, s } = begin(),
    hp = g.hp;
  step(g, 90);
  assert(!s.sentry!.ready);
  assert.equal(g.shots.length, 0);
  assert.equal(e.fabricator!.built, 0);
  assert.equal(g.hp, hp);
  step(g, 50);
  assert(s.sentry!.ready);
  assert.equal(e.fabricator!.built, 1);
  assert(s.timer > 0);
  assert.equal(g.shots.length, 0);
});

test('shooting the builder cancels its weld; a destroyed frame cancels without rewards or consuming a completed turret', () => {
  for (const target of ['builder', 'frame']) {
    const { g, e, s } = begin();
    g.hp = 50;
    g.gun = { ...g.gun, heal: 2 };
    const kills = g.kills;
    g.hitEnemy(target === 'builder' ? e : s, target === 'builder' ? 1 : 99999);
    assert(!g.enemies.includes(s));
    assert.equal(e.fabricator!.frame, undefined);
    assert.equal(e.fabricator!.built, 0);
    assert.equal(e.state, 'recover');
    assert.equal(g.hp, 50);
    assert.equal(g.kills, kills);
    assert(!Composite.allBodies(g.engine.world).includes(s.body));
  }
});

test('construction never restores damage already dealt to the frame', () => {
  const { g, s } = begin();
  g.hitEnemy(s, 18);
  const hp = s.hp;
  g.hitStop = 0;
  step(g, 140);
  assert(s.sentry!.ready);
  assert.equal(s.hp, hp);
});

test('destroying a generated sentry cannot farm Death bloom fragments', () => {
  const { g, s } = begin();
  g.mods = ['bloom'];
  g.gun = getGun(g.mods);
  g.addShot({
    pos: { x: s.body.position.x + 75, y: s.body.position.y },
    vel: { x: -80, y: 0 },
    damage: 999,
    life: 2,
    friendly: true,
    radius: 3,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: true,
  });
  g.updateShots(1 / 60);
  assert(!g.enemies.includes(s));
  assert(!g.shots.some((shot) => shot.fragment));
});

test('only two sentries can be completed, including after a turret is destroyed', () => {
  const { g, e, s } = complete();
  g.hurtAt = 1e9;
  step(g, 380);
  assert.equal(e.fabricator!.built, FABRICATOR_LIMIT);
  assert.equal(g.enemies.filter((other) => other.sentry).length, 2);
  const kills = g.kills;
  g.hitEnemy(s, 99999);
  g.hitStop = 0;
  step(g, 600);
  assert.equal(g.kills, kills);
  assert.equal(e.fabricator!.built, 2);
  assert.equal(g.enemies.filter((other) => other.sentry).length, 1);
});

test('death of the Fabricator shuts down all sentries and hostile rounds, retaining reflected player shots', () => {
  const { g, e, s } = complete();
  g.hurtAt = 1e9;
  for (let i = 0; i < 180 && !g.shots.some((shot) => shot.sentryOwner === e.id); i++) step(g);
  assert(g.shots.some((shot) => shot.sentryOwner === e.id));
  const shot = g.shots.find((shot) => shot.sentryOwner === e.id)!;
  shot.friendly = true;
  g.enemyShot(s, 0, 10.5, 17);
  g.hp = 50;
  g.gun = { ...g.gun, heal: 2 };
  const kills = g.kills;
  g.hitEnemy(e, 99999);
  assert(!g.enemies.some((other) => other.sentry));
  assert.equal(g.kills, kills + 1);
  assert.equal(g.hp, 52);
  assert(g.shots.includes(shot));
  assert(!g.shots.some((s) => s.sentryOwner === e.id && !s.friendly));
  assert(!Composite.allBodies(g.engine.world).includes(s.body));
});

test('placement requires support, spacing, firing lanes and clear ground away from entrances, coolant and magnets', () => {
  const { g, e } = fixture();
  const pos = g.fabricators.findSite(e)!;
  assert(pos);
  assert(pos.x >= 360 && pos.x <= 1760);
  assert(!Query.collides(Bodies.rectangle(pos.x, pos.y, 34, 32), g.solidBodies).length);
  wall(g, { x: 300, y: 300, w: 20, h: 440 });
  Body.setPosition(g.player, { x: 140, y: 720 });
  assert.equal(g.fabricators.findSite(e), undefined);
  Body.setPosition(g.player, { x: 1100, y: 722 });
  g.level.coolant = [{ x: 400, y: 720, w: 600, h: 20 }];
  assert.equal(g.fabricators.findSite(e), undefined);
  g.level.coolant = [];
  g.level.magnets = [
    { x: 550, y: 350, floor: 740, offset: 0 },
    { x: 650, y: 350, floor: 740, offset: 0 },
    { x: 750, y: 350, floor: 740, offset: 0 },
    { x: 850, y: 350, floor: 740, offset: 0 },
  ];
  assert.equal(g.fabricators.findSite(e), undefined);
  g.level.magnets = [];
  Body.setPosition(e.body, { x: 700, y: 400 });
  assert.equal(g.fabricators.findSite(e), undefined);
});

test('moving bodies, new obstructions and a lost support interrupt construction rather than overlap geometry', () => {
  for (const obstacle of ['builder', 'frame', 'crate', 'floor']) {
    const { g, e, s } = begin();
    if (obstacle === 'builder') Body.translate(e.body, { x: 50, y: 0 });
    if (obstacle === 'frame') Body.translate(s.body, { x: 50, y: 0 });
    if (obstacle === 'crate') g.props.spawn('crate', s.body.position.x, s.body.position.y);
    if (obstacle === 'floor') {
      Composite.remove(g.engine.world, g.terrain[0]);
      g.terrain.shift();
    }
    step(g, 2);
    assert(!g.enemies.includes(s), obstacle);
    assert.equal(e.fabricator!.built, 0);
  }
});

test('a sentry tracks only before its final lock, and displaced guns cancel the attack', () => {
  const { g, s } = complete();
  s.state = 'idle';
  s.timer = 0;
  step(g);
  assert.equal(s.state, 'windup');
  assert(Math.abs(s.timer - SENTRY_TELL) < 0.03);
  step(g, 33);
  assert(s.timer <= SENTRY_LOCK);
  const aim = { ...s.aim };
  Body.setPosition(g.player, { x: 1100, y: 500 });
  step(g, 5);
  assert.deepEqual(s.aim, aim);
  Body.translate(s.body, { x: 30, y: 0 });
  step(g);
  assert.equal(s.state, 'recover');
  assert.equal(s.attacks, 0);
});

test('sentry bullets collide with newly introduced cover and cannot launch through an obstructed muzzle', () => {
  const { g, e, s } = complete();
  s.timer = 0;
  step(g);
  assert.equal(s.state, 'windup');
  const p = s.body.position;
  wall(g, { x: p.x + 15, y: p.y - 40, w: 30, h: 55 });
  const hp = g.hp;
  step(g, 70);
  assert.equal(g.hp, hp);
  assert(!g.shots.some((shot) => shot.sentryOwner === e.id));
});

test('real bullets and beam builds damage frames and sentries through the ordinary combat system', () => {
  for (const beam of [false, true]) {
    const { g, s } = begin();
    const p = { ...s.body.position };
    // Move the player to a clear firing side of the frame without touching its builder.
    Body.setPosition(g.player, { x: p.x + 180, y: p.y - 2 });
    g.mods = beam ? ['cutting-torch', 'magnum'] : ['magnum'];
    g.gun = getGun(g.mods);
    const hp = s.hp;
    step(g, 6, { fire: true, aim: p });
    assert(s.hp < hp || !g.enemies.includes(s), beam ? 'beam' : 'bullet');
  }
});

test('pause, hitstop and death freeze or remove construction; restarting rebuilds fresh state', () => {
  const { g, e, s } = begin();
  const timer = e.timer;
  g.setMode('paused');
  step(g, 120);
  assert.equal(e.timer, timer);
  assert(g.enemies.includes(s));
  g.setMode('playing');
  g.hitStop = 1;
  step(g, 10);
  assert.equal(e.timer, timer);
  g.hitStop = 0;
  g.die();
  assert(!g.enemies.some((other) => other.sentry));
  assert.equal(e.fabricator!.frame, undefined);
  g.startTest(preset());
  assert.equal(g.enemies.length, 1);
  assert.equal(g.enemies[0].fabricator!.built, 0);
});

test('real portal travel interrupts a weld or a locked sentry attack without resetting portal charges', () => {
  for (const target of ['builder', 'frame', 'ready']) {
    const { g, e, s } = target === 'ready' ? complete() : begin();
    g.mods = ['fold'];
    g.gun = getGun(g.mods);
    const body = target === 'builder' ? e.body : s.body;
    const from = body.position.x;
    assert(g.portals.place({ x: from, y: 740 }));
    assert(g.portals.place({ x: 1400, y: 740 }));
    if (target === 'ready') {
      s.state = 'windup';
      s.timer = 0.3;
    }
    Body.setVelocity(body, { x: 0, y: 3 });
    g.portals.beforeStep();
    Matter.Engine.update(g.engine, 1000 / 60);
    assert(body.position.x > 1300, target);
    assert.equal(g.portals.next, 2);
    if (target === 'ready') {
      assert(g.enemies.includes(s));
      assert.equal(s.state, 'recover');
      assert.equal(s.attacks, 0);
    } else {
      assert.equal(e.fabricator!.frame, undefined);
      assert(!g.enemies.includes(s));
    }
  }
});

test('introduction reinforcements wait for the Fabricator, then room completion needs only surviving enemies', () => {
  const g = new Game();
  g.startTest(preset());
  const e = g.enemies[0];
  e.spawn = 0;
  g.hurtAt = 1e9;
  step(g, 650);
  assert(g.waves.phase === 'opening');
  g.hitEnemy(e, 99999);
  g.hitStop = 0;
  step(g, 80);
  assert(g.enemies.length > 0 && !g.enemies.some((other) => other.sentry));
  for (let i = 0; i < 400 && !g.clear; i++) {
    for (const enemy of [...g.enemies]) g.hitEnemy(enemy, 99999);
    g.hitStop = 0;
    step(g);
  }
  assert(g.clear);
  g.openReward();
  assert.equal(g.mode, 'upgrade');
  assert.equal(g.offers.length, 3);
});

test('Continue and Daily reconstruct the same placements and budgets; focused tests cannot modify saved progress', () => {
  const g = new Game();
  g.start('fabricator-save');
  g.stage = 13;
  g.loadRoom();
  let saved: unknown;
  g.onCheckpoint = (s) => {
    saved = s;
  };
  // A valid thirteen-upgrade campaign is supplied by the existing reward progression.
  const h = new Game();
  h.start('fabricator-continue');
  for (let i = 0; i < 13; i++) {
    h.clear = true;
    h.waves.clear();
    for (const e of [...h.enemies]) h.hitEnemy(e, 99999);
    h.openReward();
    h.chooseMod(h.offers[0].id);
  }
  h.onCheckpoint = (s) => {
    saved = s;
  };
  h.save();
  assert(loadCheckpoint(saved));
  const k = new Game();
  k.start(h.seed, loadCheckpoint(saved)!);
  assert.deepEqual(k.level, h.level);
  const day = dailyForDate('2026-09-20')!;
  h.start(day.seed);
  h.stage = 13;
  h.loadRoom();
  k.start(day.seed);
  k.stage = 13;
  k.loadRoom();
  assert.deepEqual(h.level, k.level);
  let writes = 0,
    bosses = 0;
  g.onCheckpoint = () => writes++;
  g.onBossDefeated = () => bosses++;
  g.startTest(preset());
  g.hitEnemy(g.enemies[0], 99999);
  g.save();
  g.startTest(preset());
  assert.equal(writes, 0);
  assert.equal(bosses, 0);
});

test('Fabricator test URLs reject ambiguous parameters and preserve normal gun compatibility', () => {
  for (const q of ['', '&mirror=1', '&build=beam', '&build=portal', '&build=starter'])
    assert(preset(q));
  for (const q of [
    '&mirror=0',
    '&mirror=1&mirror=1',
    '&build=beam&build=portal',
    '&build=invalid',
    '&daily=1',
    '&test=fabricator',
  ])
    assert.equal(preset(q), null);
  assert(ENEMY_STATS.sentry.h <= 36);
  assert.equal(ENEMY_STATS.fabricator.w, 30);
});

test('old checkpoints retain their original rosters while new runs preserve Fabricator availability on Continue', () => {
  const p = preset();
  delete p.fabricators;
  const g = new Game();
  g.start(p.seed, p);
  assert(!g.fabricators.enabled);
  assert(!g.level.fabricatorIntro && !g.enemies.some((e) => e.fabricator));
  g.start('fresh-fabricator');
  assert(g.fabricators.enabled);
  let saved: unknown;
  g.onCheckpoint = (s) => (saved = s);
  g.save();
  assert(loadCheckpoint(saved)?.fabricators);
  assert.equal(loadCheckpoint({ ...(saved as object), fabricators: false }), null);
  assert.equal(loadCheckpoint({ ...(saved as object), fabricators: 'yes' }), null);
});

test('ordinary-input combat clears both real Fabricator rooms at normal health with standard and beam builds', () => {
  for (const q of ['', '&mirror=1', '&build=beam', '&build=beam&mirror=1']) {
    const g = new Game();
    g.startTest(preset(q));
    const result = playRoom(g, 150);
    assert(result.clear && result.hp > 0, JSON.stringify({ q, ...result }));
    assert(!g.enemies.some((e) => e.sentry));
  }
});
