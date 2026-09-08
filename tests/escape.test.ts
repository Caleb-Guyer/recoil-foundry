import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, WORLD, EXTRACTION_DURATION } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import { ESCAPE_LAYOUT, ESCAPE_WIDTH, EXTRACTION } from '../src/escape-layout.ts';
import { CRUMBLE_TELL, CRUMBLE_RESET } from '../src/hazards.ts';
import { STAGES, getGun, loadCheckpoint } from '../src/rules.ts';
import type { Checkpoint } from '../src/rules.ts';
import { dailyForDate, recordDailyWin } from '../src/daily.ts';
import { musicScene } from '../src/music-score.ts';

const { Body, Composite } = Matter;
const mods = [
  'magnum',
  'scatter',
  'rapid',
  'airshot',
  'kick',
  'burst',
  'backblast',
  'landing',
  'deadeye',
  'execute',
  'pierce',
];

function step(g: Game, count = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < count; i++)
    g.tick(1 / 60, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: true,
      fire: false,
      aim: { x: 1600, y: 500 },
      ...input,
    });
}

function until(g: Game, condition: () => boolean, limit = 240) {
  for (let i = 0; i < limit && !condition(); i++) step(g);
  assert(condition(), 'Timed out waiting for the escape state');
}

function checkpoint(escape = true): Checkpoint {
  return {
    version: 3,
    seed: 'escape-test',
    stage: STAGES - 1,
    hp: 73,
    mods: [...mods],
    kills: 42,
    elapsed: 123.45,
    ...(escape ? { escape: true as const } : {}),
  };
}

function fixture() {
  const g = new Game(),
    save = checkpoint();
  g.start(save.seed, loadCheckpoint(save)!);
  return g;
}

