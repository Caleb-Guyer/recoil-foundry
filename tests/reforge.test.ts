import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import {
  planReforge,
  legalSwaps,
  reforgeOffers,
  reforgeTestFromUrl,
  REFORGE_STAGES,
} from '../src/reforge-rules.ts';
import {
  validBuild,
  validSavedBuild,
  buildPath,
  loadCheckpoint,
  getGun,
  type Checkpoint,
} from '../src/rules.ts';
import { BRANCH_PARENTS, isBranch } from '../src/upgrade-branches.ts';
import { maxCombos, withParents } from '../src/branch-builds.ts';
import { dailyForDate } from '../src/daily.ts';
import { practiceCheckpoint } from '../src/practice.ts';

const { Body, Query } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1900, y: 710 },
};
function step(g: Game, n = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, { ...idle, ...input });
}
function preset(q = '') {
  return reforgeTestFromUrl(new URL('https://test/?test=reforge' + q))!;
}
function fixture(q = '') {
  const g = new Game();
  g.startTest(preset(q));
  return g;
}
function nextBuild(mods: string[], swap: { from: string; to: string }) {
  return [...mods.filter((id) => id !== swap.from), swap.to];
}

test('Reforge plans are rare, seeded, and restricted to one of the first three boss rooms', () => {
  let count = 0;
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const seed = 'reforge-plan-' + i,
      plan = planReforge(seed);
    assert.deepEqual(plan, planReforge(seed));
    if (plan) {
      count++;
      seen.add(plan.stage);
      assert(REFORGE_STAGES.includes(plan.stage));
      assert(!plan.used);
    }
  }
  assert(count > 120 && count < 225, String(count));
  assert.equal(seen.size, 3);
});

test('fresh plans persist; old campaigns and unrelated test, Practice, Workshop and Overtime modes remain unchanged', () => {
  let saved: Checkpoint | null = null,
    g = new Game();
  for (let i = 0; i < 40; i++) {
    g = new Game();
    g.onCheckpoint = (s) => {
      saved = s;
    };
    g.start('reforge-save-' + i);
    if (g.reforge.state) break;
  }
  assert(saved && loadCheckpoint(saved) && g.reforge.state);
  const h = new Game();
  h.start(g.seed, saved!);
  assert.deepEqual(h.reforge.state, g.reforge.state);
  const old = preset();
  delete old.reforge;
  delete old.reforgeRoom;
  h.start(old.seed, old);
  assert(!h.reforge.state && !h.reforge.site);
  const practice = practiceCheckpoint({ kind: 'press', seed: 'PRACTICE' });
  h.start(
    practice.seed,
    { ...practice, reforge: { stage: 7, used: false } },
    { kind: 'press', seed: 'PRACTICE' },
  );
  h.clear = true;
  h.reforge.arrive();
  assert(!h.reforge.site);
  h.start('WORKSHOP', preset(), null, null, true);
  assert(!h.reforge.site);
  h.startTest({ ...preset(), overtime: { baseMods: 7, repairs: 0 } });
  assert(!h.reforge.site);
});

test('a real boss kill reveals the station only after the room clears, without healing or altering the normal reward', () => {
  const g = fixture('&phase=fight');
  assert(!g.reforge.site && !g.clear);
  assert(!g.reforge.interact());
  const boss = g.enemies.find((e) => e.kind === 'press' || e.kind === 'kiln')!;
  boss.spawn = 0;
  g.hp = 53;
  g.hitEnemy(boss, 999999);
  g.hitStop = 0;
  step(g);
  assert(g.clear && g.reforge.site);
  assert.equal(g.hp, 53);
  assert.equal(g.earnedSalvage, 'cinder');
  assert.equal(g.mode, 'playing');
  assert.equal(g.mods.length, 7);
  g.openReward();
  assert.equal(g.mode, 'upgrade');
  assert(g.offers.some((m) => m.id === 'cinder'));
});

