import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input, type Shot } from '../src/game.ts';
import { ARC_RANGE, ARC_CHARGE_LIFE, ARC_EFFECT_LIMIT } from '../src/arc-coil.ts';
import {
  availableMods,
  getGun,
  loadCheckpoint,
  MODS,
  rewardMods,
  seeded,
  validBuild,
  type Checkpoint,
} from '../src/rules.ts';
import { arcTestFromUrl } from '../src/practice.ts';
import { dailyForDate } from '../src/daily.ts';
const { Body, Bodies, Composite } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1400, y: 400 },
};
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function fixture(mods = ['arc-coil']) {
  const g = new Game();
  g.start('arc-test');
  g.stage = 8;
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
  Body.setPosition(g.player, { x: 180, y: 400 });
  return g;
}
function target(
  g: Game,
  x: number,
  y = 400,
  kind: Enemy['kind'] = 'shooter',
  elite?: Enemy['elite'],
) {
  g.spawnEnemy(kind, x, y, elite);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.timer = 100;
  return e;
}
function hit(g: Game, e: Enemy, damage = 10, extra: Partial<Shot> = {}) {
  g.addShot({
    pos: { x: e.body.position.x - 40, y: e.body.position.y },
    vel: { x: 64, y: 0 },
    damage,
    life: 1,
    friendly: true,
    radius: 2,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: true,
    ...extra,
  });
  const s = g.shots.at(-1)!;
  g.updateShots(1 / 60);
  return s;
}
function three(g: Game, e: Enemy, damage = 10) {
  for (let i = 0; i < 3; i++) hit(g, e, damage);
}
function wall(g: Game, x: number, y = 400, w = 20, h = 240) {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true });
  Composite.add(g.engine.world, b);
  g.terrain.push(b);
  return b;
}
function tick(g: Game, n = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, { ...idle, ...input });
}

test('Arc Coil is shared, costs 10 percent round damage, and Daisy Chain requires its parent', () => {
  assert.equal(MODS.length, 51);
  for (const path of [[], ['deadeye'], ['crossfire'], ['shellshock']]) {
    assert(availableMods(path).some((m) => m.id === 'arc-coil'));
    assert(!availableMods(path).some((m) => m.id === 'daisy-chain'));
    const mods = [...path, 'arc-coil', 'daisy-chain'];
    assert(validBuild(mods));
    const base = getGun(path),
      arc = getGun(mods);
    assert.deepEqual(arc, { ...base, damage: base.damage * 0.9 });
    assert(
      loadCheckpoint({
        version: 5,
        seed: 'arc-save',
        stage: 6,
        hp: 81,
        mods,
        kills: 4,
        elapsed: 12,
      }),
    );
  }
  assert(!validBuild(['daisy-chain', 'arc-coil']));
  for (const id of ['arc-coil', 'daisy-chain'])
    assert(
      Array.from({ length: 96 }, (_, i) =>
        rewardMods(id === 'arc-coil' ? [] : ['arc-coil'], 3, seeded(id + i)),
      )
        .flat()
        .some((m) => m.id === id),
    );
  const a = getGun(['arc-coil', 'scatter', 'magnum', 'rapid']),
    b = getGun(['rapid', 'magnum', 'scatter', 'arc-coil']);
  near(a.damage, b.damage);
});

test('three actual direct hits charge one enemy and discharge exactly one visible arc', () => {
  const g = fixture(),
    a = target(g, 500),
    b = target(g, 690),
    c = target(g, 850);
  const hp = [a.hp, b.hp, c.hp];
  hit(g, a);
  assert.equal(g.arcs.charges.get(a.id)?.hits, 1);
  hit(g, a);
  assert.equal(g.arcs.charges.get(a.id)?.hits, 2);
  assert.equal(b.hp, hp[1]);
  hit(g, a);
  assert(!g.arcs.charges.has(a.id));
  near(hp[0] - a.hp, 30);
  near(hp[1] - b.hp, 12);
  near(c.hp, hp[2]);
  assert.equal(g.arcs.effects.length, 1);
  assert.equal(g.arcs.charges.size, 0);
  assert.equal(g.shots.filter((s) => s.life > 0).length, 0);
});

