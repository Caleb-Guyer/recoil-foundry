import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Enemy, type Shot } from '../src/game.ts';
import { incomingEdgeCues, EDGE_CUE_TIME, type CombatView } from '../src/combat-readability.ts';
import { enemyRemasterTestFromUrl } from '../src/enemy-encounters.ts';
import { REMASTER_TELL } from '../src/enemy-remaster.ts';
import { TWIN_LOCK } from '../src/enemies.ts';
import { fixture, Body, Bodies, Composite } from './branches-fixture.ts';

const view: CombatView = { x: 200, y: 100, w: 800, h: 600 };
const p = { x: 500, y: 300 };
const dt = 1 / 60;
function game(kind: Enemy['kind'] = 'shooter', elite?: Enemy['elite']) {
  const g = fixture([]);
  Body.setPosition(g.player, p);
  const e = g.spawnEnemy(kind, 1100, 300, elite)!;
  e.spawn = 0;
  return { g, e };
}
const read = (g: Game, v = view, enemies: readonly Enemy[] = g.enemies) =>
  incomingEdgeCues(g.shots, g.player.position, v, g.time, g.solidBodies, 28, enemies);
function update(g: Game, e: Enemy, frames = 1) {
  for (let i = 0; i < frames; i++) {
    g.time += dt;
    g.updateEnemy(e, dt);
  }
}
function until(g: Game, e: Enemy, done: () => boolean, frames = 300) {
  for (let i = 0; i < frames && !done(); i++) update(g, e);
  assert(done(), `${e.kind} did not reach the expected real AI state`);
}
function shot(x: number, y: number, target = p, speed = 8, id = 1): Shot {
  const d = Math.hypot(target.x - x, target.y - y);
  return {
    id,
    pos: { x, y },
    prev: { x, y },
    vel: { x: ((target.x - x) / d) * speed, y: ((target.y - y) / d) * speed },
    damage: 20,
    life: 4,
    friendly: false,
    radius: 5,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: true,
    hits: new Set(),
    banks: 0,
    bankGrowth: 0,
    charged: false,
    launch: { pos: { x, y }, at: 0 },
  };
}

test('ordinary shooter and flyer warn only during their actual final aim lock and hand off to their shots', () => {
  for (const kind of ['shooter', 'flyer'] as const) {
    const { g, e } = game(kind);
    e.timer = 0.65;
    assert.equal(read(g).length, 0, kind + ' idle cooldown is not a threat');
    let observed = false;
    while (!g.shots.length) {
      update(g, e);
      if (!g.shots.length && e.timer > 0.35) assert.equal(read(g).length, 0);
      if (!g.shots.length && e.timer <= 0.35) {
        const cues = read(g);
        assert.equal(cues.length, 1, kind + ' must warn before firing');
        assert.equal(cues[0].phase, 'tell');
        assert.equal(cues[0].fireIn, e.timer);
        assert.equal(cues[0].source, e.id);
        observed = true;
      }
    }
    assert(observed);
    assert.equal(g.shots.length, kind === 'flyer' ? 3 : 1);
    assert.equal(read(g).length, 1, 'A volley becomes a single projectile warning');
    assert.equal(read(g)[0].phase, 'shot');
    assert.equal(
      read(g, view, []).length,
      1,
      'An existing projectile does not need a living source',
    );
  }
});

test('real sniper tracking and twin followup produce cues only after their own lock windows', () => {
  const { g, e } = game('sniper', 'twin');
  e.timer = 0;
  update(g, e);
  assert.equal(e.state, 'windup');
  assert.equal(read(g).length, 0);
  until(g, e, () => e.timer <= 0.32);
  const aim = { ...e.aim };
  assert.equal(read(g)[0]?.phase, 'tell');
  Body.setPosition(g.player, { x: 500, y: 500 });
  assert.equal(read(g).length, 0, 'A real dodge leaves the committed lane');
  update(g, e);
  assert.deepEqual(e.aim, aim, 'The AI does not retarget inside its lock');
  Body.setPosition(g.player, p);
  until(g, e, () => g.shots.length === 1);
  assert.equal(e.state, 'followup');
  assert(e.timer > TWIN_LOCK);
  assert.equal(
    incomingEdgeCues([], g.player.position, view, g.time, g.solidBodies, 28, [e]).length,
    0,
  );
  until(g, e, () => e.timer <= TWIN_LOCK);
  assert.equal(
    incomingEdgeCues([], g.player.position, view, g.time, g.solidBodies, 28, [e])[0]?.phase,
    'tell',
  );
  until(g, e, () => g.shots.length === 2);
  assert.equal(e.state, 'recover');
  assert.equal(
    incomingEdgeCues([], g.player.position, view, g.time, g.solidBodies, 28, [e]).length,
    0,
  );
  assert.equal(read(g)[0]?.phase, 'shot');
});

