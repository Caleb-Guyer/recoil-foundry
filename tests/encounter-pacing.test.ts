import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Input } from '../src/game.ts';
import { getLevel, type Spawn } from '../src/levels.ts';
import { encounterPlan, shapeEncounter, encounterDelays } from '../src/encounter-pacing.ts';
import { encounterTestFromUrl } from '../src/encounter-test.ts';
import { splitWaves, REINFORCEMENT_TELL } from '../src/reinforcements.ts';
import { getGun, loadCheckpoint } from '../src/rules.ts';
import { fixture, target, Composite, Body } from './branches-fixture.ts';
import { dailyForDate } from '../src/daily.ts';
import { floodgateLevel } from '../src/floodgate-layout.ts';
import { snapshotRun, loadRunHistory } from '../src/run-history.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1200, y: 300 },
};
const key = (s: Spawn) => `${s.kind}:${s.x}:${s.y}:${s.elite ?? ''}`;
function pacingFixture(stage = 1) {
  const g = fixture([]);
  g.encounters = 1;
  g.stage = stage;
  g.waves.plan = encounterPlan(g.level, 'pacing-fixture', stage);
  g.waves.plan.rhythm = 'crossfire';
  return g;
}

test('campaign rhythms alternate within a zone, breathe after bosses and vary across seeds', () => {
  const schedules = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const seed = 'rhythm-' + i;
    const rhythms = Array.from(
      { length: 20 },
      (_, stage) => encounterPlan(getLevel(seed, stage), seed, stage).rhythm,
    );
    assert.equal(rhythms[0], 'intro');
    for (const stage of [3, 7, 11, 15, 19]) assert.equal(rhythms[stage], 'boss');
    for (const stage of [4, 8, 12, 16]) assert.equal(rhythms[stage], 'breather');
    for (const stage of [1, 5, 9, 13, 17]) assert.notEqual(rhythms[stage], rhythms[stage + 1]);
    schedules.add(rhythms.join(','));
  }
  assert(schedules.size > 10);
});

test('pacing preserves every authored hull anchor, enemy and introduction across hundreds of rooms', () => {
  for (let i = 0; i < 30; i++)
    for (let stage = 0; stage < 20; stage++) {
      const seed = 'paced-roster-' + i,
        level = getLevel(seed, stage);
      const snapshot = structuredClone(level);
      const [opening, reserve] = splitWaves(level, seed, stage);
      const roster = [...opening, ...reserve].map(key).sort();
      const introduction = opening.map(key);
      const plan = encounterPlan(level, seed, stage);
      shapeEncounter(opening, reserve, level, plan);
      assert.deepEqual([...opening, ...reserve].map(key).sort(), roster);
      assert.deepEqual(level, snapshot);
      assert(opening.length > 0 || level.freight);
      for (const s of [...opening, ...reserve]) {
        if (!s.squad) continue;
        assert(
          !opening.some((a) => a.squad?.kind === s.squad!.kind) ||
            !reserve.some((a) => a.squad?.kind === s.squad!.kind),
          'A coordinated formation must stay in one wave',
        );
      }
      if (
        level.boss ||
        level.annex ||
        level.fabricatorIntro ||
        level.harpoonIntro ||
        level.anglerIntro ||
        level.crawlerIntro ||
        level.sapperIntro
      )
        assert.deepEqual(opening.map(key), introduction);
      assert.equal(encounterDelays(reserve, plan.spacing).length, reserve.length);
    }
});

test('crossfire uses ranged openings, ambushes use rushers and traversal uses elevated anchors', () => {
  const level = getLevel('specific-rhythms', 1);
  level.spawns = [
    { kind: 'runner', x: 500, y: 723 },
    { kind: 'charger', x: 600, y: 723 },
    { kind: 'shooter', x: 900, y: 450 },
    { kind: 'flyer', x: 1100, y: 300 },
    { kind: 'runner', x: 1300, y: 723 },
    { kind: 'shooter', x: 1500, y: 723 },
  ];
  for (const rhythm of ['ambush', 'crossfire', 'traversal'] as const) {
    const plan = { ...encounterPlan(level, 'specific', 1), rhythm, opening: 2 };
    const [opening, reserve] = splitWaves(level, 'specific', 1);
    shapeEncounter(opening, reserve, level, plan);
    if (rhythm === 'ambush') assert(opening.every((s) => ['runner', 'charger'].includes(s.kind)));
    if (rhythm === 'crossfire') assert(opening.every((s) => ['shooter', 'flyer'].includes(s.kind)));
    if (rhythm === 'traversal') assert(opening.every((s) => s.y < 600));
  }
});

