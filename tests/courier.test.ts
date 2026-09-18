import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import {
  courierTestFromUrl,
  courierLevel,
  courierEligible,
  planCourier,
  COURIER_STAGES,
} from '../src/courier-layout.ts';
import { COURIER_DOOR, COURIER_DOOR_TIME } from '../src/courier.ts';
import { getLevel } from '../src/levels.ts';
import { availableMods, getGun, loadCheckpoint, distance, type Checkpoint } from '../src/rules.ts';
import { dailyForDate } from '../src/daily.ts';
import { playRoom } from './room-pilot.ts';

const { Body, Composite, Query } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 500 },
};
function preset(query = '') {
  return courierTestFromUrl(new URL('https://example.test/?test=courier' + query))!;
}
function campaignPreset(): Checkpoint {
  const p = preset();
  return { ...p, stage: 5, mods: [...p.mods, 'rapid'], courier: { stage: 5, status: 'pending' } };
}
function game(query = '') {
  const g = new Game();
  g.startTest(preset(query));
  return g;
}
function step(g: Game, n = 1, input = idle) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, input);
}
function removeHostiles(g: Game) {
  for (const e of [...g.enemies])
    if (!e.courier) {
      Composite.remove(g.engine.world, e.body);
      g.enemies = g.enemies.filter((a) => a !== e);
    }
  g.waves.clear();
}
function collect(g: Game) {
  const e = g.courier.enemy!;
  g.hitEnemy(e, 9999);
  assert(g.courier.cargo);
  Body.setPosition(g.player, { ...g.courier.cargo.position });
  g.courier.update(1 / 60);
  assert.equal(g.courier.state?.status, 'collected');
}

test('courier plans are rare, seeded, after the first boss, outside area events and limited to one room', () => {
  let count = 0;
  const stages = new Set<number>();
  for (let i = 0; i < 400; i++) {
    const seed = 'courier-plan-' + i;
    const event = {
      kind: 'turf' as const,
      area: 1,
      relays: [],
      caches: [],
      commander: false,
      rerolls: 0,
    };
    const plan = planCourier(seed, event);
    assert.deepEqual(plan, planCourier(seed, event));
    if (plan) {
      count++;
      stages.add(plan.stage);
      assert(COURIER_STAGES.includes(plan.stage));
      assert(plan.stage >= 8);
    }
  }
  assert(count > 100 && count < 175, String(count));
  assert(stages.size >= 4);
});

test('fresh runs save the plan, Continue repeats it, and older saves keep their original room', () => {
  let g: Game | undefined,
    saved: Checkpoint | null = null;
  for (let i = 0; i < 30; i++) {
    g = new Game();
    g.onCheckpoint = (s) => {
      saved = s;
    };
    g.start('courier-run-' + i);
    if (g.courier.state) break;
  }
  assert(g?.courier.state && saved);
  assert(loadCheckpoint(saved));
  const h = new Game();
  h.start(g.seed, saved!);
  assert.deepEqual(h.courier.state, g.courier.state);
  const old = preset();
  delete old.courier;
  h.start(old.seed, old);
  assert(!h.level.courier && !h.courier.enemy);
});

test('authored layouts keep all enemies supported and clear, with ordinary jump heights', () => {
  const mirrors = new Set<boolean>();
  for (const stage of COURIER_STAGES)
    for (const seed of ['COURIER-82-0', 'COURIER-82-1']) {
      const level = courierLevel(getLevel(seed, stage), seed);
      mirrors.add(level.mirrored);
      const save = { ...preset(), seed, stage, courier: { stage, status: 'pending' as const } };
      const g = new Game();
      g.startTest(save);
      assert(g.level.courier && g.courier.enemy);
      assert.equal(g.combatEnemyCount + g.waves.doors.length, g.level.spawns.length);
      for (const e of g.enemies) assert.equal(Query.collides(e.body, g.solidBodies).length, 0);
      for (const s of level.spawns.filter((s) =>
        ['runner', 'shooter', 'sniper', 'hopper'].includes(s.kind),
      ))
        assert(
          s.y > 700 ||
            level.solids.some(
              (b) => s.x > b.x + 15 && s.x < b.x + b.w - 15 && Math.abs(s.y + 16 - b.y) < 2,
            ),
        );
      assert(level.solids.filter((s) => s.h > 28).every((s) => s.h <= 130));
    }
  assert.equal(mirrors.size, 2);
});

