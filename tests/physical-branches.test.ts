import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, target, wall, round, advance, Body, Composite } from './branches-fixture.ts';
import { GRIND } from '../src/grindshot.ts';
import { CLUSTER_LIMIT } from '../src/demolition.ts';
import { getGun } from '../src/rules.ts';
import { traceTorch, TORCH } from '../src/torch.ts';
const near = (a: number, b: number, e = 1e-5) => assert(Math.abs(a - b) < e, `${a} != ${b}`);

test('Pinwheel sweeps bounded outer lanes, keeps the center and mirrors the rear without extra recoil', () => {
  const g = fixture(['crossfire', 'pinwheel', 'backblast', 'backfire']);
  const angles = [];
  for (let i = 0; i < 8; i++) {
    g.shots = [];
    Body.setVelocity(g.player, { x: 0, y: 0 });
    g.fireRound();
    assert.equal(g.shots.length, 6);
    near(g.shots[1].vel.y, 0);
    near(g.shots[4].vel.y, 0);
    for (let n = 0; n < 3; n++) {
      near(g.shots[n].vel.x, -g.shots[n + 3].vel.x);
      near(g.shots[n].vel.y, -g.shots[n + 3].vel.y);
    }
    const angle = Math.abs(Math.atan2(g.shots[0].vel.y, g.shots[0].vel.x));
    assert(angle >= 0.12 - 1e-8 && angle <= 0.52 + 1e-8);
    angles.push(angle);
    near(g.player.velocity.x, -g.gun.recoil);
  }
  assert(Math.max(...angles) - Math.min(...angles) > 0.3);
});

test('Follow-through moves the recorded volley to the new position and cannot emit inside new cover', () => {
  for (const blocked of [false, true]) {
    const g = fixture(['crossfire', 'afterimage', 'follow-through', 'pinwheel', 'scatter']);
    for (let i = 0; i < 4; i++) g.fireRound();
    const template = g.ballistics.echoes[0].shots;
    Body.setPosition(g.player, { x: 1000, y: 300 });
    g.aim = { x: 1000, y: 0 };
    if (blocked) wall(g, 1000, 300, 60, 100);
    const count = g.shotCount;
    g.time = 0.5;
    g.ballistics.update();
    const echoes = g.shots.filter((s) => s.echo);
    assert.equal(g.shotCount, count);
    assert.equal(echoes.length, blocked ? 0 : 15);
    if (!blocked)
      for (let i = 0; i < echoes.length; i++) {
        near(echoes[i].pos.x - template[i].pos.x, 800);
        near(echoes[i].vel.x, template[i].vel.x);
        near(echoes[i].vel.y, template[i].vel.y);
        near(echoes[i].damage, template[i].damage * 0.6);
        assert(!echoes[i].tripwire);
      }
  }
});

test('guided echoes replay actual recorded turns instead of following the current cursor', () => {
  const g = fixture(['crossfire', 'afterimage', 'vector', 'afterburner']);
  for (let i = 0; i < 4; i++) g.fireRound();
  g.aim = { x: 900, y: 50 };
  advance(g, 20);
  const guides = g.ballistics.echoes[0].guides!;
  assert(
    [...guides.values()].some((samples) => samples.some((sample) => Math.abs(sample.turn) > 0.01)),
  );
  g.aim = { x: 900, y: 700 };
  advance(g, 12);
  const echo = g.shots.find((s) => s.echo && s.vector?.replay)!;
  assert(echo);
  assert(echo.vector!.replay!.index > 0);
  assert(echo.vel.y < 0);
  assert(!echo.vector!.recording);
  assert.equal(echo.relay, true);
});

test('guided Recall keeps a useful outward window and takes sole control of its return', () => {
  const g = fixture(['vector', 'afterburner', 'recall']);
  const s = round(g);
  g.aim = { x: 1000, y: 100 };
  advance(g, 18);
  assert(!s.recall!.returning);
  const age = s.vector!.time;
  advance(g, 15);
  assert(s.recall!.returning);
  const time = s.vector!.time;
  advance(g, 3);
  near(s.vector!.time, time);
  assert(time >= age);
});

