import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import {
  STORY_KINDS,
  STORY_ROOMS,
  COLD_RIG,
  planStory,
  storyTestFromUrl,
  storyPoint,
  type StoryKind,
} from '../src/story-layout.ts';
import { loadCheckpoint, distance, type Checkpoint } from '../src/rules.ts';
import {
  loadLogbook,
  recordLogbook,
  logbookEntries,
  migrateLogbook,
  mergeLogbook,
} from '../src/logbook.ts';
import { dailyForDate } from '../src/daily.ts';
import { COLD } from '../src/cryogenic.ts';
import { playRoom } from './room-pilot.ts';

const { Body, Bodies, Composite, Query } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1500, y: 600 },
};
const preset = (kind: StoryKind, mirror = false) =>
  storyTestFromUrl(new URL(`https://test/?test=story&room=${kind}${mirror ? '&mirror=1' : ''}`))!;
function fixture(kind: StoryKind, mirror = false) {
  const g = new Game();
  g.startTest(preset(kind, mirror));
  return g;
}
function quiet(g: Game) {
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.shots = [];
  g.clear = true;
}
function step(g: Game, n = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, { ...idle, ...input });
}

test('story plans are uncommon, deterministic, and avoid events, routes, introductions and other rare encounters', () => {
  let count = 0;
  const seen = new Set();
  for (let i = 0; i < 250; i++) {
    const g = new Game();
    g.start('story-plan-' + i);
    const p = g.story.state;
    assert.deepEqual(p, planStory(g.seed, g.areaEvents.state, g.courier.state, g.floodgate.stage));
    if (!p) continue;
    count++;
    seen.add(p.kind);
    assert.notEqual(Math.floor(p.stage / 4), g.areaEvents.state?.area);
    assert.notEqual(p.stage, g.courier.state?.stage);
    assert.notEqual(p.stage, g.floodgate.stage);
    g.stage = p.stage;
    g.loadRoom();
    assert.equal(g.level.story, p.kind);
    assert(g.story.active);
    assert(!g.level.boss && !g.level.fabricatorIntro);
  }
  assert(count > 85 && count < 165, String(count));
  assert.equal(seen.size, 4);
});

test('both orientations have supported actors, pickups and props, with no embedded spawns', () => {
  for (const kind of STORY_KINDS)
    for (const mirror of [false, true]) {
      const g = fixture(kind, mirror);
      quiet(g);
      assert.equal(g.level.mirrored, mirror);
      assert.equal(g.level.story, kind);
      assert.equal(Query.collides(g.player, g.solidBodies).length, 0);
      const note = g.story.note!;
      assert.equal(
        Query.collides(Bodies.rectangle(note.x, note.y, 18, 22), g.solidBodies).length,
        0,
        kind + ' note',
      );
      for (const spawn of g.level.spawns) {
        const e = g.spawnEnemy(spawn.kind, spawn.x, spawn.y, spawn.elite);
        assert.equal(
          Query.collides(e.body, g.solidBodies).length,
          0,
          `${kind}/${mirror} ${spawn.kind} ${spawn.x},${spawn.y}`,
        );
        if (['shooter', 'sniper'].includes(spawn.kind))
          assert(
            g.solidBodies.some(
              (b) =>
                b.bounds.min.x < spawn.x &&
                b.bounds.max.x > spawn.x &&
                Math.abs(b.bounds.min.y - e.body.bounds.max.y) < 2,
            ),
          );
      }
      for (const p of g.props.items)
        assert.equal(Query.collides(p.body, g.terrain).length, 0, kind + ' ' + p.kind);
      assert.equal(g.mutations.pending.length, 0);
    }
});

test('documents require close unobstructed contact; break room heals once and saves before continuing', () => {
  const p = preset('breakroom'),
    g = new Game();
  let saved: Checkpoint | null = null;
  g.onCheckpoint = (s) => {
    saved = s;
  };
  g.start(p.seed, p);
  quiet(g);
  g.hp = 62;
  const note = g.story.note!;
  Body.setPosition(g.player, { x: note.x - 90, y: note.y });
  g.story.update(1 / 60);
  assert(!g.story.state!.recovered);
  Body.setPosition(g.player, { x: note.x - 40, y: note.y });
  const block = Bodies.rectangle(note.x - 20, note.y, 8, 100, { isStatic: true });
  g.terrain.push(block);
  Composite.add(g.engine.world, block);
  g.story.update(1 / 60);
  assert(!g.story.state!.recovered);
  g.terrain = g.terrain.filter((b) => b !== block);
  Composite.remove(g.engine.world, block);
  g.story.update(1 / 60);
  assert(g.story.state!.recovered);
  assert.equal(g.hp, 72);
  assert(saved && loadCheckpoint(saved));
  g.story.update(1);
  assert.equal(g.hp, 72);
  const h = new Game();
  h.start(p.seed, saved!);
  quiet(h);
  Body.setPosition(h.player, h.story.note!);
  h.story.update(1 / 60);
  assert.equal(h.hp, 72);
  assert(h.story.state!.recovered);
});

