import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { getRouteLevel } from '../src/route-layouts.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { PROP_STATS } from '../src/props.ts';
import { loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import type { Solid } from '../src/levels.ts';
import { ROUTE_REMASTERS, ROUTE_REMASTER_IDS, routeRemasterRoom } from '../src/route-remaster.ts';
import { playRoom } from './room-pilot.ts';
const overlap = (a: Solid, b: Solid) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.1 &&
  Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.1;
const cases = ROUTE_REMASTER_IDS.flatMap((id) =>
  [false, true].map((mirror) => ({ ...ROUTE_REMASTERS[id], key: id, mirror })),
);
function fixture(room: (typeof cases)[number]) {
  const seed = Array.from(
    { length: 200 },
    (_, i) => 'RF-C101-ROUTE-' + room.stage + '-' + room.route + '-' + i,
  ).find((seed) => getRouteLevel(seed, room.stage, room.route).mirrored === room.mirror)!;
  assert(seed);
  const raw: Checkpoint = {
    version: 6,
    seed,
    stage: room.stage,
    route: room.route,
    hp: 100,
    mods: [],
    missedUpgrades: room.stage,
    kills: 0,
    elapsed: 0,
    startingGun: 'pistol',
    encounters: 1,
    teamwork: 1,
    region: room.stage === 6 ? 'pending' : 'cooling',
    annexVersion: 6,
  };
  const checkpoint = loadCheckpoint(raw);
  assert(checkpoint);
  const g = new Game();
  let writes = 0;
  g.onCheckpoint = () => writes++;
  g.onCommendation = () => writes++;
  g.onCampaignClear = () => writes++;
  g.startTest(checkpoint);
  assert.equal(writes, 0);
  return g;
}
const dispose = (g: Game) => {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
};

test('real Campaign route resolution preserves support introductions and actual room machinery in both mirrors', () => {
  for (const room of cases) {
    const g = fixture(room),
      expected = routeRemasterRoom(room.stage, room.route, room.mirror);
    assert.equal(g.level.id, room.id);
    assert.deepEqual(g.level.solids, expected.solids);
    assert.deepEqual(g.level.route, expected.route);
    assert.equal(g.level.mirrored, room.mirror);
    assert.equal(g.level.spawns.length, expected.spawns.length);
    assert.equal(g.level.teamworkIntro, room.stage === 6 ? 'repairer' : 'relay');
    assert.equal(g.enemies.length, 2);
    assert.equal(g.enemies.length + g.waves.doors.length, g.level.spawns.length);
    assert.equal(
      g.enemies.filter((e) => e.kind === (room.stage === 6 ? 'repairer' : 'relay')).length,
      1,
    );
    const actors = g.level.spawns.map((s) => {
      const d = ENEMY_STATS[s.kind];
      return { x: s.x - d.w / 2, y: s.y - d.h / 2, w: d.w, h: d.h };
    });
    for (const actor of actors)
      for (const solid of g.level.solids)
        assert(!overlap(actor, solid), room.key + ' actual support clip');
    for (const prop of g.props.items) {
      const d = PROP_STATS[prop.kind],
        p = {
          x: prop.body.position.x - d.w / 2,
          y: prop.body.position.y - d.h / 2,
          w: d.w,
          h: d.h,
        };
      for (const solid of g.level.solids) assert(!overlap(p, solid), room.key + ' prop/solid');
      for (const actor of actors) assert(!overlap(p, actor), room.key + ' prop/spawn');
    }
    assert.equal(g.pressure.items.length, expected.vents?.length ?? 0);
    assert.equal(g.crosswind.items.length, expected.fans?.length ?? 0);
    assert.equal(g.hazards.items.length, expected.hazards?.length ?? 0);
    assert.deepEqual(g.level.coolant, expected.coolant);
    dispose(g);
  }
});

test('all real Campaign branch encounters clear with ordinary pistol input, native support behavior and intact machinery', () => {
  for (const room of cases) {
    const g = fixture(room);
    let arrivals = g.enemies.length;
    const spawn = g.spawnEnemy.bind(g);
    g.spawnEnemy = (...args: Parameters<Game['spawnEnemy']>) => {
      arrivals++;
      return spawn(...args);
    };
    const result = playRoom(g, 120);
    assert(g.clear, room.key + ' mirror' + room.mirror + ' ' + JSON.stringify(result));
    assert(g.hp > 0);
    assert.equal(arrivals, g.level.spawns.length);
    assert.equal(g.enemies.length, 0);
    assert(!g.waves.pending);
    assert(g.shotCount > 0);
    assert.deepEqual(g.mods, []);
    dispose(g);
  }
});