test('charges are per enemy, expire during active play and consume even without another target', () => {
  const g = fixture(),
    a = target(g, 500),
    b = target(g, 1300);
  hit(g, a);
  hit(g, b);
  hit(g, a);
  assert.equal(g.arcs.charges.get(a.id)?.hits, 2);
  assert.equal(g.arcs.charges.get(b.id)?.hits, 1);
  hit(g, a);
  assert.equal(g.arcs.effects.length, 0);
  assert(!g.arcs.charges.has(a.id));
  g.time += ARC_CHARGE_LIFE + 0.01;
  g.arcs.update();
  assert.equal(g.arcs.charges.size, 0);
  hit(g, b);
  assert.equal(g.arcs.charges.get(b.id)?.hits, 1);
});

test('the killing third hit still discharges; a kill before three hits leaves no charge', () => {
  const g = fixture(),
    a = target(g, 500),
    b = target(g, 700);
  a.hp = 30;
  const hp = b.hp;
  three(g, a);
  assert(a.hp <= 0);
  near(hp - b.hp, 12);
  assert.equal(g.arcs.charges.size, 0);
  const c = target(g, 1100);
  c.hp = 10;
  hit(g, c);
  assert(!g.arcs.charges.has(c.id));
});

test('fragments, echoes, reflected rounds and blocked shield hits cannot charge enemies', () => {
  for (const extra of [{ fragment: true }, { echo: true }, { reflected: true }]) {
    const g = fixture(),
      a = target(g, 500);
    three(g, target(g, 1300));
    g.arcs.reset();
    for (let i = 0; i < 3; i++) hit(g, a, 10, extra);
    assert.equal(g.arcs.charges.size, 0);
    assert.equal(g.arcs.effects.length, 0);
  }
  const g = fixture(),
    e = target(g, 500, 400, 'runner', 'shielded');
  e.facing = -1;
  three(g, e);
  assert.equal(g.arcs.charges.size, 0);
  const s = hit(g, e, 10, { pos: { x: 540, y: 400 }, vel: { x: -64, y: 0 } });
  assert.equal(g.arcs.charges.get(e.id)?.hits, 1);
  g.arcs.reset();
  s.friendly = false;
  g.arcs.hit(e, s);
  assert.equal(g.arcs.charges.size, 0);
});

test('arc payload averages the three actual hits and never borrows full shotgun or bonus damage', () => {
  const g = fixture(['arc-coil', 'scatter', 'capacitor']),
    a = target(g, 500),
    b = target(g, 700),
    hp = b.hp;
  for (const damage of [2, 4, 6]) hit(g, a, damage);
  near(hp - b.hp, 4.8);
  assert(getGun(['arc-coil', 'scatter']).damage < 7);
  const p = fixture(['arc-coil', 'deadeye', 'execute']),
    x = target(p, 500),
    y = target(p, 700),
    health = y.hp;
  x.hp = 20;
  x.maxHp = 120;
  three(p, x, 4);
  near(health - y.hp, 4.8);
});

test('Daisy Chain visits at most three additional targets once each with 30 percent falloff', () => {
  const g = fixture(['arc-coil', 'daisy-chain']),
    enemies = [500, 670, 840, 1010, 1180].map((x) => target(g, x));
  const hp = enemies.map((e) => e.hp);
  three(g, enemies[0], 20);
  for (const [i, damage] of [60, 24, 16.8, 11.76, 0].entries()) near(hp[i] - enemies[i].hp, damage);
  assert.equal(g.arcs.effects.length, 3);
  assert.equal(g.arcs.charges.size, 0);
  assert.equal(new Set(g.arcs.effects.map((f) => f.b.x)).size, 3);
});

test('chains select nearest visible targets deterministically, respect range and never return to their source', () => {
  for (let i = 0; i < 2; i++) {
    const g = fixture(['arc-coil', 'daisy-chain']),
      a = target(g, 500),
      b = target(g, 700, 450),
      c = target(g, 700, 350);
    target(g, 1500);
    three(g, a);
    assert.deepEqual(
      g.arcs.effects.map((f) => f.b),
      [
        { x: 700, y: 450 },
        { x: 700, y: 350 },
      ],
    );
    assert(b.hp < b.maxHp && c.hp < c.maxHp);
  }
  const g = fixture(),
    a = target(g, 500),
    b = target(g, 500 + ARC_RANGE + 0.01);
  three(g, a);
  assert.equal(b.hp, b.maxHp);
  assert.equal(g.arcs.effects.length, 0);
});

