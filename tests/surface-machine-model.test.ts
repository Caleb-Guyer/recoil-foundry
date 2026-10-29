import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import type { Level } from '../src/levels.ts';
import { ANGLER, findAnglerPlan, beginAnglerAttack, updateAngler } from '../src/angler.ts';
import { CRAWLER, beginCrawlerAttack, updateWallcrawler } from '../src/wallcrawler.ts';
import { machineBodySnapshot, machinePose, isMachineKind } from '../src/machine-breakdown-pose.ts';
import { surfaceMachinePose, isSurfaceMachineKind } from '../src/surface-machine-pose.ts';
import { MACHINE_MAX_HITS, MACHINE_MAX_WRECKS } from '../src/machine-breakdown.ts';
const { Bodies, Body, Composite } = Matter;
const DT = 1 / 60;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1400, y: 650 },
};
const room: Level = {
  id: 'surface-native-model',
  name: 'Surface machine native floor',
  area: 'furnace',
  boss: false,
  mirrored: false,
  solids: [],
  spawns: [{ kind: 'shooter', x: 1850, y: 724 }],
  route: [],
  setpiece: { rosters: [[0]], weak: [], props: [] },
  hazards: [],
  vents: [],
  fans: [],
  coolant: [],
  counterweights: [],
};
function base() {
  const g = new Game(),
    cp = {
      version: 6 as const,
      seed: 'RF-C108-SURFACEMODEL',
      stage: 8,
      hp: 100,
      mods: [],
      kills: 0,
      elapsed: 0,
    };
  g.start(cp.seed, cp, null, { ...cp, rematchRoom: structuredClone(room) });
  g.waves.clear();
  for (const guard of g.enemies) {
    guard.spawn = 0;
    guard.timer = 1000;
  }
  return g;
}
function wall(g: Game, x: number, y: number, w: number, h: number) {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  g.destruction.register(b, { x: x - w / 2, y: y - h / 2, w, h });
  return b;
}
function anglerFixture() {
  const g = base();
  g.engine.gravity.y = 0;
  Body.setStatic(g.player, true);
  Body.setPosition(g.player, { x: 1000, y: 600 });
  const host = wall(g, 700, 350, 700, 22);
  wall(g, 700, 655, 100, 170);
  const e = g.spawnEnemy('angler', 400, 600)!;
  e.spawn = 0;
  e.timer = 0;
  g.machineBreakdown.update();
  return { g, e, host };
}
function crawlerFixture(face = 'top') {
  const g = base(),
    host = wall(g, 700, 540, 260, 60);
  Body.setStatic(g.player, true);
  Body.setPosition(g.player, { x: 1200, y: 650 });
  const pos =
    face === 'top'
      ? { x: 700, y: 493 }
      : face === 'left'
        ? { x: 553, y: 540 }
        : face === 'right'
          ? { x: 847, y: 540 }
          : { x: 700, y: 587 };
  const e = g.spawnEnemy('wallcrawler', pos.x, pos.y)!;
  e.spawn = 0;
  e.timer = 100;
  assert.equal(e.crawler!.support, host);
  g.machineBreakdown.update();
  return { g, e, host };
}
function snapshot(g: Game, e: Enemy) {
  return machineBodySnapshot(e, g.time, g)!;
}
function fireAngler(g: Game, e: Enemy) {
  assert(beginAnglerAttack(g, e));
  const plan = e.angler!.plan!;
  e.timer = 0;
  updateAngler(g, e, DT);
  g.machineBreakdown.update();
  return plan;
}
function fireCrawler(g: Game, e: Enemy) {
  e.timer = 0;
  updateWallcrawler(g, e, DT);
  g.machineBreakdown.update();
}
function step(g: Game, n = 1) {
  for (let i = 0; i < n; i++) g.tick(DT, idle);
}
function fill(g: Game, count: number) {
  for (let n = 0; n < count; n++)
    assert(
      g.addShot({
        pos: { x: 50, y: 100 },
        vel: { x: 1, y: 0 },
        damage: 1,
        life: 4,
        friendly: false,
        radius: 2,
        bounces: 0,
        pierce: 0,
        fragment: false,
        split: false,
      }),
    );
}
function plain(value: unknown) {
  if (!value || typeof value !== 'object') return;
  assert(
    Object.getPrototypeOf(value) === Object.prototype || Array.isArray(value),
    'detached plain data',
  );
  for (const v of Object.values(value)) plain(v);
}
function finite(value: unknown) {
  if (typeof value === 'number') assert(Number.isFinite(value));
  else if (value && typeof value === 'object') for (const v of Object.values(value)) finite(v);
}
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test('surface eligibility preserves all nineteen previous machine families and keeps signal units outside the surface family', () => {
  for (const kind of [
    'runner',
    'shooter',
    'flyer',
    'charger',
    'hopper',
    'sniper',
    'shutter',
    'strider',
    'mortar',
    'repairer',
    'relay',
    'fabricator',
    'sentry',
    'scrapper',
    'harpooner',
    'sapper',
    'borer',
    'sifter',
    'skimmer',
  ] as const) {
    const g = base();
    const e = g.spawnEnemy(kind, 500, 400)!;
    e.spawn = 0;
    const s = snapshot(g, e);
    assert.equal(s.surfaceMachine, undefined);
    assert.equal(machinePose(s).kind, kind);
    plain(s);
  }
  for (const { g: world, e } of [anglerFixture(), crawlerFixture()]) {
    assert(isMachineKind(e.kind));
    const s = snapshot(world, e);
    assert(s.surfaceMachine);
    plain(s);
    finite(surfaceMachinePose(s));
  }
  for (const kind of ['caller', 'switchman']) assert(!isSurfaceMachineKind(kind));
  for (const kind of ['sorter', 'condenser', 'boss']) assert(!isMachineKind(kind));
});

