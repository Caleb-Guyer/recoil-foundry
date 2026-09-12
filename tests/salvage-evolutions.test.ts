import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import {
  getGun,
  availableMods,
  rewardMods,
  seeded,
  validBuild,
  loadCheckpoint,
  MOD_REQUIRES,
  modPathLabel,
} from '../src/rules.ts';
import { salvageTestFromUrl } from '../src/practice.ts';
import { WRECK_LIMIT, WRECK_LIFE, FLASH_RADIUS } from '../src/salvage-evolutions.ts';
import { SLIPSTREAM_LIFE } from '../src/boss-salvage.ts';
const { Body, Bodies, Composite, Engine } = Matter;
const dt = 1 / 60;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 0, y: 400 },
};
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function fixture(mods: string[]) {
  const g = new Game();
  g.start('evolution-physics');
  g.waves.clear();
  g.hazards.clear();
  g.breaches.clear();
  g.conveyors.clear();
  g.destruction.clear();
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.level.solids = [];
  g.level.route = [];
  g.mods = mods;
  g.gun = getGun(mods);
  g.engine.gravity.y = 0;
  Body.setPosition(g.player, { x: 400, y: 400 });
  return g;
}
function enemy(g: Game, x = 600, y = 400, kind: Enemy['kind'] = 'shooter', elite?: Enemy['elite']) {
  g.spawnEnemy(kind, x, y, elite);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.timer = 100;
  return e;
}
function wall(g: Game, x = 600, y = 450, w = 200, h = 20) {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  return b;
}
function shot(g: Game, pos = { x: 600, y: 430 }) {
  g.addShot({
    pos: { ...pos },
    vel: { x: 20, y: 0 },
    damage: 24,
    life: 1,
    friendly: true,
    radius: 2,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: true,
  });
  return g.shots.at(-1)!;
}
function burn(g: Game, x = 600) {
  const body = wall(g, x),
    s = shot(g, { x, y: 438 });
  g.salvage.impact(s, body, { x: 0, y: -1 });
}
function ram(g: Game, e: Enemy) {
  g.grounded = false;
  g.aim = { x: 0, y: 400 };
  Body.setVelocity(g.player, { x: 18 - g.gun.recoil, y: 0 });
  g.fireRound();
  return g.salvage.ram(e);
}
function physicalStep(g: Game, n = 1) {
  for (let i = 0; i < n; i++) {
    g.time += dt;
    g.salvageEvolutions.beforeStep();
    g.props.beforeStep();
    Engine.update(g.engine, 1000 / 60);
    g.salvageEvolutions.afterStep();
    g.props.afterStep(dt);
  }
}

