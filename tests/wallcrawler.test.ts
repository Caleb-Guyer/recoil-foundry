import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { CRAWLER, beginCrawlerAttack } from '../src/wallcrawler.ts';
import { getLevel } from '../src/levels.ts';
import { getOvertimeLevel } from '../src/overtime.ts';
import { getGun, distance, loadCheckpoint } from '../src/rules.ts';
import { wallcrawlerTestFromUrl } from '../src/practice.ts';
import { dailyForDate } from '../src/daily.ts';
import { dodgePilot } from './combat-pilot.ts';
const { Body, Bodies, Composite, Query } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1500, y: 650 },
};
const near = (a: number, b: number) => assert(Math.abs(a - b) < 0.01, `${a} != ${b}`);
function step(g: Game, n = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, { ...idle, ...input });
}
function fixture(face = 'top') {
  const g = new Game();
  g.start('crawler-physics');
  g.waves.clear();
  g.hazards.clear();
  g.breaches.clear();
  g.destruction.clear();
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.stage = 8;
  g.mods = [];
  g.gun = getGun([]);
  const rect = { x: 570, y: 510, w: 260, h: 60 };
  const b = Bodies.rectangle(700, 540, 260, 60, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  const piece = g.destruction.register(b, rect);
  Body.setStatic(g.player, true);
  Body.setPosition(g.player, { x: 1200, y: 650 });
  const p =
    face === 'top'
      ? { x: 700, y: 493 }
      : face === 'left'
        ? { x: 553, y: 540 }
        : face === 'right'
          ? { x: 847, y: 540 }
          : { x: 700, y: 587 };
  g.spawnEnemy('wallcrawler', p.x, p.y);
  const e = g.enemies[0];
  e.timer = 100;
  e.spawn = 0;
  return { g, e, b, piece, rig: e.crawler! };
}
function until(g: Game, condition: () => boolean, max = 300) {
  for (let n = 0; n < max && !condition(); n++) step(g);
  assert(condition(), 'Expected state did not arrive');
}

for (const face of ['top', 'left', 'right', 'bottom'])
  test(`${face}: walks around every exposed corner using physical, nonoverlapping motion`, () => {
    const { g, e, b, rig } = fixture(face),
      edges = new Set<number>();
    let previous = { ...e.body.position };
    for (let n = 0; n < 440; n++) {
      step(g);
      edges.add(rig.edge);
      assert.equal(rig.support, b);
      assert(distance(previous, e.body.position) < 3.5);
      assert.equal(Query.collides(e.body, [b]).length, 0);
      previous = { ...e.body.position };
    }
    assert.equal(edges.size, 4);
  });

test('ceiling spawn grace holds the real hull in place without firing or disabling collisions', () => {
  const { g, e, rig } = fixture('bottom');
  e.spawn = 0.65;
  e.timer = 0;
  const p = { ...e.body.position };
  step(g, 38);
  near(distance(p, e.body.position), 0);
  assert.equal(e.attacks, 0);
  assert.equal(g.shots.length, 0);
  assert(!e.body.isStatic && rig.support);
});

test('floor-to-wall transfers climb the obstacle without passing through it or the floor', () => {
  for (const sign of [-1, 1]) {
    const { g, e, b, rig } = fixture();
    Body.scale(b, 1, 140 / 60);
    Body.setPosition(b, { x: 700, y: 670 });
    Body.setPosition(e.body, { x: 700 + sign * 180, y: 723 });
    rig.support = undefined;
    Body.setPosition(g.player, { x: 700 - sign * 300, y: 723 });
    let climbed = false;
    for (let n = 0; n < 120; n++) {
      step(g);
      if (e.body.position.y < 640) climbed = true;
      assert(Query.collides(e.body, g.terrain).every((h) => h.depth < 0.1));
    }
    assert(climbed);
  }
});

test('crates and thin rotated cover obstruct climbing, and strong crate impacts remain physical', () => {
  const { g, e } = fixture('top');
  const crate = g.props.spawn('crate', 775, 470);
  Body.setStatic(crate.body, true);
  const start = e.body.position.x;
  step(g, 50);
  assert(e.body.position.x < crate.body.position.x - 30);
  assert(e.body.position.x >= start - 20);
  assert.equal(Query.collides(e.body, [crate.body]).length, 0);
  g.props.remove(crate);
  const cover = g.props.spawn('crate', e.body.position.x - 42, e.body.position.y);
  Body.setAngle(cover.body, 0.35);
  Body.setVelocity(cover.body, { x: 15, y: 0 });
  const hp = e.hp;
  step(g, 3);
  assert(e.hp < hp);
});

test('all three lanes lock before the first shot, finish in order, and keep their original aim', () => {
  const { g, e, rig } = fixture('bottom');
  beginCrawlerAttack(g, e);
  const began = g.time;
  const fired: { angle: number; time: number; origin: unknown }[] = [];
  const fire = g.enemyShot.bind(g);
  g.enemyShot = (enemy, a, s, d, p) => {
    fired.push({ angle: a, time: g.time, origin: p && { ...p } });
    fire(enemy, a, s, d, p);
  };
  step(g, 15);
  Body.setPosition(g.player, { x: 1200, y: 600 });
  until(g, () => e.timer <= CRAWLER.lock);
  const angles = [...rig.angles],
    origin = { ...rig.origin };
  Body.setPosition(g.player, { x: 1400, y: 300 });
  until(g, () => e.attacks === 1);
  assert.equal(fired.length, 3);
  assert.deepEqual(
    fired.map((s) => s.angle),
    angles,
  );
  assert(fired.every((s) => distance(s.origin as { x: number; y: number }, origin) < 0.01));
  assert(fired[0].time - began >= CRAWLER.tell - 1e-5);
  assert(fired[1].time - fired[0].time >= CRAWLER.burst - 1 / 60);
  assert.equal(e.state, 'recover');
  assert.equal(rig.fired, 3);
});

test('breaking the actual host interrupts the windup or remaining burst, causes a fall and exposes the hull', () => {
  for (const afterShot of [false, true]) {
    const { g, e, b, piece, rig } = fixture('bottom');
    beginCrawlerAttack(g, e);
    if (afterShot) until(g, () => rig.fired === 1);
    const fired = rig.fired,
      oldShots = g.shots.length,
      from = { ...e.body.position };
    g.destruction.hitBody(b, piece.hp, { x: 0, y: -10 });
    assert.equal(rig.support, undefined);
    assert.equal(e.state, 'recover');
    assert.equal(rig.angles.length, 0);
    assert.equal(rig.vulnerable, CRAWLER.stun);
    assert(!g.terrain.includes(b));
    const hp = e.hp;
    g.hitEnemy(e, 10);
    near(hp - e.hp, 15);
    step(g, 25);
    assert(e.body.position.y > from.y + 30);
    assert(e.body.position.x === from.x);
    assert.equal(e.attacks, 0);
    assert(g.shots.length <= oldShots);
    assert(fired === Number(afterShot));
    step(g, 100);
    assert(rig.support);
    assert.equal(rig.vulnerable, 0);
    const recovered = e.hp;
    g.hitEnemy(e, 10);
    near(recovered - e.hp, 10);
  }
});

test('gunfire can break the perch through the ordinary projectile path', () => {
  const { g, e, b, piece, rig } = fixture('bottom');
  piece.hp = 10;
  g.addShot({
    pos: { x: 800, y: 610 },
    vel: { x: 0, y: -20 },
    damage: 20,
    life: 1,
    friendly: true,
    radius: 2,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
  for (let n = 0; n < 4; n++) g.updateShots(1 / 60);
  assert(!g.terrain.includes(b));
  assert.equal(rig.support, undefined);
  assert(rig.vulnerable > 0);
  assert.equal(e.hp, e.maxHp);
});

test('displacement cancels a committed muzzle and missing or rotating hosts release attachment', () => {
  for (const mode of ['position', 'removed', 'rotated']) {
    const { g, e, b, rig } = fixture('bottom');
    beginCrawlerAttack(g, e);
    step(g, 30);
    if (mode === 'position') Body.translate(e.body, { x: 30, y: 0 });
    if (mode === 'removed') g.terrain = g.terrain.filter((p) => p !== b);
    if (mode === 'rotated') Body.rotate(b, 0.1);
    step(g);
    assert.equal(rig.angles.length, 0);
    assert.equal(rig.fired, 0);
    assert.equal(g.shots.length, 0);
    if (mode !== 'position') assert.equal(rig.support, undefined);
  }
});

test('thin cover catches every hostile round and can intercept the muzzle itself', () => {
  for (const nearMuzzle of [false, true]) {
    const { g, e, rig } = fixture('bottom');
    Body.setPosition(g.player, { x: 1200, y: 587 });
    beginCrawlerAttack(g, e);
    step(g, 30);
    const b = Bodies.rectangle(nearMuzzle ? 718 : 900, 610, 3, 90, { isStatic: true });
    g.terrain.push(b);
    Composite.add(g.engine.world, b);
    until(g, () => e.attacks === 1);
    step(g, 80);
    assert.equal(g.hp, 100);
    assert.equal(g.shots.length, 0);
    assert.equal(rig.fired, 3);
  }
});

test('pauses and hitstop freeze movement and tells; death and retry cannot release a stale burst', () => {
  const { g, e, rig } = fixture('bottom');
  beginCrawlerAttack(g, e);
  step(g, 15);
  const p = { ...e.body.position },
    timer = e.timer;
  g.setMode('paused');
  step(g, 100);
  assert.deepEqual(e.body.position, p);
  near(e.timer, timer);
  g.setMode('playing');
  g.hitStop = 0.1;
  step(g, 4);
  assert.deepEqual(e.body.position, p);
  near(e.timer, timer);
  g.hitStop = 0;
  until(g, () => rig.fired === 1);
  g.hitEnemy(e, 99999);
  const count = g.shots.length;
  step(g, 40);
  assert(g.shots.length <= count);
  g.start('retry-crawler');
  assert(!g.enemies.includes(e));
  assert.equal(g.shots.length, 0);
});

test('portal travel releases the old grip and remaining rounds before the next enemy update', () => {
  const { g, e, rig } = fixture('bottom');
  g.mods = ['fold'];
  g.gun = getGun(g.mods);
  assert(g.portals.place({ x: 600, y: 740 }));
  assert(g.portals.place({ x: 1100, y: 740 }));
  beginCrawlerAttack(g, e);
  until(g, () => rig.fired === 1);
  Body.setPosition(e.body, { x: 600, y: 720 });
  Body.setVelocity(e.body, { x: 0, y: 16 });
  g.portals.beforeStep();
  Matter.Engine.update(g.engine, 1000 / 60);
  assert(e.body.position.x > 1000);
  assert.equal(rig.support, undefined);
  assert.equal(rig.angles.length, 0);
  assert.equal(e.state, 'recover');
  const count = g.shots.length;
  step(g, 10);
  assert(g.shots.length <= count);
});

test('climbing the arena boundary cannot carry the crawler outside the playable space', () => {
  const { g, e, rig } = fixture();
  Body.setPosition(e.body, { x: 17, y: 100 });
  rig.support = undefined;
  e.timer = 100;
  Body.setPosition(g.player, { x: 1500, y: 700 });
  for (let n = 0; n < 450; n++) {
    step(g);
    assert(e.body.position.x >= 13.9 && e.body.position.x <= g.worldWidth - 13.9);
    assert(e.body.position.y >= g.worldTop + 13.9 && e.body.position.y <= 726.1);
  }
  assert(rig.support);
});

test('ordinary reinforcement relocation never chooses a ceiling-only crawler anchor', () => {
  const { g } = fixture();
  g.level.spawns = [
    { kind: 'shooter', x: 900, y: 724 },
    { kind: 'wallcrawler', x: 700, y: 587 },
  ];
  const door = {
    spawn: { kind: 'shooter' as const, x: 900, y: 724 },
    state: 'warning' as const,
    timer: 0,
    blocked: 0.6,
    attackDelay: 1,
  };
  g.waves.doors = [door];
  g.waves.relocate(door);
  assert.deepEqual(door.spawn, { kind: 'shooter', x: 900, y: 724 });
});

test('wallcrawler placements are sparse, supported, deterministic, and preserve existing elites', () => {
  const seen = new Set<string>();
  for (let n = 0; n < 70; n++)
    for (let stage = 0; stage < 20; stage++) {
      const seed = 'crawler-placement-' + n,
        l = getLevel(seed, stage),
        c = l.spawns.filter((s) => s.kind === 'wallcrawler');
      assert(c.length <= 1);
      if (!c.length) continue;
      seen.add(l.area + ':' + l.mirrored);
      assert(stage >= 8 && !l.boss && !l.detour && !l.freight && !l.setpiece && !l.crossing);
      assert(!c[0].elite && !c[0].squad);
      assert.deepEqual(l, getLevel(seed, stage));
      assert(
        l.solids.some((s) => {
          const x = Math.max(s.x, Math.min(c[0].x, s.x + s.w)),
            y = Math.max(s.y, Math.min(c[0].y, s.y + s.h));
          return Math.abs(Math.hypot(c[0].x - x, c[0].y - y) - 17) < 0.01;
        }),
      );
      assert.equal(l.spawns.filter((s) => s.elite).length, stage >= 16 ? 2 : 1);
      const ot = getOvertimeLevel(seed, stage);
      assert(!ot.crawlerIntro);
      assert(ot.spawns.filter((s) => s.kind === 'wallcrawler').length <= 1);
    }
  assert.equal(seen.size, 6);
});

test('normal and Daily entrances reconstruct the same crawler and complete world-safe anchors', () => {
  for (const seed of ['CRAWLER-54-2', dailyForDate('2026-09-12')!.seed])
    for (const stage of [8, 9, 16, 17]) {
      const a = new Game(),
        b = new Game();
      a.seed = b.seed = seed;
      a.stage = b.stage = stage;
      a.loadRoom();
      b.loadRoom();
      assert.deepEqual(a.level, b.level);
      for (const s of a.level.spawns.filter((s) => s.kind === 'wallcrawler')) {
        const hull = Bodies.circle(s.x, s.y, 14);
        assert.equal(Query.collides(hull, a.solidBodies).length, 0, seed + ':' + stage);
      }
    }
});

test('test links use real cracked perches and preserve saves, records and earned encounters', () => {
  for (const area of ['cooling', 'rooftops'])
    for (const mirror of [0, 1]) {
      const save = wallcrawlerTestFromUrl(
        new URL(`https://test/?test=wallcrawler&area=${area}&mirror=${mirror}`),
      );
      assert(save && loadCheckpoint(save));
      const g = new Game(),
        writes: unknown[] = [],
        wins: unknown[] = [];
      g.onCheckpoint = (s) => writes.push(s);
      g.onBossDefeated = (k) => wins.push(k);
      g.startTest(save);
      assert.equal(g.level.mirrored, !!mirror);
      assert.equal(g.stage, area === 'cooling' ? 8 : 16);
      const spawn = g.level.spawns.find((s) => s.kind === 'wallcrawler')!;
      assert(
        g.destruction.pieces.some(
          ({ rect: s }) =>
            spawn.x >= s.x - 18 &&
            spawn.x <= s.x + s.w + 18 &&
            spawn.y >= s.y - 18 &&
            spawn.y <= s.y + s.h + 18,
        ),
      );
      g.die();
      g.startTest(save);
      assert.deepEqual(writes, []);
      assert.deepEqual(wins, []);
    }
  for (const query of [
    '&area=bad',
    '&area=cooling&area=cooling',
    '&mirror=2',
    '&mirror=1&mirror=1',
    '&seed=x',
    '&daily=x',
    '&dv=1',
    '&route=high',
    '&mode=overtime',
    '&test=wallcrawler',
  ])
    assert.equal(wallcrawlerTestFromUrl(new URL('https://test/?test=wallcrawler' + query)), null);
});

for (const mirror of [0, 1])
  test(`Cooling introduction is beatable with its real preset and normal inputs, mirror=${mirror}`, () => {
    const g = new Game();
    g.startTest(
      wallcrawlerTestFromUrl(new URL('https://test/?test=wallcrawler&mirror=' + mirror))!,
    );
    const e = g.enemies.find((e) => e.kind === 'wallcrawler')!;
    assert(e);
    for (let n = 0; n < 7200 && e.hp > 0 && g.mode === 'playing'; n++)
      g.tick(1 / 60, { ...idle, jumpHeld: true, ...dodgePilot(g, e) });
    assert(g.hp > 0 && e.hp <= 0, `${g.hp} player HP; ${e.hp} crawler HP`);
    step(g, 100);
    assert(
      g.enemies.some((other) => other !== e),
      'Winning the introduction releases the rest of the room',
    );
  });