test('Angler copies the real bank plan and records only the admitted shot at its exact locked origin and tip', () => {
  const { g, e, host } = anglerFixture();
  const plan = findAnglerPlan(g, e)!;
  assert(plan);
  assert.equal(plan.body, host);
  assert(beginAnglerAttack(g, e, plan));
  let s = snapshot(g, e);
  assert(s.surfaceMachine!.angler!.plan!.valid);
  assert.equal(surfaceMachinePose(s).mode, 'tracking');
  assert.deepEqual(surfaceMachinePose(s).barrel.origin, {
    x: plan.start.x - e.body.position.x,
    y: plan.start.y - e.body.position.y,
  });
  e.timer = ANGLER.lock;
  const aim = { ...e.aim };
  Body.setPosition(g.player, { x: 950, y: 690 });
  updateAngler(g, e, DT);
  assert.deepEqual(e.aim, aim);
  assert.equal(surfaceMachinePose(snapshot(g, e)).mode, 'locked');
  g.time = 0.7;
  e.timer = 0;
  updateAngler(g, e, DT);
  g.machineBreakdown.update();
  s = snapshot(g, e);
  const round = g.shots[0],
    d = s.surfaceMachine!.discharges[0];
  assert(round.angler);
  assert.equal(round.angler.plan, plan);
  assert.equal(e.attacks, 1);
  assert.equal(e.angler!.plan, undefined);
  assert.deepEqual(d.origin, plan.origin);
  assert.deepEqual(d.muzzle, plan.start);
  near(d.angle, Math.atan2(round.vel.y, round.vel.x));
  const p = surfaceMachinePose(s);
  assert(p.recoil > 0.9);
  assert.deepEqual(p.barrel.origin, {
    x: round.pos.x - e.body.position.x,
    y: round.pos.y - e.body.position.y,
  });
  const saved = structuredClone(s),
    observed = g.machineBreakdown.getSurfaceMachine(e)!;
  observed.discharges[0].muzzle.x = -999;
  observed.discharges[0].origin.y = -999;
  plan.start.x += 5;
  plan.bodyPos.x += 10;
  round.pos.y += 3;
  assert.deepEqual(s, saved);
  assert.notDeepEqual(observed, g.machineBreakdown.getSurfaceMachine(e));
  plain(s);
});