test('unopposed courier physically traverses both obstacle arrangements and opens its exit before escaping', () => {
  for (const query of ['', '&mirror=1']) {
    const g = game(query);
    removeHostiles(g);
    const e = g.courier.enemy!;
    let maxX = e.body.position.x,
      minY = e.body.position.y,
      openingFrames = 0;
    for (let i = 0; i < 35 * 60 && g.courier.enemy; i++) {
      step(g);
      maxX = Math.max(maxX, e.body.position.x);
      minY = Math.min(minY, e.body.position.y);
      if (g.courier.opening > 0) openingFrames++;
      assert(Number.isFinite(e.body.position.x));
    }
    assert(
      !g.courier.enemy,
      JSON.stringify({ query, maxX, pos: e.body.position, opening: g.courier.opening }),
    );
    assert(minY < 590, String(minY));
    assert(maxX > 1730);
    assert(openingFrames >= (COURIER_DOOR_TIME - 0.1) * 60);
    assert.equal(g.courier.state?.status, 'lost');
    assert.equal(g.kills, 0);
    assert(!g.courier.cargo && g.clear);
  }
});

test('courier neither delays reinforcements nor gates the room exit', () => {
  const g = game();
  for (const e of [...g.enemies]) if (!e.courier) g.hitEnemy(e, 9999);
  g.hitStop = 0;
  step(g);
  assert.equal(g.waves.phase, 'warning');
  removeHostiles(g);
  step(g);
  assert(g.clear && g.courier.enemy);
  g.openReward();
  assert.equal(g.mode, 'upgrade');
  assert(!g.courierReward && !g.courier.enemy);
  assert.equal(g.courier.state?.status, 'lost');
});

test('destroying it drops exactly one physical case; only proximity and line of sight collect it', () => {
  const g = game();
  removeHostiles(g);
  const e = g.courier.enemy!;
  const hp = g.hp;
  g.hitEnemy(e, 9999);
  const cargo = g.courier.cargo!;
  assert(cargo);
  g.courier.killed(e);
  assert.equal(g.courier.cargo, cargo);
  step(g, 60);
  assert.equal(g.courier.state?.status, 'pending');
  assert(cargo.position.y < 741 && cargo.position.y > 700);
  Body.setPosition(g.player, { x: cargo.position.x - 32, y: cargo.position.y });
  const wall = Matter.Bodies.rectangle(cargo.position.x - 16, cargo.position.y, 6, 80, {
    isStatic: true,
  });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  g.courier.update(1 / 60);
  assert(g.courier.cargo);
  g.terrain = g.terrain.filter((b) => b !== wall);
  Composite.remove(g.engine.world, wall);
  g.courier.update(1 / 60);
  assert(!g.courier.cargo);
  assert.equal(g.courier.state?.status, 'collected');
  assert.equal(g.hp, hp);
  assert(
    !(g.player.collisionFilter.mask! & cargo.collisionFilter.category!),
    'case cannot pin player',
  );
});

test('cargo reward is legal, does not heal or advance, then gives the normal room reward exactly once', () => {
  const g = game();
  removeHostiles(g);
  collect(g);
  g.hp = 51;
  g.clear = true;
  const stage = g.stage,
    count = g.mods.length;
  g.openReward();
  assert(g.courierReward && !g.canReroll);
  assert.equal(g.offers.length, 3);
  assert(g.offers.every((m) => availableMods(g.mods).some((a) => a.id === m.id)));
  const picked = g.offers[0].id;
  g.chooseMod(picked);
  assert.equal(g.mods.length, count + 1);
  assert.equal(g.hp, 51);
  assert.equal(g.stage, stage);
  assert.equal(g.mode, 'upgrade');
  assert(!g.courierReward);
  assert.equal(g.courier.state?.status, 'claimed');
  assert(!g.offers.some((m) => m.id === picked));
  g.chooseMod(picked);
  assert.equal(g.mods.length, count + 1);
  g.chooseMod(g.offers[0].id);
  assert.equal(g.mods.length, count + 2);
  assert.equal(g.stage, stage + 1);
  assert.equal(g.hp, 63);
  assert(!g.courier.enemy);
});

