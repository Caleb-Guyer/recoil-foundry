import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { COUNTERWEIGHT as CW } from '../src/counterweight-layouts.ts';
import { counterweightTestFromUrl } from '../src/practice.ts';
import { getLevel } from '../src/levels.ts';
import { dailyForDate } from '../src/daily.ts';
import { getOvertimeLevel, overtimeSeed } from '../src/overtime.ts';
import { loadCheckpoint, getGun, distance } from '../src/rules.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { beginCrawlerAttack } from '../src/wallcrawler.ts';
import { dodgePilot } from './combat-pilot.ts';
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
function fixture() {
  const g = new Game();
  g.start('cw-fixture');
  quiet(g);
  for (const p of [...g.props.items]) g.props.remove(p);
  g.hazards.clear();
  g.counterweights.clear();
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  Body.setPosition(g.player, { x: 100, y: 720 });
  const p = g.counterweights.spawn({ x: 800, y: 560, w: 340 });
  g.clear = true;
  return { g, p };
}
function preset(area = 'cooling', mirror = false, variant = 1) {
  const s = counterweightTestFromUrl(
    new URL(
      `https://test/?test=counterweights&area=${area}&mirror=${Number(mirror)}&variant=${variant}`,
    ),
  );
  assert(s);
  return s;
}
function room(area = 'cooling', mirror = false, variant = 1) {
  const g = new Game();
  g.startTest(preset(area, mirror, variant));
  return g;
}
function bullet(
  g: Game,
  pos: { x: number; y: number },
  vel: { x: number; y: number },
  friendly = true,
  bounces = 0,
) {
  g.addShot({
    pos: { ...pos },
    vel: { ...vel },
    damage: 24,
    life: 3,
    friendly,
    radius: 2,
    bounces,
    pierce: 0,
    fragment: false,
    split: false,
  });
  return g.shots.at(-1)!;
}

