import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input, type Shot } from '../src/game.ts';
import type { Solid } from '../src/levels.ts';
import { getGun, seeded, type Checkpoint } from '../src/rules.ts';
import { CABLE_HP, CARGO_TELL } from '../src/cargo.ts';
import { LEDGE_HP } from '../src/destruction.ts';
import {
  materialPropSnapshot,
  materialTerrainSnapshot,
  materialPose,
  materialBreakPose,
  MATERIAL_BREAK_LIMIT,
  MATERIAL_BREAK_LIFE,
  MATERIAL_HIT_LIFE,
} from '../src/material-response.ts';
const { Bodies, Body, Composite, Engine } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1800, y: 450 },
};
function setup(enabled = true) {
  const g = new Game();
  g.materialResponse.enabled = enabled;
  g.start('RF-C111-MATERIAL546');
  g.hazards.clear();
  g.breaches.clear();
  g.conveyors.clear();
  g.waves.clear();
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.destruction.clear();
  g.level.solids = [];
  g.level.route = [];
  Body.setPosition(g.player, { x: 180, y: 500 });
  return g;
}
function piece(g: Game, rect: Solid = { x: 700, y: 610, w: 80, h: 130 }) {
  const b = Bodies.rectangle(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w, rect.h, {
    isStatic: true,
    label: 'terrain',
  });
  Composite.add(g.engine.world, b);
  g.terrain.push(b);
  g.level.solids.push({ ...rect });
  return g.destruction.register(b, rect);
}
function ticks(g: Game, count = 1) {
  for (let i = 0; i < count; i++) g.tick(1 / 60, idle);
}
function shot(g: Game, pos = { x: 620, y: 650 }, vel = { x: 90, y: 0 }, damage = 150): Shot {
  g.addShot({
    pos,
    vel,
    damage,
    life: 1,
    radius: 2,
    friendly: true,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
  return g.shots.at(-1)!;
}
function native(g: Game) {
  const body = (b: Matter.Body) => ({
    label: b.label,
    position: { ...b.position },
    velocity: { ...b.velocity },
    angle: b.angle,
    angularVelocity: b.angularVelocity,
    mass: b.mass,
    inertia: b.inertia,
    isStatic: b.isStatic,
    friction: b.friction,
    restitution: b.restitution,
    filter: { ...b.collisionFilter },
  });
  return {
    seed: g.seed,
    mode: g.mode,
    time: g.time,
    elapsed: g.elapsed,
    hp: g.hp,
    kills: g.kills,
    clear: g.clear,
    stage: g.stage,
    hitStop: g.hitStop,
    player: body(g.player),
    mods: [...g.mods],
    scrap: g.scrap.loaded,
    plate: g.support.plateUntil,
    plateReady: g.support.plateReadyAt,
    broken: structuredClone(g.destruction.broken),
    solids: structuredClone(g.level.solids),
    route: structuredClone(g.level.route),
    props: g.props.items.map((p) => ({
      kind: p.kind,
      hp: p.hp,
      maxHp: p.maxHp,
      armedAt: p.armedAt,
      detonateAt: p.detonateAt,
      playerArmed: p.playerArmed,
      flash: p.flash,
      expires: p.expires,
      throwUntil: p.throwUntil,
      body: body(p.body),
      cargo: p.cargo
        ? {
            state: p.cargo.state,
            cableHp: p.cargo.cableHp,
            releaseAt: p.cargo.releaseAt,
            impactAt: p.cargo.impactAt,
            dropEndedAt: p.cargo.dropEndedAt,
          }
        : null,
    })),
    terrain: g.destruction.pieces.map((p) => ({
      hp: p.hp,
      flash: p.flash,
      rect: { ...p.rect },
      body: body(p.body),
    })),
    enemies: g.enemies.map((e) => ({
      kind: e.kind,
      hp: e.hp,
      spawn: e.spawn,
      state: e.state,
      timer: e.timer,
      body: body(e.body),
    })),
    shots: g.shots.map((s) => ({
      position: { ...s.pos },
      velocity: { ...s.vel },
      damage: s.damage,
      life: s.life,
      bounces: s.bounces,
      pierce: s.pierce,
    })),
    world: Composite.allBodies(g.engine.world)
      .map(body)
      .sort(
        (a, b) =>
          a.label.localeCompare(b.label) ||
          a.position.x - b.position.x ||
          a.position.y - b.position.y,
      ),
  };
}

test('material snapshots, contacts, fragments and poses are detached pure reads with no random draws or Matter IDs', () => {
  const g = setup(),
    crate = g.props.spawn('crate', 600, 500),
    wall = piece(g);
  g.props.hit(crate, 20, { x: 1, y: 0 });
  const before = native(g),
    random = Math.random,
    rng = g.rng,
    nextId = (Matter.Common as any)._nextId;
  Math.random = () => {
    throw new Error('Material presentation cannot draw randomness');
  };
  g.rng = () => {
    throw new Error('Material presentation cannot draw combat randomness');
  };
  try {
    g.materialResponse.propHit(crate, 20, { x: 1, y: 0 });
    g.materialResponse.terrainHit(wall, 20, { x: 0, y: 1 });
    g.materialResponse.propBreak(crate, 'fracture');
    for (let i = 0; i < 8; i++) {
      const s = materialPropSnapshot(g, crate)!,
        saved = structuredClone(s),
        pose = materialPose(s, g.time + i / 60, i % 2 === 0);
      assert.deepEqual(s, saved);
      s.position.x = -1000;
      s.vertices[0].y = 999;
      if (s.hit?.direction) s.hit.direction.x = -99;
      pose.offset.x = 999;
      materialTerrainSnapshot(g, wall)!.vertices[0].x = -999;
      const record = g.materialResponse.breaks[0],
        copied = structuredClone(record),
        debris = materialBreakPose(record, g.time + i / 60, i % 2 === 0);
      debris.fragments[0].position.x = -999;
      debris.fragments[0].size.x = 999;
      assert.deepEqual(record, copied);
      g.materialResponse.update();
    }
  } finally {
    Math.random = random;
    g.rng = rng;
  }
  assert.equal((Matter.Common as any)._nextId, nextId);
  assert.deepEqual(native(g), before);
});

test('only real accepted positive hits record rotated local contacts and actual health wear', () => {
  const g = setup(),
    p = g.props.spawn('crate', 600, 500);
  Body.setAngle(p.body, Math.PI / 2);
  g.props.hit(p, 0, { x: 1, y: 0 });
  assert.equal(materialPropSnapshot(g, p)!.hit, null);
  g.props.hit(p, 44, { x: 1, y: 0 });
  const s = materialPropSnapshot(g, p)!;
  assert.equal(s.hp, 76);
  assert.equal(s.wear, 1);
  assert.deepEqual(s.hit!.direction, { x: 1, y: 0 });
  assert(Math.abs(s.hit!.local!.x) < 1e-6);
  assert(Math.abs(s.hit!.local!.y - 22) < 1e-6);
  g.props.hit(p, 42, { x: 0, y: -1 });
  assert.equal(materialPropSnapshot(g, p)!.wear, 2);
  const before = materialPropSnapshot(g, p)!.hit;
  g.materialResponse.propHit(p, NaN, { x: 1, y: 0 });
  assert.deepEqual(materialPropSnapshot(g, p)!.hit, before);
  g.props.remove(p);
  g.props.hit(p, 1, { x: 1, y: 0 });
  assert.equal(materialPropSnapshot(g, p), null);
});

test('accepted legacy sparse shot sources safely retain native material damage without positional metadata', () => {
  const sources = [
    undefined,
    {},
    { friendly: true },
    { friendly: true, pos: undefined },
    { friendly: true, pos: null },
    { friendly: true, pos: { x: 3 } },
    { friendly: true, pos: { x: NaN, y: 1 } },
  ];
  for (const source of sources) {
    const run = (enabled: boolean) => {
      const g = setup(enabled),
        wall = piece(g),
        crate = g.props.spawn('crate', 500, 500);
      g.destruction.hitBody(wall.body, 20, { x: 1, y: 0 }, source as Shot | undefined);
      g.props.hit(crate, 20, { x: 0, y: -1 }, source as Shot | undefined);
      assert.equal(wall.hp, 90);
      assert.equal(crate.hp, 100);
      if (enabled) {
        const hit = materialTerrainSnapshot(g, wall)!.hit;
        assert.deepEqual(hit!.direction, { x: 1, y: 0 });
        assert.deepEqual(hit!.local, { x: -40, y: 0 });
        assert(materialPropSnapshot(g, crate)!.hit!.local);
      }
      return { native: native(g), nextRandom: g.rng() };
    };
    const random = Math.random;
    try {
      Math.random = seeded('legacy-source-cosmetics');
      const observed = run(true);
      Math.random = seeded('legacy-source-cosmetics');
      const baseline = run(false);
      assert.deepEqual(observed, baseline);
    } finally {
      Math.random = random;
    }
  }
});

for (const angle of [0, Math.PI / 6])
  test(`a real swept radius graze keeps its accepted local hull contact at angle ${angle}`, () => {
    const run = (enabled: boolean) => {
      const g = setup(enabled),
        p = g.props.spawn('crate', 700, 500),
        rotate = (v: { x: number; y: number }) => ({
          x: v.x * Math.cos(angle) - v.y * Math.sin(angle),
          y: v.x * Math.sin(angle) + v.y * Math.cos(angle),
        }),
        start = rotate({ x: -60, y: 25 }),
        velocity = rotate({ x: 90, y: 0 });
      Body.setAngle(p.body, angle);
      g.addShot({
        pos: { x: 700 + start.x, y: 500 + start.y },
        vel: velocity,
        radius: 4,
        damage: 22,
        life: 1,
        friendly: true,
        bounces: 0,
        pierce: 0,
        fragment: false,
        split: false,
      });
      g.updateShots(1 / 60);
      assert.equal(p.hp, 98, 'The native radius sweep must actually accept the edge hit');
      if (enabled) {
        const hit = materialPropSnapshot(g, p)!.hit!;
        assert(hit.local, 'Accepted radius-only contact must retain a local reaction');
        assert(Math.abs(hit.local.x + 22) < 1e-6);
        assert(Math.abs(hit.local.y - 22) < 1e-6);
        assert(Math.abs(hit.direction!.x - Math.cos(angle)) < 1e-6);
        assert(Math.abs(hit.direction!.y - Math.sin(angle)) < 1e-6);
      }
      return native(g);
    };
    const random = Math.random;
    try {
      Math.random = seeded('native-edge-cosmetics');
      const observed = run(true);
      Math.random = seeded('native-edge-cosmetics');
      const baseline = run(false);
      assert.deepEqual(
        observed,
        baseline,
        'Local presentation must not change the accepted native hit or trajectory',
      );
    } finally {
      Math.random = random;
    }
  });

test('owner-specific gear, physical rubble and unregistered terrain never enter the observer', () => {
  const g = setup();
  for (const flag of ['hunt', 'uprising', 'auditCase', 'welded', 'charge'] as const) {
    const p = g.props.spawn('crate', 500, 500);
    (p as any)[flag] = flag === 'hunt' ? 'plate' : flag === 'uprising' ? 'generator' : true;
    assert.equal(materialPropSnapshot(g, p), null);
    g.materialResponse.propHit(p, 20, { x: 1, y: 0 });
    g.materialResponse.propBreak(p, 'fracture');
    assert.equal(g.materialResponse.breaks.length, 0);
  }
  for (const kind of ['rubble', 'charge', 'fuse'] as const)
    assert.equal(materialPropSnapshot(g, g.props.spawn(kind, 600, 500)), null);
  const p = piece(g);
  assert.equal(materialTerrainSnapshot(g, { ...p }), null);
});

test('real fracture captures each ordinary material once and leaves native removals and solid rubble authoritative', () => {
  const shapes = ['board', 'plate', 'plate'] as const;
  for (const [i, kind] of (['crate', 'cover', 'cargo'] as const).entries()) {
    const g = setup(),
      p = g.props.spawn(kind, 650, 500),
      before = Composite.allBodies(g.engine.world).length;
    g.props.hit(p, 999, { x: 1, y: 0 });
    const record = g.materialResponse.breaks[0];
    assert(record);
    assert.equal(record.cause, 'fracture');
    assert.equal(record.snapshot.kind, kind);
    assert.equal(record.fragments[0].shape, shapes[i]);
    assert.equal(Composite.allBodies(g.engine.world).length, before - 1);
    assert(!g.solidBodies.includes(p.body));
    g.props.break(p);
    assert.equal(g.materialResponse.breaks.length, 1);
  }
  const g = setup(),
    wall = piece(g),
    shelf = piece(g, { x: 1000, y: 450, w: 180, h: 22 });
  g.destruction.hitBody(wall.body, 110, { x: 1, y: 0 });
  g.destruction.hitBody(shelf.body, LEDGE_HP, { x: 0, y: 1 });
  assert.deepEqual(
    g.materialResponse.breaks.map((b) => b.snapshot.kind),
    ['wall', 'shelf'],
  );
  const rubble = g.props.items.filter((p) => p.kind === 'rubble');
  assert(rubble.length > 0);
  assert(
    rubble.every(
      (p) => g.solidBodies.includes(p.body) && Composite.allBodies(g.engine.world).includes(p.body),
    ),
  );
  assert(rubble.every((p) => materialPropSnapshot(g, p) === null));
});

test('canisters show their exact grace and armed impact states without inventing a fuse countdown', () => {
  const g = setup(),
    fuel = g.props.spawn('canister', 600, 500);
  g.engine.gravity.y = 0;
  assert.equal(materialPose(materialPropSnapshot(g, fuel)!).canister, 'sealed');
  g.props.hit(fuel, 5, { x: 1, y: 0 }, undefined, true);
  assert.equal(fuel.armedAt, 0.06);
  assert.equal(fuel.detonateAt, Infinity);
  assert.equal(materialPose(materialPropSnapshot(g, fuel)!).canister, 'grace');
  g.time = 0.061;
  assert.equal(materialPose(materialPropSnapshot(g, fuel)!).canister, 'armed');
  g.time = 2;
  g.props.afterStep(0);
  assert(g.props.items.includes(fuel));
  assert.equal(g.materialResponse.breaks.length, 0);
  const wall = Bodies.rectangle(690, 500, 20, 150, { isStatic: true });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  g.time = 2.01;
  fuel.armedAt = 2.07;
  g.props.impacts.push({ prop: fuel, other: wall, speed: 7, incomingSpeed: 0 });
  g.props.afterStep(0);
  assert.equal(fuel.detonateAt, 2.07);
  assert.equal(materialPose(materialPropSnapshot(g, fuel)!).canister, 'grace');
  g.time = 2.071;
  assert.equal(materialPose(materialPropSnapshot(g, fuel)!).canister, 'impact');
  g.props.afterStep(0);
  assert(!g.props.items.includes(fuel));
  assert.equal(g.materialResponse.breaks[0].cause, 'explosion');
});

test('direct heavy contact and chained canisters record immediate real explosions, including sealed hulls', () => {
  const g = setup(),
    a = g.props.spawn('canister', 600, 500),
    b = g.props.spawn('canister', 680, 500);
  g.props.strike(a, 140, { x: 1, y: 0 });
  assert(!g.props.items.includes(a) && !g.props.items.includes(b));
  assert.equal(g.materialResponse.breaks.length, 2);
  for (const record of g.materialResponse.breaks) {
    assert.equal(record.cause, 'explosion');
    assert.equal(record.snapshot.armedAt, Infinity);
    assert.equal(materialPose(record.snapshot).canister, 'sealed');
  }
});

test('breaking a real shelf releases native cover and keeps its fragment overlay separate from support physics', () => {
  const g = setup(),
    shelf = piece(g, { x: 650, y: 450, w: 280, h: 22 }),
    cover = g.props.spawn('cover', 875, 407);
  assert(cover.body.isStatic);
  g.destruction.hitBody(shelf.body, LEDGE_HP, { x: 0, y: 1 });
  assert(!cover.body.isStatic);
  const start = cover.body.position.y;
  ticks(g, 18);
  assert(cover.body.position.y > start + 5);
  assert.equal(g.materialResponse.breaks.filter((b) => b.snapshot.kind === 'shelf').length, 1);
});

test('Paused and hit-stop simulation freeze records; retry, room transition, title and death clear them', () => {
  const g = setup();
  g.props.break(g.props.spawn('crate', 600, 500));
  ticks(g, 2);
  g.setMode('paused');
  const frozen = structuredClone(g.materialResponse.breaks);
  ticks(g, 60);
  assert.deepEqual(g.materialResponse.breaks, frozen);
  g.setMode('playing');
  g.hitStop = 0.2;
  ticks(g, 5);
  assert.deepEqual(g.materialResponse.breaks, frozen);
  g.hitStop = 0;
  ticks(g);
  assert(g.materialResponse.breaks[0].age > frozen[0].age);
  g.loadRoom();
  assert.equal(g.materialResponse.breaks.length, 0);
  g.props.break(g.props.spawn('crate', 600, 500));
  g.start('RF-C111-MATERIAL546');
  assert.equal(g.materialResponse.breaks.length, 0);
  for (const mode of ['dead', 'title'] as const) {
    g.setMode('playing');
    g.props.break(g.props.spawn('crate', 600, 500));
    assert(g.materialResponse.breaks.length);
    g.setMode(mode);
    assert.equal(g.materialResponse.breaks.length, 0);
  }
});

test('records remain bounded and expire by simulation time while Reduced Effects holds steady geometry', () => {
  const g = setup();
  for (let i = 0; i < 50; i++) {
    g.props.break(g.props.spawn('crate', 600, 500));
    g.time += 0.001;
  }
  assert.equal(g.materialResponse.breaks.length, MATERIAL_BREAK_LIMIT);
  assert(g.materialResponse.breaks.every((b) => b.fragments.length <= 8));
  const r = g.materialResponse.breaks[0],
    a = materialBreakPose(r, r.at + 0.1, true),
    b = materialBreakPose(r, r.at + 0.8, true);
  assert.deepEqual(a.fragments, b.fragments);
  const p = g.props.spawn('cover', 900, 500);
  g.props.hit(p, 25, { x: 1, y: 0 });
  const s = materialPropSnapshot(g, p)!;
  assert.deepEqual(materialPose(s, g.time, true).offset, { x: 0, y: 0 });
  assert.equal(materialPose(s, g.time, true).hitStrength, 0);
  g.time += MATERIAL_BREAK_LIFE + 0.01;
  g.materialResponse.update();
  assert.equal(g.materialResponse.breaks.length, 0);
  assert.equal(materialPropSnapshot(g, p)!.hit, null);
  assert.equal(materialPropSnapshot(g, p)!.wear, s.wear);
});

function trace(enabled: boolean, scenario: 'launch' | 'blast' | 'terrain' | 'cargo') {
  const random = Math.random;
  Math.random = seeded('material-existing-cosmetics');
  try {
    const g = setup(enabled),
      frames: unknown[] = [],
      sounds: string[] = [],
      saves: unknown[] = [];
    g.onSound = (s) => sounds.push(s);
    g.onCheckpoint = (s) => saves.push(structuredClone(s));
    g.mods = ['scrap-feed', 'scrap-armor'];
    g.gun = getGun(g.mods);
    const crate = g.props.spawn('crate', 560, 690);
    let weak: ReturnType<typeof piece> | undefined,
      load: ReturnType<typeof g.props.spawn> | undefined,
      fuel: ReturnType<typeof g.props.spawn> | undefined;
    if (scenario === 'launch') {
      g.spawnEnemy('shooter', 780, 700);
      g.enemies.at(-1)!.spawn = 0;
      g.enemies.at(-1)!.timer = 999;
    }
    if (scenario === 'blast') {
      fuel = g.props.spawn('canister', 600, 650);
      g.props.spawn('canister', 660, 650);
      g.props.spawn('cover', 710, 650);
      g.spawnEnemy('shooter', 780, 650);
      g.enemies.at(-1)!.spawn = 0;
      g.enemies.at(-1)!.timer = 999;
    }
    if (scenario === 'terrain') {
      weak = piece(g, { x: 650, y: 450, w: 280, h: 22 });
      g.props.spawn('cover', 875, 407);
    }
    if (scenario === 'cargo') {
      weak = piece(g, { x: 700, y: 610, w: 80, h: 130 });
      load = g.cargo.spawn({ x: 740, y: 350, anchorY: 200 });
    }
    for (let i = 0; i < 110; i++) {
      if (i === 2) {
        if (scenario === 'launch') g.props.hit(crate, 25, { x: 1, y: 0 });
        if (scenario === 'blast') g.props.strike(fuel!, 140, { x: 1, y: 0 });
        if (scenario === 'terrain')
          g.destruction.hitBody(weak!.body, LEDGE_HP, { x: 0, y: 1 }, shot(g));
        if (scenario === 'cargo') g.cargo.cut(load!, CABLE_HP);
      }
      ticks(g);
      frames.push(native(g));
    }
    g.save();
    return { frames, sounds, saves, checkpoint: g.checkpointSnapshot(), nextRandom: g.rng() };
  } finally {
    Math.random = random;
  }
}
for (const scenario of ['launch', 'blast', 'terrain', 'cargo'] as const)
  test(`observer enabled/disabled preserves native ${scenario} physics, damage, occlusion, support, scrap, RNG and saves`, () => {
    const observed = trace(true, scenario),
      baseline = trace(false, scenario);
    assert.deepEqual(observed, baseline);
    if (scenario === 'blast') {
      assert(observed.sounds.filter((s) => s === 'explode').length === 2);
      const frames = observed.frames as any[];
      assert.equal(
        frames.at(-1).enemies[0].hp,
        frames[0].enemies[0].hp,
        'Cover must still occlude both chain blasts before destruction',
      );
    }
    if (scenario === 'terrain') assert(observed.frames.some((f: any) => f.scrap && f.plate > 0));
    if (scenario === 'cargo')
      assert(
        observed.frames.some((f: any) => f.props.some((p: any) => p.cargo?.state === 'loose')),
      );
  });

test('ordinary material observations do not enter version-six checkpoints or change older Continue identities', () => {
  for (const seed of ['RF-C108-OLDMATERIAL', 'RF-C111-NEWMATERIAL']) {
    const g = new Game();
    g.start(seed);
    g.props.break(g.props.spawn('crate', 600, 500));
    let saved: Checkpoint | null = null;
    g.onCheckpoint = (s) => (saved = s);
    g.save();
    assert(saved);
    assert(!JSON.stringify(saved).includes('materialResponse'));
    assert(!JSON.stringify(saved).includes('fragments'));
    const cp = saved as Checkpoint;
    assert.equal(cp.seed, seed);
    const h = new Game();
    h.start(cp.seed, cp);
    assert.equal(h.seed, seed);
    assert.equal(h.materialResponse.breaks.length, 0);
    assert.deepEqual(h.checkpointSnapshot().mods, cp.mods);
    assert.equal(h.stage, cp.stage);
  }
});
