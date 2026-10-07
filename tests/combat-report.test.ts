import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import { getGun, loadCheckpoint } from '../src/rules.ts';
import { fixture, target, round, advance, beam } from './branches-fixture.ts';
import { loadCombatResults, loadRecordedAppearance } from '../src/combat-report.ts';
import { snapshotRun, loadRunHistory } from '../src/run-history.ts';
import { buildConnections, combatReportMenu } from '../src/combat-report-menu.ts';
import { resultRecap, runHistoryMenu } from '../src/run-history-menu.ts';
import { dailyForDate } from '../src/daily.ts';
import { ProgressStore, CHECKPOINT_KEY, parseProgressBackup } from '../src/progress.ts';
import { RUN_HISTORY_KEY } from '../src/run-history.ts';

test('a real excess kill records one bank charge for a whole volley and never counts an empty discharge', () => {
  const g = fixture(['scatter', 'overkill-bank']);
  const e = target(g, 440);
  e.hp = e.maxHp = 20;
  round(g, { damage: 100 });
  advance(g, 3);
  assert.equal(g.combatReport.snapshot().bankCharges, 0);
  g.shots = [];
  g.fireRound();
  assert.equal(g.shots.length, 5);
  assert.equal(g.combatReport.snapshot().bankCharges, 1);
  g.fireRound();
  assert.equal(g.combatReport.snapshot().bankCharges, 1);
});

test('ten beam rays and their later frames share one recorded bank payment', () => {
  const g = fixture(['cutting-torch', 'scatter', 'prism-array', 'overkill-bank']);
  const e = target(g, 440);
  e.hp = e.maxHp = 0.01;
  beam(g, 1 / 60);
  assert(g.support.reserve > 0);
  target(g, 600);
  beam(g, g.gun.interval + 1 / 60);
  assert.equal(g.combatReport.snapshot().bankCharges, 1);
  beam(g, 1 / 60);
  assert.equal(g.combatReport.snapshot().bankCharges, 1);
});

test('heat is counted on a completed target transfer rather than a kill, expiration or empty read', () => {
  const g = fixture(['cutting-torch', 'thermal-runaway', 'heat-relay']);
  const first = target(g, 400);
  beam(g, 0.5);
  first.hp = 0.01;
  beam(g, 1 / 60);
  assert(first.hp <= 0 && g.support.relay > 0);
  assert.equal(g.combatReport.snapshot().heatTransfers, 0);
  target(g, 450);
  beam(g, 1 / 60);
  assert.equal(g.combatReport.snapshot().heatTransfers, 1);
  g.support.takeHeat();
  assert.equal(g.combatReport.snapshot().heatTransfers, 1);
  const expired = fixture(['cutting-torch', 'thermal-runaway', 'heat-relay']);
  const last = target(expired, 400);
  beam(expired, 0.5);
  last.hp = 0.01;
  beam(expired, 1 / 60);
  expired.time += 1.1;
  target(expired, 450);
  beam(expired, 1 / 60);
  assert.equal(expired.combatReport.snapshot().heatTransfers, 0);
});

test('armor records a real absorbed patrol bullet and excludes grace hits, shells and hazards', () => {
  const g = fixture(['scrap-armor']);
  const crate = g.props.spawn('crate', 800, 300);
  g.props.hit(crate, 200, { x: 1, y: 0 }, round(g, { damage: 200 }));
  g.shots = [];
  assert.equal(g.combatReport.snapshot().armorBlocks, 0);
  g.damagePlayer(15, undefined, { type: 'fuel' });
  const shot = round(g, { friendly: false, damage: 14 });
  g.damagePlayer(14, undefined, { type: 'shot' }, shot);
  assert.equal(g.combatReport.snapshot().armorBlocks, 0);
  g.time += 1;
  g.damagePlayer(14, undefined, { type: 'shot' }, shot);
  assert.equal(g.combatReport.snapshot().armorBlocks, 1);
  g.time += 7;
  g.support.collectPlate(round(g));
  g.damagePlayer(21, undefined, { type: 'shot' }, round(g, { friendly: false, damage: 21 }));
  assert.equal(g.combatReport.snapshot().armorBlocks, 1);
});

