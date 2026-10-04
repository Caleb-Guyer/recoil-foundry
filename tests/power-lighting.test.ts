import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { getLevel } from '../src/levels.ts';
import { planFactory, factoryEncounter } from '../src/factory.ts';
import { newUprising } from '../src/uprising-model.ts';
import { eventTestFromUrl } from '../src/area-events.ts';
import { loadCheckpoint } from '../src/rules.ts';
import { PROJECTILE_LIGHT_LIMIT, projectileLights, shotLight } from '../src/projectile-light.ts';
import { fixture, round } from './branches-fixture.ts';

test('first rooms have no Factory event even when continuing a version-three plan', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 60; i++) {
    const seed = 'ordinary-opening-' + i;
    for (const legacy of [false, true]) {
      const g = new Game(),
        factory = planFactory(seed, legacy ? 3 : 4);
      seen.add(factory.condition);
      const save = {
        version: 6,
        seed,
        stage: 0,
        hp: 100,
        mods: [],
        kills: 0,
        elapsed: 0,
        factory,
        uprising: { ...newUprising(), version: 1 as const },
      };
      if (legacy) {
        assert(loadCheckpoint(save));
        g.start(seed, save);
      } else g.start(seed, undefined, null, null, false, 0, true, [], newUprising());
      assert.equal(factoryEncounter(g.factory, 0), undefined);
      assert.equal(g.areaEvents.active, null);
      assert.equal(g.areaEvents.dark, false);
      assert.equal(g.areaEvents.fuseBox, null);
      assert.equal(g.factions.allies.length, 0);
      assert.deepEqual(g.level, getLevel(seed, 0));
      assert(!g.waves.held);
    }
  }
  assert.equal(seen.size, 3);
});

test('fuse housings block player and enemy bodies before and after player fire disables the circuit', () => {
  const g = fixture([]),
    box = g.props.spawn('fuse', 600, 300);
  g.areaEvents.active = 'blackout';
  g.areaEvents.state = eventTestFromUrl(
    new URL('https://test/?test=events&event=blackout'),
  )!.areaEvent!;
  g.areaEvents.fuseBox = box;
  g.areaEvents.site = { ...box.body.position };
  g.waves.held = true;
  assert(box.body.isStatic && !box.body.isSensor);
  g.spawnEnemy('runner', 700, 300);
  const enemy = g.enemies.at(-1)!;
  enemy.spawn = 0;
  for (const powered of [false, true]) {
    if (powered) {
      const kills = g.kills,
        hp = g.hp;
      g.props.hit(box, 999, { x: 10, y: 0 }, undefined, true);
      assert(g.areaEvents.powered && !g.waves.held);
      assert.equal(g.kills, kills);
      assert.equal(g.hp, hp);
      assert(g.props.items.includes(box));
    }
    for (const [actor, side] of [
      [g.player, -1],
      [enemy.body, 1],
    ] as const) {
      Matter.Body.setPosition(actor, { x: 600 + side * 80, y: 300 });
      for (let step = 0; step < 45; step++) {
        Matter.Body.setVelocity(actor, { x: -side * 5, y: 0 });
        Matter.Engine.update(g.engine, 1000 / 60);
      }
      assert(
        side < 0
          ? Math.max(...actor.vertices.map((v) => v.x)) <= box.body.bounds.min.x + 0.1
          : Math.min(...actor.vertices.map((v) => v.x)) >= box.body.bounds.max.x - 0.1,
      );
    }
  }
  g.props.break(box);
  g.props.explode(box);
  assert(g.props.items.includes(box));
  assert.deepEqual(box.body.position, { x: 600, y: 300 });
});