test('Breach shares a finite clearance budget across volleys and cannot remove heavy rounds or blades', () => {
  const g = fixture(['backblast', 'breach', 'burst', 'rapid']);
  const small = Array.from({ length: 5 }, (_, i) =>
    round(g, { pos: { x: 130 + i * 5, y: 300 }, friendly: false, radius: 3 }),
  );
  const heavy = round(g, { pos: { x: 140, y: 300 }, friendly: false, radius: 6 });
  const blade = round(g, { pos: { x: 140, y: 300 }, friendly: false, radius: 3, blade: true });
  g.fireBackblast({ x: 1, y: 0 }, 1);
  assert.equal(small.filter((s) => s.life <= 0).length, 2);
  for (let i = 0; i < 4; i++) {
    g.time += 0.05;
    g.fireBackblast({ x: 1, y: 0 }, 1);
  }
  assert.equal(small.filter((s) => s.life <= 0).length, 2);
  g.time = 0.46;
  g.fireBackblast({ x: 1, y: 0 }, 1);
  assert.equal(small.filter((s) => s.life <= 0).length, 4);
  assert(heavy.life > 0 && blade.life > 0);
});

test('a charged rail terminates in one real saw with its merged payload and prior hit exclusions', () => {
  const g = fixture(['deadeye', 'capacitor', 'rail-spike', 'grindshot']);
  wall(g, 700, 300, 10, 300);
  const e = target(g, 450);
  g.ballistics.charges = 1;
  g.fireRound();
  const s = g.shots[0],
    payload = s.damage;
  advance(g, 9);
  assert.equal(g.grind.saws.length, 1);
  near(g.grind.saws[0].damage, payload);
  assert(g.grind.saws[0].hits.has(e.id));
  assert(!g.shots.some((s) => s.rail));
});

test('Crosscut and echo saws share finite density, retain payload and travel in opposite directions', () => {
  const g = fixture(['grindshot', 'crosscut']);
  const b = wall(g, 700, 500, 500, 30);
  const s = round(g, { pos: { x: 700, y: 480 }, vel: { x: 10, y: 20 }, echo: true, damage: 60 });
  s.hits.add(123);
  g.grind.impact(s, b, { x: 0, y: -1 });
  assert.equal(g.grind.saws.length, 2);
  assert.deepEqual(
    g.grind.saws.map((s) => s.dir),
    [-1, 1],
  );
  for (const saw of g.grind.saws) {
    near(saw.damage, 36);
    assert(saw.hits.has(123));
  }
  const x = g.grind.saws[0].pos.x;
  g.grind.update(0.1);
  assert(g.grind.saws[0].pos.x < x && g.grind.saws[1].pos.x > x);
  for (let i = 0; i < 20; i++) g.grind.impact(s, b, { x: 0, y: -1 });
  assert.equal(g.grind.saws.length, GRIND.limit);
});

test('Mass Driver Recall can hit once per leg, while repeated banks cannot grind the same boss', () => {
  const g = fixture(['mass-driver', 'recall', 'homecoming']);
  const e = target(g, 650, 300, 'loader');
  e.state = 'windup';
  e.aim = { x: -1, y: 0 };
  const s = round(g, { pos: { x: 560, y: 300 }, vel: { x: 35, y: 0 } });
  advance(g, 4);
  const first = e.maxHp - e.hp;
  assert(first > 0);
  s.pos = { x: 560, y: 300 };
  s.vel = { x: 35, y: 0 };
  advance(g, 2);
  near(e.maxHp - e.hp, first);
  g.ballistics.turn(s);
  Body.setPosition(g.player, { x: 1200, y: 300 });
  s.pos = { x: 560, y: 300 };
  s.vel = { x: 35, y: 0 };
  advance(g, 4);
  const second = e.maxHp - e.hp;
  assert(second > first);
  s.pos = { x: 560, y: 300 };
  s.vel = { x: 35, y: 0 };
  advance(g, 2);
  near(e.maxHp - e.hp, second);
});

test('Skid Plate rolls along the real floor, banks off a wall and loses support without extending its life', () => {
  const g = fixture(['mass-driver', 'skid-plate']);
  g.engine.gravity.y = 1;
  const floor = wall(g, 700, 520, 650, 20);
  wall(g, 970, 440, 10, 150);
  const s = round(g, { pos: { x: 430, y: 495 }, vel: { x: 18, y: 3 } });
  advance(g, 4);
  assert.equal(s.massDriver!.rolling?.bodyId, floor.id);
  const y = s.pos.y;
  advance(g, 8);
  near(s.pos.y, y);
  assert(s.pos.x > 600);
  advance(g, 16);
  assert(s.pos.x < 970);
  assert(s.vel.x < 0);
  assert(s.banks >= 2);
  advance(g, 200);
  assert(s.life <= 0);
  const other = fixture(['mass-driver', 'skid-plate']);
  const ledge = wall(other, 500, 520, 350, 20);
  const ball = round(other, { pos: { x: 430, y: 495 }, vel: { x: 18, y: 3 } });
  advance(other, 4);
  assert(ball.massDriver!.rolling);
  other.terrain = other.terrain.filter((b) => b !== ledge);
  Composite.remove(other.engine.world, ledge);
  advance(other);
  assert(!ball.massDriver!.rolling);
});