test('every authored boss arrangement has an accessible, supported station with clear player return space', () => {
  for (const stage of REFORGE_STAGES)
    for (let i = 0; i < 20; i++) {
      const p = {
        ...preset('&phase=room'),
        seed: 'REFORGE-LAYOUT-' + i,
        stage,
        reforge: { stage, used: false },
        reforgeRoom: {},
      };
      const g = new Game();
      g.startTest(p);
      assert(g.reforge.site, `${stage}/${i}/${g.level.id}`);
      assert.equal(Query.collides(g.player, g.solidBodies).length, 0, `${stage}/${i}`);
      assert(g.reforge.nearby);
      assert(g.reforge.site.x < 1850);
      assert(
        g.terrain.some(
          (b) =>
            g.player.position.x > b.bounds.min.x &&
            g.player.position.x < b.bounds.max.x &&
            Math.abs(g.player.bounds.max.y - b.bounds.min.y) < 1,
        ),
      );
    }
});

test('interaction requires a cleared nearby station and normal grounded input; leaving and reopening keep identical offers', () => {
  const g = fixture('&phase=room'),
    offers = structuredClone(g.reforge.offers);
  Body.setPosition(g.player, { x: 140, y: 720 });
  step(g, 60);
  assert(!g.reforge.interact());
  const s = g.reforge.site!;
  Body.setPosition(g.player, { x: s.x - 52, y: s.floor - 18 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  step(g, 2);
  step(g, 1, { jump: true });
  assert.equal(g.mode, 'reforge');
  const time = g.time;
  step(g, 60, { fire: true, jump: true });
  assert.equal(g.time, time);
  assert.deepEqual(g.reforge.offers, offers);
  g.reforge.close();
  assert.equal(g.mode, 'playing');
  step(g, 1, { jump: true });
  assert.equal(g.mode, 'reforge');
  assert.deepEqual(g.reforge.offers, offers);
});

test('all swaps preserve path, full dependencies, legal ordering, and compatibility for every maximal build', () => {
  for (const combo of maxCombos()) {
    const swaps = reforgeOffers(combo.mods, 'reforge-max-' + combo.code, 11);
    assert(swaps.length > 0 && swaps.length <= 3, combo.code);
    assert.equal(new Set(swaps.map((s) => s.to)).size, swaps.length);
    for (const swap of swaps) {
      const next = nextBuild(combo.mods, swap);
      assert(validBuild(next), `${combo.code}/${swap.from}/${swap.to}`);
      assert.equal(next.length, combo.mods.length);
      assert.equal(buildPath(next), buildPath(combo.mods));
      for (const id of next)
        for (const parent of BRANCH_PARENTS[id] ?? []) assert(next.includes(parent));
    }
  }
});

test('parent upgrades and the last path lock are protected, while legal beam and portal branch replacements are allowed', () => {
  for (const build of [
    withParents([], ['resonator'])!,
    withParents([], ['flywheel'])!,
    withParents([], ['rewire', 'slingshot'])!,
  ]) {
    for (const s of legalSwaps(build, 11)) assert(validBuild(nextBuild(build, s)));
  }
  const portal = withParents([], ['rewire', 'slingshot'])!;
  assert(!legalSwaps(portal, 11).some((s) => s.from === 'fold'));
  assert(legalSwaps(portal, 11).some((s) => s.from === 'rewire' && s.to === 'relay-gate'));
  const beam = withParents([], ['pulse-chamber'])!;
  const swaps = legalSwaps(beam, 11);
  assert(!swaps.some((s) => s.from === 'cutting-torch' || s.from === 'burst'));
  assert(swaps.some((s) => s.from === 'pulse-chamber' && s.to === 'charge-lens'));
  assert(!legalSwaps(['deadeye'], 3).some((s) => buildPath([s.to]) !== 'precision'));
  assert(!legalSwaps(['magnum', 'burst', 'cutting-torch'], 3).some((s) => isBranch(s.to)));
});

test('one swap changes exactly one upgrade, resets old weapon effects, and cannot be duplicated or followed by a reroll', () => {
  const g = fixture(),
    before = [...g.mods],
    swap = { ...g.reforge.offers[0] };
  const hp = g.hp,
    kills = g.kills,
    stage = g.stage,
    body = g.player,
    terrain = [...g.terrain];
  g.burstRemaining = 3;
  g.fireBuffer = 1;
  g.landingReady = true;
  g.addShot({
    pos: { x: 900, y: 200 },
    vel: { x: 4, y: 0 },
    damage: 99,
    life: 5,
    friendly: true,
    radius: 2,
    pierce: 0,
    bounces: 0,
    fragment: false,
    split: false,
  });
  assert(g.reforge.choose(0));
  assert.equal(g.mode, 'playing');
  assert(g.reforge.state?.used);
  assert.deepEqual(g.mods, nextBuild(before, swap));
  assert.deepEqual(g.gun, getGun(g.mods));
  assert.equal(g.hp, hp);
  assert.equal(g.kills, kills);
  assert.equal(g.stage, stage);
  assert.equal(g.player, body);
  assert.deepEqual(g.terrain, terrain);
  assert.equal(g.shots.length, 0);
  assert.equal(g.burstRemaining, 0);
  assert(!g.landingReady);
  assert(!g.reforge.choose(0));
  assert(!g.reforge.interact());
  assert(!g.rerollReward());
  g.openReward();
  assert(g.offers.some((m) => m.id === 'cinder'));
  g.chooseMod(g.offers[0].id);
  assert.equal(g.stage, stage + 1);
  assert.equal(g.hp, hp + 12);
  assert.equal(g.mods.length, before.length + 1);
  assert(!g.reforge.site);
});

test('swaps preserve placed portals and their spent budget unless Fold itself is removed', () => {
  for (const removeFold of [false, true]) {
    const p = preset('&build=portal');
    let index = -1;
    for (let i = 0; i < 100 && index < 0; i++) {
      p.seed = 'reforge-portal-' + i;
      index = reforgeOffers(p.mods, p.seed, p.stage).findIndex(
        (s) => (s.from === 'fold') === removeFold,
      );
    }
    assert(index >= 0);
    const g = new Game();
    g.startTest(p);
    g.reforge.close();
    assert(g.portals.place({ x: 0, y: 300 }));
    assert(g.portals.place({ x: 2000, y: 300 }));
    const pair = [...g.portals.pair];
    assert(g.portals.linked && !g.portals.canPlace);
    g.time = 1;
    assert(g.reforge.interact());
    assert(g.reforge.choose(index));
    if (removeFold) {
      assert(!g.portals.equipped && !g.portals.linked);
      assert.deepEqual(g.portals.pair, [null, null]);
    } else {
      assert.deepEqual(g.portals.pair, pair);
      assert.equal(g.portals.next, 2);
      assert(!g.portals.canPlace);
    }
  }
});

test('save and Continue preserve open, skipped and spent stations without respawning the boss or duplicating a swap', () => {
  const p = preset();
  let saved: Checkpoint | null = null;
  const g = new Game();
  g.onCheckpoint = (s) => {
    saved = s;
  };
  g.start(p.seed, p);
  assert(saved && loadCheckpoint(saved));
  const offers = structuredClone(g.reforge.offers);
  const h = new Game();
  h.onCheckpoint = (s) => {
    saved = s;
  };
  h.start(p.seed, saved!);
  assert.equal(h.mode, 'reforge');
  assert(h.clear && !h.enemies.length);
  assert.deepEqual(h.reforge.offers, offers);
  h.reforge.close();
  assert(saved && loadCheckpoint(saved) && saved.reforgeRoom && !saved.reforgeRoom.open);
  g.start(p.seed, saved!);
  assert.equal(g.mode, 'playing');
  assert(g.clear && !g.enemies.length);
  g.time = 1;
  assert(g.reforge.interact());
  assert(g.reforge.choose(0));
  assert(saved && loadCheckpoint(saved));
  const mods = [...g.mods];
  h.start(p.seed, saved!);
  assert(h.reforge.state?.used && !h.enemies.length);
  assert.deepEqual(h.mods, mods);
  assert(!h.reforge.interact());
  h.openReward();
  assert(saved && loadCheckpoint(saved));
  g.start(p.seed, saved!);
  assert.equal(g.mode, 'upgrade');
  assert.deepEqual(g.mods, mods);
  assert(g.offers.some((m) => m.id === 'cinder'));
});

test('Daily gets one fixed legal swap that survives closing, reload and retry', () => {
  const p = preset('&daily=1'),
    g = fixture('&daily=1');
  assert.equal(g.reforge.offers.length, 1);
  const choice = structuredClone(g.reforge.offers);
  g.reforge.close();
  g.time = 1;
  assert(g.reforge.interact());
  assert.deepEqual(g.reforge.offers, choice);
  g.startTest(p);
  assert.deepEqual(g.reforge.offers, choice);
  assert(g.reforge.choose(0));
  assert(validBuild(g.mods));
  g.openReward();
  assert.equal(g.offers.length, 1);
  assert(!g.canReroll);
  const a = new Game(),
    b = new Game(),
    daily = dailyForDate('2026-09-19')!;
  a.start(daily.seed);
  b.start(daily.seed);
  assert.deepEqual(a.reforge.state, b.reforge.state);
});

test('leaving without a swap forfeits the station; later rooms and New Game+ cannot mint another use', () => {
  const g = fixture('&phase=room');
  g.openReward();
  g.chooseMod(g.offers[0].id);
  assert.equal(g.stage, 8);
  assert(!g.reforge.site);
  assert(!g.reforge.state?.used);
  g.stage = 11;
  g.loadRoom(false, true);
  assert(!g.reforge.site);
  g.stage = 7;
  g.overtime = { baseMods: 19, repairs: 0 };
  g.loadRoom(false, true);
  assert(!g.reforge.site);
});

test('stale, forged, duplicate and invalid choices never mutate the build or spend the station', () => {
  const g = fixture(),
    mods = [...g.mods];
  for (const index of [-1, 0.5, 3, NaN, Infinity]) assert(!g.reforge.choose(index));
  g.reforge.offers[0] = { from: 'magnum', to: 'resonator' };
  assert(!g.reforge.choose(0));
  assert.deepEqual(g.mods, mods);
  assert(!g.reforge.state?.used);
  assert(!legalSwaps(['fold', 'rewire', 'rewire'], 11).length);
  const legacy = ['deadeye', 'capacitor', 'vector', 'rail-spike'];
  assert(validSavedBuild(legacy, legacy));
  for (const s of legalSwaps([...legacy, 'magnum'], 11, legacy)) {
    assert(!legacy.includes(s.from));
    assert(validSavedBuild(nextBuild([...legacy, 'magnum'], s), legacy));
  }
});

test('strict test links and save validation reject ambiguous modes and impossible station states', () => {
  for (const q of ['', '&build=beam', '&build=portal', '&daily=1', '&phase=room', '&phase=fight'])
    assert(loadCheckpoint(preset(q)), q);
  for (const q of [
    '&test=reforge',
    '&daily=0',
    '&daily=1&daily=1',
    '&phase=no',
    '&build=no',
    '&build=beam&build=portal',
    '&stage=7',
  ])
    assert.equal(preset(q), null, q);
  const p = preset();
  for (const patch of [
    { reforge: null },
    { reforge: { stage: 19, used: false } },
    { reforge: { stage: 7, used: 1 } },
    { reforge: undefined },
    { reforgeRoom: null },
    { reforgeRoom: { open: false } },
    { reforgeRoom: { salvage: 'crosswind' } },
    { stage: 8 },
    { detour: true },
    { reforge: { stage: 7, used: true } },
  ])
    assert.equal(loadCheckpoint({ ...p, ...patch }), null, JSON.stringify(patch));
});

test('focused tests never write saves, boss victories or campaign discoveries, and restart restores the station', () => {
  const g = new Game();
  let saves = 0,
    bosses = 0;
  g.onCheckpoint = () => saves++;
  g.onBossDefeated = () => bosses++;
  g.startTest(preset());
  assert(g.reforge.choose(0));
  g.save();
  g.startTest(preset());
  assert(!g.reforge.state?.used);
  assert.equal(g.reforge.offers.length, 3);
  g.die();
  assert.equal(saves, 0);
  assert.equal(bosses, 0);
});