test('remastered ranged AI gives the full fixed-aim warning and hands over without changing attack timing', () => {
  for (const kind of ['shooter', 'flyer'] as const) {
    const g = new Game();
    g.startTest(enemyRemasterTestFromUrl(new URL(`https://test/?test=enemies&unit=${kind}&v=1`))!);
    const e = g.enemies[0];
    e.spawn = 0;
    const player = { x: 600, y: e.body.position.y };
    Body.setPosition(g.player, player);
    const v = { x: 250, y: player.y - 210, w: 600, h: 420 };
    until(g, e, () => e.state === 'windup');
    assert(e.remaster);
    const start = g.time;
    const aim = { ...e.aim };
    const at = { ...e.body.position };
    const initial = read(g, v);
    assert.equal(initial.length, 1, kind);
    assert.equal(initial[0].phase, 'tell');
    assert.equal(initial[0].fireIn, REMASTER_TELL[kind]);
    Body.setPosition(g.player, { x: player.x, y: player.y + 140 });
    assert.equal(read(g, v).length, 0);
    update(g, e, 2);
    assert.deepEqual(e.aim, aim);
    Body.setPosition(g.player, player);
    until(g, e, () => g.shots.length > 0);
    assert(g.time - start >= REMASTER_TELL[kind] - dt);
    assert(g.time - start <= REMASTER_TELL[kind] + dt * 2);
    assert.deepEqual(e.body.position, at);
    assert.equal(e.state, 'recover');
    assert.equal(g.shots.length, kind === 'flyer' ? 3 : 1);
    assert.equal(read(g, v)[0]?.phase, 'shot');
  }
});

test('native slower shots remain warned after the former 0.42 second launch flash and disappear in view', () => {
  const { g, e } = game();
  Body.setPosition(e.body, { x: 1400, y: 300 });
  g.enemyShot(e, Math.PI);
  const native = g.shots[0];
  const initial = structuredClone(native);
  for (let i = 0; i < 40; i++) {
    g.time += dt;
    g.updateShots(dt);
  }
  assert(g.time > 0.42);
  assert(native.pos.x > view.x + view.w + native.radius);
  assert.equal(read(g)[0]?.phase, 'shot');
  assert(read(g)[0].impactIn! > 0 && read(g)[0].impactIn! < EDGE_CUE_TIME);
  const state = structuredClone(native);
  for (let i = 0; i < 10; i++) read(g);
  assert.deepEqual(native, state, 'Querying UI cannot advance or alter the round');
  assert.deepEqual(native.vel, initial.vel);
  while (native.pos.x > view.x + view.w + native.radius) {
    g.time += dt;
    g.updateShots(dt);
  }
  assert.equal(read(g).length, 0, 'The actual visible projectile replaces its edge cue');
});

test('cover and player movement cancel committed tell and projectile cues immediately', () => {
  const { g, e } = game();
  e.timer = 0.25;
  e.aim = { x: -1, y: 0 };
  assert.equal(read(g)[0]?.phase, 'tell');
  const cover = Bodies.rectangle(850, 300, 40, 180, { isStatic: true });
  g.terrain.push(cover);
  Composite.add(g.engine.world, cover);
  Body.setAngle(cover, Math.PI / 7);
  assert.equal(read(g).length, 0);
  Body.setPosition(cover, { x: 850, y: 620 });
  assert.equal(read(g).length, 1);
  g.enemyShot(e, Math.PI);
  assert.equal(read(g).length, 1);
  Body.setPosition(cover, { x: 850, y: 300 });
  assert.equal(read(g).length, 0);
  Body.setPosition(cover, { x: 850, y: 620 });
  Body.setPosition(g.player, { x: 500, y: 500 });
  assert.equal(read(g).length, 0);
  Body.setPosition(g.player, p);
  Body.setPosition(e.body, { x: 950, y: 300 });
  assert.equal(incomingEdgeCues([], p, view, g.time, g.solidBodies, 28, [e]).length, 0);
});

