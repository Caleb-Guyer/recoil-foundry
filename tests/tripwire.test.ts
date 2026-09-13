import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Shot, type Enemy, type Input } from '../src/game.ts';
import { TRIPWIRE, wireCrossing } from '../src/tripwire.ts';
import { firstSolid } from '../src/collisions.ts';
import {
  getGun,
  validBuild,
  availableMods,
  modPathLabel,
  loadCheckpoint,
  rewardMods,
  seeded,
  distance,
  type Vec,
} from '../src/rules.ts';
import { tripwireTestFromUrl } from '../src/practice.ts';
import { dailyForDate } from '../src/daily.ts';
const { Body, Bodies, Composite } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 900, y: 400 },
};
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
function fixture(mods = ['tripwire']) {
  const g = new Game();
  g.start('tripwire-test');
  g.waves.clear();
  g.hazards.clear();
  g.breaches.clear();
  g.conveyors.clear();
  g.destruction.clear();
  g.counterweights.clear();
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
  Body.setPosition(g.player, { x: 1300, y: 400 });
  g.aim = { x: 1800, y: 400 };
  return g;
}
function wall(g: Game, x: number, y = 400, w = 20, h = 400) {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  return b;
}
function round(g: Game, pos: Vec, vel: Vec, extra: Partial<Shot> = {}) {
  g.addShot({
    pos,
    vel,
    damage: 24,
    life: 2,
    friendly: true,
    radius: 2.5,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
    tripwire: 24,
    ...extra,
  });
  return g.shots.at(-1)!;
}
function pin(g: Game, b: Matter.Body, point: Vec, normal: Vec, damage = 24) {
  const s = round(
    g,
    { x: point.x + normal.x * 10, y: point.y + normal.y * 10 },
    { x: -normal.x * 20, y: -normal.y * 20 },
    { tripwire: damage },
  );
  g.updateShots(1 / 60);
  g.shots = [];
  return s;
}
function wire(g: Game, y = 400, length = 400, x = 500) {
  const a = wall(g, x - length / 2 - 10, y, 20, 120),
    b = wall(g, x + length / 2 + 10, y, 20, 120);
  pin(g, a, { x: x - length / 2, y }, { x: 1, y: 0 });
  pin(g, b, { x: x + length / 2, y }, { x: -1, y: 0 });
  assert(g.tripwires.wires.length);
  return g.tripwires.wires.at(-1)!;
}
function enemy(g: Game, x = 500, y = 400, kind: Enemy['kind'] = 'runner') {
  g.spawnEnemy(kind, x, y);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.timer = 100;
  e.hp = e.maxHp = 1000;
  return e;
}
function arm(g: Game) {
  g.time += TRIPWIRE.arm + 0.001;
}
function resolve(g: Game) {
  g.tripwires.beforeStep();
  g.tripwires.afterStep();
}

test('Tripwire commits to Demolition, Tension requires it, and normal gun stats stay unchanged', () => {
  assert(availableMods([]).some((m) => m.id === 'tripwire'));
  assert(!availableMods([]).some((m) => m.id === 'tension'));
  assert(validBuild(['tripwire', 'tension', 'shellshock', 'aftershock', 'scatter', 'fold']));
  assert(!validBuild(['tension']));
  for (const path of ['crossfire', 'deadeye', 'cutting-torch'])
    assert(!availableMods([path]).some((m) => m.id === 'tripwire'));
  assert.equal(modPathLabel('tripwire'), 'Demolition');
  assert.equal(modPathLabel('tension'), 'Demolition');
  assert.deepEqual(getGun(['tripwire', 'tension']), getGun([]));
});

test('normal shooting tags one aimed center pellet per volley, including Scattershot and Backfire', () => {
  const g = fixture(['tripwire', 'scatter', 'backblast', 'backfire']);
  g.fireRound();
  const eligible = g.shots.filter((s) => s.tripwire);
  assert.equal(eligible.length, 1);
  assert.equal(g.shots.length, 10);
  assert(eligible[0].vel.x > 0);
  near(eligible[0].tripwire!, g.gun.damage * g.gun.pellets);
  g.fireRound();
  assert.equal(g.shots.filter((s) => s.tripwire).length, 2);
  g.shots = [];
  g.aim = { ...g.player.position };
  g.fireRound();
  assert.equal(g.shots.filter((s) => s.tripwire).length, 1);
});

