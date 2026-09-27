import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { ClockOut, CLOCK_OUT_DURATION, CLOCK_OUT_ENTRY } from '../src/clock-out.ts';
import { clockOutTestFromUrl, prepareClockOutTest } from '../src/clock-out-test.ts';
import { EXTRACTION } from '../src/escape-layout.ts';
import { loadCheckpoint } from '../src/rules.ts';
import { musicNotes, musicScene, MUSIC_PROFILES } from '../src/music-score.ts';
import { snapshotRun, RUN_HISTORY_KEY, loadRunHistory } from '../src/run-history.ts';
import { ProgressStore, CHECKPOINT_KEY, PROGRESS_KEY } from '../src/progress.ts';
import { COMMENDATIONS_KEY } from '../src/commendations.ts';
import { loadCosmetics } from '../src/cosmetics.ts';

const preview = (suffix = '') =>
  clockOutTestFromUrl(new URL('https://test.invalid/?test=clock-out' + suffix))!;
const idle = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 7400, y: 680 },
};
function fixture(isolated = false) {
  const g = new Game(),
    save = preview();
  if (isolated) g.startTest(save);
  else g.start(save.seed, save);
  return g;
}
function board(g: Game) {
  Matter.Body.setPosition(g.player, { x: EXTRACTION.x, y: EXTRACTION.y - 18 });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  for (let i = 0; i < 5 && g.mode === 'playing'; i++) g.tick(1 / 60, idle);
  assert.equal(g.mode, 'won');
}

test('Clock Out presets are strict, valid, isolated and retry at the selected entrance', () => {
  for (const scene of ['departure', 'walk']) {
    const save = preview('&scene=' + scene);
    assert(loadCheckpoint(save));
    const g = new Game();
    let writes = 0,
      awards = 0;
    g.onCheckpoint = () => writes++;
    g.onCommendation = () => awards++;
    for (let retry = 0; retry < 2; retry++) {
      g.startTest(save);
      prepareClockOutTest(g);
      assert.equal(g.player.position.x, scene === 'walk' ? CLOCK_OUT_ENTRY.x : EXTRACTION.x);
      board(g);
      g.readyClockOut();
      g.skipClockOut();
      assert.equal(snapshotRun(g, 'test'), null);
    }
    assert.equal(writes, 0);
    assert.equal(awards, 0);
  }
  for (const suffix of [
    '&scene=no',
    '&scene=walk&scene=walk',
    '&test=clock-out',
    '&seed=cheat',
    '&daily=1',
    '&build=ray',
    '&v=1&v=2',
  ])
    assert.equal(
      clockOutTestFromUrl(new URL('https://test.invalid/?test=clock-out' + suffix)),
      null,
    );
});

test('boarding completes the run and awards Night Shift once, before any presentation frames', () => {
  const g = fixture();
  const events: string[] = [];
  g.onCommendation = (id) => events.push(id);
  g.onCheckpoint = (s) => events.push(s === null ? 'checkpoint-cleared' : 'checkpoint');
  let result = null;
  g.onChange = () => {
    if (g.mode === 'won') {
      result ??= snapshotRun(g, 'clock-out');
      events.push('won');
    }
  };
  board(g);
  assert.deepEqual(events, ['after-hours', 'checkpoint-cleared', 'won']);
  assert(result);
  assert.equal(g.clockOut.time, 0);
  assert(g.clockOut.active);
  const time = g.elapsed,
    hp = g.hp,
    mods = [...g.mods];
  for (let i = 0; i < 120; i++) {
    g.tick(1 / 60, { ...idle, fire: true });
    g.updateClockOut(1 / 60, true);
  }
  assert.equal(g.clockOut.time, 0, 'must wait for persistence');
  g.readyClockOut();
  for (let i = 0; i < 730; i++) g.updateClockOut(1 / 60, true);
  assert(!g.clockOut.active);
  assert.equal(g.clockOut.time, CLOCK_OUT_DURATION);
  assert.equal(g.elapsed, time);
  assert.equal(g.hp, hp);
  assert.deepEqual(g.mods, mods);
  g.skipClockOut();
  g.boardExtraction();
  assert.equal(events.filter((e) => e === 'after-hours').length, 1);
  assert.equal(events.filter((e) => e === 'checkpoint-cleared').length, 1);
  assert.equal(
    events.filter((e) => e === 'won').length,
    2,
    'one completion plus one presentation-end notification',
  );
});

test('skip can be requested during saving, is idempotent and cannot revive a cancelled sequence', () => {
  const g = fixture();
  board(g);
  g.skipClockOut();
  assert(g.clockOut.active);
  g.readyClockOut();
  assert(!g.clockOut.active);
  const old = g.clockOut;
  g.startTest(preview());
  assert.notEqual(g.clockOut, old);
  assert(!g.clockOut.active);
  board(g);
  g.setMode('title');
  assert(!g.clockOut.active);
});

