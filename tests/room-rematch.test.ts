import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import {
  RoomRematch,
  rematchEntry,
  roomRematchSnapshot,
  rematchPreviewFromUrl,
} from '../src/room-rematch.ts';
import { replayGuidance } from '../src/replay-guidance.ts';
import { remasterTestFromUrl } from '../src/room-remaster.ts';
import { eventTestFromUrl } from '../src/area-events.ts';
import { huntTestFromUrl } from '../src/hunt-test.ts';
import { overtimeTestFromUrl, practiceCheckpoint, testCheckpoint } from '../src/practice.ts';
import { bossRemixTestFromUrl } from '../src/boss-remix-test.ts';
import { planFactory } from '../src/factory.ts';
import { dailyForDate } from '../src/daily.ts';
import { getGun, validBuild, type Checkpoint } from '../src/rules.ts';
import { playRoom } from './room-pilot.ts';

const idle = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 500 },
};
function clean(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function snapshot(g: Game) {
  const entry = rematchEntry(g);
  assert(entry);
  g.die({ type: 'shot', enemy: 'shooter' });
  const result = roomRematchSnapshot(g, entry);
  assert(result);
  return result;
}
const preview = (scene: string) =>
  rematchPreviewFromUrl(new URL('https://test/?test=rematch&scene=' + scene + '&v=1'))!;

test('three strict preview links die to real attacks and offer full-health copies with the same legal guns', () => {
  for (const scene of ['patrol', 'mortar', 'boss']) {
    const save = preview(scene).checkpoint;
    assert(validBuild(save.mods));
    const g = new Game();
    g.startTest(save);
    const entry = rematchEntry(g)!;
    assert(entry);
    for (let frame = 0; frame < 60 * 45 && g.mode === 'playing'; frame++) g.tick(1 / 60, idle);
    assert.equal(g.mode, 'dead', scene + ': ordinary idle combat should reach a real death');
    assert.notEqual(g.deathCause?.type, 'unknown');
    if (scene === 'mortar') assert.deepEqual(g.deathCause, { type: 'blast', enemy: 'mortar' });
    if (scene === 'boss') assert.equal(g.deathCause?.enemy, 'loader');
    const copied = roomRematchSnapshot(g, entry)!;
    assert(copied);
    const rematch = new RoomRematch(copied);
    assert.equal(rematch.game.hp, 100);
    assert.equal(rematch.game.mode, 'paused');
    assert.equal(rematch.game.startingGun, g.startingGun);
    assert.deepEqual(rematch.game.mods, g.mods);
    assert.deepEqual(rematch.game.level, entry.level);
    assert.equal(rematch.game.commendations.eligible, false);
    rematch.dispose();
    clean(g);
  }
  for (const extra of [
    '&v=2',
    '&scene=patrol',
    '&gun=shotgun',
    '&seed=custom',
    '&test=rooms',
    '&anything=1',
  ])
    assert.equal(
      rematchPreviewFromUrl(new URL('https://test/?test=rematch&scene=boss&v=1' + extra)),
      null,
      extra,
    );
  assert.equal(preview('unknown'), null);
  assert.equal(rematchPreviewFromUrl(new URL('https://test/?test=rematch')), null);
});

test('room entry survives destroyed props and defeated enemies; retries keep the finished gun, outfit and authored mirror', () => {
  const g = new Game();
  g.startTest(
    remasterTestFromUrl(
      new URL('https://test/?test=rooms&room=scrap-bridge&build=blast&gun=shotgun&mirror=1&v=1'),
    )!,
  );
  const entry = rematchEntry(g)!;
  const original = structuredClone(entry.level);
  const props = g.props.items.map((p) => ({
    kind: p.kind,
    hp: p.hp,
    position: { ...p.body.position },
  }));
  const enemies = g.enemies.map((e) => ({
    kind: e.kind,
    hp: e.hp,
    position: { ...e.body.position },
  }));
  assert(props.length);
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const e of [...g.enemies]) {
    e.spawn = 0;
    g.hitEnemy(e, 99999);
  }
  g.mods = ['magnum', 'scatter', 'cutting-torch'];
  g.gun = getGun(g.mods, g.startingGun);
  assert(validBuild(g.mods));
  g.die({ type: 'fall' });
  const saved = roomRematchSnapshot(g, entry)!;
  assert(saved);
  assert.deepEqual(entry.level, original);
  assert.deepEqual(
    saved.checkpoint.mods,
    g.mods,
    'use the final build, not the old room-entry gun',
  );
  const rematch = new RoomRematch(saved),
    r = rematch.game;
  for (let attempt = 0; attempt < 4; attempt++) {
    assert.equal(r.mode, 'paused');
    assert.equal(r.hp, 100);
    assert.equal(r.elapsed, 0);
    assert.deepEqual(r.cosmetics, g.cosmetics);
    assert.deepEqual(r.gun, g.gun);
    assert.deepEqual(r.level, original);
    assert.deepEqual(
      r.props.items.map((p) => ({ kind: p.kind, hp: p.hp, position: { ...p.body.position } })),
      props,
    );
    assert.deepEqual(
      r.enemies.map((e) => ({ kind: e.kind, hp: e.hp, position: { ...e.body.position } })),
      enemies,
    );
    const time = r.time;
    rematch.tick(1, { ...idle, fire: true });
    assert.equal(r.time, time, 'paused input cannot simulate');
    r.setMode('playing');
    r.damagePlayer(10, undefined, { type: 'shot' });
    assert.equal(r.hp, 90);
    r.mods.push('rapid');
    rematch.reset();
    assert.deepEqual(r.mods, saved.checkpoint.mods);
  }
  assert.deepEqual(saved.level, original);
  rematch.dispose();
  rematch.dispose();
  assert.equal(Matter.Composite.allBodies(r.engine.world).length, 0);
  clean(g);
});