test('Angler full-cap rejection and stale or obstructed bank cancellation never invent a discharge', () => {
  const full = anglerFixture();
  fill(full.g, 180);
  fireAngler(full.g, full.e);
  assert.equal(full.e.attacks, 1);
  assert.equal(full.g.shots.length, 180);
  assert.deepEqual(snapshot(full.g, full.e).surfaceMachine!.discharges, []);
  assert.equal(surfaceMachinePose(snapshot(full.g, full.e)).recoil, 0);
  for (const action of ['move', 'rotate', 'destroy', 'muzzle']) {
    const { g, e, host } = anglerFixture();
    assert(beginAnglerAttack(g, e));
    const p = e.angler!.plan!;
    if (action === 'move') Body.translate(e.body, { x: 20, y: 0 });
    if (action === 'rotate') Body.setAngle(host, 0.01);
    if (action === 'destroy') g.destruction.hitBody(host, 1000, { x: 0, y: 0 });
    if (action === 'muzzle')
      wall(g, (p.origin.x + p.start.x) / 2, (p.origin.y + p.start.y) / 2, 8, 8);
    e.timer = 0;
    updateAngler(g, e, DT);
    g.machineBreakdown.update();
    assert.equal(g.shots.length, 0, action);
    assert.equal(e.attacks, 0, action);
    assert.equal(e.angler!.exposed, ANGLER.exposed, action);
    const s = snapshot(g, e),
      pose = surfaceMachinePose(s);
    assert.equal(pose.mode, 'exposed');
    assert.equal(pose.recoil, 0);
    assert.deepEqual(s.surfaceMachine!.discharges, []);
    assert.equal(s.surfaceMachine!.interruptedAt, g.time);
    const hp = e.hp;
    g.hitEnemy(e, 10, { x: 300, y: 600 }, false);
    assert.equal(hp - e.hp, 15);
    assert(g.machineBreakdown.getHits(e.id)[0].contact);
    const leaves = pose.shutters;
    e.angler!.exposed = 0.01;
    assert.equal(surfaceMachinePose(snapshot(g, e)).exposure, 1);
    assert.deepEqual(
      surfaceMachinePose(snapshot(g, e)).shutters,
      leaves,
      'actual open interval stays fully open',
    );
    e.angler!.exposed = 0;
    assert(surfaceMachinePose(snapshot(g, e)).shutters.every((l) => l.open === 0));
  }
});

test('Crawler mounts, actual feet and captured support faces match all four native attached normals', () => {
  for (const face of ['top', 'left', 'right', 'bottom']) {
    const { g, e, host } = crawlerFixture(face),
      s = snapshot(g, e),
      h = s.surfaceMachine!.crawler!,
      p = surfaceMachinePose(s);
    assert(h.support!.available);
    assert.equal(h.support!.id, host.id);
    assert.equal(p.grip, 1);
    assert.deepEqual(p.normal, e.crawler!.normal);
    near(Math.sin(p.angle), p.normal.x);
    near(Math.cos(p.angle), -p.normal.y);
    assert.equal(p.legs.length, 4);
    assert(p.pads.every((f) => f.planted));
    for (const pad of p.pads) {
      const x = s.position.x + pad.point.x * s.scale,
        y = s.position.y + pad.point.y * s.scale;
      assert(x >= host.bounds.min.x - 1e-7 && x <= host.bounds.max.x + 1e-7);
      assert(y >= host.bounds.min.y - 1e-7 && y <= host.bounds.max.y + 1e-7);
      const c = h.contact!;
      near((x - c.a.x) * p.normal.x + (y - c.a.y) * p.normal.y, 0);
    }
    const frozen = structuredClone(s);
    Body.translate(host, { x: 5, y: 4 });
    e.crawler!.normal.x = 123;
    assert.deepEqual(s, frozen);
    plain(s);
  }
});

