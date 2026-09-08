import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { Mode } from '../src/game.ts';
import type { AreaId } from '../src/areas.ts';
import { MUSIC_PROFILES, musicNotes, musicScene } from '../src/music-score.ts';
import type { MusicNote } from '../src/music-score.ts';

const areas: AreaId[] = ['docks', 'furnace', 'cooling', 'rooftops'];
const phrase = (area: AreaId, intensity = 0, boss = false, clear = false) =>
  Array.from({ length: 64 }, (_, step) => musicNotes(area, step, intensity, boss, clear));
const percussion = (notes: MusicNote[][]) =>
  notes.flat().filter((note) => ['kick', 'tick', 'snare'].includes(note.part));

test('area scores have distinct tempos, harmony and restrained phrases with deliberate rests', () => {
  assert.deepEqual(
    areas.map((area) => MUSIC_PROFILES[area].bpm),
    [88, 104, 98, 118],
  );
  const scores = areas.map((area) => phrase(area));
  assert.notDeepEqual(scores[0], scores[1]);
  assert.notDeepEqual(scores[1], scores[2]);
  assert(percussion(scores[1]).length > percussion(scores[0]).length);
  assert(percussion(scores[3]).length < percussion(scores[1]).length);
  for (const [index, score] of scores.entries()) {
    assert(
      score.filter((notes) => notes.length === 0).length >= 20,
      areas[index] + ' needs breathing room',
    );
    const plucks = score.flat().filter((note) => note.part === 'pluck');
    assert(plucks.length >= 4 && plucks.length <= 8, 'Use a phrase, not a constant arpeggio');
    assert(new Set(plucks.map((note) => note.midi)).size >= 4);
    const pads = score.flat().filter((note) => note.part === 'pad');
    assert(
      pads.every((note) => note.duration >= 3),
      'Harmony should sustain under the sparse motif',
    );
    assert.notDeepEqual(
      score.slice(0, 16),
      score.slice(32, 48),
      'The four-bar phrase needs harmonic movement',
    );
    assert(score.flat().every((note) => note.velocity < 0.5));
  }
  const roofMean =
    scores[3].flat().reduce((sum, note) => sum + note.velocity, 0) / scores[3].flat().length;
  const furnaceMean =
    scores[1].flat().reduce((sum, note) => sum + note.velocity, 0) / scores[1].flat().length;
  assert(roofMean < furnaceMean, 'Rooftops should settle into a lighter texture');
});

test('scores repeat at 64 steps and emit bounded finite notes even with invalid pressure inputs', () => {
  for (const area of areas) {
    for (const intensity of [-10, 0, 0.5, 1, 20, NaN, Infinity]) {
      for (const boss of [false, true]) {
        for (const clear of [false, true]) {
          for (let step = 0; step < 64; step++) {
            const notes = musicNotes(area, step, intensity, boss, clear);
            assert.deepEqual(musicNotes(area, step + 64, intensity, boss, clear), notes);
            assert.deepEqual(musicNotes(area, step - 64, intensity, boss, clear), notes);
            assert(notes.length <= 6, 'One sixteenth must not cause a dense voice burst');
            for (const note of notes) {
              assert(Number.isFinite(note.velocity) && note.velocity > 0 && note.velocity <= 1);
              assert(Number.isFinite(note.duration) && note.duration > 0 && note.duration <= 4);
              if (['bass', 'pad', 'pluck'].includes(note.part)) {
                assert(Number.isInteger(note.midi) && note.midi! >= 24 && note.midi! <= 90);
              } else assert.equal(note.midi, undefined);
            }
          }
        }
      }
    }
    assert.deepEqual(musicNotes(area, Infinity, 0.5, false, false), []);
    assert.deepEqual(musicNotes(area, NaN, 0.5, false, false), []);
  }
});

test('pressure and boss encounters add rhythm while retaining rests and the authored lead', () => {
  for (const area of areas) {
    const quiet = phrase(area);
    const pressure = phrase(area, 1);
    const boss = phrase(area, 0, true);
    assert(percussion(pressure).length > percussion(quiet).length);
    assert(percussion(boss).length > percussion(quiet).length);
    assert(pressure.filter((notes) => notes.length === 0).length >= 8);
    assert.notDeepEqual(phrase(area, 0.68), boss, 'Boss accents should add an identifiable rhythm');
    const melody = (score: MusicNote[][]) =>
      score
        .flat()
        .filter((note) => note.part === 'pluck')
        .map((note) => note.midi);
    assert.deepEqual(
      melody(pressure),
      melody(quiet),
      'Pressure should not turn the lead into a busy new melody',
    );
  }
});

