import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy } from '../src/game.ts';
import {
  enemyRemasterTestFromUrl,
  enemyEncounterLevel,
  enemyEncounterRoom,
  ENEMY_ENCOUNTERS,
} from '../src/enemy-encounters.ts';
import {
  enemyRemasterSeed,
  remasterEligible,
  REMASTER_TELL,
  standingSurface,
} from '../src/enemy-remaster.ts';
import { machineWear, drawRemasteredBody, drawRemasterTell } from '../src/enemy-remaster-art.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { newCampaignSeed } from '../src/run-seed.ts';
import { splitWaves } from '../src/reinforcements.ts';
import { shapeEncounter, encounterPlan } from '../src/encounter-pacing.ts';
import { loadCheckpoint, validBuild } from '../src/rules.ts';
import { snapshotRun } from '../src/run-history.ts';
import { roomRematchSnapshot, RoomRematch } from '../src/room-rematch.ts';
import { rematchEntry } from '../src/room-rematch.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';

const { Body, Bodies, Composite } = Matter;
const idle = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1500, y: 500 },
};
const checkpoint = (query: string) =>
  enemyRemasterTestFromUrl(new URL('https://test/?test=enemies&v=1&' + query))!;
function start(query: string) {
  const g = new Game();
  g.startTest(checkpoint(query));
  return g;
}
function tick(g: Game, n = 1) {
  for (let i = 0; i < n && g.mode === 'playing'; i++) g.tick(1 / 60, idle);
}
function until(g: Game, predicate: () => boolean, frames = 800) {
  for (let i = 0; i < frames && !predicate() && g.mode === 'playing'; i++) tick(g);
  assert(predicate());
}
function solo(kind: string) {
  const g = start('unit=' + kind);
  tick(g, 50);
  return { g, e: g.enemies[0] };
}

test('new seed revision opts in while archived Campaign and Daily identities remain unchanged', () => {
  assert(enemyRemasterSeed(newCampaignSeed(undefined, () => 123)));
  for (const seed of ['RF-C92-OLD', 'RF-D90-2026-10-22', 'RECOIL', 'RF-C89-EXP'])
    assert(!enemyRemasterSeed(seed));
  for (const kind of ['runner', 'shooter', 'flyer']) {
    const { g, e } = solo(kind);
    assert(e.remaster, kind);
    const current = g.seed;
    for (const seed of ['RF-C92-OLD', 'RF-D90-2026-10-22']) {
      g.seed = seed;
      assert(!remasterEligible(g, e));
    }
    g.seed = current;
    g.stage = 0;
    assert(!remasterEligible(g, e));
  }
});

test('six isolated URLs validate strictly and retries reconstruct the same room without progress', () => {
  for (const query of [
    'unit=runner',
    'unit=shooter',
    'unit=flyer',
    ...Object.keys(ENEMY_ENCOUNTERS).map((id) => 'encounter=' + id),
  ])
    for (const mirror of [0, 1]) {
      const g = start(query + '&mirror=' + mirror + '&gun=shotgun');
      assert(g.testRun);
      assert(validBuild(g.mods));
      assert.equal(g.startingGun, 'shotgun');
      const clone = new Game();
      clone.startTest(g.testRun!);
      assert.deepEqual(clone.level, g.level);
      let writes = 0;
      g.onCheckpoint = () => writes++;
      tick(g, 100);
      g.save();
      assert.equal(writes, 0);
    }
  for (const extra of [
    'unit=bogus',
    'unit=runner&encounter=split-level',
    'unit=runner&unit=flyer',
    'encounter=bad',
    'unit=runner&v=2',
    'unit=runner&gun=no',
    'unit=runner&mirror=9',
    'unit=runner&seed=abc',
    'unit=runner&extra=1',
    '',
  ])
    assert.equal(
      enemyRemasterTestFromUrl(new URL('https://test/?test=enemies&v=1&' + extra)),
      null,
      extra,
    );
});

test('runner warns for the full interval, commits straight, and recovers without contact damage', () => {
  const { g, e } = solo('runner');
  Body.setPosition(g.player, { x: 870, y: 722 });
  until(g, () => e.state === 'windup');
  const began = g.time,
    aim = { ...e.aim },
    x = e.body.position.x;
  Body.setPosition(g.player, { x: e.body.position.x + 180, y: 722 });
  until(g, () => e.state === 'rush');
  assert(g.time - began >= REMASTER_TELL.runner - 1 / 60);
  assert.deepEqual(e.aim, aim, 'turning after a warning would invalidate the dodge');
  tick(g, 8);
  assert((e.body.position.x - x) * aim.x > 15);
  until(g, () => e.state === 'recover');
  Body.setPosition(g.player, { ...e.body.position });
  const hp = g.hp;
  g.updateEnemy(e, 1 / 60);
  assert.equal(g.hp, hp);
});

