import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import { musicNotes, musicScene, MUSIC_PROFILES } from '../src/music-score.ts';
import { annexRouteTestFromUrl } from '../src/annex-route.ts';
import { annexTestFromUrl } from '../src/annex-layout.ts';
import { switchboardTestFromUrl } from '../src/switchboard-layout.ts';
import { updateCaller } from '../src/caller.ts';
import { fixture, Body } from './branches-fixture.ts';

const phrase = (intensity = 1, boss = false, clear = false, phase = 0) =>
  Array.from({ length: 128 }, (_, i) =>
    musicNotes('annex', 128 + i, intensity, boss, clear, phase),
  );
const drums = new Set(['kick', 'snare', 'tick', 'drive']);

test('Annex has a distinct eight-bar theme with a sparse one-time entry and percussion-free clear', () => {
  assert.equal(MUSIC_PROFILES.annex.bpm, 112);
  const entry = Array.from({ length: 16 }, (_, i) =>
    musicNotes('annex', i, 1, true, false, 1),
  ).flat();
  assert(entry.some((n) => n.part === 'hum'));
  assert(entry.some((n) => n.part === 'pulse'));
  assert(!entry.some((n) => drums.has(n.part) || n.part === 'lead'));
  const calm = phrase(1, true, true, 1).flat();
  assert(calm.some((n) => n.part === 'hum'));
  assert(!calm.some((n) => drums.has(n.part) || n.part === 'lead'));
  const quiet = phrase(0).flat(),
    combat = phrase().flat();
  assert(!quiet.some((n) => drums.has(n.part)));
  assert(combat.some((n) => drums.has(n.part)));
  assert(combat.filter((n) => n.part === 'pluck').length >= 16);
  assert.notDeepEqual(phrase().slice(0, 64), phrase().slice(64));
  assert.notDeepEqual(musicNotes('cooling', 128, 1, false, false), phrase()[0]);
  const firstBoss = phrase(0, true).flat(),
    secondBoss = phrase(0, true, false, 1).flat();
  assert(firstBoss.some((n) => n.part === 'lead'));
  assert(
    secondBoss.filter((n) => n.part === 'lead').length >
      firstBoss.filter((n) => n.part === 'lead').length,
  );
});

test('Annex notes stay finite and bounded, repeat after entry, and do not use randomness', () => {
  const random = Math.random;
  Math.random = () => {
    throw Error('Music used gameplay randomness');
  };
  try {
    for (const intensity of [-10, 0, 0.5, 1, NaN, Infinity])
      for (const boss of [false, true])
        for (const clear of [false, true])
          for (const phase of [0, 1])
            for (let step = 128; step < 256; step++) {
              const notes = musicNotes('annex', step, intensity, boss, clear, phase);
              assert.deepEqual(
                musicNotes('annex', step + 128, intensity, boss, clear, phase),
                notes,
              );
              assert(notes.length <= 7);
              for (const n of notes) {
                assert(n.velocity > 0 && n.velocity <= 0.5 && Number.isFinite(n.velocity));
                assert(n.duration > 0 && n.duration <= 4);
                if (n.midi !== undefined)
                  assert(Number.isInteger(n.midi) && n.midi >= 24 && n.midi <= 90);
              }
            }
    assert.deepEqual(musicNotes('annex', NaN, 1, false, false), []);
  } finally {
    Math.random = random;
  }
});

test('actual room identity selects Annex music in presets, campaign, Continue and boss Practice', () => {
  const g = new Game();
  for (const room of ['broadcast', 'well', 'gallery'])
    for (const layout of ['original', 'alternate']) {
      g.startTest(
        annexRouteTestFromUrl(
          new URL(`https://test/?test=annex-route&room=${room}&layout=${layout}`),
        )!,
      );
      assert.equal(musicScene(g).theme, 'annex');
      assert.equal(
        musicScene(g).area,
        'cooling',
        'Music must not change the campaign difficulty band',
      );
    }
  g.startTest(annexTestFromUrl(new URL('https://test/?test=annex'))!);
  assert.equal(musicScene(g).theme, 'annex');
  g.start('audio-campaign', {
    version: 6,
    seed: 'audio-campaign',
    stage: 8,
    hp: 100,
    elapsed: 20,
    kills: 10,
    mods: [],
    region: 'annex',
    annexVersion: 4,
  });
  assert.equal(musicScene(g).theme, 'annex');
  let checkpoint: Parameters<Game['start']>[1];
  g.onCheckpoint = (s) => {
    checkpoint = s;
  };
  g.save();
  const resumed = new Game();
  resumed.start('audio-campaign', checkpoint);
  assert.equal(musicScene(resumed).theme, 'annex');
  g.startTest(switchboardTestFromUrl(new URL('https://test/?test=switchboard'))!);
  const boss = g.enemies[0];
  assert.equal(musicScene(g).boss, true);
  assert.equal(musicScene(g).bossPhase, 0);
  boss.phase = 1;
  assert.equal(musicScene(g).bossPhase, 1);
  boss.hp = 0;
  g.clear = true;
  assert.equal(musicScene(g).clear, true);
  assert.equal(musicScene(g).theme, 'annex');
  g.startPractice({ kind: 'switchboard', stage: 11 });
  assert.equal(musicScene(g).theme, 'annex');
  g.start('audio-outside');
  for (const stage of [8, 12, 16]) {
    g.stage = stage;
    g.region = 'cooling';
    g.loadRoom();
    assert.equal(musicScene(g).theme, g.level.area);
  }
});

