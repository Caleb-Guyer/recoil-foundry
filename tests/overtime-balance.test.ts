import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import {
  OVERTIME_BUILDS,
  overtimeBuild,
  overtimeBalanceTestFromUrl,
} from '../src/overtime-balance.ts';
import {
  availableMods,
  isFusion,
  isSalvage,
  loadCheckpoint,
  MOD_REQUIRES,
  MODS,
  rewardMods,
  seeded,
  validBuild,
} from '../src/rules.ts';
import { overtimeEntryDelays, shapeOvertimeOpening } from '../src/overtime-pressure.ts';
import { splitWaves, REINFORCEMENT_TELL } from '../src/reinforcements.ts';
import { getOvertimeLevel } from '../src/overtime.ts';

test('all five diagnostic builds have legal counts and retain isolated retry checkpoints', () => {
  for (const build of Object.keys(OVERTIME_BUILDS))
    for (let stage = 0; stage < 20; stage++) {
      const save = overtimeBuild(build, stage);
      assert(loadCheckpoint(save));
      assert(validBuild(save.mods));
      assert.equal(save.mods.length + save.overtime!.repairs, 19 + stage);
    }
  const g = new Game(),
    save = overtimeBuild('beam', 0);
  let saved = 0;
  g.onCheckpoint = () => saved++;
  g.startTest(save);
  g.hp = 33;
  g.startTest(g.testRun!);
  assert.deepEqual(g.testRun, save);
  assert.equal(g.hp, 100);
  assert.equal(saved, 0);
});

test('Overtime balance links reject duplicates, mixed modes and malformed build/room values', () => {
  for (const build of Object.keys(OVERTIME_BUILDS))
    for (const room of [1, 8, 20])
      assert(
        loadCheckpoint(
          overtimeBalanceTestFromUrl(
            new URL(`https://test/?test=overtime-balance&build=${build}&room=${room}`),
          ),
        ),
      );
  for (const suffix of [
    '&test=overtime-balance',
    '&daily=x',
    '&seed=x',
    '&room=0',
    '&room=21',
    '&room=01',
    '&room=2.5',
    '&room=2&room=3',
    '&build=__proto__',
    '&build=beam&build=beam',
    '&mode=practice',
  ])
    assert.equal(
      overtimeBalanceTestFromUrl(new URL('https://test/?test=overtime-balance' + suffix)),
      null,
      suffix,
    );
});

test('Overtime rewards develop an owned component whenever a legal follow-up remains', () => {
  for (const build of Object.keys(OVERTIME_BUILDS))
    for (const stage of [0, 8, 16]) {
      const { mods } = overtimeBuild(build, stage),
        develops = (id: string) => !!MOD_REQUIRES[id] || isFusion(id);
      for (let seed = 0; seed < 100; seed++) {
        const rng = seeded('follow-up-' + seed),
          excluded = rewardMods(mods, 3, rng, { stage, overtime: true }).map((m) => m.id);
        for (const removed of [[], excluded]) {
          const offers = rewardMods(
            mods,
            3,
            seeded('reroll-' + seed),
            { stage, overtime: true },
            removed,
          );
          const eligible = availableMods(mods).filter((m) => !removed.includes(m.id));
          assert.equal(new Set(offers.map((m) => m.id)).size, offers.length);
          assert(offers.every((m) => eligible.some((candidate) => candidate.id === m.id)));
          if (eligible.some((m) => develops(m.id))) assert(offers.some((m) => develops(m.id)));
        }
      }
    }
});

test('salvage is retained, full-pool queries stay exhaustive and exhausted rewards stay empty', () => {
  const mods = overtimeBuild('precision', 0).mods;
  const salvage = availableMods(mods, true).find((m) => isSalvage(m.id))!.id;
  for (let i = 0; i < 100; i++) {
    const offers = rewardMods(mods, 3, seeded('salvage-' + i), {
      stage: 3,
      overtime: true,
      salvage,
    });
    assert.equal(offers[0].id, salvage);
  }
  assert.equal(
    rewardMods(mods, MODS.length, seeded('pool'), { stage: 0, overtime: true }).length,
    availableMods(mods).length,
  );
  while (availableMods(mods).length) mods.push(availableMods(mods)[0].id);
  assert.deepEqual(rewardMods(mods, 3, seeded('empty'), { stage: 19, overtime: true }), []);
});

