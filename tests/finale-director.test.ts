import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { finaleTestFromUrl } from '../src/final-arsenal.ts';
import { FINALE_DURATIONS, cinemaSolids, finaleFormHealth } from '../src/finale-director.ts';
import { loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import { musicScene } from '../src/music-score.ts';
import { fireWeapon } from '../src/interceptor-weapons.ts';
import { newCampaignSeed } from '../src/run-seed.ts';
import { overtimeSeed } from '../src/overtime.ts';
import { cinematicFinale, transformedFinale } from '../src/boss-progression.ts';
import {
  currentRemixEncounter,
  validRemixIdentity,
  remixEncounters,
} from '../src/boss-remix-rules.ts';
import { testCheckpoint } from '../src/practice.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1450, y: 450 },
};
function checkpoint(query = ''): Checkpoint {
  const cp = finaleTestFromUrl(new URL('https://test.invalid/?test=finale&v=3' + query));
  assert(cp, query);
  assert(loadCheckpoint(cp), query);
  return cp;
}
function start(query = '', isolated = true) {
  const cp = checkpoint(query),
    g = new Game();
  if (isolated) g.startTest(cp);
  else g.start(cp.seed, cp);
  assert(g.finale.cinema);
  return g;
}
function tick(g: Game, frames = 1, input = idle) {
  for (let i = 0; i < frames; i++) g.tick(1 / 60, input);
}
function seconds(g: Game, duration: number, input = idle) {
  tick(g, Math.ceil(duration * 60) + 2, input);
}
function assertHull(g: Game, phase: number) {
  const body = g.finale.enemy!.body;
  // Matter.bounds adds a velocity envelope. The actual collision hull must
  // retain its intended size even after a long, movable transition scene.
  const width =
    Math.max(...body.vertices.map((v) => v.x)) - Math.min(...body.vertices.map((v) => v.x));
  const height =
    Math.max(...body.vertices.map((v) => v.y)) - Math.min(...body.vertices.map((v) => v.y));
  const [expectedWidth, expectedHeight] = [
    [66, 74],
    [110, 105],
    [110, 120],
  ][phase];
  assert(
    Math.abs(width - expectedWidth) < 1e-5,
    `Form ${phase}: width ${width}, expected ${expectedWidth}`,
  );
  assert(
    Math.abs(height - expectedHeight) < 1e-5,
    `Form ${phase}: height ${height}, expected ${expectedHeight}`,
  );
}
function begin(g: Game) {
  const cinema = g.finale.cinema!;
  assert.equal(cinema.state, 'approach');
  Matter.Body.setPosition(g.player, { x: cinema.x(1120), y: 718 });
  tick(g);
  assert.equal(cinema.state, 'boarding');
  seconds(g, FINALE_DURATIONS.boarding);
  assert.equal(cinema.state, 'duel');
  assertHull(g, 0);
}
function breakFirstTwo(g: Game) {
  const e = g.finale.enemy!;
  if (g.finale.cinema!.state === 'approach') begin(g);
  g.hitEnemy(e, 1e9);
  assert.equal(e.hp, 0);
  assert.equal(g.finale.cinema!.state, 'airlift');
  seconds(g, FINALE_DURATIONS.airlift);
  assert.equal(g.finale.cinema!.state, 'siege');
  assertHull(g, 1);
  g.hitEnemy(e, 1e9);
  assert.equal(e.hp, 0);
  assert.equal(g.finale.cinema!.state, 'core-opening');
  seconds(g, FINALE_DURATIONS['core-opening']);
  assert.equal(g.finale.cinema!.state, 'rupture');
  assertHull(g, 2);
}