test('cancelled, spawning, allied and unsupported enemy states never become permanent arrows', () => {
  const { g, e } = game();
  e.timer = 0.2;
  e.aim = { x: -1, y: 0 };
  assert.equal(read(g).length, 1);
  for (const change of [
    { hp: 0 },
    { spawn: 0.1 },
    { allied: true },
    { timer: 0.5 },
    { state: 'recover' as const },
    { state: 'return' as const },
    { elite: 'volatile' as const },
    { mutation: { kind: 'gunner' as const, phase: 'idle' as const, timer: 0.2, count: 0 } },
  ]) {
    const copy = { ...e, ...change };
    assert.equal(
      incomingEdgeCues([], p, view, g.time, [], 28, [copy]).length,
      0,
      JSON.stringify(change),
    );
  }
  for (const kind of [
    'runner',
    'charger',
    'hopper',
    'mortar',
    'repairer',
    'relay',
    'fabricator',
  ] as const) {
    const candidate = g.spawnEnemy(kind, 1200, 300)!;
    candidate.spawn = 0;
    candidate.state = 'windup';
    candidate.timer = 0.2;
    candidate.aim = { x: -1, y: 0 };
    assert.equal(incomingEdgeCues([], p, view, g.time, [], 28, [candidate]).length, 0, kind);
  }
  e.state = 'idle';
  e.timer = 0.7;
  assert.equal(read(g).length, 0);
});

test('shutter and strider use real committed fan lanes rather than a guessed center aim', () => {
  for (const kind of ['shutter', 'strider'] as const) {
    const { g, e } = game(kind);
    e.patrol!.variant = kind === 'strider' ? 'strider-volley' : 'shutter-burst';
    e.timer = 0;
    update(g, e);
    assert.equal(e.state, 'windup');
    assert.equal(read(g).length, 0);
    until(g, e, () => e.timer <= 0.4);
    assert.equal(read(g)[0]?.phase, 'tell');
    until(g, e, () => g.shots.length > 0);
    assert.equal(read(g)[0]?.phase, 'shot');
    if (kind === 'shutter') {
      assert.equal(e.state, 'followup');
      assert.equal(incomingEdgeCues([], p, view, g.time, [], 28, [e]).length, 0);
      until(g, e, () => e.timer <= 0.4);
      assert.equal(incomingEdgeCues([], p, view, g.time, [], 28, [e])[0]?.phase, 'tell');
    }
  }
  const { g, e } = game('strider');
  e.spawn = 0;
  e.state = 'windup';
  e.timer = 0.2;
  e.aim = { x: -1, y: 0 };
  // The default paired head has no center round: both real lanes miss at range.
  Body.setPosition(e.body, { x: 1400, y: 300 });
  assert.equal(read(g).length, 0);
});

test('arrival horizon, remaining life and live geometry keep distant or passing rounds quiet', () => {
  const near = shot(1100, 300);
  const far = shot(1900, 300);
  assert.equal(incomingEdgeCues([near], p, view, 20, [], 28).length, 1);
  assert.equal(incomingEdgeCues([far], p, view, 20, [], 28).length, 0);
  assert.equal(incomingEdgeCues([{ ...near, launch: undefined }], p, view, 20, [], 28).length, 1);
  assert.equal(
    incomingEdgeCues([{ ...near, launch: { pos: p, at: 0 } }], p, view, 20, [], 28).length,
    1,
  );
  for (const change of [
    { life: 0.1 },
    { vel: { x: 8, y: 0 } },
    { vel: { x: 0, y: 0 } },
    { pos: { x: 1100, y: 390 } },
    { friendly: true },
    { allied: true },
    { stasis: { phase: 'parked' } as Shot['stasis'] },
  ])
    assert.equal(incomingEdgeCues([{ ...near, ...change }], p, view, 20, [], 28).length, 0);
});