test('two real surface impacts place a visible wire outside the hull and use one anchor each', () => {
  const g = fixture(),
    w = wire(g);
  assert.equal(g.tripwires.anchor, null);
  near(w.a.pos.x, 303);
  near(w.b.pos.x, 697);
  near(w.damage, 24 * TRIPWIRE.damage);
  assert(!firstSolid(w.a.pos, w.b.pos, { x: 1, y: 1 }, g.solidBodies));
});

test('repeat shots at one spot do not build tiny wires or overwrite the first payload', () => {
  const g = fixture(),
    a = wall(g, 300);
  pin(g, a, { x: 310, y: 400 }, { x: 1, y: 0 }, 48);
  const first = g.tripwires.anchor;
  for (let i = 0; i < 20; i++) pin(g, a, { x: 310, y: 400 + i }, { x: 1, y: 0 }, 12);
  assert.equal(g.tripwires.anchor, first);
  assert.equal(g.tripwires.wires.length, 0);
});

test('unreachable or obstructed second pins become the next starting point without connecting through cover', () => {
  const g = fixture(),
    a = wall(g, 200),
    b = wall(g, 1200);
  pin(g, a, { x: 210, y: 400 }, { x: 1, y: 0 });
  pin(g, b, { x: 1190, y: 400 }, { x: -1, y: 0 });
  assert.equal(g.tripwires.wires.length, 0);
  assert.equal(g.tripwires.anchor?.body, b);
  const h = fixture(),
    left = wall(h, 300),
    right = wall(h, 700);
  wall(h, 500, 400, 20, 70);
  pin(h, left, { x: 310, y: 400 }, { x: 1, y: 0 });
  pin(h, right, { x: 690, y: 400 }, { x: -1, y: 0 });
  assert.equal(h.tripwires.wires.length, 0);
  assert.equal(h.tripwires.anchor?.body, right);
});

test('ricochets place only one pin and fragments, reflections, echoes, and hostile rounds cannot rig traps', () => {
  const g = fixture(['tripwire', 'ricochet']),
    w = wire(g);
  g.tripwires.reset();
  const s = round(g, { x: 500, y: 400 }, { x: -400, y: 0 }, { bounces: 2 });
  g.updateShots(1 / 60);
  assert(g.tripwires.anchor);
  assert.equal(s.tripwire, undefined);
  g.updateShots(1 / 60);
  assert.equal(g.tripwires.wires.length, 0);
  for (const extra of [
    { fragment: true },
    { reflected: true },
    { echo: true },
    { friendly: false },
  ]) {
    const h = fixture(),
      b = wall(h, 500);
    const s = round(h, { x: 480, y: 400 }, { x: 20, y: 0 }, extra);
    h.tripwires.impact(s, b, { x: -1, y: 0 });
    assert.equal(h.tripwires.anchor, null);
  }
  assert(w.a.body);
});

test('floors and ceilings accept anchors; props, counterweights, and trains do not', () => {
  const g = fixture(),
    floor = g.terrain.find((b) => Math.abs(b.bounds.min.y - 740) < 1)!;
  pin(g, floor, { x: 400, y: 740 }, { x: 0, y: -1 });
  pin(g, floor, { x: 700, y: 740 }, { x: 0, y: -1 });
  assert.equal(g.tripwires.wires.length, 1);
  g.tripwires.reset();
  const ceiling = wall(g, 600, 180, 400, 20);
  pin(g, ceiling, { x: 500, y: 190 }, { x: 0, y: 1 });
  pin(g, ceiling, { x: 700, y: 190 }, { x: 0, y: 1 });
  assert.equal(g.tripwires.wires.length, 1);
  for (const body of [
    g.props.spawn('crate', 1000, 400).body,
    g.counterweights.spawn({ x: 1300, y: 300, w: 300 }).body,
    Bodies.rectangle(1500, 400, 60, 60, { isStatic: true, label: 'freight-car' }),
  ]) {
    g.tripwires.reset();
    const s = round(g, body.position, { x: 10, y: 0 });
    g.tripwires.impact(s, body, { x: -1, y: 0 });
    assert.equal(g.tripwires.anchor, null);
  }
});