test('Bloodwork records actual recovered health rather than its advertised or overhealed amount', () => {
  const g = fixture(['leech']);
  const kill = () => {
    const e = target(g, 440);
    e.hp = e.maxHp = 1;
    round(g, { damage: 100 });
    advance(g, 3);
    g.shots = [];
  };
  g.hp = 99;
  kill();
  assert.equal(g.hp, 100);
  assert.equal(g.combatReport.snapshot().bloodworkHealing, 1);
  kill();
  assert.equal(g.combatReport.snapshot().bloodworkHealing, 1);
  g.hp = 97;
  kill();
  assert.equal(g.combatReport.snapshot().bloodworkHealing, 3);
});

test('checkpoints preserve totals across Continue and room transitions, while fresh starts reset them', () => {
  const g = new Game();
  g.start('RF-C88-report-save');
  g.combatReport.bankCharge(10);
  g.combatReport.heatTransfer(0.2);
  g.combatReport.armorBlock();
  const results = g.combatReport.snapshot();
  let raw: unknown;
  g.onCheckpoint = (s) => {
    raw = s;
  };
  g.save();
  const save = loadCheckpoint(JSON.parse(JSON.stringify(raw)))!;
  assert(save);
  assert.deepEqual(save.combatResults, results);
  g.combatReport.armorBlock();
  assert.equal(save.combatResults!.armorBlocks, 1);
  const resumed = new Game();
  resumed.start(save.seed, save);
  resumed.loadRoom();
  assert.deepEqual(resumed.combatReport.snapshot(), results);
  resumed.setMode('paused');
  resumed.combatReport.bankCharge(10);
  assert.deepEqual(resumed.combatReport.snapshot(), results);
  resumed.setMode('playing');
  resumed.combatReport.bloodworkHeal(0.5);
  resumed.die();
  assert.equal(snapshotRun(resumed, 'continued')!.combatResults!.bloodworkHealing, 0.5);
  resumed.start(save.seed);
  assert.equal(resumed.combatReport.snapshot().bankCharges, 0);
  resumed.combatReport.bankCharge(10);
  resumed.startWorkshop([], []);
  assert.equal(resumed.combatReport.snapshot().bankCharges, 0);
});

test('older Continue saves mark partial recording without inventing earlier counters', () => {
  const g = new Game();
  g.start('RF-C88-report-old');
  let raw: unknown;
  g.onCheckpoint = (s) => {
    raw = s;
  };
  g.elapsed = 30;
  g.save();
  const save = loadCheckpoint(raw)!;
  delete save.combatResults;
  g.start(save.seed, save);
  assert.deepEqual(g.combatReport.snapshot(), {
    version: 1,
    heatTransfers: 0,
    bankCharges: 0,
    armorBlocks: 0,
    bloodworkHealing: 0,
    partial: true,
    fromStage: 0,
  });
  g.setMode('won');
  assert.match(combatReportMenu(snapshotRun(g, 'partial')!), /Earlier activity is unavailable/);
  const fresh = new Game();
  fresh.start(save.seed);
  assert.equal(fresh.combatReport.snapshot().partial, undefined);
  fresh.startTest(save);
  assert.equal(fresh.combatReport.snapshot().partial, undefined);
});

test('finished history copies its report and actual appearance, including Daily results and backups', () => {
  const g = new Game();
  g.start('RF-C88-report-history');
  g.cosmetics = { gun: 'ledger', outfit: 'night' };
  g.combatReport.bankCharge(10);
  g.setMode('won');
  const saved = snapshotRun(g, 'final')!;
  g.cosmetics.gun = 'standard';
  g.combatReport.reset();
  assert.deepEqual(saved.appearance, { gun: 'ledger', outfit: 'night' });
  assert.equal(saved.combatResults!.bankCharges, 1);
  assert.deepEqual(loadRunHistory(JSON.parse(JSON.stringify([saved]))), [saved]);
  g.start(dailyForDate('2026-10-05')!.seed);
  g.combatReport.heatTransfer(0.3);
  g.setMode('won');
  assert.equal(snapshotRun(g, 'daily')!.combatResults!.heatTransfers, 1);
});

