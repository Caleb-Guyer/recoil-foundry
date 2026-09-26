import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { getOvertimeLevel } from '../src/overtime.ts';
import { getLevel, type Solid } from '../src/levels.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { loadCheckpoint, getGun } from '../src/rules.ts';
import { overtimeDocksTestFromUrl, overtimeTestFromUrl } from '../src/practice.ts';
import { splitWaves, REINFORCEMENT_TELL } from '../src/reinforcements.ts';
import { hazardBounds } from '../src/hazard-layouts.ts';
import { PROP_STATS } from '../src/props.ts';
import { CARGO_SIZE } from '../src/cargo-layout.ts';
import { COUNTERWEIGHT } from '../src/counterweight-layouts.ts';
const rooms = ['transfer', 'stamping', 'dispatch', 'gantry', 'loader', 'crane'];
const input: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1400, y: 600 },
};
const fixture = (room: string, mirror = false) =>
  overtimeDocksTestFromUrl(
    new URL('https://game.test/?test=overtime-docks&room=' + room + '&mirror=' + Number(mirror)),
  )!;
const game = (room: string, mirror = false) => {
  const g = new Game();
  g.startTest(fixture(room, mirror));
  return g;
};
const overlaps = (a: Solid, b: Solid) =>
  a.x + a.w > b.x + 0.5 && a.x < b.x + b.w - 0.5 && a.y + a.h > b.y + 0.5 && a.y < b.y + b.h - 0.5;

test('new Docks rooms are deterministic, isolated to opted-in Overtime, and keep later areas unchanged', () => {
  const seen = new Set();
  for (let n = 0; n < 24; n++) {
    const seed = 'OT-DOCKS-' + n;
    for (let stage = 0; stage < 20; stage++) {
      const normal = getLevel(seed, stage),
        old = getOvertimeLevel(seed, stage);
      const next = getOvertimeLevel(seed, stage, 1);
      assert.deepEqual(next, getOvertimeLevel(seed, stage, 1));
      assert.deepEqual(normal, getLevel(seed, stage));
      assert.deepEqual(old, getOvertimeLevel(seed, stage, 0));
      if (stage >= 4) assert.deepEqual(next, old);
      else {
        assert(next.overtimeDocks);
        assert.notDeepEqual(next.solids, old.solids);
        seen.add(next.id + ':' + next.mirrored);
        assert.equal(
          Number(!!next.hazards?.length) +
            Number(!!next.counterweights?.length) +
            Number(!!next.setpiece?.cargo?.length),
          1,
        );
      }
    }
  }
  assert.equal(seen.size, 10);
  const a = getOvertimeLevel('OT-DOCKS-0', 0, 1);
  a.spawns[0].x = -10;
  a.solids.length = 0;
  a.setpiece!.props.length = 0;
  assert(getOvertimeLevel('OT-DOCKS-0', 0, 1).solids.length > 0);
  assert.equal(getOvertimeLevel('OT-DOCKS-0', 0, 1).setpiece!.props.length, 1);
});

test('every mirrored spawn, prop and full machinery sweep has authored clearance', () => {
  for (const room of rooms)
    for (const mirror of [false, true]) {
      const g = game(room, mirror),
        level = g.level;
      assert.equal(level.mirrored, mirror, room);
      assert.equal(g.breaches.placement, null);
      assert.equal(g.conveyors.items.length, 0);
      const machinery: Solid[] = [
        ...level.hazards!.map((h) => hazardBounds(h, 44)),
        ...level.counterweights!.map((c) => ({
          x: c.x - c.w / 2 - 12,
          y: c.y - (c.w / 2) * Math.sin(COUNTERWEIGHT.angle) - 35,
          w: c.w + 24,
          h: c.w * Math.sin(COUNTERWEIGHT.angle) + 70,
        })),
        ...level.setpiece!.cargo!.map((c) => ({
          x: c.x - CARGO_SIZE.w / 2 - 5,
          y: c.anchorY,
          w: CARGO_SIZE.w + 10,
          h: 739 - c.anchorY,
        })),
      ];
      for (const m of machinery) {
        assert(m.x > 250 && m.x + m.w < 1750, room);
        assert(!level.solids.some((s) => overlaps(m, s)), room + ' machinery clips terrain');
      }
      for (const s of level.spawns) {
        const { w, h } = ENEMY_STATS[s.kind],
          hull = { x: s.x - w / 2, y: s.y - h / 2, w, h };
        assert(
          ![...level.solids, ...machinery].some((b) => overlaps(hull, b)),
          room + ' ' + s.kind + ' overlaps',
        );
        assert(s.x >= 360 && s.x <= 1640, room + ' entrance safety');
      }
      for (const p of level.setpiece!.props) {
        const { w, h } = PROP_STATS[p.kind],
          hull = { x: p.x - w / 2, y: p.y - h / 2, w, h };
        assert(![...level.solids, ...machinery].some((b) => overlaps(hull, b)), room + ' prop');
      }
    }
});