test('rainy approach is playable, silent, harmless, and only entering the encounter starts boarding', () => {
  for (const mirror of [0, 1]) {
    const g = start('&mirror=' + mirror),
      cinema = g.finale.cinema!,
      e = g.finale.enemy!;
    const startX = g.player.position.x,
      hp = e.hp;
    assert.equal(cinema.state, 'approach');
    assert(e.body.isSensor);
    assert.equal(e.body.collisionFilter.mask, 0);
    g.damagePlayer(9999);
    g.hitEnemy(e, 1e9);
    assert.equal(g.hp, 100);
    assert.equal(e.hp, hp);
    const scene = musicScene(g);
    assert(scene.rain && scene.effectsSilent && scene.musicSilent);
    tick(g, 40, {
      ...idle,
      left: !!mirror,
      right: !mirror,
      fire: true,
      firePressed: true,
      portal: { x: 1500, y: 500 },
    });
    assert(Math.abs(g.player.position.x - startX) > 60, 'The player walks through the rain');
    assert.equal(cinema.state, 'approach');
    assert.equal(g.shots.length, 0);
    assert.equal(e.hp, hp);
    Matter.Body.setPosition(g.player, { x: cinema.x(1120), y: 718 });
    tick(g);
    assert.equal(cinema.state, 'boarding');
    const position = { ...g.player.position },
      elapsed = g.elapsed;
    seconds(g, FINALE_DURATIONS.boarding - 0.2, { ...idle, right: true, fire: true });
    assert.equal(cinema.state, 'boarding');
    assert.deepEqual(g.player.position, position);
    assert.equal(g.elapsed, elapsed, 'Watching a locked cutscene does not charge the run timer');
    seconds(g, 0.3);
    assert.equal(cinema.state, 'duel');
    assert.equal(e.hp, e.maxHp);
    assert(!e.body.isSensor);
    assert(e.body.collisionFilter.mask! > 0);
  }
});

test('three full health bars reach zero separately, rebuild real terrain, and award exactly one final kill', () => {
  const g = start('', false),
    e = g.finale.enemy!,
    cinema = g.finale.cinema!;
  let bossRewards = 0,
    enemyRewards = 0;
  g.onBossDefeated = () => bossRewards++;
  g.onEnemyDefeated = () => enemyRewards++;
  begin(g);
  const base = e.maxHp,
    originalTerrain = g.terrain.slice(4);
  for (const phase of [0, 1]) {
    assert.equal(e.phase, phase);
    assertHull(g, phase);
    assert.equal(e.hp, e.maxHp);
    assert.equal(e.maxHp, finaleFormHealth(base, phase, false));
    fireWeapon(g, e, 'aimed', e.body.position, [0]);
    assert(g.shots.length);
    g.hitEnemy(e, 1e9);
    assert.equal(e.hp, 0, 'Each chassis visibly reaches zero instead of stopping at a threshold');
    assert.equal(g.kills, 0);
    assert.equal(bossRewards, 0);
    assert.equal(enemyRewards, 0);
    assert(g.enemies.includes(e));
    assert(Matter.Composite.allBodies(g.engine.world).includes(e.body));
    assert(!g.clear);
    assert.equal(g.shots.length, 0, 'A destroyed form cannot leave queued projectiles behind');
    g.hitEnemy(e, 1e9);
    assert.equal(e.hp, 0, 'An oversized hit cannot damage the next form during its scene');
    seconds(g, phase === 0 ? FINALE_DURATIONS.airlift : FINALE_DURATIONS['core-opening']);
    assert.equal(cinema.state, phase === 0 ? 'siege' : 'rupture');
    assert.equal(e.hp, e.maxHp);
    assert.equal(e.maxHp, finaleFormHealth(base, phase + 1, false));
    assertHull(g, phase + 1);
    assert.deepEqual(g.level.solids, cinemaSolids(phase + 1, g.level.mirrored));
    assert.equal(g.terrain.length, 4 + g.level.solids.length);
    assert(
      originalTerrain.every((body) => !Matter.Composite.allBodies(g.engine.world).includes(body)),
    );
    for (const body of [g.player, e.body])
      assert(
        !g.terrain.slice(4).some((terrain) => Matter.Collision.collides(body, terrain)),
        'New platforms cannot trap either live hull',
      );
  }
  g.hitEnemy(e, 1e9);
  assert.equal(e.hp, 0);
  assert.equal(cinema.state, 'destruction');
  assert.equal(g.kills, 1);
  assert.equal(bossRewards, 1);
  assert.equal(enemyRewards, 1);
  assert(!g.enemies.includes(e));
  assert(!g.clear);
  seconds(g, FINALE_DURATIONS.destruction - 0.2);
  assert.equal(cinema.state, 'destruction');
  assert(!g.clear && g.mode === 'playing');
  seconds(g, 0.3);
  assert.equal(cinema.state, 'complete');
  assert(g.clear);
  assert.equal(g.mode, 'playing', 'A real Campaign returns control for extraction');
  assert.equal(g.kills, 1);
  assert.equal(bossRewards, 1);
});

