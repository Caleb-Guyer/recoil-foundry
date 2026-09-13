import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { getLevel, type Solid } from '../src/levels.ts';
import { DROPWORKS_LAYOUTS } from '../src/dropworks-layouts.ts';
import { dropworksTestFromUrl } from '../src/practice.ts';
import { physicsVariant } from '../src/physics-layouts.ts';
import { hazardBounds } from '../src/hazard-layouts.ts';
import { getOvertimeLevel, overtimeSeed } from '../src/overtime.ts';
import { dailyForDate } from '../src/daily.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { PROP_STATS, propPlacements } from '../src/props.ts';
import { validBuild, loadCheckpoint, getGun, distance } from '../src/rules.ts';
import { dropworksPilot } from './dropworks-pilot.ts';
const { Body, Composite, Query } = Matter;
const dt = 1 / 60;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1000, y: 300 },
};
const overlaps = (a: Solid, b: Solid) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.1 &&
  Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.1;
function saveFor(area = 'cooling', mirror = false, variant = 1, build = 'forge') {
  const save = dropworksTestFromUrl(
    new URL(
      `https://test/?test=dropworks&area=${area}&mirror=${Number(mirror)}&variant=${variant}&build=${build}`,
    ),
  );
  assert(save, `${area}/${mirror}/${variant}/${build}: no natural seed`);
  return save;
}
function room(area = 'cooling', mirror = false, variant = 1, build = 'forge') {
  const g = new Game();
  g.startTest(saveFor(area, mirror, variant, build));
  return g;
}
function quiet(g: Game) {
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
}
function step(g: Game, frames = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < frames && g.mode === 'playing'; i++) g.tick(dt, { ...idle, ...input });
}

test('all Dropworks rosters and mirrors have clear hulls, supported loads and empty lift sweeps', () => {
  const originals = JSON.stringify(DROPWORKS_LAYOUTS);
  for (const [index, source] of DROPWORKS_LAYOUTS.entries()) {
    const seen = new Set<string>();
    for (const mirror of [false, true])
      for (let variant = 1; variant <= 3; variant++) {
        const save = saveFor(source.area, mirror, variant),
          level = getLevel(save.seed, save.stage);
        assert.equal(level.id, source.id);
        assert.equal(level.mirrored, mirror);
        assert.equal(physicsVariant(save.seed, source.id), variant - 1);
        assert.deepEqual(getLevel(save.seed, save.stage), level);
        assert.equal(level.spawns.length, index ? 12 : 9);
        assert.equal(level.spawns.filter((s) => s.kind === 'wallcrawler').length, index ? 2 : 1);
        if (index) assert.equal(level.spawns.filter((s) => s.elite).length, 2);
        if (!mirror) seen.add(JSON.stringify(level.spawns));
        const hulls = level.spawns.map((s) => {
          const { w, h } = ENEMY_STATS[s.kind];
          return { x: s.x - w / 2, y: s.y - h / 2, w, h };
        });
        for (const [i, hull] of hulls.entries()) {
          for (const solid of [...level.solids, ...hulls.slice(i + 1)])
            assert(!overlaps(hull, solid), `${source.id}: embedded enemy`);
        }
        for (const p of propPlacements(level, save.seed)) {
          const { w, h } = PROP_STATS[p.kind],
            hull = { x: p.x - w / 2, y: p.y - h / 2, w, h };
          for (const solid of [...level.solids, ...hulls]) assert(!overlaps(hull, solid));
          assert(
            level.setpiece!.weak.some((i) => {
              const s = level.solids[i];
              return p.x > s.x + w / 2 && p.x < s.x + s.w - w / 2 && Math.abs(hull.y + h - s.y) < 2;
            }),
          );
        }
        assert.equal(level.hazards!.length, index ? 2 : 0);
        for (const h of level.hazards!) {
          const swept = hazardBounds(h, 40);
          for (const solid of [...level.solids, ...hulls])
            assert(!overlaps(swept, solid), `${source.id}: obstructed lift at ${h.x}`);
        }
        const g = room(source.area, mirror, variant);
        assert.equal(g.hazards.items.length, index ? 2 : 0);
        assert.equal(g.destruction.pieces.length, 2);
      }
    assert.equal(seen.size, 3);
  }
  assert.equal(JSON.stringify(DROPWORKS_LAYOUTS), originals);
});