test('nearby volleys merge and four most urgent directions win regardless of insertion order', () => {
  const square = { x: 200, y: 100, w: 600, h: 400 };
  const center = { x: 500, y: 300 };
  const shots = [
    shot(1200, 300, center, 8, 1),
    shot(-200, 300, center, 8, 2),
    shot(500, -400, center, 8, 3),
    shot(500, 1000, center, 8, 4),
    shot(900, 700, center, 30, 99),
    shot(905, 705, center, 30, 100),
  ];
  const before = structuredClone(shots);
  const cues = incomingEdgeCues(shots, center, square, 10, [], 28);
  assert.equal(cues.length, 4);
  assert.equal(cues[0].source, 99);
  assert.equal(cues.filter((cue) => cue.source === 99 || cue.source === 100).length, 1);
  assert.deepEqual(incomingEdgeCues([...shots].reverse(), center, square, 10, [], 28), cues);
  assert.deepEqual(shots, before);
  assert(cues.every((cue) => cue.alpha > 0 && cue.alpha <= 0.85 && Number.isFinite(cue.angle)));
});

test('cue queries consume no RNG and leave actual enemy timers, aim and shots untouched', () => {
  const { g, e } = game('sniper');
  e.timer = 0;
  update(g, e);
  until(g, e, () => e.timer <= 0.32);
  const state = {
    timer: e.timer,
    aim: { ...e.aim },
    target: { ...e.target },
    hp: e.hp,
    state: e.state,
    shots: structuredClone(g.shots),
  };
  const random = Math.random;
  Math.random = () => {
    throw Error('UI consumed randomness');
  };
  try {
    for (let i = 0; i < 100; i++) assert.equal(read(g).length, 1);
  } finally {
    Math.random = random;
  }
  assert.deepEqual(
    { timer: e.timer, aim: e.aim, target: e.target, hp: e.hp, state: e.state, shots: g.shots },
    state,
  );
});

test('shield squad cues use the real raised muzzle and retain inactive physical hulls as blockers', () => {
  const g = fixture([]);
  const player = { x: 500, y: 690 };
  const v = { x: 200, y: 300, w: 800, h: 500 };
  Body.setPosition(g.player, player);
  const lead = g.spawnEnemy('runner', 1000, 724, 'shielded', 0, { kind: 'shield', role: 'lead' })!;
  const support = g.spawnEnemy('shooter', 1115, 724, undefined, 0, {
    kind: 'shield',
    role: 'support',
  })!;
  lead.spawn = support.spawn = 0;
  until(g, support, () => support.state === 'windup');
  assert(support.squad!.connected && lead.squad!.connected);
  assert.equal(read(g, v).length, 0, 'A tracking sight has not committed');
  until(g, support, () => support.timer <= 0.35);
  assert.equal(read(g, v)[0]?.phase, 'tell');
  assert.equal(
    incomingEdgeCues([], player, v, g.time, g.solidBodies, 28, g.enemies, () => false).length,
    0,
  );
  until(g, support, () => g.shots.length > 0);
  assert.equal(g.shots[0].allyBlock, support.id);
  assert.equal(read(g, v)[0]?.phase, 'shot');
  assert.equal(
    incomingEdgeCues(g.shots, player, v, g.time, g.solidBodies, 28, g.enemies, () => false)[0]
      ?.phase,
    'shot',
  );
  Body.setPosition(lead.body, { x: 1000, y: 690 });
  assert.equal(
    incomingEdgeCues(g.shots, player, v, g.time, g.solidBodies, 28, g.enemies, () => false).length,
    0,
    'A frozen or staggered ally still physically stops its squad round',
  );
  g.shots = [];
  support.state = 'windup';
  support.timer = 0.2;
  support.squad!.origin = { x: 1115, y: 690 };
  support.aim = { x: -1, y: 0 };
  Body.setPosition(lead.body, { x: 1000, y: 724 });
  assert.equal(read(g, v)[0]?.phase, 'tell');
  Body.setPosition(support.body, { x: 1140, y: 724 });
  assert.equal(read(g, v).length, 0, 'Moving the mount beyond its real limit cancels the old shot');
});

test('malformed views and projectile values cannot emit non-finite edge marks', () => {
  const s = shot(1100, 300);
  for (const v of [
    { ...view, x: NaN },
    { ...view, y: Infinity },
    { ...view, w: Infinity },
    { ...view, h: -1 },
  ])
    assert.deepEqual(incomingEdgeCues([s], p, v, 10, [], 28), []);
  for (const changes of [
    { life: NaN },
    { damage: Infinity },
    { radius: -1 },
    { pos: { x: Infinity, y: 300 } },
    { vel: { x: NaN, y: 0 } },
  ])
    assert.deepEqual(incomingEdgeCues([{ ...s, ...changes }], p, view, 10, [], 28), []);
});
