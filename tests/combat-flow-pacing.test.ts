import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import type { Level, EnemyKind } from '../src/levels.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import {
  combatFlowSeed,
  validCombatFlowSpec,
  type CombatFlowSpec,
} from '../src/combat-flow-rules.ts';
import { encounterPlan, shapeEncounter } from '../src/encounter-pacing.ts';
import { REINFORCEMENT_TELL, splitWaves } from '../src/reinforcements.ts';
import { STARTING_GUN_IDS, type StartingGun } from '../src/starting-guns.ts';
import type { Checkpoint } from '../src/rules.ts';
import { combatFlowTestFromUrl } from '../src/combat-flow-test.ts';
import { playRoom } from './room-pilot.ts';

const spec: CombatFlowSpec = {
  room: 'runtime-test',
  variant: 0,
  beats: [
    [0, 1],
    [2, 3],
    [4, 5],
  ],
  rest: 1,
  deadline: 4,
  cap: 4,
};
function arena(): Level {
  return {
    id: 'combat-flow-runtime-test',
    name: 'Runtime test',
    area: 'furnace',
    boss: false,
    mirrored: false,
    solids: [],
    hazards: [],
    vents: [],
    counterweights: [],
    route: [{ x: 1880, y: 716 }],
    combatFlow: structuredClone(spec),
    spawns: [
      { kind: 'runner', x: 600, y: 723 },
      { kind: 'shooter', x: 870, y: 724 },
      { kind: 'repairer', x: 1150, y: 724, teamwork: true },
      { kind: 'shooter', x: 1350, y: 724, teamwork: true },
      { kind: 'mortar', x: 1600, y: 722 },
      { kind: 'runner', x: 1770, y: 723 },
    ],
    setpiece: { rosters: [[0, 1, 2, 3, 4, 5]], props: [], weak: [] },
  };
}
function checkpoint(seed = 'RF-C99-FLOW-RUNTIME', gun: StartingGun = 'pistol'): Checkpoint {
  return {
    version: 6,
    seed,
    stage: 5,
    startingGun: gun,
    hp: 100,
    mods: [],
    kills: 0,
    elapsed: 0,
    encounters: 1,
    teamwork: 1,
  };
}
function fixture(seed = 'RF-C99-FLOW-RUNTIME', gun: StartingGun = 'pistol') {
  const g = new Game();
  g.startTest(checkpoint(seed, gun), arena());
  return g;
}
function step(g: Game, n = 1) {
  for (let i = 0; i < n; i++) {
    g.time += 1 / 60;
    g.waves.update(1 / 60);
  }
}
function killAll(g: Game) {
  for (const e of [...g.enemies]) g.hitEnemy(e, 999999, undefined, false, false);
  g.hitStop = 0;
}
function nextWarning(g: Game) {
  const beat = g.waves.flowBeat;
  for (let i = 0; i < 1200 && g.waves.flowBeat === beat; i++) step(g);
  assert.equal(g.waves.phase, 'warning');
  assert.equal(g.waves.flowBeat, Number(beat) + 1);
}
function currentDoors(g: Game) {
  return g.waves.doors.filter((d) => d.flowBeat === g.waves.flowBeat);
}
function enemy(g: Game, kind: EnemyKind, x = 850, y = 600): Enemy {
  const e = g.spawnEnemy(kind, x, y)!;
  e.spawn = 0;
  e.timer = 10;
  return e;
}
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1200, y: 300 },
};

test('Flow metadata validates exact complete three-cohort schedules and owns only revision 99 onward', () => {
  assert(combatFlowSeed('RF-C99-X'));
  assert(combatFlowSeed('RF-C100-X'));
  for (const seed of ['RF-C98-X', 'RF-C97-X', 'RF-D99-2026-10-24', '99', ''])
    assert(!combatFlowSeed(seed));
  assert(validCombatFlowSpec(spec, 6));
  for (const bad of [
    {
      ...spec,
      beats: [
        [0, 1],
        [2, 3],
        [4, 4],
      ],
    },
    {
      ...spec,
      beats: [
        [0, 1],
        [2, 3],
        [4, 6],
      ],
    },
    { ...spec, beats: [[0, 1], [2, 3], [4]] },
    { ...spec, beats: [[0, 1], [], [2, 3, 4, 5]] },
    {
      ...spec,
      beats: [
        [0, 1],
        [2, 3, 4, 5],
      ],
    },
    { ...spec, rest: 0 },
    { ...spec, rest: Infinity },
    { ...spec, deadline: NaN },
    { ...spec, deadline: 0 },
    { ...spec, cap: 1 },
    { ...spec, variant: '0' },
    { ...spec, room: '../elsewhere' },
    { ...spec, extra: true },
    { ...spec, overlap: 2 },
  ])
    assert(!validCombatFlowSpec(bad, 6), JSON.stringify(bad));
});

