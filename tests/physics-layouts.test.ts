import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input, type Enemy } from '../src/game.ts';
import { getLevel, type Solid } from '../src/levels.ts';
import { PHYSICS_LAYOUTS, PHYSICS_STAGES, physicsVariant } from '../src/physics-layouts.ts';
import { layoutTestFromUrl, testCheckpoint } from '../src/practice.ts';
import { loadCheckpoint, validBuild, distance } from '../src/rules.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { PROP_STATS, propPlacements } from '../src/props.ts';
import { breakableSolids } from '../src/destruction-layout.ts';
import { hazardPlacement } from '../src/hazard-layouts.ts';
import { dailyForDate } from '../src/daily.ts';
import { getOvertimeLevel, overtimeSeed } from '../src/overtime.ts';
import { splitWaves } from '../src/reinforcements.ts';
const { Composite, Body, Query } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1600, y: 350 },
};
const overlaps = (a: Solid, b: Solid) =>
  a.x < b.x + b.w - 0.1 && a.x + a.w > b.x + 0.1 && a.y < b.y + b.h - 0.1 && a.y + a.h > b.y + 0.1;
function preset(id: string, variant = 1, mirrored = false) {
  const save = layoutTestFromUrl(
    new URL(
      `https://example.com/?test=layouts&layout=${id}&variant=${variant}&mirror=${Number(mirrored)}`,
    ),
  );
  assert(save, `${id}/${variant}/${mirrored}: missing natural test seed`);
  return save;
}
function room(id: string, variant = 1, mirrored = false) {
  const save = preset(id, variant, mirrored),
    g = new Game();
  g.start(save.seed, save);
  return g;
}
function quiet(g: Game) {
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
}
function shot(g: Game, x: number, y: number, damage = 48) {
  g.addShot({
    pos: { x, y },
    vel: { x: 64, y: 0 },
    damage,
    life: 1,
    friendly: true,
    radius: 2,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
  g.updateShots(1 / 60);
}

test('three arrangements in both orientations have safe hulls, authored props, and legal isolated presets', () => {
  for (const source of PHYSICS_LAYOUTS) {
    const arrangements = new Set<string>();
    for (const mirrored of [false, true])
      for (let variant = 1; variant <= 3; variant++) {
        const save = preset(source.id, variant, mirrored),
          level = getLevel(save.seed, save.stage);
        assert.equal(level.id, source.id);
        assert.equal(level.mirrored, mirrored);
        assert.equal(physicsVariant(save.seed, source.id), variant - 1);
        assert.equal(save.mods.length, save.stage);
        assert(validBuild(save.mods));
        assert.deepEqual(loadCheckpoint(save), save);
        assert.deepEqual(getLevel(save.seed, save.stage), level);
        if (!mirrored) arrangements.add(JSON.stringify(level.spawns));
        assert.equal(level.spawns.length, source.setpiece!.rosters[variant - 1].length);
        const hulls = level.spawns.map((s) => {
          const { w, h } = ENEMY_STATS[s.kind];
          assert(s.x >= 380);
          return { x: s.x - w / 2, y: s.y - h / 2, w, h };
        });
        for (const [i, hull] of hulls.entries()) {
          for (const solid of level.solids)
            assert(!overlaps(hull, solid), `${source.id}: embedded actor`);
          for (const other of hulls.slice(i + 1))
            assert(!overlaps(hull, other), `${source.id}: overlapping actors`);
        }
        for (const p of propPlacements(level, save.seed)) {
          const { w, h } = PROP_STATS[p.kind],
            hull = { x: p.x - w / 2, y: p.y - h / 2, w, h };
          for (const solid of [...level.solids, ...hulls])
            assert(!overlaps(hull, solid), `${source.id}: embedded prop`);
        }
        assert.equal(hazardPlacement(level, save.seed, save.stage), undefined);
        assert.deepEqual(
          breakableSolids(level, save.seed, save.stage),
          source.setpiece!.weak.map((i) => level.solids[i]),
        );
        const [opening, later] = splitWaves(level, save.seed, save.stage);
        assert.equal(opening.length + later.length, level.spawns.length);
        assert(opening.length && later.length);
      }
    assert.equal(arrangements.size, 3);
  }
});

test('layout links reject ambiguous, conflicting and unsupported selections', () => {
  const base = 'https://example.com/?test=layouts';
  assert(layoutTestFromUrl(new URL(base)));
  for (const suffix of [
    '&test=layouts',
    '&layout=missing',
    '&layout=',
    '&layout=cable-yard&layout=cable-yard',
    '&variant=0',
    '&variant=4',
    '&variant=01',
    '&variant=1&variant=2',
    '&mirror=true',
    '&mirror=0&mirror=1',
    ...['daily', 'dv', 'seed', 'area', 'formation', 'build', 'route', 'mode'].map(
      (k) => '&' + k + '=x',
    ),
  ])
    assert.equal(layoutTestFromUrl(new URL(base + suffix)), null, suffix);
  assert.equal(layoutTestFromUrl(new URL('https://example.com/?test=other')), null);
});

test('new rooms occur naturally in Daily and Overtime without replacing introductions or bosses', () => {
  const dailySeen = new Set<string>(),
    overtimeSeen = new Set<string>();
  for (let i = 0; i < 96; i++) {
    const seed = dailyForDate(new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10))!.seed;
    for (const stage of [5, 9, 17]) {
      const level = getLevel(seed, stage),
        ot = getOvertimeLevel(seed, stage);
      if (level.setpiece) dailySeen.add(level.id + ':' + level.mirrored);
      if (ot.setpiece) {
        overtimeSeen.add(ot.id + ':' + ot.mirrored);
        assert.deepEqual(ot.setpiece, getLevel(overtimeSeed(seed), stage).setpiece);
      }
      assert.deepEqual(getLevel(seed, stage), level);
      assert.deepEqual(getOvertimeLevel(seed, stage), ot);
    }
    for (const stage of [0, 1, 2, 3, 4, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 18, 19])
      assert(!getLevel(seed, stage).setpiece, `Unexpected replacement at ${stage}`);
  }
  assert.equal(dailySeen.size, 6);
  assert.equal(overtimeSeen.size, 6);
});

test('every Cable Yard arrangement provides an unobstructed ground-to-air tether from actual anchors', () => {
  for (const mirrored of [false, true])
    for (let variant = 1; variant <= 3; variant++) {
      const g = room('cable-yard', variant, mirrored);
      quiet(g);
      for (const s of g.level.spawns) g.spawnEnemy(s.kind, s.x, s.y, s.elite);
      for (const e of g.enemies) e.spawn = 0;
      const ground = g.enemies.filter(
        (e) => ['runner', 'charger', 'hopper'].includes(e.kind) && e.elite !== 'shielded',
      );
      const air = g.enemies.filter((e) => ['flyer', 'skimmer'].includes(e.kind));
      let pair: [Enemy, Enemy] | undefined;
      for (const a of ground)
        for (const b of air)
          if (distance(a.body.position, b.body.position) <= 400 && g.tethers.clearPath(a, b))
            pair = [a, b];
      assert(pair, `No tether lane: ${variant}/${mirrored}`);
      for (const e of pair) shot(g, e.body.position.x - 40, e.body.position.y, 8);
      assert(
        g.tethers.link,
        `Real projectiles did not connect the authored pair: ${variant}/${mirrored}, ${pair.map((e) => e.kind + ':' + JSON.stringify(e.body.position))}`,
      );
      assert.equal(new Set([g.tethers.link.a, g.tethers.link.b]).size, 2);
    }
});

test('Demolition Lane fuel damages the adjacent cracked walls and follow-up fire opens them', () => {
  for (const mirrored of [false, true])
    for (let variant = 1; variant <= 3; variant++) {
      const g = room('demolition-lane', variant, mirrored);
      assert(g.level.spawns.some((e) => e.kind === 'sapper'));
      quiet(g);
      assert.equal(g.destruction.pieces.length, 3);
      for (const fuel of g.props.items.filter((p) => p.kind === 'canister')) {
        const piece = [...g.destruction.pieces].sort(
          (a, b) =>
            distance(a.body.position, fuel.body.position) -
            distance(b.body.position, fuel.body.position),
        )[0];
        g.props.explode(fuel);
        assert.equal(piece.hp, 30, 'Fuel did not chip the wall within its blast');
        const fromLeft = fuel.body.position.x < piece.body.position.x;
        g.addShot({
          pos: { x: fromLeft ? piece.rect.x - 30 : piece.rect.x + piece.rect.w + 30, y: 700 },
          vel: { x: fromLeft ? 32 : -32, y: 0 },
          damage: 30,
          life: 1,
          friendly: true,
          radius: 2,
          bounces: 0,
          pierce: 0,
          fragment: false,
          split: false,
        });
        g.updateShots(1 / 60);
        assert(!g.terrain.includes(piece.body), 'The damaged barrier stayed solid');
      }
      assert.equal(g.destruction.pieces.length, 1);
    }
});

test('Suspension Hall cables stay clear, release independently, and loads crush enemies in their authored lanes', () => {
  for (const mirrored of [false, true])
    for (let variant = 1; variant <= 3; variant++) {
      const g = room('suspension-hall', variant, mirrored);
      quiet(g);
      assert.equal(g.cargo.items.length, 2);
      const victims: Enemy[] = [];
      for (const load of g.cargo.items) {
        const rig = load.cargo!,
          bounds = load.body.bounds;
        const shaft = {
          x: bounds.min.x,
          y: bounds.min.y,
          w: bounds.max.x - bounds.min.x,
          h: 740 - bounds.min.y,
        };
        assert(
          g.level.solids.some(
            (s) => s.y + s.h === rig.anchor.y && s.x < rig.anchor.x && s.x + s.w > rig.anchor.x,
          ),
        );
        for (const solid of g.level.solids)
          assert(!overlaps(shaft, solid), 'Obstructed cargo shaft');
        const target = g.level.spawns.find((s) => s.x === load.body.position.x && s.y === 724);
        assert(target, 'Missing enemy beneath the load');
        g.spawnEnemy(target.kind, target.x, target.y);
        const enemy = g.enemies.at(-1)!;
        enemy.spawn = 0;
        enemy.timer = 100;
        victims.push(enemy);
        shot(g, rig.anchor.x - 40, rig.anchor.y + 38);
        assert.equal(rig.state, 'warning');
      }
      for (let i = 0; i < 160; i++) g.tick(1 / 60, idle);
      assert(
        victims.every((e) => e.hp <= 0),
        'Hanging cargo failed to crush its target',
      );
      assert(g.cargo.items.every((p) => p.cargo!.state === 'loose' && p.body.position.y > 670));
      assert.equal(g.hp, 100);
    }
});

test('destroyed walls and fallen cargo leave both orientations traversable with ordinary jumps', () => {
  for (const source of PHYSICS_LAYOUTS)
    for (const mirrored of [false, true]) {
      const g = room(source.id, 1, mirrored);
      quiet(g);
      g.mods = [];
      // Gun is never fired; movement uses the ordinary input path.
      for (const p of [...g.destruction.pieces])
        g.destruction.hitBody(p.body, 1000, { x: 0, y: 0 });
      for (const load of g.cargo.items) g.cargo.cut(load, 48);
      for (let i = 0; i < 180; i++) g.tick(1 / 60, idle);
      const path = [...g.level.route, { x: 1900, y: 720 }];
      let waypoint = 0,
        stuck = 0,
        previous = g.player.position.x;
      for (let i = 0; i < 3600 && g.mode === 'playing' && waypoint < path.length; i++) {
        const p = g.player.position,
          target = path[waypoint],
          dx = target.x - p.x,
          dy = p.y - target.y;
        if (Math.abs(dx) < 40 && Math.abs(dy) < 65) {
          waypoint++;
          continue;
        }
        stuck = Math.abs(p.x - previous) < 0.4 ? stuck + 1 : 0;
        previous = p.x;
        const move = dx > 12 ? 1 : dx < -12 ? -1 : 0;
        const blocked =
          move && Query.ray(g.solidBodies, p, { x: p.x + move * 70, y: p.y }, 24).length > 0;
        g.tick(1 / 60, {
          ...idle,
          left: move < 0,
          right: move > 0,
          jump: g.grounded && (dy > 50 || !!blocked || stuck > 12),
        });
      }
      assert(g.hp > 0);
      assert(
        waypoint === path.length || g.mode === 'upgrade',
        `${source.id}/${mirrored}: stopped at ${waypoint}`,
      );
    }
});

test('entrance retries restore authored terrain, props, cargo and the same enemy arrangement', () => {
  for (const source of PHYSICS_LAYOUTS) {
    const save = preset(source.id),
      g = room(source.id),
      before = JSON.stringify(g.level);
    const props = g.props.items.map((p) => ({
      kind: p.kind,
      pos: { ...p.body.position },
      cargo: p.cargo ? { ...p.cargo.origin } : null,
    }));
    for (const p of [...g.props.items]) g.props.remove(p);
    for (const p of [...g.destruction.pieces]) g.destruction.hitBody(p.body, 1000, { x: 0, y: 0 });
    g.start(save.seed, save);
    assert.equal(JSON.stringify(g.level), before);
    assert.deepEqual(
      g.props.items.map((p) => ({
        kind: p.kind,
        pos: { ...p.body.position },
        cargo: p.cargo ? { ...p.cargo.origin } : null,
      })),
      props,
    );
    assert.deepEqual(g.mods, save.mods);
    assert.deepEqual(g.level, getLevel(save.seed, PHYSICS_STAGES[source.id]));
  }
});
