import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { FREIGHT, FREIGHT_LAYOUT, FREIGHT_STOPS, freightSelected } from '../src/freight-layout.ts';
import { getLevel } from '../src/levels.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { testCheckpoint, freightTestFromUrl } from '../src/practice.ts';
import { getGun, loadCheckpoint } from '../src/rules.ts';
import { dailyForDate } from '../src/daily.ts';
import { REINFORCEMENT_TELL } from '../src/reinforcements.ts';
import { CARGO_TELL } from '../src/cargo.ts';
import { freightPilot } from './freight-pilot.ts';
const { Body, Bodies, Composite, Query } = Matter;
const base = 'https://caleb-guyer.github.io/recoil-foundry/';
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1500, y: 500 },
};
function step(g: Game, n = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, { ...idle, ...input });
}
function fixture(quiet = false) {
  const g = new Game();
  g.startTest(freightTestFromUrl(new URL('?test=freight', base))!);
  if (quiet) {
    g.waves.clear();
    g.freight.wave = 2;
    g.freight.state = 'rising';
  }
  return g;
}
function until(g: Game, predicate: () => boolean, limit = 600) {
  for (let i = 0; i < limit && !predicate(); i++) step(g);
  assert(
    predicate(),
    `Timed out: ${g.freight.state}, top ${g.freight.top}, wave ${g.freight.wave}`,
  );
}

test('freight replaces only the second furnace room sparsely and preserves its seven enemies and single reward slot', () => {
  let selected = 0;
  const before = JSON.stringify(FREIGHT_LAYOUT);
  for (let i = 0; i < 300; i++)
    for (let stage = 0; stage < 16; stage++) {
      const seed = 'freight-select-' + i,
        l = getLevel(seed, stage);
      assert.equal(!!l.freight, freightSelected(seed, stage));
      if (!l.freight) continue;
      selected++;
      assert.equal(stage, 5);
      assert.equal(l.spawns.length, 7);
      assert(!l.boss && !l.detour);
      assert.deepEqual(l, getLevel(seed, stage));
      assert.equal(getLevel(seed, 6).id, 'stamping-line');
      assert(getLevel(seed, 7).boss);
      for (const s of l.spawns) {
        const { w, h } = ENEMY_STATS[s.kind];
        for (const b of l.solids)
          assert(
            !(
              s.x + w / 2 > b.x &&
              s.x - w / 2 < b.x + b.w &&
              s.y + h / 2 > b.y &&
              s.y - h / 2 < b.y + b.h
            ),
          );
      }
    }
  assert(selected > 40 && selected < 95);
  assert.equal(JSON.stringify(FREIGHT_LAYOUT), before);
});

test('lift gives a full departure warning, carries player and crate through the ceiling of ordinary rooms, and docks once', () => {
  const g = fixture();
  step(g);
  assert.equal(g.freight.state, 'warning');
  const start = g.freight.top;
  step(g, Math.floor(FREIGHT.tell * 60) - 2);
  assert.equal(g.freight.top, start);
  g.waves.clear();
  g.freight.wave = 2;
  const crate = g.props.items.find((p) => p.kind === 'crate')!;
  let highest = 700;
  for (let i = 0; i < 2600 && !g.freight.arrived; i++) {
    step(g);
    highest = Math.min(highest, g.player.position.y);
    assert(Math.abs(g.player.position.y + 18 - g.freight.top) < 1);
    assert(Math.abs(crate.body.position.y + 22 - g.freight.top) < 2);
    assert.equal(g.hp, 100);
  }
  assert(g.freight.arrived);
  assert(highest < -930);
  assert(g.clear);
  assert.equal(g.freight.top, FREIGHT.dock);
  step(g, 60);
  assert.equal(g.freight.top, FREIGHT.dock);
  assert.equal(g.mode, 'playing');
});

test('three boarding waves warn separately, instantiate exactly seven enemies and cannot clear the room before docking', () => {
  const g = fixture(),
    seen = new Set<number>(),
    warnings = new Map<object, number>();
  for (let i = 0; i < 3400 && !g.clear; i++) {
    for (const d of g.waves.doors)
      if (d.state === 'warning' && !warnings.has(d)) warnings.set(d, g.time);
    for (const e of [...g.enemies]) {
      seen.add(e.id);
      if (e.spawn <= 0) g.hitEnemy(e, 99999);
    }
    step(g);
    if (!g.freight.arrived) assert(!g.clear);
  }
  assert(g.clear && g.freight.arrived);
  assert.equal(seen.size, 7);
  assert.equal(g.kills, 7);
  assert.equal(warnings.size, 7);
  assert.equal(g.freight.wave, 2);
  assert(g.elapsed >= 39 && g.elapsed < 60);
});

