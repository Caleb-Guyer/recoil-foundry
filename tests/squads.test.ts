import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import {
  SQUAD_TELL,
  SQUAD_LOCK,
  squadSpawns,
  squadGunOrigin,
  squadLineEnd,
} from '../src/squads.ts';
import type { SquadKind } from '../src/squads.ts';
import { getLevel } from '../src/levels.ts';
import { splitWaves, REINFORCEMENT_TELL } from '../src/reinforcements.ts';
import { squadsTestFromUrl, testCheckpoint } from '../src/practice.ts';
import { dailyForDate } from '../src/daily.ts';
import { getGun, loadCheckpoint } from '../src/rules.ts';
const { Body, Bodies, Composite, Query } = Matter;
const base = 'https://caleb-guyer.github.io/recoil-foundry/';
function step(g: Game, count = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < count; i++)
    g.tick(1 / 60, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: false,
      fire: false,
      aim: { x: 1000, y: 720 },
      ...input,
    });
}
function until(g: Game, condition: () => boolean, count = 600) {
  for (let i = 0; i < count && !condition(); i++) step(g);
  assert(condition(), 'Condition timed out');
}
function fixture(kind: SquadKind) {
  const g = new Game();
  g.startTest(testCheckpoint('squad-fixture', 8));
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.hazards.clear();
  g.breaches.clear();
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  Body.setPosition(g.player, { x: 150, y: 722 });
  g.spawnEnemy(
    kind === 'shield' ? 'runner' : 'sniper',
    900,
    724,
    kind === 'shield' ? 'shielded' : undefined,
    0.2,
    { kind, role: 'lead' },
  );
  g.spawnEnemy(
    kind === 'shield' ? 'shooter' : kind === 'flank' ? 'flyer' : 'hopper',
    1040,
    kind === 'flank' ? 320 : 724,
    undefined,
    0.2,
    { kind, role: 'support' },
  );
  const [lead, support] = g.enemies;
  lead.spawn = support.spawn = 0;
  return { g, lead, support };
}

test('squad plans preserve each roster, reserve both members together, introduce roles gradually, and repeat without combat RNG', () => {
  const counts = { shield: 0, flank: 0, ambush: 0 };
  for (let i = 0; i < 50; i++)
    for (let stage = 0; stage < 16; stage++) {
      const seed = 'squads-plan-' + i,
        level = getLevel(seed, stage),
        before = structuredClone(level);
      const [opening, final] = splitWaves(level, seed, stage);
      const pair = final.filter((s) => s.squad);
      assert(pair.length === 0 || pair.length === 2);
      assert(opening.every((s) => !s.squad));
      assert.deepEqual(level, before);
      const key = (s: { kind: string; elite?: string; x: number; y: number }) =>
        `${s.kind}:${s.elite ?? ''}:${s.x}:${s.y}`;
      assert.deepEqual([...opening, ...final].map(key).sort(), level.spawns.map(key).sort());
      assert.deepEqual(splitWaves(level, seed, stage), [opening, final]);
      if (pair.length) {
        const kind = pair[0].squad!.kind;
        counts[kind]++;
        assert.equal(pair[1].squad!.kind, kind);
        assert.notEqual(pair[0].squad!.role, pair[1].squad!.role);
        assert(stage >= (kind === 'shield' ? 4 : kind === 'flank' ? 6 : 8));
        assert(!level.boss);
      }
      assert(
        squadSpawns(level.spawns, { ...level, detour: true }, seed, stage).every((s) => !s.squad),
      );
    }
  assert(
    Object.values(counts).every((n) => n > 15),
    JSON.stringify(counts),
  );
});

test('real reinforcement doors preserve the full entrance warning and instantiate the selected squad exactly once', () => {
  for (const kind of ['shield', 'flank', 'ambush']) {
    const save = squadsTestFromUrl(new URL('?test=squads&formation=' + kind, base))!,
      g = new Game();
    g.startTest(save);
    const selected = g.waves.doors.filter((d) => d.spawn.squad);
    assert.equal(selected.length, 2);
    assert.equal(selected[0].spawn.squad!.kind, kind);
    const pairs: string[] = [],
      spawn = g.spawnEnemy.bind(g);
    g.spawnEnemy = (...args) => {
      if (args[5]) pairs.push(args[5].kind + ':' + args[5].role);
      spawn(...args);
    };
    for (const e of [...g.enemies]) g.hitEnemy(e, 99999);
    until(g, () => g.waves.phase === 'warning');
    const began = g.time;
    step(g, 40);
    assert.equal(pairs.length, 0);
    assert(g.time - began < REINFORCEMENT_TELL);
    until(g, () => pairs.length === 2);
    assert(g.time - began >= REINFORCEMENT_TELL - 0.02);
    step(g, 30);
    assert.equal(new Set(pairs).size, 2);
    assert.equal(pairs.length, 2);
    assert(g.enemies.some((e) => e.squad?.kind === kind));
  }
});