test('Crawler records immediate individual accepted shots and their exact three committed native muzzles before the final attack counter', () => {
  const { g, e } = crawlerFixture('bottom');
  beginCrawlerAttack(g, e);
  const angles = [...e.crawler!.angles],
    origin = { ...e.crawler!.origin };
  e.timer = CRAWLER.lock;
  Body.setPosition(g.player, { x: 1400, y: 300 });
  updateWallcrawler(g, e, DT);
  assert.deepEqual(e.crawler!.angles, angles);
  for (let n = 0; n < 3; n++) {
    g.time = 0.5 + n * 0.13;
    fireCrawler(g, e);
    const s = snapshot(g, e),
      events = s.surfaceMachine!.discharges,
      d = events.at(-1)!;
    assert.equal(events.length, n + 1);
    assert.equal(d.index, n);
    assert.equal(d.at, g.time);
    assert.equal(e.attacks, Number(n === 2));
    assert.equal(e.crawler!.fired, n + 1);
    assert.deepEqual(d.origin, origin);
    assert.deepEqual(d.muzzle, g.shots[n].pos);
    near(d.angle, angles[n]);
    near(Math.atan2(g.shots[n].vel.y, g.shots[n].vel.x), angles[n]);
    assert(surfaceMachinePose(s).recoil > 0.9);
    assert.deepEqual(surfaceMachinePose(s).barrel.origin, {
      x: g.shots[n].pos.x - e.body.position.x,
      y: g.shots[n].pos.y - e.body.position.y,
    });
  }
  assert.equal(e.state, 'recover');
  near(e.timer, 0.7);
});

test('Crawler partial and full projectile caps do not animate rejected followups and never fabricate a completed volley', () => {
  for (const cap of [179, 180]) {
    const { g, e } = crawlerFixture('bottom');
    fill(g, cap);
    beginCrawlerAttack(g, e);
    for (let n = 0; n < 3; n++) {
      g.time = 0.5 + n * 0.13;
      fireCrawler(g, e);
      const s = snapshot(g, e),
        p = surfaceMachinePose(s);
      assert.equal(g.shots.length, 180);
      assert.equal(s.surfaceMachine!.discharges.length, 180 - cap);
      if (cap === 180 || n > 0) assert.equal(p.recoil, 0, 'a rejected round cannot restart recoil');
      if (cap === 179) assert.equal(s.surfaceMachine!.discharges[0].index, 0);
    }
    assert.equal(e.attacks, 1, 'native completion still counts all three attempts');
  }
});

test('Crawler close-cover impacts are real discharges, and moved or broken supports cancel unfired rounds', () => {
  const close = crawlerFixture('bottom');
  Body.setPosition(close.g.player, { x: 1200, y: 587 });
  beginCrawlerAttack(close.g, close.e);
  wall(close.g, 718, 610, 3, 90);
  for (let n = 0; n < 3; n++) {
    close.g.time = n * 0.13;
    fireCrawler(close.g, close.e);
  }
  assert.equal(close.g.shots.length, 0);
  assert.equal(snapshot(close.g, close.e).surfaceMachine!.discharges.length, 3);
  for (const after of [false, true]) {
    const { g, e, host } = crawlerFixture('bottom');
    beginCrawlerAttack(g, e);
    if (after) fireCrawler(g, e);
    const existing = [...g.shots],
      previous = { ...e.body.position };
    g.destruction.hitBody(host, 1000, { x: 0, y: -10 });
    g.machineBreakdown.update();
    assert.equal(e.crawler!.support, undefined);
    assert.equal(e.crawler!.angles.length, 0);
    assert.equal(e.crawler!.vulnerable, CRAWLER.stun);
    assert.deepEqual(e.body.position, previous);
    const s = snapshot(g, e),
      p = surfaceMachinePose(s);
    assert.equal(p.mode, 'fallen');
    assert.equal(p.grip, 0);
    assert(p.pads.every((l) => !l.planted));
    assert.equal(s.surfaceMachine!.discharges.length, Number(after));
    const hp = e.hp;
    g.hitEnemy(e, 10, undefined, false);
    near(hp - e.hp, 15);
    step(g, 20);
    assert(e.body.position.y > previous.y + 20);
    assert.equal(e.attacks, 0);
    assert(g.shots.every((s) => existing.includes(s)));
  }
  const moved = crawlerFixture('bottom');
  beginCrawlerAttack(moved.g, moved.e);
  Body.translate(moved.e.body, { x: 30, y: 0 });
  updateWallcrawler(moved.g, moved.e, DT);
  moved.g.machineBreakdown.update();
  assert.equal(moved.e.crawler!.angles.length, 0);
  assert.deepEqual(snapshot(moved.g, moved.e).surfaceMachine!.discharges, []);
});