test('walls, machinery and rotated cover block arcs while a clear alternative can be selected', () => {
  for (const kind of ['wall', 'hazard', 'rotated'] as const) {
    const g = fixture(),
      a = target(g, 500),
      b = target(g, 700);
    if (kind === 'wall') wall(g, 600);
    else if (kind === 'hazard') {
      const body = wall(g, 600);
      g.terrain = g.terrain.filter((b) => b !== body);
      Object.defineProperty(g.hazards, 'bodies', { get: () => [body] });
    } else {
      const p = g.props.spawn('rubble', 600, 400);
      Body.setAngle(p.body, Math.PI / 4);
    }
    three(g, a);
    assert.equal(b.hp, b.maxHp);
    assert.equal(g.arcs.effects.length, 0, kind);
    const c = target(g, 500, 600);
    three(g, a);
    assert(c.hp < c.maxHp);
    assert.equal(b.hp, b.maxHp);
  }
});

test('enemy spawn grace and the player are never electrical targets', () => {
  const g = fixture(),
    a = target(g, 500),
    b = target(g, 650);
  b.spawn = 0.5;
  Body.setPosition(g.player, { x: 590, y: 400 });
  three(g, a);
  assert.equal(b.hp, b.maxHp);
  assert.equal(g.hp, 100);
  assert.equal(g.arcs.effects.length, 0);
});

test('directional shields reduce arc damage and terminate the chain; boss armor remains intact', () => {
  const g = fixture(['arc-coil', 'daisy-chain']),
    a = target(g, 500),
    b = target(g, 690, 400, 'runner', 'shielded'),
    c = target(g, 860);
  b.facing = -1;
  const hp = b.hp;
  three(g, a);
  near(hp - b.hp, 1.2);
  assert.equal(c.hp, c.maxHp);
  assert.equal(g.arcs.effects.length, 1);
  for (const state of ['idle', 'recover'] as const) {
    const h = fixture(),
      x = target(h, 500),
      boss = target(h, 700, 400, 'loader');
    boss.state = state;
    const before = boss.hp;
    three(h, x);
    near(before - boss.hp, 12 * (state === 'idle' ? 0.4 : 1.25));
  }
});

test('metal crates, cover and hanging cargo conduct but do not create new charges or sever cables', () => {
  for (const kind of ['crate', 'cover', 'cargo'] as const) {
    const g = fixture(['arc-coil', 'daisy-chain']),
      a = target(g, 500),
      p =
        kind === 'cargo'
          ? g.cargo.spawn({ x: 650, y: 400, anchorY: 150 })
          : g.props.spawn(kind, 650, 400),
      b = target(g, 820);
    const hp = b.hp,
      propHp = p.hp;
    three(g, a);
    near(propHp - p.hp, 12);
    near(hp - b.hp, 8.4);
    assert.equal(g.arcs.effects.length, 2);
    assert.equal(g.arcs.charges.size, 0);
    if (p.cargo) assert.equal(p.cargo.state, 'hanging');
  }
});

test('conducted fuel gets a brief ignition fuse and explodes through the existing physical system', () => {
  const g = fixture(['arc-coil', 'daisy-chain']),
    a = target(g, 500),
    fuel = g.props.spawn('canister', 650, 400),
    b = target(g, 815);
  Body.setStatic(fuel.body, true);
  three(g, a);
  assert(Number.isFinite(fuel.armedAt));
  near(fuel.detonateAt, g.time + 0.45);
  assert(g.props.items.includes(fuel));
  tick(g, 20);
  assert(g.props.items.includes(fuel));
  tick(g, 15);
  assert(!g.props.items.includes(fuel));
  assert(b.hp < b.maxHp);
  assert.equal(g.hp, 100);
  assert(g.particles.length <= 220);
});

test('an arc cannot use a destroyed obstruction to add an unplanned target or loop through debris', () => {
  const g = fixture(['arc-coil', 'daisy-chain']),
    a = target(g, 500),
    p = g.props.spawn('cover', 630, 400),
    b = target(g, 820);
  // This wall blocks the prop's onward leg, including after the prop breaks.
  wall(g, 720);
  p.hp = 5;
  three(g, a);
  assert(!g.props.items.includes(p));
  assert.equal(b.hp, b.maxHp);
  assert.equal(g.arcs.effects.length, 1);
  assert.equal(g.arcs.charges.size, 0);
});

