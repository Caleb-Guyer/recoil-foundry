import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Input } from '../src/game.ts';
import {
  CombatFeel,
  MAX_COMBAT_IMPACTS,
  MAX_EMBEDDED_NAILS,
  NAIL_LIFETIME,
  enemyPose,
  nailPosition,
  playerPose,
  pumpCycle,
  roundFeel,
} from '../src/combat-feel.ts';
import { combatFeelTestFromUrl } from '../src/combat-feel-test.ts';
import { getGun } from '../src/rules.ts';
import { shotLight } from '../src/projectile-light.ts';
import {
  advance,
  Bodies,
  Body,
  Composite,
  fixture,
  round,
  target,
  wall,
} from './branches-fixture.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1400, y: 300 },
};
function tool(gun: 'pistol' | 'shotgun' | 'nailgun', mods: string[] = []) {
  const g = fixture(mods);
  g.startingGun = gun;
  g.gun = getGun(mods, gun);
  return g;
}

test('native tools have distinct discharge cues and immutable projectile identities', () => {
  for (const [gun, cue, feel, count] of [
    ['pistol', 'shot', undefined, 1],
    ['shotgun', 'shotgun-shot', 'pellet', 5],
    ['nailgun', 'nail-shot', 'nail', 1],
  ] as const) {
    const g = tool(gun),
      cues: string[] = [];
    g.onSound = (s) => cues.push(s);
    g.fire();
    assert.equal(cues[0], cue);
    assert.equal(g.shots.length, count);
    assert(g.shots.every((s) => roundFeel(s) === feel));
    g.startingGun = 'pistol';
    assert(g.shots.every((s) => roundFeel(s) === feel));
  }
});

test('converted shells, mass rounds and torch preserve their original cue and art', () => {
  for (const [mod, cue] of [
    ['shellshock', 'shell-shot'],
    ['mass-driver', 'mass-shot'],
  ] as const) {
    const g = tool('nailgun', [mod]),
      cues: string[] = [];
    g.onSound = (s) => cues.push(s);
    g.fire();
    assert(cues.includes(cue), `${mod}: ${cues}`);
    assert(g.shots.every((s) => roundFeel(s) === undefined));
    assert.equal(g.combatFeel.pumpAt, null);
  }
  const torch = tool('nailgun', ['cutting-torch']);
  torch.fire();
  assert.equal(torch.shots.length, 0);
  assert.equal(torch.combatFeel.pumpAt, null);
});

test('nails embed only on a stopped scenery impact and follow the actual body transform', () => {
  const g = tool('nailgun');
  const surface = wall(g, 500, 300, 30, 140);
  const s = round(g, { feel: 'nail' });
  advance(g, 6);
  assert.equal(s.life, 0);
  assert.equal(g.combatFeel.nails.length, 1);
  const nail = g.combatFeel.nails[0],
    before = nailPosition(nail);
  assert.equal(nail.body, surface);
  assert(
    Math.abs(before.x - surface.bounds.min.x) < 0.01,
    'Nail tip must reach the actual surface',
  );
  Body.translate(surface, { x: 31, y: -22 });
  assert.deepEqual(nailPosition(nail), { x: before.x + 31, y: before.y - 22 });
  Body.setAngle(surface, Math.PI / 2);
  const rotated = nailPosition(nail);
  assert(Math.abs(rotated.x - (surface.position.x - nail.local.y)) < 1e-8);
  assert(Math.abs(rotated.y - (surface.position.y + nail.local.x)) < 1e-8);
});

test('banks and living enemies never receive embedded scenery nails', () => {
  for (const enemy of [false, true]) {
    const g = tool('nailgun', enemy ? [] : ['ricochet']);
    if (enemy) target(g, 500);
    else wall(g, 500, 300, 30, 140);
    round(g, { feel: 'nail' });
    advance(g, 5);
    assert(g.combatFeel.impacts.length > 0);
    assert.equal(g.combatFeel.nails.length, 0);
  }
});

test('nails disappear when their body breaks or the simulation lifetime ends', () => {
  const g = tool('nailgun'),
    b = Bodies.rectangle(500, 300, 30, 140);
  const s = round(g, { feel: 'nail' });
  const f = new CombatFeel();
  f.impact(s, { x: -1, y: 0 }, 0, b);
  f.update(NAIL_LIFETIME - 0.01, [b], () => {});
  assert.equal(f.nails.length, 1);
  f.update(NAIL_LIFETIME, [b], () => {});
  assert.equal(f.nails.length, 0);
  f.impact(s, { x: -1, y: 0 }, 2, b);
  f.update(2, [], () => {});
  assert.equal(f.nails.length, 0);
});

test('visual effects are bounded and consume no gameplay randomness', () => {
  const g = tool('shotgun');
  const reference = tool('shotgun');
  const s = round(g, { feel: 'nail' }),
    b = Bodies.rectangle(500, 300, 30, 140);
  round(reference, { feel: 'nail' });
  for (let i = 0; i < 200; i++) {
    s.pos.x = i * 8;
    g.combatFeel.impact(s, { x: -1, y: 0 }, i / 1000, b);
  }
  assert.equal(g.combatFeel.nails.length, MAX_EMBEDDED_NAILS);
  assert.equal(g.combatFeel.impacts.length, MAX_COMBAT_IMPACTS);
  assert.equal(g.rng(), reference.rng());
  g.shots = reference.shots = [];
  g.fire();
  reference.fire();
  assert.deepEqual(
    g.shots.map((s) => [s.vel, s.damage]),
    reference.shots.map((s) => [s.vel, s.damage]),
  );
});