test('salvage evolutions require their parents, fit every path and appear in later normal and Daily rewards', () => {
  for (const child of ['wrecking-ball', 'flashpoint', 'slipstream']) {
    const parent = MOD_REQUIRES[child];
    assert(!availableMods([]).some((m) => m.id === child));
    assert(!validBuild([child, parent]));
    for (const path of ['deadeye', 'crossfire', 'shellshock']) {
      const mods = [path, parent];
      assert(validBuild([...mods, child]));
      assert(availableMods(mods).some((m) => m.id === child));
      assert.equal(modPathLabel(child), 'Salvage');
      for (const count of [1, 3]) {
        let found = false;
        for (let i = 0; i < 100; i++) {
          const a = rewardMods(mods, count, seeded('evolution-' + i), { stage: 13 });
          assert.deepEqual(a, rewardMods(mods, count, seeded('evolution-' + i), { stage: 13 }));
          if (a.some((m) => m.id === child)) found = true;
        }
        assert(found);
      }
    }
  }
});
test('a surviving ram target becomes a real fast body and its AI cannot erase the throw', () => {
  const g = fixture(['ramjet', 'wrecking-ball']),
    e = enemy(g, 427);
  e.hp = 500;
  assert(ram(g, e));
  assert(!e.body.isStatic);
  assert.equal(g.salvageEvolutions.wrecks.length, 1);
  assert(!g.salvageEvolutions.wrecks[0].corpse);
  assert(e.body.velocity.x >= 17);
  const v = { ...e.body.velocity };
  g.updateEnemy(e, dt);
  near(e.body.velocity.x, v.x);
  g.time = WRECK_LIFE + 0.01;
  g.salvageEvolutions.beforeStep();
  assert(!g.salvageEvolutions.carried(e));
  assert(g.enemies.includes(e));
});
test('a killing ram throws a physical wreck without awarding a duplicate kill', () => {
  const g = fixture(['ramjet', 'wrecking-ball']),
    e = enemy(g, 427, 400, 'runner');
  assert(ram(g, e));
  assert(!g.enemies.includes(e));
  assert.equal(g.kills, 1);
  const wreck = g.salvageEvolutions.wrecks[0];
  assert(wreck.corpse);
  assert(Composite.allBodies(g.engine.world).includes(wreck.body));
  assert(g.solidBodies.includes(wreck.body));
  g.time = WRECK_LIFE + 0.01;
  g.salvageEvolutions.beforeStep();
  assert(!Composite.allBodies(g.engine.world).includes(wreck.body));
  assert.equal(g.kills, 1);
});
test('thrown living enemies and killing wrecks damage their first physical target exactly once', () => {
  for (const lethal of [false, true]) {
    const g = fixture(['ramjet', 'wrecking-ball']),
      source = enemy(g, 427, 400, 'runner');
    source.hp = lethal ? 20 : 500;
    const target = enemy(g, 545, 400);
    target.hp = 500;
    assert(ram(g, source));
    physicalStep(g, 12);
    assert(target.hp < 500 && target.hp >= 424);
    const hp = target.hp;
    physicalStep(g, 12);
    near(target.hp, hp);
    assert(!g.salvageEvolutions.wrecks.length);
  }
});
test('walls stop wrecks before enemies behind them and shield fronts reduce impact damage', () => {
  const g = fixture(['ramjet', 'wrecking-ball']),
    source = enemy(g, 427, 400, 'runner');
  const behind = enemy(g, 560);
  wall(g, 490, 400, 16, 220);
  const hp = behind.hp;
  ram(g, source);
  physicalStep(g, 15);
  near(behind.hp, hp);
  assert(!g.salvageEvolutions.wrecks.length);
  const shielded = fixture(['ramjet', 'wrecking-ball']),
    a = enemy(shielded, 427, 400, 'runner');
  const b = enemy(shielded, 535, 400, 'runner', 'shielded');
  b.facing = -1;
  b.hp = 500;
  ram(shielded, a);
  physicalStep(shielded, 12);
  assert(b.hp < 500 && b.hp > 492);
});
test('bosses and heavy enemies resist Wrecking Ball while shield-blocked rams cannot throw', () => {
  for (const kind of ['loader', 'charger', 'scrapper', 'harpooner', 'borer'] as const) {
    const g = fixture(['ramjet', 'wrecking-ball']),
      e = enemy(g, 427, 400, kind);
    e.hp = 500;
    ram(g, e);
    assert(!g.salvageEvolutions.wrecks.length);
  }
  const g = fixture(['ramjet', 'wrecking-ball']),
    e = enemy(g, 427, 400, 'runner', 'shielded');
  e.facing = -1;
  assert(!ram(g, e));
  assert(!g.salvageEvolutions.wrecks.length);
});
test('a thrown enemy killed mid-flight keeps its remaining lifetime and momentum', () => {
  const g = fixture(['ramjet', 'wrecking-ball']),
    e = enemy(g, 427);
  e.hp = 500;
  ram(g, e);
  physicalStep(g, 4);
  const until = g.salvageEvolutions.wrecks[0].until,
    v = { ...e.body.velocity };
  g.hitEnemy(e, 9999);
  const wreck = g.salvageEvolutions.wrecks[0];
  assert(wreck.corpse);
  near(wreck.until, until);
  near(wreck.body.velocity.x, v.x);
  assert(!Composite.allBodies(g.engine.world).includes(e.body));
});
test('wrecks collide with crates and ignite fuel through the normal prop system', () => {
  for (const kind of ['crate', 'canister'] as const) {
    for (const lethal of [true, false]) {
      const g = fixture(['ramjet', 'wrecking-ball']),
        e = enemy(g, 427, 400, 'runner');
      e.hp = lethal ? 20 : 500;
      const p = g.props.spawn(kind, 535, 400);
      Body.setStatic(p.body, true);
      ram(g, e);
      physicalStep(g, 12);
      if (kind === 'crate') assert(p.hp < p.maxHp && p.hp >= p.maxHp - 76);
      else assert(!g.props.items.includes(p));
    }
  }
});
test('wreck count is capped and reset removes corpses while retaining living enemies', () => {
  const g = fixture(['ramjet', 'wrecking-ball']);
  for (let i = 0; i < 12; i++) {
    const e = enemy(g, 650 + i * 40);
    g.hitEnemy(e, 9999);
    g.salvageEvolutions.throwEnemy(e, { x: 1, y: 0 }, 15);
  }
  assert.equal(g.salvageEvolutions.wrecks.length, WRECK_LIMIT);
  const corpses = [...g.salvageEvolutions.bodies];
  const living = enemy(g, 900);
  g.salvageEvolutions.throwEnemy(living, { x: 1, y: 0 }, 15);
  g.salvageEvolutions.reset();
  assert(g.enemies.includes(living));
  assert(corpses.every((b) => !Composite.allBodies(g.engine.world).includes(b)));
});
test('Flashpoint requires a burning victim and a real kill, consumes flames and respects radius', () => {
  const g = fixture(['cinder', 'flashpoint']);
  burn(g);
  const a = enemy(g, 600, 417),
    b = enemy(g, 660, 417),
    far = enemy(g, 600 + FLASH_RADIUS + 30, 417);
  const hp = b.hp,
    farHp = far.hp;
  g.hitEnemy(a, 1);
  assert(!g.salvageEvolutions.flashes.length);
  g.hitEnemy(a, 9999);
  assert.equal(g.salvageEvolutions.flashes.length, 1);
  assert(b.hp < hp);
  near(far.hp, farHp);
  assert(!g.salvage.cinders.length);
  g.hitEnemy(b, 9999);
  assert.equal(g.salvageEvolutions.flashes.length, 1);
});
test('burn damage can trigger Flashpoint, but burst kills never trigger further bursts', () => {
  const g = fixture(['cinder', 'flashpoint']);
  burn(g, 600);
  burn(g, 700);
  const a = enemy(g, 600, 417),
    b = enemy(g, 690, 417),
    c = enemy(g, 780, 417);
  a.hp = 2;
  b.hp = 2;
  const hp = c.hp;
  g.salvage.beforeStep(dt);
  assert(a.hp <= 0 && b.hp <= 0);
  near(c.hp, hp);
  assert.equal(g.salvageEvolutions.flashes.length, 1);
});
test('Flashpoint snapshots cover before destroying it and keeps boss armor and shields', () => {
  const g = fixture(['cinder', 'flashpoint']);
  burn(g);
  const a = enemy(g, 600, 417),
    covered = enemy(g, 690, 417);
  const cover = g.props.spawn('cover', 648, 420);
  cover.hp = 10;
  const hp = covered.hp;
  g.hitEnemy(a, 9999);
  near(covered.hp, hp);
  assert(!g.props.items.includes(cover));
  for (const [kind, elite] of [
    ['loader', undefined],
    ['runner', 'shielded'],
  ] as const) {
    const testGame = fixture(['cinder', 'flashpoint']);
    burn(testGame);
    const source = enemy(testGame, 600, 417),
      target = enemy(testGame, 665, 417, kind, elite);
    target.hp = 500;
    target.facing = -1;
    g.time = 0;
    testGame.hitEnemy(source, 9999);
    assert(target.hp < 500);
    assert(500 - target.hp < (elite ? 5 : 18));
  }
});
test('Flashpoint consumes visible fire only and cannot ignite fuel through cover', () => {
  const g = fixture(['cinder', 'flashpoint']);
  burn(g, 600);
  burn(g, 690);
  const source = enemy(g, 600, 417);
  wall(g, 650, 400, 12, 140);
  const fuel = g.props.spawn('canister', 695, 418);
  g.hitEnemy(source, 9999);
  assert.equal(g.salvage.cinders.length, 1);
  assert(!Number.isFinite(fuel.detonateAt));
});