function board(g: Game) {
  Body.setPosition(g.player, { x: EXTRACTION.x, y: EXTRACTION.y - 18 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  until(g, () => g.escape?.phase === 'extracting', 5);
}

function bullet(g: Game, x: number, y: number) {
  g.addShot({
    pos: { x, y },
    vel: { x: 30, y: 0 },
    damage: 24,
    life: 2,
    friendly: true,
    radius: 2.5,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
}

test('clearing the final boss opens and saves the escape entrance without changing the gun or awarding another upgrade', () => {
  const g = new Game(),
    save = checkpoint(false),
    saves: (Checkpoint | null)[] = [];
  g.start(save.seed, save);
  g.onCheckpoint = (value) => saves.push(value);
  Body.setPosition(g.player, { x: 1910, y: 722 });
  step(g);
  assert.equal(g.escape, null, 'The boss exit opened while the boss was alive');
  for (const e of [...g.enemies]) g.hitEnemy(e, 99999);
  const hp = g.hp,
    kills = g.kills,
    oldBodies = Composite.allBodies(g.engine.world);
  until(g, () => g.escape !== null, 60);
  assert.equal(g.mode, 'playing');
  assert.equal(g.escape?.phase, 'route');
  assert.equal(g.stage, STAGES - 1);
  assert.equal(g.hp, hp);
  assert.equal(g.kills, kills);
  assert.deepEqual(g.mods, mods);
  assert.deepEqual(g.gun, getGun(mods));
  assert.equal(g.enemies.length, 0);
  assert.equal(g.props.items.length, 0);
  assert(g.clear);
  assert.equal(g.worldWidth, ESCAPE_WIDTH);
  assert.deepEqual(g.player.position, { x: 140, y: 680 });
  assert(g.extractionLift && g.solidBodies.includes(g.extractionLift));
  assert.equal(saves.length, 1);
  assert.equal(loadCheckpoint(saves[0])?.escape, true);
  assert.equal(saves[0]?.elapsed, g.elapsed);
  for (const body of oldBodies) assert(!Composite.allBodies(g.engine.world).includes(body));
});

test('escape entry requires the cleared final room and cannot restart an active route', () => {
  const g = new Game();
  g.start('entry-gates');
  g.clear = true;
  g.startEscape();
  assert.equal(g.escape, null);
  g.stage = STAGES - 1;
  g.loadRoom();
  g.startEscape();
  assert.equal(g.escape, null);
  g.clear = true;
  g.setMode('paused');
  g.startEscape();
  assert.equal(g.escape, null);
  g.setMode('playing');
  g.startEscape();
  const body = g.player,
    route = g.escape;
  step(g, 30);
  g.startEscape();
  assert.equal(g.player, body);
  assert.equal(g.escape, route);
  assert(g.escape!.time > 0);
});

test('passing the old room exit keeps the escape playable without a lethal countdown', () => {
  const g = fixture();
  Body.setPosition(g.player, { x: 1910, y: 600 });
  step(g, 60 * 30);
  assert.equal(g.mode, 'playing');
  assert.equal(g.escape?.phase, 'route');
  assert(g.escape!.time > 29);
  assert.equal(g.hp, 73);
  assert.equal(g.mods.length, 11);
  assert(g.player.position.y <= WORLD.floor);
});

test('escape containment, projectiles, and dynamic props use the extended world width', () => {
  const g = fixture();
  assert(g.worldWidth > WORLD.width * 3);
  Body.setPosition(g.player, { x: g.worldWidth + 20, y: 200 });
  Body.setVelocity(g.player, { x: 16, y: -8 });
  g.containPlayer();
  assert(g.player.vertices.every((vertex) => vertex.x <= ESCAPE_WIDTH + 0.01));
  assert.equal(g.player.velocity.x, 0);
  assert.equal(g.player.velocity.y, -8);
  bullet(g, 2500, 200);
  g.updateShots(0.1);
  assert.equal(g.shots.length, 1);
  assert(g.shots[0].pos.x > 2600);
  const crate = g.props.spawn('crate', 2500, 500);
  step(g);
  assert(crate.body.position.x > 2400, 'A prop was clamped back into a normal room');
});

test('recoil remains controllable throughout the wider escape with bounded particles and projectiles', () => {
  const g = fixture();
  Body.setPosition(g.player, { x: 2500, y: 250 });
  for (let i = 0; i < 900; i++) {
    const p = g.player.position;
    step(g, 1, {
      left: i % 240 >= 120,
      right: i % 240 < 120,
      jump: g.grounded && i % 40 === 0,
      fire: true,
      aim: { x: p.x + Math.cos(i * 0.04) * 500, y: p.y + Math.sin(i * 0.04) * 500 },
    });
    assert.equal(g.mode, 'playing');
    assert(
      g.player.vertices.every((vertex) => vertex.x >= -0.01 && vertex.x <= ESCAPE_WIDTH + 0.01),
    );
    assert(
      g.player.vertices.every((vertex) => vertex.y >= -0.01 && vertex.y <= WORLD.floor + 0.01),
    );
    assert(g.shots.length <= 180);
    assert(g.particles.length <= 220);
  }
  assert.equal(g.hp, 73);
});

test('escape platforms warn before falling and stay gone while the permanent floor keeps the player safe', () => {
  const g = fixture(),
    platform = g.hazards.items[0];
  assert(platform.permanent);
  Body.setPosition(g.player, { x: platform.placement.x, y: platform.placement.y - 18 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  until(g, () => platform.state === 'warning', 5);
  const started = g.time;
  step(g, Math.floor(CRUMBLE_TELL * 60) - 2);
  assert.equal(platform.state, 'warning');
  until(g, () => platform.state === 'gone', 5);
  assert(g.time - started >= CRUMBLE_TELL - 1e-6);
  step(g, Math.ceil(CRUMBLE_RESET * 60) + 60);
  assert.equal(platform.state, 'gone');
  assert(!platform.visible);
  assert(!g.hazards.bodies.includes(platform.body));
  assert(!Composite.allBodies(g.engine.world).includes(platform.body));
  assert(g.grounded);
  assert.equal(g.hp, 73);
});

test('extraction only boards a fully supported player inside the deck, not an airborne or edge overlap', () => {
  const placements = [
    { x: EXTRACTION.x, y: EXTRACTION.y - 180, vy: 0 },
    { x: EXTRACTION.x - EXTRACTION.w / 2 + 5, y: EXTRACTION.y - 18, vy: 0 },
    { x: EXTRACTION.x, y: EXTRACTION.y - 18, vy: -8 },
  ];
  for (const { x, y, vy } of placements) {
    const g = fixture();
    Body.setPosition(g.player, { x, y });
    Body.setVelocity(g.player, { x: 0, y: vy });
    step(g);
    assert.equal(g.escape?.phase, 'route');
    board(g);
    assert.equal(g.escape?.phase, 'extracting');
    assert.equal(g.mode, 'playing');
  }
});

test('boarding clears buffered attacks and protects the player throughout automatic departure', () => {
  const g = fixture();
  bullet(g, 2500, 200);
  g.burstRemaining = 2;
  g.burstAt = g.time + 20;
  g.fireBuffer = 0.1;
  board(g);
  assert.equal(g.shots.length, 0);
  assert.equal(g.burstRemaining, 0);
  assert.equal(g.fireBuffer, 0);
  const shots = g.shotCount,
    hp = g.hp,
    y = g.player.position.y;
  g.damagePlayer(9999);
  g.fire();
  step(g, 30, { left: true, jump: true, fire: true, aim: { x: -500, y: 1000 } });
  assert.equal(g.hp, hp);
  assert.equal(g.shotCount, shots);
  assert.equal(g.shots.length, 0);
  assert.equal(g.burstRemaining, 0);
  assert.equal(g.player.position.x, EXTRACTION.x);
  assert(g.player.position.y < y);
  assert.equal(g.player.position.y + 18, g.extractionLift!.bounds.min.y);
});

test('departure pauses, completes its full animation, and emits the win and checkpoint clear exactly once', () => {
  const g = fixture();
  let wins = 0,
    cleared = 0;
  g.onSound = (kind) => {
    if (kind === 'win') wins++;
  };
  g.onCheckpoint = (save) => {
    if (!save) cleared++;
  };
  board(g);
  const snapshot = {
    time: g.time,
    elapsed: g.elapsed,
    depart: g.escape!.depart,
    position: { ...g.player.position },
  };
  g.setMode('paused');
  step(g, 120);
  assert.deepEqual(
    { time: g.time, elapsed: g.elapsed, depart: g.escape!.depart, position: g.player.position },
    snapshot,
  );
  g.setMode('playing');
  step(g, Math.floor(EXTRACTION_DURATION * 60) - 2);
  assert.equal(g.mode, 'playing');
  assert.equal(wins, 0);
  until(g, () => g.mode === 'won', 5);
  assert.equal(g.escape!.depart, EXTRACTION_DURATION);
  assert.equal(g.elapsed, snapshot.elapsed);
  assert.equal(wins, 1);
  assert.equal(cleared, 1);
  step(g, 240, { fire: true, right: true });
  assert.equal(wins, 1);
  assert.equal(cleared, 1);
});

test('daily timing includes escape traversal and excludes pauses and automatic departure', () => {
  const challenge = dailyForDate('2026-09-06')!,
    g = new Game();
  g.start(challenge.seed);
  for (let i = 0; i < STAGES - 1; i++) {
    g.openReward();
    assert.equal(g.offers.length, 1);
    g.chooseMod(g.offers[0].id);
  }
  g.elapsed = 100;
  g.loadRoom(true);
  step(g, 120);
  assert(Math.abs(g.elapsed - 102) < 1e-6);
  const beforePause = g.elapsed;
  g.setMode('paused');
  step(g, 240);
  assert.equal(g.elapsed, beforePause);
  g.setMode('playing');
  board(g);
  const boardingTime = g.elapsed;
  until(g, () => g.mode === 'won');
  assert.equal(g.elapsed, boardingTime);
  assert.equal(recordDailyWin({}, challenge, g.elapsed)!.best, Math.round(boardingTime * 100));
});

test('escape checkpoints validate strictly and resume at the route entrance with the saved build and clock', () => {
  const saved = checkpoint();
  assert.deepEqual(loadCheckpoint(saved), saved);
  for (const invalid of [
    { ...saved, stage: 7 },
    { ...saved, mods: mods.slice(0, 7) },
    { ...saved, mods: [...mods, 'leech'] },
    { ...saved, escape: false },
    { ...saved, escape: 'true' },
    { ...saved, escape: null },
  ])
    assert.equal(loadCheckpoint(invalid), null);
  assert(loadCheckpoint({ ...checkpoint(false), stage: 3, mods: mods.slice(0, 3) }));
  const g = fixture();
  Body.setPosition(g.player, { x: 4000, y: 680 });
  step(g, 120);
  assert(g.hazards.items.some((hazard) => hazard.state === 'gone'));
  g.start(saved.seed, saved);
  assert.deepEqual(g.player.position, { x: 140, y: 680 });
  assert.equal(g.escape?.phase, 'route');
  assert.equal(g.escape?.time, 0);
  assert.equal(g.escape?.depart, 0);
  assert.equal(g.hp, saved.hp);
  assert.equal(g.kills, saved.kills);
  assert.equal(g.elapsed, saved.elapsed);
  assert.deepEqual(g.mods, saved.mods);
  assert.deepEqual(g.gun, getGun(saved.mods));
  assert.deepEqual(g.level, ESCAPE_LAYOUT);
  assert(
    g.hazards.items.every(
      (hazard) => hazard.state === 'idle' && hazard.visible && hazard.permanent,
    ),
  );
});

test('retrying and normal room loads remove the extraction world and reset all escape state', () => {
  const g = fixture();
  board(g);
  step(g, 20);
  const old = Composite.allBodies(g.engine.world);
  g.loadRoom();
  assert.equal(g.escape, null);
  assert.equal(g.extractionLift, null);
  assert.equal(g.worldWidth, WORLD.width);
  assert(g.level.boss);
  assert(['boss', 'interceptor'].includes(g.enemies[0].kind));
  for (const body of old) assert(!Composite.allBodies(g.engine.world).includes(body));
  g.start('retry');
  assert.equal(g.stage, 0);
  assert.equal(g.hp, 100);
  assert.deepEqual(g.mods, []);
  assert.equal(g.elapsed, 0);
  assert.equal(g.escape, null);
  assert.equal(g.worldWidth, WORLD.width);
  assert(!g.player.isStatic);
  assert.equal(loadCheckpoint({ ...checkpoint(false), escape: undefined })?.escape, undefined);
});

test('the escape soundtrack stays urgent on the route and settles after boarding', () => {
  const g = new Game();
  g.start('escape-music', checkpoint(false));
  const boss = musicScene(g);
  g.loadRoom(true);
  const route = musicScene(g);
  assert.notEqual(route.room, boss.room);
  assert.equal(route.area, 'rooftops');
  assert(route.intensity > 0.7);
  assert.equal(route.clear, false);
  assert.equal(route.boss, false);
  g.setMode('paused');
  assert.equal(musicScene(g).intensity, 0);
  g.setMode('playing');
  board(g);
  const departing = musicScene(g);
  assert.equal(departing.clear, true);
  assert.equal(departing.intensity, 0);
});