test('ordinary combat can clear a copied room, stops there and leaves the original result and checkpoint unchanged', () => {
  const campaign = new Game();
  campaign.start('RF-C92-REMATCH-ISOLATION', {
    ...testCheckpoint('RF-C92-REMATCH-ISOLATION', 0),
    hp: 72,
  });
  const entry = rematchEntry(campaign)!;
  campaign.die({ type: 'contact', enemy: 'runner' });
  const before = {
    checkpoint: campaign.checkpointSnapshot(),
    position: { ...campaign.player.position },
    results: campaign.combatReport.snapshot(),
    cause: campaign.deathCause,
  };
  const bodies = Matter.Composite.allBodies(campaign.engine.world);
  const rematch = new RoomRematch(roomRematchSnapshot(campaign, entry)!);
  let saves = 0,
    awards = 0;
  rematch.game.onCheckpoint = () => saves++;
  rematch.game.onCampaignClear = () => awards++;
  rematch.game.onCommendation = () => awards++;
  rematch.game.setMode('playing');
  playRoom(rematch.game, 90);
  assert.equal(rematch.game.mode, 'won');
  assert.equal(rematch.game.stage, 0);
  rematch.game.openReward();
  rematch.game.startEscape();
  rematch.game.save();
  assert.equal(rematch.game.mode, 'won');
  assert.equal(saves, 0);
  assert.equal(awards, 0);
  assert.equal(campaign.mode, 'dead');
  assert.deepEqual(
    {
      checkpoint: campaign.checkpointSnapshot(),
      position: { ...campaign.player.position },
      results: campaign.combatReport.snapshot(),
      cause: campaign.deathCause,
    },
    before,
  );
  assert.deepEqual(Matter.Composite.allBodies(campaign.engine.world), bodies);
  assert.notEqual(rematch.game.engine, campaign.engine);
  rematch.dispose();
  clean(campaign);
});

test('copies retain Daily, Factory blackout, hunt, final boss and Overtime room contexts without advancing or saving', () => {
  const daily = dailyForDate('2026-10-21');
  const factorySeed = Array.from({ length: 100 }, (_, i) => 'factory-test-' + i).find(
    (seed) => planFactory(seed).condition === 'power',
  )!;
  assert(factorySeed);
  const contexts: Checkpoint[] = [
    { ...testCheckpoint(daily.seed, 0), seed: daily.seed },
    { ...testCheckpoint(factorySeed, 1), factory: planFactory(factorySeed) },
    eventTestFromUrl(new URL('https://test/?test=events&event=blackout'))!,
    huntTestFromUrl(new URL('https://test/?test=hunt&hunt=bulwark&v=1'))!,
    practiceCheckpoint({ kind: 'boss', seed: 'reclaimer-fight-0' })!,
    overtimeTestFromUrl(new URL('https://test/?test=overtime&area=docks'))!,
    bossRemixTestFromUrl(new URL('https://test/?test=boss-remix&boss=loader&variant=1&v=1'))!,
  ];
  for (const save of contexts) {
    assert(save);
    const g = new Game();
    if (save.factory) g.start(save.seed, save);
    else g.startTest(save);
    const entry = rematchEntry(g)!;
    assert(entry, save.seed);
    const level = structuredClone(g.level);
    const hadBlackout = g.areaEvents.dark;
    const rematch = new RoomRematch(snapshot(g)),
      r = rematch.game;
    assert.deepEqual(r.level, level, save.seed + ': geometry, props and spawns');
    assert.equal(r.areaEvents.dark, hadBlackout, save.seed + ': event');
    assert.deepEqual(r.factory, entry.checkpoint.factory ?? null);
    assert.deepEqual(r.overtime, g.overtime);
    if (level.hunt) assert.equal(r.hunts.kind, level.hunt);
    let saves = 0,
      awards = 0;
    r.onCheckpoint = () => saves++;
    r.onCampaignClear = () => awards++;
    r.onCommendation = () => awards++;
    r.setMode('playing');
    // End-condition check independent of patrol navigation: all real targets
    // and queued waves are resolved, then the ordinary clear gate runs.
    for (const e of [...r.enemies]) {
      e.spawn = 0;
      r.hitEnemy(e, 99999);
    }
    r.waves.clear();
    r.areaEvents.clear();
    r.hitStop = 0;
    for (let f = 0; f < 120 && r.mode === 'playing'; f++) r.tick(1 / 60, idle);
    assert.equal(r.mode, 'won', save.seed);
    assert.equal(r.stage, save.stage);
    assert.equal(!!r.escape, false);
    r.save();
    assert.equal(saves, 0);
    assert.equal(awards, 0);
    rematch.dispose();
    clean(g);
  }
});