test('a live boarding wave stops the lift nearby, and killing the last enemy resumes its ascent', () => {
  const g = fixture();
  g.updateEnemy = () => {};
  until(g, () => g.freight.state === 'waiting', 800);
  assert.equal(g.freight.top, FREIGHT_STOPS[0] + 20);
  assert.equal(g.enemies.length, 2);
  const top = g.freight.top;
  step(g, 180);
  assert.equal(g.freight.top, top);
  assert(!g.clear);
  for (const e of g.enemies) e.spawn = 0;
  for (const e of [...g.enemies]) g.hitEnemy(e, 99999);
  step(g, 10);
  assert(g.freight.top < top - 2);
});

test('boarding doors give their full warning and a runner physically reaches the moving deck', () => {
  const g = fixture();
  until(g, () => g.waves.doors.some((d) => d.state === 'warning'));
  const began = g.time;
  step(g, Math.floor(REINFORCEMENT_TELL * 60) - 2);
  assert.equal(g.enemies.length, 0);
  until(g, () => g.enemies.length === 2);
  assert(g.time - began >= REINFORCEMENT_TELL - 1 / 60 - 0.001);
  const runner = g.enemies.find((e) => e.kind === 'runner')!;
  until(g, () => g.hazards.supported(runner.body, g.freight.lift!.body), 480);
  assert(runner.body.position.x > FREIGHT.x - FREIGHT.w / 2);
  assert(runner.hp > 0);
  assert(g.hp > 0);
});

test('falling behind brakes the lift; a normal jump from a side ledge catches it again', () => {
  for (const side of [-1, 1]) {
    const g = fixture(true);
    until(g, () => g.freight.top < 460);
    Body.setPosition(g.player, { x: 1000 + side * 440, y: 502 });
    Body.setVelocity(g.player, { x: 0, y: 0 });
    step(g, 20);
    const top = g.freight.top;
    assert.equal(g.freight.state, 'waiting');
    step(g, 30);
    assert.equal(g.freight.top, top);
    const move = { right: side < 0, left: side > 0 };
    step(g, 1, { jump: true, ...move });
    step(g, 28, move);
    step(g, 55);
    assert(g.player.position.x > 640 && g.player.position.x < 1360);
    assert(g.freight.top < top - 10);
    assert.equal(g.hp, 100);
  }
});