test('presentation freezes offscreen and rejects invalid or excessive frame deltas', () => {
  const c = new ClockOut();
  c.begin();
  c.release();
  c.update(4, false);
  c.update(NaN, true);
  c.update(-1, true);
  c.update(Infinity, true);
  assert.equal(c.time, 0);
  c.update(1000, true);
  assert.equal(c.time, 0.1);
  c.skip();
  assert(!c.skip());
  assert(!c.update(0.1, true));
});

test('short Overtime departure bay is safe, reachable with ordinary movement and does not collapse', () => {
  const g = fixture();
  assert.deepEqual(g.player.position, CLOCK_OUT_ENTRY);
  const hp = g.hp,
    sounds: string[] = [];
  g.onSound = (name) => sounds.push(name);
  for (let i = 0; i < 600 && g.mode === 'playing'; i++) {
    const x = g.player.position.x;
    g.tick(1 / 60, {
      ...idle,
      left: x > EXTRACTION.x + 10,
      right: x < EXTRACTION.x - 15,
      jump: x > EXTRACTION.x - 120 && g.grounded,
      jumpHeld: true,
    });
  }
  assert.equal(g.mode, 'won');
  assert.equal(g.hp, hp);
  assert(!sounds.includes('collapse'));
});

test('persistent victory, removed checkpoint and outfit survive a reload before the cinematic starts', async () => {
  const disk = new Map<string, string>();
  const storage = {
    getItem: (k: string) => disk.get(k) ?? null,
    setItem: (k: string, v: string) => {
      disk.set(k, v);
    },
    removeItem: (k: string) => {
      disk.delete(k);
    },
  };
  const store = new ProgressStore(() => storage);
  const g = fixture();
  await store.write(CHECKPOINT_KEY, preview());
  g.onCommendation = (id) => {
    void store.write(COMMENDATIONS_KEY, [id]);
  };
  g.onCheckpoint = (save) => {
    void store.write(CHECKPOINT_KEY, save);
  };
  g.onChange = () => {
    const run = snapshotRun(g, 'clock-out-persist');
    if (run) void store.write(RUN_HISTORY_KEY, [run]);
  };
  board(g);
  await store.settled();
  assert(disk.has(PROGRESS_KEY));
  assert.equal(g.clockOut.time, 0);
  const reloaded = new ProgressStore(() => storage);
  assert.equal(reloaded.read(CHECKPOINT_KEY), null);
  assert.equal(loadRunHistory(reloaded.read(RUN_HISTORY_KEY)).length, 1);
  assert.deepEqual(reloaded.read(COMMENDATIONS_KEY), ['after-hours']);
  assert.equal(
    loadCosmetics({ outfit: 'night', gun: 'standard' }, ['after-hours']).outfit,
    'night',
  );
});

test('storage failure does not trap the player in the ending or pretend it saved', async () => {
  const store = new ProgressStore(() => ({
    getItem: () => null,
    removeItem: () => {},
    setItem: () => {
      throw Error('quota');
    },
  }));
  const g = fixture();
  board(g);
  void store.write(RUN_HISTORY_KEY, [snapshotRun(g, 'failed-save')]);
  assert.equal(await store.settled(), false);
  assert.equal(store.state, 'unavailable');
  g.readyClockOut();
  g.skipClockOut();
  assert(!g.clockOut.active);
});

test('Overtime aftermath and ride use a quiet resolving score with a finite twelve-second phrase', () => {
  const g = fixture();
  assert.equal(musicScene(g).theme, 'clock-out');
  const walkRoom = musicScene(g).room;
  board(g);
  assert(!musicScene(g).outro, 'the ride score waits for persistence too');
  g.readyClockOut();
  assert(musicScene(g).outro);
  assert.notEqual(musicScene(g).room, walkRoom);
  assert.equal((16 * 60) / MUSIC_PROFILES['clock-out'].bpm, CLOCK_OUT_DURATION);
  const notes = Array.from({ length: 64 }, (_, step) =>
    musicNotes('clock-out', step, 1, true, false),
  ).flat();
  assert(notes.length > 0);
  assert(notes.every((n) => ['pad', 'pluck'].includes(n.part) && n.velocity <= 0.17));
  assert.deepEqual(
    musicNotes('clock-out', 48, 0, false, true)
      .filter((n) => n.part === 'pad')
      .map((n) => n.midi),
    [62, 66, 69],
  );
  g.readyClockOut();
  g.skipClockOut();
  assert(!musicScene(g).outro);
});
