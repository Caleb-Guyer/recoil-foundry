import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input, type Shot } from '../src/game.ts';
import { ShiftMorphs, SHIFT_MORPH_IDS, MORPH } from '../src/shift-morphs.ts';
import { getGun, distance } from '../src/rules.ts';
import { STARTING_GUN_IDS, type StartingGun } from '../src/starting-guns.ts';
const { Body, Bodies, Composite, Engine } = Matter,
  DT = 1 / 60;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 400 },
};
function fixture(mods: string[], gun: StartingGun = 'pistol') {
  const g = new Game();
  Object.assign(g, { shiftMorphs: new ShiftMorphs(g) });
  g.start('RF-C107-MORPH-TEST');
  g.waves.clear();
  g.hazards.clear();
  g.breaches.clear();
  g.destruction.clear();
  g.conveyors.clear();
  g.crossing.clear();
  g.freight.clear();
  g.pressure.clear();
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.level.solids = [];
  g.mods = mods;
  g.startingGun = gun;
  g.gun = getGun(mods, gun);
  g.engine.gravity.y = 0;
  Body.setPosition(g.player, { x: 200, y: 400 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.aim = { ...idle.aim };
  g.grounded = false;
  return g;
}
function clean(g: Game) {
  Composite.clear(g.engine.world, false);
  Engine.clear(g.engine);
}
function enemy(g: Game, x: number, y = 400) {
  const e = g.spawnEnemy('shooter', x, y)!;
  e.spawn = 0;
  Body.setStatic(e.body, true);
  return e;
}
function wall(g: Game, x: number, y = 400, w = 20, h = 400) {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  return b;
}
function round(g: Game, pos = { x: 300, y: 400 }, extra: Partial<Shot> = {}) {
  const s = g.addShot({
    pos,
    vel: { x: 24, y: 0 },
    damage: g.gun.damage,
    life: 1.4,
    friendly: true,
    radius: 2.5,
    bounces: 0,
    pierce: g.gun.pierce,
    fragment: false,
    split: false,
    ...extra,
  })!;
  g.shiftMorphs.prepare(s);
  return s;
}
function flight(g: Game, n = 1) {
  for (let i = 0; i < n; i++) {
    g.time += DT;
    g.updateShots(DT);
  }
}

test('Piston Lance extends real damaging native rounds to a short reach and retracts without hitting the same enemy twice', () => {
  const g = fixture(['piston-lance', 'pierce']);
  const e = enemy(g, 390),
    hp = e.hp;
  const s = round(g);
  let far = 0,
    returned = false;
  for (let i = 0; i < 40 && s.life > 0; i++) {
    flight(g);
    far = Math.max(far, s.pos.x);
    returned ||= s.vel.x < 0;
  }
  assert(e.hp < hp);
  assert(returned);
  assert(far <= 300 + MORPH.pistonReach + 2);
  assert.equal(e.hp, hp - g.gun.damage * 1.25);
  assert(s.life <= 0);
  clean(g);
});
test('Piston and Cable cannot retract through real cover or sweep a teleport gap', () => {
  for (const id of ['piston-lance', 'cable-saw']) {
    const g = fixture([id]);
    const b = wall(g, 380),
      s = round(g);
    const e = enemy(g, 500),
      hp = e.hp;
    flight(g, 25);
    assert(s.life <= 0);
    assert.equal(e.hp, hp);
    const another = round(g, { x: 300, y: 300 });
    Body.translate(g.player, { x: 300, y: 0 });
    g.shiftMorphs.updateShot(another, DT);
    assert.equal(another.life, 0);
    clean(g);
  }
});
test('Cable Saw follows a real swept tethered arc while held, then physically returns when released', () => {
  const g = fixture(['cable-saw', 'pierce']);
  g.shiftMorphs.input(DT, { ...idle, fire: true });
  const s = round(g);
  const ys: number[] = [];
  for (let i = 0; i < 18 && s.life > 0; i++) {
    flight(g);
    ys.push(s.pos.y);
  }
  assert(s.radius >= 7);
  assert(ys.some((y) => Math.abs(y - 400) > 4));
  const at = { ...s.pos };
  g.shiftMorphs.input(DT, idle);
  flight(g, 4);
  assert(distance(g.player.position, s.pos) < distance(g.player.position, at));
  clean(g);
});

for (const gun of STARTING_GUN_IDS)
  test(`Seeker Rack paints exposed targets, then releases one complete native ${gun} volley or burst`, () => {
    const g = fixture(['seeker-rack', 'scatter', 'crossfire'], gun);
    enemy(g, 900);
    const m = g.shiftMorphs;
    for (let i = 0; i < 24; i++) {
      const filtered = m.input(DT, { ...idle, fire: true });
      assert(!filtered.fire && !filtered.firePressed);
      g.time += DT;
    }
    assert(m.locks.some((l) => l.progress === 1));
    const start = g.shotCount;
    let emitted = 0;
    for (let i = 0; i < 80; i++) {
      const filtered = m.input(DT, idle);
      g.time += DT;
      g.aim = filtered.aim;
      if (g.burstRemaining > 0 && g.time >= g.burstAt) {
        g.burstRemaining--;
        g.burstAt = g.time + g.gun.interval * 0.3;
        g.fireRound();
      } else if (filtered.fire && g.time >= g.shootAt && !g.burstRemaining) g.fire();
      emitted = g.shotCount - start;
    }
    assert.equal(emitted, g.gun.burstCount);
    assert.equal(
      g.shots.filter((s) => s.friendly && !s.fragment).length,
      g.gun.pellets * g.gun.lanes * g.gun.burstCount,
    );
    assert([...m.flights.values()].every((f) => f.target));
    clean(g);
  });
test('Seeker homing keeps native speed and is intercepted by cover; pause cannot release stored locks', () => {
  const g = fixture(['seeker-rack']);
  const e = enemy(g, 800, 470);
  for (let i = 0; i < 24; i++)
    g.shiftMorphs.input(DT, { ...idle, fire: true, aim: { ...e.body.position } });
  g.shiftMorphs.input(DT, idle);
  const s = round(g),
    speed = Math.hypot(s.vel.x, s.vel.y);
  g.shiftMorphs.updateShot(s, DT);
  assert(s.vel.y > 0);
  assert(Math.abs(Math.hypot(s.vel.x, s.vel.y) - speed) < 1e-7);
  wall(g, 500, 430, 20, 200);
  const hp = e.hp;
  flight(g, 35);
  assert.equal(e.hp, hp);
  assert(s.life <= 0);
  g.shiftMorphs.pause();
  assert.equal(g.shiftMorphs.locks.length, 0);
  assert(!g.shiftMorphs.input(DT, idle).fire);
  clean(g);
});
test('covered enemies cannot gain Seeker locks and releasing an unpainted rack cannot fire', () => {
  const g = fixture(['seeker-rack']);
  enemy(g, 800);
  wall(g, 500);
  for (let i = 0; i < 80; i++) g.shiftMorphs.input(DT, { ...idle, fire: true });
  assert.equal(g.shiftMorphs.locks.length, 0);
  assert(!g.shiftMorphs.input(DT, idle).fire);
  clean(g);
});

for (const gun of STARTING_GUN_IDS)
  for (const id of SHIFT_MORPH_IDS)
    test(`${id} retains ${gun} pellets, lanes, Shellshock and Mass Driver payloads`, () => {
      for (const conversion of [[], ['shellshock'], ['mass-driver']]) {
        const mods = [id, 'scatter', 'crossfire', 'ricochet', 'pierce', ...conversion],
          g = fixture(mods, gun);
        const expected = getGun(mods, gun);
        g.fireRound();
        assert.equal(g.shots.length, expected.pellets * expected.lanes);
        assert.equal(g.gun.damage, expected.damage);
        assert(
          g.shots.every(
            (s) =>
              s.pierce === expected.pierce + Number(id === 'piston-lance' || id === 'cable-saw') &&
              s.bounces === expected.bounces,
          ),
        );
        if (conversion.includes('shellshock')) assert(g.shots.every((s) => s.shell));
        if (conversion.includes('mass-driver')) assert(g.shots.every((s) => s.massDriver));
        clean(g);
      }
    });

test('foam grows as real collision geometry, supports a native falling body, blocks rounds, expires and leaves original terrain', () => {
  const g = fixture(['foamcaster']);
  const shelf = wall(g, 650, 600, 500, 20),
    s = round(g, { x: 650, y: 587 });
  const original = g.terrain.length;
  g.shiftMorphs.terrainHit(s, shelf, { x: 0, y: -1 });
  assert.equal(g.shiftMorphs.foams.length, 1);
  const foam = g.shiftMorphs.foams[0];
  assert(g.terrain.includes(foam.body));
  for (let i = 0; i < 40; i++) {
    g.time += DT;
    g.shiftMorphs.tick(DT);
  }
  assert.equal(foam.width, MORPH.foamWidth);
  assert(Math.abs(foam.body.bounds.max.x - foam.body.bounds.min.x - MORPH.foamWidth) < 1e-6);
  Body.setPosition(g.player, { x: 650, y: 460 });
  g.engine.gravity.y = 1;
  for (let i = 0; i < 90; i++) Engine.update(g.engine, 1000 / 60);
  assert(
    Math.abs(g.player.bounds.max.y - foam.body.bounds.min.y) < 2,
    'the real Matter support catches the falling player',
  );
  Body.setPosition(g.player, { x: 200, y: 400 });
  const hostile = round(g, { x: 650, y: 500 }, { friendly: false, vel: { x: 0, y: 15 } });
  flight(g, 10);
  assert(hostile.life <= 0);
  g.time = foam.until + 0.01;
  g.shiftMorphs.tick(DT);
  assert.equal(g.shiftMorphs.foams.length, 0);
  assert.equal(g.terrain.length, original);
  assert(g.terrain.includes(shelf));
  clean(g);
});
test('vertical foam expands tangentially, respects its three-body cap and reset removes every owned support', () => {
  const g = fixture(['foamcaster']);
  const solid = wall(g, 800, 400, 20, 600);
  const s = round(g, { x: 787, y: 400 });
  g.shiftMorphs.terrainHit(s, solid, { x: -1, y: 0 });
  const f = g.shiftMorphs.foams[0];
  assert(f);
  for (let i = 0; i < 40; i++) {
    g.time += DT;
    g.shiftMorphs.tick(DT);
  }
  assert(Math.abs(f.body.bounds.max.x - f.body.bounds.min.x - MORPH.foamHeight) < 1e-6);
  assert(Math.abs(f.body.bounds.max.y - f.body.bounds.min.y - MORPH.foamWidth) < 1e-6);
  for (let i = 0; i < 4; i++) {
    g.time += 0.4;
    const surface = wall(g, 400 + i * 300, 620, 150, 20);
    g.shiftMorphs.terrainHit(round(g, { x: 400 + i * 300, y: 607 }), surface, { x: 0, y: -1 });
  }
  assert.equal(g.shiftMorphs.foams.length, 3);
  const owned = g.shiftMorphs.foams.map((f) => f.body);
  g.shiftMorphs.reset();
  assert(owned.every((b) => !g.terrain.includes(b) && !g.engine.world.bodies.includes(b)));
  clean(g);
});
test('foam rejects actors, objective hulls and exits, and paused growth cannot crush a later actor', () => {
  const g = fixture(['foamcaster']);
  const floor = wall(g, 1000, 600, 1600, 20);
  const s = round(g, { x: 500, y: 587 });
  const prop = g.props.spawn('crate', 500, 570);
  prop.uprising = 'relay';
  g.shiftMorphs.terrainHit(s, floor, { x: 0, y: -1 });
  assert.equal(g.shiftMorphs.foams.length, 0);
  g.props.remove(prop);
  g.shiftMorphs.terrainHit(round(g, { x: 1850, y: 587 }), floor, { x: 0, y: -1 });
  assert.equal(g.shiftMorphs.foams.length, 0);
  g.shiftMorphs.terrainHit(round(g, { x: 800, y: 587 }), floor, { x: 0, y: -1 });
  const f = g.shiftMorphs.foams[0];
  assert(f);
  Body.setPosition(g.player, { x: 830, y: f.body.position.y });
  g.time += 0.1;
  g.shiftMorphs.tick(0.1);
  assert.equal(f.width, 12);
  g.setMode('paused');
  const state = JSON.stringify(f.body.vertices.map(({ x, y }) => ({ x, y })));
  g.time += 1;
  g.shiftMorphs.tick(0.1);
  assert.equal(JSON.stringify(f.body.vertices.map(({ x, y }) => ({ x, y }))), state);
  clean(g);
});

test('foam creation and growth respect the Crane head as a separate native physical hull', () => {
  const g = fixture(['foamcaster']);
  const floor = wall(g, 1000, 600, 1600, 20);
  const crane = g.spawnEnemy('crane', 1500, 150)!;
  crane.spawn = 0;
  assert(crane.crane);
  Body.setPosition(crane.crane.body, { x: 500, y: 580.5 });
  g.shiftMorphs.terrainHit(round(g, { x: 500, y: 587 }), floor, { x: 0, y: -1 });
  assert.equal(g.shiftMorphs.foams.length, 0, 'the future support cannot be born through a head');
  Body.setPosition(crane.crane.body, { x: 1800, y: 300 });
  g.shiftMorphs.terrainHit(round(g, { x: 800, y: 587 }), floor, { x: 0, y: -1 });
  const foam = g.shiftMorphs.foams[0];
  assert(foam);
  Body.setPosition(crane.crane.body, { x: 838, y: foam.body.position.y });
  assert.equal(Matter.Query.collides(foam.body, [crane.crane.body]).length, 0);
  g.time += 0.1;
  g.shiftMorphs.tick(0.1);
  assert.equal(foam.width, 12, 'a head entering the growth envelope blocks expansion');
  Body.setPosition(crane.crane.body, { x: 1800, y: 300 });
  g.time += 0.1;
  g.shiftMorphs.tick(0.1);
  assert(foam.width > 12, 'growth resumes once the actual head clears');
  clean(g);
});

for (const gun of STARTING_GUN_IDS)
  test(`Seeker Rack uses full native ${gun} beam control and finishes its sequence after the painted target dies`, () => {
    const g = fixture(['seeker-rack', 'cutting-torch', 'scatter', 'crossfire'], gun),
      target = enemy(g, 650, 400);
    target.workshopTarget = { home: { x: 650, y: 400 }, moving: false };
    const spare = enemy(g, 1600, 100);
    spare.workshopTarget = { home: { x: 1600, y: 100 }, moving: false };
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.onCommendation = () => writes++;
    for (let i = 0; i < 28; i++)
      g.tick(DT, { ...idle, fire: true, aim: { ...target.body.position } });
    assert.equal(g.shotCount, 0, 'painting cannot leak a native pulse or buffered trigger');
    for (let i = 0; i < 150; i++) g.tick(DT, { ...idle, fire: false, aim: { x: 650, y: 400 } });
    assert.equal(
      g.shotCount,
      g.gun.burstCount,
      'the original single pulse or three-pulse mechanism finishes exactly once',
    );
    assert.equal(writes, 0);
    clean(g);
  });

test('hitstop cannot put an unpainted Seeker trigger in the native fire buffer; pause cancels a queued beam cast', () => {
  const g = fixture(['seeker-rack', 'cutting-torch']);
  const e = enemy(g, 650);
  e.workshopTarget = { home: { x: 650, y: 400 }, moving: false };
  g.hitStop = 0.1;
  g.tick(DT, { ...idle, fire: true, firePressed: true });
  assert.equal(g.fireBuffer, 0);
  assert.equal(g.shotCount, 0);
  for (let i = 0; i < 40; i++) g.tick(DT, { ...idle, fire: true });
  assert.equal(g.shotCount, 0);
  g.setMode('paused');
  g.setMode('playing');
  for (let i = 0; i < 30; i++) g.tick(DT, idle);
  assert.equal(g.shotCount, 0);
  clean(g);
});

for (const id of SHIFT_MORPH_IDS)
  for (const gun of STARTING_GUN_IDS)
    test(`${id} keeps all earned ${gun} beam rays while applying only its intended geometry`, () => {
      const g = fixture([id, 'cutting-torch', 'scatter', 'crossfire'], gun);
      g.time = DT;
      g.torch.beforeStep(DT, true);
      g.torch.afterStep(DT);
      const muzzle = g.torch.segments.filter((s) => s.muzzle);
      assert.equal(muzzle.length, g.gun.pellets * g.gun.lanes);
      if (id === 'piston-lance' || id === 'cable-saw')
        assert(g.torch.segments.every((s) => distance(s.a, s.b) <= MORPH.pistonReach + 1));
      else assert(g.shiftMorphs.beamRange(1100) === 1100);
      clean(g);
    });

test('parked Suspension rounds keep their full storage window before a morph starts, and Rail spike keeps its real payload', () => {
  const g = fixture(['piston-lance', 'suspension']);
  const s = round(g);
  assert(s.stasis);
  assert(!g.shiftMorphs.flights.has(s));
  g.time = 1;
  g.shiftMorphs.updateShot(s, DT);
  assert(!g.shiftMorphs.flights.has(s));
  g.stasis.abandon(s);
  g.shiftMorphs.updateShot(s, DT);
  assert.equal(g.shiftMorphs.flights.get(s)!.born, 1);
  clean(g);
  const rail = fixture(['piston-lance', 'deadeye', 'capacitor', 'rail-spike']);
  rail.ballistics.charges = 1;
  rail.fireRound();
  const r = rail.shots.find((s) => s.rail)!;
  assert(r);
  assert(rail.shiftMorphs.flights.has(r));
  assert(r.pierce >= 4);
  clean(rail);
});

test('a leased morph changes the real tool without adding an owned upgrade or changing the native gun', () => {
  const g = fixture([]),
    before = JSON.stringify(g.gun);
  Object.assign(g, { shiftRun: { leasedMorph: 'cable-saw' } });
  assert.equal(g.shiftMorphs.equipped, 'cable-saw');
  const s = round(g);
  assert(g.shiftMorphs.flights.has(s));
  assert.equal(g.mods.length, 0);
  assert.equal(JSON.stringify(g.gun), before);
  clean(g);
});

test('Foamcaster keeps the actual Uprising extraction pad and switch interaction space clear', () => {
  const g = fixture(['foamcaster']);
  const floor = wall(g, 800, 600, 500, 20);
  const u = g.uprising;
  Object.defineProperty(u, 'room', {
    configurable: true,
    get: () => ({ evacuation: { x: 700, y: 500, w: 180, h: 90 }, switches: [{ x: 1000, y: 570 }] }),
  });
  g.shiftMorphs.terrainHit(round(g, { x: 790, y: 587 }), floor, { x: 0, y: -1 });
  assert.equal(g.shiftMorphs.foams.length, 0);
  const other = wall(g, 1000, 600, 150, 20);
  g.shiftMorphs.terrainHit(round(g, { x: 1000, y: 587 }), other, { x: 0, y: -1 });
  assert.equal(g.shiftMorphs.foams.length, 0);
  clean(g);
});

test('Piston pays its complete native round, shell and ball gain once, including cloned echoes', () => {
  for (const conversion of [[], ['shellshock'], ['mass-driver']]) {
    const base = fixture(conversion),
      changed = fixture(['piston-lance', ...conversion]);
    base.fireRound();
    changed.fireRound();
    const a = base.shots[0],
      b = changed.shots[0];
    assert(Math.abs(b.damage / a.damage - 1.25) < 1e-8);
    assert.equal(b.pierce, a.pierce + 1);
    if (a.shell) assert(Math.abs(b.shell!.damage / a.shell.damage - 1.25) < 1e-8);
    const nativeGun = JSON.stringify(changed.gun),
      copy = structuredClone(b);
    copy.id = ++changed.id;
    copy.echo = true;
    const damage = copy.damage,
      pierce = copy.pierce,
      payload = copy.shell?.damage;
    changed.shiftMorphs.prepare(copy);
    assert.equal(copy.damage, damage);
    assert.equal(copy.pierce, pierce);
    assert.equal(copy.shell?.damage, payload);
    assert.equal(JSON.stringify(changed.gun), nativeGun);
    clean(base);
    clean(changed);
  }
});
test('Cable has one real half-strength return hit and its secondary kill cannot reboot another ally', () => {
  const g = fixture(['cable-saw', 'magnum', 'kick', 'spoof', 'polarity-rounds']);
  const e = enemy(g, 390),
    hp = e.hp;
  const s = round(g),
    damage = s.damage;
  let returning = false;
  const hits: number[] = [];
  const hit = g.hitEnemy.bind(g);
  g.hitEnemy = (target, amount, ...args) => {
    if (target === e) hits.push(amount);
    return hit(target, amount, ...args);
  };
  for (let frame = 0; frame < 70 && s.life > 0; frame++) {
    flight(g);
    returning ||= s.fragment && s.echo && g.shiftMorphs.flights.get(s)!.returnPaid;
  }
  assert(returning);
  assert.equal(hits.length, 2);
  assert(Math.abs(hits[0] - damage) < 1e-8);
  assert(
    Math.abs(hits[1] - damage * 0.8 * 0.5) < 1e-8,
    'the return halves the native payload after its ordinary penetration falloff',
  );
  assert(hp < damage * 1.5);
  assert.equal(g.spoof.pending.length, 0);
  assert.equal(g.factions.allies.length, 0);
  assert.equal(s.counter, 0);
  clean(g);
});
test('Cable preserves Recall’s native return damage and never adds a third discounted leg', () => {
  const g = fixture(['cable-saw', 'recall', 'pierce']);
  const s = round(g),
    damage = s.damage;
  let cameBack = false;
  for (let frame = 0; frame < 80 && s.life > 0; frame++) {
    flight(g);
    cameBack ||= !!s.recall?.returning;
    assert.equal(s.damage, damage);
    assert(!s.fragment, 'native Recall is not replaced with a secondary morph return');
  }
  assert(cameBack);
  clean(g);
});
for (const id of ['piston-lance', 'cable-saw'])
  test(`${id} compensates its short beam with exactly 35% energy and one penetration while preserving native pulse cadence`, () => {
    const base = fixture(['cutting-torch', 'scatter', 'crossfire']),
      changed = fixture([id, 'cutting-torch', 'scatter', 'crossfire']);
    Body.setPosition(base.player, { x: 200, y: 400 });
    Body.setPosition(changed.player, { x: 200, y: 400 });
    const a = enemy(base, 245),
      b = enemy(changed, 245),
      ha = a.hp,
      hb = b.hp;
    for (let frame = 0; frame < 3; frame++) {
      for (const g of [base, changed]) {
        g.time += DT;
        g.torch.beforeStep(DT, true);
        g.torch.afterStep(DT);
      }
    }
    assert(Math.abs((hb - b.hp) / (ha - a.hp) - 1.35) < 1e-7);
    assert.equal(changed.shotCount, base.shotCount);
    assert.equal(changed.shiftMorphs.beamPierce(changed.gun.pierce), changed.gun.pierce + 1);
    assert.equal(
      changed.torch.segments.filter((s) => s.muzzle).length,
      base.torch.segments.filter((s) => s.muzzle).length,
    );
    clean(base);
    clean(changed);
  });