test('Dropworks presets stay legal and isolated for every build; malformed links fail closed', () => {
  for (const area of ['cooling', 'rooftops'])
    for (const mirror of [false, true])
      for (const variant of [1, 2, 3])
        for (const build of ['forge', 'bank', 'portal', 'standard']) {
          const save = saveFor(area, mirror, variant, build);
          assert.equal(save.mods.length, save.stage);
          assert(validBuild(save.mods));
          assert(loadCheckpoint(save));
          if (build === 'forge') assert(save.mods.includes('drop-forge'));
          if (build === 'standard') assert(!save.mods.includes('mass-driver'));
          const g = new Game();
          let saves = 0,
            victories = 0;
          g.onCheckpoint = () => saves++;
          g.onBossDefeated = () => victories++;
          g.startTest(save);
          const level = structuredClone(g.level);
          g.die();
          g.startTest(g.testRun!);
          assert.deepEqual(g.level, level);
          assert.equal(g.hp, 100);
          assert.equal(saves, 0);
          assert.equal(victories, 0);
        }
  for (const suffix of [
    '&test=dropworks',
    '&daily=x',
    '&seed=x',
    '&area=furnace',
    '&variant=0',
    '&variant=4',
    '&mirror=true',
    '&build=missing',
    '&build=forge&build=bank',
    '&area=cooling&area=rooftops',
    '&variant=1&variant=2',
    '&mirror=0&mirror=1',
  ])
    assert.equal(
      dropworksTestFromUrl(new URL('https://test/?test=dropworks' + suffix)),
      null,
      suffix,
    );
});

test('Dropworks occurs in seeded normal, Daily and Overtime runs, only after its enemy introduction', () => {
  const normal = new Set(),
    daily = new Set(),
    overtime = new Set();
  for (let i = 0; i < 180; i++) {
    const seed = 'dropworks-natural-' + i;
    const dailySeed = dailyForDate(
      new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10),
    )!.seed;
    for (const stage of [9, 17]) {
      for (const [key, found] of [
        [seed, normal],
        [dailySeed, daily],
      ] as const) {
        const l = getLevel(key, stage);
        if (l.id.startsWith('dropworks')) found.add(l.id + ':' + l.mirrored);
      }
      const ot = getOvertimeLevel(seed, stage);
      if (ot.id.startsWith('dropworks')) {
        overtime.add(ot.id + ':' + ot.mirrored);
        assert.deepEqual(ot.hazards, getLevel(overtimeSeed(seed), stage).hazards);
        assert.deepEqual(ot.setpiece, getLevel(overtimeSeed(seed), stage).setpiece);
      }
    }
    for (const stage of [0, 3, 4, 5, 6, 7, 8, 11, 12, 15, 16, 19])
      assert(!getLevel(seed, stage).id.startsWith('dropworks'));
  }
  assert.equal(normal.size, 4);
  assert.equal(daily.size, 4);
  assert.equal(overtime.size, 4);
});

test('both stairways reach the crown with ordinary jumps after the load ledges break, while lifts run', () => {
  for (const area of ['cooling', 'rooftops'])
    for (const mirror of [false, true])
      for (const reverse of [false, true]) {
        const g = room(area, mirror);
        quiet(g);
        // Check the authored stairs independently of the optional exit steps,
        // which extend over the floor endpoint when this empty fixture clears.
        g.detourStepsReady = true;
        g.mods = [];
        g.gun = getGun([]);
        for (const piece of [...g.destruction.pieces])
          g.destruction.hitBody(piece.body, 1000, { x: 0, y: 0 });
        Body.setPosition(g.player, { x: reverse ? 1860 : 140, y: 680 });
        Body.setVelocity(g.player, { x: 0, y: 0 });
        const path = reverse ? [...g.level.route].reverse() : [...g.level.route];
        let index = 0,
          previousX = g.player.position.x,
          stuck = 0,
          highest = 740;
        for (let n = 0; n < 3600 && g.mode === 'playing' && index < path.length; n++) {
          const p = g.player.position,
            target = path[index],
            dx = target.x - p.x,
            dy = p.y - target.y;
          highest = Math.min(highest, p.y);
          if (g.grounded && Math.abs(dx) < 32 && Math.abs(dy) < 12) {
            index++;
            continue;
          }
          stuck = Math.abs(p.x - previousX) < 0.4 ? stuck + 1 : 0;
          previousX = p.x;
          const steer = dx - g.player.velocity.x * 5;
          const move = steer > 6 ? 1 : steer < -6 ? -1 : 0;
          const blocked =
            !!move && Query.ray(g.solidBodies, p, { x: p.x + move * 70, y: p.y }, 24).length > 0;
          step(g, 1, {
            left: move < 0,
            right: move > 0,
            jump: g.grounded && (dy > 45 || blocked || stuck > 12),
          });
          if (!reverse && index === path.length - 1 && g.mode === 'upgrade') index++;
        }
        assert.equal(
          index,
          path.length,
          `${area}/${mirror}/${reverse} stopped ${index} at ${JSON.stringify(g.player.position)}`,
        );
        assert(highest < 230);
        assert.equal(g.hp, 100);
      }
});

