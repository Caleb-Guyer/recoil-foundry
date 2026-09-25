import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Enemy, type Input } from '../src/game.ts';
import { CALLER } from '../src/caller.ts';
import { drawCaller, drawCallerWarnings } from '../src/caller-art.ts';
import { fixture, target, wall, round, advance, Body } from './branches-fixture.ts';
import { annexRouteLevel, annexRouteTestFromUrl } from '../src/annex-route.ts';
import { loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import { dailyRegion } from '../src/regions.ts';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 800, y: 300 },
};
function lab(mods: string[] = []) {
  const g = fixture(mods),
    e = g.spawnEnemy('caller', 600, 300)!;
  e.spawn = 0;
  e.timer = 0;
  return { g, e };
}
function step(g: Game, e: Enemy, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) {
    g.time += 1 / 60;
    g.updateEnemy(e, 1 / 60);
  }
}
function until(g: Game, e: Enemy, phase: string) {
  for (let i = 0; i < 300 && e.caller?.phase !== phase; i++) step(g, e, 1 / 60);
  assert.equal(e.caller?.phase, phase);
}

test('Caller records three separate positions, locks them, and fires only at those marks', () => {
  const { g, e } = lab();
  step(g, e, 1 / 60);
  assert.deepEqual(e.caller?.marks, [{ x: 200, y: 300 }]);
  Body.setPosition(g.player, { x: 240, y: 250 });
  step(g, e, CALLER.sample + 0.01);
  Body.setPosition(g.player, { x: 310, y: 180 });
  until(g, e, 'locked');
  assert.deepEqual(e.caller!.marks, [
    { x: 200, y: 300 },
    { x: 240, y: 250 },
    { x: 310, y: 180 },
  ]);
  const marks = structuredClone(e.caller!.marks);
  Body.setPosition(g.player, { x: 1000, y: 550 });
  step(g, e, CALLER.lock - 0.1);
  assert.equal(g.shots.length, 0);
  assert.deepEqual(e.caller!.marks, marks);
  until(g, e, 'firing');
  assert.equal(g.shots.length, 1);
  until(g, e, 'ready');
  assert.equal(g.shots.length, 3);
  for (let i = 0; i < 3; i++) {
    const s = g.shots[i],
      p = marks[i],
      a = Math.atan2(p.y - 300, p.x - 600);
    assert(Math.abs(Math.atan2(s.vel.y, s.vel.x) - a) < 1e-8);
    assert.equal(s.damage, CALLER.damage);
    assert.equal(s.friendly, false);
    assert.deepEqual(s.damageCause, { type: 'shot', enemy: 'caller' });
  }
  assert.equal(e.caller!.marks.length, 0);
  step(g, e, CALLER.recovery - 0.1);
  assert.equal(g.shots.length, 3);
});

test('warnings require visibility and range; existing cover blocks acquisition', () => {
  const { g, e } = lab();
  wall(g, 400, 300, 20, 300);
  step(g, e, 5);
  assert.equal(e.caller!.phase, 'ready');
  assert.equal(g.shots.length, 0);
  const other = lab();
  Body.setPosition(other.g.player, { x: 1850, y: 300 });
  step(other.g, other.e, 5);
  assert.equal(other.e.caller!.phase, 'ready');
});

for (const cover of ['none', 'wall', 'muzzle', 'crate'])
  test('physical playback respects ' + cover, () => {
    const { g, e } = lab();
    until(g, e, 'locked');
    if (cover === 'wall') wall(g, 400, 300, 20, 240);
    if (cover === 'muzzle') wall(g, 578, 300, 8, 240);
    if (cover === 'crate') g.props.spawn('crate', 400, 300);
    until(g, e, 'ready');
    advance(g, 100);
    assert.equal(g.hp < 100, cover === 'none');
    assert.equal(g.shots.length, 0);
  });

test('moving vertically after lock evades all three ordinary rounds', () => {
  const { g, e } = lab();
  until(g, e, 'locked');
  Body.setPosition(g.player, { x: 200, y: 180 });
  until(g, e, 'ready');
  advance(g, 100);
  assert.equal(g.hp, 100);
});