test('pellet impacts merge close contacts but preserve separate impact sites', () => {
  const g = tool('shotgun'),
    s = round(g, { feel: 'pellet' });
  for (const x of [400, 403, 406, 430]) {
    s.pos.x = x;
    g.combatFeel.impact(s, { x: -1, y: 0 }, 1);
  }
  assert.equal(g.combatFeel.impacts.length, 2);
});

test('metal nail lighting matches the round and converted ammunition keeps its light', () => {
  const g = tool('nailgun'),
    s = round(g, { feel: 'nail' });
  assert.equal(shotLight(s, [])?.color, '#b5d4d0');
  assert.equal(shotLight(s, ['coolant-rounds'])?.color, '#9bdbe5');
  s.charged = true;
  assert.equal(shotLight(s, [])?.color, '#d7ebad');
  s.charged = false;
  s.rail = true;
  assert.equal(roundFeel(s), undefined);
  assert.equal(shotLight(s, [])?.color, '#b7e4ef');
});

test('pause and hitstop freeze poses, embedded nails and the pending pump', () => {
  const g = tool('shotgun'),
    cues: string[] = [];
  g.onSound = (s) => cues.push(s);
  g.fire();
  g.combatFeel.land(g.time, 12);
  const body = wall(g, 500, 300, 30, 140);
  g.combatFeel.impact(round(g, { feel: 'nail' }), { x: -1, y: 0 }, g.time, body);
  const nailBefore = nailPosition(g.combatFeel.nails[0]);
  const pose = playerPose(g, false),
    at = g.combatFeel.pumpAt;
  g.setMode('paused');
  for (let i = 0; i < 60; i++) g.tick(1 / 60, idle);
  assert.deepEqual(playerPose(g, false), pose);
  assert.equal(g.combatFeel.pumpAt, at);
  assert.equal(g.combatFeel.nails.length, 1);
  assert.deepEqual(nailPosition(g.combatFeel.nails[0]), nailBefore);
  g.setMode('playing');
  g.hitStop = 0.2;
  g.tick(1 / 60, idle);
  assert.deepEqual(playerPose(g, false), pose);
  assert.equal(g.combatFeel.pumpAt, at);
  assert(!cues.includes('shotgun-pump'));
  g.combatFeel.update(at!, [], g.onSound);
  g.combatFeel.update(at! + 1, [], g.onSound);
  assert.equal(cues.filter((s) => s === 'shotgun-pump').length, 1);
});

test('room loads clear all presentation state and queued pump audio', () => {
  const g = tool('shotgun');
  g.fire();
  const s = round(g, { feel: 'nail' }),
    b = g.terrain[0];
  g.combatFeel.impact(s, { x: -1, y: 0 }, g.time, b);
  g.combatFeel.land(g.time, 12);
  g.loadRoom();
  assert.equal(g.combatFeel.nails.length, 0);
  assert.equal(g.combatFeel.impacts.length, 0);
  assert.equal(g.combatFeel.pumpAt, null);
  assert.equal(g.combatFeel.landedAt, -100);
});

test('pump animation completes before even the fastest fitting cooldown', () => {
  for (const interval of [0.025, 0.08, 0.55, 1.2]) {
    assert.equal(pumpCycle(0, interval), 0);
    assert.equal(pumpCycle(interval, interval), 0);
    const samples = Array.from({ length: 100 }, (_, i) =>
      pumpCycle((interval * i) / 100, interval),
    );
    assert(samples.some((s) => s > 0.8));
    assert(samples.every((s) => Number.isFinite(s) && s >= 0 && s <= 1));
  }
});

test('player and enemy poses retain physics and reduced effects suppress secondary motion', () => {
  const g = tool('shotgun'),
    e = target(g);
  Body.setVelocity(g.player, { x: 8, y: -9 });
  g.jumpAt = g.time;
  const before = structuredClone({
    player: g.player.position,
    bounds: g.player.bounds,
    velocity: g.player.velocity,
  });
  const jumping = playerPose(g, false);
  assert(jumping.scaleY > 1);
  g.grounded = true;
  g.combatFeel.land(g.time, 12);
  assert(playerPose(g, false).scaleY < 1);
  g.hitEnemy(e, 1, { x: e.body.position.x - 30, y: e.body.position.y });
  assert(enemyPose(e, false).angle > 0);
  assert.deepEqual(playerPose(g, true), { x: 0, y: 0, angle: 0, scaleX: 1, scaleY: 1, stride: 0 });
  assert.equal(enemyPose(e, true).angle, 0);
  assert.deepEqual(
    { player: g.player.position, bounds: g.player.bounds, velocity: g.player.velocity },
    before,
  );
});

test('combat playtest links select native guns without granting unlocks or overwriting a run', () => {
  for (const gun of ['pistol', 'shotgun', 'nailgun']) {
    const save = combatFeelTestFromUrl(new URL(`https://test/?test=combat-feel&gun=${gun}`))!;
    const g = new Game(),
      checkpoints: unknown[] = [],
      milestones: unknown[] = [];
    g.onCheckpoint = (s) => checkpoints.push(s);
    g.onMilestone = (s) => milestones.push(s);
    g.startTest(save);
    assert.equal(g.startingGun, gun);
    g.save();
    assert.deepEqual(checkpoints, []);
    assert.deepEqual(milestones, []);
  }
  for (const query of ['gun=laser', 'gun=shotgun&gun=pistol', 'gun=nailgun&daily=1'])
    assert.equal(combatFeelTestFromUrl(new URL('https://test/?test=combat-feel&' + query)), null);
});