test('runner checks the actual ledge and wall instead of dashing off or through cover', () => {
  const { g, e } = solo('runner');
  const platform = Bodies.rectangle(1100, 620, 180, 22, { isStatic: true });
  g.terrain.push(platform);
  Composite.add(g.engine.world, platform);
  Body.setPosition(e.body, { x: 1155, y: 592 });
  e.state = 'rush';
  e.timer = 0.3;
  e.aim = { x: 1, y: 0 };
  g.updateEnemy(e, 1 / 60);
  assert.equal(e.state, 'recover');
  assert.equal(e.body.velocity.x, 0);
  Body.setPosition(e.body, { x: 1000, y: 723 });
  const obstacle = g.props.spawn('cover', 1040, 697);
  e.state = 'rush';
  e.timer = 0.3;
  g.updateEnemy(e, 1 / 60);
  assert.equal(e.state, 'recover');
  assert(obstacle.body.bounds.min.x > e.body.position.x);
});

test('gunner walks for a useful lane, stops through its entire lock, and fires one unchanged direction', () => {
  const { g, e } = solo('shooter');
  assert(!e.body.isStatic);
  const startX = e.body.position.x;
  until(g, () => e.state === 'windup');
  assert(Math.abs(e.body.position.x - startX) > 10, 'gunner must actually reposition');
  const began = g.time,
    at = { ...e.body.position },
    aim = { ...e.aim };
  Body.setPosition(g.player, { x: 1800, y: 620 });
  until(g, () => e.attacks === 1);
  assert(g.time - began >= REMASTER_TELL.shooter - 1 / 60);
  assert(Math.abs(e.body.position.x - at.x) < 1);
  assert.deepEqual(e.aim, aim);
  const shots = g.shots.filter((s) => !s.friendly);
  assert.equal(shots.length, 1);
  assert(Math.abs(Math.atan2(shots[0].vel.y, shots[0].vel.x) - Math.atan2(aim.y, aim.x)) < 1e-8);
});

test('gunner respects narrow platform edges, live cover, and destruction of its supporting terrain', () => {
  const g = start('encounter=split-level');
  tick(g, 50);
  const e = g.enemies[0];
  assert(e.remaster && e.kind === 'shooter');
  const support = standingSurface(g, e)!;
  assert(support);
  Body.setPosition(g.player, { x: 1850, y: 722 });
  // Exercise repeated replanning without giving enemy projectiles a player to kill.
  for (let i = 0; i < 1400; i++) {
    g.time += 1 / 60;
    g.updateEnemy(e, 1 / 60);
    Matter.Engine.update(g.engine, 1000 / 60);
    assert(e.body.bounds.min.x >= support.bounds.min.x - 1);
    assert(e.body.bounds.max.x <= support.bounds.max.x + 1);
  }
  const before = e.body.position.x;
  Composite.remove(g.engine.world, support);
  g.terrain = g.terrain.filter((b) => b !== support);
  g.updateEnemy(e, 1 / 60);
  assert.equal(e.body.velocity.x, 0);
  assert.equal(e.body.position.x, before);
});

test('flyer changes flank only between volleys and its three warned lanes retain their aim', () => {
  const { g, e } = solo('flyer');
  until(g, () => e.state === 'windup');
  const side = e.remaster!.side,
    began = g.time,
    aim = { ...e.aim },
    pos = { ...e.body.position };
  Body.setPosition(g.player, { x: 1700, y: 722 });
  until(g, () => e.attacks === 1);
  assert(g.time - began >= REMASTER_TELL.flyer - 1 / 60);
  assert.deepEqual(e.aim, aim);
  assert(Math.abs(e.body.position.x - pos.x) < 1);
  assert.equal(e.remaster!.side, -side);
  const shots = g.shots.filter((s) => !s.friendly);
  assert.equal(shots.length, 3);
  const base = Math.atan2(aim.y, aim.x);
  for (let i = 0; i < 3; i++)
    assert(
      Math.abs(
        Math.atan2(
          Math.sin(Math.atan2(shots[i].vel.y, shots[i].vel.x) - base),
          Math.cos(Math.atan2(shots[i].vel.y, shots[i].vel.x) - base),
        ) - [-0.18, 0, 0.18][i],
      ) < 1e-8,
    );
  until(g, () => e.state === 'idle');
  const x = e.body.position.x;
  tick(g, 15);
  assert(Math.abs(e.body.position.x - x) > 5);
});