test('an earned hunt approach keeps its gate and can start and finish the real boss in isolation', () => {
  const seed = 'RF-C92-REMATCH-HUNT';
  const g = new Game();
  g.start(seed, {
    ...testCheckpoint(seed, 4),
    encounters: 1,
    detour: true,
    huntRules: 1,
    hunt: { kind: 'bulwark', stage: 4, phase: 'approach' },
  });
  assert(g.hunts.approaching);
  const rematch = new RoomRematch(snapshot(g)),
    r = rematch.game;
  assert(r.hunts.enabled);
  assert(r.hunts.approaching);
  r.setMode('playing');
  Matter.Body.setPosition(r.player, { x: 600, y: 722 });
  r.tick(1 / 60, idle);
  assert.equal(r.hunts.state?.phase, 'fight');
  assert(r.hunts.gate);
  const boss = r.enemies.find((e) => e.kind === 'bulwark')!;
  assert(boss);
  boss.spawn = 0;
  r.hitEnemy(boss, 99999);
  r.hitStop = 0;
  r.tick(1 / 60, idle);
  assert.equal(r.mode, 'won');
  assert.equal(g.hunts.state?.phase, 'approach');
  rematch.reset();
  assert(r.hunts.approaching);
  assert.equal(r.enemies.length, 0);
  rematch.dispose();
  clean(g);
});

test('normal starts discard copied-room flags, while existing Practice and non-combat contexts keep their own retries', () => {
  const g = new Game();
  g.startTest(preview('patrol').checkpoint);
  const rematch = new RoomRematch(snapshot(g));
  rematch.game.start('RF-C92-ORDINARY-AFTER-REMATCH');
  assert.equal(rematch.game.testRun, null);
  assert.notEqual(rematch.game.seed, g.seed);
  rematch.dispose();
  g.start('LOADER-SHIFT-5', undefined, { kind: 'loader', seed: 'LOADER-SHIFT-5' });
  assert.equal(rematchEntry(g), null);
  g.startWorkshop([], []);
  assert.equal(rematchEntry(g), null);
  g.startTest(preview('patrol').checkpoint);
  const entry = rematchEntry(g)!;
  assert.equal(roomRematchSnapshot(g, entry), null, 'available only after death');
  g.loadRoom();
  g.die();
  assert.equal(roomRematchSnapshot(g, entry), null, 'never use a stale room');
  clean(g);
});

test('one concise replay tip follows the recorded lethal category, without inventing an attacker or missed dodge', () => {
  const mortar = replayGuidance({ type: 'blast', enemy: 'mortar' });
  assert.match(mortar.label, /Mortar Cart/);
  assert.match(mortar.tip, /shoot down the shell/);
  assert.match(replayGuidance({ type: 'shot', enemy: 'sniper' }).tip, /aiming line/);
  const fall = replayGuidance({ type: 'fall' });
  assert.equal(fall.label, 'Fall');
  assert.match(fall.tip, /lift/);
  assert.doesNotMatch(fall.tip, /enemy|sniper|mortar|you failed|you missed/i);
  assert.equal(replayGuidance(null).label, 'Cause unavailable');
  assert.doesNotMatch(replayGuidance(null).tip, /sniper|mortar|you failed|you missed/i);
  for (const type of [
    'shot',
    'blade',
    'contact',
    'blast',
    'volatile',
    'heat',
    'weld',
    'hook',
    'saw',
    'slam',
    'induction',
    'cargo',
    'crate',
    'fuel',
    'crusher',
    'train',
    'coolant',
    'steam',
    'lightning',
    'fall',
    'unknown',
  ] as const) {
    const tip = replayGuidance({ type }).tip;
    assert(tip.length > 20 && tip.length < 170, type);
  }
});