test('Continue retains the cargo choice and the following normal choice without duplicating a reward', () => {
  const g = new Game(),
    save = campaignPreset();
  g.start(save.seed, save);
  removeHostiles(g);
  collect(g);
  g.clear = true;
  g.hp = 47;
  let saved: Checkpoint | null = null;
  g.onCheckpoint = (s) => {
    saved = s;
  };
  g.openReward();
  assert(saved && loadCheckpoint(saved));
  const h = new Game();
  h.start(g.seed, loadCheckpoint(saved)!);
  assert(h.courierReward && !h.courier.enemy && !h.courier.cargo);
  assert.deepEqual(h.offers, g.offers);
  h.onCheckpoint = (s) => {
    saved = s;
  };
  h.chooseMod(h.offers[0].id);
  assert(saved && loadCheckpoint(saved));
  const k = new Game();
  k.start(g.seed, loadCheckpoint(saved)!);
  assert(!k.courierReward && k.mods.length === 6 && k.hp === 47);
  k.onCheckpoint = (s) => {
    saved = s;
  };
  k.chooseMod(k.offers[0].id);
  assert(saved && loadCheckpoint(saved));
  assert.equal(k.hp, 59);
  assert.equal(k.stage, 6);
});

test('Daily cargo and normal rewards each have one deterministic compatible option', () => {
  const save = campaignPreset();
  for (let day = 1; day < 30; day++) {
    save.seed = dailyForDate('2026-09-' + String(day).padStart(2, '0'))!.seed;
    if (courierEligible(getLevel(save.seed, save.stage))) break;
  }
  const results: string[][] = [];
  for (let i = 0; i < 2; i++) {
    const g = new Game();
    g.start(save.seed, save);
    removeHostiles(g);
    collect(g);
    g.clear = true;
    const choices: string[] = [];
    g.openReward();
    for (let j = 0; j < 2; j++) {
      assert.equal(g.offers.length, 1);
      assert(!g.canReroll);
      choices.push(g.offers[0].id);
      g.chooseMod(g.offers[0].id);
    }
    results.push(choices);
  }
  assert.deepEqual(results[0], results[1]);
  assert.notEqual(results[0][0], results[0][1]);
});

test('pause, hitstop, death and retry cleanly suspend or reset the chase', () => {
  const g = game();
  step(g, 60);
  const before = { pos: { ...g.courier.enemy!.body.position }, age: g.courier.age };
  g.setMode('paused');
  step(g, 120);
  assert.deepEqual(g.courier.enemy!.body.position, before.pos);
  assert.equal(g.courier.age, before.age);
  g.setMode('playing');
  g.hitStop = 0.5;
  step(g, 10);
  assert.equal(g.courier.age, before.age);
  g.setMode('dead');
  assert(!g.courier.enemy && !g.courier.cargo);
  g.startTest(preset());
  assert(g.courier.enemy && g.courier.state?.status === 'pending');
  assert.equal(g.courier.age, 0);
});

test('case collection and tests never write campaign progress, discoveries or boss unlocks', () => {
  const g = new Game();
  let writes = 0;
  g.onCheckpoint = () => writes++;
  g.onBossDefeated = () => writes++;
  g.startTest(preset());
  removeHostiles(g);
  collect(g);
  g.clear = true;
  g.openReward();
  g.chooseMod(g.offers[0].id);
  g.chooseMod(g.offers[0].id);
  assert.equal(writes, 0);
});