test('coordinated squad members keep one arrival time even with other anchors between them', () => {
  const delays = encounterDelays(
    [
      { kind: 'runner', x: 500, y: 723, squad: { kind: 'shield', role: 'lead' } },
      { kind: 'flyer', x: 700, y: 400 },
      { kind: 'shooter', x: 900, y: 723, squad: { kind: 'shield', role: 'support' } },
      { kind: 'runner', x: 1200, y: 723 },
    ],
    1.1,
  );
  assert.equal(delays[0], delays[2]);
  assert(delays[1] > delays[0]);
});

test('Floodgate keeps its authored wave schedule for the rising-water encounter', () => {
  const g = new Game();
  g.start('floodgate-schedule');
  const level = floodgateLevel(g.seed);
  g.stage = 8;
  g.level = level;
  const [opening, reserve] = splitWaves(level, g.roomSeed, g.stage);
  assert.deepEqual(g.waves.reset(level), opening);
  assert.deepEqual(
    g.waves.doors.map((d) => d.spawn),
    reserve,
  );
  assert(g.waves.doors.every((d) => d.delay === undefined));
  assert.equal(g.waves.plan, null);
  assert.equal(g.encounterPacer.active, false);
});

test('new warnings avoid a simultaneous opposing pincer, then serve the waiting enemy fairly', () => {
  const g = pacingFixture();
  Body.setPosition(g.player, { x: 1000, y: 300 });
  const a = target(g, 600),
    b = target(g, 1400);
  assert(g.encounterPacer.request(a, false, 0.7));
  assert(!g.encounterPacer.request(b, false, 0.7));
  g.time += 0.1;
  assert(!g.encounterPacer.request(b, false, 0.7));
  g.time += 0.6;
  // Keep the waiting request live through normal per-frame retries.
  g.encounterPacer.waiting.get(b.id)!.seen = g.time;
  assert(!g.encounterPacer.request(a, false, 0.7));
  assert(g.encounterPacer.request(b, false, 0.7));
});

test('separated crossfire lanes can overlap while a heavy attack reserves a movement opening', () => {
  const g = pacingFixture();
  Body.setPosition(g.player, { x: 1000, y: 600 });
  const a = target(g, 650, 600),
    b = target(g, 900, 300),
    c = target(g, 1300, 600, 'charger');
  assert(g.encounterPacer.request(a, false, 0.7));
  assert(g.encounterPacer.request(b, false, 0.7));
  assert(!g.encounterPacer.request(c, true, 1.1));
  g.time += 0.7;
  g.encounterPacer.waiting.get(c.id)!.seen = g.time;
  assert(g.encounterPacer.request(c, true, 1.1));
  assert(!g.encounterPacer.request(a, false, 0.7));
});

test('admission waits before the visible warning and never retimes an already visible tell', () => {
  const g = pacingFixture();
  Body.setPosition(g.player, { x: 1000, y: 300 });
  const a = target(g, 600),
    b = target(g, 1400);
  g.encounterPacer.request(a, false, 0.7);
  b.timer = 0.41;
  g.encounterPacer.prepareRanged(b, 1 / 60, g.player.position);
  assert(b.timer - 1 / 60 > 0.4);
  b.timer = 0.25;
  g.encounterPacer.prepareRanged(b, 1 / 60, g.player.position);
  assert.equal(b.timer, 0.25);
  b.kind = 'sniper';
  b.state = 'windup';
  b.timer = 0.4;
  g.updateEnemy(b, 1 / 60);
  assert(Math.abs(b.timer - (0.4 - 1 / 60)) < 1e-9);
});

test('opposed defense volleys remain paced even when cover blocks a solid generator target', () => {
  const g = pacingFixture();
  const generator = g.props.spawn('cargo', 1000, 300);
  g.uprising.nodes = [generator];
  g.props.spawn('cover', 800, 300);
  const a = target(g, 600),
    b = target(g, 1400);
  assert(g.encounterPacer.request(a, false, 0.7, generator.body.position));
  b.timer = 0.41;
  g.encounterPacer.prepareRanged(b, 1 / 60, generator.body.position);
  assert(b.timer - 1 / 60 > 0.4);
});

