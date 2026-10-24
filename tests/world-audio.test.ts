import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import type { Level, Spawn } from '../src/levels.ts';
import type { SoundOrigin } from '../src/sound-event.ts';
import { enemyRemasterTestFromUrl } from '../src/enemy-encounters.ts';
import { combatFlowTestFromUrl } from '../src/combat-flow-test.ts';
import { eventTestFromUrl } from '../src/area-events.ts';
import { REINFORCEMENT_TELL } from '../src/reinforcements.ts';
import { shutdownTestFromUrl } from '../src/shutdown-layout.ts';
const { Body, Bodies, Composite } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1200, y: 700 },
};
type Cue = { kind: string; origin?: SoundOrigin };
function capture(g: Game) {
  const cues: Cue[] = [];
  g.onSound = (kind, origin) => cues.push({ kind, origin });
  return cues;
}
function room(spawns: Spawn[]): Level {
  return {
    id: 'world-audio',
    name: 'World audio',
    area: 'furnace',
    boss: false,
    mirrored: false,
    solids: [],
    hazards: [],
    vents: [],
    counterweights: [],
    route: [{ x: 1850, y: 720 }],
    spawns,
    setpiece: { rosters: [spawns.map((_, i) => i)], props: [], weak: [] },
  };
}
function start(spawns: Spawn[] = [{ kind: 'shooter', x: 700, y: 724 }]) {
  const g = new Game();
  g.startTest(
    {
      version: 6,
      seed: 'WORLD-AUDIO',
      stage: 5,
      hp: 100,
      mods: [],
      kills: 0,
      elapsed: 0,
      teamwork: 1,
    },
    room(spawns),
  );
  return g;
}
function at(cue: Cue | undefined, x: number, y: number, suffix?: string) {
  assert(cue?.origin, 'world cue includes an origin');
  assert.equal(cue.origin.x, x);
  assert.equal(cue.origin.y, y);
  assert(Number.isFinite(cue.origin.x) && Number.isFinite(cue.origin.y));
  if (suffix) assert(cue.origin.source?.endsWith(suffix), cue.origin.source);
  return cue.origin;
}
function tick(g: Game, frames = 1) {
  for (let n = 0; n < frames && g.mode === 'playing'; n++) g.tick(1 / 60, idle);
}