test('a third trap replaces the oldest without detonating it or adding physical bodies', () => {
  const g = fixture();
  const a = wire(g, 250),
    b = wire(g, 420);
  const before = Composite.allBodies(g.engine.world).length;
  const c = wire(g, 590);
  assert.deepEqual(g.tripwires.wires, [b, c]);
  assert(!g.tripwires.wires.includes(a));
  assert.equal(g.demolition.effects.length, 0);
  assert.equal(
    Composite.allBodies(g.engine.world).length,
    before + 2,
    'Only the two fixture walls should have been added',
  );
});

test('Tension scales with real span, reaches its cap, and does not alter blast radius', () => {
  const g = fixture(['tripwire', 'tension']);
  const short = wire(g, 250, 100),
    long = wire(g, 450, 680);
  assert(long.damage > short.damage);
  near(long.damage, 24 * TRIPWIRE.damage * 1.75);
  assert.equal(long.tension, 1);
  enemy(g, 500, 450);
  arm(g);
  resolve(g);
  assert.equal(g.demolition.effects[0].radius, TRIPWIRE.radius);
});

test('arming is delayed, then a touching enemy triggers one blast and consumes the wire', () => {
  const g = fixture(),
    w = wire(g),
    e = enemy(g);
  resolve(g);
  near(e.hp, 1000);
  assert(g.tripwires.wires.includes(w));
  arm(g);
  resolve(g);
  near(e.hp, 1000 - w.damage);
  assert.equal(g.tripwires.wires.length, 0);
  resolve(g);
  near(e.hp, 1000 - w.damage);
  assert.equal(g.demolition.effects.length, 1);
});

test('fast crossings use the full enemy hull and retain contact damage after passing the blast radius', () => {
  const g = fixture(),
    w = wire(g),
    e = enemy(g, 500, 200, 'charger');
  arm(g);
  g.tripwires.beforeStep();
  Body.setPosition(e.body, { x: 500, y: 650 });
  g.tripwires.afterStep();
  assert.equal(g.tripwires.wires.length, 0);
  near(e.hp, 1000 - w.damage);
  const body = Bodies.rectangle(520, 411, 60, 20);
  assert(
    wireCrossing({ x: 300, y: 400 }, { x: 500, y: 400 }, body, body.position),
    'Hull touching the endpoint was missed',
  );
  Body.setPosition(body, { x: 540, y: 425 });
  assert.equal(wireCrossing({ x: 300, y: 400 }, { x: 500, y: 400 }, body, body.position), null);
});

test('boss armor and shields remain effective and the blast does not stun-lock bosses', () => {
  for (const kind of ['loader', 'press', 'condenser', 'interceptor'] as const) {
    const g = fixture(),
      w = wire(g),
      e = enemy(g, 500, 400, kind);
    e.state = 'hunt';
    arm(g);
    resolve(g);
    const armor = kind === 'condenser' ? 0.25 : kind === 'interceptor' ? 0.35 : 0.4;
    near(e.hp, 1000 - w.damage * armor);
    assert.equal(e.state, 'hunt');
  }
  const g = fixture(),
    a = wall(g, 500, 240, 120, 20),
    b = wall(g, 500, 560, 120, 20);
  pin(g, a, { x: 500, y: 250 }, { x: 0, y: 1 });
  pin(g, b, { x: 500, y: 550 }, { x: 0, y: -1 });
  const w = g.tripwires.wires[0];
  assert(w);
  const e = enemy(g, 512, 400);
  e.elite = 'shielded';
  e.facing = -1;
  arm(g);
  resolve(g);
  near(e.hp, 1000 - w.damage * 0.1);
});

test('nearby targets take ordinary blast falloff while solid cover protects others', () => {
  const g = fixture(),
    w = wire(g),
    e = enemy(g),
    nearby = enemy(g, 520, 440),
    covered = enemy(g, 580, 460);
  wall(g, 570, 460, 12, 70);
  arm(g);
  resolve(g);
  near(e.hp, 1000 - w.damage);
  assert(nearby.hp < 1000);
  near(covered.hp, 1000);
});

