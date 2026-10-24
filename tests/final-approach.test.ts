import { testCheckpoint } from '../src/practice.ts';
import { planHunts } from '../src/hunt-rules.ts';
import { planFactory } from '../src/factory.ts';
import { uprisingTestFromUrl } from '../src/uprising-test.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { Level } from '../src/levels.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { loadCheckpoint } from '../src/rules.ts';
import {
  FINAL_APPROACH_IDS,
  FINAL_APPROACH_ROOMS,
  FINAL_APPROACH_WARNING,
  FINAL_APPROACH_DAMAGE,
  finalApproachLevel,
  finalApproachStrike,
  finalApproachTestFromUrl,
  getFinalApproachRoom,
} from '../src/final-approach.ts';

function checkpoint(id: string, mirror = false, route?: 'low' | 'high') {
  const save = finalApproachTestFromUrl(
    new URL(
      'https://test/?test=approach&room=' +
        id +
        '&v=1&mirror=' +
        (mirror ? 1 : 0) +
        (route ? '&route=' + route : ''),
    ),
  );
  assert(save);
  assert(loadCheckpoint(save));
  return save;
}
function start(id: string, mirror = false, route?: 'low' | 'high') {
  const g = new Game();
  g.startTest(checkpoint(id, mirror, route));
  return g;
}
const navigationCases = [
  ...FINAL_APPROACH_IDS.flatMap((id) =>
    [false, true].map((mirror) => ({ id, mirror, route: undefined as 'low' | 'high' | undefined })),
  ),
  ...(['low', 'high'] as const).flatMap((route) =>
    [false, true].map((mirror) => ({ id: 'reactor-verge' as const, mirror, route })),
  ),
];
function advance(g: Game, seconds: number) {
  for (let n = 0; n < Math.ceil(seconds * 60); n++) {
    g.time += 1 / 60;
    g.finalApproach.beforeStep(1 / 60);
  }
}
const ordinary: Level = {
  id: 'ordinary-rooftop',
  name: 'Patrol',
  area: 'rooftops',
  boss: false,
  mirrored: false,
  solids: [],
  spawns: [],
  route: [{ x: 1880, y: 716 }],
};
const overlap = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.1 &&
  Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.1;

test('three isolated links reconstruct the authored rooms with native pistol and mirrored geometry', () => {
  for (const id of FINAL_APPROACH_IDS)
    for (const mirror of [false, true]) {
      const g = start(id, mirror),
        room = FINAL_APPROACH_ROOMS[id];
      assert.equal(getFinalApproachRoom(g.level), id);
      assert.equal(g.stage, room.stage);
      assert.equal(g.startingGun, 'pistol');
      assert.deepEqual(g.mods, []);
      assert(g.finalApproach.active);
      assert.deepEqual(
        g.level.solids,
        room.solids.map((s) => ({ ...s, x: mirror ? 2000 - s.x - s.w : s.x })),
      );
      assert.equal(g.level.spawns.length, room.spawns.length);
      assert(g.level.spawns.length <= 4);
      assert(g.level.route[0].x < g.level.route.at(-1)!.x);
      const clone = start(id, mirror);
      assert.deepEqual(clone.level, g.level);
    }
  for (const extra of [
    '&room=signal-yard',
    '&v=2',
    '&mirror=2',
    '&seed=custom',
    '&gun=nailgun',
    '&build=beam',
  ])
    assert.equal(
      finalApproachTestFromUrl(new URL('https://test/?test=approach&room=signal-yard&v=1' + extra)),
      null,
    );
  assert.equal(
    finalApproachTestFromUrl(new URL('https://test/?test=approach&room=unknown&v=1')),
    null,
  );
});

test('legacy campaigns, Dailies and reserved mission/security geometry remain untouched', () => {
  const g = new Game();
  g.stage = 17;
  for (const seed of ['RF-C97-OLD', 'RF-D98-2026-10-24', 'RF-C96-OLD']) {
    g.seed = seed;
    assert.equal(finalApproachLevel(g, ordinary), ordinary);
  }
  g.seed = 'RF-C98-NEW';
  const reserved: Partial<Level>[] = [
    { boss: true },
    { security: true },
    { detour: true },
    { hunt: 'bulwark' },
    { uprising: 'rooftops' },
    { story: 'escape' as Level['story'] },
    { courier: true },
    { floodgate: true },
    { sortingPit: true },
    { annex: true },
    { shutdown: true },
    { freight: true },
    { crossing: true },
    { fabricatorIntro: true },
    { machineIntro: 'mortar' },
  ];
  for (const patch of reserved) {
    const base = { ...ordinary, ...patch };
    const before = structuredClone(base);
    assert.equal(finalApproachLevel(g, base), base);
    assert.deepEqual(base, before);
  }
  for (const stage of [0, 15, 19]) {
    g.stage = stage;
    assert.equal(finalApproachLevel(g, ordinary), ordinary);
  }
  g.stage = 17;
  const before = structuredClone(ordinary);
  assert.notEqual(finalApproachLevel(g, ordinary), ordinary);
  assert.deepEqual(ordinary, before);
});