test('the shield carrier advances while its physical gunner follows behind with unchanged health', () => {
  const { g, lead, support } = fixture('shield');
  const hp = [lead.hp, support.hp];
  assert(!support.body.isStatic);
  step(g, 150);
  assert(lead.body.position.x < 780);
  assert(support.body.position.x < 1020);
  assert(support.body.position.x > lead.body.position.x + 35);
  assert(support.body.position.x - lead.body.position.x < 250);
  assert.deepEqual([lead.hp, support.hp], hp);
  assert(lead.squad?.connected && support.squad?.connected);
  const before = lead.hp;
  g.hitEnemy(lead, 40, { x: lead.body.position.x - 100, y: lead.body.position.y });
  assert(Math.abs(before - lead.hp - 4) < 0.001);
  const gunnerHp = support.hp;
  g.hitEnemy(support, 40, { x: 150, y: 720 });
  assert.equal(support.hp, gunnerHp - 40);
});

test('a gunner gives its full aiming warning, locks direction, and cancels if its mount is displaced', () => {
  const { g, support } = fixture('shield');
  const shots: { time: number; angle: number }[] = [],
    fire = g.enemyShot.bind(g);
  g.enemyShot = (...args) => {
    if (args[0] === support) shots.push({ time: g.time, angle: args[1] });
    fire(...args);
  };
  until(g, () => support.state === 'windup');
  const began = g.time;
  until(g, () => support.timer <= SQUAD_LOCK);
  const aim = { ...support.aim };
  Body.setPosition(g.player, { x: 200, y: 600 });
  until(g, () => shots.length > 0);
  assert(shots[0].time - began >= SQUAD_TELL - 0.02);
  assert.equal(shots[0].angle, Math.atan2(aim.y, aim.x));
  const origin = squadGunOrigin(support);
  support.state = 'windup';
  support.timer = 0.2;
  support.squad!.origin = { ...origin };
  Body.setPosition(support.body, { x: support.body.position.x, y: support.body.position.y - 50 });
  step(g);
  assert.equal(support.state, 'recover');
  assert.equal(shots.length, 1);
});

test('squad rounds stop on allied bodies without damaging them, including an ally inside the muzzle reach', () => {
  const { g, lead, support } = fixture('shield');
  const hp = lead.hp;
  const from = { x: support.body.position.x, y: 720 };
  assert(squadLineEnd(g, support, from, { x: 150, y: 720 }).x > 850);
  g.enemyShot(support, Math.PI, 20, 20, from);
  for (let i = 0; i < 70; i++) g.updateShots(1 / 60);
  assert.equal(g.hp, 100);
  assert.equal(lead.hp, hp);
  assert.equal(g.shots.length, 0);
  Body.setPosition(lead.body, { x: from.x - 22, y: 720 });
  g.enemyShot(support, Math.PI, 20, 20, from);
  assert.equal(g.shots.length, 0);
});

test('the raised gun mount cannot fire across a thin ceiling above its body', () => {
  const { g, support } = fixture('shield');
  const p = support.body.position;
  const roof = Bodies.rectangle(p.x, p.y - 23, 160, 8, { isStatic: true });
  g.terrain.push(roof);
  Composite.add(g.engine.world, roof);
  assert.equal(Query.collides(support.body, [roof]).length, 0);
  g.enemyShot(support, Math.PI);
  assert.equal(g.shots.length, 0);
  support.state = 'windup';
  support.timer = 0.1;
  support.squad!.origin = { ...squadGunOrigin(support) };
  step(g);
  assert.equal(support.state, 'recover');
  assert.equal(g.shots.length, 0);
});

test('a squad round overlapping a nearby fuel canister at the muzzle still arms it', () => {
  const { g, support } = fixture('shield');
  const origin = squadGunOrigin(support);
  const fuel = g.props.spawn('canister', origin.x - 39, origin.y);
  g.enemyShot(support, Math.PI);
  assert(Number.isFinite(fuel.armedAt));
  assert.equal(g.shots.length, 0);
});