test('hostile fire and physical contact cannot trip the fuse, and subsequent player shots retain its shell', () => {
  const g = fixture([]),
    box = g.props.spawn('fuse', 600, 300);
  g.areaEvents.active = 'blackout';
  g.areaEvents.state = eventTestFromUrl(
    new URL('https://test/?test=events&event=blackout'),
  )!.areaEvent!;
  g.areaEvents.fuseBox = box;
  round(g, { pos: { x: 550, y: 300 }, vel: { x: 25, y: 0 }, friendly: false });
  for (let i = 0; i < 5; i++) g.updateShots(1 / 60);
  g.props.strike(box, 160, { x: 20, y: 0 });
  assert(g.areaEvents.dark);
  for (let i = 0; i < 2; i++) {
    round(g, { pos: { x: 550, y: 300 }, vel: { x: 25, y: 0 } });
    for (let i = 0; i < 5; i++) g.updateShots(1 / 60);
    assert(g.areaEvents.powered);
    assert(g.props.items.includes(box));
  }
  assert.deepEqual(g.areaEvents.state.relays, [g.stage]);
});

test('blackout Continue restores an inert, collidable box without releasing the reserve again', () => {
  const save = eventTestFromUrl(new URL('https://test/?test=events&event=blackout'))!;
  save.areaEvent!.relays = [4];
  save.reward = { offers: ['rapid', 'scatter', 'pierce'], rerolled: false };
  assert(loadCheckpoint(save));
  const g = new Game();
  g.start(save.seed, save);
  const box = g.areaEvents.fuseBox!;
  assert(box && g.props.items.includes(box));
  assert(!g.areaEvents.dark && !g.waves.held);
  assert(box.body.isStatic && !box.body.isSensor);
  const current = g.waves.phase;
  g.props.hit(box, 1, { x: 1, y: 0 }, undefined, true);
  assert.equal(g.waves.phase, current);
});

test('projectile illumination reflects ammunition, charged energy, fragments and inactive rounds', () => {
  const g = fixture([]);
  round(g);
  const ordinary = g.shots[0],
    warm = shotLight(ordinary, [])!;
  const ice = shotLight(ordinary, ['coolant-rounds'])!,
    electric = shotLight(ordinary, ['arc-coil'])!;
  assert.notEqual(warm.color, ice.color);
  assert.notEqual(ice.color, electric.color);
  assert(shotLight({ ...ordinary, rail: true }, [])!.radius > warm.radius);
  assert(shotLight({ ...ordinary, shell: { fragment: false } as never }, [])!.radius > warm.radius);
  assert(shotLight({ ...ordinary, fragment: true }, [])!.radius < warm.radius);
  assert(shotLight({ ...ordinary, echo: true }, [])!.strength < warm.strength);
  assert.notEqual(
    shotLight({ ...ordinary, friendly: false }, ['coolant-rounds'])!.color,
    ice.color,
  );
  assert.equal(shotLight({ ...ordinary, life: 0 }, []), null);
  assert.equal(shotLight({ ...ordinary, meltTransit: {} as never }, []), null);
});

test('lighting includes real beam paths and arcs, culls offscreen effects and caps busy volleys', () => {
  const g = fixture([]),
    view = { x: 0, y: 0, w: 800, h: 600 };
  round(g);
  const s = g.shots[0];
  g.shots = Array.from({ length: 300 }, (_, i) => ({
    ...s,
    id: i,
    pos: { x: i % 2 ? 400 : 5000, y: 300 },
  }));
  const lights = projectileLights(g, view);
  assert.equal(lights.length, PROJECTILE_LIGHT_LIMIT);
  assert(lights.every((l) => l.pos.x === 400));
  g.shots = [];
  g.torch.active = true;
  g.torch.segments = [
    { a: { x: 100, y: 300 }, b: { x: 500, y: 300 }, dir: { x: 1, y: 0 }, gain: 1 },
  ];
  g.arcs.effects = [{ a: { x: 300, y: 200 }, b: { x: 350, y: 250 }, at: 0, hop: 0 }];
  const energy = projectileLights(g, view);
  assert(energy.some((l) => l.pos.x === 500));
  assert(energy.some((l) => l.pos.x === 350 && l.color === '#96d7ff'));
  assert(energy.every((l) => l.pos.x <= 500));
  assert.equal(projectileLights(g, { x: 5000, y: 0, w: 800, h: 600 }).length, 0);
});