test('authored patrols, entrance, exit and optional hunt approach have physical clearance', () => {
  for (const id of FINAL_APPROACH_IDS)
    for (const mirror of [false, true]) {
      const g = start(id, mirror);
      const actors = [
        { x: 127, y: 680, w: 26, h: 36 },
        { x: 1840, y: 590, w: 160, h: 150 },
        ...g.level.spawns.map((s) => {
          const d = ENEMY_STATS[s.kind];
          return { x: s.x - d.w / 2, y: s.y - d.h / 2, w: d.w, h: d.h };
        }),
      ];
      for (const actor of actors)
        for (const solid of g.level.solids)
          assert(!overlap(actor, solid), id + ' hull intersects terrain');
      for (const s of g.level.solids) {
        assert(s.x >= 300 && s.x + s.w <= 1700);
        assert(s.y >= 400);
      }
    }
});

test('one locked field gives a full warning, fires once and cancels on room clear', () => {
  for (const id of FINAL_APPROACH_IDS) {
    const g = start(id);
    Matter.Body.setPosition(g.player, { x: 700, y: 720 });
    g.finalApproach.timer = 0;
    advance(g, 1 / 60);
    const strike = g.finalApproach.strike!;
    assert(strike);
    assert.equal(strike.left, FINAL_APPROACH_WARNING);
    const locked = structuredClone(strike.rects),
      hp = g.hp;
    g.mode = 'paused';
    advance(g, 1);
    assert.equal(strike.left, FINAL_APPROACH_WARNING);
    g.mode = 'playing';
    advance(g, 1.6);
    assert.equal(g.hp, hp);
    assert(!strike.fired);
    assert.deepEqual(strike.rects, locked);
    advance(g, 0.06);
    assert(strike.fired);
    assert.equal(g.hp, hp - FINAL_APPROACH_DAMAGE);
    advance(g, 0.2);
    assert.equal(g.hp, hp - FINAL_APPROACH_DAMAGE);
    g.clear = true;
    advance(g, 1 / 60);
    assert.equal(g.finalApproach.strike, null);
    advance(g, 12);
    assert.equal(g.hp, hp - FINAL_APPROACH_DAMAGE);
  }
});

test('moving out of a marked lane or above a floor field is safe without a damage upgrade', () => {
  for (const id of FINAL_APPROACH_IDS)
    for (const mirror of [false, true]) {
      const g = start(id, mirror);
      Matter.Body.setPosition(g.player, { x: 900, y: 720 });
      g.finalApproach.timer = 0;
      advance(g, 1 / 60);
      const strike = g.finalApproach.strike!,
        saved = structuredClone(strike.rects),
        hp = g.hp;
      Matter.Body.setPosition(
        g.player,
        strike.kind === 'floor' ? { x: 900, y: 600 } : { x: 1250, y: 720 },
      );
      advance(g, 1.7);
      assert.deepEqual(strike.rects, saved);
      assert.equal(g.hp, hp);
    }
  for (const id of FINAL_APPROACH_IDS)
    for (const mirrored of [false, true])
      for (const x of [140, 600, 1100, 1880]) {
        const field = finalApproachStrike(id, 1, x, mirrored);
        assert.equal(field.rects.length, 1);
        const s = field.rects[0];
        assert(s.w <= 340 && s.x >= 300 && s.x + s.w <= 1700);
        assert(s.w < 2000 - 600);
      }
});

test('ordinary walking and jumping traverses every ground route in both directions and mirrors', () => {
  for (const { id, mirror, route } of navigationCases)
    for (const reverse of [false, true]) {
      const g = start(id, mirror, route);
      for (const e of g.enemies) Matter.Composite.remove(g.engine.world, e.body);
      g.enemies = [];
      g.waves.clear();
      g.areaEvents.clear();
      g.hazards.clear();
      g.finalApproach.clear();
      g.clear = true;
      g.clearAt = g.time + 1000;
      Matter.Body.setPosition(g.player, { x: reverse ? 1860 : 140, y: 680 });
      const path = (reverse ? [...g.level.route].reverse() : [...g.level.route]).concat([
        { x: reverse ? 110 : 1890, y: 716 },
      ]);
      let index = 0,
        stuck = 0,
        lastX = g.player.position.x;
      for (let tick = 0; tick < 2400 && index < path.length && g.mode === 'playing'; tick++) {
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
        const move = dx > 12 ? 1 : dx < -12 ? -1 : 0;
        const blocked =
          move && Matter.Query.ray(g.solidBodies, p, { x: p.x + move * 70, y: p.y }, 24).length > 0;
        g.tick(1 / 60, {
          left: move < 0,
          right: move > 0,
          jump: g.grounded && (dy > 50 || !!blocked || stuck > 12),
          jumpHeld: true,
          fire: false,
          aim: { x: p.x, y: p.y + 500 },
        });
      }
      assert.equal(
        index,
        path.length,
        id +
          ' ' +
          mirror +
          ' ' +
          reverse +
          ' stopped at ' +
          index +
          ' ' +
          JSON.stringify(g.player.position),
      );
      assert.deepEqual(g.mods, []);
    }
});