test('a free axle stays centered, opposing weights tilt opposite ways, and heavier weight tips faster', () => {
  const free = fixture();
  step(free.g, 240);
  assert.equal(free.p.body.angle, 0);
  const angles = [];
  for (const kind of ['left', 'right', 'crate']) {
    const { g, p } = fixture();
    if (kind === 'crate') g.props.spawn('crate', 910, 527);
    else Body.setPosition(g.player, { x: kind === 'left' ? 690 : 910, y: 530 });
    step(g, 60);
    angles.push(p.body.angle);
    assert(distance(p.body.position, { x: 800, y: 560 }) < 0.1);
    assert(!p.body.isStatic);
  }
  assert(angles[0] < -0.1 && angles[1] > 0.1);
  assert(angles[2] > angles[1] + 0.05, JSON.stringify(angles));
});
test('hard landings give a stronger physical tip; removing the load lets the bearing settle', () => {
  const peaks = [];
  for (const height of [527, 400]) {
    const { g, p } = fixture();
    const crate = g.props.spawn('crate', 910, height);
    let peak = 0;
    for (let n = 0; n < 80; n++) {
      step(g);
      peak = Math.max(peak, Math.abs(p.body.angularVelocity));
    }
    peaks.push(peak);
    g.props.remove(crate);
    step(g, 720);
    assert(Math.abs(p.body.angle) < 0.015);
  }
  assert(peaks[1] > peaks[0] * 1.3, JSON.stringify(peaks));
});
test('normal gunfire pushes a real crate across the pivot and reverses the loaded side', () => {
  const { g, p } = fixture(),
    crate = g.props.spawn('crate', 720, 527);
  step(g, 28);
  assert(p.body.angle < -0.05);
  // Shoot horizontally through the crate, using the same collision and prop impulse path as play.
  for (let n = 0; n < 2; n++) {
    bullet(g, { x: crate.body.position.x - 35, y: crate.body.position.y }, { x: 30, y: 0 });
    g.updateShots(1 / 60);
    assert(crate.body.velocity.x > 4);
    step(g, 12);
  }
  let crossed = false,
    rose = false;
  for (let i = 0; i < 95; i++) {
    step(g);
    crossed ||= crate.body.position.x > 810;
    rose ||= p.body.angle > 0.02;
  }
  assert(crossed && rose, `${crate.body.position.x}, ${p.body.angle}`);
});
test('riders keep solid contact and can jump with the upward deck momentum', () => {
  const { g, p } = fixture();
  Body.setPosition(g.player, { x: 910, y: 530 });
  step(g, 30);
  assert(g.grounded);
  assert(g.player.position.y < 600);
  Body.setAngularVelocity(p.body, -0.01);
  // Actual moving-surface contact, followed by the ordinary Space input.
  step(g, 2);
  const supported = g.counterweights.supporting(g.player);
  assert(supported && supported.velocity.y < 0);
  step(g, 1, { jump: true });
  assert(g.player.velocity.y < -11.6);
  assert(!g.grounded);
  const y = g.player.position.y;
  step(g, 6, { fire: true, aim: { x: g.player.position.x, y: 900 } });
  assert(g.player.position.y < y - 50 && g.player.velocity.y < 0);
});
test('weight limits, real obstructions and fast impacts cannot detach or flip the beam', () => {
  const { g, p } = fixture();
  const stop = Bodies.rectangle(925, 660, 60, 150, { isStatic: true });
  g.terrain.push(stop);
  Composite.add(g.engine.world, stop);
  for (let i = 0; i < 4; i++) g.props.spawn('crate', 900, 480 - i * 45);
  for (let n = 0; n < 500; n++) {
    step(g);
    assert(Math.abs(p.body.angle) <= CW.angle + 0.003);
    assert(Math.abs(p.body.angularVelocity) <= CW.speed + 0.00001);
    assert(distance(p.body.position, { x: 800, y: 560 }) < 0.5);
    const overlaps = Query.collides(p.body, [stop]);
    assert(overlaps.every((c) => c.depth < 3));
  }
  assert(p.body.angle < 0.23, 'The physical stop blocks a loaded end');
  assert(Query.collides(p.body, [stop]).every((c) => c.depth < 0.3));
});
test('enemies and tall cover on a moving perch stay dynamic and contribute actual weight', () => {
  for (const kind of [
    'shooter',
    'sniper',
    'runner',
    'loader',
    'condenser',
    'interceptor',
  ] as const) {
    const { g, p } = fixture(),
      h = ENEMY_STATS[kind].h;
    g.spawnEnemy(kind, 890, 550 - h / 2);
    const e = g.enemies.at(-1)!;
    e.spawn = 20;
    assert(!e.body.isStatic, kind);
    step(g, 80);
    assert(p.body.angle > 0.08, kind);
    assert(e.body.position.y < 680, kind + ' fell through');
  }
  const { g, p } = fixture(),
    cover = g.props.spawn('cover', 895, 507);
  step(g, 70);
  assert(!cover.body.isStatic);
  assert(p.body.angle > 0.12);
  assert(Math.abs(cover.body.angle) > 0.02);
});
test('tilting the platform releases a Wallcrawler and cancels its locked volley', () => {
  const { g, p } = fixture();
  g.spawnEnemy('wallcrawler', 800, 533);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  assert.equal(e.crawler!.support, p.body);
  beginCrawlerAttack(g, e);
  g.props.spawn('crate', 910, 515);
  step(g, 20);
  assert(!e.crawler!.support && e.crawler!.vulnerable > 0);
  assert.equal(g.shots.filter((s) => !s.friendly).length, 0);
});
test('bullets and warnings use the tilted hull, leaving the empty corners of its bounds open', () => {
  const { g, p } = fixture();
  Body.setAngle(p.body, 0.3);
  const from = { x: 830, y: 535 },
    to = { x: 930, y: 535 };
  assert.deepEqual(g.lineEnd(from, to, 2), to);
  const open = bullet(g, from, { x: 100, y: 0 });
  g.updateShots(1 / 60);
  assert(open.life > 0 && open.pos.x > 925);
  const blocked = bullet(g, { x: 900, y: 480 }, { x: 0, y: 130 }, false);
  g.updateShots(1 / 60);
  assert(blocked.life <= 0);
  const ricochet = bullet(g, { x: 700, y: 450 }, { x: 0, y: 100 }, true, 1);
  g.updateShots(1 / 60);
  assert(ricochet.life > 0 && ricochet.vel.y < 0 && ricochet.vel.x > 40);
});
test('Fold rejects a moving host while Grindshot follows its real surface', () => {
  const { g, p } = fixture();
  g.mods = ['fold', 'grindshot', 'corner-cutter'];
  g.gun = getGun(g.mods);
  assert.equal(g.portals.candidate({ x: 800, y: 550 }), null);
  const sawShot = bullet(g, { x: 720, y: 450 }, { x: 20, y: 110 });
  g.updateShots(1 / 60);
  assert.equal(g.grind.saws.length, 1);
  assert.equal(g.grind.saws[0].body, p.body);
  Body.setAngle(p.body, 0.2);
  step(g, 3);
  assert(g.grind.saws.length > 0);
  assert(g.grind.saws.every((s) => s.body === p.body));
  assert(sawShot.life <= 0);
});
test('pauses and hitstop freeze the hinge; restart and room change clear old joints and restore the entrance', () => {
  const g = room();
  const old = g.counterweights.items[0],
    initial = JSON.stringify(g.level);
  step(g, 45);
  const angle = old.body.angle;
  g.setMode('paused');
  step(g, 120);
  assert.equal(old.body.angle, angle);
  g.setMode('playing');
  g.hitStop = 0.5;
  step(g, 20);
  assert.equal(old.body.angle, angle);
  g.startTest(preset());
  assert.equal(JSON.stringify(g.level), initial);
  assert.equal(g.counterweights.items[0].body.angle, 0);
  assert(!Composite.allBodies(g.engine.world).includes(old.body));
  assert(!Composite.allConstraints(g.engine.world).includes(old.joint));
  g.stage = 0;
  g.loadRoom();
  assert.equal(g.counterweights.items.length, 0);
  assert.equal(Composite.allConstraints(g.engine.world).filter((c) => c === old.joint).length, 0);
});