test('clearing a room immediately removes percussion and bass regardless of pressure or boss state', () => {
  for (const area of areas) {
    const settled = phrase(area, 0, false, true);
    assert.deepEqual(phrase(area, 1, true, true), settled);
    assert(settled.flat().every((note) => ['pad', 'pluck'].includes(note.part)));
    assert(settled.flat().every((note) => note.velocity <= 0.13));
    assert(settled.filter((notes) => notes.length === 0).length >= 56);
    assert(settled.flat().some((note) => note.part === 'pad'));
    assert(settled.flat().some((note) => note.part === 'pluck'));
  }
});

function sceneFixture() {
  const game = new Game();
  game.start('score-scene');
  game.enemies = [];
  game.waves.clear();
  game.clear = false;
  game.time = 10;
  game.lastShot = -100;
  return game;
}

test('scene pressure follows live threat proximity, active attacks and a modest recent-fire lift', () => {
  const game = sceneFixture();
  const player = game.player.position;
  game.spawnEnemy('runner', player.x + 1400, player.y);
  const enemy = game.enemies[0];
  assert.equal(musicScene(game).intensity, 0);
  Matter.Body.setPosition(enemy.body, { x: player.x + 450, y: player.y });
  const middle = musicScene(game).intensity;
  Matter.Body.setPosition(enemy.body, { x: player.x + 60, y: player.y });
  const close = musicScene(game).intensity;
  assert(close > middle && middle > 0);
  for (const state of ['windup', 'rush', 'followup', 'airborne'] as const) {
    enemy.state = state;
    assert(musicScene(game).intensity > close);
  }
  enemy.state = 'recover';
  assert.equal(musicScene(game).intensity, close);
  game.lastShot = game.time;
  const firing = musicScene(game).intensity - close;
  assert(firing > 0 && firing <= 0.081);
  game.lastShot = game.time - 0.5;
  assert.equal(musicScene(game).intensity, close);
  game.lastShot = game.time + 1;
  assert.equal(musicScene(game).intensity, close, 'Future timestamps must not amplify pressure');
  enemy.hp = 0;
  assert.equal(musicScene(game).intensity, 0);
  assert.equal(musicScene(game).clear, true);
});

test('scene identity maps room and mode correctly while menus, clear rooms and dead bosses settle', () => {
  const game = sceneFixture();
  game.spawnEnemy('loader', game.player.position.x + 100, game.player.position.y);
  assert.equal(musicScene(game).boss, true);
  assert.equal(musicScene(game).room, 'score-scene:0');
  const initial = musicScene(game);
  game.time += 120;
  game.elapsed += 500;
  assert.equal(musicScene(game).room, initial.room);
  for (const mode of ['title', 'paused', 'upgrade', 'dead', 'won'] as Mode[]) {
    game.mode = mode;
    const scene = musicScene(game);
    assert.equal(scene.mode, mode);
    assert.equal(scene.intensity, 0);
    assert.equal(scene.boss, true, 'Boss identity should survive a pause');
  }
  game.mode = 'playing';
  game.clear = true;
  assert.equal(musicScene(game).intensity, 0);
  game.enemies[0].hp = 0;
  assert.equal(musicScene(game).boss, false);

  for (const stage of [0, 5, 9, 13]) {
    game.start('continued-score', {
      version: 4,
      seed: 'continued-score',
      stage,
      hp: 72,
      mods: [],
      kills: 9,
      elapsed: 60,
    });
    assert.equal(
      musicScene(game).area,
      stage === 0 ? 'docks' : stage === 5 ? 'furnace' : stage === 9 ? 'cooling' : 'rooftops',
    );
    assert.equal(musicScene(game).room, 'continued-score:' + stage);
  }
});

test('scene pressure stays bounded under many attacks and score queries never consume RNG or mutate gameplay', () => {
  const game = sceneFixture();
  for (let i = 0; i < 14; i++) {
    game.spawnEnemy(i === 0 ? 'boss' : 'charger', game.player.position.x, game.player.position.y);
    game.enemies.at(-1)!.state = 'windup';
  }
  game.lastShot = game.time;
  assert.equal(musicScene(game).intensity, 1);
  const expected = musicScene(game);
  const layout = JSON.stringify(game.level);
  const oldRandom = Math.random;
  game.rng = () => {
    throw Error('Music consumed game RNG');
  };
  Object.freeze(game);
  Object.freeze(game.enemies);
  Object.freeze(game.player.position);
  for (const enemy of game.enemies) {
    Object.freeze(enemy);
    Object.freeze(enemy.body.position);
  }
  try {
    Math.random = () => {
      throw Error('Score used non-deterministic randomness');
    };
    for (let i = 0; i < 128; i++) {
      assert.deepEqual(musicScene(game), expected);
      for (const area of areas) musicNotes(area, i, 0.6, true, false);
    }
  } finally {
    Math.random = oldRandom;
  }
  assert.equal(JSON.stringify(game.level), layout);
});