test('recorded rounds traverse portals without changing ownership or multiplying', () => {
  const { g, e } = lab(['fold']);
  Body.setPosition(e.body, { x: 600, y: 600 });
  Body.setPosition(g.player, { x: 600, y: 705 });
  until(g, e, 'locked');
  wall(g, 800, 400, 40, 250);
  assert(g.portals.place({ x: 600, y: 740 }));
  assert(g.portals.place({ x: 780, y: 400 }));
  Body.setPosition(g.player, { x: 300, y: 600 });
  until(g, e, 'ready');
  assert.equal(g.shots.length, 3);
  advance(g, 18);
  assert.equal(g.shots.length, 3);
  for (const s of g.shots) {
    assert(s.pos.x < 780 && Math.abs(s.pos.y - 400) < 1);
    assert(s.vel.x < 0 && Math.abs(s.vel.y) < 1e-8);
    assert.equal(s.damage, CALLER.damage);
    assert(!s.friendly && !s.allied);
  }
});

for (const phase of ['recording', 'locked', 'firing'])
  test('death cancels unfinished Caller shots in ' + phase, () => {
    const { g, e } = lab();
    until(g, e, phase);
    const fired = g.shots.length;
    g.hitEnemy(e, 9999);
    step(g, e, 5);
    assert.equal(g.shots.length, fired, 'already emitted rounds remain physical');
    assert.equal(e.caller, undefined);
  });

for (const change of ['allegiance', 'displacement', 'target removal'])
  test('recording cancels safely after ' + change, () => {
    const { g, e } = lab();
    const ally = g.factions.spawn('runner', { x: 500, y: 300 })!;
    ally.spawn = 0;
    until(g, e, 'locked');
    assert.equal(e.caller!.target, ally.body);
    if (change === 'allegiance')
      (target(g, 1200, 300),
        (e.allied = true),
        g.enemies.splice(g.enemies.indexOf(e), 1),
        g.factions.allies.push(e));
    if (change === 'displacement') Body.setPosition(e.body, { x: 900, y: 300 });
    if (change === 'target removal') g.factions.removeAlly(ally);
    step(g, e, 1 / 60);
    assert.equal(e.caller!.phase, 'ready');
    assert.equal(e.caller!.marks.length, 0);
    assert.equal(g.shots.length, 0);
  });

test('pause, hitstop and freezing preserve the remaining warning time', () => {
  const { g, e } = lab();
  until(g, e, 'locked');
  const clock = e.caller!.clock;
  g.setMode('paused');
  for (let i = 0; i < 120; i++) g.tick(1 / 60, idle);
  assert.equal(e.caller!.clock, clock);
  g.setMode('playing');
  g.hitStop = 0.2;
  g.tick(1 / 60, idle);
  assert.equal(e.caller!.clock, clock);
  g.cryogenic.state(e).frozen = g.time + 3;
  step(g, e, 2);
  assert.equal(e.caller!.clock, clock);
  assert.equal(g.shots.length, 0);
  g.cryogenic.state(e).frozen = 0;
  step(g, e, 0.1);
  assert(e.caller!.clock < clock && g.shots.length === 0);
});

for (const mode of ['dead', 'title', 'won', 'room'] as const)
  test(mode + ' removes all Caller warnings', () => {
    const { g, e } = lab();
    until(g, e, 'locked');
    if (mode === 'room') g.loadRoom();
    else g.setMode(mode);
    assert.equal(e.caller, undefined);
  });

for (const mods of [
  ['spoof'],
  ['spoof', 'cross-talk'],
  ['spoof', 'standing-orders', 'priority-target'],
])
  test(
    mods.join('/') + ': actual gun kill reboots a fresh Caller and damages only reds before expiry',
    () => {
      const { g, e } = lab(mods);
      const red = target(g, 1100, 300);
      until(g, e, 'locked');
      e.hp = 1;
      round(g, { damage: 100 });
      advance(g, 12);
      g.spoof.update();
      const ally = g.factions.allies[0];
      assert(ally && ally.kind === 'caller' && ally.caller === undefined);
      assert.equal(e.caller, undefined);
      Body.setPosition(g.player, { x: 850, y: 300 });
      const hp = g.hp,
        enemyHp = red.hp;
      for (let i = 0; i < 200; i++) {
        g.time += 1 / 60;
        g.factions.beforeStep(1 / 60);
        g.updateShots(1 / 60);
        if (ally.caller?.target) assert.equal(ally.caller.target, red.body);
      }
      assert.equal(ally.attacks, 3);
      assert(red.hp < enemyHp);
      assert.equal(g.hp, hp);
      assert.equal(g.spoof.reboots, 1);
      assert.equal(g.kills, 1);
      g.time = ally.rebootUntil! + 0.01;
      g.factions.beforeStep(0);
      assert(!g.factions.allies.includes(ally));
      assert.equal(ally.caller, undefined);
    },
  );