test('invalid cargo checkpoints and ambiguous test URLs are rejected', () => {
  assert.equal(courierTestFromUrl(new URL('https://example.test/?test=courier&phase=nope')), null);
  assert.equal(
    courierTestFromUrl(new URL('https://example.test/?test=courier&phase=reward&phase=reward')),
    null,
  );
  assert(loadCheckpoint(preset('&phase=reward')));
  const preview = game('&phase=reward');
  assert(preview.courierReward && preview.hp === 64 && preview.mode === 'upgrade');
  preview.chooseMod(preview.offers[0].id);
  assert(!preview.courierReward && preview.hp === 64 && preview.mode === 'upgrade');
  for (const query of [
    '&daily=2026-09-17',
    '&seed=x',
    '&build=nope',
    '&mirror=0',
    '&mirror=1&mirror=1',
    '&build=beam&build=starter',
    '&test=courier',
    '&foo=1',
  ])
    assert.equal(
      courierTestFromUrl(new URL('https://example.test/?test=courier' + query)),
      null,
      query,
    );
  for (const courier of [
    null,
    {},
    { stage: 3, status: 'pending' },
    { stage: 4, status: 'collected' },
    { stage: 4, status: 'claimed' },
    { stage: 4, status: 'weird' },
  ])
    assert.equal(loadCheckpoint({ ...preset(), courier }), null);
  assert.equal(
    loadCheckpoint({ ...preset(), stage: 5 }),
    null,
    'cannot carry an unresolved earlier chase',
  );
});

test('the courier waits for a complete door opening again after being pulled away', () => {
  const g = game();
  removeHostiles(g);
  const e = g.courier.enemy!;
  e.spawn = 0;
  g.courier.running = true;
  Body.setPosition(e.body, { x: COURIER_DOOR.x, y: 724 });
  for (let i = 0; i < 90; i++) g.updateEnemy(e, 1 / 60);
  assert(g.courier.opening > 1.4 && g.courier.enemy);
  Body.setPosition(e.body, { x: 1500, y: 600 });
  g.updateEnemy(e, 1 / 60);
  assert.equal(g.courier.opening, 0);
  Body.setPosition(e.body, { x: COURIER_DOOR.x, y: 724 });
  for (let i = 0; i < 170; i++) g.updateEnemy(e, 1 / 60);
  assert(g.courier.enemy);
  for (let i = 0; i < 12; i++) g.updateEnemy(e, 1 / 60);
  assert(!g.courier.enemy && !g.courier.cargo);
});