test('ordinary attack admission holds a new gunner before the warning without changing committed tells', () => {
  const { g, e } = solo('shooter');
  Body.setPosition(g.player, { x: 140, y: 600 });
  e.timer = 0;
  e.state = 'idle';
  const rival = g.spawnEnemy('sniper', 1300, 723)!;
  rival.spawn = 0;
  rival.state = 'windup';
  rival.timer = 5;
  assert(g.encounterPacer.request(rival, true, 5));
  g.updateEnemy(e, 1 / 60);
  assert.equal(e.state, 'idle');
  rival.state = 'idle';
  g.encounterPacer.grants.clear();
  g.updateEnemy(e, 1 / 60);
  assert.equal(e.state, 'windup');
  rival.state = 'windup';
  const timer = e.timer;
  g.updateEnemy(e, 1 / 60);
  assert.equal(e.timer, timer - 1 / 60);
});

test('three authored rooms preserve the solo opener, safe actor hulls and mirrored geometry', () => {
  const overlap = (
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number },
  ) =>
    Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.1 &&
    Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.1;
  for (const id of Object.keys(ENEMY_ENCOUNTERS) as (keyof typeof ENEMY_ENCOUNTERS)[])
    for (const mirror of [false, true]) {
      const g = start('encounter=' + id + (mirror ? '&mirror=1' : '')),
        l = g.level;
      const [opening, reserve] = splitWaves(l, g.seed, g.stage);
      shapeEncounter(opening, reserve, l, encounterPlan(l, g.seed, g.stage));
      assert.equal(opening.length, 1);
      assert.equal(opening[0].kind, l.remasterIntro);
      assert.equal(opening.length + reserve.length, l.spawns.length);
      assert.equal(g.waves.plan?.deadline, 10);
      assert.equal(g.waves.plan?.cap, 3);
      for (const s of l.spawns) {
        const { w, h } = ENEMY_STATS[s.kind],
          hull = { x: s.x - w / 2, y: s.y - h / 2, w, h };
        for (const solid of l.solids) assert(!overlap(hull, solid), id + ' actor inside terrain');
        for (const prop of g.props.items)
          assert(
            !overlap(hull, {
              x: prop.body.bounds.min.x,
              y: prop.body.bounds.min.y,
              w: prop.body.bounds.max.x - prop.body.bounds.min.x,
              h: prop.body.bounds.max.y - prop.body.bounds.min.y,
            }),
            id + ' actor inside prop',
          );
      }
      assert(l.route[0].x < l.route.at(-1)!.x);
      assert.equal(l.id, enemyEncounterLevel(id, mirror).id);
    }
});

test('encounters install in eligible fresh Campaign rooms and leave jobs, first rooms and special introductions intact', () => {
  const g = new Game();
  g.start('RF-C93-CAMPAIGN');
  for (const [id, room] of Object.entries(ENEMY_ENCOUNTERS)) {
    g.stage = room.stage;
    g.factory = null;
    g.areaEvents.clear();
    g.security = null;
    const plain = {
      ...enemyEncounterLevel(id as keyof typeof ENEMY_ENCOUNTERS),
      enemyEncounter: undefined,
      remasterIntro: undefined,
    };
    assert.equal(enemyEncounterRoom(g, plain).enemyEncounter, id);
    for (const extra of [
      { machineIntro: 'mortar' },
      { teamworkIntro: 'relay' },
      { story: 'test' },
      { uprising: 'railworks' },
      { boss: true },
      { routeChoice: {} },
      { freight: true },
      { annex: true },
    ]) {
      const l = { ...plain, ...extra } as typeof plain;
      assert.equal(enemyEncounterRoom(g, l), l);
    }
  }
  g.stage = 0;
  const l = enemyEncounterLevel('pursuit-lane');
  assert.equal(enemyEncounterRoom(g, l), l);
});

