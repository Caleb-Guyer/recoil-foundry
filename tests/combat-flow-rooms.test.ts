import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { Level } from '../src/levels.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { PROP_STATS } from '../src/props.ts';
import { loadCheckpoint, segmentBox, type Checkpoint } from '../src/rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import { testCheckpoint } from '../src/practice.ts';
import {
  COMBAT_FLOW_IDS,
  COMBAT_FLOW_ROOMS,
  combatFlowLevel,
  combatFlowRoomLevel,
  combatFlowPreviewSeed,
} from '../src/combat-flow-rooms.ts';
import { combatFlowTestFromUrl, COMBAT_FLOW_TEST_BUILDS } from '../src/combat-flow-test.ts';
import { validCombatFlowSpec } from '../src/combat-flow-rules.ts';

const url = (query = '') => new URL('https://test/?test=flow&v=1' + query);
const preset = (query = '') => {
  const cp = combatFlowTestFromUrl(url(query));
  assert(cp, query);
  assert(loadCheckpoint(cp), query);
  return cp;
};
const start = (query = '') => {
  const g = new Game();
  g.startTest(preset(query));
  return g;
};
const choices = [undefined, 'low', 'high'] as const;
const geometryCases = COMBAT_FLOW_IDS.flatMap((room) =>
  (['switchyard', 'scrap-bridge'].includes(room) ? choices : [undefined]).flatMap((route) =>
    [false, true].map((mirror) => ({ room, route, mirror })),
  ),
);
const overlap = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.1 &&
  Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.1;

test('all six native encounters reconstruct all three complete cohorts with each starting gun and mirror', () => {
  for (const room of COMBAT_FLOW_IDS)
    for (const variant of [1, 2, 3])
      for (const mirror of [false, true])
        for (const gun of STARTING_GUN_IDS) {
          const g = start(
            '&room=' + room + '&variant=' + variant + '&mirror=' + Number(mirror) + '&gun=' + gun,
          );
          assert.equal(g.stage, COMBAT_FLOW_ROOMS[room].stage);
          assert.equal(g.startingGun, gun);
          assert.deepEqual(g.mods, []);
          assert.equal(g.level.combatFlow?.room, room);
          assert.equal(g.level.combatFlow?.variant, variant - 1);
          assert.equal(g.level.mirrored, mirror);
          assert(validCombatFlowSpec(g.level.combatFlow, g.level.spawns.length));
          assert.equal(g.level.combatFlow!.beats.length, 3);
          assert(g.level.spawns.length <= (g.stage < 4 ? 5 : 7));
          assert.equal(g.enemies.length, g.level.combatFlow!.beats[0].length);
          assert.equal(g.enemies.length + g.waves.doors.length, g.level.spawns.length);
          assert(g.level.route[0].x < g.level.route.at(-1)!.x);
        }
});

test('authored variants differ in tactical composition rather than merely shuffled labels', () => {
  for (const room of COMBAT_FLOW_IDS) {
    const signatures = [0, 1, 2].map((variant) => {
      const l = combatFlowRoomLevel(room, variant as 0 | 1 | 2);
      return JSON.stringify(
        l.combatFlow!.beats.map((indices) =>
          indices
            .map((i) => {
              const s = l.spawns[i];
              return { kind: s.kind, x: s.x, y: s.y, teamwork: s.teamwork };
            })
            .sort((a, b) => a.x - b.x || a.y - b.y),
        ),
      );
    });
    assert.equal(new Set(signatures).size, 3, room);
  }
  assert(combatFlowRoomLevel('upper-return', 1).spawns.some((s) => s.kind === 'repairer'));
  assert(combatFlowRoomLevel('inspection-lane', 0).spawns.some((s) => s.kind === 'relay'));
  for (const room of ['overpass', 'switchyard', 'warm-exchange'] as const)
    for (const variant of [0, 1, 2] as const)
      assert(
        combatFlowRoomLevel(room, variant).spawns.every((s) =>
          ['runner', 'shooter', 'flyer'].includes(s.kind),
        ),
      );
});