test('core opening keeps movement and jumping while damage, weapons, and the next health bar wait', () => {
  const g = start('&phase=2'),
    e = g.finale.enemy!,
    cinema = g.finale.cinema!;
  assert.equal(cinema.state, 'siege');
  g.hitEnemy(e, 1e9);
  assert.equal(cinema.state, 'core-opening');
  const startX = g.player.position.x,
    startElapsed = g.elapsed;
  g.damagePlayer(9999);
  g.hitEnemy(e, 1e9);
  tick(g, 90, { ...idle, right: true, fire: true, firePressed: true });
  assert(
    Math.abs(g.player.position.x - startX) > 120,
    'Player movement continues in the background scene',
  );
  assert.equal(g.hp, 100);
  assert.equal(e.hp, 0);
  assert.equal(g.shots.length, 0);
  assert.equal(g.kills, 0);
  assert(g.elapsed > startElapsed, 'Movable scenes remain part of the run');
  const beforeY = g.player.position.y;
  tick(g, 8, { ...idle, jump: true, jumpHeld: true });
  assert(g.player.position.y < beforeY - 10, 'The player can jump while the city core opens');
  assert.equal(cinema.state, 'core-opening');
  seconds(g, 7);
  assert.equal(cinema.state, 'rupture');
  assert(e.hp > 0 && e.hp === e.maxHp);
  assertHull(g, 2);
});

for (const scene of ['boarding', 'airlift', 'core', 'destruction'] as const)
  test(scene + ' freezes its scene and world when paused, then resumes', () => {
    const g = start('&scene=' + scene),
      cinema = g.finale.cinema!;
    tick(g, 12);
    const before = {
      clock: cinema.clock,
      elapsed: cinema.elapsed,
      time: g.time,
      runTime: g.elapsed,
      position: { ...g.player.position },
      hp: g.hp,
      phase: g.finale.phase,
    };
    g.setMode('paused');
    tick(g, 600, { ...idle, left: true, fire: true });
    assert.deepEqual(
      {
        clock: cinema.clock,
        elapsed: cinema.elapsed,
        time: g.time,
        runTime: g.elapsed,
        position: { ...g.player.position },
        hp: g.hp,
        phase: g.finale.phase,
      },
      before,
    );
    g.setMode('playing');
    tick(g, 12);
    assert(cinema.clock > before.clock);
  });

for (const [first, overtime, ending] of [
  [true, false, 'destruction'],
  [false, false, 'escape'],
  [false, true, 'destruction'],
] as const)
  test(`${first ? 'first clear' : overtime ? 'Overtime' : 'repeat Campaign'} has the correct ending and no early clear`, () => {
    const g = start('&first=' + Number(first) + (overtime ? '&fight=overtime' : '') + '&phase=3');
    const cinema = g.finale.cinema!,
      e = g.finale.enemy!;
    let checkpoints = 0,
      victories = 0;
    g.onCheckpoint = () => checkpoints++;
    g.onBossDefeated = () => victories++;
    assert.equal(cinema.state, 'rupture');
    assert.equal(cinema.firstClear, first);
    g.hitEnemy(e, 1e9);
    assert.equal(cinema.state, ending);
    assert(!g.clear);
    assert.equal(g.mode, 'playing');
    const duration = FINALE_DURATIONS[ending];
    seconds(g, duration - 0.2);
    assert(!g.clear);
    assert.equal(cinema.state, ending);
    seconds(g, 0.3);
    assert.equal(cinema.state, 'complete');
    assert(g.finale.cleared && g.clear);
    assert.equal(g.mode, 'won');
    assert.equal(checkpoints, 0, 'A complete isolated movie test never replaces the saved run');
    assert.equal(victories, 0, 'Cinematic previews do not unlock real Practice victories');
    assert.equal(g.kills, 1);
  });

test('direct scene links load the correct preceding arena and distinguish escape from destruction', () => {
  for (const mirror of [0, 1]) {
    const core = start('&scene=core&mirror=' + mirror);
    assert.equal(core.finale.phase, 1);
    assert.deepEqual(core.level.solids, cinemaSolids(1, !!mirror));
    const airlift = start('&scene=airlift&mirror=' + mirror);
    assert.equal(airlift.finale.phase, 0);
    assert.deepEqual(airlift.level.solids, cinemaSolids(0, !!mirror));
    const escape = start('&scene=escape&first=0&mirror=' + mirror);
    assert.equal(escape.finale.cinema!.state, 'escape');
    assert.equal(escape.finale.phase, 2);
    assert.deepEqual(escape.level.solids, cinemaSolids(2, !!mirror));
  }
});