test('wear and reduced-effects art cannot alter health, shots, physics, RNG or damage rules', () => {
  const { g, e } = solo('runner');
  const context = new Proxy(
    {},
    { get: (_, key) => (key === 'measureText' ? () => ({ width: 0 }) : () => {}), set: () => true },
  ) as CanvasRenderingContext2D;
  for (const ratio of [1, 0.65, 0.3]) {
    e.hp = e.maxHp * ratio;
    const before = JSON.stringify({
      hp: e.hp,
      body: e.body.position,
      time: g.time,
      state: e.state,
      shots: g.shots,
      particles: g.particles,
    });
    drawRemasteredBody(context, g, e, false);
    drawRemasteredBody(context, g, e, true);
    drawRemasterTell(context, g, e);
    assert.equal(
      JSON.stringify({
        hp: e.hp,
        body: e.body.position,
        time: g.time,
        state: e.state,
        shots: g.shots,
        particles: g.particles,
      }),
      before,
    );
    assert.equal(machineWear(e), ratio === 1 ? 0 : ratio === 0.65 ? 1 : 2);
  }
  e.hp = 1;
  const count = g.particles.length;
  g.hitEnemy(e, 1000);
  assert(g.particles.length - count <= 16);
  assert.equal(g.enemies.length, 0);
});

test('all three ground routes work forward and backward with ordinary movement and no upgrades', () => {
  for (const id of Object.keys(ENEMY_ENCOUNTERS))
    for (const mirror of [0, 1])
      for (const reverse of [false, true]) {
        const g = start('encounter=' + id + '&mirror=' + mirror);
        for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
        g.enemies = [];
        g.waves.clear();
        g.areaEvents.clear();
        g.hazards.clear();
        Body.setPosition(g.player, { x: reverse ? 1860 : 140, y: 680 });
        const path = (reverse ? [...g.level.route].reverse() : [...g.level.route]).concat([
          { x: reverse ? 110 : 1890, y: 716 },
        ]);
        let index = 0,
          stuck = 0,
          lastX = g.player.position.x;
        for (let frame = 0; frame < 4200 && index < path.length && g.mode === 'playing'; frame++) {
          const p = g.player.position,
            target = path[index],
            dx = target.x - p.x,
            dy = p.y - target.y;
          if (Math.abs(dx) < 40 && Math.abs(dy) < 65) {
            index++;
            continue;
          }
          stuck = Math.abs(p.x - lastX) < 0.4 ? stuck + 1 : 0;
          lastX = p.x;
          const move = Math.sign(dx),
            blocked =
              Matter.Query.ray(g.solidBodies, p, { x: p.x + move * 70, y: p.y }, 24).length > 0;
          g.tick(1 / 60, {
            ...idle,
            left: move < 0,
            right: move > 0,
            jump: g.grounded && (dy > 50 || blocked || stuck > 12),
            jumpHeld: true,
          });
          if (g.mode === 'upgrade' && !reverse) {
            index = path.length;
            break;
          }
        }
        assert.equal(
          index,
          path.length,
          `${id} mirror ${mirror} reverse ${reverse}: stopped at ${index}`,
        );
      }
});

test('room-one patrols retain their simple behavior under the fresh Campaign revision', () => {
  for (let i = 0; i < 12; i++) {
    const g = new Game();
    g.start('RF-C93-OPEN-' + i);
    assert.equal(g.stage, 0);
    assert(!g.level.enemyEncounter);
    assert.equal(g.areaEvents.encounter, null);
    tick(g, 240);
    assert(g.enemies.every((e) => !e.remaster));
  }
});

test('pause and hitstop preserve a committed warning and its locked target', () => {
  for (const kind of ['runner', 'shooter', 'flyer']) {
    const { g, e } = solo(kind);
    if (kind === 'runner') Body.setPosition(g.player, { x: 870, y: 722 });
    until(g, () => e.state === 'windup');
    const before = { timer: e.timer, aim: { ...e.aim }, time: g.time };
    g.setMode('paused');
    g.tick(0.1, idle);
    assert.equal(e.timer, before.timer);
    assert.equal(g.time, before.time);
    g.setMode('playing');
    g.hitStop = 0.1;
    g.tick(1 / 60, idle);
    assert.equal(e.timer, before.timer);
    assert.deepEqual(e.aim, before.aim);
  }
});