test('Short Circuit uses three actual payloads against the source without creating another arc', () => {
  const g = fixture(['arc-coil', 'short-circuit']);
  const e = target(g),
    neighbor = target(g, 680);
  const s = round(g, { damage: 10 });
  for (let i = 0; i < 2; i++) g.arcs.hit(e, s);
  near(e.hp, e.maxHp);
  g.arcs.hit(e, s);
  near(e.maxHp - e.hp, 12);
  near(neighbor.hp, neighbor.maxHp);
  assert.equal(g.arcs.charges.size, 0);
  s.fragment = true;
  for (let i = 0; i < 6; i++) g.arcs.hit(e, s);
  near(e.maxHp - e.hp, 12);
});

test('Relay Gate spends its bank and speed bonus on the first real friendly portal transit only', () => {
  const g = fixture(['fold', 'relay-gate']);
  assert(g.portals.place({ x: 700, y: 740 }));
  assert(g.portals.place({ x: 1400, y: 740 }));
  const s = round(g, { pos: { x: 700, y: 680 }, vel: { x: 0, y: 18 }, bounces: 0 });
  advance(g, 5);
  assert(s.pos.x > 1300);
  assert(s.relay);
  assert.equal(s.bounces, 1);
  near(Math.hypot(s.vel.x, s.vel.y), 18 * 1.15);
  s.pos = { x: 700, y: 680 };
  s.vel = { x: 0, y: 18 };
  advance(g, 5);
  assert.equal(s.bounces, 1);
  near(Math.hypot(s.vel.x, s.vel.y), 18);
  const hostile = round(g, {
    friendly: false,
    pos: { x: 700, y: 680 },
    vel: { x: 0, y: 18 },
    bounces: 0,
  });
  advance(g, 5);
  assert(hostile.pos.x > 1300);
  assert(!hostile.relay);
  assert.equal(hostile.bounces, 0);
  near(Math.hypot(hostile.vel.x, hostile.vel.y), 18);
});

test('Relay beams gain real range and share one portal allowance across traced rays', () => {
  const g = fixture(['fold', 'relay-gate', 'cutting-torch']);
  g.portals.place({ x: 700, y: 740 });
  g.portals.place({ x: 1400, y: 740 });
  Body.setPosition(g.player, { x: 700, y: 500 });
  g.aim = { x: 700, y: 900 };
  const allowance = { used: false };
  const first = traceTorch(g, false, 0, TORCH.segments, allowance);
  const second = traceTorch(g, false, 0, TORCH.segments, allowance);
  const length = (segments: typeof first) =>
    segments.reduce((sum, s) => sum + Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y), 0);
  assert(allowance.used);
  assert(length(first) > length(second));
  assert(first.every((s) => Math.abs(s.a.x - s.b.x) < 1e-5));
});

test('Triphammer rebounds the player and requires both separation and another launch', () => {
  const g = fixture(['ramjet', 'triphammer']);
  const e = target(g, 235, 300, 'runner');
  Body.setStatic(e.body, false);
  g.shotCount = 1;
  Body.setVelocity(g.player, { x: 15, y: 0 });
  g.salvage.launch({ x: -1, y: 0 }, 6);
  assert(g.salvage.ram(e, { x: 15, y: 0 }));
  assert(g.player.velocity.x <= -11 && g.player.velocity.y <= -4);
  const hp = e.hp;
  g.time += 0.8;
  Body.setVelocity(g.player, { x: 15, y: 0 });
  g.shotCount++;
  g.salvage.launch({ x: -1, y: 0 }, 6);
  assert(!g.salvage.ramReady);
  near(e.hp, hp);
  Body.setPosition(g.player, { x: 100, y: 300 });
  g.salvage.launch({ x: -1, y: 0 }, 6);
  assert(g.salvage.ramReady);
});