test('the escort physically jumps a low crate and steps off a shelf to rejoin its carrier', () => {
  for (const raised of [false, true]) {
    const { g, lead, support } = fixture('shield');
    Body.setPosition(lead.body, { x: 800, y: 724 });
    Body.setPosition(support.body, { x: 1060, y: raised ? 614 : 724 });
    if (raised) {
      const shelf = Bodies.rectangle(1080, 641, 220, 22, { isStatic: true });
      g.terrain.push(shelf);
      Composite.add(g.engine.world, shelf);
    } else g.props.spawn('crate', 985, 717);
    let climbed = false;
    for (let n = 0; n < 280 && g.mode === 'playing'; n++) {
      step(g);
      climbed ||= support.body.position.y < 670;
      for (const p of g.props.items)
        assert(!Query.collides(support.body, [p.body]).some((c) => c.depth > 3));
    }
    assert(
      support.body.position.x < (raised ? 950 : 940),
      JSON.stringify({ raised, pos: support.body.position }),
    );
    if (raised) assert(support.body.position.y > 680);
    else assert(climbed);
  }
});

test('a flanking flyer takes a collision-safe route around cover to the opposite side of the player', () => {
  const { g, lead, support } = fixture('flank');
  Body.setPosition(g.player, { x: 1000, y: 722 });
  Body.setPosition(lead.body, { x: 1450, y: 724 });
  Body.setPosition(support.body, { x: 1430, y: 420 });
  const wall = Bodies.rectangle(1220, 500, 80, 480, { isStatic: true });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  let above = false;
  for (let n = 0; n < 480 && support.body.position.x >= 900 && g.mode === 'playing'; n++) {
    step(g);
    above ||= support.body.position.y < 240;
    assert(!Query.collides(support.body, [wall]).some((c) => c.depth > 2));
  }
  assert(above);
  assert(
    support.body.position.x < 900,
    JSON.stringify({ mode: g.mode, pos: support.body.position, route: support.hunt }),
  );
  assert(support.squad?.connected);
});

test('the flanking flyer holds position and aim through its existing final lock window', () => {
  const { g, lead, support } = fixture('flank');
  lead.squad!.connected = support.squad!.connected = true;
  lead.timer = 10;
  support.timer = 0.3;
  support.aim = { x: -1, y: 0 };
  const p = { ...support.body.position };
  Body.setPosition(g.player, { x: 200, y: 550 });
  step(g, 10);
  assert.deepEqual(support.aim, { x: -1, y: 0 });
  assert(Math.hypot(support.body.position.x - p.x, support.body.position.y - p.y) < 0.5);
});

test('sniper and hopper retain full tells and alternate their pressure without starting another snipe over a leap', () => {
  const { g, lead, support } = fixture('ambush');
  Body.setPosition(g.player, { x: 600, y: 722 });
  const snipes: number[] = [];
  g.onSound = (kind) => {
    if (kind === 'snipe') snipes.push(g.time);
  };
  until(g, () => support.state === 'windup');
  const warned = g.time;
  assert.equal(lead.state, 'windup');
  assert(lead.timer <= 0.32 + 1 / 60);
  until(g, () => support.state === 'airborne');
  assert(g.time - warned >= 0.36 - 0.02);
  assert.equal(snipes.length, 1);
  assert(snipes[0] <= g.time);
  for (let n = 0; n < 160 && support.state === 'airborne'; n++) {
    step(g);
    assert.notEqual(lead.state, 'windup');
  }
  assert.equal(support.state, 'recover');
});

test('death, cargo and fuel break a pair immediately, leaving the survivor damageable with an ordinary firing cycle', () => {
  for (const hazard of ['shot', 'cargo', 'fuel']) {
    const { g, lead, support } = fixture('shield');
    step(g);
    g.updateEnemy = () => {};
    if (hazard === 'cargo') {
      const load = g.cargo.spawn({ x: lead.body.position.x, y: 400, anchorY: 110 });
      g.cargo.cut(load, 48);
      step(g, 140);
    } else if (hazard === 'fuel') {
      lead.hp = 40;
      const fuel = g.props.spawn('canister', lead.body.position.x - 30, 720);
      g.props.explode(fuel);
    } else g.hitEnemy(lead, 99999);
    assert(!g.enemies.includes(lead), hazard);
    assert(g.enemies.includes(support), hazard);
    assert.equal(support.squad, undefined, hazard);
    const hp = support.hp;
    g.hitEnemy(support, 12);
    assert.equal(support.hp, hp - 12);
  }
});