test('a floor fall stays recoverable with ordinary side steps and recoil, without moving the lift through the player', () => {
  const g = fixture(true);
  until(g, () => g.freight.top < 450);
  Body.setPosition(g.player, { x: 605, y: 722 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  step(g, 10);
  const top = g.freight.top;
  for (let i = 0; i < 300; i++) {
    const p = g.player.position,
      below = p.y + 18 > g.freight.top + 20;
    step(g, 1, {
      jump: g.grounded,
      right: p.x < 740 && p.y < top - 35,
      left: p.x > 610 && below,
      fire: below,
      aim: { x: p.x, y: p.y + 400 },
    });
    if (g.grounded && g.player.position.x > 640 && g.player.position.y < top) break;
  }
  assert(g.player.position.y < top);
  assert.equal(g.hp, 100);
});

test('riders and stacks stop safely below solid ceilings and resume when the obstruction is removed', () => {
  const g = fixture(true);
  const ceiling = Bodies.rectangle(1000, 500, 1000, 22, { isStatic: true });
  g.terrain.push(ceiling);
  Composite.add(g.engine.world, ceiling);
  until(g, () => g.freight.state === 'waiting');
  const top = g.freight.top;
  step(g, 120);
  assert.equal(g.freight.top, top);
  assert(g.player.position.y - 18 >= 511 - 1);
  assert.equal(g.hp, 100);
  Composite.remove(g.engine.world, ceiling);
  g.terrain = g.terrain.filter((b) => b !== ceiling);
  step(g, 20);
  assert(g.freight.top < top - 5);
});

test('suspended cargo has clear cables, keeps its warning, and can crush boarding enemies on the maintenance ledge', () => {
  const g = fixture();
  g.updateEnemy = () => {};
  until(g, () => g.enemies.length === 2);
  const load = g.cargo.items[0],
    target = g.enemies.find((e) => e.kind === 'runner')!;
  target.spawn = 0;
  Body.setPosition(target.body, { x: 530, y: 504 });
  g.cargo.cut(load, 48);
  const y = load.body.position.y;
  step(g, Math.floor(CARGO_TELL * 60) - 1);
  assert.equal(load.cargo!.state, 'warning');
  assert.equal(load.body.position.y, y);
  step(g, 50);
  assert.equal(load.cargo!.state, 'loose');
  assert(target.hp <= 0);
  assert(g.props.items.includes(load));
  assert(Math.abs(load.body.position.y + 28 - 520) < 2);
  assert.equal(g.hp, 100);
});

test('shots, fuel and portals work above the old world ceiling while the moving deck cannot host a portal', () => {
  const g = fixture(true);
  g.mods = ['fold'];
  g.gun = getGun(g.mods);
  g.hazards.movePlatform(g.freight.lift!, -600);
  Body.setPosition(g.player, { x: 1000, y: -618 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  const fuel = g.props.spawn('canister', 1100, -620);
  step(g, 10);
  assert(fuel.body.position.y < 0);
  assert(!g.portals.place({ x: 1000, y: g.freight.top }));
  assert(g.portals.place({ x: 400, y: -740 }));
  assert(g.portals.place({ x: 1500, y: -560 }));
  g.spawnEnemy('shooter', 1250, -700);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.timer = 100;
  g.aim = { ...e.body.position };
  g.fire();
  step(g, 25);
  assert(e.hp < e.maxHp);
  assert(g.player.position.y < 0);
  assert(g.terrain[3].bounds.max.y === FREIGHT.top);
});

test('pause and hitstop freeze departure, doors, cargo and lift motion', () => {
  const g = fixture();
  until(g, () => g.waves.doors.some((d) => d.state === 'warning'));
  const snap = () =>
    JSON.stringify({
      top: g.freight.top,
      time: g.time,
      doors: g.waves.doors,
      player: g.player.position,
    });
  const before = snap();
  g.setMode('paused');
  step(g, 120);
  assert.equal(snap(), before);
  g.setMode('playing');
  g.hitStop = 0.2;
  step(g, 6);
  assert.equal(snap(), before);
});

test('Continue and Daily reconstruct the entrance, full cargo and all three waves with no saved transient motion', () => {
  let daily = '';
  for (let day = 1; day < 29; day++) {
    const seed = dailyForDate('2026-09-' + String(day).padStart(2, '0'))!.seed;
    if (freightSelected(seed, 5)) {
      daily = seed;
      break;
    }
  }
  assert(daily);
  for (const seed of ['FREIGHT-RIDE-2', daily]) {
    const save = testCheckpoint(seed, 5),
      g = new Game();
    g.start(seed, save);
    step(g, 100);
    const restored = new Game();
    restored.start(seed, loadCheckpoint(JSON.parse(JSON.stringify(save)))!);
    assert(restored.level.freight);
    assert.equal(restored.freight.top, FREIGHT.start);
    assert.equal(restored.freight.wave, -1);
    assert(restored.waves.doors.every((d) => d.state === 'sealed'));
    assert(
      restored.cargo.items.every((p) => p.cargo!.state === 'hanging' && p.cargo!.cableHp === 48),
    );
    assert.deepEqual(restored.mods, save.mods);
  }
});

test('freight test links are isolated, restart correctly and reject mixed modes', () => {
  const save = freightTestFromUrl(new URL('?test=freight', base))!;
  assert(save);
  const g = new Game();
  let writes = 0;
  g.onCheckpoint = () => writes++;
  g.startTest(save);
  step(g, 120);
  g.startTest(g.testRun!);
  assert(g.freight.active);
  assert.equal(g.freight.top, 700);
  assert.equal(writes, 0);
  assert.equal(g.hp, 100);
  for (const q of [
    '?test=freight&test=freight',
    '?test=freight&daily=x',
    '?test=freight&dv=28',
    '?test=freight&seed=x',
    '?test=freight&area=furnace',
    '?test=freight&formation=shield',
  ])
    assert.equal(freightTestFromUrl(new URL(q, base)), null);
});

test('normal health, the five-upgrade test gun and ordinary inputs clear all waves, dock and earn one upgrade', () => {
  const g = fixture();
  for (let i = 0; i < 120 * 60 && g.mode === 'playing'; i++) g.tick(1 / 60, freightPilot(g));
  assert.equal(
    g.mode,
    'upgrade',
    JSON.stringify({
      mode: g.mode,
      hp: g.hp,
      time: g.time,
      top: g.freight.top,
      wave: g.freight.wave,
      p: g.player.position,
      enemies: g.enemies.map((e) => ({ kind: e.kind, hp: e.hp, p: e.body.position })),
    }),
  );
  assert.equal(g.kills, 7);
  assert.equal(g.offers.length, 3);
  const count = g.mods.length;
  g.chooseMod(g.offers[0].id);
  assert.equal(g.stage, 6);
  assert.equal(g.mods.length, count + 1);
  assert(!g.freight.active);
  assert.equal(g.worldTop, 0);
});