test('area opening changes preserve authored units, anchors, elite reserves and squad pairs', () => {
  for (let seed = 0; seed < 10; seed++)
    for (let stage = 0; stage < 20; stage++) {
      const level = getOvertimeLevel('OT-PLAN-' + seed, stage, 5);
      if (level.boss) continue;
      const [opening, reserve] = splitWaves(level, 'OT-PLAN-' + seed, Math.max(8, stage));
      const all = [...opening, ...reserve].map((s) => JSON.stringify(s)).sort();
      const protectedReserve = reserve
        .filter((s) => s.elite || s.squad)
        .map((s) => JSON.stringify(s))
        .sort();
      shapeOvertimeOpening(opening, reserve, stage);
      assert.deepEqual([...opening, ...reserve].map((s) => JSON.stringify(s)).sort(), all);
      assert.deepEqual(
        reserve
          .filter((s) => s.elite || s.squad)
          .map((s) => JSON.stringify(s))
          .sort(),
        protectedReserve,
      );
      const delays = overtimeEntryDelays(reserve, 1);
      assert(Math.max(...delays) > 0);
      for (const delay of new Set(delays)) assert(delays.filter((d) => d === delay).length <= 2);
      for (const s of reserve.filter((s) => s.squad?.role === 'lead')) {
        const mate = reserve.find(
          (other) => other.squad?.kind === s.squad!.kind && other.squad.role === 'support',
        );
        if (mate) assert.equal(delays[reserve.indexOf(s)], delays[reserve.indexOf(mate)]);
      }
    }
});

test('staggered entrances all receive full visible warning and spawn grace without losing pending state', () => {
  const g = new Game();
  g.startTest(overtimeBuild('volley', 0));
  g.waves.canEnter = () => true; // Isolate timing; geometry/occupancy has separate regression coverage.
  g.waves.update(20);
  const warned = new Map<object, number>(),
    spawned: number[] = [];
  let time = 0;
  const emit = g.spawnEnemy.bind(g);
  g.spawnEnemy = (...args) => {
    emit(...args);
    spawned.push(time);
    assert(g.enemies.at(-1)!.spawn >= 0.65);
  };
  for (let frame = 0; frame < 600 && g.waves.pending; frame++) {
    for (const d of g.waves.doors) if (d.state === 'warning' && !warned.has(d)) warned.set(d, time);
    time += 1 / 60;
    g.waves.update(1 / 60);
    for (const d of g.waves.doors)
      if (d.state === 'open') assert(time - warned.get(d)! >= REINFORCEMENT_TELL - 1e-6);
    if (g.waves.doors.some((d) => d.state === 'sealed')) assert(g.waves.pending);
  }
  assert.equal(spawned.length, g.waves.doors.length);
  assert(spawned.at(-1)! - spawned[0] > 2);
  assert.equal(g.waves.phase, 'final');
});

test('boss supports wait through a committed attack and preserve queued warnings after the boss dies', () => {
  const g = new Game();
  g.startTest(overtimeBuild('precision', 19));
  const boss = g.enemies[0];
  boss.state = 'windup';
  boss.hp = boss.maxHp * 0.5;
  g.waves.update(20);
  assert.equal(g.waves.phase, 'opening');
  boss.state = 'recover';
  g.waves.update(1 / 60);
  assert.equal(g.waves.phase, 'warning');
  assert(g.waves.doors.some((d) => d.state === 'sealed'));
  for (const d of g.waves.doors.filter((d) => d.state === 'warning'))
    assert.equal(d.timer, REINFORCEMENT_TELL);
  g.hitEnemy(boss, 1e9);
  assert(g.waves.pending);
  g.waves.update(0.2);
  assert.equal(g.enemies.length, 0);
  for (const d of g.waves.doors.filter((d) => d.state === 'warning')) assert(d.timer > 0);
  g.waves.clear();
  assert(!g.waves.pending);
  assert.equal(g.waves.doors.length, 0);
});

test('older Overtime revisions retain their original simultaneous door timing', () => {
  for (const remix of [undefined, 1, 2, 3, 4] as const) {
    const save = overtimeBuild('beam', 19);
    save.overtime!.remix = remix;
    const g = new Game();
    g.startTest(save);
    g.waves.update(8);
    assert.equal(g.waves.phase, 'opening');
    g.waves.update(1);
    assert.equal(g.waves.phase, 'warning');
    assert(
      g.waves.doors.every(
        (d) => d.state === 'warning' && d.timer === REINFORCEMENT_TELL && d.delay === undefined,
      ),
    );
  }
});