test('destroying or moving a supporting surface removes its pins and wires without a blast', () => {
  for (const move of [false, true]) {
    const g = fixture(),
      w = wire(g);
    if (move) Body.translate(w.a.body, { x: 1, y: 0 });
    else {
      g.terrain = g.terrain.filter((b) => b !== w.a.body);
      Composite.remove(g.engine.world, w.a.body);
    }
    resolve(g);
    assert.equal(g.tripwires.wires.length, 0);
    assert.equal(g.demolition.effects.length, 0);
  }
  const g = fixture(),
    b = wall(g, 400);
  g.destruction.register(b, { x: 390, y: 200, w: 20, h: 400 });
  pin(g, b, { x: 390, y: 400 }, { x: -1, y: 0 });
  assert(g.tripwires.anchor);
  g.destruction.hitBody(b, 999, { x: 1, y: 0 });
  resolve(g);
  assert.equal(g.tripwires.anchor, null);
});

test('fast moving cover cuts a wire harmlessly even when both sampled positions are clear', () => {
  const g = fixture();
  wire(g);
  arm(g);
  const crate = g.props.spawn('crate', 500, 250),
    e = enemy(g, 1200, 400);
  g.tripwires.beforeStep();
  Body.setPosition(crate.body, { x: 500, y: 550 });
  Body.setVelocity(crate.body, { x: 0, y: 17 });
  g.tripwires.afterStep();
  assert.equal(g.tripwires.wires.length, 0);
  assert.equal(g.demolition.effects.length, 0);
  near(e.hp, 1000);
  near(crate.body.velocity.y, 17);
});

test('a rotating obstacle can cut a wire with its actual swept shape', () => {
  const g = fixture();
  wire(g);
  arm(g);
  const b = wall(g, 500, 300, 180, 10);
  Body.setAngle(b, -0.7);
  g.tripwires.beforeStep();
  Body.setAngle(b, 0.7);
  g.tripwires.afterStep();
  // This short beam never reaches y400; enlarged velocity bounds must not invent contact.
  assert.equal(g.tripwires.wires.length, 1);
  Body.setPosition(b, { x: 500, y: 340 });
  g.tripwires.beforeStep();
  Body.setAngle(b, 1.4);
  g.tripwires.afterStep();
  assert.equal(g.tripwires.wires.length, 0);
});

test('teleports do not trace a false crossing, but an enemy touching a wire at the exit triggers it', () => {
  const g = fixture(),
    w = wire(g),
    e = enemy(g, 500, 200);
  arm(g);
  g.tripwires.beforeStep();
  Body.setPosition(e.body, { x: 500, y: 650 });
  g.tripwires.teleported(e.body);
  g.tripwires.afterStep();
  near(e.hp, 1000);
  assert(g.tripwires.wires.includes(w));
  g.tripwires.beforeStep();
  Body.setPosition(e.body, { x: 500, y: 400 });
  g.tripwires.teleported(e.body);
  g.tripwires.afterStep();
  near(e.hp, 1000 - w.damage);
});

test('friendly movement and shots cannot trigger wires, and enemies still spawning are ignored', () => {
  const g = fixture(),
    w = wire(g);
  arm(g);
  Body.setPosition(g.player, { x: 500, y: 400 });
  round(g, { x: 500, y: 400 }, { x: 10, y: 0 });
  const e = enemy(g);
  e.spawn = 1;
  resolve(g);
  assert(g.tripwires.wires.includes(w));
  assert.equal(g.demolition.effects.length, 0);
  assert.equal(g.hp, 100);
});

test('Aftershock and Blast surfing apply once while player health is preserved', () => {
  const g = fixture(['tripwire', 'shellshock', 'aftershock', 'blast-surf']);
  const w = wire(g);
  const prior = g.demolition.pending.length;
  enemy(g);
  Body.setPosition(g.player, { x: 500, y: 350 });
  arm(g);
  resolve(g);
  assert.equal(g.demolition.pending.length, prior + 1);
  near(g.demolition.pending.at(-1)!.damage, w.damage * 0.4);
  assert(g.player.velocity.y < 0);
  near(g.hp, 100);
  g.time += 0.4;
  g.demolition.update();
  assert.equal(g.demolition.pending.length, 0);
  assert.equal(g.tripwires.wires.length, 0);
});

test('pause and hitstop freeze traps; death, rooms, retry, and extraction clear their state', () => {
  const g = fixture(),
    w = wire(g);
  g.setMode('paused');
  g.tick(1, idle);
  assert(g.tripwires.wires.includes(w));
  g.setMode('playing');
  g.hitStop = 0.1;
  g.tick(1 / 60, idle);
  assert(g.tripwires.wires.includes(w));
  g.setMode('dead');
  assert.equal(g.tripwires.wires.length, 0);
  g.startTest(tripwireTestFromUrl(new URL('https://test/?test=tripwire'))!);
  assert.equal(g.tripwires.anchor, null);
  assert.equal(g.tripwires.wires.length, 0);
  const h = fixture();
  wire(h);
  h.loadRoom();
  assert.equal(h.tripwires.wires.length, 0);
});