test('Shaped Charge reaches forward, excludes side and rear targets, and retains safe blast surfing', () => {
  const g = fixture(['shellshock', 'shaped-charge', 'blast-surf']);
  const front = target(g, 620, 500),
    side = target(g, 500, 600),
    rear = target(g, 430, 500);
  Body.setPosition(g.player, { x: 430, y: 500 });
  g.demolition.detonate({
    pos: { x: 500, y: 500 },
    direction: { x: 1, y: 0 },
    damage: 100,
    launch: 10,
    radius: 96,
    kind: 'shell',
  });
  assert(front.hp < front.maxHp);
  near(side.hp, side.maxHp);
  near(rear.hp, rear.maxHp);
  assert(g.player.velocity.x < 0);
  near(g.hp, 100);
  assert(g.demolition.effects[0].shaped);
  near(g.demolition.effects[0].radius, 144);
  const hp = front.hp;
  wall(g, 560, 500, 10, 100);
  g.demolition.detonate({
    pos: { x: 500, y: 500 },
    direction: { x: 1, y: 0 },
    damage: 100,
    launch: 0,
    radius: 96,
    kind: 'shell',
  });
  near(front.hp, hp);
});

test('attached shaped charges preserve their incoming direction through host rotation', () => {
  const g = fixture(['shellshock', 'shaped-charge', 'fuse']);
  const host = g.props.spawn('crate', 700, 500);
  const s = round(g, {
    pos: { x: 673, y: 500 },
    vel: { x: 20, y: 0 },
    impactNormal: { x: -1, y: 0 },
  });
  g.demolition.impact(s, host.body);
  assert.equal(g.ballistics.shells.length, 1);
  Body.setAngle(host.body, Math.PI / 2);
  g.ballistics.positionShells();
  const charge = g.ballistics.shells[0];
  near(charge.direction!.x, 0);
  near(charge.direction!.y, 1);
  near(charge.normal!.y, -1);
  g.time = 0.75;
  g.ballistics.update();
  assert(
    g.demolition.effects.some(
      (effect) => effect.shaped && Math.abs(effect.direction!.y - 1) < 1e-6,
    ),
  );
});

test('Cluster Shell adds one finite damage bonus, physical children and a shared Aftershock budget', () => {
  const g = fixture(['shellshock', 'cluster-shell', 'aftershock', 'shockfront']);
  g.demolition.detonate({
    pos: { x: 600, y: 400 },
    normal: { x: 0, y: -1 },
    damage: 100,
    launch: 10,
    radius: 96,
    kind: 'shell',
  });
  assert.equal(g.demolition.bomblets.length, 3);
  near(
    g.demolition.effects[0].damage + g.demolition.bomblets.reduce((sum, b) => sum + b.damage, 0),
    125,
  );
  assert(g.demolition.bomblets.every((b) => b.vel.y < 0));
  const y = g.demolition.bomblets[0].pos.y;
  advance(g, 3);
  assert(g.demolition.bomblets[0].pos.y < y);
  advance(g, 15);
  assert.equal(g.demolition.bomblets.length, 0);
  near(
    g.demolition.pending.reduce((sum, b) => sum + b.damage, 0),
    50,
  );
  advance(g, 50);
  assert.equal(g.demolition.bomblets.length, 0);
  assert.equal(g.demolition.pending.length, 0);
});

test('Cluster children stay on the exposed side of thin cover and density remains bounded', () => {
  const g = fixture(['shellshock', 'cluster-shell']);
  wall(g, 600, 400, 4, 400);
  const hidden = target(g, 640, 400);
  const s = round(g, { pos: { x: 550, y: 400 }, vel: { x: 20, y: 0 } });
  advance(g, 3);
  assert(g.demolition.bomblets.length > 0);
  assert(g.demolition.bomblets.every((b) => b.pos.x < 598 && b.vel.x < 0));
  advance(g, 40);
  near(hidden.hp, hidden.maxHp);
  for (let i = 0; i < 80; i++)
    g.demolition.detonate({
      pos: { x: 900, y: 400 },
      damage: 100,
      launch: 0,
      radius: 96,
      kind: 'shell',
    });
  assert.equal(g.demolition.bomblets.length, CLUSTER_LIMIT);
  assert(g.demolition.effects.length <= 24);
  g.setMode('dead');
  assert.equal(g.demolition.bomblets.length, 0);
});