test('arc kills heal normally but cannot recursively charge, split, bloom or amplify an existing charge', () => {
  const g = fixture(['arc-coil', 'daisy-chain', 'leech', 'crossfire', 'bloom', 'split']),
    a = target(g, 500),
    b = target(g, 680),
    c = target(g, 860);
  g.hp = 60;
  hit(g, b, 1);
  hit(g, b, 1);
  b.hp = 8;
  three(g, a);
  assert(b.hp <= 0);
  near(g.hp, 62);
  assert(!g.arcs.charges.has(b.id));
  assert.equal(g.arcs.charges.size, 0);
  assert.equal(g.shots.filter((s) => s.fragment).length, 0);
  near(c.maxHp - c.hp, 8.4);
});

test('paused and hitstopped charges freeze; dead targets, retries, extraction and terminal states clear state', () => {
  const g = fixture(),
    a = target(g, 500);
  hit(g, a);
  const time = g.time,
    expiry = g.arcs.charges.get(a.id)!.until;
  g.setMode('paused');
  tick(g, 100);
  near(g.time, time);
  near(g.arcs.charges.get(a.id)!.until, expiry);
  g.setMode('playing');
  g.hitStop = 0.2;
  tick(g);
  near(g.time, time);
  assert(g.arcs.charges.size);
  g.hitStop = 0;
  g.hitEnemy(a, 9999);
  g.hitStop = 0;
  g.arcs.update();
  assert.equal(g.arcs.charges.size, 0);
  for (const mode of ['dead', 'won', 'title'] as const) {
    g.setMode('playing');
    const e = target(g, 900);
    hit(g, e);
    g.setMode(mode);
    assert.equal(g.arcs.charges.size, 0);
    assert.equal(g.arcs.effects.length, 0);
  }
  g.setMode('playing');
  const e = target(g, 1300);
  hit(g, e);
  g.loadRoom();
  assert.equal(g.arcs.charges.size, 0);
  g.setMode('playing');
  g.startEscape();
  assert.equal(g.arcs.charges.size, 0);
  assert.equal(g.arcs.effects.length, 0);
});

test('portal travel carries the charge with its enemy and arcs search only the new position', () => {
  const g = fixture(['arc-coil', 'fold']),
    a = target(g, 500, 710, 'runner'),
    b = target(g, 690, 710),
    c = target(g, 1280, 710);
  hit(g, a);
  hit(g, a);
  const floor = g.terrain.find((b) => b.bounds.min.y >= 739)!;
  g.portals.pair = [
    { pos: { x: 500, y: 740 }, normal: { x: 0, y: -1 }, body: floor },
    { pos: { x: 1100, y: 740 }, normal: { x: 0, y: -1 }, body: floor },
  ];
  Body.setPosition(a.body, { x: 500, y: 713 });
  Body.setVelocity(a.body, { x: 0, y: 14 });
  tick(g, 2);
  assert(a.body.position.x > 1000);
  hit(g, a);
  assert.equal(b.hp, b.maxHp);
  assert(c.hp < c.maxHp);
  assert(g.arcs.effects.every((f) => f.a.x > 1000 && f.b.x > 1000));
});

test('Arc test links start a real Cable Yard with legal builds and preserve saves, Daily records and Practice unlocks', () => {
  for (const build of ['base', 'chain']) {
    const save = arcTestFromUrl(new URL('https://test/?test=arc&build=' + build))!;
    assert(save);
    assert(validBuild(save.mods));
    assert(loadCheckpoint(save));
    assert.equal(save.mods.length, save.stage);
    assert.equal(save.mods.includes('daisy-chain'), build === 'chain');
    const g = new Game();
    let writes = 0,
      unlocks = 0;
    g.onCheckpoint = () => writes++;
    g.onBossDefeated = () => unlocks++;
    g.startTest(save);
    assert.equal(g.level.id, 'cable-yard');
    const before = JSON.stringify(g.level);
    g.hp = 30;
    g.die();
    g.startTest(g.testRun!);
    assert.equal(g.hp, 100);
    assert.equal(JSON.stringify(g.level), before);
    assert.equal(writes, 0);
    assert.equal(unlocks, 0);
  }
  assert(arcTestFromUrl(new URL('https://test/?test=arc')));
  for (const suffix of [
    '&test=arc',
    '&build=bad',
    '&build=',
    '&build=base&build=chain',
    ...[
      'daily',
      'dv',
      'seed',
      'area',
      'formation',
      'route',
      'mode',
      'layout',
      'variant',
      'mirror',
    ].map((k) => '&' + k + '=x'),
  ])
    assert.equal(arcTestFromUrl(new URL('https://test/?test=arc' + suffix)), null, suffix);
});