test('shooting each cracked shelf drops its own crate onto the enemy below', () => {
  for (const area of ['cooling', 'rooftops'])
    for (const mirror of [false, true]) {
      const g = room(area, mirror);
      quiet(g);
      g.mods = [];
      g.gun = getGun([]);
      step(g, 40);
      for (const crate of g.props.items.filter((p) => p.kind === 'crate')) {
        assert(Math.abs(crate.body.position.y - 518) < 2);
        const x = crate.body.position.x;
        g.spawnEnemy('shooter', x, 724);
        const e = g.enemies.at(-1)!;
        e.spawn = 0;
        e.timer = 100;
        const before = e.hp,
          piece = g.destruction.pieces.find((p) => x > p.rect.x && x < p.rect.x + p.rect.w)!;
        for (let i = 0; i < 3; i++) {
          g.addShot({
            pos: { x, y: 600 },
            vel: { x: 0, y: -30 },
            damage: 24,
            life: 0.4,
            radius: 2,
            friendly: true,
            fragment: false,
            split: false,
            bounces: 0,
            pierce: 0,
          });
          g.updateShots(dt);
          g.updateShots(dt);
        }
        assert(!g.terrain.includes(piece.body));
        for (let n = 0; n < 180 && e.hp === before && g.mode === 'playing'; n++) step(g);
        assert(crate.body.position.y > 650);
        assert(
          e.hp < before,
          `${area}/${mirror}: falling crate did not damage its target ${JSON.stringify({ crate: crate.body.position, enemy: e.body.position, hits: [...crate.hits], debris: g.props.items.filter((p) => p.kind === 'rubble').map((p) => p.body.position) })}`,
        );
      }
      assert.equal(g.destruction.pieces.length, 0);
    }
});

test('the rooftop lifts carry a standing player through a complete cycle without squeezing or trapping them', () => {
  for (const mirror of [false, true])
    for (const index of [0, 1]) {
      const g = room('rooftops', mirror);
      quiet(g);
      const h = g.hazards.items[index];
      Body.setPosition(g.player, { x: h.body.position.x, y: h.placement.y - 18 });
      Body.setVelocity(g.player, { x: 0, y: 0 });
      let highest = 740,
        lowest = 0;
      for (let n = 0; n < 480; n++) {
        step(g);
        highest = Math.min(highest, g.player.position.y);
        lowest = Math.max(lowest, g.player.position.y);
        assert.equal(g.mode, 'playing');
        assert.equal(g.hp, 100);
        assert(Math.abs(g.player.position.x - h.body.position.x) < 2);
        assert(Math.abs(g.player.bounds.max.y - (h.body.position.y - h.placement.h / 2)) < 3);
      }
      assert(lowest - highest > h.placement.travel - 5);
    }
});

test('the top perch remains under pressure after its own guard dies', () => {
  for (const area of ['cooling', 'rooftops'])
    for (const mirror of [false, true]) {
      const g = room(area, mirror);
      quiet(g);
      for (const s of g.level.spawns.filter((s) => s.y > 220)) {
        g.spawnEnemy(s.kind, s.x, s.y, s.elite);
        g.enemies.at(-1)!.spawn = 0;
      }
      Body.setPosition(g.player, { x: 1000, y: 197 });
      Body.setVelocity(g.player, { x: 0, y: 0 });
      step(g, 1200);
      assert(g.hp < 100, `${area}/${mirror}: camping above the remaining roster was safe`);
    }
});

for (const area of ['cooling', 'rooftops'])
  for (const mirror of [false, true])
    for (const build of ['standard', 'forge'])
      test(`${area}/${mirror}/${build}: real encounter clears with normal health and ordinary inputs`, () => {
        const g = room(area, mirror, 1, build),
          pilot = dropworksPilot();
        for (let n = 0; n < 12000 && !g.clear && g.mode === 'playing'; n++) {
          const input = pilot(g);
          if (g.massDriver.equipped && input.fire && input.aim) {
            const p = g.player.position,
              dx = input.aim.x - p.x,
              dy = input.aim.y - (p.y - 3),
              v = g.gun.projectileSpeed,
              gravity = 0.2777777778;
            const discriminant = v ** 4 - gravity * (gravity * dx * dx - 2 * dy * v * v);
            if (Math.abs(dx) > 20 && discriminant >= 0) {
              const tangent = (v * v - Math.sqrt(discriminant)) / (gravity * Math.abs(dx));
              input.aim = { x: p.x + Math.sign(dx) * 1000, y: p.y - tangent * 1000 };
            }
          }
          step(g, 1, input);
        }
        assert(
          g.hp > 0 && g.clear,
          `${g.hp} HP, ${g.enemies.map((e) => e.kind + ':' + Math.round(e.hp))}, ${JSON.stringify(g.player.position)}`,
        );
      });