test('metadata copies finite positions, protects live state and keeps invalid origins centered', () => {
  const g = start(),
    e = g.enemies[0],
    before = g.checkpointSnapshot(),
    original = { ...e.body.position };
  g.onSound = (_, origin) => {
    if (origin) origin.x = 90000;
  };
  g.soundAt('aim-warn', e.body.position, `enemy:${e.id}`, 'casing');
  assert.deepEqual(e.body.position, original);
  assert.deepEqual(g.checkpointSnapshot(), before);
  const cues = capture(g);
  g.soundAt('lock', { x: Infinity, y: 12 }, 'invalid');
  g.soundAt('lock', { x: 12, y: NaN }, 'invalid');
  assert(cues.every((c) => c.origin === undefined));
});
test('sources stay stable while moving, and reset across room reloads and private Games', () => {
  const g = start(),
    cues = capture(g);
  g.soundAt('lock', { x: 10, y: 20 }, 'enemy:1');
  g.soundAt('lock', { x: 80, y: 20 }, 'enemy:1');
  assert.equal(cues[0].origin?.source, cues[1].origin?.source);
  g.loadRoom();
  g.soundAt('lock', { x: 10, y: 20 }, 'enemy:1');
  assert.notEqual(cues[0].origin?.source, cues.at(-1)?.origin?.source);
  const other = start(),
    b = capture(other);
  other.soundAt('lock', { x: 10, y: 20 }, 'enemy:1');
  assert.notEqual(cues[0].origin?.source, b[0].origin?.source);
});
test('two real gunners preserve simultaneous same-kind warning and shot origins', () => {
  const g = start([
      { kind: 'shooter', x: 600, y: 724 },
      { kind: 'shooter', x: 1100, y: 724 },
    ]),
    cues = capture(g);
  Body.setPosition(g.player, { x: 850, y: 721 });
  for (const e of g.enemies) {
    e.spawn = 0;
    e.timer = 0.36;
  }
  tick(g);
  const warnings = cues.filter((c) => c.kind === 'aim-warn');
  assert.equal(warnings.length, 2);
  for (const e of g.enemies)
    at(
      warnings.find((c) => c.origin?.x === e.body.position.x),
      e.body.position.x,
      724,
      `enemy:${e.id}`,
    );
  assert.notEqual(warnings[0].origin?.source, warnings[1].origin?.source);
  tick(g, 24);
  const shots = cues.filter((c) => c.kind === 'enemy');
  assert.equal(shots.length, 2);
  assert.deepEqual(
    shots.map((c) => c.origin?.source).sort(),
    warnings.map((c) => c.origin?.source).sort(),
  );
  assert(g.shots.some((s) => !s.friendly));
});
for (const kind of ['runner', 'shooter', 'flyer'] as const)
  test(`remastered ${kind} warns from its real actor`, () => {
    const g = new Game();
    g.startTest(enemyRemasterTestFromUrl(new URL(`https://test/?test=enemies&unit=${kind}&v=1`))!);
    const e = g.enemies[0],
      cues = capture(g);
    if (kind === 'runner') Body.setPosition(g.player, { x: 870, y: 722 });
    for (
      let n = 0;
      n < 360 && !cues.some((c) => c.kind === (kind === 'runner' ? 'charge' : 'enemy'));
      n++
    )
      tick(g);
    const cue = cues.find((c) => c.kind === (kind === 'runner' ? 'charge' : 'aim-warn'));
    assert(cue?.origin?.source?.endsWith(`enemy:${e.id}`));
    assert(Number.isFinite(cue.origin.x) && Number.isFinite(cue.origin.y));
  });
for (const kind of ['shutter', 'strider', 'mortar'] as const)
  test(`${kind} actual warning and launch share an actor source`, () => {
    const g = start([{ kind, x: 700, y: 720 }]),
      e = g.enemies[0],
      cues = capture(g);
    e.spawn = 0;
    e.timer = 0;
    g.updateEnemy(e, 1 / 60);
    const warning = cues.find((c) => c.kind === (kind === 'mortar' ? 'kiln-wind' : 'aim-warn'));
    at(warning, e.body.position.x, e.body.position.y, `enemy:${e.id}`);
    e.timer = 0;
    g.updateEnemy(e, 1 / 60);
    assert.equal(cues.find((c) => c.kind === 'enemy')?.origin?.source, warning?.origin?.source);
    assert(kind === 'mortar' ? g.patrolMachines.shells.length > 0 : g.shots.length > 0);
  });