test('every authored spawn, reserve, prop, support link and exit has physical clearance in both routes and mirrors', () => {
  for (const { room, route, mirror } of geometryCases)
    for (const variant of [0, 1, 2] as const) {
      const l = combatFlowRoomLevel(room, variant, mirror, route);
      const actors = l.spawns.map((s) => {
        const d = ENEMY_STATS[s.kind];
        return { x: s.x - d.w / 2, y: s.y - d.h / 2, w: d.w, h: d.h };
      });
      for (const actor of [
        { x: 127, y: 660, w: 26, h: 60 },
        { x: 1840, y: 590, w: 160, h: 150 },
        ...actors,
      ])
        for (const s of l.solids)
          assert(!overlap(actor, s), room + ' terrain ' + JSON.stringify(actor));
      for (const prop of l.setpiece!.props) {
        const d = PROP_STATS[prop.kind],
          body = { x: prop.x - d.w / 2, y: prop.y - d.h / 2, w: d.w, h: d.h };
        for (const solid of l.solids) assert(!overlap(body, solid), room + ' prop/terrain');
        for (const actor of actors)
          assert(!overlap(body, actor), room + ' prop/spawn ' + JSON.stringify({ prop, actor }));
      }
      const pair = l.spawns.filter((s) => s.teamwork);
      if (pair.length) {
        assert.equal(pair.length, 2);
        const distance = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
        assert(distance >= 70 && distance <= 430, room + ' support out of reach');
        assert(
          l.combatFlow!.beats.some((beat) => pair.every((s) => beat.includes(l.spawns.indexOf(s)))),
        );
        for (const s of l.solids)
          assert(
            !segmentBox(
              pair[0],
              pair[1],
              { x: s.x - 2, y: s.y - 2 },
              { x: s.x + s.w + 2, y: s.y + s.h + 2 },
            ),
            room + ' support link blocked',
          );
      }
    }
});

test('legacy saves, Daily layouts, the opening, final approach and authored objectives retain their designs', () => {
  const g = new Game();
  g.stage = 5;
  g.encounters = 1;
  const ordinary: Level = {
    id: 'ordinary',
    name: 'Ordinary',
    area: 'furnace',
    boss: false,
    mirrored: false,
    solids: [],
    spawns: [],
    route: [{ x: 1880, y: 716 }],
  };
  for (const seed of ['RF-C98-OLD', 'RF-C97-OLD', 'RF-D99-2026-10-24']) {
    g.seed = seed;
    assert.equal(combatFlowLevel(g, ordinary), ordinary);
  }
  g.seed = 'RF-C99-NEW';
  for (const flag of [
    { boss: true },
    { security: true },
    { detour: true },
    { hunt: 'bulwark' },
    { uprising: 'furnace' },
    { story: 'escape' },
    { courier: true },
    { floodgate: true },
    { sortingPit: 0 },
    { annex: true },
    { shutdown: true },
    { freight: true },
    { crossing: true },
    { machineIntro: 'shutter' },
    { teamworkIntro: 'repairer' },
    { remasterIntro: 'runner' },
    { fabricatorIntro: true },
    { anglerIntro: true },
    { crawlerIntro: true },
    { harpoonIntro: true },
    { sapperIntro: true },
    { maintenance: 'well' },
    { recoilTrial: 'vault' },
  ] as Partial<Level>[]) {
    const base = { ...ordinary, ...flag },
      before = structuredClone(base);
    assert.equal(combatFlowLevel(g, base), base);
    assert.deepEqual(base, before);
  }
  for (const stage of [0, 3, 4, 6, 7, 8, 10, 11, 12, 15, 16, 17, 18, 19]) {
    g.stage = stage;
    assert.equal(combatFlowLevel(g, ordinary), ordinary);
  }
  g.stage = 5;
  assert.notEqual(combatFlowLevel(g, ordinary), ordinary);
});