test('pre-lethal surface captures retain bank or mount orientation while independent native projectiles continue after owner death', () => {
  for (const fixture of [
    anglerFixture,
    () => crawlerFixture('left'),
    () => crawlerFixture('bottom'),
  ]) {
    const { g, e } = fixture();
    if (e.angler) fireAngler(g, e);
    else {
      if (e.crawler!.normal.x < 0) Body.setPosition(g.player, { x: 300, y: 540 });
      beginCrawlerAttack(g, e);
      fireCrawler(g, e);
    }
    const shots = [...g.shots],
      positions = shots.map((s) => ({ ...s.pos })),
      before = surfaceMachinePose(snapshot(g, e)),
      hp = e.hp,
      kills = g.kills;
    assert(shots.length);
    g.hitEnemy(e, 100000, { x: 300, y: 600 }, false);
    const w = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id)!;
    assert(w);
    assert.equal(w.visual.hp, hp);
    assert.equal(g.kills, kills + 1);
    assert.deepEqual(g.shots, shots);
    near(surfaceMachinePose(w.visual).angle, before.angle);
    assert.deepEqual(surfaceMachinePose(w.visual).normal, before.normal);
    assert.equal(w.visual.surfaceMachine!.discharges.length, 1);
    assert.equal(g.machineBreakdown.getSurfaceMachine(e), null);
    plain(w.visual);
    g.time += DT;
    g.updateShots(DT);
    assert(shots.some((s, i) => s.pos.x !== positions[i].x || s.pos.y !== positions[i].y));
  }
});

test('native Angler bank validity remains independent of the presentation observer after release and owner death', () => {
  const broken = anglerFixture();
  fireAngler(broken.g, broken.e);
  const s = broken.g.shots[0];
  Body.rotate(broken.host, 0.01);
  broken.g.updateShots(DT);
  assert(s.life <= 0);
  assert(broken.e.angler!.exposed > 0);
  const banked = anglerFixture();
  fireAngler(banked.g, banked.e);
  const round = banked.g.shots[0];
  for (let n = 0; n < 100 && !round.angler!.banked; n++) {
    banked.g.time += DT;
    banked.g.updateShots(DT);
  }
  assert(round.angler!.banked);
  banked.g.hitEnemy(banked.e, 100000, undefined, false);
  Body.rotate(banked.host, 0.1);
  banked.g.updateShots(DT);
  assert(round.life > 0);
});

