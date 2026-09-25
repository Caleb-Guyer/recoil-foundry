import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { MODS, getGun, loadCheckpoint } from '../src/rules.ts';
import { DAILY_RULESET, dailyForDate } from '../src/daily.ts';
import { damageCauseText, loadDamageCause } from '../src/damage-cause.ts';
import {
  RUN_HISTORY_LIMIT,
  addRun,
  canPracticeRunBuild,
  canReplayRun,
  loadRunHistory,
  reachedRoom,
  snapshotRun,
  type RunRecap,
} from '../src/run-history.ts';
import { recapBody, resultRecap, runHistoryMenu } from '../src/run-history-menu.ts';
const { Body, Composite } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 800, y: 400 },
};
function room(seed = 'recap-test') {
  const g = new Game();
  g.start(seed);
  g.waves.clear();
  g.hazards.clear();
  g.breaches.clear();
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  Body.setPosition(g.player, { x: 400, y: 400 });
  g.engine.gravity.y = 0;
  return g;
}
function run(id = 'run-1', at = 1000): RunRecap {
  const g = room();
  g.elapsed = 147.23;
  g.kills = 8;
  g.mods = ['magnum', 'fold'];
  g.hp = 5;
  g.damagePlayer(14, undefined, { type: 'shot', enemy: 'shooter' });
  return snapshotRun(g, id, at)!;
}
test('recaps snapshot only finished normal and Daily runs and copy their final gun', () => {
  const g = room();
  assert.equal(snapshotRun(g, 'playing'), null);
  g.setMode('paused');
  assert.equal(snapshotRun(g, 'paused'), null);
  g.setMode('playing');
  g.mods = ['magnum'];
  g.elapsed = 37;
  g.kills = 2;
  g.damagePlayer(200, undefined, { type: 'hook', enemy: 'harpooner' });
  const recap = snapshotRun(g, 'lost', 42)!;
  assert.equal(recap.mode, 'normal');
  assert.equal(recap.stage, 0);
  assert.equal(recap.roomName, g.level.name);
  assert.equal(recap.elapsed, 37);
  assert.equal(damageCauseText(recap.cause), 'Harpooner · Harpoon');
  g.mods.push('fold');
  assert.deepEqual(recap.mods, ['magnum']);
  g.start(dailyForDate('2026-09-13')!.seed);
  g.setMode('won');
  const daily = snapshotRun(g, 'daily')!;
  assert.equal(daily.mode, 'daily');
  assert.equal(daily.cause, null);
  assert(canReplayRun(daily));
  g.startTest({ version: 5, seed: 'TEST', stage: 0, hp: 100, mods: [], kills: 0, elapsed: 0 });
  g.die();
  assert.equal(snapshotRun(g, 'test'), null);
  g.startPractice({ kind: 'loader', seed: 'practice' });
  g.die();
  assert.equal(snapshotRun(g, 'practice'), null);
  g.startWorkshop([]);
  g.setMode('won');
  assert.equal(snapshotRun(g, 'workshop'), null);
});
test('history keeps exactly ten recent runs, deduplicates ids, and keeps separate attempts at the same seed', () => {
  let history: RunRecap[] = [];
  for (let i = 0; i < 16; i++) history = addRun(history, run('run-' + i, i * 1000));
  assert.equal(history.length, RUN_HISTORY_LIMIT);
  assert.deepEqual(
    history.map((r) => r.id),
    Array.from({ length: 10 }, (_, i) => 'run-' + (15 - i)),
  );
  history = addRun(history, history[0]);
  assert.equal(history.length, 10);
  assert.equal(history.filter((r) => r.id === 'run-15').length, 1);
  assert.equal(new Set(history.map((r) => r.seed)).size, 1);
  const roundTrip = loadRunHistory(JSON.parse(JSON.stringify(history)));
  assert.deepEqual(roundTrip, history);
  roundTrip[0].mods.push('light');
  assert(!history[0].mods.includes('light'));
});
test('malformed, oversized, future-schema and impossible records never reach the menu', () => {
  const good = run();
  const bad = [
    null,
    'text',
    {},
    { ...good, version: 2 },
    { ...good, stage: -1 },
    { ...good, stage: 20 },
    { ...good, mods: ['fold', 'fold'] },
    { ...good, mods: ['rewire'] },
    { ...good, mods: ['not-an-upgrade'] },
    { ...good, finishedAt: Infinity },
    { ...good, finishedAt: 9e15 },
    { ...good, elapsed: NaN },
    { ...good, kills: -2 },
    { ...good, seed: 'a'.repeat(41) },
    { ...good, area: '__proto__' },
    { ...good, mode: 'test' },
    { ...good, mode: 'daily' },
    { ...good, outcome: 'playing' },
    { ...good, overtime: 'yes' },
    { ...good, roomName: '' },
  ];
  for (const entry of bad) assert.deepEqual(loadRunHistory([entry]), []);
  assert.deepEqual(loadRunHistory({ runs: [good] }), []);
  assert.deepEqual(loadDamageCause({ type: '__proto__', enemy: 'boss' }), { type: 'unknown' });
  assert.deepEqual(loadDamageCause({ type: 'shot', enemy: 'unseen-future-enemy' }), {
    type: 'shot',
  });
  assert.equal(loadRunHistory([{ ...good, cause: { type: 'future' } }])[0].cause?.type, 'unknown');
});
test('old rules remain readable while replay stays disabled; Workshop requires the whole discovered build', () => {
  const old = { ...run(), ruleset: DAILY_RULESET - 1 };
  assert.equal(loadRunHistory([old]).length, 1);
  assert(!canReplayRun(old));
  const daily = { ...old, mode: 'daily' as const, seed: `RF-D${DAILY_RULESET - 1}-2026-09-13` };
  assert.equal(loadRunHistory([daily]).length, 1);
  assert(!canReplayRun(daily));
  assert(canPracticeRunBuild(old, ['fold', 'magnum']));
  assert(!canPracticeRunBuild(old, ['fold']));
  assert(canPracticeRunBuild({ ...old, mods: [] }, []));
});
test('recap HTML starts collapsed, escapes stored text, and reveals only the run itself', () => {
  const recap = run();
  recap.seed = '<img src=x onerror=alert(1)>';
  recap.roomName = '<script>bad()</script>';
  const html = resultRecap(recap, recap.mods);
  assert.match(html, /<details class="run-recap"><summary>Run recap/);
  assert(!html.includes(' open'));
  assert(html.includes('&lt;img') && html.includes('&lt;script&gt;'));
  assert(!html.includes('<img') && !html.includes('<script>'));
  assert(html.includes('Gunner · Gunfire'));
  for (const id of recap.mods) assert(html.includes(MODS.find((mod) => mod.id === id)!.name));
  for (const name of ['Interceptor', 'Condenser', 'Rooftops', 'The Kiln', 'Rail spike'])
    assert(!html.includes(name), name + ' leaked');
  const history = runHistoryMenu([recap], recap.mods);
  assert.equal((history.match(/<details/g) ?? []).length, 1);
  assert(!history.includes(' open'));
  assert.match(recapBody(recap, 0, []), /data-recap-build="0" disabled/);
  assert.match(recapBody(recap, 0, []), /data-recap-save="0" disabled/);
  assert.match(recapBody(recap, 0, recap.mods), /data-recap-save="0">Save blueprint/);
});
test('lethal shots retain their source even after the attacker is gone; grace hits cannot change the cause', () => {
  const g = room();
  g.hp = 8;
  g.spawnEnemy('shooter', 200, 400);
  const enemy = g.enemies.at(-1)!;
  g.enemyShot(enemy, 0, 14, 14);
  assert.deepEqual(g.shots[0].damageCause, { type: 'shot', enemy: 'shooter' });
  Composite.remove(g.engine.world, enemy.body);
  g.enemies = [];
  for (let i = 0; i < 20 && g.mode === 'playing'; i++) {
    g.time += 1 / 60;
    g.updateShots(1 / 60);
  }
  assert.equal(g.mode, 'dead');
  assert.equal(damageCauseText(g.deathCause), 'Gunner · Gunfire');
  g.damagePlayer(100, undefined, { type: 'train' });
  g.die({ type: 'fall' });
  assert.equal(damageCauseText(g.deathCause), 'Gunner · Gunfire');
  g.start('fresh');
  assert.equal(g.deathCause, null);
  g.hp = 5;
  g.hurtAt = g.time;
  g.damagePlayer(100, undefined, { type: 'fuel' });
  assert.equal(g.deathCause, null);
});
test('physical collisions and canister chains identify the actual fatal event', () => {
  const g = room();
  g.hp = 1;
  g.spawnEnemy('runner', 400, 400);
  g.enemies.at(-1)!.spawn = 0;
  g.updateEnemy(g.enemies.at(-1)!, 1 / 60);
  assert.equal(damageCauseText(g.deathCause), 'Runner · Collision');
  const fuel = room();
  fuel.hp = 1;
  fuel.props.explode(fuel.props.spawn('canister', 440, 400));
  assert.equal(damageCauseText(fuel.deathCause), 'Fuel canister');
});
test('Continue keeps the whole run recap and Workshop cannot overwrite its saved checkpoint', () => {
  const original = room();
  let save: unknown;
  original.onCheckpoint = (value) => {
    save = value;
  };
  original.elapsed = 125;
  original.kills = 9;
  original.save();
  const checkpoint = loadCheckpoint(save)!;
  assert(checkpoint);
  const resumed = new Game();
  resumed.start(checkpoint.seed, checkpoint);
  resumed.elapsed += 4;
  resumed.hp = 1;
  resumed.damagePlayer(10, undefined, { type: 'fuel' });
  const recap = snapshotRun(resumed, 'continued')!;
  assert.equal(recap.elapsed, 129);
  assert.equal(recap.kills, 9);
  let checkpointWrites = 0;
  resumed.onCheckpoint = () => checkpointWrites++;
  resumed.startWorkshop(
    MODS.map((m) => m.id),
    recap.mods,
  );
  assert.equal(checkpointWrites, 0);
  assert.equal(snapshotRun(resumed, 'range'), null);
  assert.deepEqual(resumed.mods, recap.mods);
  assert.deepEqual(resumed.gun, getGun(recap.mods));
  resumed.start(recap.seed);
  assert.deepEqual(resumed.mods, []);
  assert.equal(resumed.stage, 0);
  assert.equal(resumed.elapsed, 0);
});
test('Overtime, detours and extraction identify only the reached portion of the run', () => {
  const recap = run();
  assert.equal(reachedRoom({ ...recap, stage: 6, overtime: true }), 'Overtime · Room 07');
  assert.equal(reachedRoom({ ...recap, stage: 2, detour: true }), 'Challenge · Room 03');
  assert.equal(reachedRoom({ ...recap, stage: 19, escape: true }), 'Escape');
});
