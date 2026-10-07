import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import { fixture, target, round, advance, beam } from './branches-fixture.ts';
import { SUPPORT_MASTERIES } from '../src/support-mastery.ts';
import { COMMENDATIONS_KEY, type CommendationId } from '../src/commendations.ts';
import { logbookCatalog } from '../src/logbook-catalog.ts';
import { loadLogbook } from '../src/logbook.ts';
import { logbookArticle } from '../src/logbook-menu.ts';
import { combatReportMenu } from '../src/combat-report-menu.ts';
import { loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import { testCheckpoint } from '../src/practice.ts';
import { presentationTestFromUrl, finishPresentationTest } from '../src/presentation-test.ts';
import { dailyForDate } from '../src/daily.ts';
import { loadCosmetics, COSMETICS_KEY } from '../src/cosmetics.ts';
import { commendationRewards, RUN_REWARDS_KEY, addRunRewards } from '../src/run-rewards.ts';
import { ProgressStore, CHECKPOINT_KEY, parseProgressBackup } from '../src/progress.ts';

test('six completed live heat transfers award once; a heated kill alone does not', () => {
  const g = fixture(['cutting-torch', 'thermal-runaway', 'heat-relay']);
  const awards: CommendationId[] = [];
  g.onCommendation = (id) => {
    if (id === 'relay-race') awards.push(id);
  };
  let current = target(g, 400);
  for (let i = 0; i < 6; i++) {
    beam(g, 0.5);
    current.hp = 0.01;
    beam(g, 1 / 60);
    assert(g.support.relay > 0);
    assert.deepEqual(awards, []);
    current = target(g, 450);
    beam(g, 1 / 60);
    assert.equal(g.combatReport.snapshot().heatTransfers, i + 1);
  }
  assert.deepEqual(awards, ['relay-race']);
  g.combatReport.checkMasteries();
  assert.deepEqual(awards, ['relay-race']);
});

test('eight actual Overkill payments earn Reservoir without counting five pellets separately', () => {
  const g = fixture(['scatter', 'overkill-bank']);
  const awards: CommendationId[] = [];
  g.onCommendation = (id) => {
    if (id === 'stored-energy') awards.push(id);
  };
  for (let i = 0; i < 8; i++) {
    const e = target(g, 440);
    e.hp = e.maxHp = 20;
    round(g, { damage: 100 });
    advance(g, 3);
    g.shots = [];
    assert(g.support.reserve > 0);
    g.fireRound();
    assert.equal(g.shots.length, 5);
    assert.equal(g.combatReport.snapshot().bankCharges, i + 1);
    assert.deepEqual(awards, i === 7 ? ['stored-energy'] : []);
    g.shots = [];
  }
});

test('five plates from broken crates stopping actual hostile bullets earn Patchwork', () => {
  const g = fixture(['scrap-armor']);
  const awards: CommendationId[] = [];
  g.onCommendation = (id) => awards.push(id);
  for (let i = 0; i < 5; i++) {
    const crate = g.props.spawn('crate', 800, 300);
    g.props.hit(crate, 200, { x: 1, y: 0 }, round(g, { damage: 200 }));
    g.shots = [];
    assert(g.support.plate);
    const hp = g.hp;
    g.damagePlayer(14, undefined, { type: 'shot' }, round(g, { friendly: false, damage: 14 }));
    assert.equal(g.hp, hp);
    assert.equal(g.combatReport.snapshot().armorBlocks, i + 1);
    assert.deepEqual(awards, i === 4 ? ['scrap-certified'] : []);
    g.shots = [];
    g.time += 7;
  }
});

test('Campaign and Daily qualify; Practice, Workshop, test previews and inactive modes cannot award', () => {
  for (const seed of ['RF-C88-mastery', dailyForDate('2026-10-06')!.seed]) {
    const g = new Game();
    const awards: CommendationId[] = [];
    g.onCommendation = (id) => awards.push(id);
    g.start(seed);
    for (let i = 0; i < 8; i++) g.combatReport.bankCharge(1);
    assert.deepEqual(awards, ['stored-energy']);
  }
  for (const mode of ['practice', 'workshop', 'test', 'paused', 'dead', 'won'] as const) {
    const g = new Game();
    const awards: CommendationId[] = [];
    g.onCommendation = (id) => awards.push(id);
    if (mode === 'practice') g.startPractice({ kind: 'loader', seed: 'LOADER-SHIFT-5' });
    else if (mode === 'workshop') g.startWorkshop([], []);
    else if (mode === 'test') g.startTest(testCheckpoint('support-test', 5));
    else {
      g.start('RF-C88-mastery');
      g.setMode(mode);
    }
    for (let i = 0; i < 10; i++) {
      g.combatReport.heatTransfer(0.5);
      g.combatReport.bankCharge(1);
      g.combatReport.armorBlock();
    }
    g.combatReport.checkMasteries();
    assert.deepEqual(awards, [], mode);
  }
});

test('Continue carries one-run targets across rooms; fresh attempts cannot add prior progress', () => {
  const g = new Game();
  g.start('RF-C88-mastery-continue');
  for (let i = 0; i < 5; i++) g.combatReport.heatTransfer(0.2);
  g.loadRoom();
  let raw: Checkpoint | undefined;
  g.onCheckpoint = (s) => {
    raw = s;
  };
  g.save();
  const save = loadCheckpoint(raw)!;
  const resumed = new Game();
  const awards: CommendationId[] = [];
  resumed.onCommendation = (id) => awards.push(id);
  resumed.start(save.seed, save);
  assert.deepEqual(awards, []);
  resumed.combatReport.heatTransfer(0.2);
  assert.deepEqual(awards, ['relay-race']);
  const retry = new Game();
  retry.onCommendation = (id) => awards.push(id);
  retry.start(save.seed);
  retry.combatReport.heatTransfer(0.2);
  assert.equal(retry.combatReport.snapshot().heatTransfers, 1);
  assert.deepEqual(awards, ['relay-race']);
  const qualifying = new Game();
  qualifying.onCommendation = (id) => awards.push(id);
  qualifying.start(save.seed, {
    ...save,
    combatResults: { ...save.combatResults!, heatTransfers: 6 },
  });
  assert.deepEqual(
    awards,
    ['relay-race', 'relay-race'],
    'a qualifying 4.14 Continue earns on resuming',
  );
});

test('Logbook reveals only the encountered support challenge and shows single-run or Continue progress', () => {
  const g = new Game();
  const book = loadLogbook(null);
  const results = {
    ...g.combatReport.snapshot(),
    heatTransfers: 4,
    partial: true as const,
    fromStage: 8,
  };
  for (const m of SUPPORT_MASTERIES) {
    const unseen = logbookCatalog([], book, [], null).find((e) => e.id === 'commendation:' + m.id)!;
    assert.equal(unseen.state, 'unseen');
    assert.equal(unseen.mastery, undefined);
    assert.doesNotMatch(
      logbookArticle(unseen, () => ''),
      new RegExp(m.name + '|' + m.reward),
    );
  }
  const entries = logbookCatalog(
    [],
    book,
    [],
    { version: 1, encountered: ['mod:heat-relay'], read: [] },
    [],
    null,
    undefined,
    null,
    { results, label: 'Continue attempt' },
  );
  const relay = entries.find((e) => e.id === 'commendation:relay-race')!;
  assert.equal(relay.state, 'locked');
  assert.equal(relay.mastery!.current, 4);
  const html = logbookArticle(relay, () => '');
  assert.match(html, /4 \/ 6 heat transfers/);
  assert.match(html, /Continue attempt/);
  assert.match(html, /room 9/);
  assert.match(html, /data-reward-image="appearance:gun:heatline"/);
  assert.equal(entries.find((e) => e.id === 'commendation:stored-energy')!.state, 'unseen');
  const earned = logbookCatalog([], book, ['relay-race'], null).find((e) => e.id === relay.id)!;
  assert.equal(earned.mastery!.complete, true);
  assert.match(
    logbookArticle(earned, () => ''),
    /Appearance unlocked/,
  );
  const fresh = logbookCatalog(['heat-relay'], book, [], null).find((e) => e.id === relay.id)!;
  assert.equal(fresh.mastery!.current, 0);
});

test('recaps keep mastery targets scoped to used fittings and viewing records grants nothing', () => {
  const g = new Game();
  const run = {
    mods: ['heat-relay'],
    seed: 'RF-C88-mastery',
    kills: 10,
    elapsed: 20,
    combatResults: { ...g.combatReport.snapshot(), heatTransfers: 6 },
  };
  const html = combatReportMenu(run);
  assert.match(html, /6 \/ 6 heat transfers · Target met/);
  assert.doesNotMatch(html, /Stored Energy|Reservoir|Reclaimed Protection|Patchwork/);
  assert.match(combatReportMenu({ ...run, mods: [] }), /Relay Race/);
  assert.doesNotMatch(combatReportMenu({ ...run, combatResults: undefined }), /Relay Race/);
  let awards = 0;
  g.onCommendation = () => awards++;
  logbookCatalog(['heat-relay'], loadLogbook(null), [], null, [], null, undefined, null, {
    results: run.combatResults,
    label: 'Old report',
  });
  assert.equal(awards, 0);
});

test('pictured result preview is legal and isolated; all three cosmetic rewards survive backup', async () => {
  const save = presentationTestFromUrl(
    new URL('https://test.invalid/?test=presentation&scene=mastery'),
  )!;
  assert(loadCheckpoint(save));
  const g = new Game();
  let writes = 0,
    awards = 0;
  g.onCheckpoint = () => writes++;
  g.onCommendation = () => awards++;
  g.startTest(save);
  assert(finishPresentationTest(g));
  assert.equal(writes + awards, 0);
  assert.match(
    combatReportMenu({ ...save, kills: save.kills!, elapsed: save.elapsed! }),
    /5 \/ 5 bullets blocked/,
  );
  const earned = SUPPORT_MASTERIES.map((m) => m.id);
  const cosmetics = { gun: 'heatline', outfit: 'patchwork' } as const;
  assert.deepEqual(loadCosmetics(cosmetics, []), { gun: 'standard', outfit: 'standard' });
  assert.deepEqual(loadCosmetics(cosmetics, earned), cosmetics);
  assert.equal(loadCosmetics({ gun: 'reservoir' }, earned).gun, 'reservoir');
  const ids = earned.flatMap(commendationRewards);
  assert.deepEqual(ids, [
    'appearance:gun:heatline',
    'appearance:gun:reservoir',
    'appearance:outfit:patchwork',
  ]);
  const items = new Map<string, string>();
  const store = new ProgressStore(() => ({
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
  }));
  await store.write(COMMENDATIONS_KEY, earned);
  await store.write(COSMETICS_KEY, cosmetics);
  await store.write(RUN_REWARDS_KEY, addRunRewards(null, save.seed, ids));
  await store.write(CHECKPOINT_KEY, save);
  const backup = parseProgressBackup(store.backup('4.15.0'));
  assert.deepEqual(backup.values[COMMENDATIONS_KEY], earned);
  assert.deepEqual(backup.values[COSMETICS_KEY], cosmetics);
  assert.equal((backup.values[CHECKPOINT_KEY] as Checkpoint).combatResults!.bankCharges, 8);
});
