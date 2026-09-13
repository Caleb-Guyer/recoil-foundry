import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input, type Enemy } from '../src/game.ts';
import { TORCH, traceTorch } from '../src/torch.ts';
import {
  getGun,
  validBuild,
  availableMods,
  loadCheckpoint,
  rewardMods,
  seeded,
  distance,
} from '../src/rules.ts';
import { torchTestFromUrl } from '../src/practice.ts';
import { dailyForDate } from '../src/daily.ts';
import { dodgePilot } from './combat-pilot.ts';
const { Body, Bodies, Composite } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1300, y: 300 },
};
const near = (a: number, b: number, tolerance = 1e-6) =>
  assert(Math.abs(a - b) < tolerance, `${a} != ${b}`);
function fixture(mods = ['cutting-torch']) {
  const g = new Game();
  g.start('torch-fixture');
  g.waves.clear();
  g.hazards.clear();
  g.breaches.clear();
  g.destruction.clear();
  g.conveyors.clear();
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.mods = mods;
  g.gun = getGun(mods);
  g.aim = { ...idle.aim };
  Body.setPosition(g.player, { x: 200, y: 300 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.grounded = false;
  return g;
}
function target(g: Game, x = 600, y = 300, kind: Enemy['kind'] = 'shooter', shield = false) {
  g.spawnEnemy(kind, x, y, shield ? 'shielded' : undefined);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.timer = 100;
  e.hp = e.maxHp = 10000;
  Body.setStatic(e.body, true);
  return e;
}
function wall(g: Game, x: number, y: number, w: number, h: number) {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  return b;
}
function beam(g: Game, seconds: number, held = true, dt = 1 / 60) {
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    g.time += dt;
    g.ballistics.charge(dt, held);
    g.torch.beforeStep(dt, held);
    g.torch.afterStep(dt);
  }
}
function bullets(g: Game, positions: { x: number; y: number }[]) {
  for (const pos of positions)
    g.addShot({
      pos,
      vel: { x: -6, y: 0 },
      damage: 15,
      life: 3,
      friendly: false,
      radius: 5,
      bounces: 0,
      pierce: 0,
      fragment: false,
      split: false,
      source: { x: 1700, y: 300 },
    });
}

test('Torch is a Precision choice, Thermal requires it, and alternate conversions stay meaningful in either order', () => {
  assert(
    validBuild([
      'cutting-torch',
      'thermal-runaway',
      'deadeye',
      'rivet',
      'fracture',
      'scatter',
      'pierce',
      'fold',
    ]),
  );
  assert(!availableMods([]).some((m) => m.id === 'thermal-runaway'));
  for (const other of ['recall', 'vector', 'grindshot', 'rail-spike']) {
    const base = other === 'rail-spike' ? ['deadeye', 'capacitor'] : [];
    assert(!validBuild([...base, other, 'cutting-torch']));
    assert(!validBuild([...base, 'cutting-torch', other]));
    assert(validBuild([...base, other]));
  }
  assert(!validBuild(['crossfire', 'cutting-torch']));
  assert(!validBuild(['shellshock', 'cutting-torch']));
});
test('holding fire delivers steady damage rather than an instant volley, independent of sampling rate', () => {
  for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
    const g = fixture(),
      e = target(g);
    beam(g, 1, true, dt);
    near(10000 - e.hp, (24 / 0.22) * TORCH.output);
    assert.equal(g.shots.length, 0);
    assert.equal(g.torch.segments.length, 1);
    const hp = e.hp;
    beam(g, 0.25, false, dt);
    near(e.hp, hp);
    assert(!g.torch.active);
    assert.equal(g.torch.segments.length, 0);
  }
});
test('Scattershot and faster fire change the output of one beam without adding firing lanes', () => {
  for (const extras of [[], ['scatter'], ['rapid'], ['burst'], ['magnum', 'scatter', 'rapid']]) {
    const g = fixture(['cutting-torch', ...extras]),
      e = target(g);
    beam(g, 1);
    const period = g.gun.interval * (g.gun.burstCount === 3 ? 3.1 / 3 : 1);
    near(10000 - e.hp, ((g.gun.damage * g.gun.pellets) / period) * TORCH.output);
    assert.equal(g.torch.segments.length, 1);
    assert.equal(g.shots.length, 0);
  }
});
test('Thermal Runaway ramps only the first continuously touched enemy, caps, and resets on any lost contact', () => {
  const g = fixture(['cutting-torch', 'thermal-runaway', 'pierce']),
    a = target(g),
    b = target(g, 820);
  beam(g, 1.5);
  near(g.torch.heat, 1);
  near(10000 - a.hp, (24 / 0.22) * TORCH.output * 1.5 * 1.375);
  near(10000 - b.hp, (24 / 0.22) * TORCH.output * 1.5 * 0.8);
  const hp = a.hp;
  beam(g, 1);
  near(hp - a.hp, (24 / 0.22) * TORCH.output * 1.75);
  near(g.torch.heat, 1);
  g.aim = { x: 700, y: 50 };
  beam(g, 1 / 60);
  near(g.torch.heat, 0);
  assert.equal(g.torch.target, undefined);
  g.aim = { ...idle.aim };
  beam(g, 0.3);
  assert(g.torch.heat > 0);
  beam(g, 1 / 60, false);
  near(g.torch.heat, 0);
  beam(g, 0.3);
  Body.setPosition(a.body, { x: 600, y: 100 });
  beam(g, 1 / 60);
  assert.equal(g.torch.target, b.id);
  assert(g.torch.heat < 0.02);
});
test('solid and rotated cover block a beam; a cut opens the path only on the following step', () => {
  const g = fixture(),
    e = target(g),
    cover = wall(g, 400, 300, 12, 200);
  Body.setAngle(cover, 0.3);
  beam(g, 0.5);
  near(e.hp, 10000);
  assert.equal(g.torch.segments[0].body, cover);
  Body.setAngle(cover, 0);
  const piece = g.destruction.register(cover, { x: 394, y: 200, w: 12, h: 200 });
  piece.hp = 1;
  beam(g, 0.5);
  assert(!g.terrain.includes(cover));
  assert(e.hp < 10000);
  const h = fixture(),
    enemy = target(h),
    weak = wall(h, 400, 300, 12, 200);
  h.destruction.register(weak, { x: 394, y: 200, w: 12, h: 200 }).hp = 1;
  beam(h, 1 / 60);
  assert(!h.terrain.includes(weak));
  near(enemy.hp, 10000);
  beam(h, 1 / 60);
  assert(enemy.hp < 10000);
});
test('a muzzle pressed against a wall cannot start its beam on the far side', () => {
  const g = fixture(),
    e = target(g);
  wall(g, 220, 300, 10, 200);
  beam(g, 0.4);
  near(e.hp, 10000);
  assert(g.torch.segments[0].b.x < 220);
});
test('Bank shot follows real tilted faces and Banker boosts only the outgoing segment', () => {
  for (const tilt of [0, 0.2, -0.2]) {
    const g = fixture(['cutting-torch', 'ricochet', 'banker']);
    Body.setPosition(g.player, { x: 400, y: 600 });
    g.aim = { x: 700, y: 350 };
    const roof = wall(g, 700, 350, 700, 22);
    Body.setAngle(roof, tilt);
    const path = traceTorch(g);
    assert(path.length >= 2);
    const leg = path[1];
    const e = target(g, leg.a.x + leg.dir.x * 200, leg.a.y + leg.dir.y * 200);
    beam(g, 0.5);
    assert(g.torch.segments.some((s) => s.enemy === e));
    near(10000 - e.hp, (g.gun.damage / 0.22) * TORCH.output * 0.5 * 1.35);
  }
});
test('piercing stops at its target limit and shielded enemies stop the beam from the protected side', () => {
  const g = fixture(['cutting-torch', 'pierce']);
  const enemies = [500, 650, 800, 950].map((x) => target(g, x));
  beam(g, 0.5);
  assert(enemies.slice(0, 3).every((e) => e.hp < 10000));
  near(enemies[3].hp, 10000);
  const h = fixture(['cutting-torch', 'pierce', 'thermal-runaway']),
    shield = target(h, 500, 300, 'shooter', true),
    behind = target(h, 700);
  shield.facing = -1;
  beam(h, 0.5);
  near(10000 - shield.hp, (24 / 0.22) * TORCH.output * 0.5 * 0.1);
  near(behind.hp, 10000);
  near(h.torch.heat, 0);
});
test('boss armor and exposed recovery still apply to continuous damage', () => {
  for (const state of ['windup', 'recover'] as const) {
    const g = fixture(),
      e = target(g, 600, 300, 'loader');
    e.state = state;
    beam(g, 0.5);
    near(10000 - e.hp, (24 / 0.22) * TORCH.output * 0.5 * (state === 'recover' ? 1.25 : 0.4));
  }
});
test('portals preserve the beam direction and draw separate segments without bridging the map', () => {
  const g = fixture(['cutting-torch', 'fold']);
  wall(g, 600, 400, 40, 600);
  assert(g.portals.place({ x: 580, y: 300 }));
  assert(g.portals.place({ x: 1300, y: 740 }));
  const e = target(g, 1300, 480);
  beam(g, 0.5);
  assert(e.hp < 10000);
  assert(g.torch.segments.length >= 2);
  assert(g.torch.segments[0].b.x < 600);
  assert(g.torch.segments[1].a.x > 1200);
  assert(g.torch.segments[1].dir.y < -0.99);
});
test('a physical counterweight blocks the beam at its real tilted face and receives limited force', () => {
  const g = fixture();
  Body.setPosition(g.player, { x: 200, y: 400 });
  g.aim = { x: 1300, y: 400 };
  const beamBody = g.counterweights.spawn({ x: 600, y: 400, w: 350 }).body;
  Body.setAngle(beamBody, 0.2);
  const e = target(g, 950, 400);
  beam(g, 0.5);
  near(e.hp, 10000);
  assert.equal(g.torch.segments[0].body, beamBody);
  assert(Number.isFinite(beamBody.force.x));
});
test('loose crates absorb the beam and keep their normal bounded physical response', () => {
  const g = fixture(),
    e = target(g),
    p = g.props.spawn('crate', 400, 300);
  Body.setAngle(p.body, 0.4);
  beam(g, 0.25);
  near(e.hp, 10000);
  assert(p.hp < p.maxHp);
  assert(Math.abs(p.body.velocity.x) <= 18);
  assert(Math.abs(p.body.angularVelocity) <= 0.18);
});
test('continuous airborne recoil lifts the real player and horizontal thrust reverses when aim changes', () => {
  const g = fixture();
  target(g, 1600, 300);
  g.hp = 100;
  const y = g.player.position.y;
  for (let i = 0; i < 90; i++)
    g.tick(1 / 60, {
      ...idle,
      fire: true,
      aim: { x: g.player.position.x, y: g.player.position.y + 300 },
    });
  assert(g.player.position.y < y - 70, JSON.stringify(g.player.position));
  assert(g.player.velocity.y < -2 || g.player.position.y < 25);
  // Isolate horizontal thrust reversal from landing friction.
  g.engine.gravity.y = 0;
  Body.setPosition(g.player, { x: 900, y: 350 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  for (let i = 0; i < 35; i++)
    g.tick(1 / 60, { ...idle, fire: true, aim: { x: 1600, y: g.player.position.y } });
  assert(g.player.velocity.x < -5);
  for (let i = 0; i < 70; i++)
    g.tick(1 / 60, { ...idle, fire: true, aim: { x: 100, y: g.player.position.y } });
  assert(g.player.velocity.x > 5);
});
test('Capacitor and landing boosts expire at pulse boundaries and cannot be refreshed by trigger tapping', () => {
  const g = fixture(['cutting-torch', 'capacitor', 'landing']),
    e = target(g);
  beam(g, 1, false);
  assert.equal(g.ballistics.charges, 1);
  g.landingReady = true;
  beam(g, 1 / 60);
  assert.equal(g.ballistics.charges, 0);
  assert(!g.landingReady);
  const first = 10000 - e.hp;
  near(first, ((g.gun.damage / 0.22) * TORCH.output * 4) / 60);
  beam(g, 1 / 60, false);
  const hp = e.hp;
  beam(g, 1 / 60);
  near(hp - e.hp, ((g.gun.damage / 0.22) * TORCH.output) / 60);
});
test('on-hit arcs, cables and fragments use gun cadence rather than frame rate', () => {
  const g = fixture(['cutting-torch', 'arc-coil', 'tether', 'pierce', 'split']),
    a = target(g, 500),
    b = target(g, 650);
  Body.setStatic(b.body, false);
  beam(g, 0.2);
  assert(g.tethers.link);
  assert.equal(g.arcs.charges.get(a.id)?.hits, 1);
  assert.equal(g.shots.length, 3);
  beam(g, 0.3);
  assert(b.hp < 10000);
  assert(g.shots.length <= 9);
});
test('Countershot reflects at most one bullet per pulse and never reaches through blocking cover', () => {
  const g = fixture(['cutting-torch', 'countershot']);
  bullets(g, [
    { x: 400, y: 298 },
    { x: 450, y: 298 },
    { x: 500, y: 298 },
  ]);
  beam(g, 0.2);
  assert.equal(g.shots.filter((s) => s.friendly).length, 1);
  beam(g, 0.1);
  assert.equal(g.shots.filter((s) => s.friendly).length, 2);
  const h = fixture(['cutting-torch', 'countershot']);
  wall(h, 350, 300, 20, 100);
  bullets(h, [{ x: 500, y: 298 }]);
  beam(h, 0.5);
  assert(h.shots.every((s) => !s.friendly));
});
test('deadlock records beam pulses and misses; backfire has a rear beam without canceling thrust', () => {
  const g = fixture(['cutting-torch', 'deadeye', 'deadlock']);
  target(g);
  beam(g, 0.6);
  assert(g.evolutions.streak >= 2);
  g.aim = { x: 1000, y: 50 };
  beam(g, 0.7);
  assert.equal(g.evolutions.streak, 0);
  const h = fixture(['cutting-torch', 'backblast', 'backfire']);
  Body.setPosition(h.player, { x: 700, y: 300 });
  const front = target(h, 1100),
    rear = target(h, 300);
  beam(h, 0.3);
  assert(front.hp < 10000 && rear.hp < 10000);
  assert(h.player.velocity.x < 0);
  assert.equal(h.torch.rear.length, 1);
});
test('pause and hitstop freeze heat; release, death, room changes and retry remove the beam', () => {
  const g = fixture(['cutting-torch', 'thermal-runaway']);
  target(g);
  beam(g, 0.4);
  const heat = g.torch.heat;
  g.setMode('paused');
  g.tick(1, { ...idle, fire: true });
  near(g.torch.heat, heat);
  g.setMode('playing');
  g.hitStop = 0.1;
  g.tick(1 / 60, { ...idle, fire: true });
  near(g.torch.heat, heat);
  g.hitStop = 0;
  g.tick(1 / 60, idle);
  assert(!g.torch.active);
  beam(g, 0.3);
  g.setMode('dead');
  assert(!g.torch.active);
  near(g.torch.heat, 0);
  g.startTest(torchTestFromUrl(new URL('https://test/?test=torch'))!);
  assert(!g.torch.active);
  assert.equal(g.shots.length, 0);
});
test('all test presets are legal saved builds, deterministic Daily offers respect exclusions, and test progress stays isolated', () => {
  for (const build of ['base', 'evolved', 'bank', 'portal', 'precision']) {
    const save = torchTestFromUrl(new URL('https://test/?test=torch&build=' + build));
    assert(save);
    assert.deepEqual(loadCheckpoint(save), save);
    const g = new Game();
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.startTest(save);
    assert(g.testRun);
    assert.equal(writes, 0);
    assert(g.torch.equipped);
  }
  for (const extra of [
    '&daily=2026-09-13',
    '&build=bad',
    '&test=torch',
    '&build=base&build=bank',
    '&seed=xyz',
    '&area=rooftops',
  ])
    assert.equal(torchTestFromUrl(new URL('https://test/?test=torch' + extra)), null);
  let found = false;
  for (let n = 0; n < 120; n++) {
    const seed = dailyForDate(new Date(Date.UTC(2026, 8, n + 1)).toISOString().slice(0, 10))!.seed;
    const run = () => {
      const mods: string[] = [],
        rng = seeded(seed);
      for (let i = 0; i < 19; i++) {
        const offer = rewardMods(mods, 1, rng, { stage: i });
        if (offer[0]) mods.push(offer[0].id);
      }
      return mods;
    };
    const mods = run();
    assert.deepEqual(mods, run());
    assert(validBuild(mods));
    found ||= mods.includes('thermal-runaway');
  }
  assert(found);
});

test('Torch clears its real test encounter using ordinary movement, aiming, and fire', () => {
  const results = [];
  for (const build of ['base', 'evolved', 'precision']) {
    const g = new Game();
    g.startTest(torchTestFromUrl(new URL('https://test/?test=torch&build=' + build))!);
    let frames = 0,
      stuck = 0,
      lastX = g.player.position.x,
      advanceUntil = 0,
      climbX: number | undefined;
    for (; frames < 60 * 100 && !g.clear && g.mode === 'playing'; frames++) {
      const target = g.enemies
        .filter((e) => e.spawn <= 0)
        .sort(
          (a, b) =>
            distance(a.body.position, g.player.position) -
            distance(b.body.position, g.player.position),
        )[0];
      let input: Partial<Input> = target ? dodgePilot(g, target) : {};
      stuck = Math.abs(g.player.position.x - lastX) < 0.2 ? stuck + 1 : 0;
      lastX = g.player.position.x;
      if (
        target &&
        (stuck > 90 || g.time < advanceUntil || (g.time > 2 && Math.floor(g.time) % 4 < 2)) &&
        distance(g.lineEnd(g.player.position, target.body.position), target.body.position) > 1
      ) {
        if (stuck > 90) {
          advanceUntil = g.time + 0.65;
          stuck = 0;
        }
        const dx = target.body.position.x - g.player.position.x;
        const dir =
          Math.abs(dx) < 80 ? (g.player.position.x < g.worldWidth / 2 ? 1 : -1) : Math.sign(dx);
        input = { left: dir < 0, right: dir > 0, jump: g.grounded, fire: false };
        if (target.body.position.y < g.player.position.y - 200)
          input = {
            ...input,
            fire: true,
            aim: { x: g.player.position.x, y: g.player.position.y + 300 },
          };
      }
      if (target && target.body.position.y < g.player.position.y - 180) {
        const ceiling = g.terrain
          .filter(
            (b) =>
              b.bounds.max.y < g.player.position.y &&
              b.bounds.min.y > target.body.position.y &&
              g.player.position.x > b.bounds.min.x - 22 &&
              g.player.position.x < b.bounds.max.x + 22,
          )
          .sort((a, b) => b.bounds.max.y - a.bounds.max.y)[0];
        if (ceiling && climbX === undefined)
          climbX =
            g.player.position.x - ceiling.bounds.min.x < ceiling.bounds.max.x - g.player.position.x
              ? ceiling.bounds.min.x - 50
              : ceiling.bounds.max.x + 50;
        if (climbX !== undefined) {
          const dx = climbX - g.player.position.x;
          input = {
            left: dx < -10,
            right: dx > 10,
            jump: g.grounded,
            fire: !ceiling,
            aim: { x: g.player.position.x, y: g.player.position.y + 300 },
          };
        }
      } else climbX = undefined;
      g.tick(1 / 60, { ...idle, ...input });
    }

    results.push({
      build,
      clear: g.clear,
      hp: g.hp,
      frames,
      player: g.player.position,
      enemies: g.enemies.map((e) => ({ kind: e.kind, hp: e.hp, pos: e.body.position })),
    });
  }
  assert(
    results.every((r) => r.clear),
    JSON.stringify(results),
  );
});