test('authored opening, exact reserve order and tags survive splitting without random formations', () => {
  const level = arena(),
    before = structuredClone(level);
  const [opening, reserve] = splitWaves(level, 'RF-C99-ROSTER', 5);
  assert.deepEqual(opening, level.spawns.slice(0, 2));
  assert.deepEqual(reserve, level.spawns.slice(2));
  assert.deepEqual(level, before);
  const plan = encounterPlan(level, 'RF-C99-ROSTER', 5);
  shapeEncounter(opening, reserve, level, plan);
  assert.deepEqual([...opening, ...reserve], level.spawns);
  assert(plan.flow);
  assert.equal(plan.spacing, 0);
  const g = fixture();
  assert.equal(g.waves.flowBeat, 0);
  assert.equal(g.enemies.length, 2);
  assert.deepEqual(
    g.waves.doors.map((d) => d.flowBeat),
    [1, 1, 2, 2],
  );
  assert(g.waves.doors.every((d) => d.state === 'sealed'));
});

test('legacy seeds ignore Flow metadata and retain their ordinary seeded split and admission plan', () => {
  for (const seed of ['RF-C98-FLOW-RUNTIME', 'RF-C97-FLOW-RUNTIME', 'RF-D98-2026-10-24']) {
    const level = arena(),
      ordinary = structuredClone(level);
    delete ordinary.combatFlow;
    assert.deepEqual(splitWaves(level, seed, 5), splitWaves(ordinary, seed, 5));
    const flowPlan = encounterPlan(level, seed, 5),
      oldPlan = encounterPlan(ordinary, seed, 5);
    assert.deepEqual(flowPlan, oldPlan);
    const a = splitWaves(level, seed, 5),
      b = splitWaves(ordinary, seed, 5);
    shapeEncounter(a[0], a[1], level, flowPlan);
    shapeEncounter(b[0], b[1], ordinary, oldPlan);
    assert.deepEqual(a, b);
    const g = fixture(seed);
    assert.equal(g.waves.flowBeat, null);
    assert(!g.waves.plan?.flow);
  }
});

test('each reserve cohort gets its own rest, complete door tell and normal entry protection', () => {
  const g = fixture();
  let warnings = 0;
  g.onSound = (k) => {
    if (k === 'reinforce') warnings++;
  };
  killAll(g);
  step(g);
  assert.equal(g.waves.flow!.rest, 1);
  assert(g.waves.pending);
  assert(!g.clear);
  step(g, 59);
  assert.equal(g.waves.flowBeat, 0);
  assert(g.waves.doors.every((d) => d.state === 'sealed'));
  nextWarning(g);
  assert.equal(warnings, 1);
  assert(currentDoors(g).every((d) => Math.abs(d.timer - REINFORCEMENT_TELL) < 1e-8));
  step(g, 44);
  assert.equal(g.enemies.length, 0);
  assert(g.waves.pending);
  step(g);
  assert.equal(g.enemies.length, 2);
  assert.equal(g.waves.phase, 'opening');
  assert(g.enemies.every((e) => e.fromDoor && e.spawn === 0.65 && e.timer >= 0.75));
  assert.equal(g.enemies.filter((e) => e.kind === 'repairer').length, 1);
  assert(g.teamwork.sources.has(g.enemies.find((e) => e.kind === 'repairer')!));
  assert(g.waves.doors.filter((d) => d.flowBeat === 2).every((d) => d.state === 'sealed'));
  killAll(g);
  nextWarning(g);
  assert.equal(warnings, 2);
  assert(currentDoors(g).every((d) => Math.abs(d.timer - REINFORCEMENT_TELL) < 1e-8));
  step(g, 44);
  assert.equal(g.enemies.length, 0);
  step(g);
  assert.equal(g.enemies.length, 2);
  assert.equal(g.waves.phase, 'final');
  assert(!g.waves.pending);
  killAll(g);
  step(g);
  assert.equal(g.waves.phase, 'done');
  assert.equal(g.kills, 6);
});

