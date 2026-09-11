import test from 'node:test';
import assert from 'node:assert/strict';
import { BOSS_LAYOUTS, getLevel, LAYOUTS, SPECIAL_LAYOUTS } from '../src/levels.ts';
import type { Level } from '../src/levels.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import type { EliteKind } from '../src/enemies.ts';
import { Game } from '../src/game.ts';
import { loadCheckpoint, STAGES } from '../src/rules.ts';
import type { Checkpoint } from '../src/rules.ts';
import { dailyForDate } from '../src/daily.ts';

const elites = (level: Level) => level.spawns.filter((spawn) => spawn.elite);

test('every run gets ten elites, one per eligible room and at most one per room', () => {
  const seen = new Set<EliteKind>();
  const selectedStages = new Set<number>();
  for (let index = 0; index < 256; index++) {
    const levels = Array.from({ length: STAGES }, (_, stage) => getLevel('elite-' + index, stage));
    const encounters = levels.flatMap((level, stage) => {
      const found = elites(level);
      assert(found.length <= 1, `elite-${index}, room ${stage + 1}`);
      if (stage < 4 || level.boss) assert.equal(found.length, 0);
      return found.map((spawn) => ({ stage, elite: spawn.elite!, kind: spawn.kind }));
    });
    assert.equal(encounters.length, 10);
    assert([4, 5].includes(encounters[0].stage));
    assert.equal(encounters[1].stage, 6);
    assert([8, 9].includes(encounters[2].stage));
    assert.equal(encounters[3].stage, 10);
    assert(['shielded', 'twin'].includes(encounters[0].elite));
    assert.notEqual(encounters[0].elite, encounters[2].elite);
    assert.deepEqual(
      encounters.slice(4).map((e) => e.stage),
      [12, 13, 14, 16, 17, 18],
    );
    for (const encounter of encounters) {
      seen.add(encounter.elite);
      selectedStages.add(encounter.stage);
      assert.equal(
        encounter.kind,
        { shielded: 'runner', twin: 'sniper', volatile: 'flyer' }[encounter.elite],
      );
    }
  }
  assert.deepEqual([...seen].sort(), ['shielded', 'twin', 'volatile']);
  assert.deepEqual(
    [...selectedStages].sort((a, b) => a - b),
    [4, 5, 6, 8, 9, 10, 12, 13, 14, 16, 17, 18],
  );
});

test('elite promotion keeps authored safe hull anchors, mirrored geometry, and unique spawn positions', () => {
  const sources = [...LAYOUTS, ...BOSS_LAYOUTS, ...SPECIAL_LAYOUTS];
  const before = JSON.stringify(sources);
  const variants = new Set<string>();
  for (let index = 0; index < 128; index++) {
    for (const stage of [4, 5, 6, 8, 9, 10, 12, 13, 14, 16, 17, 18]) {
      const level = getLevel('elite-hull-' + index, stage);
      const source = sources.find((layout) => layout.id === level.id)!;
      assert.equal(new Set(level.spawns.map(({ x, y }) => `${x},${y}`)).size, level.spawns.length);
      assert.deepEqual(
        level.solids,
        source.solids.map((solid) => ({
          ...solid,
          x: level.mirrored ? 2000 - solid.x - solid.w : solid.x,
        })),
      );
      for (const spawn of elites(level)) {
        variants.add(spawn.elite + ':' + level.mirrored);
        const anchorKind = { shielded: 'runner', twin: 'shooter', volatile: 'flyer' }[spawn.elite!];
        const anchors = source.spawns
          .filter(
            (anchor) =>
              anchor.kind === anchorKind ||
              (anchorKind === 'runner' && ['hopper', 'charger'].includes(anchor.kind)) ||
              (anchorKind === 'shooter' && anchor.kind === 'sniper'),
          )
          .map((anchor) => ({ ...anchor, x: level.mirrored ? 2000 - anchor.x : anchor.x }));
        assert(
          anchors.some((anchor) => {
            if (anchor.y !== spawn.y) return false;
            if (anchor.x === spawn.x) return true;
            if (spawn.elite !== 'twin') return false;
            const support = level.solids.find(
              (solid) =>
                Math.abs(solid.y - anchor.y - 16) < 0.1 &&
                anchor.x >= solid.x &&
                anchor.x <= solid.x + solid.w,
            );
            return !!support && spawn.x === Math.max(380, support.x + 19);
          }),
          `${level.id}: ${spawn.elite} lost its authored hull anchor`,
        );
        const { w, h } = ENEMY_STATS[spawn.kind];
        assert(spawn.x >= 380 && spawn.x + w / 2 < 1840);
        for (const solid of level.solids) {
          const overlapX =
            Math.min(spawn.x + w / 2, solid.x + solid.w) - Math.max(spawn.x - w / 2, solid.x);
          const overlapY =
            Math.min(spawn.y + h / 2, solid.y + solid.h) - Math.max(spawn.y - h / 2, solid.y);
          assert(overlapX <= 0.1 || overlapY <= 0.1, `${level.id}: elite intersects terrain`);
        }
      }
    }
  }
  assert.equal(
    JSON.stringify(sources),
    before,
    'Generating elites must not mutate authored layouts',
  );
  assert.equal(variants.size, 6, 'Each elite appears in both mirrored and original layouts');
});

test('elite selection is repeatable even when rooms are requested out of order', () => {
  for (let index = 0; index < 40; index++) {
    const seed = 'elite-order-' + index;
    const original = Array.from({ length: STAGES }, (_, stage) => getLevel(seed, stage));
    for (const stage of [9, 4, 11, 0, 8, 1, 7, 5, 3]) {
      assert.deepEqual(getLevel(seed, stage), original[stage]);
    }
    const edited = getLevel(seed, 8);
    edited.spawns[0].x = -1000;
    edited.spawns[0].elite = 'volatile';
    assert.deepEqual(
      getLevel(seed, 8),
      original[8],
      'Returned rooms must not share mutable spawn state',
    );
  }
});

test('ordinary and daily checkpoints reconstruct identical elite bodies without saving extra metadata', () => {
  for (const seed of [
    'elite-save-0',
    'elite-save-1',
    'elite-save-2',
    dailyForDate('2026-09-06')!.seed,
  ]) {
    for (const stage of [4, 5, 6, 8, 9, 10, 12, 13, 14, 16, 17, 18]) {
      const checkpoint: Checkpoint = {
        version: 5,
        seed,
        stage,
        hp: 71,
        mods: ['magnum', 'burst'],
        kills: 12,
        elapsed: 65.25,
      };
      const restored = loadCheckpoint(JSON.parse(JSON.stringify(checkpoint)))!;
      assert(restored);
      const game = new Game();
      game.start(restored.seed, restored);
      const expected = getLevel(seed, stage);
      assert.deepEqual(game.level, expected);
      const roster = [
        ...game.enemies.map((enemy) => ({
          kind: enemy.kind,
          elite: enemy.elite,
          x: enemy.body.position.x,
          y: enemy.body.position.y,
        })),
        ...game.waves.doors.map(({ spawn }) => ({
          kind: spawn.kind,
          x: spawn.x,
          y: spawn.y,
          elite: spawn.elite,
        })),
      ];
      const ordered = (spawns: typeof roster) => [...spawns].sort((a, b) => a.x - b.x || a.y - b.y);
      assert.deepEqual(
        ordered(roster),
        ordered(expected.spawns.map((spawn) => ({ ...spawn, elite: spawn.elite }))),
      );
      assert.equal(game.hp, 71);
      assert.equal(game.elapsed, 65.25);
      assert.deepEqual(game.mods, checkpoint.mods);
    }
  }
});