test('new documents stay hidden until recovered; normal and Daily recoveries persist, test documents never do', () => {
  for (const kind of STORY_KINDS) {
    const g = fixture(kind);
    let book = loadLogbook(null);
    quiet(g);
    Body.setPosition(g.player, g.story.note!);
    g.story.update(1 / 60);
    assert(g.story.state!.recovered);
    assert.deepEqual(recordLogbook(book, g), book);
    g.testRun = null;
    book = recordLogbook(book, g);
    assert.deepEqual(book.stories, [kind]);
    const records = logbookEntries([], book).filter((e) =>
      [
        'record:last-break',
        'record:return-address',
        'record:cold-control',
        'record:still-here',
      ].includes(e.id),
    );
    assert.equal(records.length, 1, kind);
    assert.deepEqual(recordLogbook(book, g), book);
    const s = { ...preset(kind), story: { kind, stage: g.stage, recovered: true } };
    assert.deepEqual(migrateLogbook(null, s, [], []).stories, [kind]);
    g.seed = dailyForDate('2026-09-19')!.seed;
    assert.deepEqual(recordLogbook(loadLogbook(null), g).stories, [kind]);
  }
  const book = loadLogbook({ version: 1, stories: ['dispatch', 'bad', 'dispatch', null] });
  assert.deepEqual(book.stories, ['dispatch']);
  assert.deepEqual(mergeLogbook(book, loadLogbook({ version: 1, stories: ['hideout'] })).stories, [
    'dispatch',
    'hideout',
  ]);
});

test('old saves, Practice, Workshop, detours, Overtime and unrelated test presets never acquire a story room', () => {
  const p = preset('dispatch');
  delete p.story;
  const g = new Game();
  g.start(p.seed, p);
  assert(!g.story.state && !g.story.active);
  const source = preset('breakroom');
  g.start(source.seed, source, { kind: 'condenser', seed: source.seed });
  assert(!g.story.active);
  g.start(source.seed, source, null, null, true);
  assert(!g.story.active);
  g.startTest({ ...source, stage: 10, detour: true });
  assert(!g.story.active);
  g.startTest({ ...source, overtime: { baseMods: 19, repairs: 0 } });
  assert(!g.story.active);
  g.startTest(p);
  assert(!g.story.active);
  g.startTest(source);
  g.loadRoom(true);
  assert(!g.story.active);
});

test('checkpoint and link validation reject malformed or colliding story state', () => {
  const p = preset('breakroom');
  assert(loadCheckpoint(p));
  for (const story of [
    null,
    { ...p.story, kind: 'bad' },
    { ...p.story, stage: 3 },
    { ...p.story, recovered: 1 },
  ])
    assert.equal(loadCheckpoint({ ...p, story }), null);
  assert.equal(loadCheckpoint({ ...p, stage: 0, story: { ...p.story!, recovered: true } }), null);
  assert.equal(loadCheckpoint({ ...p, floodgate: 8 }), null);
  for (const q of [
    '&room=hideout',
    '&test=story',
    '&room=unknown',
    '&daily=2026-09-18',
    '&phase=clear',
    '&mirror=0',
    '&mirror=1&mirror=1',
  ])
    assert.equal(storyTestFromUrl(new URL('https://test/?test=story&room=breakroom' + q)), null, q);
  for (const kind of STORY_KINDS) assert(loadCheckpoint(preset(kind)));
});

test('cold rig gives short, cover-aware freezes with a full recharge; does not hurt the player or freeze bosses', () => {
  const g = fixture('experiment');
  quiet(g);
  g.clear = false;
  const p = g.story.rig;
  const e = g.spawnEnemy('runner', p.x, p.y + 70);
  e.spawn = 0;
  const behind = g.spawnEnemy('runner', p.x + 150, p.y + 70);
  behind.spawn = 0;
  const barrier = Bodies.rectangle(p.x + 75, p.y + 20, 12, 200, { isStatic: true });
  g.terrain.push(barrier);
  Composite.add(g.engine.world, barrier);
  const boss = g.spawnEnemy('loader', p.x - 100, p.y + 70);
  boss.spawn = 0;
  const arriving = g.spawnEnemy('flyer', p.x, p.y - 70);
  arriving.spawn = 0.6;
  const ally = g.spawnEnemy('runner', p.x - 60, p.y);
  ally.spawn = 0;
  ally.allied = true;
  const hp = g.hp;
  g.story.age = COLD_RIG.warning - 0.01;
  g.story.update(0.02);
  const cold = g.cryogenic.states.get(e.id)!;
  assert(cold && cold.frozen > g.time);
  assert.equal(cold.cold, COLD.threshold);
  assert(!g.cryogenic.states.has(behind.id));
  assert(!g.cryogenic.states.has(boss.id));
  assert(!g.cryogenic.states.has(arriving.id));
  assert(!g.cryogenic.states.has(ally.id));
  assert.equal(g.hp, hp);
  const end = cold.frozen;
  g.time += 0.2;
  g.story.update(0.2);
  assert.equal(cold.frozen, end);
  g.time += 6;
  g.story.age = COLD_RIG.period + COLD_RIG.warning - 0.01;
  g.story.update(0.02);
  assert(cold.frozen > g.time);
  g.clear = true;
  const age = g.story.age;
  g.story.update(0.1);
  assert(!g.story.emitting && g.story.age > age);
});