test('native shield damage, allied identity, scaled projection and suppressed allied muzzle attempts stay factual', () => {
  const g = base(),
    shield = g.spawnEnemy('angler', 500, 400, 'shielded')!;
  shield.spawn = 0;
  shield.facing = 1;
  const hp = shield.hp;
  g.hitEnemy(shield, 10, { x: 700, y: 400 }, false);
  const hit = g.machineBreakdown.getHits(shield.id)[0];
  assert.equal(hit.blocked, true);
  assert.equal(hit.healthLost, 1);
  assert.equal(shield.hp, hp - 1);
  assert(hit.contact);
  const s = snapshot(g, shield);
  assert.equal(s.elite, 'shielded');
  const p = surfaceMachinePose({ ...s, scale: 0.6 });
  finite(p);
  near(p.barrel.origin.x, surfaceMachinePose(s).barrel.origin.x / 0.6);
  for (const kind of ['angler', 'wallcrawler'] as const) {
    const f = base(),
      ally = f.factions.spawn(kind, { x: 600, y: 400 })!;
    ally.spawn = 0;
    ally.hp = 3;
    const kills = f.kills;
    f.addShot({
      pos: { x: 550, y: 400 },
      vel: { x: 35, y: 0 },
      damage: 10,
      life: 1,
      friendly: false,
      radius: 3,
      bounces: 0,
      pierce: 0,
      fragment: false,
      split: false,
    });
    f.time += DT;
    f.updateShots(DT);
    const w = f.machineBreakdown.wrecks.find((w) => w.visual.id === ally.id)!;
    assert(w && w.visual.allied);
    assert.equal(f.kills, kills);
    assert(!f.factions.allies.includes(ally));
  }
  const f = crawlerFixture('bottom'),
    ally = f.g.factions.spawn('wallcrawler', f.e.body.position)!;
  ally.spawn = 0;
  ally.rebootUntil = f.g.time + 10;
  f.g.mods = ['ghost-shift'];
  beginCrawlerAttack(f.g, ally);
  for (let n = 0; n < 3; n++) fireCrawler(f.g, ally);
  assert.equal(ally.attacks, 1);
  assert.equal(f.g.shots.length, 0);
  assert.deepEqual(snapshot(f.g, ally).surfaceMachine!.discharges, []);
  assert.equal(surfaceMachinePose(snapshot(f.g, ally)).recoil, 0);
});

test('surface projection allocates no Matter IDs, mutates no native objects or random stream and freezes during Pause and Reduced', () => {
  for (const { g, e } of [anglerFixture(), crawlerFixture('bottom')]) {
    if (e.angler) fireAngler(g, e);
    else {
      beginCrawlerAttack(g, e);
      fireCrawler(g, e);
    }
    const before = {
      hp: e.hp,
      state: e.state,
      timer: e.timer,
      aim: { ...e.aim },
      body: {
        position: { ...e.body.position },
        velocity: { ...e.body.velocity },
        force: { ...e.body.force },
      },
      shots: g.shots.map((s) => ({ pos: { ...s.pos }, vel: { ...s.vel }, life: s.life })),
      save: g.checkpointSnapshot(),
      rng: g.rng,
    };
    const next = Matter.Common.nextId();
    for (let n = 0; n < 25; n++) {
      const s = snapshot(g, e);
      plain(s);
      finite(surfaceMachinePose(s));
      finite(surfaceMachinePose(s, true));
    }
    assert.equal(Matter.Common.nextId(), next + 1);
    assert.deepEqual(
      {
        hp: e.hp,
        state: e.state,
        timer: e.timer,
        aim: { ...e.aim },
        body: {
          position: { ...e.body.position },
          velocity: { ...e.body.velocity },
          force: { ...e.body.force },
        },
        shots: g.shots.map((s) => ({ pos: { ...s.pos }, vel: { ...s.vel }, life: s.life })),
        save: g.checkpointSnapshot(),
        rng: g.rng,
      },
      before,
    );
    const s = snapshot(g, e),
      serialized = JSON.stringify(s),
      reduced = surfaceMachinePose(s, true);
    assert.equal(reduced.recoil, 0);
    assert.deepEqual(reduced, surfaceMachinePose({ ...s, time: s.time + 0.5 }, true));
    g.setMode('paused');
    step(g, 30);
    assert.equal(JSON.stringify(snapshot(g, e)), serialized);
  }
});