test('defense activation follows the patrol instead of an incidental combat jump', () => {
  const save = encounterTestFromUrl(new URL('https://test/?test=encounters&route=core-defense'))!;
  const g = new Game();
  g.startTest(save);
  Body.setPosition(g.player, { x: 1000, y: 680 });
  assert.match(g.uprising.status, /Clear the patrol/);
  g.uprising.update({ ...idle, jump: true }, 1 / 60);
  assert.equal(g.uprising.armedAt, null);
  for (const e of [...g.enemies]) g.hitEnemy(e, 99999);
  g.hitStop = 0;
  g.waves.clear();
  g.uprising.update({ ...idle, jump: true }, 1 / 60);
  assert.equal(g.uprising.armedAt, null);
  g.time += 0.3;
  g.uprising.update({ ...idle, jump: true }, 1 / 60);
  assert.equal(g.uprising.armedAt, g.time);
  assert.match(g.uprising.status, /18s/);
});

test('new job exits require deliberate grounded movement after patrol clearance', () => {
  const save = encounterTestFromUrl(new URL('https://test/?test=encounters&route=core-defense'))!;
  const g = new Game();
  g.startTest(save);
  for (const e of [...g.enemies]) g.hitEnemy(e, 99999);
  g.hitStop = 0;
  g.waves.clear();
  Body.setPosition(g.player, { x: 1900, y: 720 });
  g.grounded = true;
  g.uprising.update(idle, 1 / 60);
  g.time += 0.7;
  g.uprising.update(idle, 1 / 60);
  assert.equal(g.uprising.outcome, undefined, 'Momentum alone cannot abandon a job');
  g.grounded = false;
  g.uprising.update({ ...idle, right: true }, 1 / 60);
  assert.equal(g.uprising.outcome, undefined);
  g.grounded = true;
  g.uprising.update({ ...idle, right: true }, 1 / 60);
  assert.equal(g.uprising.outcome?.result, 'failed');
});

test('dead or inactive queued machines release their place, and clearing a room clears all grants', () => {
  const g = pacingFixture();
  const a = target(g, 500),
    b = target(g, 600);
  g.encounterPacer.request(a, false, 0.7);
  g.encounterPacer.request(b, false, 0.7);
  Composite.remove(g.engine.world, a.body);
  g.enemies = g.enemies.filter((e) => e !== a);
  assert(g.encounterPacer.request(b, false, 0.7));
  assert(!g.encounterPacer.grants.has(a.id));
  g.waves.clear();
  assert.equal(g.encounterPacer.grants.size, 0);
  assert.equal(g.encounterPacer.waiting.size, 0);
});

test('bounded live arrivals wait at full warning and do not relocate just because the room is busy', () => {
  const g = pacingFixture();
  g.waves.plan!.cap = 2;
  const a = target(g, 700),
    b = target(g, 900);
  const spawn: Spawn = { kind: 'shooter', x: 1300, y: 300 };
  g.waves.doors = [{ spawn, state: 'warning', timer: 0, blocked: 0, attackDelay: 1 }];
  g.waves.phase = 'warning';
  for (let i = 0; i < 60; i++) g.waves.update(1 / 60);
  assert.deepEqual(g.waves.doors[0].spawn, spawn);
  assert.equal(g.waves.doors[0].blocked, 0);
  assert.equal(g.enemies.length, 2);
  g.hitEnemy(a, 999999);
  g.waves.update(1 / 60);
  assert.equal(g.enemies.length, 2);
  assert.equal(g.waves.doors[0].state, 'open');
  assert.equal(b.hp, b.maxHp);
});