test('a fair deadline starts each cohort independently and the living-enemy cap holds a ready group', () => {
  const g = fixture();
  nextWarning(g);
  step(g, 45);
  assert.equal(g.enemies.length, 4);
  assert.equal(g.waves.flowBeat, 1);
  step(g, 60);
  assert.equal(g.waves.flowBeat, 1, 'The first deadline must not release every reserve');
  nextWarning(g);
  step(g, 45);
  assert.equal(g.enemies.length, 4);
  assert.equal(g.waves.phase, 'warning');
  assert(currentDoors(g).every((d) => d.state === 'warning' && d.timer === 0));
  g.hitEnemy(g.enemies[0], 999999, undefined, false, false);
  g.hitStop = 0;
  step(g);
  assert.equal(g.enemies.length, 3, 'The cap must make room for the whole two-unit cohort');
  g.hitEnemy(g.enemies[0], 999999, undefined, false, false);
  g.hitStop = 0;
  step(g);
  assert.equal(g.enemies.length, 4);
  assert.equal(g.waves.phase, 'final');
  assert.equal(g.waves.flowBeat, 2);
});

test('a blocked partner holds the whole support cohort, then admits both on the same update', () => {
  const g = fixture();
  killAll(g);
  nextWarning(g);
  Matter.Body.setPosition(g.player, { x: 1350, y: 724 });
  step(g, 55);
  assert.equal(g.enemies.length, 0);
  assert(currentDoors(g).every((d) => d.state === 'warning'));
  Matter.Body.setPosition(g.player, { x: 140, y: 700 });
  step(g);
  assert.equal(g.enemies.length, 2);
  assert.deepEqual(
    g.enemies.map((e) => e.kind),
    ['repairer', 'shooter'],
  );
  assert(g.enemies.every((e) => e.spawn === 0.65));
  assert.equal(g.waves.phase, 'opening');
});

test('relocation uses authored anchors and grants a new complete warning before the pair arrives', () => {
  const g = fixture();
  killAll(g);
  const cover = g.props.spawn('cover', 1350, 697);
  nextWarning(g);
  step(g, 78);
  assert.equal(g.enemies.length, 0);
  const moved = currentDoors(g).find((d) => d.spawn.kind === 'shooter')!;
  assert.notEqual(moved.spawn.x, 1350);
  assert(moved.timer > 0 && moved.timer <= REINFORCEMENT_TELL);
  const remaining = moved.timer;
  step(g, Math.max(0, Math.ceil(remaining * 60) - 1));
  assert.equal(g.enemies.length, 0);
  step(g, 2);
  assert.equal(g.enemies.length, 2);
  g.props.remove(cover);
});

test('pause, impact stop, terminal states and retry cannot advance or leak queued cohorts', () => {
  const g = fixture();
  killAll(g);
  nextWarning(g);
  step(g, 10);
  const snapshot = () =>
    JSON.stringify({
      flow: g.waves.flow,
      doors: g.waves.doors,
      phase: g.waves.phase,
      time: g.waves.openingTime,
    });
  const before = snapshot();
  g.setMode('paused');
  step(g, 120);
  assert.equal(snapshot(), before);
  g.setMode('playing');
  g.hitStop = 0.2;
  step(g, 120);
  assert.equal(snapshot(), before);
  g.hitStop = 0;
  g.setMode('dead');
  step(g, 120);
  assert.equal(snapshot(), before);
  g.encounterPacer.flowRecoveryUntil = 10000;
  g.startTest(checkpoint(), arena());
  assert.equal(g.waves.flowBeat, 0);
  assert.equal(g.enemies.length, 2);
  assert(g.waves.doors.every((d) => d.state === 'sealed'));
  assert.equal(g.encounterPacer.flowRecoveryUntil, 0);
  g.loadRoom(false, true);
  assert(g.clear);
  assert(!g.waves.pending);
  assert.equal(g.waves.flowBeat, null);
  assert.deepEqual(g.waves.doors, []);
  assert(!g.encounterPacer.active);
});

test('real Game clearance waits through both empty rest windows and awards no isolated progress', () => {
  const g = fixture();
  let saves = 0,
    awards = 0;
  g.onCheckpoint = () => saves++;
  g.onCommendation = () => awards++;
  for (let beat = 0; beat < 3; beat++) {
    killAll(g);
    g.tick(1 / 60, idle);
    if (beat < 2) {
      assert(!g.clear);
      assert(g.waves.pending);
      nextWarning(g);
      step(g, 45);
      assert.equal(g.enemies.length, 2);
    } else assert(g.clear);
  }
  assert.equal(g.kills, 6);
  assert.equal(saves, 0);
  assert.equal(awards, 0);
  assert.deepEqual(g.mods, []);
});