test('teleporting a squad hull breaks both roles and cancels its old warning through real portal physics', () => {
  const { g, lead, support } = fixture('shield');
  step(g);
  g.mods = ['fold'];
  g.gun = getGun(g.mods);
  const walls = [
    Bodies.rectangle(620, 400, 40, 600, { isStatic: true }),
    Bodies.rectangle(1120, 400, 40, 600, { isStatic: true }),
  ];
  g.terrain.push(...walls);
  Composite.add(g.engine.world, walls);
  assert(g.portals.place({ x: 600, y: 400 }));
  assert(g.portals.place({ x: 1140, y: 400 }));
  Body.setPosition(support.body, { x: 555, y: 400 });
  Body.setVelocity(support.body, { x: 18, y: 0 });
  support.state = 'windup';
  support.timer = 0.25;
  g.updateEnemy = () => {};
  step(g, 12);
  assert(support.body.position.x > 1180);
  assert.equal(lead.squad, undefined);
  assert.equal(support.squad, undefined);
  assert.equal(support.state, 'idle');
  assert(support.timer >= SQUAD_TELL);
  assert.equal(g.shots.length, 0);
});

test('killing the first member cancels the role of a partner still waiting at a blocked doorway', () => {
  const save = squadsTestFromUrl(new URL('?test=squads', base))!,
    g = new Game();
  g.startTest(save);
  const enter = g.waves.canEnter.bind(g.waves);
  let blocked = true;
  g.waves.canEnter = (spawn) => (blocked && spawn.squad?.role === 'support' ? false : enter(spawn));
  for (const e of [...g.enemies]) g.hitEnemy(e, 99999);
  until(g, () => g.enemies.some((e) => e.squad?.role === 'lead'));
  const lead = g.enemies.find((e) => e.squad?.role === 'lead')!;
  const door = g.waves.doors.find((d) => d.spawn.squad?.role === 'support')!;
  assert(door);
  g.hitEnemy(lead, 99999);
  assert.equal(door.spawn.squad, undefined);
  blocked = false;
  until(g, () => door.state === 'open' || door.state === 'spent');
  assert(g.enemies.every((e) => !e.squad));
  assert(g.enemies.some((e) => e.kind === 'shooter' && e.body.isStatic));
});

test('pauses and hitstop freeze coordination; saved normal and daily entrances reconstruct fresh deterministic pairs', () => {
  const { g, lead, support } = fixture('shield');
  until(g, () => support.state === 'windup');
  const snapshot = () =>
    JSON.stringify(
      g.enemies.map((e) => ({
        squad: e.squad,
        state: e.state,
        timer: e.timer,
        pos: e.body.position,
        aim: e.aim,
      })),
    );
  const frozen = snapshot();
  g.setMode('paused');
  step(g, 60);
  assert.equal(snapshot(), frozen);
  g.setMode('playing');
  g.hitStop = 0.2;
  step(g, 6);
  assert.equal(snapshot(), frozen);
  assert(lead.squad);
  for (const seed of ['SQUAD-SHIELD-11', dailyForDate('2026-09-07')!.seed]) {
    const save = testCheckpoint(seed, 8),
      a = new Game(),
      b = new Game();
    a.start(seed, save);
    for (let i = 0; i < 100; i++) a.rng();
    b.start(seed, loadCheckpoint(JSON.parse(JSON.stringify(save)))!);
    assert.deepEqual(a.waves.doors, b.waves.doors);
    assert.equal(b.hp, 100);
  }
});

test('all squad test links load the promised formation, retry safely, and reject mixed or invalid modes', () => {
  for (const formation of ['shield', 'flank', 'ambush']) {
    const save = squadsTestFromUrl(new URL('?test=squads&formation=' + formation, base))!;
    assert(save);
    const g = new Game();
    let writes = 0;
    g.onCheckpoint = () => {
      writes++;
    };
    g.startTest(save);
    const before = structuredClone(g.waves.doors);
    step(g, 5);
    g.startTest(g.testRun!);
    assert.deepEqual(g.waves.doors, before);
    assert.equal(writes, 0);
    assert.equal(g.mods.length, save.stage);
  }
  assert(squadsTestFromUrl(new URL('?test=squads', base)));
  for (const query of [
    '?test=squads&formation=bad',
    '?test=squads&formation=constructor',
    '?test=squads&test=squads',
    '?test=squads&formation=shield&formation=flank',
    '?test=squads&daily=2026-09-07',
    '?test=squads&dv=26',
    '?test=squads&seed=x',
    '?test=squads&area=rooftops',
  ])
    assert.equal(squadsTestFromUrl(new URL(query, base)), null);
});