test('surface observations and accepted histories are bounded, age out, detach and reset without scoring cleanup', () => {
  const { g, e } = crawlerFixture('bottom');
  beginCrawlerAttack(g, e);
  for (let n = 0; n < 6; n++) {
    e.crawler!.fired = n % 3;
    g.enemyShot(e, 0, 10, 10);
    g.time += 0.01;
  }
  assert.equal(g.machineBreakdown.getSurfaceMachine(e)!.discharges.length, 3);
  g.time += 0.7;
  g.machineBreakdown.update();
  assert.deepEqual(g.machineBreakdown.getSurfaceMachine(e)!.discharges, []);
  const model = g.machineBreakdown as unknown as { surfaceMachines: Map<number, unknown> };
  for (let n = 0; n < 110; n++) {
    const a = g.spawnEnemy('angler', 400, 600)!;
    a.spawn = 0;
    g.machineBreakdown.surfaceDischarge(a, 0, a.body.position, { x: 426, y: 600 });
    assert(model.surfaceMachines.size <= MACHINE_MAX_HITS);
    // A removed actor is pruned on the next update; bounds also hold before that update.
    g.enemies = g.enemies.filter((other) => other !== a);
    Composite.remove(g.engine.world, a.body);
  }
  g.machineBreakdown.update();
  assert.equal(model.surfaceMachines.size, 1);
  const kills = g.kills;
  g.hitEnemy(e, 100000, undefined, false, false, false, 'cleanup');
  g.machineBreakdown.update();
  assert(!model.surfaceMachines.has(e.id));
  assert(!g.machineBreakdown.wrecks.some((w) => w.visual.id === e.id));
  assert.equal(g.kills, kills);
  for (let n = 0; n < 20; n++) {
    const a = g.spawnEnemy('angler', 400, 600)!;
    a.spawn = 0;
    g.hitEnemy(a, 100000, undefined, false);
  }
  assert(g.machineBreakdown.wrecks.length <= MACHINE_MAX_WRECKS);
  g.loadRoom();
  assert.equal(model.surfaceMachines.size, 0);
  assert.equal(g.machineBreakdown.wrecks.length, 0);
});

test('native surface movement, banked rounds, audio, rewards, RNG and checkpoint outcomes match with presentation observation disabled', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  for (const factory of [anglerFixture, () => crawlerFixture('bottom')]) {
    const a = factory(),
      b = factory(),
      soundsA: string[] = [],
      soundsB: string[] = [],
      rewardsA: string[] = [],
      rewardsB: string[] = [];
    b.g.machineBreakdown.beforeHit = () => null;
    b.g.machineBreakdown.hit = () => {};
    b.g.machineBreakdown.defeated = () => {};
    b.g.machineBreakdown.update = () => {};
    b.g.machineBreakdown.surfaceDischarge = () => {};
    a.g.onSound = (k) => soundsA.push(k);
    b.g.onSound = (k) => soundsB.push(k);
    a.g.onEnemyDefeated = (k) => rewardsA.push(k);
    b.g.onEnemyDefeated = (k) => rewardsB.push(k);
    for (const { g, e } of [a, b]) {
      if (e.angler) fireAngler(g, e);
      else {
        beginCrawlerAttack(g, e);
        for (let n = 0; n < 3; n++) {
          g.time = n * 0.13;
          fireCrawler(g, e);
        }
      }
      for (let n = 0; n < 15; n++) surfaceMachinePose(snapshot(g, e), n % 2 === 0);
      g.hitEnemy(e, 100000, { x: 300, y: 600 }, false);
      step(g, 15);
    }
    const rounds = (g: Game) =>
      g.shots.map((s) => ({
        pos: s.pos,
        vel: s.vel,
        life: s.life,
        damage: s.damage,
        friendly: s.friendly,
        bounces: s.bounces,
        banks: s.banks,
        banked: s.angler?.banked,
        plan: s.angler
          ? {
              origin: s.angler.plan.origin,
              start: s.angler.plan.start,
              bounce: s.angler.plan.bounce,
              end: s.angler.plan.end,
            }
          : null,
      }));
    assert.deepEqual(a.g.checkpointSnapshot(), b.g.checkpointSnapshot());
    assert.deepEqual(a.g.player.position, b.g.player.position);
    assert.deepEqual(a.g.player.velocity, b.g.player.velocity);
    assert.deepEqual(rounds(a.g), rounds(b.g));
    assert.deepEqual(soundsA, soundsB);
    assert.deepEqual(rewardsA, rewardsB);
    assert.equal(a.g.rng(), b.g.rng());
    assert.equal(a.g.waves.pending, b.g.waves.pending);
    assert.equal(
      Composite.allBodies(a.g.engine.world).length,
      Composite.allBodies(b.g.engine.world).length,
    );
  }
});