test('every new door receives its full visible tell after the scheduled delay, including pause and hitstop', () => {
  const g = new Game();
  g.start('scheduled-door');
  for (const e of [...g.enemies]) g.hitEnemy(e, 999999);
  g.waves.update(1 / 60);
  assert.equal(g.waves.phase, 'warning');
  assert(g.waves.doors.every((d) => d.state === 'sealed'));
  g.setMode('paused');
  const timers = g.waves.doors.map((d) => d.delay);
  for (let i = 0; i < 60; i++) g.tick(1 / 60, idle);
  assert.deepEqual(
    g.waves.doors.map((d) => d.delay),
    timers,
  );
  g.setMode('playing');
  g.hitStop = 0.2;
  g.tick(1 / 60, idle);
  assert.deepEqual(
    g.waves.doors.map((d) => d.delay),
    timers,
  );
  for (let i = 0; i < 60 && !g.waves.doors.some((d) => d.state === 'warning'); i++)
    g.waves.update(1 / 60);
  const door = g.waves.doors.find((d) => d.state === 'warning')!;
  assert.equal(door.timer, REINFORCEMENT_TELL);
});

test('boss recovery gives all native guns a complete discharge window without changing their stats', () => {
  for (const gun of ['pistol', 'shotgun', 'nailgun'] as const) {
    const g = pacingFixture(3);
    g.startingGun = gun;
    g.gun = getGun([], gun);
    const e = target(g, 800, 300, 'loader');
    e.state = 'recover';
    e.timer = 0.4;
    const stats = structuredClone(g.gun);
    g.encounterPacer.recovery(e, 'rush');
    assert(e.timer >= g.gun.interval * (g.gun.burstCount === 3 ? 3.1 : 1) + 0.12);
    assert(e.timer <= 1.05);
    const recovery = e.timer;
    g.encounterPacer.recovery(e, 'recover');
    assert.equal(e.timer, recovery);
    assert.deepEqual(g.gun, stats);
  }
});

test('new Campaigns save their pacing revision; legacy Continue, Daily, Practice and Workshop keep their rules', () => {
  const g = new Game();
  g.start('pacing-save');
  let saved: Parameters<Game['start']>[1];
  g.onCheckpoint = (s) => {
    if (s) saved = s;
  };
  g.save();
  assert.equal(saved!.encounters, 1);
  assert(loadCheckpoint(saved));
  const next = new Game();
  next.start('pacing-save', saved);
  assert.equal(next.encounters, 1);
  const { encounters: _, teamwork: ___, ...legacy } = saved!;
  next.start('pacing-save', legacy);
  assert.equal(next.encounters, 0);
  next.start('pacing-save', undefined, null, null, false, 0, true, [], null, 'pistol', 0);
  assert.equal(next.encounters, 0, 'An archived run can restart with its original rules');
  g.setMode('dead');
  const recap = snapshotRun(g, 'pacing-recap')!;
  assert.equal(recap.encounters, 1);
  assert.equal(loadRunHistory([recap])[0].encounters, 1);
  assert.deepEqual(loadRunHistory([{ ...recap, encounters: 2 }]), []);
  const { encounters: __, teamwork: ____, ...oldRecap } = recap;
  assert.equal(loadRunHistory([oldRecap])[0].encounters, undefined);
  next.start(dailyForDate('2026-10-04')!.seed);
  assert.equal(next.encounters, 0);
  next.startWorkshop([]);
  assert.equal(next.encounters, 0);
  next.startPractice({ kind: 'loader', seed: 'pacing-practice' });
  assert.equal(next.encounters, 0);
  assert.equal(loadCheckpoint({ ...saved, encounters: 2 }), null);
  assert.equal(loadCheckpoint({ ...saved, seed: dailyForDate('2026-10-04')!.seed }), null);
});

test('isolated pacing previews support all native guns and jobs without recording Campaign progress', () => {
  for (const query of [
    'room=1&gun=pistol',
    'room=4&gun=shotgun',
    'route=core-defense&gun=nailgun',
  ]) {
    const save = encounterTestFromUrl(new URL('https://test/?test=encounters&' + query))!;
    assert(save);
    assert(loadCheckpoint(save));
    const g = new Game(),
      writes: unknown[] = [];
    g.onCheckpoint = (s) => writes.push(s);
    g.startTest(save);
    g.save();
    assert.equal(g.encounters, 1);
    assert(g.waves.plan);
    assert.deepEqual(writes, []);
  }
  for (const query of [
    'room=0',
    'room=21',
    'gun=laser',
    'v=2',
    'route=core-defense&room=4',
    'seed=a&seed=b',
    'seed=RF-D86-2026-10-04',
    'seed=RF-D86-2026-10-04&daily=1',
  ])
    assert.equal(encounterTestFromUrl(new URL('https://test/?test=encounters&' + query)), null);
});