test('continued and copied new Campaign rooms retain their authored encounter and enemy rules', () => {
  const original = new Game();
  original.start('RF-C93-SAVE-CHECK');
  original.factory = null;
  original.areaEvents.clear();
  original.stage = 2;
  original.loadRoom();
  tick(original, 50);
  assert.equal(original.level.enemyEncounter, 'pursuit-lane');
  assert(original.enemies[0].remaster);
  const save = original.checkpointSnapshot(),
    continued = new Game();
  const loaded = loadCheckpoint(save);
  assert(loaded);
  continued.start(loaded.seed, loaded);
  assert.deepEqual(continued.level, original.level);
  tick(continued, 50);
  assert(continued.enemies[0].remaster);
  const entry = rematchEntry(original);
  assert(entry);
  original.damagePlayer(10000, undefined, { type: 'fall' });
  const snapshot = roomRematchSnapshot(original, entry);
  assert(snapshot);
  const session = new RoomRematch(snapshot);
  for (let i = 0; i < 8; i++) {
    session.reset();
    session.game.setMode('playing');
    tick(session.game, 50);
    assert.deepEqual(session.game.level, original.level);
    assert(session.game.enemies[0].remaster);
  }
  session.dispose();
  assert.equal(Composite.allBodies(session.game.engine.world).length, 0);
});

test('rebooted allies leave the remastered hostile state machine before running allied behavior', () => {
  const { g, e } = solo('shooter');
  until(g, () => e.state === 'windup');
  e.allied = true;
  g.enemies = g.enemies.filter((x) => x !== e);
  g.areaEvents.allies.push(e);
  const other = g.spawnEnemy('runner', 1400, 723)!;
  other.spawn = 0;
  g.updateEnemy(e, 1 / 60);
  assert(!e.remaster);
  assert.equal(e.state, 'idle');
});

test('the gunner deck is reachable with every unmodified starting tool from either mirrored entrance', () => {
  for (const gun of STARTING_GUN_IDS)
    for (const mirror of [0, 1]) {
      const g = start(`encounter=split-level&gun=${gun}&mirror=${mirror}`);
      for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
      g.enemies = [];
      g.waves.clear();
      g.hazards.clear();
      g.areaEvents.clear();
      const deck = g.level.solids.find((s) => s.h === 22)!,
        launch = deck.x - 55,
        landing = deck.x + 55;
      let phase = 'approach',
        landed = false;
      for (let frame = 0; frame < 3600 && g.mode === 'playing'; frame++) {
        const p = g.player.position;
        if (phase === 'approach' && Math.abs(p.x - launch) < 14) phase = 'rise';
        if (phase === 'rise' && p.y < deck.y - 65) phase = 'land';
        const dx = (phase === 'land' ? landing : launch) - p.x,
          move = dx > 8 ? 1 : dx < -8 ? -1 : 0;
        const blocked =
          move && Matter.Query.ray(g.solidBodies, p, { x: p.x + move * 65, y: p.y }, 24).length > 0;
        g.tick(1 / 60, {
          ...idle,
          left: move < 0,
          right: move > 0,
          jump: g.grounded && (phase === 'rise' || !!blocked),
          jumpHeld: true,
          fire: phase === 'rise',
          aim: { x: p.x, y: p.y + 500 },
        });
        if (
          phase === 'land' &&
          g.grounded &&
          Math.abs(g.player.position.x - landing) < 40 &&
          Math.abs(g.player.position.y - (deck.y - 18)) < 12
        ) {
          landed = true;
          break;
        }
      }
      assert(landed, `${gun} mirror ${mirror}: failed to reach the gunner deck`);
    }
});

test('the runner arrow has a visible travel length above the floor and stops at solid cover', () => {
  const { g, e } = solo('runner');
  e.state = 'windup';
  e.timer = 0.3;
  e.aim = { x: 1, y: 0 };
  const segments: { a: number[]; b: number[] }[] = [];
  let from: number[] = [];
  const context = new Proxy(
    {
      moveTo: (x: number, y: number) => {
        from = [x, y];
      },
      lineTo: (x: number, y: number) => segments.push({ a: from, b: [x, y] }),
    },
    { get: (obj, key) => Reflect.get(obj, key) ?? (() => {}), set: () => true },
  ) as CanvasRenderingContext2D;
  drawRemasterTell(context, g, e);
  assert(segments[0].b[0] - segments[0].a[0] > 100);
  const cover = g.props.spawn('cover', e.body.position.x + 90, 697);
  segments.length = 0;
  drawRemasterTell(context, g, e);
  assert(segments[0].b[0] < cover.body.bounds.min.x);
});
