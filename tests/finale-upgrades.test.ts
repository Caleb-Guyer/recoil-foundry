import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { finaleTestFromUrl } from '../src/final-arsenal.ts';
import { BRANCH_TEST_BUILDS, withParents } from '../src/branch-builds.ts';
import { UPGRADE_TEST_BUILDS, FUSION_TEST_BUILDS } from '../src/practice.ts';
import { loadCheckpoint } from '../src/rules.ts';
import { ORBIT_TIME } from '../src/fusions.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1450, y: 680 },
};
const builds = {
  melt: BRANCH_TEST_BUILDS['melt-beam'].mods,
  fuse: UPGRADE_TEST_BUILDS.fuse,
  echo: UPGRADE_TEST_BUILDS.afterimage,
  orbit: FUSION_TEST_BUILDS.orbit,
};
function start(build: keyof typeof builds, query = '&attack=sweep', extra: string[] = []) {
  const cp = finaleTestFromUrl(new URL('https://test.invalid/?test=finale&v=3' + query))!;
  cp.mods = withParents(builds[build], ['capacitor', 'reserve-cell', ...extra])!;
  assert(cp.mods);
  cp.missedUpgrades = 19 - cp.mods.length;
  assert(loadCheckpoint(cp), 'Every test gun is a legal Campaign build');
  const g = new Game();
  g.startTest(cp);
  return g;
}
function tick(g: Game, frames: number, input = idle) {
  for (let i = 0; i < frames; i++) g.tick(1 / 60, input);
}
function round(g: Game) {
  return g.addShot({
    pos: { x: 1000, y: 680 },
    vel: { x: 16, y: 0 },
    damage: 100,
    life: 1,
    friendly: true,
    radius: 3,
    bounces: 0,
    pierce: 0,
  });
}
function storeOrbit(g: Game) {
  const shot = round(g);
  assert(shot.recall);
  shot.recall.returning = true;
  g.fusions.catch(shot);
  g.shots = [];
  g.ballistics.charges = 2;
  assert.equal(g.fusions.orbit.length, 1);
}
function stored(g: Game) {
  assert.equal(g.fusions.orbit.length, 1);
  const remaining = ORBIT_TIME - (g.time - g.fusions.orbit[0].at);
  assert(
    remaining > 1.05 && remaining <= ORBIT_TIME + 1e-6,
    'Movies preserve the remaining Orbit release allowance',
  );
  assert.equal(g.ballistics.charges, 2, 'Cinematic cleanup never spends loaded capacitor cells');
}

for (const phase of [1, 2, 3])
  test(`a real Scatter Molten Beam finishes form ${phase} without resetting its live callback into a crash`, () => {
    const g = start('melt', '&phase=' + phase + '&attack=sweep', ['scatter']);
    const e = g.finale.enemy!;
    Matter.Body.setPosition(g.player, { x: 1000, y: 680 });
    Matter.Body.setPosition(e.body, { x: 1450, y: 680 });
    e.hp = 0.000001;
    assert.doesNotThrow(() => tick(g, 10, { ...idle, fire: true }));
    assert.equal(
      g.finale.cinema!.state,
      phase === 1 ? 'airlift' : phase === 2 ? 'core-opening' : 'destruction',
    );
    assert.equal(g.kills, phase === 3 ? 1 : 0);
    assert.equal(g.shots.length, 0);
    assert.equal(g.torch.pulse, null);
  });

test('canceling a lit molten pulse cannot flush Blowout fragments into a transformation', () => {
  const g = start('melt'),
    e = g.finale.enemy!;
  g.melt.beam(
    1,
    0,
    {
      entry: { x: 1110, y: 470 },
      exit: { x: 1140, y: 470 },
      dir: { x: 1, y: 0 },
      normal: { x: 1, y: 0 },
      length: 30,
      gain: 0.65,
    },
    100,
  );
  g.hitEnemy(e, 1e9);
  assert.equal(g.finale.cinema!.state, 'airlift');
  assert.equal(g.shots.length, 0);
  g.melt.flushBeam();
  assert.equal(g.shots.length, 0);
});