test('invalid optional metadata is discarded without losing a valid run or checkpoint', () => {
  const g = new Game();
  g.start('RF-C88-report-validation');
  let checkpoint: unknown;
  g.onCheckpoint = (s) => {
    checkpoint = s;
  };
  g.save();
  g.setMode('won');
  const run = snapshotRun(g, 'safe')!;
  for (const combatResults of [
    null,
    { version: 2 },
    { ...run.combatResults, heatTransfers: -1 },
    { ...run.combatResults, bankCharges: Infinity },
    { ...run.combatResults, armorBlocks: 0.5 },
    { ...run.combatResults, bloodworkHealing: NaN },
    { ...run.combatResults, partial: 'yes' },
    { ...run.combatResults, fromStage: 20 },
  ]) {
    assert.equal(loadCombatResults(combatResults), undefined);
    assert.equal(
      loadCheckpoint({ ...(checkpoint as object), combatResults })!.combatResults,
      undefined,
    );
    assert.equal(loadRunHistory([{ ...run, combatResults }])[0].combatResults, undefined);
  }
  assert.equal(loadRecordedAppearance({ gun: '__proto__', outfit: 'standard' }), undefined);
  assert.equal(
    loadRunHistory([{ ...run, appearance: { gun: 'ledger', outfit: 'unknown' } }])[0].appearance,
    undefined,
  );
});

test('progress export and atomic restore retain checkpoint counters and past-run appearances', async () => {
  const storage = () => {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    };
  };
  const firstDisk = storage(),
    secondDisk = storage();
  const first = new ProgressStore(() => firstDisk),
    second = new ProgressStore(() => secondDisk);
  const g = new Game();
  g.start('RF-C88-report-backup');
  g.combatReport.armorBlock();
  g.combatReport.bloodworkHeal(1.5);
  let save: unknown;
  g.onCheckpoint = (value) => {
    save = value;
  };
  g.save();
  assert(await first.write(CHECKPOINT_KEY, save));
  g.cosmetics = { gun: 'ledger', outfit: 'night' };
  g.setMode('won');
  const run = snapshotRun(g, 'backup')!;
  assert(await first.write(RUN_HISTORY_KEY, [run]));
  assert(await second.restore(parseProgressBackup(first.backup('4.14.0'))));
  const checkpoint = loadCheckpoint(second.read(CHECKPOINT_KEY))!;
  assert.equal(checkpoint.combatResults!.armorBlocks, 1);
  assert.equal(checkpoint.combatResults!.bloodworkHealing, 1.5);
  const restored = loadRunHistory(second.read(RUN_HISTORY_KEY))[0];
  assert.deepEqual(restored, run);
  assert.deepEqual(restored.appearance, { gun: 'ledger', outfit: 'night' });
});

test('build highlights use actual combined counts, starting guns and preserved beam rules', () => {
  const base = {
    mods: [
      'cutting-torch',
      'scatter',
      'prism-array',
      'collimator',
      'thermal-runaway',
      'heat-relay',
      'overkill-bank',
    ],
    seed: 'RF-C88-report',
  };
  const connections = buildConnections(base);
  assert.equal(connections.length, 3);
  assert.equal(connections[0].title, '10 beams');
  assert.match(connections[0].detail, /Steady aim tightens/);
  assert.match(connections[1].title, /Heat Relay/);
  assert.match(connections[2].detail, /share the reserve/);
  const native = buildConnections({ ...base, startingGun: 'shotgun' })[0];
  const pellets = getGun(base.mods, 'shotgun').pellets;
  assert.equal(native.title, `${pellets * 2} beams`);
  const old = buildConnections({ ...base, seed: 'RF-D86-2026-09-20' })[0];
  assert.equal(old.title, '2 beams');
  assert.match(old.detail, /preserved rules/);
  assert.equal(
    buildConnections({ mods: ['mass-driver', 'scatter'], seed: base.seed })[0].title,
    '5 steel balls',
  );
});

test('compact reports disclose only owned effects, keep details closed, and distinguish missing results from zero', () => {
  const g = new Game();
  g.start('RF-C88-report-menu');
  g.setMode('won');
  const run = snapshotRun(g, 'menu')!;
  const html = resultRecap(run, []);
  assert.match(html, /What carried your run/);
  assert.match(html, /canvas.*data-run-gun="0"/);
  assert(!html.includes(' open'));
  assert(
    !html.includes('Heat Relay') && !html.includes('Scrap Armor') && !html.includes('Bloodwork'),
  );
  const old = { ...run, combatResults: undefined, appearance: undefined };
  assert.match(combatReportMenu(old), /weren’t recorded/);
  assert.match(combatReportMenu(old), /Original appearance not recorded/);
  const owned = { ...run, mods: ['scrap-armor', 'leech'] };
  assert.match(combatReportMenu(owned), /0 bullets blocked/);
  const history = runHistoryMenu([run, owned], []);
  assert.equal((history.match(/class="run-recap"/g) ?? []).length, 2);
  assert.match(history, /data-run-gun="1"/);
});