test('an unmodified pistol reaches each optional upper route through normal jumping and recoil', () => {
  for (const { id, mirror, route } of navigationCases) {
    const g = start(id, mirror, route);
    for (const e of g.enemies) Matter.Composite.remove(g.engine.world, e.body);
    g.enemies = [];
    g.waves.clear();
    g.areaEvents.clear();
    g.hazards.clear();
    g.finalApproach.clear();
    g.clear = true;
    g.clearAt = g.time + 1000;
    const deck = [...g.level.solids].filter((s) => s.h === 22).sort((a, b) => a.y - b.y)[0];
    const launch = deck.x - 55,
      landing = deck.x + 55;
    let phase = 'approach',
      landed = false;
    for (let tick = 0; tick < 2400 && g.mode === 'playing'; tick++) {
      const p = g.player.position;
      if (phase === 'approach' && Math.abs(p.x - launch) < 14) phase = 'rise';
      if (phase === 'rise' && p.y < deck.y - 65) phase = 'land';
      const dx = (phase === 'land' ? landing : launch) - p.x,
        move = dx > 8 ? 1 : dx < -8 ? -1 : 0;
      const blocked =
        move && Matter.Query.ray(g.solidBodies, p, { x: p.x + move * 65, y: p.y }, 24).length > 0;
      g.tick(1 / 60, {
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
    assert(landed, id + ' ' + mirror + ' could not reach upper route ' + JSON.stringify(deck));
    assert.deepEqual(g.mods, []);
  }
});

test('fresh Campaign hunt doors, Security squads and rooftop job objectives survive the remaster', () => {
  const seed = 'RF-C98-APPROACH-HUNT',
    hunts = planHunts(seed);
  hunts[0].phase = 'skipped';
  const save = {
    ...testCheckpoint(seed, 16),
    version: 6 as const,
    encounters: 1 as const,
    huntRules: 2 as const,
    hunts,
    factory: planFactory(seed, 4),
  };
  assert(loadCheckpoint(save));
  const h = new Game();
  h.start(seed, save);
  assert(h.finalApproach.active);
  assert(h.hunts.door);
  assert.equal(h.hunts.state!.phase, 'available');
  assert.equal(h.hunts.door.x, 1760);
  const security = {
    ...testCheckpoint('RF-C98-SECURITY', 16),
    version: 6 as const,
    encounters: 1 as const,
    security: { level: 3 as const, rules: 1 as const },
    factory: planFactory('RF-C98-SECURITY', 4),
  };
  assert(loadCheckpoint(security));
  const s = new Game();
  s.start(security.seed, security);
  assert(s.level.security);
  assert(!s.finalApproach.active);
  assert(s.level.spawns.some((spawn) => spawn.squad));
  const job = uprisingTestFromUrl(new URL('https://test/?test=uprising&route=roof-escape&v=1'))!;
  job.seed = 'RF-C98-UPRISING-roof-escape';
  assert(loadCheckpoint(job));
  const j = new Game();
  j.startTest(job);
  assert.equal(j.level.uprising, 'rooftops');
  assert(!j.finalApproach.active);
  assert(j.uprising.waiting);
  assert(j.uprising.evacuation);
});

test('the real stage17 reward routes enter distinct Reactor Verge variants and preserve their choice', () => {
  const designs = new Map<string, { solids: unknown; spawns: unknown }>();
  for (const choice of ['low', 'high'] as const)
    for (const mirrored of [false, true]) {
      let verified = false;
      for (let n = 0; n < 24 && !verified; n++) {
        const seed = 'RF-C98-FORK-' + n,
          g = new Game();
        g.start(seed, testCheckpoint(seed, 17));
        for (const e of g.enemies) Matter.Composite.remove(g.engine.world, e.body);
        g.enemies = [];
        g.waves.clear();
        g.areaEvents.clear();
        g.clear = true;
        assert(g.canChooseRoute);
        g.openReward(false, choice);
        assert.equal(g.mode, 'upgrade');
        assert.equal(g.enteringRoute, choice);
        g.chooseMod(g.offers[0].id);
        assert.equal(g.stage, 18);
        if (g.level.mirrored !== mirrored) continue;
        assert.equal(getFinalApproachRoom(g.level), 'reactor-verge');
        assert.equal(g.route, choice);
        assert.equal(g.level.routeChoice, choice);
        assert(g.finalApproach.active);
        assert.equal(g.level.spawns.length, 4);
        let saved: import('../src/rules.ts').Checkpoint | null = null;
        g.onCheckpoint = (value) => {
          saved = value;
        };
        g.save();
        assert(saved);
        assert(loadCheckpoint(saved));
        const continued = new Game();
        continued.start(seed, saved);
        assert.deepEqual(continued.level, g.level);
        assert.equal(continued.route, choice);
        if (!mirrored) designs.set(choice, { solids: g.level.solids, spawns: g.level.spawns });
        verified = true;
      }
      assert(verified, choice + ' mirror=' + mirrored + ' reward route was never reached');
    }
  assert.notDeepEqual(designs.get('low')!.solids, designs.get('high')!.solids);
  assert.notDeepEqual(designs.get('low')!.spawns, designs.get('high')!.spawns);
});