for (const kind of ['fuse', 'echo'] as const)
  test(`pending ${kind} attacks cannot jump across the airlift to hit a fresh Siege frame`, () => {
    const g = start(kind),
      e = g.finale.enemy!;
    const shot = round(g);
    if (kind === 'fuse') {
      shot.pos = { ...e.body.position };
      shot.shell = { damage: 100, launch: 0 };
      assert(g.ballistics.stick(shot, e.body));
      assert.equal(g.ballistics.shells.length, 1);
    } else {
      for (let n = 0; n < 4; n++) g.ballistics.record(shot.id - 1, shot.pos, { x: 1, y: 0 });
      assert.equal(g.ballistics.echoes.length, 1);
    }
    g.ballistics.charges = 2;
    const sounds: string[] = [];
    g.onSound = (sound) => sounds.push(sound);
    g.hitEnemy(e, 1e9);
    assert.equal(g.ballistics.shells.length, 0);
    assert.equal(g.ballistics.echoes.length, 0);
    tick(g, 484);
    assert.equal(g.finale.cinema!.state, 'siege');
    assert.equal(e.hp, e.maxHp, 'The new health bar begins without old queued damage');
    assert.equal(g.shots.length, 0);
    assert(!sounds.includes('echo-shot'));
    assert.equal(g.ballistics.charges, 2);
  });

test('a real Fuse finishing hit cannot attach a fresh delayed charge after cinematic cleanup', () => {
  const g = start('fuse'),
    e = g.finale.enemy!;
  e.hp = 0.000001;
  const shot = round(g);
  shot.pos = { x: e.body.position.x - 55, y: e.body.position.y };
  shot.prev = { ...shot.pos };
  shot.shell = { damage: 100, launch: 0 };
  tick(g, 4);
  assert.equal(g.finale.cinema!.state, 'airlift');
  assert.equal(g.ballistics.shells.length, 0);
  assert.equal(g.shots.length, 0);
});

test('Orbit ammunition and loaded cells survive approach, boarding, airlift, movable core, and pause', () => {
  const g = start('orbit', ''),
    e = g.finale.enemy!,
    cinema = g.finale.cinema!;
  storeOrbit(g);
  tick(g, 120);
  assert.equal(cinema.state, 'approach');
  stored(g);
  Matter.Body.setPosition(g.player, { x: cinema.x(1120), y: 718 });
  tick(g, 1);
  assert.equal(cinema.state, 'boarding');
  tick(g, 362);
  assert.equal(cinema.state, 'duel');
  stored(g);
  g.hitEnemy(e, 1e9);
  tick(g, 482);
  assert.equal(cinema.state, 'siege');
  stored(g);
  g.hitEnemy(e, 1e9);
  tick(g, 100, { ...idle, right: true });
  assert.equal(cinema.state, 'core-opening');
  stored(g);
  const hitstopAt = g.fusions.orbit[0].at,
    hitstopTime = g.time;
  g.hitStop = 0.1;
  tick(g, 3);
  assert.equal(g.time, hitstopTime);
  assert.equal(g.fusions.orbit[0].at, hitstopAt, 'Hitstop cannot grant extra Orbit lifetime');
  g.hitStop = 0;
  const heldAt = g.fusions.orbit[0].at,
    time = g.time;
  g.setMode('paused');
  tick(g, 600);
  assert.equal(g.fusions.orbit[0].at, heldAt);
  assert.equal(g.time, time);
  g.setMode('playing');
  tick(g, 382);
  assert.equal(cinema.state, 'rupture');
  stored(g);
  g.fusions.release({ x: 1, y: 0 });
  assert.equal(g.fusions.orbit.length, 0);
  assert.equal(g.shots.length, 1, 'The stored round can still be fired after the movie');
});

for (const first of [0, 1])
  test(`stored ammunition is retained during the ${first ? 'destruction' : 'escape'} movie`, () => {
    const g = start('orbit', '&phase=3&first=' + first),
      e = g.finale.enemy!;
    storeOrbit(g);
    g.hitEnemy(e, 1e9);
    tick(g, first ? 360 : 240);
    assert.equal(g.finale.cinema!.state, first ? 'destruction' : 'escape');
    stored(g);
  });

test('Cinder patches and Crosswind trails leave the movable core scene clean', () => {
  const g = start('melt', '&phase=2', ['cinder', 'crosswind']),
    e = g.finale.enemy!;
  const shot = round(g),
    platform = g.terrain[4];
  shot.pos = { x: platform.position.x, y: platform.bounds.min.y };
  g.salvage.impact(shot, platform, { x: 0, y: -1 });
  g.salvage.trace(shot, { x: 400, y: 600 }, { x: 550, y: 600 });
  assert.equal(g.salvage.cinders.length, 1);
  assert.equal(g.salvage.gusts.length, 1);
  g.hitEnemy(e, 1e9);
  assert.equal(g.finale.cinema!.state, 'core-opening');
  assert.equal(g.salvage.cinders.length, 0);
  assert.equal(g.salvage.gusts.length, 0);
});