test('all twelve authored arrangements have clear initial hulls, real reserved props and legal isolated links', () => {
  for (const area of ['cooling', 'rooftops'])
    for (const mirror of [false, true])
      for (let v = 1; v <= 3; v++) {
        const save = preset(area, mirror, v),
          g = room(area, mirror, v);
        assert.deepEqual(loadCheckpoint(save), save);
        assert.equal(g.level.mirrored, mirror);
        assert.equal(g.counterweights.items.length, area === 'cooling' ? 1 : 2);
        assert.equal(g.level.spawns.filter((s) => s.elite).length, area === 'cooling' ? 1 : 2);
        const solids = g.solidBodies;
        for (const spawn of g.level.spawns) {
          const { w, h } = ENEMY_STATS[spawn.kind];
          const body = Bodies.rectangle(spawn.x, spawn.y, w - 0.2, h - 0.2);
          assert.equal(
            Query.collides(body, solids).length,
            0,
            `${area}/${mirror}/${v}/${spawn.kind} ${JSON.stringify(spawn)}`,
          );
        }
        for (const prop of g.props.items)
          assert.equal(
            Query.collides(
              prop.body,
              solids.filter((b) => b !== prop.body),
            ).length,
            0,
            `${area}/${mirror}/${v}/${prop.kind}`,
          );
        for (const hinge of g.counterweights.items)
          for (const angle of [-CW.angle, 0, CW.angle]) {
            Body.setAngle(hinge.body, angle);
            assert.equal(Query.collides(hinge.body, g.terrain).length, 0, area + ' blocked sweep');
          }
        const writes: unknown[] = [];
        g.onCheckpoint = (s) => writes.push(s);
        g.onBossDefeated = (k) => writes.push(k);
        g.die();
        g.startTest(save);
        assert.deepEqual(writes, []);
      }
  for (const suffix of [
    '&area=x',
    '&area=cooling&area=rooftops',
    '&mirror=2',
    '&mirror=1&mirror=1',
    '&variant=0',
    '&variant=01',
    '&variant=4',
    '&variant=1&variant=2',
    '&seed=x',
    '&daily=x',
    '&dv=2',
    '&mode=overtime',
    '&route=high',
    '&test=counterweights',
  ])
    assert.equal(
      counterweightTestFromUrl(new URL('https://test/?test=counterweights' + suffix)),
      null,
      suffix,
    );
});
test('seeded normal, Daily and Overtime selection preserves introductions, bosses and both orientations', () => {
  const normal = new Set<string>(),
    daily = new Set<string>(),
    overtime = new Set<string>();
  for (let i = 0; i < 120; i++) {
    const ds = dailyForDate(new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10))!.seed;
    for (const stage of [9, 17]) {
      for (const [seed, set] of [
        ['CW-' + i, normal],
        [ds, daily],
      ] as const) {
        const l = getLevel(seed, stage);
        if (l.counterweights) {
          set.add(l.id + ':' + l.mirrored);
          assert.deepEqual(l, getLevel(seed, stage));
        }
      }
      const ot = getOvertimeLevel('CW-' + i, stage);
      if (ot.counterweights) {
        overtime.add(ot.id + ':' + ot.mirrored);
        assert.deepEqual(
          ot.counterweights,
          getLevel(overtimeSeed('CW-' + i), stage).counterweights,
        );
      }
    }
    for (const stage of [0, 3, 8, 11, 16, 19]) assert(!getLevel('CW-' + i, stage).counterweights);
  }
  assert.equal(normal.size, 4);
  assert.equal(daily.size, 4);
  assert.equal(overtime.size, 4);
});
for (const area of ['cooling', 'rooftops'])
  for (const mirror of [false, true])
    test(`ordinary jumps cross ${area}, mirror=${mirror}, with either tilt and after removal`, () => {
      for (const state of [-1, 1, 0]) {
        const g = room(area, mirror);
        quiet(g);
        g.mods = [];
        g.gun = getGun([]);
        for (const prop of [...g.props.items]) g.props.remove(prop);
        if (state === 0) g.counterweights.clear();
        else
          for (const p of g.counterweights.items) {
            Body.setAngle(p.body, CW.angle * state);
            Body.setStatic(p.body, true);
          }
        let stuck = 0,
          oldX = 140;
        for (let i = 0; i < 3600 && g.mode === 'playing'; i++) {
          const p = g.player.position;
          stuck = Math.abs(p.x - oldX) < 0.4 ? stuck + 1 : 0;
          oldX = p.x;
          const blocked = Query.ray(g.solidBodies, p, { x: p.x + 70, y: p.y }, 24).length > 0;
          step(g, 1, { right: true, jump: g.grounded && (blocked || stuck > 12) });
        }
        assert(g.hp > 0);
        assert.equal(g.mode, 'upgrade', `${state}: ${JSON.stringify(g.player.position)}`);
      }
    });