test('pausing stops story animation, pickups and experiment time; entering a new room clears transient effects', () => {
  const g = fixture('experiment');
  Body.setPosition(g.player, g.story.note!);
  g.setMode('paused');
  const age = g.story.age;
  step(g, 90);
  g.story.update(1);
  assert.equal(g.story.age, age);
  assert(!g.story.state!.recovered);
  g.setMode('playing');
  g.story.update(1 / 60);
  assert(g.story.state!.recovered);
  g.stage = 7;
  g.loadRoom();
  assert(!g.story.active);
  assert.equal(g.cryogenic.states.size, 0);
  assert.equal(g.story.pulsed.size, 0);
});

test('dispatch belts physically carry the player and loose crates in opposite directions', () => {
  for (const mirror of [false, true]) {
    const g = fixture('dispatch', mirror);
    quiet(g);
    assert.equal(g.conveyors.items.length, 2);
    const upper = g.conveyors.items[0],
      lower = g.conveyors.items[1];
    assert.equal(upper.speed, -lower.speed);
    Body.setPosition(g.player, { x: upper.x + upper.w * 0.65, y: upper.y - 18 });
    Body.setVelocity(g.player, { x: 0, y: 0 });
    const before = g.player.position.x;
    step(g, 45);
    assert((g.player.position.x - before) * upper.speed > 30);
    const crate = g.props.items.find((p) => p.kind === 'crate')!;
    Body.setPosition(crate.body, { x: lower.x + lower.w / 2, y: lower.y - 22 });
    Body.setVelocity(crate.body, { x: 0, y: 0 });
    const start = crate.body.position.x;
    step(g, 45);
    assert((crate.body.position.x - start) * lower.speed > 30);
  }
});

test('discovery alcoves can be reached with ordinary movement and jumps in both orientations', () => {
  const paths: Record<StoryKind, number[][]> = {
    breakroom: [
      [365, 645],
      [500, 540],
      [665, 520],
    ],
    dispatch: [
      [365, 645],
      [550, 550],
    ],
    experiment: [[485, 640]],
    hideout: [
      [340, 640],
      [530, 530],
      [650, 530],
    ],
  };
  for (const kind of STORY_KINDS)
    for (const mirror of [false, true]) {
      const g = fixture(kind, mirror);
      quiet(g);
      // Begin at the entrance to the alcove's stairs in either orientation.
      Body.setPosition(g.player, storyPoint(g.level, { x: 180, y: 722 }));
      Body.setVelocity(g.player, { x: 0, y: 0 });
      step(g, 2);
      for (const [x, y] of paths[kind]) {
        const target = storyPoint(g.level, { x, y: y - 18 });
        let arrived = false;
        for (let i = 0; i < 300; i++) {
          const dx = target.x - g.player.position.x,
            dy = target.y - g.player.position.y;
          if (g.grounded && Math.abs(dx) < 25 && Math.abs(dy) < 5) {
            arrived = true;
            break;
          }
          step(g, 1, { left: dx < -8, right: dx > 8, jump: g.grounded && dy < -20 });
        }
        assert(
          arrived,
          `${kind}/${mirror} target ${x},${y} at ${JSON.stringify(g.player.position)}`,
        );
      }
      // The experiment's note is farther along its wide bench platform.
      if (kind === 'experiment')
        for (let i = 0; i < 30; i++) step(g, 1, { left: mirror, right: !mirror });
      assert(g.story.state!.recovered, kind + '/' + mirror);
    }
});

test('inspection links use a cleared isolated room and recover its document through the normal pickup', () => {
  for (const kind of STORY_KINDS) {
    const p = storyTestFromUrl(
      new URL('https://test/?test=story&room=' + kind + '&phase=inspect'),
    )!;
    const g = new Game();
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.startTest(p);
    assert(g.clear && !g.enemies.length && !g.waves.pending);
    assert(!g.story.state!.recovered);
    step(g, 2);
    assert(g.story.state!.recovered);
    assert.equal(writes, 0);
    assert.deepEqual(recordLogbook(loadLogbook(null), g), loadLogbook(null));
    assert(
      Query.collides(g.player, g.solidBodies).every((hit) => hit.depth < 1),
      kind + ' inspection spawn',
    );
  }
});

test('all four rooms remain playable through their reinforcements with ordinary combat input', () => {
  for (const kind of STORY_KINDS)
    for (const mirror of [false, true]) {
      const g = fixture(kind, mirror);
      const result = playRoom(g, 60);
      assert(result.shots > 5, kind);
      assert(result.kills > 0, kind);
      assert(result.clear && result.hp > 0, kind + '/' + mirror + ' ' + JSON.stringify(result));
      assert.equal(
        g.testRun?.story?.recovered,
        false,
        'test replay must retain a clean starting preset',
      );
    }
});