test('presets are legal and isolated, ambiguous URLs are rejected, and seeded rewards include the new pair', () => {
  for (const build of ['base', 'evolved', 'bank', 'portal', 'demolition']) {
    const save = tripwireTestFromUrl(new URL('https://test/?test=tripwire&build=' + build));
    assert(save);
    assert.deepEqual(loadCheckpoint(save), save);
    const g = new Game();
    let writes = 0,
      victories = 0;
    g.onCheckpoint = () => writes++;
    g.onBossDefeated = () => victories++;
    g.startTest(save);
    g.save();
    assert.equal(writes, 0);
    assert.equal(victories, 0);
    assert(g.mods.includes('tripwire'));
    assert(g.testRun);
  }
  for (const extra of [
    '&test=tripwire',
    '&build=bad',
    '&build=base&build=portal',
    '&daily=2026-09-13',
    '&seed=x',
    '&area=furnace',
  ])
    assert.equal(tripwireTestFromUrl(new URL('https://test/?test=tripwire' + extra)), null);
  let found = false;
  for (let n = 0; n < 120; n++) {
    const seed = dailyForDate(new Date(Date.UTC(2026, 8, n + 1)).toISOString().slice(0, 10))!.seed;
    const run = () => {
      const mods: string[] = [],
        rng = seeded(seed);
      for (let i = 0; i < 19; i++) {
        const m = rewardMods(mods, 1, rng, { stage: i })[0];
        if (m) mods.push(m.id);
      }
      return mods;
    };
    const mods = run();
    assert.deepEqual(mods, run());
    assert(validBuild(mods));
    found ||= mods.includes('tension');
  }
  assert(found);
});

test('ordinary fire inputs rig a floor trap that kills a pursuing runner in the real physics loop', () => {
  const g = fixture(['tripwire', 'tension']);
  g.engine.gravity.y = 1;
  Body.setPosition(g.player, { x: 200, y: 718 });
  g.spawnEnemy('runner', 980, 716);
  g.enemies[0].spawn = 0;
  let rigged = false,
    detonated = false;
  g.onSound = (kind) => {
    if (kind === 'shell-blast') detonated = true;
  };
  for (let i = 0; i < 300 && !g.clear && g.mode === 'playing'; i++) {
    const firing = i === 0 || i === 22;
    g.tick(1 / 60, {
      ...idle,
      fire: firing,
      firePressed: firing,
      aim: { x: i < 22 ? 480 : 760, y: 740 },
    });
    rigged ||= g.tripwires.wires.length > 0;
  }
  assert(rigged, 'The two primary shots did not rig a floor wire');
  assert(detonated, 'The approaching runner never triggered it');
  assert(g.clear);
  assert.equal(g.kills, 1);
  assert.equal(g.hp, 100);
});

test('real enemy portal travel does not detonate a wire across the teleport chord', () => {
  const g = fixture(['tripwire', 'fold']);
  const top = wall(g, 800, 240, 120, 20),
    bottom = wall(g, 800, 660, 120, 20);
  pin(g, top, { x: 800, y: 250 }, { x: 0, y: 1 });
  pin(g, bottom, { x: 800, y: 650 }, { x: 0, y: -1 });
  assert.equal(g.tripwires.wires.length, 1);
  wall(g, 310, 400, 20, 500);
  assert(g.portals.place({ x: 300, y: 400 }));
  assert(g.portals.place({ x: 1400, y: 740 }));
  const e = enemy(g, 276, 400);
  Body.setVelocity(e.body, { x: 24, y: 0 });
  arm(g);
  g.tripwires.beforeStep();
  g.portals.beforeStep();
  Matter.Engine.update(g.engine, 1000 / 60);
  g.tripwires.afterStep();
  assert(e.body.position.x > 1300, 'The enemy must actually travel through the portal');
  assert.equal(g.tripwires.wires.length, 1);
  assert.equal(g.demolition.effects.length, 0);
  near(e.hp, 1000);
});