for (const area of ['cooling', 'rooftops'])
  for (const mirror of [false, true])
    test(`the real ${area} encounter is beatable using normal inputs, mirror=${mirror}`, () => {
      const g = room(area, mirror);
      let stuckFrames = 0,
        lastX = 140,
        advanceUntil = 0;
      for (let n = 0; n < 18000 && !g.clear && g.mode === 'playing'; n++) {
        const e = g.enemies
          .filter((e) => e.spawn <= 0)
          .sort(
            (a, b) =>
              distance(a.body.position, g.player.position) -
              distance(b.body.position, g.player.position),
          )[0];
        stuckFrames = Math.abs(g.player.position.x - lastX) < 0.2 ? stuckFrames + 1 : 0;
        lastX = g.player.position.x;
        let input: Partial<Input> = e ? dodgePilot(g, e) : {};
        if (
          e &&
          (stuckFrames > 90 || g.time < advanceUntil) &&
          distance(g.lineEnd(g.player.position, e.body.position), e.body.position) > 1
        ) {
          if (stuckFrames > 90) {
            advanceUntil = g.time + 0.65;
            stuckFrames = 0;
          }
          const dir = Math.sign(e.body.position.x - g.player.position.x);
          input = { left: dir < 0, right: dir > 0, jump: g.grounded, fire: false };
        }
        step(g, 1, input);
      }
      assert(
        g.hp > 0 && g.clear,
        `${g.hp} HP, ${g.enemies.map((e) => e.kind + ':' + Math.round(e.hp))}, ${JSON.stringify(g.player.position)}`,
      );
    });