test('repair warning and real healing pulse originate at the support unit', () => {
  const g = start([
    { kind: 'repairer', x: 700, y: 600, teamwork: true },
    { kind: 'shooter', x: 850, y: 724, teamwork: true },
  ]);
  const owner = g.enemies.find((e) => e.kind === 'repairer')!,
    target = g.enemies.find((e) => e.kind === 'shooter')!,
    cues = capture(g);
  owner.spawn = target.spawn = 0;
  target.hp -= 16;
  owner.support!.timer = 0;
  g.teamwork.tick(1 / 60);
  at(
    cues.find((c) => c.kind === 'repair-warn'),
    owner.body.position.x,
    owner.body.position.y,
    `enemy:${owner.id}`,
  );
  owner.support!.timer = 0;
  const hp = target.hp;
  g.teamwork.tick(1 / 60);
  assert(target.hp > hp);
  assert.equal(cues.find((c) => c.kind === 'repair-pulse')?.origin?.source, cues[0].origin?.source);
});
test('real enemy damage reports casing, shield armor and destruction with unchanged damage', () => {
  const g = start(),
    e = g.enemies[0],
    cues = capture(g);
  e.spawn = 0;
  const before = e.hp;
  g.hitEnemy(e, 5, { x: 100, y: 724 });
  assert.equal(e.hp, before - 5);
  assert.equal(cues.find((c) => c.kind === 'hit')?.origin?.material, 'casing');
  g.hitEnemy(e, 9999);
  at(
    cues.find((c) => c.kind === 'kill'),
    e.body.position.x,
    e.body.position.y,
    `enemy:${e.id}`,
  );
  assert.equal(cues.find((c) => c.kind === 'kill')?.origin?.material, 'casing');
  const shield = g.spawnEnemy('shutter', 900, 720)!;
  shield.spawn = 0;
  shield.facing = 1;
  shield.state = 'idle';
  const hp = shield.hp;
  g.hitEnemy(shield, 10, { x: 1000, y: 720 });
  assert.equal(shield.hp, hp - 3);
  const armor = cues.find((c) => c.kind === 'armor');
  assert.equal(armor?.origin?.material, 'armor');
  assert(armor?.origin?.source?.endsWith(`enemy:${shield.id}`));
});
test('real cover and terrain damage carry distinct materials and physical hull positions', () => {
  const g = start(),
    cues = capture(g),
    prop = g.props.spawn('cover', 600, 698);
  g.props.hit(prop, 5, { x: 0, y: 0 });
  at(
    cues.find((c) => c.kind === 'prop'),
    600,
    698,
    `prop:${prop.body.id}`,
  );
  g.props.hit(prop, 1000, { x: 0, y: 0 });
  assert.equal(cues.find((c) => c.kind === 'break')?.origin?.material, 'cover');
  assert(!g.props.items.includes(prop));
  const b = Bodies.rectangle(1200, 600, 180, 22, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  g.destruction.register(b, { x: 1110, y: 589, w: 180, h: 22 });
  g.destruction.hitBody(b, 1000, { x: 0, y: 0 });
  at(
    cues.find((c) => c.kind === 'break' && c.origin?.material === 'terrain'),
    1200,
    600,
    `terrain:${b.id}`,
  );
  assert(!g.terrain.includes(b));
});
test('ordinary physical bullet emits terrain feedback at its actual swept collision point', () => {
  const g = start(),
    cues = capture(g),
    b = Bodies.rectangle(600, 400, 30, 200, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  g.addShot({
    pos: { x: 550, y: 400 },
    vel: { x: 25, y: 0 },
    damage: 10,
    life: 2,
    friendly: true,
    radius: 2,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
  for (let n = 0; n < 4; n++) g.updateShots(1 / 60);
  const cue = cues.find((c) => c.origin?.source?.endsWith(`surface:${b.id}`));
  assert.equal(cue?.origin?.material, 'terrain');
  assert(cue.origin.x >= 582 && cue.origin.x <= 586);
  assert.equal(cue.origin.y, 400);
});
test('blackout cabinet emits power feedback at its real permanent hull', () => {
  const g = new Game();
  g.startTest(eventTestFromUrl(new URL('https://test/?test=events&event=blackout'))!);
  const box = g.areaEvents.fuseBox!,
    before = { ...box.body.position },
    cues = capture(g);
  g.props.hit(box, 1, { x: 1, y: 0 }, undefined, true);
  at(
    cues.find((c) => c.origin?.material === 'power'),
    before.x,
    before.y,
    `fuse:${box.body.id}`,
  );
  assert(g.areaEvents.powered && g.props.items.includes(box));
  assert.deepEqual(box.body.position, before);
  assert(box.body.isStatic && !box.body.isSensor);
});
test('authored reserve groups announce every actual door without shortening their tell', () => {
  const g = new Game();
  g.startTest(combatFlowTestFromUrl(new URL('https://test/?test=flow&room=upper-return&v=1'))!);
  const cues = capture(g);
  for (const e of [...g.enemies]) g.hitEnemy(e, 99999, undefined, false, false);
  g.hitStop = 0;
  for (let n = 0; n < 500 && g.waves.phase !== 'warning'; n++) g.waves.update(1 / 60);
  const doors = g.waves.doors.filter((d) => d.state === 'warning'),
    arrivals = cues.filter((c) => c.kind === 'reinforce');
  assert(doors.length > 0);
  assert.equal(arrivals.length, doors.length);
  assert.equal(new Set(arrivals.map((c) => c.origin?.source)).size, doors.length);
  for (const d of doors) {
    at(
      arrivals.find((c) => c.origin?.x === d.spawn.x),
      d.spawn.x,
      d.spawn.y,
      `door:${g.waves.doors.indexOf(d)}`,
    );
    assert.equal(d.timer, REINFORCEMENT_TELL);
  }
});
test('legacy capture callbacks and mutating metadata consumers preserve actual simulation', () => {
  const a = start(),
    b = start(),
    kinds: string[] = [];
  a.onSound = (kind) => kinds.push(kind);
  b.onSound = (_, origin) => {
    if (origin) {
      origin.x = -99999;
      origin.y = NaN;
      origin.source = 'edited';
    }
  };
  for (const g of [a, b]) {
    g.enemies[0].spawn = 0;
    g.enemies[0].timer = 0.36;
  }
  tick(a, 40);
  tick(b, 40);
  assert(kinds.includes('aim-warn') && kinds.includes('enemy'));
  assert.deepEqual(a.checkpointSnapshot(), b.checkpointSnapshot());
  const physics = (g: Game) => ({
    player: { ...g.player.position },
    enemies: g.enemies.map((e) => ({
      p: { ...e.body.position },
      hp: e.hp,
      timer: e.timer,
      state: e.state,
    })),
    shots: g.shots.map((s) => ({
      p: { ...s.pos },
      v: { ...s.vel },
      life: s.life,
      damage: s.damage,
    })),
  });
  assert.deepEqual(physics(a), physics(b));
});

test('real vent, fan and conductor warnings retain their own mechanical origin', () => {
  const g = start(),
    cues = capture(g);
  const vent = g.pressure.spawn({
    x: 640,
    y: 738,
    dir: { x: 0, y: -1 },
    valve: { x: 590, y: 714 },
    width: 84,
    length: 420,
    offset: 0,
  });
  vent.phase = 'ready';
  assert(g.pressure.trigger(vent));
  at(
    cues.find((c) => c.kind === 'pressure-warn'),
    590,
    714,
    'vent:0',
  );
  g.level.fans = [{ x: 850, y: 600, dir: { x: 1, y: 0 }, width: 150, length: 500, offset: 0 }];
  g.crosswind.reset();
  g.crosswind.items[0].timer = 0;
  g.crosswind.beforeStep(1 / 60);
  at(
    cues.find((c) => c.kind === 'fan-warn'),
    850,
    600,
    'fan:0',
  );
  g.level.conductors = [{ x: 1100, width: 200 }];
  g.stormfront.reset();
  g.stormfront.timer = 0;
  g.stormfront.beforeStep(1 / 60);
  at(
    cues.find((c) => c.kind === 'storm-warn'),
    1100,
    8,
    'storm:0',
  );
});

test('actual shutdown switch routes its electrical break through the power material cue', () => {
  const g = new Game();
  g.startTest(shutdownTestFromUrl(new URL('https://test/?test=shutdown&scene=relay'))!);
  const p = g.shutdown.target!,
    cues = capture(g);
  Body.setPosition(g.player, { x: p.x + 70, y: p.y });
  assert(g.shutdown.trigger());
  at(
    cues.find((c) => c.kind === 'shutdown-break'),
    p.x,
    p.y,
    'shutdown-switch',
  );
  assert.equal(cues.find((c) => c.kind === 'shutdown-break')?.origin?.material, 'power');
});