test('normal fork rewards preserve distinct low/high encounters and exact Continue reconstruction', () => {
  for (const [fromStage, id] of [
    [1, 'switchyard'],
    [13, 'scrap-bridge'],
  ] as const)
    for (const choice of ['low', 'high'] as const) {
      const observed = new Set<boolean>();
      for (let i = 0; i < 40 && observed.size < 2; i++) {
        const seed = 'RF-C99-FLOW-FORK-' + i,
          g = new Game(),
          cp = {
            ...testCheckpoint(seed, fromStage),
            version: 6 as const,
            encounters: 1 as const,
            teamwork: 1 as const,
          };
        g.start(seed, cp);
        for (const e of g.enemies) Matter.Composite.remove(g.engine.world, e.body);
        g.enemies = [];
        g.waves.clear();
        g.areaEvents.clear();
        g.clear = true;
        assert(g.canChooseRoute);
        g.openReward(false, choice);
        assert.equal(g.enteringRoute, choice);
        g.chooseMod(g.offers[0].id);
        assert.equal(g.stage, fromStage + 1);
        assert.equal(g.route, choice);
        assert.equal(g.level.routeChoice, choice);
        assert.equal(g.level.combatFlow?.room, id);
        observed.add(g.level.mirrored);
        const saved = loadCheckpoint(g.checkpointSnapshot());
        assert(saved);
        const h = new Game();
        h.start(saved.seed, saved);
        assert.deepEqual(h.level, g.level);
        const other = combatFlowRoomLevel(
          id,
          g.level.combatFlow!.variant,
          g.level.mirrored,
          choice === 'low' ? 'high' : 'low',
        );
        assert.notDeepEqual(other.solids, g.level.solids);
        assert.notDeepEqual(other.spawns, g.level.spawns);
      }
      assert.equal(observed.size, 2, id + ' ' + choice + ' not tested in both mirrors');
    }
});

test('normal revision99 Campaign selection exposes all six slots and yields only to preserved authored objectives', () => {
  for (const room of COMBAT_FLOW_IDS) {
    let selected = 0;
    const routes = ['switchyard', 'scrap-bridge'].includes(room)
      ? (['low', 'high'] as const)
      : [undefined];
    for (const choice of routes)
      for (let i = 0; i < 30; i++) {
        const stage = COMBAT_FLOW_ROOMS[room].stage,
          seed = 'RF-C99-FLOW-SELECT-' + i;
        const cp: Checkpoint = {
          ...testCheckpoint(seed, stage),
          version: 6,
          encounters: 1,
          teamwork: 1,
          ...(choice ? { route: choice } : {}),
        };
        assert(loadCheckpoint(cp));
        const g = new Game();
        g.start(seed, cp);
        if (g.level.combatFlow) {
          selected++;
          assert.equal(g.level.combatFlow.room, room);
          assert.equal(g.level.routeChoice, choice);
          continue;
        }
        const l = g.level;
        assert(
          l.boss ||
            l.hunt ||
            l.security ||
            l.detour ||
            l.annex ||
            l.uprising ||
            l.story ||
            l.shutdown ||
            l.courier ||
            l.floodgate ||
            l.sortingPit !== undefined ||
            l.freight ||
            l.crossing ||
            l.machineIntro ||
            l.teamworkIntro ||
            l.remasterIntro ||
            l.fabricatorIntro ||
            l.anglerIntro ||
            l.crawlerIntro ||
            l.harpoonIntro ||
            l.sapperIntro ||
            l.maintenance ||
            l.recoilTrial ||
            g.areaEvents.encounter ||
            g.inAnnex ||
            g.security,
          room + ' silently skipped at ' + seed + ' ' + l.id,
        );
      }
    assert(selected > 0, room + ' is preview-only');
  }
});

test('test URLs reject ambiguous inputs and over-budget builds while accepted presets remain isolated', () => {
  for (const query of [
    '&room=missing',
    '&variant=0',
    '&variant=4',
    '&variant=1&variant=2',
    '&v=2',
    '&seed=override',
    '&gun=missing',
    '&gun=pistol&gun=shotgun',
    '&build=missing',
    '&mirror=2',
    '&route=high',
    '&room=switchyard&route=unknown',
    '&room=overpass&build=beam',
    '&room=warm-exchange&build=blast',
  ])
    assert.equal(combatFlowTestFromUrl(url(query)), null, query);
  assert.equal(combatFlowTestFromUrl(new URL('https://test/?test=flow')), null);
  for (const room of COMBAT_FLOW_IDS)
    for (const build of ['native', 'beam', 'blast', 'chain'] as const) {
      const cp = combatFlowTestFromUrl(url('&room=' + room + '&build=' + build));
      if (COMBAT_FLOW_TEST_BUILDS[build].length > COMBAT_FLOW_ROOMS[room].stage) {
        assert.equal(cp, null);
        continue;
      }
      assert(cp && loadCheckpoint(cp));
      assert(cp.seed.length <= 40);
      assert(combatFlowPreviewSeed(cp.seed));
      const g = new Game();
      let writes = 0;
      g.onCheckpoint = () => writes++;
      g.onCommendation = () => writes++;
      g.onCampaignClear = () => writes++;
      g.startTest(cp);
      assert.equal(writes, 0);
      assert(g.level.combatFlow);
      assert.equal(g.startingGun, 'pistol');
      assert.deepEqual(g.mods, cp.mods);
    }
  const cp = preset('&room=scrap-bridge&variant=3&mirror=1&route=high');
  const first = start('&room=scrap-bridge&variant=3&mirror=1&route=high'),
    retry = new Game();
  retry.startTest(cp);
  assert.deepEqual(retry.level, first.level);
});