test('Flow admits new heavy tells after arrival and machinery warnings without retiming an existing charge', () => {
  const g = fixture();
  killAll(g);
  const e = enemy(g, 'charger');
  const door = g.waves.doors[0];
  door.state = 'warning';
  door.timer = 0.75;
  assert(!g.encounterPacer.request(e, true, 1));
  door.state = 'sealed';
  const hazard = g.hazards.spawn({ kind: 'crusher', x: 350, y: 430, w: 104, h: 32, travel: 278 });
  hazard.state = 'warning';
  assert(!g.encounterPacer.request(e, true, 1));
  g.hazards.clear();
  assert(g.encounterPacer.request(e, true, 1));
  e.state = 'windup';
  e.timer = 0.7;
  door.state = 'warning';
  g.updateEnemy(e, 1 / 60);
  assert(Math.abs(e.timer - (0.7 - 1 / 60)) < 1e-8, 'An admitted warning keeps its original clock');
});

test('an airborne mortar shell reserves the heavy lane but permits one bounded light answer', () => {
  const g = fixture();
  killAll(g);
  const mortar = enemy(g, 'mortar', 1100, 720),
    heavy = enemy(g, 'charger', 800, 600),
    light = enemy(g, 'shooter', 600, 300);
  g.patrolMachines.shells.push({
    owner: mortar.id,
    arc: {
      from: { x: 1100, y: 700 },
      to: { x: 140, y: 720 },
      height: 200,
      duration: 1,
      radius: 100,
      damage: 12,
    },
    age: 0,
    pos: { x: 700, y: 300 },
    previous: { x: 710, y: 300 },
  });
  assert(!g.encounterPacer.request(heavy, true, 1));
  assert(g.encounterPacer.request(light, false, 0.7));
  assert(!g.encounterPacer.request(mortar, true, 1));
  g.patrolMachines.shells = [];
  g.encounterPacer.clear();
  assert(g.encounterPacer.request(heavy, true, 1));
});

test('all six tools retain a bounded counterattack opening, and admission resumes after the quiet beat', () => {
  for (const gun of STARTING_GUN_IDS) {
    const g = fixture('RF-C99-FLOW-RUNTIME', gun);
    killAll(g);
    const charger = enemy(g, 'charger'),
      next = enemy(g, 'shooter', 650, 300);
    charger.state = 'recover';
    charger.timer = 0.1;
    g.encounterPacer.recovery(charger, 'windup');
    assert(charger.timer >= 0.35 && charger.timer <= 0.85, gun);
    assert(!g.encounterPacer.request(next, false, 0.7));
    g.time += 0.23;
    assert(g.encounterPacer.request(next, false, 0.7));
    const until = g.encounterPacer.grants.get(next.id)!.until;
    g.encounterPacer.recovery(charger, 'recover');
    assert.equal(g.encounterPacer.grants.get(next.id)!.until, until);
  }
});

test('a taller reserve keeps the authored foot line when relocating from a player-occupied deck', () => {
  const level = arena();
  level.spawns[4] = { kind: 'shutter', x: 1600, y: 720 };
  const g = new Game();
  g.startTest(checkpoint(), level);
  killAll(g);
  nextWarning(g);
  step(g, 45);
  killAll(g);
  nextWarning(g);
  Matter.Body.setPosition(g.player, { x: 1600, y: 720 });
  step(g, 77);
  assert.equal(g.enemies.length, 0);
  const relocated = currentDoors(g).find((d) => d.spawn.kind === 'shutter')!;
  assert.notEqual(relocated.spawn.x, 1600);
  const anchor = g.level.spawns.find((s) => s.x === relocated.spawn.x)!;
  assert.equal(
    relocated.spawn.y + ENEMY_STATS.shutter.h / 2,
    anchor.y + ENEMY_STATS[anchor.kind].h / 2,
  );
  assert(relocated.timer > 0 && relocated.timer <= REINFORCEMENT_TELL);
  assert(g.waves.canEnter(relocated.spawn));
  const remaining = relocated.timer;
  step(g, Math.max(0, Math.ceil(remaining * 60) - 1));
  assert.equal(g.enemies.length, 0);
  step(g, 2);
  assert.equal(g.enemies.length, 2);
  assert.equal(g.waves.phase, 'final');
});

test('the mirrored Upper Return native Twinbore encounter cannot strand a final machine at a cleared perch', () => {
  const cp = combatFlowTestFromUrl(
    new URL(
      'https://test/?test=flow&room=upper-return&variant=1&mirror=1&gun=twinbore&build=native&v=1',
    ),
  )!;
  const g = new Game();
  g.startTest(cp);
  playRoom(g, 90);
  assert(
    g.clear,
    'A player resting at the last defeated patrol must not prevent the final cohort from entering',
  );
  assert.equal(g.kills, g.level.spawns.length);
  assert(!g.waves.pending);
});
