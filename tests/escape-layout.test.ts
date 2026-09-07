import test from 'node:test';
import assert from 'node:assert/strict';
import { ESCAPE_LAYOUT, ESCAPE_PLATFORMS, ESCAPE_WIDTH, EXTRACTION } from '../src/escape-layout.ts';
import type { Solid } from '../src/levels.ts';
import { hazardBounds } from '../src/hazard-layouts.ts';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { Input } from '../src/game.ts';

const overlaps = (a: Solid, b: Solid) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

test('extraction spans three separated rooftop clusters with safe jumps and an unobstructed lift shaft', () => {
  assert(ESCAPE_WIDTH >= 7200 && ESCAPE_WIDTH <= 7600);
  assert.equal(ESCAPE_LAYOUT.id, 'last-flight');
  assert.equal(ESCAPE_LAYOUT.name, 'Extraction route');
  assert.equal(ESCAPE_LAYOUT.area, 'rooftops');
  assert.equal(ESCAPE_LAYOUT.mirrored, false);
  assert.equal(ESCAPE_LAYOUT.boss, false);
  assert.deepEqual(ESCAPE_LAYOUT.spawns, []);
  const start = { x: 127, y: 662, w: 26, h: 36 };
  const shaft = { x: EXTRACTION.x - 100, y: 0, w: 200, h: 740 };
  const clusters = [
    [600, 2100],
    [2850, 4250],
    [5100, 6500],
  ];
  const grounded = ESCAPE_LAYOUT.solids.filter((solid) => solid.y + solid.h === 740);
  assert.equal(grounded.length, 9);
  for (const [left, right] of clusters) {
    assert.equal(
      grounded.filter((solid) => solid.x >= left && solid.x + solid.w <= right).length,
      3,
    );
  }
  for (const solid of ESCAPE_LAYOUT.solids) {
    assert(solid.x >= 600 && solid.x + solid.w < EXTRACTION.x - 100);
    assert(solid.y > 300 && solid.y + solid.h <= 740);
    assert(solid.w > 0 && solid.h > 0);
    assert(!overlaps(solid, start));
    assert(!overlaps(solid, shaft));
    assert(clusters.some(([left, right]) => solid.x >= left && solid.x + solid.w <= right));
    if (solid.y + solid.h === 740)
      assert(solid.h <= 130, 'Mandatory blocks must fit ordinary jump height');
  }
  assert(EXTRACTION.x - EXTRACTION.w / 2 > 7000);
  assert(EXTRACTION.x + EXTRACTION.w / 2 < ESCAPE_WIDTH);
  assert.equal(EXTRACTION.y, 700);
  assert.equal(EXTRACTION.h, 20);
  assert.equal(ESCAPE_LAYOUT.route.at(-1)!.x, EXTRACTION.x);
  assert(
    ESCAPE_LAYOUT.route.every((point, index, route) => index === 0 || point.x > route[index - 1].x),
  );
});

test('collapsing shortcut platforms are optional, collision-free, and reachable from permanent cover', () => {
  assert.equal(ESCAPE_PLATFORMS.length, 6);
  const shaft = { x: EXTRACTION.x - 100, y: 0, w: 200, h: 740 };
  for (const platform of ESCAPE_PLATFORMS) {
    assert.equal(platform.kind, 'crumble');
    assert.equal(platform.travel, 0);
    assert.equal(platform.h, 18);
    const hull = hazardBounds(platform);
    const rider = hazardBounds(platform, 40);
    assert(!overlaps(hull, shaft));
    for (const solid of ESCAPE_LAYOUT.solids)
      assert(!overlaps(rider, solid), 'Shortcut needs a clear platform and rider hull');
    for (const other of ESCAPE_PLATFORMS) {
      if (other !== platform) assert(!overlaps(hull, hazardBounds(other)));
    }
    const supports = [{ x: 0, y: 740, w: ESCAPE_WIDTH, h: 100 }, ...ESCAPE_LAYOUT.solids];
    assert(
      supports.some((support) => {
        const rise = support.y - platform.y;
        const gap = Math.max(0, hull.x - support.x - support.w, support.x - hull.x - hull.w);
        return rise > 0 && rise <= 180 && gap <= 220;
      }),
      'An ordinary jump must reach the shortcut from nearby permanent support',
    );
    assert(
      platform.y + platform.h < 740,
      'Falling from the shortcut must lead back to safe ground',
    );
  }
});

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 800, y: 680 },
};