test('Daily rewards remain deterministic and valid with both new mods in the pool', () => {
  const found = new Set<string>();
  for (let day = 1; day <= 28; day++) {
    const seed = dailyForDate(`2026-09-${String(day).padStart(2, '0')}`)!.seed;
    const a = new Game(),
      b = new Game();
    a.start(seed);
    b.start(seed);
    for (let stage = 0; stage < 19; stage++) {
      a.openReward();
      b.openReward();
      assert.equal(a.offers.length, 1);
      assert.deepEqual(a.offers, b.offers);
      const id = a.offers[0].id;
      found.add(id);
      a.chooseMod(id);
      b.chooseMod(id);
      assert(validBuild(a.mods));
    }
  }
  assert(found.has('arc-coil'));
  assert(found.has('daisy-chain'));
});

test('Overtime builds that exhausted the previous pool can resume and earn Arc Coil after an older repair', () => {
  const mods: string[] = [];
  while (true) {
    const next = availableMods(mods).find(
      (m) => !['arc-coil', 'daisy-chain', 'rail-spike', 'orbit', 'implosion'].includes(m.id),
    );
    if (!next) break;
    mods.push(next.id);
  }
  const stage = mods.length - 19 + 1;
  assert(stage > 0 && stage < 20);
  const save: Checkpoint = {
    version: 5,
    seed: 'old-repair',
    stage,
    hp: 60,
    mods,
    kills: 200,
    elapsed: 1200,
    overtime: { baseMods: 19, repairs: 1 },
  };
  assert(loadCheckpoint(save));
  const g = new Game();
  g.start(save.seed, save);
  g.openReward();
  assert(g.offers.some((m) => m.id === 'arc-coil'));
  g.chooseMod('arc-coil');
  assert(g.mods.includes('arc-coil'));
  assert(availableMods(g.mods).some((m) => m.id === 'daisy-chain'));
});

test('dense multi-pellet, echo and demolition combinations keep charges and arc effects bounded', () => {
  for (const mods of [
    [
      'arc-coil',
      'daisy-chain',
      'crossfire',
      'scatter',
      'rapid',
      'burst',
      'pierce',
      'ricochet',
      'split',
      'bloom',
      'afterimage',
      'parallax',
      'recall',
      'homecoming',
    ],
    [
      'arc-coil',
      'daisy-chain',
      'shellshock',
      'fuse',
      'linked-fuse',
      'aftershock',
      'shockfront',
      'chain-reaction',
      'implosion',
      'scatter',
      'rapid',
      'pierce',
    ],
  ]) {
    const g = fixture(mods);
    let arcs = 0;
    g.onSound = (k) => {
      if (k === 'arc') arcs++;
    };
    for (let i = 0; i < 900; i++) {
      if (g.enemies.length < 5) target(g, 550 + (i % 4) * 170, 350 + (i % 3) * 55);
      tick(g, 1, {
        fire: true,
        aim: g.enemies[0].body.position,
        right: i % 120 < 60,
        left: i % 120 >= 60,
      });
      assert(g.arcs.charges.size <= 14);
      assert(g.arcs.effects.length <= ARC_EFFECT_LIMIT);
      assert(g.particles.length <= 220);
      assert(g.shots.length <= 180);
      for (const f of g.arcs.effects) assert(Number.isFinite(f.a.x + f.a.y + f.b.x + f.b.y));
      if (g.mode !== 'playing') break;
    }
    assert(arcs > 0, 'The stress build did not exercise Arc Coil');
  }
});