test('a hostile charging port raises pressure but an allied port and clear rooms do not', () => {
  const g = new Game();
  g.startTest(annexTestFromUrl(new URL('https://test/?test=annex'))!);
  Body.setPosition(g.player, { x: 30, y: 200 });
  const owner = g.enemies.find((e) => e.kind === 'switchman')!;
  g.enemies = [owner];
  owner.spawn = 0;
  g.annex.readyAt = 0;
  const before = musicScene(g).intensity;
  g.annex.update();
  assert.equal(g.annex.transmission?.phase, 'charging');
  assert(musicScene(g).intensity >= 0.52 && musicScene(g).intensity > before);
  owner.allied = true;
  assert.equal(musicScene(g).intensity, before);
  g.clear = true;
  assert.equal(musicScene(g).intensity, 0);
});

test('real transmission charge, cancellation and reboot emit their own cues exactly once', () => {
  const g = new Game();
  g.startTest(annexTestFromUrl(new URL('https://test/?test=annex'))!);
  const cues: string[] = [];
  g.onSound = (s) => cues.push(s);
  g.enemies.forEach((e) => (e.spawn = 0));
  g.annex.readyAt = 0;
  g.annex.update();
  g.annex.update();
  assert.deepEqual(cues, ['signal-charge']);
  assert(g.annex.interrupt());
  assert(!g.annex.interrupt());
  assert.equal(cues.filter((s) => s === 'signal-cut').length, 1);
  const e = g.enemies.find((e) => e.kind !== 'switchman')!;
  g.spoof.pending.push({ kind: e.kind, pos: { ...e.body.position } });
  g.spoof.update();
  assert(cues.includes('signal-reboot'));
  assert(!cues.includes('upgrade'));
});

test('Caller recording and three-mark lock have separate cues; allied calls never warn the player', () => {
  for (const allied of [false, true]) {
    const g = fixture([]),
      cues: string[] = [];
    g.onSound = (s) => cues.push(s);
    g.spawnEnemy('runner', 750, 300)!.spawn = 0;
    const e = allied
      ? g.factions.spawn('caller', { x: 550, y: 300 })!
      : g.spawnEnemy('caller', 550, 300)!;
    e.spawn = e.timer = 0;
    for (let i = 0; i < 50; i++) {
      g.time += 1 / 60;
      updateCaller(g, e, 1 / 60);
    }
    assert.equal(e.caller?.phase, 'locked');
    assert.deepEqual(
      cues,
      allied ? ['signal-friendly', 'signal-friendly'] : ['caller-record', 'caller-lock'],
    );
  }
});

test('Switchboard announces charge and lock, then confirms an interrupt once', () => {
  const g = new Game(),
    cues: string[] = [];
  g.startTest(switchboardTestFromUrl(new URL('https://test/?test=switchboard'))!);
  g.onSound = (s) => cues.push(s);
  const e = g.enemies[0];
  e.spawn = 0;
  g.switchboard.begin(e);
  for (let i = 0; i < 40; i++) {
    g.time += 1 / 60;
    g.switchboard.update(e, 1 / 60);
  }
  assert.deepEqual(cues, ['signal-charge', 'signal-lock']);
  assert(g.switchboard.interrupt(e.switchboard!.plans[0].slot));
  assert(!g.switchboard.interrupt(e.switchboard!.plans[0].slot));
  assert.equal(cues.filter((s) => s === 'signal-cut').length, 1);
});
