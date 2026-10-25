import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { routePreviewKey, routePreviewTraits, type RoutePreview } from '../src/route-preview.ts';
import {
  createRoutePhotographGame,
  destroyRoutePhotographGame,
} from '../src/route-preview-photo.ts';
import { ROUTE_REMASTERS, routeRemasterRoom } from '../src/route-remaster.ts';
import { getRouteLevel } from '../src/route-layouts.ts';
import type { Checkpoint } from '../src/rules.ts';

function model(stage: 6 | 10, route: 'low' | 'high', mirrored = false): RoutePreview {
  const level = routeRemasterRoom(stage, route, mirrored);
  const checkpoint: Checkpoint = {
    version: 6,
    seed: 'RF-C101-PREVIEW-PHOTO',
    stage,
    hp: 76,
    mods: ['scatter', 'rapid', 'magnum', 'light', 'burst'],
    kills: 11,
    elapsed: 82,
    route,
  };
  return { route, stage, level, checkpoint };
}

test('the four remastered route labels describe their authored physical features', () => {
  for (const room of Object.values(ROUTE_REMASTERS)) {
    const level = routeRemasterRoom(room.stage, room.route);
    const traits = routePreviewTraits(level);
    assert.deepEqual(traits, room.traits);
    assert.equal(traits.length, 2);
    assert(!traits.some((trait) => /shooter|sniper|runner|easy|hard|reward|boss/i.test(trait)));
    assert.equal(level.id, room.id);
    if (traits.includes('Valve vent')) assert(level.vents?.length);
    if (traits.includes('Cargo lift')) assert(level.hazards?.some((h) => h.kind === 'lift'));
    if (traits.includes('Coolant pools')) assert(level.coolant?.length);
    if (traits.includes('Lift fan')) assert(level.fans?.length);
  }
});

test('removed machinery never keeps a stale authored feature label', () => {
  for (const room of Object.values(ROUTE_REMASTERS)) {
    const level = routeRemasterRoom(room.stage, room.route);
    const disabled = structuredClone(level);
    disabled.vents = [];
    disabled.coolant = [];
    disabled.fans = [];
    disabled.hazards = [];
    const traits = routePreviewTraits(disabled);
    assert.equal(traits[0], room.traits[0]);
    assert(!traits.some((trait) => /vent|valve|coolant|fan|lift|airflow/i.test(trait)));
  }
});

test('other route preview tags describe real geometry rather than a future patrol', () => {
  for (const stage of [2, 6, 10, 14, 18])
    for (const route of ['low', 'high'] as const) {
      const level = getRouteLevel('preview-geometry', stage, route);
      const traits = routePreviewTraits(level);
      assert.equal(traits.length, 2);
      assert(traits.every((trait) => trait.length < 24));
      assert(!traits.some((trait) => /enemy|boss|elite|safe|easy|hard|reward/i.test(trait)));
      if (traits.includes('Upper ledges'))
        assert(level.solids.filter((s) => s.y < 580 && s.w >= 100 && s.h <= 48).length >= 2);
      if (traits.includes('Broken sightlines'))
        assert(level.solids.filter((s) => s.h >= 45 && s.y + s.h >= 735).length >= 2);
    }
});

test('photographs retain the exact supplied destination terrain and props without enemies or live state changes', () => {
  for (const stage of [6, 10] as const)
    for (const route of ['low', 'high'] as const)
      for (const mirrored of [false, true]) {
        const preview = model(stage, route, mirrored);
        const before = structuredClone(preview);
        const live = new Game();
        let writes = 0;
        live.onCheckpoint = () => writes++;
        live.onEnemyEncountered = () => writes++;
        live.onCommendation = () => writes++;
        live.startTest(preview.checkpoint, preview.level);
        const bodyCount = Matter.Composite.allBodies(live.engine.world).length;
        const snapshot = live.checkpointSnapshot();
        const control = new Game();
        control.startTest(preview.checkpoint, preview.level);
        const expectedRoll = control.rng();
        const expectedProps = live.props.items.map((p) => ({
          kind: p.kind,
          x: p.body.position.x,
          y: p.body.position.y,
        }));
        const photo = createRoutePhotographGame(preview);
        try {
          assert.deepEqual(photo.level, live.level);
          assert.deepEqual(photo.level, preview.level);
          assert.deepEqual(
            photo.props.items.map((p) => ({
              kind: p.kind,
              x: p.body.position.x,
              y: p.body.position.y,
            })),
            expectedProps,
          );
          assert.equal(photo.enemies.length, 0);
          assert.equal(photo.areaEvents.allies.length, 0);
          assert.equal(photo.waves.pending, false);
          assert.equal(photo.shots.length, 0);
          assert.equal(photo.mode, 'paused');
          assert.equal(photo.elapsed, preview.checkpoint.elapsed);
          assert(photo.testRun);
          assert.equal(Matter.Composite.allBodies(live.engine.world).length, bodyCount);
          assert.deepEqual(live.checkpointSnapshot(), snapshot);
          assert.equal(live.rng(), expectedRoll);
          assert.equal(writes, 0);
          assert.deepEqual(preview, before);
        } finally {
          destroyRoutePhotographGame(photo);
          assert.equal(Matter.Composite.allBodies(photo.engine.world).length, 0);
          Matter.Composite.clear(control.engine.world, false);
          Matter.Engine.clear(control.engine);
          Matter.Composite.clear(live.engine.world, false);
          Matter.Engine.clear(live.engine);
        }
      }
});

test('thumbnail identities distinguish route, mirror, terrain and persistent machinery changes', () => {
  const original = model(6, 'low');
  const key = routePreviewKey(original);
  assert.equal(routePreviewKey(structuredClone(original)), key);
  const mirror = model(6, 'low', true);
  assert.notEqual(routePreviewKey(mirror), key);
  assert.notEqual(routePreviewKey(model(6, 'high')), key);
  const moved = structuredClone(original);
  moved.level.solids[0].x += 30;
  assert.notEqual(routePreviewKey(moved), key);
  const blackout = structuredClone(original);
  blackout.checkpoint.shutdown = { disabled: [3], chamber: false };
  assert.notEqual(routePreviewKey(blackout), key);
});
