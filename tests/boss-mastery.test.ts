import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Shot } from '../src/game.ts';
import { testCheckpoint } from '../src/practice.ts';
import { getLevel } from '../src/levels.ts';
import { updateLoader } from '../src/area-boss-ai.ts';
import { updateCrane } from '../src/crane-ai.ts';
import {
  COMMENDATIONS_KEY,
  commendationVisible,
  type CommendationId,
} from '../src/commendations.ts';
import { COSMETICS_KEY, loadCosmetics } from '../src/cosmetics.ts';
import { logbookEntries, loadLogbook } from '../src/logbook.ts';
import { logbookArticle } from '../src/logbook-menu.ts';
import { ProgressStore, parseProgressBackup } from '../src/progress.ts';
import { getGun } from '../src/rules.ts';

const { Body, Composite } = Matter;
function room(kind: 'loader' | 'crane', mirror = false) {
  const seed = Array.from({ length: 100 }, (_, i) => 'mastery-' + i).find((s) => {
    const l = getLevel(s, 3);
    return l.spawns[0].kind === kind && !!l.mirrored === mirror;
  })!;
  assert(seed);
  const g = new Game();
  g.start(seed, testCheckpoint(seed, 3));
  g.commendations.cleanBoss = false;
  const e = g.enemies[0];
  e.spawn = 0;
  const awards: CommendationId[] = [];
  g.onCommendation = (id) => awards.push(id);
  return { g, e, awards };
}
function ram(mirror = false) {
  const f = room('loader', mirror),
    { g, e } = f;
  const s = g.loaderArena.supports[0],
    sign = mirror ? -1 : 1;
  Body.setPosition(e.body, {
    x: sign > 0 ? s.barrier.body.bounds.min.x - 48 : s.barrier.body.bounds.max.x + 48,
    y: 705,
  });
  e.aim = { x: sign, y: 0 };
  e.state = 'rush';
  e.timer = 1;
  return { ...f, s };
}
function vault(mirror = false) {
  const f = room('crane', mirror),
    { g, e } = f;
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of [...g.terrain])
    if (b.bounds.min.y < 739 && b.bounds.min.x >= 0 && b.bounds.max.x <= 2000) {
      Composite.remove(g.engine.world, b);
      g.terrain = g.terrain.filter((x) => x !== b);
    }
  const rig = e.crane!,
    sign = mirror ? -1 : 1;
  rig.head = rig.from = { x: 1000 - 200 * sign, y: 700 };
  rig.prev = { ...rig.head };
  rig.to = { x: 1000 + 200 * sign, y: 700 };
  Body.setPosition(rig.body, rig.head);
  Body.setPosition(g.player, { x: 1000, y: 710 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.grounded = false;
  e.attack = 'sweep';
  e.state = 'windup';
  e.timer = 0.4;
  g.commendations.mastery.beginSweep(e);
  const lift = (beam = false) => {
    g.mods = beam ? ['cutting-torch'] : [];
    g.gun = getGun(g.mods);
    g.aim = { x: 1000, y: 900 };
    for (let n = 0; n < (beam ? 10 : 1); n++) g.fireRound();
  };
  const cross = (y = 620, grounded = false) => {
    Body.setPosition(g.player, { x: 1000, y });
    g.grounded = grounded;
    e.state = 'rush';
    e.timer = 2;
    for (let n = 0; n < 40 && e.state === 'rush'; n++) updateCrane(g, e);
    assert.equal(e.state, 'recover');
  };
  const hit = () => g.hitEnemy(e, 1, g.player.position);
  const win = () => g.hitEnemy(e, 100000, g.player.position);
  return { ...f, lift, cross, hit, win };
}

test('Unsafe Load credits an actual ram of standing support and waits for the same Loader victory, both mirrors', () => {
  for (const mirror of [false, true]) {
    const { g, e, s, awards } = ram(mirror);
    updateLoader(g, e);
    assert(!g.destruction.pieces.includes(s.barrier));
    assert.equal(e.state, 'recover');
    assert.deepEqual(awards, []);
    g.hitEnemy(e, 100000);
    g.hitEnemy(e, 100000);
    assert.deepEqual(awards, ['unsafe-load']);
  }
});

test('shots, health-threshold collapses, released loads and ordinary walls cannot qualify Unsafe Load', () => {
  for (const reason of ['shot', 'threshold', 'cut', 'removed', 'ordinary'] as const) {
    const { g, e, s, awards } = ram();
    if (reason === 'shot')
      g.destruction.hitBody(s.barrier.body, 200, e.aim, { friendly: true } as Shot);
    if (reason === 'threshold') {
      e.hp = e.maxHp * 0.6;
      g.loaderArena.update();
    }
    if (reason === 'cut') g.cargo.cut(s.cargo, 10000);
    if (reason === 'removed') g.props.remove(s.cargo);
    if (reason === 'ordinary') g.loaderArena.supports = [];
    updateLoader(g, e);
    g.hitEnemy(e, 100000);
    assert.deepEqual(awards, [], reason);
  }
});

test('Clearance accepts complete recoil vaults in either sweep direction and only the following recovery hit', () => {
  for (const mirror of [false, true]) {
    const { lift, cross, hit, win, awards, e } = vault(mirror);
    lift();
    cross();
    assert(!e.crane!.hit);
    assert.deepEqual(awards, []);
    hit();
    assert.deepEqual(awards, []);
    e.state = 'idle'; // Once earned, the maneuver survives later attacks in this fight.
    win();
    win();
    assert.deepEqual(awards, ['clearance']);
  }
});

test('Clearance supports continuous beam recoil and a killing recovery shot', () => {
  const { lift, cross, win, awards } = vault();
  lift(true);
  cross();
  win();
  assert.deepEqual(awards, ['clearance']);
});

test('ordinary jumps, grounded passage, high perches, head hits and portals do not count as vaults', () => {
  for (const reason of ['jump', 'grounded', 'high', 'hit', 'portal', 'sideways'] as const) {
    const { g, e, lift, cross, win, awards } = vault();
    if (reason === 'high') {
      Body.setPosition(g.player, { x: 1000, y: 300 });
      g.commendations.mastery.beginSweep(e);
    }
    if (reason !== 'jump' && reason !== 'sideways') lift();
    if (reason === 'sideways') {
      g.aim = { x: 1500, y: 710 };
      g.fireRound();
    }
    if (reason === 'portal') g.commendations.mastery.teleported();
    if (reason === 'hit') e.crane!.hit = true;
    cross(reason === 'high' ? 300 : 620, reason === 'grounded');
    win();
    assert.deepEqual(awards, [], reason);
  }
});

test('a graze underneath, partial crossing, missed window or different attack cannot earn Clearance', () => {
  for (const reason of [
    'under',
    'partial',
    'late',
    'next-sweep',
    'slam',
    'uncredited',
    'zero',
    'machinery',
  ] as const) {
    const { g, e, lift, cross, win, awards } = vault();
    lift();
    if (reason === 'partial') e.crane!.to.x = 980;
    cross(reason === 'under' ? 700 : 620);
    if (reason === 'late') e.timer = 0;
    if (reason === 'next-sweep') g.commendations.mastery.beginSweep(e);
    if (reason === 'slam') e.attack = 'slam';
    if (['uncredited', 'zero', 'machinery'].includes(reason)) {
      g.hitEnemy(
        e,
        reason === 'zero' ? 0 : 1,
        reason === 'machinery' ? undefined : g.player.position,
        true,
        true,
        reason !== 'uncredited',
      );
      e.state = 'idle';
    }
    win();
    assert.deepEqual(awards, [], reason);
  }
});

test('landing discards old recoil and a new jump must earn its own lift', () => {
  const { g, e, lift, cross, win, awards } = vault();
  lift();
  g.grounded = true;
  g.commendations.mastery.sampleSweep(e);
  cross();
  win();
  assert.deepEqual(awards, []);
});

test('Practice, isolated tests and Workshop cannot bank mastery evidence', () => {
  for (const mode of ['practice', 'test', 'workshop'] as const) {
    for (const kind of ['loader', 'crane'] as const) {
      const f = kind === 'loader' ? ram() : vault(),
        { g, e, awards } = f;
      if (mode === 'practice') g.practice = { kind, seed: g.seed };
      if (mode === 'test') g.testRun = testCheckpoint(g.seed, 3);
      if (mode === 'workshop') g.workshop.active = true;
      if ('lift' in f) {
        f.lift();
        f.cross();
        f.hit();
      } else updateLoader(g, e);
      g.practice = g.testRun = null;
      g.workshop.active = false;
      g.hitEnemy(e, 100000, g.player.position);
      assert.deepEqual(awards, [], `${mode} ${kind}`);
    }
  }
});

test('death, room restart, cleanup and uncredited victory cannot finish either mastery challenge', () => {
  for (const reason of ['dead', 'reload', 'cleanup', 'uncredited', 'other-boss'] as const) {
    for (const kind of ['loader', 'crane'] as const) {
      const f = kind === 'loader' ? ram() : vault(),
        { g, e, awards } = f;
      if ('lift' in f) {
        f.lift();
        f.cross();
        f.hit();
      } else updateLoader(g, e);
      if (reason === 'dead') {
        g.hp = 0;
        g.setMode('dead');
      }
      if (reason === 'reload') g.loadRoom();
      const target = reason === 'other-boss' ? g.spawnEnemy('loader', 1000, 700) : e;
      target.spawn = 0;
      g.hitEnemy(
        target,
        100000,
        g.player.position,
        true,
        true,
        reason !== 'uncredited',
        reason === 'cleanup' ? 'cleanup' : undefined,
      );
      assert.deepEqual(
        awards.filter((id) => id !== 'clean-work'),
        [],
        `${reason} ${kind}`,
      );
    }
  }
});

test('boss mastery requirements stay out of the Logbook and Appearance until that boss is defeated', () => {
  const entries = (enemies: string[], earned: CommendationId[] = []) =>
    logbookEntries([], loadLogbook({ version: 1, enemies, areas: [], escaped: false }), earned);
  for (const [id, kind] of [
    ['unsafe-load', 'loader'],
    ['clearance', 'crane'],
  ] as const) {
    assert(!entries([]).some((e) => e.id === 'commendation:' + id));
    assert(!commendationVisible(id, [], []));
    const pending = entries([kind]).find((e) => e.id === 'commendation:' + id)!;
    assert(pending && !pending.earned);
    assert(!logbookArticle(pending, () => '').includes(pending.lore[2]));
    assert(commendationVisible(id, [kind], []));
    const earned = entries([], [id]).find((e) => e.id === 'commendation:' + id)!;
    assert(earned.earned);
    assert(logbookArticle(earned, () => '').includes(earned.lore[0]));
  }
});

test('both rewards and incident reports survive progress backup and restore without granting unearned styles', async () => {
  const memory = new Map<string, string>();
  const disk = {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memory.set(k, v);
    },
    removeItem: (k: string) => {
      memory.delete(k);
    },
  };
  const store = new ProgressStore(() => disk),
    styles = { gun: 'caution', outfit: 'operator' } as const;
  assert.deepEqual(loadCosmetics(styles, []), { gun: 'standard', outfit: 'standard' });
  assert.deepEqual(loadCosmetics(styles, ['unsafe-load']), { gun: 'caution', outfit: 'standard' });
  await store.write(COMMENDATIONS_KEY, ['unsafe-load', 'clearance']);
  await store.write(COSMETICS_KEY, styles);
  assert(await store.restore(parseProgressBackup(store.backup('3.15.0'))));
  const loaded = new ProgressStore(() => disk);
  assert.deepEqual(loaded.read(COMMENDATIONS_KEY), ['unsafe-load', 'clearance']);
  assert.deepEqual(loaded.read(COSMETICS_KEY), styles);
});
