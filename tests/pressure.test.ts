import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { PRESSURE } from '../src/pressure.ts';
import { pressureTestFromUrl } from '../src/practice.ts';
import { getLevel } from '../src/levels.ts';
import { getGun, loadCheckpoint } from '../src/rules.ts';
import { getOvertimeLevel, overtimeSeed } from '../src/overtime.ts';
import { dailyForDate } from '../src/daily.ts';
import { traceTorch } from '../src/torch.ts';
import { pressurePilot } from './pressure-pilot.ts';
const { Body, Bodies, Composite, Query } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1500, y: 300 },
};
function step(g: Game, n = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, { ...idle, ...input });
}
function quiet(g: Game) {
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
}
function fixture(horizontal = false) {
  const g = new Game();
  g.start('vent-fixture');
  quiet(g);
  for (const p of [...g.props.items]) g.props.remove(p);
  g.hazards.clear();
  g.breaches.clear();
  g.pressure.clear();
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  Body.setPosition(g.player, { x: 100, y: 720 });
  g.clear = true;
  const v = g.pressure.spawn({
    x: 600,
    y: horizontal ? 500 : 738,
    dir: horizontal ? { x: 1, y: 0 } : { x: 0, y: -1 },
    valve: { x: 540, y: horizontal ? 550 : 714 },
    width: 90,
    length: 420,
    offset: 0,
  });
  v.phase = 'ready';
  v.timer = PRESSURE.ready;
  return { g, v };
}
function bullet(
  g: Game,
  pos: { x: number; y: number },
  vel: { x: number; y: number },
  friendly = true,
) {
  g.addShot({
    pos: { ...pos },
    vel: { ...vel },
    damage: 24,
    life: 3,
    friendly,
    radius: 2,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
  return g.shots.at(-1)!;
}
function preset(area = 'furnace', mirror = false, variant = 1, build = 'standard') {
  const save = pressureTestFromUrl(
    new URL(
      `https://test/?test=pressure&area=${area}&mirror=${Number(mirror)}&variant=${variant}&build=${build}`,
    ),
  );
  assert(save);
  return save;
}
function room(area = 'furnace', mirror = false, variant = 1) {
  const g = new Game();
  g.startTest(preset(area, mirror, variant));
  return g;
}

test('a real shot starts one full warning; repeated hits cannot skip warning or recharge', () => {
  const { g, v } = fixture();
  const sounds: string[] = [];
  g.onSound = (s) => sounds.push(s);
  bullet(g, { x: 450, y: 714 }, { x: 180, y: 0 });
  g.updateShots(1 / 60);
  assert.equal(v.phase, 'warn');
  assert.equal(v.timer, PRESSURE.warn);
  Body.setPosition(g.player, { x: 600, y: 720 });
  for (let i = 0; i < 58; i++) {
    g.pressure.trigger(v);
    step(g);
    assert.notEqual(v.phase, 'burst');
    assert(g.player.position.y > 715);
  }
  step(g, 3);
  assert.equal(v.phase, 'burst');
  assert(g.player.velocity.y < -10);
  step(g, 27);
  assert.equal(v.phase, 'recharge');
  const timer = v.timer;
  assert.equal(g.pressure.trigger(v), false);
  assert.equal(v.timer, timer);
  step(g, 250);
  assert.equal(v.phase, 'ready');
  assert.equal(sounds.filter((s) => s === 'pressure-warn').length, 1);
  assert.equal(sounds.filter((s) => s === 'pressure-burst').length, 1);
});

test('vertical launch outclimbs a normal jump and recoil still redirects flight', () => {
  const peaks: number[] = [];
  for (const vent of [false, true]) {
    const { g, v } = fixture();
    Body.setPosition(g.player, { x: 600, y: 720 });
    step(g, 3);
    if (vent) {
      g.pressure.trigger(v);
      step(g, 60);
    } else step(g, 1, { jump: true });
    let top = 740;
    for (let i = 0; i < 90; i++) {
      step(g);
      top = Math.min(top, g.player.position.y);
    }
    peaks.push(top);
    assert.equal(g.hp, 100);
  }
  assert(peaks[1] < peaks[0] - 70, JSON.stringify(peaks));
  const { g, v } = fixture();
  Body.setPosition(g.player, { x: 600, y: 720 });
  g.pressure.trigger(v);
  step(g, 63);
  const x = g.player.position.x;
  step(g, 10, { fire: true, jumpHeld: false, aim: { x: 0, y: g.player.position.y } });
  assert(g.player.position.x > x + 15);
  assert(g.player.velocity.y < 0);
});

test('one burst launches each body once and preserves faster existing momentum', () => {
  const { g, v } = fixture(true);
  Body.setPosition(g.player, { x: 630, y: 500 });
  v.phase = 'burst';
  v.timer = PRESSURE.burst;
  g.pressure.beforeStep(1 / 60);
  const speed = g.player.velocity.x;
  g.pressure.beforeStep(1 / 60);
  assert.equal(g.player.velocity.x, speed);
  assert(speed > 12 && speed <= 20);
  v.launched.clear();
  Body.setVelocity(g.player, { x: 22, y: -8 });
  g.pressure.beforeStep(1 / 60);
  assert.equal(g.player.velocity.x, 22);
  assert.equal(g.player.velocity.y, -8);
});

test('parallel jets stop at actual cover, including rotated crates and moving terrain', () => {
  const { g, v } = fixture(true);
  const wall = Bodies.rectangle(740, 500, 20, 120, { isStatic: true });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  Body.setPosition(g.player, { x: 810, y: 500 });
  v.phase = 'burst';
  v.timer = PRESSURE.burst;
  g.pressure.beforeStep(1 / 60);
  assert.equal(g.player.velocity.x, 0);
  assert.equal(g.pressure.reach(v), 130);
  Composite.remove(g.engine.world, wall);
  g.terrain = g.terrain.filter((b) => b !== wall);
  const p = g.props.spawn('cover', 735, 500);
  Body.setAngle(p.body, 0.35);
  assert(g.pressure.reach(v) < 150);
  g.pressure.beforeStep(1 / 60);
  assert.equal(g.player.velocity.x, 0);
  g.props.remove(p);
  g.pressure.beforeStep(1 / 60);
  assert(g.player.velocity.x > 12);
  const deck = g.counterweights.spawn({ x: 735, y: 500, w: 100 });
  Body.setAngle(deck.body, 0.3);
  assert(g.pressure.reach(v) < 150);
});

test('a launched crate physically hits a gunner while a target behind the crate is initially shielded', () => {
  const { g, v } = fixture(true);
  const p = g.props.spawn('crate', 650, 500);
  g.spawnEnemy('shooter', 715, 500);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.timer = 100;
  const hp = e.hp;
  v.phase = 'burst';
  v.timer = PRESSURE.burst;
  g.pressure.beforeStep(1 / 60);
  assert(p.body.velocity.x > 7);
  assert.equal(e.body.velocity.x, 0);
  // Prevent a later direct jet from moving the target before the crate reaches it.
  v.phase = 'recharge';
  v.timer = 100;
  step(g, 20);
  assert(e.hp < hp || !g.enemies.includes(e), `${e.hp}/${hp}`);
});

test('light enemies leave perches, heavy enemies resist, bosses and spawn warnings stay anchored', () => {
  const speeds: number[] = [];
  for (const kind of ['shooter', 'runner', 'charger', 'loader', 'crane'] as const) {
    const { g, v } = fixture(true);
    g.spawnEnemy(kind, 655, 500);
    const e = g.enemies.at(-1)!;
    e.spawn = 0;
    e.timer = 100;
    v.phase = 'burst';
    v.timer = PRESSURE.burst;
    g.pressure.beforeStep(1 / 60);
    speeds.push(e.body.velocity.x);
    if (kind === 'shooter' || kind === 'runner') {
      assert(!e.body.isStatic);
      assert(g.pressure.staggered(e));
      const x = e.body.position.x;
      step(g, 6);
      assert(e.body.position.x > x + 25);
    }
  }
  assert(speeds[0] > 8 && speeds[1] > 8 && speeds[2] < 4);
  assert.equal(speeds[3], 0);
  assert.equal(speeds[4], 0);
  const { g, v } = fixture(true);
  g.spawnEnemy('runner', 655, 500);
  v.phase = 'burst';
  v.timer = PRESSURE.burst;
  g.pressure.beforeStep(1 / 60);
  assert.equal(g.enemies[0].body.velocity.x, 0);
});

test('intervening enemies, terrain and crates intercept valve shots; hostile fire does not trigger valves', () => {
  for (const blocker of ['wall', 'crate', 'enemy', 'hostile']) {
    const { g, v } = fixture();
    if (blocker === 'wall') {
      const b = Bodies.rectangle(490, 700, 20, 80, { isStatic: true });
      g.terrain.push(b);
      Composite.add(g.engine.world, b);
    } else if (blocker === 'crate') g.props.spawn('crate', 490, 714);
    else if (blocker === 'enemy') {
      g.spawnEnemy('runner', 490, 714);
      g.enemies[0].spawn = 0;
    }
    bullet(g, { x: 440, y: 714 }, { x: 180, y: 0 }, blocker !== 'hostile');
    g.updateShots(1 / 60);
    assert.equal(v.phase, 'ready', blocker);
  }
});

test('close muzzle shots and Cutting Torch operate the same valve without reaching through it', () => {
  const close = fixture();
  Body.setPosition(close.g.player, { x: 522, y: 717 });
  step(close.g, 1, { fire: true, aim: close.v.valve });
  assert.equal(close.v.phase, 'warn');
  const { g, v } = fixture();
  g.mods = ['cutting-torch'];
  g.gun = getGun(g.mods);
  Body.setPosition(g.player, { x: 450, y: 717 });
  g.aim = { ...v.valve };
  g.spawnEnemy('shooter', 630, 714);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.timer = 100;
  const hp = e.hp;
  const trace = traceTorch(g);
  assert.equal(trace.at(-1)?.valve, v);
  assert(!trace.some((s) => s.enemy));
  step(g, 1, { fire: true, aim: v.valve });
  assert.equal(v.phase, 'warn');
  assert.equal(e.hp, hp);
});

test('portal-routed rounds and beams hit a valve only along their actual exit path', () => {
  for (const torch of [false, true]) {
    const { g, v } = fixture(true);
    g.mods = torch ? ['fold', 'cutting-torch'] : ['fold'];
    g.gun = getGun(g.mods);
    const wall = Bodies.rectangle(900, 400, 40, 600, { isStatic: true });
    g.terrain.push(wall);
    Composite.add(g.engine.world, wall);
    assert(g.portals.place({ x: 880, y: 300 }));
    assert(g.portals.place({ x: 540, y: 740 }));
    if (torch) {
      Body.setPosition(g.player, { x: 780, y: 303 });
      step(g, 1, { fire: true, aim: { x: 1000, y: 303 } });
      assert(g.torch.segments.length >= 2);
      assert.equal(g.torch.segments.at(-1)?.valve, v);
    } else {
      bullet(g, { x: 800, y: 300 }, { x: 100, y: 0 });
      for (let n = 0; n < 5; n++) g.updateShots(1 / 60);
    }
    assert.equal(v.phase, 'warn');
  }
});

test('a vent launch carries through real Fold travel without adding another jet impulse', () => {
  const { g, v } = fixture();
  g.mods = ['fold'];
  g.gun = getGun(g.mods);
  assert(g.portals.place({ x: 600, y: 0 }));
  assert(g.portals.place({ x: 2000, y: 400 }));
  v.y = 150;
  v.length = 150;
  Body.setPosition(g.player, { x: 600, y: 100 });
  v.phase = 'burst';
  v.timer = PRESSURE.burst;
  step(g, 12);
  assert(g.player.position.x > 1700, JSON.stringify(g.player.position));
  assert(g.player.velocity.x < -8);
  assert.equal(g.hp, 100);
});

test('fuel launches retain physical impacts and explosions; destroyed cover opens the jet next step', () => {
  const { g, v } = fixture(true);
  const fuel = g.props.spawn('canister', 650, 500);
  const wall = Bodies.rectangle(720, 500, 20, 150, { isStatic: true });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  const sounds: string[] = [];
  g.onSound = (s) => sounds.push(s);
  v.phase = 'burst';
  v.timer = PRESSURE.burst;
  step(g, 40);
  assert(!g.props.items.includes(fuel));
  assert.equal(sounds.filter((s) => s === 'explode').length, 1);
  const f = fixture(true),
    panel = f.g.props.spawn('cover', 725, 500);
  Body.setPosition(f.g.player, { x: 800, y: 500 });
  f.v.phase = 'burst';
  f.v.timer = PRESSURE.burst;
  f.g.pressure.beforeStep(1 / 60);
  assert.equal(f.g.player.velocity.x, 0);
  f.g.props.hit(panel, 200, { x: 15, y: 0 });
  f.g.pressure.beforeStep(1 / 60);
  assert(f.g.player.velocity.x > 12);
});

test('all roster variants keep grilles on permanent surfaces and valve wheels out of solid terrain', () => {
  for (const area of ['furnace', 'cooling'])
    for (const mirror of [false, true])
      for (const variant of [1, 2, 3]) {
        const g = room(area, mirror, variant);
        for (const v of g.pressure.items) {
          const wheel = Bodies.rectangle(
            v.valve.x,
            v.valve.y,
            PRESSURE.radius * 2,
            PRESSURE.radius * 2,
          );
          assert.equal(
            Query.collides(wheel, g.terrain).length,
            0,
            `${area} valve overlaps terrain`,
          );
          const hosts = Query.ray(g.terrain, v, { x: v.x - v.dir.x * 4, y: v.y - v.dir.y * 4 });
          assert(hosts.length > 0, 'Floating nozzle');
          assert(
            hosts.every(
              (h) => !g.destruction.pieces.some((p) => p.body === h.bodyA || p.body === h.bodyB),
            ),
          );
        }
      }
});

test('pause, hitstop and death freeze pressure; retries reconstruct a clean entrance', () => {
  const g = room(),
    v = g.pressure.items[0];
  v.phase = 'ready';
  g.pressure.trigger(v);
  const timer = v.timer;
  g.setMode('paused');
  step(g, 120);
  assert.equal(v.timer, timer);
  g.setMode('playing');
  g.hitStop = 0.5;
  step(g, 20);
  assert.equal(v.timer, timer);
  g.die();
  step(g, 120);
  assert.equal(v.timer, timer);
  g.startTest(preset());
  assert(g.pressure.items.every((v) => v.phase === 'recharge' && !v.launched.size));
  assert.equal(g.pressure.airborne.size, 0);
});

test('test links validate all options and keep saves, Daily results and practice victories isolated', () => {
  for (const area of ['furnace', 'cooling'])
    for (const mirror of [false, true])
      for (const variant of [1, 2, 3])
        for (const build of ['standard', 'torch', 'tripwire', 'portal']) {
          const save = preset(area, mirror, variant, build);
          assert.deepEqual(loadCheckpoint(save), save);
          const g = new Game(),
            writes: unknown[] = [];
          g.onCheckpoint = (s) => writes.push(s);
          g.onBossDefeated = (s) => writes.push(s);
          g.startTest(save);
          assert.equal(g.hp, 100);
          assert.equal(g.level.mirrored, mirror);
          assert.equal(g.level.area, area);
          assert.equal(g.pressure.items.length, 2);
          g.save();
          g.die();
          g.startTest(save);
          assert.deepEqual(writes, []);
        }
  for (const suffix of [
    '&area=x',
    '&area=furnace&area=cooling',
    '&mirror=2',
    '&mirror=1&mirror=1',
    '&variant=0',
    '&variant=01',
    '&variant=4',
    '&build=x',
    '&build=torch&build=portal',
    '&seed=x',
    '&daily=x',
    '&dv=54',
    '&route=high',
    '&mode=overtime',
    '&test=pressure',
  ])
    assert.equal(
      pressureTestFromUrl(new URL('https://test/?test=pressure' + suffix)),
      null,
      suffix,
    );
});

test('normal, Daily and Overtime rooms have repeatable mirrored machinery and preserve other room slots', () => {
  const normal = new Set<string>(),
    daily = new Set<string>(),
    overtime = new Set<string>();
  for (let i = 0; i < 140; i++) {
    const dailySeed = dailyForDate(
      new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10),
    )!.seed;
    for (const stage of [5, 9]) {
      for (const [seed, found] of [
        ['PV-' + i, normal],
        [dailySeed, daily],
      ] as const) {
        const l = getLevel(seed, stage);
        if (l.vents) {
          found.add(l.id + l.mirrored);
          assert.deepEqual(l, getLevel(seed, stage));
        }
      }
      const ot = getOvertimeLevel('PV-' + i, stage);
      if (ot.vents) {
        overtime.add(ot.id + ot.mirrored);
        assert.deepEqual(ot.vents, getLevel(overtimeSeed('PV-' + i), stage).vents);
      }
    }
    for (const stage of [0, 3, 4, 7, 8, 11, 12, 15, 16, 19])
      assert(!getLevel('PV-' + i, stage).vents);
  }
  assert.equal(normal.size, 4);
  assert.equal(daily.size, 4);
  assert.equal(overtime.size, 4);
});

for (const area of ['furnace', 'cooling'])
  for (const mirror of [false, true]) {
    test(`${area} mirror=${mirror}: ordinary jumps traverse both directions with vents disabled`, () => {
      for (const reverse of [false, true]) {
        const g = room(area, mirror);
        quiet(g);
        g.mods = [];
        g.gun = getGun([]);
        g.pressure.clear();
        for (const prop of [...g.props.items]) g.props.remove(prop);
        Body.setPosition(g.player, { x: reverse ? 1860 : 140, y: 680 });
        g.clear = true;
        let stuck = 0,
          oldX = g.player.position.x,
          reached = false;
        for (let n = 0; n < 3600 && g.mode === 'playing'; n++) {
          const p = g.player.position,
            dir = reverse ? -1 : 1;
          if ((reverse && p.x < 160) || (!reverse && p.x > 1830)) {
            reached = true;
            break;
          }
          stuck = Math.abs(p.x - oldX) < 0.4 ? stuck + 1 : 0;
          oldX = p.x;
          const blocked = Query.ray(g.solidBodies, p, { x: p.x + dir * 70, y: p.y }, 24).length > 0;
          step(g, 1, {
            left: reverse,
            right: !reverse,
            jump: g.grounded && (blocked || stuck > 12),
          });
        }
        assert(reached || g.mode === 'upgrade', `${reverse}: ${JSON.stringify(g.player.position)}`);
        assert.equal(g.hp, 100);
      }
    });
    test(`${area} mirror=${mirror}: an ordinary-input pilot can clear the real vent encounter`, () => {
      const g = room(area, mirror);
      const pilot = pressurePilot();
      for (let n = 0; n < 18000 && !g.clear && g.mode === 'playing'; n++) step(g, 1, pilot(g));
      assert(
        g.hp > 0 && g.clear,
        `${g.hp} HP, ${g.enemies.map((e) => e.kind + ':' + Math.round(e.hp))}, ${JSON.stringify(g.player.position)}`,
      );
    });
  }