test('Flashpoint leaves fire on the opposite face of its supporting wall intact', () => {
  const g = fixture(['cinder', 'flashpoint']);
  burn(g, 600);
  const divider = wall(g, 650, 400, 16, 120);
  const s = shot(g, { x: 660, y: 400 });
  g.salvage.impact(s, divider, { x: 1, y: 0 });
  const source = enemy(g, 600, 417);
  g.hitEnemy(source, 9999);
  assert.equal(g.salvage.cinders.length, 1);
  assert.equal(g.salvage.cinders[0].body, divider);
});
test('Flashpoint heals normal kill rewards without multiplying projectile effects', () => {
  const g = fixture(['cinder', 'flashpoint', 'leech', 'crossfire', 'bloom', 'arc-coil']);
  burn(g);
  const a = enemy(g, 600, 417),
    b = enemy(g, 665, 417);
  b.hp = 2;
  g.hp = 50;
  const shots = g.shots.length;
  g.hitEnemy(a, 9999);
  assert.equal(g.kills, 2);
  near(g.hp, 54);
  assert.equal(g.shots.length, shots);
  assert(!g.arcs.charges.size);
});
test('Slipstream extends finite gust life and carries the player once across overlapping fields', () => {
  const g = fixture(['crosswind', 'slipstream']);
  const s = shot(g);
  for (let i = 0; i < 20; i++)
    g.salvage.trace({ ...s, id: s.id + i }, { x: 300, y: 400 }, { x: 470, y: 400 });
  g.time = 0.25;
  g.salvage.beforeStep(dt);
  near(g.player.velocity.x, 0.38);
  assert(g.salvage.riding);
  g.time = SLIPSTREAM_LIFE + 0.01;
  g.salvage.beforeStep(dt);
  assert(!g.salvage.gusts.length && !g.salvage.riding);
});
test('a fresh muzzle gust cannot cancel recoil, and fast launches keep their velocity', () => {
  const g = fixture(['crosswind', 'slipstream']);
  g.aim = { x: 900, y: 400 };
  g.fireRound();
  const s = g.shots[0];
  g.salvage.trace(s, { x: 426, y: 400 }, { x: 550, y: 400 });
  const vx = g.player.velocity.x;
  g.salvage.beforeStep(dt);
  near(g.player.velocity.x, vx);
  assert(!g.salvage.riding);
  Body.setPosition(g.player, { x: 470, y: 400 });
  Body.setVelocity(g.player, { x: 22, y: 3 });
  g.salvage.beforeStep(dt);
  near(g.player.velocity.x, 22);
  near(g.player.velocity.y, 3);
});
test('Slipstream lifts against real gravity and stops influencing the player outside its path', () => {
  const g = fixture(['crosswind', 'slipstream']);
  enemy(g, 1500);
  g.engine.gravity.y = 1;
  const s = shot(g);
  g.salvage.trace(s, { x: 400, y: 460 }, { x: 400, y: 280 });
  for (let i = 0; i < 20; i++) g.tick(dt, idle);
  assert(g.player.position.y < 400 && g.player.velocity.y < 0);
  Body.setPosition(g.player, { x: 500, y: 400 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.salvage.beforeStep(dt);
  near(g.player.velocity.y, 0);
  assert(!g.salvage.riding);
});
test('cover blocks Slipstream attraction and Matter stops riders at real walls', () => {
  const g = fixture(['crosswind', 'slipstream']);
  const s = shot(g);
  wall(g, 400, 388, 140, 8);
  g.salvage.trace(s, { x: 300, y: 370 }, { x: 480, y: 370 });
  g.salvage.beforeStep(dt);
  assert(!g.salvage.riding);
  near(g.player.velocity.x, 0);
  const rider = fixture(['crosswind', 'slipstream']);
  enemy(rider, 1500);
  wall(rider, 455, 400, 12, 200);
  const round = shot(rider);
  rider.salvage.trace(round, { x: 300, y: 400 }, { x: 450, y: 400 });
  Body.setVelocity(rider.player, { x: 12, y: 0 });
  for (let i = 0; i < 30; i++) rider.tick(dt, idle);
  assert(rider.player.bounds.max.x <= 450);
});
test('evolution state freezes on pause and hitstop and resets on death and room transitions', () => {
  const g = fixture(['ramjet', 'wrecking-ball', 'cinder', 'flashpoint']);
  const e = enemy(g, 427, 400, 'runner');
  enemy(g, 1500);
  ram(g, e);
  const wreck = g.salvageEvolutions.wrecks[0],
    pos = { ...wreck.body.position };
  g.setMode('paused');
  for (let i = 0; i < 30; i++) g.tick(dt, idle);
  near(wreck.body.position.x, pos.x);
  near(g.time, 0);
  g.setMode('playing');
  g.hitStop = 0.1;
  g.tick(dt, idle);
  near(g.time, 0);
  g.loadRoom();
  assert(!g.salvageEvolutions.wrecks.length);
  assert(!Composite.allBodies(g.engine.world).includes(wreck.body));
  g.salvageEvolutions.flashes.push({ pos, at: g.time });
  g.die();
  assert(!g.salvageEvolutions.flashes.length);
});
test('evolved test links preserve parent order, isolate saves and reject malformed switches', () => {
  for (const build of ['all', 'ramjet', 'cinder', 'crosswind']) {
    const save = salvageTestFromUrl(new URL('https://test/?test=salvage&evolved=1&build=' + build));
    assert(save && loadCheckpoint(save));
    const children = ['wrecking-ball', 'flashpoint', 'slipstream'].filter((id) =>
      save.mods.includes(id),
    );
    assert.equal(children.length, build === 'all' ? 3 : 1);
    const g = new Game();
    let saved = false;
    g.onCheckpoint = () => (saved = true);
    g.startTest(save);
    g.save();
    g.die();
    assert(!saved);
  }
  for (const suffix of ['evolved=2', 'evolved=1&evolved=0', 'evolved=1&daily=2026-09-12'])
    assert.equal(salvageTestFromUrl(new URL('https://test/?test=salvage&' + suffix)), null);
});

test('living throws and dead wrecks pass through Fold without striking along the teleport gap', () => {
  for (const corpse of [false, true]) {
    const g = fixture(['ramjet', 'wrecking-ball', 'fold']);
    const e = enemy(g, 65, 400, 'runner'),
      sentinel = enemy(g, 1000, 400);
    const hp = sentinel.hp;
    assert(g.portals.place({ x: 0, y: 400 }));
    assert(g.portals.place({ x: 2000, y: 400 }));
    if (corpse) g.hitEnemy(e, 9999);
    g.salvageEvolutions.throwEnemy(e, { x: -1, y: 0 }, 18);
    let passed = false;
    for (let i = 0; i < 20; i++) {
      g.hitStop = 0;
      g.tick(dt, idle);
      if (g.salvageEvolutions.wrecks[0]?.body.position.x > 1800) passed = true;
    }
    assert(passed, `Portal did not carry ${corpse ? 'wreck' : 'living enemy'}`);
    near(sentinel.hp, hp);
  }
});

test('previously exhausted Overtime saves with salvage can resume and earn their new evolutions', () => {
  const mods = ['deadeye', 'ramjet', 'cinder', 'crosswind'];
  while (true) {
    const next = availableMods(mods).find(
      (m) =>
        !['wrecking-ball', 'flashpoint', 'slipstream', 'grindshot', 'corner-cutter'].includes(m.id),
    );
    if (!next) break;
    mods.push(next.id);
  }
  const save = {
    version: 5,
    seed: 'OLD-SALVAGE',
    stage: 19,
    hp: 80,
    mods,
    kills: 400,
    elapsed: 1400,
    detours: [0, 1, 2, 4],
    overtime: { baseMods: 23, repairs: 42 - mods.length },
  };
  assert(save.overtime.repairs > 0);
  assert(loadCheckpoint(save));
  assert.deepEqual(
    availableMods(mods).map((m) => m.id),
    ['wrecking-ball', 'flashpoint', 'slipstream', 'grindshot'],
  );
});