function navigationFixture(
  room: keyof typeof COMBAT_FLOW_ROOMS,
  mirror: boolean,
  route?: 'low' | 'high',
) {
  const g = start('&room=' + room + '&mirror=' + Number(mirror) + (route ? '&route=' + route : ''));
  for (const e of g.enemies) Matter.Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.areaEvents.clear();
  g.hazards.clear();
  // Isolate permanent terrain here. The separate combat matrix keeps every
  // breakable prop and uses the real gun, damage, warnings and enemy AI.
  for (const prop of [...g.props.items]) g.props.remove(prop);
  g.clear = true;
  g.clearAt = g.time + 1000;
  return g;
}
test('ordinary walking and jumps traverse all permanent ground routes in both directions without a movement upgrade', () => {
  for (const { room, route, mirror } of geometryCases)
    for (const reverse of [false, true]) {
      const g = navigationFixture(room, mirror, route);
      Matter.Body.setPosition(g.player, { x: reverse ? 1860 : 140, y: 680 });
      const points = (reverse ? [...g.level.route].reverse() : [...g.level.route]).concat([
        { x: reverse ? 110 : 1890, y: 716 },
      ]);
      let index = 0,
        stuck = 0,
        lastX = g.player.position.x;
      for (let tick = 0; tick < 2400 && index < points.length && g.mode === 'playing'; tick++) {
        const p = g.player.position,
          target = points[index],
          dx = target.x - p.x,
          dy = p.y - target.y;
        if (Math.abs(dx) < 40 && Math.abs(dy) < 65) {
          index++;
          continue;
        }
        stuck = Math.abs(p.x - lastX) < 0.4 ? stuck + 1 : 0;
        lastX = p.x;
        const move = dx > 12 ? 1 : dx < -12 ? -1 : 0,
          blocked =
            move &&
            Matter.Query.ray(g.solidBodies, p, { x: p.x + move * 70, y: p.y }, 24).length > 0;
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
        points.length,
        room +
          ' ' +
          route +
          ' ' +
          mirror +
          ' ' +
          reverse +
          ' stopped ' +
          index +
          ' ' +
          JSON.stringify(g.player.position),
      );
      assert.deepEqual(g.mods, []);
    }
});

test('native pistol recoil reaches the optional highest deck in every room and route', () => {
  for (const { room, route, mirror } of geometryCases) {
    const g = navigationFixture(room, mirror, route),
      deck = [...g.level.solids].filter((s) => s.h === 22).sort((a, b) => a.y - b.y)[0];
    const launch = deck.x - 55,
      landing = deck.x + 55;
    let phase = 'approach',
      landed = false;
    for (let tick = 0; tick < 2400 && g.mode === 'playing'; tick++) {
      const p = g.player.position;
      if (phase === 'approach' && Math.abs(p.x - launch) < 14) phase = 'rise';
      if (phase === 'rise' && p.y < deck.y - 65) phase = 'land';
      const dx = (phase === 'land' ? landing : launch) - p.x,
        move = dx > 8 ? 1 : dx < -8 ? -1 : 0,
        blocked =
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
    assert(
      landed,
      room + ' ' + route + ' ' + mirror + ' failed upper deck ' + JSON.stringify(g.player.position),
    );
    assert.deepEqual(g.mods, []);
  }
});