test('cold, ordinary knockback and portal crossings work on the fleeing body', () => {
  const g = game('&build=portal');
  removeHostiles(g);
  const e = g.courier.enemy!;
  e.spawn = 0;
  g.courier.running = true;
  assert(g.portals.place({ x: 300, y: 740 }));
  assert(g.portals.place({ x: 1700, y: 740 }));
  Body.setPosition(e.body, { x: 300, y: 716 });
  Body.setVelocity(e.body, { x: 0, y: 5 });
  for (let i = 0; i < 5; i++) {
    g.portals.beforeStep();
    Matter.Engine.update(g.engine, 1000 / 60);
  }
  assert(e.body.position.x > 1600, JSON.stringify(e.body.position));
  const state = g.cryogenic.state(e);
  state.frozen = g.time + 1;
  const opening = g.courier.opening;
  g.updateEnemy(e, 0.5);
  assert.equal(e.body.velocity.x, 0);
  assert.equal(g.courier.opening, opening);
  state.frozen = 0;
  const hp = e.hp;
  g.addShot({
    pos: { x: e.body.position.x - 60, y: e.body.position.y },
    vel: { x: 20, y: 0 },
    damage: 20,
    life: 2,
    friendly: true,
    radius: 3,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
  for (let i = 0; i < 4; i++) g.updateShots(1 / 60);
  assert(e.hp < hp);
  assert(e.body.velocity.x > 0);
});

test('the extra upgrade remains valid through detours, the escape checkpoint and New Game+', () => {
  const g = new Game(),
    initial = campaignPreset();
  g.start(initial.seed, initial);
  let saved: Checkpoint | null = null;
  g.onCheckpoint = (s) => {
    saved = s;
  };
  removeHostiles(g);
  collect(g);
  g.clear = true;
  g.openReward();
  g.chooseMod(g.offers[0].id);
  g.chooseMod(g.offers[0].id);
  let enteredDetour = false;
  while (g.stage < 19) {
    removeHostiles(g);
    g.clear = true;
    const enter = g.stage === 6 && !g.detour;
    g.openReward(enter);
    assert.equal(g.mode, 'upgrade');
    if (enter) enteredDetour = true;
    g.chooseMod(g.offers[0].id);
    assert(saved && loadCheckpoint(saved), JSON.stringify(saved));
  }
  assert(enteredDetour && g.detours.includes(1));
  removeHostiles(g);
  g.clear = true;
  g.startEscape();
  assert(saved && loadCheckpoint(saved), JSON.stringify(saved));
  const overtime: Checkpoint = {
    ...saved!,
    stage: 0,
    escape: undefined,
    route: undefined,
    overtime: { baseMods: g.mods.length, repairs: 0 },
  };
  assert(loadCheckpoint(overtime));
  const h = new Game();
  h.start(overtime.seed, overtime);
  assert(h.overtime && !h.level.courier && !h.courier.enemy);
  h.stage = 4;
  h.loadRoom();
  assert(!h.level.courier && !h.courier.enemy);
});

test('uncollected cases are forfeited on departure and cannot turn into a later-room reward', () => {
  const g = game();
  removeHostiles(g);
  g.hitEnemy(g.courier.enemy!, 9999);
  assert(g.courier.cargo);
  g.clear = true;
  g.openReward();
  assert(!g.courier.cargo && !g.courierReward);
  assert.equal(g.courier.state?.status, 'lost');
  g.chooseMod(g.offers[0].id);
  removeHostiles(g);
  g.clear = true;
  g.openReward();
  assert(!g.courierReward);
});

test('Practice, Workshop and unrelated focused tests never gain a courier', () => {
  const g = new Game();
  g.startWorkshop([], []);
  assert(!g.courier.enemy && !g.level.courier);
  const save = preset();
  save.seed = 'UNRELATED-TEST';
  g.startTest(save);
  assert(!g.courier.enemy && !g.level.courier);
  const h = new Game();
  h.start(save.seed, save, { kind: 'loader', seed: save.seed });
  assert(!h.courier.enemy && !h.level.courier);
});

function chase(g: Game, hopping: boolean) {
  for (
    let i = 0;
    i < 40 * 60 && g.mode === 'playing' && g.courier.state?.status === 'pending';
    i++
  ) {
    const p = g.player.position,
      target = g.courier.enemy?.body.position ?? g.courier.cargo?.position;
    if (!target) break;
    const dir = Math.sign(target.x - p.x);
    const blocked =
      Query.ray(g.solidBodies, { x: p.x, y: p.y + 10 }, { x: p.x + dir * 65, y: p.y + 10 }, 18)
        .length > 0;
    const sight = distance(g.lineEnd(p, target), target) < 1;
    g.tick(1 / 60, {
      left: dir < 0,
      right: dir > 0,
      jump: g.grounded && (hopping || blocked || target.y < p.y - 35),
      jumpHeld: true,
      fire: !!g.courier.enemy && sight,
      aim: { ...target },
    });
  }
}
test('normal inputs can catch the courier and clear both rooms with a starting gun, upgraded rounds and a beam', () => {
  for (const build of ['starter', 'standard', 'beam'])
    for (const mirror of ['', '&mirror=1']) {
      const g = game('&build=' + build + mirror);
      chase(g, build === 'standard');
      assert.equal(
        g.courier.state?.status,
        'collected',
        JSON.stringify({ build, mirror, hp: g.hp, player: g.player.position }),
      );
      const result = playRoom(g, 90);
      assert(result.clear && result.hp > 0, JSON.stringify({ build, mirror, result }));
    }
});
