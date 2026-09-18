import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { floodgateTestFromUrl, floodgateLevel, planFloodgate } from '../src/floodgate-layout.ts';
import { FLOOD } from '../src/floodgate.ts';
import { loadCheckpoint, distance, type Checkpoint, getGun } from '../src/rules.ts';
import { courierEligible } from '../src/courier-layout.ts';
import { getLevel } from '../src/levels.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { traceTorch } from '../src/torch.ts';
import { dailyForDate } from '../src/daily.ts';
import { damageCauseText } from '../src/damage-cause.ts';
import { playRoom } from './room-pilot.ts';

const { Body, Bodies, Composite, Query } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1500, y: 400 },
};
export function floodPreset(q = '') {
  return floodgateTestFromUrl(new URL('https://test/?test=floodgate' + q))!;
}
export function floodGame(q = '') {
  const g = new Game();
  g.startTest(floodPreset(q));
  return g;
}
function step(g: Game, frames = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < frames; i++) g.tick(1 / 60, { ...idle, ...input });
}
function quiet(g: Game) {
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.shots = [];
}
function flooded(g: Game) {
  quiet(g);
  g.spawnEnemy('shooter', 1550, 419).spawn = 1000;
  g.floodgate.phase = 'rising';
  g.floodgate.surface = FLOOD.ceiling;
}
function shot(g: Game, x: number, y: number, friendly = true) {
  g.addShot({
    pos: { x, y },
    vel: { x: 220, y: 0 },
    damage: 20,
    life: 3,
    friendly,
    radius: 2.5,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
}

test('Floodgate plans are seeded, uncommon, one Cooling room, and respect introductions, events and couriers', () => {
  let count = 0;
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const seed = 'flood-plan-' + i,
      s = planFloodgate(seed);
    assert.equal(s, planFloodgate(seed));
    if (s !== null) {
      count++;
      seen.add(s);
      assert([8, 9].includes(s));
      assert(courierEligible(getLevel(seed, s)));
    }
    const event = {
      kind: 'blackout' as const,
      area: 2,
      relays: [],
      caches: [],
      commander: false,
      rerolls: 0,
    };
    assert.equal(planFloodgate(seed, event), null);
    assert.notEqual(planFloodgate(seed, null, { stage: 8, status: 'pending' }), 8);
  }
  assert(count > 110 && count < 215, String(count));
  assert.equal(seen.size, 2);
});

test('Continue preserves the plan while old saves, Daily retries and unrelated test contexts remain stable', () => {
  let g = new Game(),
    saved: Checkpoint | null = null;
  for (let i = 0; i < 40; i++) {
    g = new Game();
    g.onCheckpoint = (s) => {
      saved = s;
    };
    g.start('flood-save-' + i);
    if (g.floodgate.stage !== null) break;
  }
  assert(saved && g.floodgate.stage !== null && loadCheckpoint(saved));
  const h = new Game();
  h.start(g.seed, saved!);
  assert.equal(h.floodgate.stage, g.floodgate.stage);
  const old = floodPreset();
  delete old.floodgate;
  h.start(old.seed, old);
  assert(!h.floodgate.active);
  const daily = dailyForDate('2026-09-17')!;
  g.start(daily.seed);
  h.start(daily.seed);
  assert.equal(g.floodgate.stage, h.floodgate.stage);
  const q = { ...floodPreset(), seed: 'ANOTHER-TEST' };
  h.startTest(q);
  assert(!h.floodgate.active);
  h.start('WORKSHOP', floodPreset(), null, null, true);
  assert(!h.floodgate.active);
});

test('both mirrored arenas have supported clear spawns, dry upper decks and accessible valve faces', () => {
  const mirrors = new Set();
  for (const q of ['', '&mirror=1']) {
    const g = floodGame(q);
    mirrors.add(g.level.mirrored);
    assert.equal(g.enemies.length + g.waves.doors.length, 10);
    assert.equal(Query.collides(g.player, g.solidBodies).length, 0);
    assert(!g.props.items.length && !g.pressure.items.length && !g.mutations.pending.length);
    for (const s of g.level.spawns) {
      const stats = ENEMY_STATS[s.kind],
        b = Bodies.rectangle(s.x, s.y, stats.w, stats.h);
      assert.equal(Query.collides(b, g.solidBodies).length, 0, JSON.stringify(s));
      if (s.kind === 'shooter')
        assert(
          g.level.solids.some(
            (p) =>
              s.x > p.x + stats.w / 2 &&
              s.x < p.x + p.w - stats.w / 2 &&
              Math.abs(s.y + 16 - p.y) < 1,
          ),
        );
    }
    for (const v of g.floodgate.valves) {
      assert.equal(distance(g.lineEnd({ x: v.x - 60, y: v.y }, v), v), 0);
      assert(v.y + FLOOD.radius < FLOOD.ceiling);
    }
    assert.equal(g.level.solids.filter((p) => p.y < FLOOD.ceiling).length, 3);
  }
  assert.equal(mirrors.size, 2);
});

test('coolant waits for actual reinforcements, rises to its cap, and drains harmlessly after the last enemy', () => {
  const g = floodGame(),
    f = g.floodgate;
  f.update(2);
  assert.equal(f.surface, 740);
  assert.equal(f.phase, 'idle');
  g.waves.phase = 'warning';
  f.update(0.1);
  assert.equal(f.phase, 'warning');
  assert.equal(f.surface, 740);
  g.waves.doors[0].state = 'open';
  f.update(1);
  assert.equal(f.phase, 'rising');
  assert.equal(f.surface, 729);
  Body.setPosition(g.player, { x: 650, y: 400 });
  for (let i = 0; i < 60; i++) f.update(1);
  assert.equal(f.surface, FLOOD.ceiling);
  const hp = g.hp;
  Body.setPosition(g.player, { x: 100, y: 720 });
  quiet(g);
  f.update(0.1);
  assert.equal(f.phase, 'draining');
  assert.equal(g.hp, hp);
  for (let i = 0; i < 60; i++) f.update(0.1);
  assert.equal(f.surface, 740);
  assert.equal(f.phase, 'done');
  assert.equal(g.hp, hp);
  step(g);
  assert(g.clear);
  g.openReward();
  assert.equal(g.mode, 'upgrade');
});

test('each valve works once, drains briefly, resumes rising, and cannot stack stored relief', () => {
  const g = floodGame(),
    f = g.floodgate;
  flooded(g);
  const v = f.valves[0];
  assert(f.trigger(v));
  assert(v.used);
  f.update(1);
  assert.equal(f.surface, 570);
  assert.equal(f.relief, 3);
  assert(!f.trigger(v));
  assert.equal(f.relief, 3);
  assert(f.trigger(f.valves[1]));
  assert.equal(f.relief, 4);
  f.update(4);
  assert.equal(f.surface, 740);
  f.update(1);
  assert.equal(f.surface, 729);
  assert(!f.trigger(f.valves[1]));
  assert(!f.trigger({ ...v, used: false }));
  const early = floodGame();
  early.floodgate.trigger(early.floodgate.valves[0]);
  early.floodgate.update(5);
  assert.equal(early.floodgate.relief, 0);
  assert(early.floodgate.valves[0].used);
});

test('sustained immersion hurts with an escape grace; dry platforms and room clear remain safe', () => {
  const g = floodGame(),
    f = g.floodgate;
  flooded(g);
  Body.setPosition(g.player, { x: 140, y: 720 });
  step(g, 30);
  assert.equal(g.hp, 100);
  step(g, 12);
  assert.equal(g.hp, 91);
  const before = g.hp;
  step(g, 20);
  assert.equal(g.hp, before);
  Body.setPosition(g.player, { x: 650, y: 417 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  step(g, 90);
  assert.equal(g.hp, before);
  assert.equal(f.exposure, 0);
  g.hp = 1;
  Body.setPosition(g.player, { x: 140, y: 720 });
  step(g, 50);
  assert.equal(g.mode, 'dead');
  assert.equal(damageCauseText(g.deathCause), 'Scalding coolant');
});

test('real bullets activate only the nearest exposed valve; cover and hostile fire protect them', () => {
  for (const block of [false, true]) {
    const g = floodGame();
    quiet(g);
    g.clear = false;
    const v = g.floodgate.valves[0];
    if (block) {
      const b = Bodies.rectangle(v.x - 45, v.y, 10, 70, { isStatic: true });
      g.terrain.push(b);
      Composite.add(g.engine.world, b);
    }
    shot(g, v.x - 90, v.y);
    g.updateShots(1 / 60);
    assert.equal(v.used, !block);
  }
  const g = floodGame(),
    v = g.floodgate.valves[0];
  shot(g, v.x - 90, v.y, false);
  g.updateShots(1 / 60);
  assert(!v.used);
});

test('beam, close muzzle and rail rounds reach valves; beams stop at cover', () => {
  for (const build of ['bullet', 'beam', 'rail']) {
    const g = floodGame();
    quiet(g);
    g.clear = false;
    const v = g.floodgate.valves[0];
    Body.setPosition(g.player, { x: v.x - 20, y: v.y + 3 });
    g.aim = { x: v.x + 100, y: v.y + 3 };
    if (build === 'beam') {
      g.mods = ['cutting-torch'];
      g.gun = getGun(g.mods);
      assert(traceTorch(g).some((s) => s.floodValve === v));
      step(g, 1, { fire: true, aim: g.aim });
    } else if (build === 'rail') {
      g.fusions.fireRail({ x: 1, y: 0 }, 30);
      g.updateShots(1 / 60);
    } else {
      g.fireVolley({ x: 1, y: 0 }, 30, false);
      g.updateShots(1 / 60);
    }
    assert(v.used, build);
  }
  const g = floodGame('&build=portal');
  quiet(g);
  g.clear = false;
  const v = g.floodgate.valves[0];
  Body.setPosition(g.player, { x: v.x - 90, y: v.y + 3 });
  g.aim = { x: v.x, y: v.y + 3 };
  const b = Bodies.rectangle(v.x - 45, v.y, 10, 70, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  g.mods = ['cutting-torch'];
  g.gun = getGun(g.mods);
  assert(!traceTorch(g).some((s) => s.floodValve));
  step(g, 1, { fire: true, aim: g.aim });
  assert(!v.used);
});

test('pause, hit stop, death, retry and a new room cannot advance or leak flood state', () => {
  const g = floodGame(),
    f = g.floodgate;
  flooded(g);
  f.trigger(f.valves[0]);
  g.setMode('paused');
  const y = f.surface,
    relief = f.relief;
  step(g, 120);
  assert.equal(f.surface, y);
  assert.equal(f.relief, relief);
  g.setMode('playing');
  g.hitStop = 1;
  step(g, 30);
  assert.equal(f.surface, y);
  g.die();
  step(g, 120);
  assert.equal(f.surface, y);
  g.startTest(floodPreset());
  assert.equal(f.surface, 740);
  assert(f.valves.every((v) => !v.used));
  g.stage = 9;
  g.loadRoom();
  assert(!f.active);
  assert.equal(f.valves.length, 0);
});

test('portal-routed bullets and beams operate the valve on their actual exit path', () => {
  for (const beam of [false, true]) {
    const g = floodGame();
    quiet(g);
    g.clear = false;
    g.mods = beam ? ['fold', 'cutting-torch'] : ['fold'];
    g.gun = getGun(g.mods);
    const v = g.floodgate.valves[0];
    const wall = Bodies.rectangle(260, 400, 40, 600, { isStatic: true });
    g.terrain.push(wall);
    Composite.add(g.engine.world, wall);
    assert(g.portals.place({ x: 280, y: 300 }));
    assert(g.portals.place({ x: v.x, y: 0 }));
    if (beam) {
      Body.setPosition(g.player, { x: 360, y: 303 });
      g.aim = { x: 0, y: 303 };
      assert(traceTorch(g).some((s) => s.floodValve === v));
      step(g, 1, { fire: true, aim: { x: 0, y: 303 } });
    } else {
      shot(g, 350, 300);
      g.shots.at(-1)!.vel.x = -100;
      for (let i = 0; i < 8; i++) g.updateShots(1 / 60);
    }
    assert(v.used);
  }
});

test('ordinary movement and the starting jump escape either staircase without firing or spending valves', () => {
  for (const query of ['', '&mirror=1']) {
    const g = floodGame(query + '&build=starter');
    flooded(g);
    const steps = g.level.solids
      .filter((s) => s.x < 850 && s.y <= 645)
      .sort((a, b) => a.x - b.x)
      .slice(0, 3);
    let index = 0;
    for (let frame = 0; frame < 18 * 60 && index < steps.length && g.mode === 'playing'; frame++) {
      const target = steps[index],
        dx = target.x + target.w / 2 - g.player.position.x;
      const steer = dx - g.player.velocity.x * 10;
      step(g, 1, {
        left: steer < -6,
        right: steer > 6,
        jump: g.grounded && g.player.bounds.max.y > target.y + 30,
      });
      if (
        g.player.velocity.y >= -0.1 &&
        Math.abs(g.player.bounds.max.y - target.y) < 3 &&
        Math.abs(dx) < 16 &&
        Math.abs(g.player.velocity.x) < 1
      )
        index++;
    }
    assert.equal(
      index,
      steps.length,
      JSON.stringify({ query, pos: g.player.position, hp: g.hp, index, steps }),
    );
    assert(g.hp > 0);
    assert.equal(g.shotCount, 0);
    assert(g.floodgate.valves.every((v) => !v.used));
  }
});

test('full-health ordinary-input combat pilots clear both layouts with standard and beam builds', () => {
  for (const query of ['', '&mirror=1', '&build=beam', '&build=beam&mirror=1']) {
    const g = floodGame(query),
      result = playRoom(g, 120);
    assert(result.clear && result.hp > 0, JSON.stringify({ query, ...result }));
    assert.equal(result.kills, 10);
    assert(['draining', 'done'].includes(g.floodgate.phase));
  }
});

test('test links validate legal builds, reject ambiguous inputs and never write campaign or unlock progress', () => {
  for (const q of ['', '&mirror=1', '&build=beam', '&build=portal', '&build=starter']) {
    const p = floodPreset(q);
    assert(loadCheckpoint(p), q);
    const g = new Game();
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.startTest(p);
    g.save();
    g.die();
    assert.equal(writes, 0);
  }
  for (const q of [
    '&test=floodgate',
    '&mirror=0',
    '&mirror=1&mirror=1',
    '&build=no',
    '&area=cooling',
    '&build=beam&build=starter',
  ])
    assert.equal(floodPreset(q), null, q);
  assert.equal(loadCheckpoint({ ...floodPreset(), floodgate: 11 }), null);
  assert.equal(
    loadCheckpoint({ ...floodPreset(), courier: { stage: 8, status: 'pending' } }),
    null,
  );
});