test('Overtime has larger health pools in all three forms without skipping a warning or a form', () => {
  const g = start(),
    plus = start('&fight=overtime');
  begin(g);
  begin(plus);
  for (const scene of [g, plus]) breakFirstTwo(scene);
  const e = g.finale.enemy!,
    harder = plus.finale.enemy!;
  assert(harder.maxHp > e.maxHp);
  for (const scene of [g, plus]) {
    scene.finale.nextStrike = 0;
    scene.finale.update(0.01);
    assert(scene.finale.strike);
    assert.equal(scene.finale.strike.left, 1.65);
    assert(!scene.finale.strike.fired);
    assert.equal(scene.finale.phase, 2);
  }
});

test('direct form and transition previews retain exact physical hulls through the movable core scene', () => {
  for (const mirror of [0, 1]) {
    for (const phase of [0, 1, 2]) {
      const g = start(
        `&phase=${phase + 1}&mirror=${mirror}` + (phase === 0 ? '&attack=sweep' : ''),
      );
      assertHull(g, phase);
    }
    const boarding = start('&scene=boarding&mirror=' + mirror);
    seconds(boarding, FINALE_DURATIONS.boarding);
    assertHull(boarding, 0);
    const airlift = start('&scene=airlift&mirror=' + mirror);
    seconds(airlift, FINALE_DURATIONS.airlift);
    assertHull(airlift, 1);
    const core = start('&scene=core&mirror=' + mirror),
      hidden = core.finale.enemy!.body;
    const anchor = { ...hidden.position };
    tick(core, 420);
    assert.equal(core.finale.cinema!.state, 'core-opening');
    assert(
      Math.abs(hidden.position.x - anchor.x) < 1 && Math.abs(hidden.position.y - anchor.y) < 1,
      'The disabled chassis stays stationary instead of falling through the background scene',
    );
    seconds(core, 1.1);
    assert.equal(core.finale.cinema!.state, 'rupture');
    assertHull(core, 2);
  }
});

test('revision 97 Campaign, Overtime and remix identities remain distinct from archived revision 96', () => {
  const currentSeed = newCampaignSeed(undefined, () => 12345);
  assert(currentSeed.startsWith('RF-C102-'));
  assert(overtimeSeed(currentSeed).startsWith('RF-C99-OT-'));
  assert(cinematicFinale(currentSeed));
  assert(cinematicFinale(overtimeSeed(currentSeed)));
  const oldSeed = 'RF-C96-ARCHIVED';
  assert(overtimeSeed(oldSeed).startsWith('RF-C96-OT-'));
  assert(transformedFinale(oldSeed) && transformedFinale(overtimeSeed(oldSeed)));
  assert(!cinematicFinale(oldSeed) && !cinematicFinale(overtimeSeed(oldSeed)));
  const archived = new Game();
  archived.start(oldSeed, testCheckpoint(oldSeed, 19));
  assert(archived.finale.active);
  assert.equal(archived.finale.cinema, null);
  assert.equal(archived.finale.state, 'intro');
  for (const id of ['boss-skybridge', 'boss-crossfire'] as const) {
    const encounter = currentRemixEncounter(id);
    assert.equal(encounter.seed, 'RF-C97-REMIX-' + id);
    assert.equal(encounter.kind, 'interceptor');
    for (const revision of [95, 96, 97])
      assert(validRemixIdentity(id, 'interceptor', `RF-C${revision}-REMIX-${id}`));
    assert(validRemixIdentity(id, 'boss', 'REMIX-' + id));
    assert(!validRemixIdentity(id, 'boss', encounter.seed));
    const listed = remixEncounters({ version: 1, seen: [id] }, true);
    for (const old of [
      'REMIX-' + id,
      ...[95, 96, 97].map((revision) => `RF-C${revision}-REMIX-${id}`),
    ])
      assert(
        listed.some((entry) => entry.seed === old),
        `Previously earned Practice identity must remain listed: ${old}`,
      );
    const practice = new Game();
    assert(practice.startPractice(encounter));
    assert(practice.finale.cinema);
  }
});
