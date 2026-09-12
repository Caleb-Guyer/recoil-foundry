import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input, type Shot } from '../src/game.ts';
import { getLevel } from '../src/levels.ts';
import { getOvertimeLevel } from '../src/overtime.ts';
import { splitWaves, REINFORCEMENT_TELL } from '../src/reinforcements.ts';
import { harpoonerTestFromUrl } from '../src/practice.ts';
import { getGun, loadCheckpoint, STAGES } from '../src/rules.ts';
import {
  HARPOON_TELL,
  HARPOON_LOCK,
  HARPOON_DAMAGE,
  HARPOON_DURATION,
  harpoonMuzzle,
} from '../src/harpooner.ts';
import { dodgePilot } from './combat-pilot.ts';
const { Body, Bodies, Composite, Engine, Query } = Matter;
const DT = 1 / 60;
function step(g: Game, count = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < count; i++)
    g.tick(DT, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: true,
      fire: false,
      aim: { x: 1000, y: 720 },
      ...input,
    });
}
function until(g: Game, condition: () => boolean, limit = 240) {
  for (let i = 0; i < limit && !condition(); i++) step(g);
  assert(
    condition(),
    JSON.stringify({
      time: g.time,
      hp: g.hp,
      mode: g.mode,
      enemies: g.enemies.map((e) => ({
        state: e.state,
        timer: e.timer,
        phase: e.harpoon?.phase,
        pos: e.body.position,
        head: e.harpoon?.head,
        attacks: e.attacks,
      })),
    }),
  );
}
function fixture(side = -1) {
  const g = new Game();
  g.start('harpoon-fixture');
  g.hazards.clear();
  g.breaches.clear();
  g.waves.clear();
  g.conveyors.clear();
  g.magnets.items = [];
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.stage = 12;
  g.mods = [];
  g.gun = getGun([]);
  Body.setPosition(g.player, { x: 1000 + side * 500, y: 722 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.spawnEnemy('harpooner', 1000, 724);
  const e = g.enemies[0];
  e.spawn = 0;
  e.timer = 0;
  return { g, e, rig: e.harpoon! };
}
function wall(g: Game, x: number, y = 600, w = 30, h = 280) {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  return b;
}
function latch(side = -1) {
  const f = fixture(side);
  until(f.g, () => f.rig.phase === 'latched');
  f.g.hitStop = 0;
  return f;
}
function shoot(g: Game, extra: Partial<Shot> = {}) {
  g.addShot({
    pos: { ...g.player.position },
    vel: { x: 1000, y: 0 },
    damage: 24,
    life: 2,
    radius: 3,
    friendly: true,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
    ...extra,
  });
  return g.shots.at(-1)!;
}

test('Harpooner introduces alone in Reclamation, preserves elites and is sparse and deterministic in Overtime', () => {
  let mixed = 0;
  for (let i = 0; i < 80; i++)
    for (let stage = 0; stage < STAGES; stage++) {
      const seed = 'hook-roster-' + i,
        level = getLevel(seed, stage),
        hooks = level.spawns.filter((s) => s.kind === 'harpooner');
      assert.equal(hooks.length, stage === 12 ? 1 : 0);
      if (stage === 12) {
        assert(!hooks[0].elite && level.harpoonIntro);
        const [opening, final] = splitWaves(level, seed, stage);
        assert.deepEqual(opening, hooks);
        assert.equal(final.length, level.spawns.length - 1);
        assert(final.some((s) => s.elite));
        assert.deepEqual(getLevel(seed, stage), level);
        const g = new Game();
        g.seed = seed;
        g.stage = stage;
        g.loadRoom();
        assert.equal(g.enemies.length, 1);
        assert.equal(Query.collides(g.enemies[0].body, g.solidBodies).length, 0);
      }
      const ot = getOvertimeLevel(seed, stage),
        h = ot.spawns.filter((s) => s.kind === 'harpooner');
      assert(h.length <= 1);
      assert(!ot.harpoonIntro);
      assert(h.every((s) => !s.elite));
      if (ot.boss || ot.freight) assert.equal(h.length, 0);
      mixed += h.length;
      assert.deepEqual(ot, getOvertimeLevel(seed, stage));
    }
  assert(mixed > 100 && mixed < 800, String(mixed));
});
test('the introduction never overlaps reinforcements; killing it starts the complete door warning', () => {
  const g = new Game();
  g.startTest(harpoonerTestFromUrl(new URL('https://example.com/?test=harpooner'))!);
  g.waves.update(90);
  assert.equal(g.waves.phase, 'opening');
  g.hitEnemy(g.enemies[0], 99999);
  g.waves.update(DT);
  assert.equal(g.waves.phase, 'warning');
  assert(g.waves.doors.every((d) => d.timer === REINFORCEMENT_TELL));
  g.waves.update(REINFORCEMENT_TELL - 0.01);
  assert.equal(g.enemies.length, 0);
  g.waves.update(0.02);
  assert(g.enemies.length > 0);
  assert(g.enemies.every((e) => e.spawn > 0));
});
test('Overtime never duplicates the Harpooner in its extra wave', () => {
  for (let i = 0; i < 40; i++)
    for (const stage of [0, 4, 8, 12, 16]) {
      const g = new Game();
      g.seed = 'mixed-hooks-' + i;
      g.stage = stage;
      g.overtime = { baseMods: 19, repairs: 0 };
      g.loadRoom();
      const total = [...g.enemies, ...g.waves.doors.map((d) => d.spawn)].filter(
        (e) => e.kind === 'harpooner',
      );
      assert(total.length <= 1);
      assert(!g.level.harpoonIntro);
    }
});
test('both facings give a full aim-locked warning, one impact and a finite tether', () => {
  for (const side of [-1, 1]) {
    const { g, e, rig } = fixture(side);
    step(g);
    assert.equal(rig.phase, 'aim');
    const began = g.time;
    until(g, () => e.timer <= HARPOON_LOCK);
    const locked = { ...e.aim };
    step(g, 8);
    assert.deepEqual(e.aim, locked);
    until(g, () => rig.phase === 'flight');
    assert(g.time - began >= HARPOON_TELL - DT - 0.001);
    until(g, () => rig.phase === 'latched');
    assert.equal(rig.target, g.player);
    assert.equal(g.hp, 100 - HARPOON_DAMAGE);
    const caught = g.time;
    step(g, 90);
    assert.equal(g.hp, 100 - HARPOON_DAMAGE);
    until(g, () => rig.phase === 'ready');
    assert(g.time - caught >= HARPOON_DURATION - DT - 0.001);
    assert.equal(e.state, 'recover');
    assert.equal(rig.target, null);
  }
});
test('moving after lock dodges the committed shot and displacement cancels the windup', () => {
  const { g, e, rig } = fixture();
  step(g);
  until(g, () => e.timer <= HARPOON_LOCK);
  const locked = { ...e.aim };
  Body.setPosition(g.player, { x: 500, y: 420 });
  g.engine.gravity.y = 0;
  until(g, () => e.attacks === 1);
  assert.deepEqual(e.aim, locked);
  step(g, 65);
  assert.equal(g.hp, 100);
  assert.equal(rig.phase, 'ready');
  const f = fixture();
  step(f.g);
  until(f.g, () => f.e.timer <= HARPOON_LOCK);
  Body.translate(f.e.body, { x: 30, y: 0 });
  step(f.g);
  assert.equal(f.rig.phase, 'ready');
  assert.equal(f.e.attacks, 0);
});
test('spawn grace and only one active harpoon preserve an escape window', () => {
  const { g, e } = fixture();
  e.spawn = 0.65;
  step(g, 35);
  assert.equal(e.harpoon!.phase, 'ready');
  until(g, () => e.harpoon!.phase === 'aim');
  g.spawnEnemy('harpooner', 1300, 724);
  const other = g.enemies.at(-1)!;
  other.spawn = 0;
  other.timer = 0;
  step(g, 10);
  assert.equal(other.harpoon!.phase, 'ready');
  assert.equal(g.harpoons.active, e);
});
test('ordinary movement can dodge the visible locked hook without shooting', () => {
  const { g, e, rig } = fixture();
  step(g);
  until(g, () => e.timer <= HARPOON_LOCK);
  for (let i = 0; i < 110; i++) step(g, 1, { ...dodgePilot(g, e), fire: false });
  assert.equal(g.hp, 100);
  assert.equal(rig.target, null);
  assert(e.attacks >= 1);
});
test('terrain and a wall over the muzzle stop the hook without damage or tunneling', () => {
  for (const x of [750, 976]) {
    const { g, e, rig } = fixture();
    step(g);
    until(g, () => e.timer <= HARPOON_LOCK);
    wall(g, x, 650, x === 976 ? 8 : 30, 180);
    step(g, 100);
    assert.equal(rig.target, null);
    assert.equal(g.hp, 100);
    assert(e.attacks <= 1);
  }
});
test('a rotating loose crate catches the hook, arms a canister, and removal clears attachment', () => {
  for (const kind of ['crate', 'canister'] as const) {
    const { g, rig } = fixture();
    step(g);
    until(g, () => rig.phase === 'flight');
    const prop = g.props.spawn(kind, 720, 718);
    Body.setAngle(prop.body, 0.35);
    until(g, () => rig.phase === 'latched');
    assert.equal(rig.target, prop.body);
    assert.equal(g.hp, 100);
    if (kind === 'canister') assert(Number.isFinite(prop.armedAt));
    if (kind === 'crate') {
      const old = prop.body.position.x;
      step(g, 50);
      assert(prop.body.position.x > old + 8);
      assert.equal(g.hp, 100);
    }
    g.props.remove(prop);
    assert.equal(rig.target, null);
    assert.equal(rig.phase, 'ready');
  }
});
test('a new obstacle breaks an attached cable immediately', () => {
  const { g, rig } = latch();
  wall(g, 750);
  g.harpoons.beforeStep(DT);
  assert.equal(rig.phase, 'ready');
  assert.equal(rig.target, null);
});
test('static cargo and other enemies block the hook instead of becoming a second attachment', () => {
  for (const kind of ['cover', 'cargo', 'enemy']) {
    const { g, rig } = fixture();
    step(g);
    until(g, () => rig.phase === 'flight');
    if (kind === 'cover') g.props.spawn('cover', 720, 699);
    else if (kind === 'cargo') g.cargo.spawn({ x: 720, y: 710, anchorY: 200 });
    else {
      g.spawnEnemy('shooter', 720, 724);
      g.enemies.at(-1)!.spawn = 0;
      g.enemies.at(-1)!.timer = 100;
    }
    until(g, () => rig.phase === 'ready');
    assert.equal(rig.target, null);
    assert.equal(g.hp, 100);
  }
});
test('recoil can pull a perched Harpooner off its ledge with gravity and contacts enabled', () => {
  const { g, e, rig } = latch();
  Body.setPosition(g.player, { x: 690, y: 395 });
  Body.setPosition(e.body, { x: 1000, y: 400 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  Body.setVelocity(e.body, { x: 0, y: 0 });
  rig.local = { x: 0, y: 0 };
  rig.length = 300;
  const ledge = wall(g, 1010, 426, 100, 20);
  g.mods = ['kick', 'rapid', 'airshot'];
  g.gun = getGun(g.mods);
  g.shootAt = 0;
  step(g, 90, { fire: true, aim: { x: 940, y: 700 } });
  assert(e.body.bounds.max.x < ledge.bounds.min.x, JSON.stringify(e.body.position));
  assert.equal(Query.collides(e.body, [ledge]).length, 0);
  assert(e.hp > 0);
});
test('reeling transfers equal momentum and airborne gun recoil can drag the Harpooner', () => {
  const { g, e, rig } = latch();
  g.engine.gravity.y = 0;
  Body.setPosition(g.player, { x: 500, y: 400 });
  Body.setPosition(e.body, { x: 1000, y: 400 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  Body.setVelocity(e.body, { x: 0, y: 0 });
  rig.local = { x: 0, y: 0 };
  rig.length = 400;
  g.harpoons.beforeStep(DT);
  assert(g.player.velocity.x > 0);
  assert(e.body.velocity.x < 0);
  assert(Math.abs(g.player.mass * g.player.velocity.x + e.body.mass * e.body.velocity.x) < 1e-8);
  const original = e.body.position.x;
  g.mods = ['kick', 'rapid', 'airshot'];
  g.gun = getGun(g.mods);
  g.shootAt = 0;
  step(g, 75, { fire: true, aim: { x: 800, y: 650 } });
  assert(
    e.body.position.x < original - 45,
    JSON.stringify({ p: g.player.position, e: e.body.position }),
  );
  assert(g.player.position.x < 650);
  assert(g.player.position.y < 400);
  assert(e.hp > 0);
  assert(!e.body.isStatic && !g.player.isStatic);
});
test('swept friendly rounds break the exposed winch; hostile shots cannot free their ally', () => {
  for (const damage of [10, 24, 400]) {
    const { g, e, rig } = latch();
    const hp = e.hp,
      p = harpoonMuzzle(e);
    shoot(g, { pos: { x: p.x - 250, y: p.y }, damage });
    g.updateShots(DT);
    assert.equal(e.hp, hp);
    assert.equal(rig.phase, damage >= 18 ? 'ready' : 'latched');
    if (damage < 18) {
      shoot(g, { pos: { x: p.x - 250, y: p.y }, damage });
      g.updateShots(DT);
      assert.equal(rig.phase, 'ready');
    }
  }
  const { g, rig } = latch();
  shoot(g, { friendly: false, pos: { x: 700, y: 720 } });
  g.updateShots(DT);
  assert.equal(rig.phase, 'latched');
});
test('closer cover blocks a winch shot and blast cover is resolved before destruction', () => {
  const { g, e, rig } = latch(),
    p = harpoonMuzzle(e);
  const cover = g.props.spawn('cover', 850, 699);
  shoot(g, { pos: { x: 750, y: p.y }, damage: 500 });
  g.updateShots(DT);
  assert.equal(rig.phase, 'latched');
  assert(!g.props.items.includes(cover));
  const cover2 = g.props.spawn('cover', 900, 699);
  g.demolition.detonate({
    pos: { x: 850, y: p.y },
    damage: 500,
    radius: 150,
    launch: 0,
    kind: 'shell',
  });
  assert.equal(rig.phase, 'latched');
  assert(!g.props.items.includes(cover2));
  g.demolition.detonate({
    pos: { x: 900, y: p.y },
    damage: 30,
    radius: 150,
    launch: 0,
    kind: 'shell',
  });
  assert.equal(rig.phase, 'ready');
});
test('Kickback and demolition can break a winch from the correct direction', () => {
  for (const blast of ['rear', 'shell']) {
    const { g, e, rig } = latch(),
      p = harpoonMuzzle(e);
    Body.setPosition(g.player, { x: p.x - 75, y: p.y });
    if (blast === 'rear') {
      g.fireBackblast({ x: 1, y: 0 }, 30);
      assert.equal(rig.phase, 'latched');
      g.fireBackblast({ x: -1, y: 0 }, 30);
    } else
      g.demolition.detonate({
        pos: { x: p.x - 50, y: p.y },
        damage: 30,
        radius: 130,
        launch: 0,
        kind: 'shell',
      });
    assert.equal(rig.phase, 'ready');
  }
});
test('an exploding fuel canister also breaks an exposed winch', () => {
  const { g, e, rig } = latch(),
    p = harpoonMuzzle(e);
  const fuel = g.props.spawn('canister', p.x - 80, p.y - 40);
  g.props.explode(fuel);
  assert.equal(rig.phase, 'ready');
  assert(e.hp > 0);
});
test('a portal crossing releases either endpoint without teleporting the other', () => {
  for (const endpoint of ['player', 'enemy', 'crate']) {
    const { g, e, rig } = latch();
    g.mods = ['fold'];
    g.gun = getGun(g.mods);
    const body =
      endpoint === 'player'
        ? g.player
        : endpoint === 'enemy'
          ? e.body
          : g.props.spawn('crate', 600, 500).body;
    if (endpoint === 'crate') {
      rig.target = body;
      rig.local = { x: 0, y: 0 };
    }
    assert(g.portals.place({ x: 600, y: 740 }));
    assert(g.portals.place({ x: 1400, y: 740 }));
    Body.setPosition(body, { x: 600, y: 670 });
    Body.setVelocity(body, { x: 0, y: 15 });
    for (let i = 0; i < 12 && body.position.x < 1000; i++) {
      g.portals.beforeStep();
      Engine.update(g.engine, 1000 / 60);
    }
    assert(body.position.x > 1300);
    assert.equal(rig.phase, 'ready');
    assert.equal(rig.target, null);
  }
});
test('a harpoon head entering a portal snaps its cable', () => {
  const { g, e, rig } = fixture();
  g.mods = ['fold'];
  g.gun = getGun(g.mods);
  assert(g.portals.place({ x: 750, y: 740 }));
  assert(g.portals.place({ x: 1400, y: 740 }));
  e.state = 'rush';
  rig.phase = 'flight';
  rig.head = { x: 750, y: 700 };
  rig.velocity = { x: 0, y: 15 };
  rig.expires = 5;
  for (let i = 0; i < 5 && rig.phase === 'flight'; i++) g.harpoons.afterStep(DT);
  assert.equal(rig.phase, 'ready');
  assert.equal(rig.target, null);
});
test('death, room changes, title and Rivet release the cable; pause and hitstop freeze it', () => {
  for (const mode of ['dead', 'title', 'won'] as const) {
    const { g, rig } = latch();
    g.setMode(mode);
    assert.equal(rig.phase, 'ready');
    assert.equal(rig.target, null);
  }
  const { g, e, rig } = latch();
  g.setMode('paused');
  const before = { head: { ...rig.head }, time: g.time, length: rig.length };
  step(g, 120);
  assert.deepEqual({ head: rig.head, time: g.time, length: rig.length }, before);
  g.setMode('playing');
  g.hitStop = 0.2;
  step(g, 5);
  assert.equal(g.time, before.time);
  assert.equal(rig.length, before.length);
  g.hitEnemy(e, 99999);
  assert.equal(rig.phase, 'ready');
  assert.equal(g.harpoons.active, undefined);
  const f = latch();
  f.g.loadRoom();
  assert.equal(f.rig.target, null);
  assert.equal(f.rig.phase, 'ready');
  const pin = latch();
  pin.g.mods = ['deadeye', 'rivet'];
  pin.g.gun = getGun(pin.g.mods);
  wall(pin.g, 1050);
  const s = shoot(pin.g, { vel: { x: 40, y: 0 } });
  pin.g.ballistics.rivet(pin.e, s);
  assert.equal(pin.rig.phase, 'ready');
  assert(pin.g.ballistics.pins.has(pin.e.id));
});
test('Harpooner test links preserve saves and Practice unlocks, restart cleanly, and reject conflicting modes', () => {
  const base = 'https://example.com/';
  for (const mode of ['normal', 'overtime']) {
    const save = harpoonerTestFromUrl(new URL('?test=harpooner&mode=' + mode, base))!;
    assert(save);
    assert(loadCheckpoint(save));
    const g = new Game();
    let writes = 0,
      unlocks = 0;
    g.onCheckpoint = () => writes++;
    g.onBossDefeated = () => unlocks++;
    g.startTest(save);
    assert.equal(g.stage, 12);
    assert.equal(
      g.enemies.filter((e) => e.kind === 'harpooner').length +
        g.waves.doors.filter((d) => d.spawn.kind === 'harpooner').length,
      1,
    );
    for (const e of [...g.enemies]) g.hitEnemy(e, 99999);
    g.save();
    g.startTest(g.testRun!);
    assert.equal(g.hp, 100);
    assert.equal(writes, 0);
    assert.equal(unlocks, 0);
    assert(g.testRun);
  }
  for (const q of [
    'test=harpooner&mode=bad',
    'test=harpooner&mode=normal&mode=overtime',
    'test=harpooner&test=harpooner',
    'test=harpooner&daily=2026-09-11',
    'test=harpooner&seed=x',
    'test=harpooner&build=rail-spike',
    'test=other',
  ])
    assert.equal(harpoonerTestFromUrl(new URL('?' + q, base)), null);
});