test('blue Caller ignores relay, spawning and courier targets and never falls back to player', () => {
  const { g, e } = lab();
  g.hitEnemy(e, 9999);
  const ally = g.factions.spawn('caller', { x: 600, y: 300 })!;
  ally.timer = ally.spawn = 0;
  const objective = target(g, 800, 300);
  objective.eventRole = 'relay';
  const arriving = target(g, 900, 300);
  arriving.spawn = 5;
  const courier = target(g, 1000, 300);
  courier.courier = true;
  step(g, ally, 3);
  assert.equal(ally.caller!.phase, 'ready');
  assert.equal(g.shots.length, 0);
});

test('bounded warning state and reduced effects retain readable shapes without text', () => {
  const { g, e } = lab();
  let strokes = 0,
    labels = 0;
  const c = new Proxy(
    {},
    {
      get: (_, key) =>
        key === 'stroke' ? () => strokes++ : key === 'fillText' ? () => labels++ : () => {},
      set: () => true,
    },
  ) as CanvasRenderingContext2D;
  until(g, e, 'locked');
  drawCallerWarnings(c, g);
  drawCaller(c, e, true);
  assert(strokes >= 7 && labels === 0);
  for (let i = 0; i < 3600; i++) {
    step(g, e, 1 / 60);
    g.updateShots(1 / 60);
    assert(e.caller!.marks.length <= 3);
    if (g.hp < 100) g.hp = 100;
  }
  assert(e.attacks > 15);
});

test('Caller is introduced alone in Cable Well and paired with Switchman in Gallery in both mirrors', () => {
  for (const mirror of [false, true]) {
    const well = annexRouteLevel('caller', 9, mirror, 3),
      gallery = annexRouteLevel('caller', 10, mirror, 3);
    assert.equal(well.spawns.filter((e) => e.kind === 'caller').length, 1);
    assert(!well.spawns.some((e) => e.kind === 'switchman'));
    assert.equal(gallery.spawns.filter((e) => e.kind === 'caller').length, 1);
    assert.equal(gallery.spawns.filter((e) => e.kind === 'switchman').length, 1);
    const caller = gallery.spawns.find((e) => e.kind === 'caller')!;
    assert(
      Math.abs(caller.x - gallery.annexStation!.junction.x) >= 45,
      'speaker and recording lamps must clear the junction fixture',
    );
  }
});

test('saved Annex revision preserves old encounters and persists new ones', () => {
  const preset = annexRouteTestFromUrl(new URL('https://test/?test=annex-route&room=well'))!;
  delete preset.annexRouteTest;
  for (const revision of [undefined, 1, 2] as const) {
    const save = { ...preset, annexVersion: revision },
      g = new Game();
    assert(loadCheckpoint(save));
    g.start(save.seed, save);
    assert.equal(
      g.enemies.some((e) => e.kind === 'caller'),
      revision === 2,
    );
    let next: Checkpoint | undefined;
    g.onCheckpoint = (s) => {
      next = s;
    };
    g.save();
    assert(next && loadCheckpoint(next));
    assert.equal(next.annexVersion, revision ?? 1);
    const resumed = new Game();
    resumed.start(next.seed, next);
    assert.deepEqual(resumed.level, g.level);
  }
  for (const bad of [0, 5, '2', null])
    assert.equal(loadCheckpoint({ ...preset, annexVersion: bad }), null);
  for (const ruleset of [80, 81]) {
    const seed = `RF-D${ruleset}-2026-09-01`,
      region = dailyRegion(seed)!;
    assert.equal(
      loadCheckpoint({ ...preset, seed, region, annexVersion: ruleset === 80 ? 2 : 1 }),
      null,
    );
  }
});

// Frozen from 0419cec before adding Caller, including full layout hashes and both regions.
const oldDaily: { seed: string; region: string; rooms: string[]; rewards: string[] }[] = JSON.parse(
  readFileSync(new URL('./fixtures/daily80.json', import.meta.url), 'utf8'),
);
for (const old of oldDaily)
  test(old.seed + ' retains the exact Daily 80 rooms, rosters and forced rewards', () => {
    const g = new Game();
    g.start(old.seed);
    g.areaEvents.state = null;
    g.auditor.state = null;
    assert.equal(g.region, old.region);
    for (let stage = 0; stage < 20; stage++) {
      const hash = createHash('sha256').update(JSON.stringify(g.level)).digest('hex');
      assert.equal(g.level.id + ':' + hash, old.rooms[stage]);
      if (stage === 19) break;
      g.openReward();
      assert.deepEqual(
        g.offers.map((m) => m.id),
        [old.rewards[stage]],
      );
      g.chooseMod(g.offers[0].id);
    }
  });