test('authored squads arrive together after a warning, with finite waves and no reward before clearance', () => {
  for (const room of rooms.slice(0, 4))
    for (const mirror of [false, true]) {
      const g = game(room, mirror);
      const [opening, final] = splitWaves(g.level, g.roomSeed, 8);
      assert(!opening.some((s) => s.squad));
      assert.equal(final.filter((s) => s.squad).length, 2);
      assert.equal(new Set(final.filter((s) => s.squad).map((s) => s.squad!.kind)).size, 1);
      assert(g.enemies.length + g.waves.doors.length <= 12);
      for (const e of [...g.enemies]) g.hitEnemy(e, 1e6);
      g.waves.update(0.01);
      assert.equal(g.waves.phase, 'warning');
      assert(g.waves.doors.every((d) => d.timer === REINFORCEMENT_TELL));
      assert(!g.clear);
      g.waves.update(REINFORCEMENT_TELL - 0.01);
      assert.equal(g.enemies.length, 0);
      g.waves.update(0.02);
      assert.equal(g.enemies.filter((e) => e.squad).length, 2, room);
      for (let n = 0; n < 300 && !g.clear; n++) {
        for (const e of [...g.enemies]) {
          e.spawn = 0;
          g.hitEnemy(e, 1e6);
        }
        g.tick(1 / 60, input);
      }
      assert(g.clear, room + ' all finite reinforcements clear');
    }
});

test('old saves preserve old rooms; new room identities and route choices round-trip exactly', () => {
  const old = overtimeTestFromUrl(new URL('https://game.test/?test=overtime'))!;
  assert.equal(old.overtime!.remix, undefined);
  const previous = new Game();
  previous.start(old.seed, loadCheckpoint(old)!);
  assert.deepEqual(previous.level, getOvertimeLevel(old.seed, 0));
  for (const room of rooms)
    for (const mirror of [false, true]) {
      const save = fixture(room, mirror),
        parsed = loadCheckpoint(save);
      assert(parsed, room);
      assert.equal(parsed.overtime!.remix, 1);
      const g = new Game();
      g.start(parsed.seed, parsed);
      assert(g.level.overtimeDocks);
      assert.deepEqual(g.level, game(room, mirror).level);
      let checkpoint: unknown;
      g.onCheckpoint = (s) => {
        checkpoint = s;
      };
      g.save();
      assert(loadCheckpoint(checkpoint));
      const resumed = new Game();
      resumed.start(save.seed, loadCheckpoint(checkpoint)!);
      assert.deepEqual(resumed.level, g.level);
      assert.deepEqual(resumed.mods, g.mods);
      assert.equal(g.loaderArena.supports.length, room === 'loader' ? 2 : 0);
    }
  for (const remix of [0, 4, -1, '1', true, null])
    assert.equal(loadCheckpoint({ ...old, overtime: { ...old.overtime, remix } }), null);
});

test('test links select all six rooms and mirrors and reject mixed or duplicate parameters', () => {
  for (const room of rooms)
    for (const mirror of [false, true]) {
      const g = game(room, mirror);
      let writes = 0;
      g.onCheckpoint = () => writes++;
      g.onBossDefeated = () => writes++;
      g.save();
      assert.equal(writes, 0);
      const first = structuredClone(g.level);
      g.startTest(fixture(room, mirror));
      assert.deepEqual(g.level, first);
    }
  for (const suffix of [
    '&seed=x',
    '&daily=2026-09-25',
    '&room=bad',
    '&room=transfer&room=transfer',
    '&mirror=2',
    '&mirror=0&mirror=1',
    '&test=overtime-docks',
    '&build=beam',
  ])
    assert.equal(
      overtimeDocksTestFromUrl(new URL('https://game.test/?test=overtime-docks' + suffix)),
      null,
    );
});

test('both actual reward exits retain their remix through the Docks boss and into Furnace', () => {
  for (const choice of ['low', 'high'] as const) {
    const g = game('stamping');
    g.testRun = null;
    let saved: unknown;
    g.onCheckpoint = (s) => {
      saved = s;
    };
    for (let room = 1; room <= 3; room++) {
      for (let frame = 0; frame < 300 && !g.clear; frame++) {
        for (const e of [...g.enemies]) {
          e.spawn = 0;
          g.hitEnemy(e, 1e6);
        }
        g.tick(1 / 60, input);
      }
      assert(g.clear);
      g.openReward(false, room === 1 ? choice : undefined);
      assert.equal(g.mode, 'upgrade');
      assert(loadCheckpoint(saved));
      const offer = g.offers[0].id;
      g.chooseMod(offer);
      assert.equal(g.stage, room + 1);
      assert.equal(g.overtime!.remix, 1);
      assert(loadCheckpoint(saved));
      if (room === 1)
        assert.equal(
          g.level.id,
          choice === 'high' ? 'ot-counterweight-gantry' : 'ot-broken-dispatch',
        );
      if (room === 2) assert(g.level.boss && g.level.overtimeDocks);
      if (room === 3) assert.deepEqual(g.level, getOvertimeLevel(g.seed, 4));
    }
  }
});

test('floor routes remain traversable with the base gun and after cargo drops', () => {
  for (const room of rooms)
    for (const mirror of [false, true]) {
      const g = game(room, mirror);
      for (const e of g.enemies) Matter.Composite.remove(g.engine.world, e.body);
      g.enemies = [];
      g.waves.clear();
      g.waves.held = true;
      g.waves.phase = 'opening';
      g.mods = [];
      g.gun = getGun([]);
      g.hp = 10000;
      g.loaderArena.clear();
      for (const cargo of g.cargo.items) g.cargo.cut(cargo, 1000);
      for (let n = 0; n < 2400 && g.player.position.x < 1820; n++) {
        const p = g.player.position;
        const obstacle = g.solidBodies.some(
          (b) =>
            b.bounds.min.x < p.x + 95 &&
            b.bounds.max.x > p.x + 10 &&
            b.bounds.min.y < p.y + 20 &&
            b.bounds.max.y > p.y - 30,
        );
        g.tick(1 / 60, { ...input, right: true, jump: obstacle && g.grounded });
        assert(Number.isFinite(g.player.position.x));
      }
      assert(
        g.player.position.x >= 1820,
        room + ':' + mirror + ' at ' + JSON.stringify(g.player.position),
      );
    }
});