function escapeFixture() {
  const game = new Game();
  game.start('escape-layout', {
    version: 3,
    seed: 'escape-layout',
    stage: 11,
    hp: 100,
    mods: [],
    kills: 0,
    elapsed: 0,
  });
  for (const enemy of [...game.enemies]) game.hitEnemy(enemy, 99999);
  for (let frame = 0; frame < 30 && !game.clear; frame++) game.tick(1 / 60, idle);
  assert(game.clear);
  game.startEscape();
  assert.equal(game.level.id, 'last-flight');
  assert.equal(game.worldWidth, ESCAPE_WIDTH);
  assert.equal(game.mode, 'playing');
  assert.equal(game.hp, 100);
  return game;
}

function traverse(game: Game, recoil = false) {
  const start = game.elapsed;
  let boarded = 0;
  let frames = 0;
  let peakSpeed = 0;
  let highest = game.player.position.y;
  let previousX = game.player.position.x;
  let stuck = 0;
  for (; frames < 3600 && game.mode === 'playing'; frames++) {
    const position = game.player.position;
    const dx = EXTRACTION.x - position.x;
    let move = dx > 12 ? 1 : dx < -12 ? -1 : 0;
    const boosting = recoil && position.x < 6400;
    if (recoil && !boosting && game.player.velocity.x > 8) move = -1;
    const blocked =
      move &&
      Matter.Query.ray(game.solidBodies, position, { x: position.x + move * 70, y: position.y }, 24)
        .length > 0;
    stuck = Math.abs(position.x - previousX) < 0.4 ? stuck + 1 : 0;
    previousX = position.x;
    game.tick(1 / 60, {
      left: move < 0,
      right: move > 0,
      jump: game.grounded && (boosting || !!blocked || stuck > 12),
      jumpHeld: true,
      fire: boosting,
      aim: { x: position.x - 1000, y: position.y + 450 },
    });
    if (game.escape?.phase === 'route') {
      peakSpeed = Math.max(peakSpeed, Math.abs(game.player.velocity.x));
      highest = Math.min(highest, game.player.position.y);
    }
    if (!boarded && game.escape?.phase === 'extracting') boarded = (frames + 1) / 60;
  }
  assert.equal(
    game.mode,
    'won',
    `Stopped at ${Math.round(game.player.position.x)},${Math.round(game.player.position.y)}`,
  );
  assert.equal(game.hp, 100);
  assert.equal(game.player.position.x, EXTRACTION.x);
  return {
    route: game.elapsed - start,
    total: frames / 60,
    boarded,
    peakSpeed,
    highest,
    shots: game.shotCount,
  };
}

test('ordinary movement reaches extraction in a short safe run and finishes with the lift ride', () => {
  const game = escapeFixture();
  const result = traverse(game);
  assert(
    result.route >= 18 && result.route <= 26,
    `Ordinary crossing took ${result.route.toFixed(2)} seconds`,
  );
  assert(result.total - result.boarded >= 2.6 && result.total - result.boarded <= 2.65);
  assert.equal(result.shots, 0);
  assert(game.hazards.items.every((platform) => platform.state === 'gone'));
});

test('the same gun can recoil past the upper routes faster while the floor survives every collapse', () => {
  const ordinary = traverse(escapeFixture());
  const boosted = traverse(escapeFixture(), true);
  assert(
    boosted.route < ordinary.route * 0.8,
    `Recoil ${boosted.route.toFixed(2)}s versus ordinary ${ordinary.route.toFixed(2)}s`,
  );
  assert(boosted.peakSpeed > 12);
  assert(boosted.shots > 5);
  assert(boosted.highest < 350);
  const collapsed = escapeFixture();
  collapsed.hazards.clear();
  const withoutPlatforms = traverse(collapsed);
  assert(
    withoutPlatforms.route <= 26,
    'Collapsing platforms must not be required to reach extraction',
  );
});
