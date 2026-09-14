import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fixture,
  target,
  wall,
  round,
  beam,
  advance,
  Body,
  Composite,
} from './branches-fixture.ts';
import { RESONATOR, STORM_CELL } from '../src/cross-fusions.ts';
import { FLYWHEEL_DISTANCE } from '../src/mass-driver.ts';
import {
  getGun,
  validBuild,
  availableMods,
  loadCheckpoint,
  rewardMods,
  seeded,
  isFusion,
} from '../src/rules.ts';
import { withParents, branchTestFromUrl, maxCombos } from '../src/branch-builds.ts';
import { workshopBuild } from '../src/workshop-build.ts';
const near = (a: number, b: number, e = 1e-5) => assert(Math.abs(a - b) < e, `${a} != ${b}`);
const ids = ['resonator', 'flywheel', 'storm-cell'];
function resonator() {
  const g = fixture(withParents([], ['resonator'])!);
  wall(g, 600, 400, 40, 600);
  assert(g.portals.place({ x: 580, y: 300 }));
  assert(g.portals.place({ x: 1300, y: 740 }));
  return g;
}
function cell() {
  const g = fixture(withParents([], ['storm-cell'])!);
  const floor = wall(g, 700, 740, 1200, 20);
  const id = g.fusions.storm.create(100)!;
  g.fusions.storm.land(id, { x: 400, y: 728 }, floor, { x: 0, y: -1 });
  g.fusions.storm.land(id, { x: 600, y: 728 }, floor, { x: 0, y: -1 });
  return { g, floor, id };
}

test('new fusions have complete reachable parents, one-fusion gating and safe saved/test/Workshop builds', () => {
  for (const id of ids) {
    const build = withParents([], [id])!;
    assert(validBuild(build));
    for (const other of ids) if (other !== id) assert.equal(withParents(build, [other]), null);
    assert(!availableMods(build, true).some((m) => isFusion(m.id)));
    assert(
      !rewardMods(build.slice(0, -1), 100, seeded('early'), { stage: 6 }).some((m) => m.id === id),
    );
    assert(
      rewardMods(build.slice(0, -1), 100, seeded('late'), { stage: 7 }).some((m) => m.id === id),
    );
    assert(maxCombos().some((c) => c.mods.includes(id)));
    assert.equal(
      workshopBuild(
        build.filter((m) => m !== build.at(-2)),
        build,
      ).includes(id),
      false,
    );
  }
  for (const key of ['resonator', 'flywheel', 'storm']) {
    const save = branchTestFromUrl(new URL(`https://test/?test=branches&build=${key}`))!;
    assert(loadCheckpoint(save));
    assert.equal(save.mods.filter(isFusion).length, 1);
  }
});

test('Resonator weakens only the first two pulses and records only actual portal-crossing finisher energy', () => {
  const base = fixture(withParents([], ['pulse-chamber'])!),
    a = target(base);
  const changed = fixture(withParents([], ['resonator'])!),
    b = target(changed);
  beam(base, 0.1);
  beam(changed, 0.1);
  near((b.maxHp - b.hp) / (a.maxHp - a.hp), 0.75);
  beam(changed, 0.4);
  assert.equal(changed.fusions.resonator.pending.length, 0);
  const g = resonator();
  target(g, 1300, 500);
  beam(g, 0.4);
  assert.equal(g.fusions.resonator.pending.length, 1);
  assert(g.fusions.resonator.pending[0].origin.from.y > 700);
  assert(g.fusions.resonator.pending[0].damage > 0);
});

test('portal repeats retain pulse energy at 30/60/120 Hz, fixed exit aim and no extra discharge or procs', () => {
  const values = [];
  for (const hz of [30, 60, 120]) {
    const g = resonator(),
      e = target(g, 1300, 500);
    beam(g, 0.4, true, 1 / hz);
    const pending = g.fusions.resonator.pending[0],
      expected = pending.damage;
    const hp = e.hp,
      count = g.shotCount,
      velocity = { ...g.player.velocity };
    g.aim = { x: 0, y: 0 };
    Body.setPosition(g.player, { x: 300, y: 100 });
    g.time = pending.at - 0.001;
    g.fusions.resonator.update();
    near(e.hp, hp);
    g.time += 0.002;
    g.fusions.resonator.update();
    near(hp - e.hp, expected * pending.origin.gain);
    values.push(hp - e.hp);
    assert.equal(g.shotCount, count);
    assert.deepEqual(g.player.velocity, velocity);
    assert.equal(g.fusions.resonator.pending.length, 0);
    assert.equal(g.arcs.charges.size, 0);
    g.fusions.resonator.update();
    near(hp - e.hp, values.at(-1)!);
  }
  near(values[0], values[1]);
  near(values[1], values[2]);
});

test('Resonator retraces new cover and shields, cancels invalid portals and cannot bridge the portal gap', () => {
  for (const mode of ['cover', 'shield', 'lost']) {
    const g = resonator();
    const e = target(g, 1300, 500),
      gap = target(g, 900, 600);
    beam(g, 0.4);
    const pending = g.fusions.resonator.pending[0];
    const hp = e.hp;
    if (mode === 'cover') wall(g, 1300, 600, 200, 8);
    if (mode === 'shield') {
      // Turn the exit ray sideways so a real directional shield can face it.
      pending.origin.from = { x: 1000, y: 500 };
      pending.origin.dir = { x: 1, y: 0 };
      e.elite = 'shielded';
      e.facing = -1;
    }
    if (mode === 'lost') g.portals.reset();
    g.time = pending.at + 0.01;
    g.fusions.resonator.update();
    near(gap.hp, gap.maxHp);
    if (mode !== 'shield') near(e.hp, hp);
    else near(hp - e.hp, pending.damage * pending.origin.gain * 0.1);
  }
});

test('Flywheel trades exactly two banks, charges only actual rolling travel, and spends once on its saw pair', () => {
  const mods = withParents([], ['flywheel'])!,
    g = fixture(mods);
  assert.equal(g.gun.bounces, getGun(mods.filter((m) => m !== 'flywheel')).bounces - 2);
  const floor = wall(g, 700, 520, 1100, 20);
  const s = round(g, { pos: { x: 430, y: 495 }, vel: { x: 18, y: 3 } });
  advance(g, 4);
  assert(s.massDriver!.rolling);
  advance(g, 10);
  const power = s.massDriver!.flywheel!;
  assert(power.distance > 150 && power.distance < 300);
  const damage = s.damage;
  s.pos = { x: 700, y: 502 };
  g.grind.impact(s, floor, { x: 0, y: -1 });
  assert.equal(g.grind.saws.length, 2);
  for (const saw of g.grind.saws)
    near(saw.damage, damage * 0.6 * (1 + power.distance / FLYWHEEL_DISTANCE));
  g.grind.impact(s, floor, { x: 0, y: -1 });
  assert.equal(g.grind.saws.length, 2);
  const stored = power.distance;
  g.massDriver.travel(s, 99999);
  near(power.distance, stored);
  const airborne = round(g);
  g.massDriver.travel(airborne, 99999);
  near(airborne.massDriver!.flywheel!.distance, 0);
});

test('Flywheel expiry uses real support, keeps prior hits and cannot gain energy from a portal gap', () => {
  const g = fixture(withParents([], ['flywheel', 'fold'])!);
  const floor = wall(g, 700, 520, 1100, 20);
  const s = round(g, { pos: { x: 700, y: 502 }, vel: { x: 20, y: 0 } });
  s.massDriver!.rolling = { bodyId: floor.id };
  s.hits.add(123);
  g.massDriver.travel(s, 800);
  near(s.massDriver!.flywheel!.distance, FLYWHEEL_DISTANCE);
  s.life = 0.001;
  g.updateShots(1 / 60);
  assert.equal(g.grind.saws.length, 2);
  for (const saw of g.grind.saws) {
    near(saw.damage, s.damage * 1.2);
    assert(saw.hits.has(123));
  }
  const other = round(g, { pos: { x: 700, y: 502 } });
  other.massDriver!.rolling = { bodyId: floor.id };
  g.massDriver.finish(other, false);
  assert.equal(g.grind.saws.length, 2);
  wall(g, 600, 300, 40, 300);
  assert(g.portals.place({ x: 580, y: 300 }));
  assert(g.portals.place({ x: 1300, y: 740 }));
  const p = round(g, { pos: { x: 560, y: 300 }, vel: { x: 35, y: 0 } });
  advance(g, 2);
  assert(p.pos.x > 1200);
  near(p.massDriver!.flywheel!.distance, 0);
});

test('Flywheel measures travel relative to a moving deck and excludes its carrying distance', () => {
  const g = fixture(withParents([], ['flywheel'])!);
  const lift = g.hazards.spawn({ kind: 'lift', x: 500, y: 500, w: 800, h: 20, travel: 300 });
  Body.setPosition(lift.body, { x: 500, y: 510 });
  const s = round(g, { pos: { x: 400, y: 491 }, vel: { x: 18, y: 0 } });
  s.massDriver!.rolling = { bodyId: lift.body.id };
  g.massDriver.beforeStep(1 / 60);
  Body.setPosition(lift.body, { x: 535, y: 490 });
  g.updateShots(1 / 60);
  near(s.pos.x, 453);
  near(s.pos.y, 471);
  near(s.massDriver!.flywheel!.distance, 18);
});

test('rapid-fire shell impacts cannot replace Storm cells before they land and arm', () => {
  const g = fixture(withParents([], ['storm-cell', 'rapid', 'scatter'])!);
  let armed = 0;
  for (let i = 0; i < 180; i++) {
    if (i % 3 === 0)
      g.demolition.detonate({
        pos: { x: 600, y: 737 },
        normal: { x: 0, y: -1 },
        damage: 100,
        radius: 96,
        launch: 0,
        kind: 'shell',
      });
    advance(g);
    g.fusions.storm.afterStep();
    armed += g.fusions.storm.cells.filter((c) => c.armed <= g.time && c.links.length > 0).length;
    assert(g.fusions.storm.cells.length <= STORM_CELL.limit);
  }
  assert(armed > 60, `only ${armed} live cell frames`);
});

test('landed Storm bomblets form real cells and shell blast radii shrink without recursive traps', () => {
  const g = fixture(withParents([], ['storm-cell', 'aftershock'])!);
  g.demolition.detonate({
    pos: { x: 600, y: 737 },
    normal: { x: 0, y: -1 },
    damage: 100,
    radius: 96,
    launch: 0,
    kind: 'shell',
  });
  assert.equal(g.fusions.storm.cells.length, 1);
  assert.equal(g.demolition.bomblets.length, 3);
  near(g.demolition.effects[0].radius, 96 * STORM_CELL.radius);
  assert(g.demolition.bomblets.every((b) => b.at >= 1));
  advance(g, 72);
  g.fusions.storm.afterStep();
  assert(g.fusions.storm.cells[0].nodes.length >= 2);
  assert(g.fusions.storm.cells[0].links.length > 0);
  assert.equal(g.fusions.storm.cells.length, 1);
  advance(g, 120);
  g.fusions.storm.afterStep();
  assert.equal(g.fusions.storm.cells.length, 0);
});

test('Storm cells hit each enemy once across all links, respect shields and do not proc Arc Coil', () => {
  const { g, floor, id } = cell();
  g.fusions.storm.land(id, { x: 700, y: 728 }, floor, { x: 0, y: -1 });
  const e = target(g, 550, 719),
    shield = target(g, 650, 719, 'shooter', true);
  shield.facing = -1;
  g.fusions.storm.beforeStep();
  g.fusions.storm.afterStep();
  near(e.hp, e.maxHp);
  g.time = 0.2;
  g.fusions.storm.afterStep();
  near(e.maxHp - e.hp, 50);
  near(shield.maxHp - shield.hp, 5);
  for (let i = 0; i < 20; i++) g.fusions.storm.afterStep();
  near(e.maxHp - e.hp, 50);
  assert.equal(g.arcs.charges.size, 0);
  assert.equal(g.demolition.bomblets.length, 0);
});

test('Storm contacts sweep fast enemies but exclude teleport gaps and intervening cover', () => {
  for (const mode of ['sweep', 'portal', 'cover']) {
    const { g } = cell();
    const e = target(g, 500, 640);
    if (mode === 'cover') wall(g, 500, 710, 12, 100);
    g.time = 0.2;
    g.fusions.storm.beforeStep();
    Body.setPosition(e.body, { x: 500, y: 800 });
    if (mode === 'portal') g.fusions.storm.teleported(e.body);
    g.fusions.storm.afterStep();
    if (mode === 'sweep') near(e.maxHp - e.hp, 50);
    else near(e.hp, e.maxHp);
  }
});

test('Storm nodes follow moving support, disappear with broken support and stay within the three-cell cap', () => {
  const { g, floor } = cell();
  g.time = 0.2;
  g.fusions.storm.afterStep();
  const x = g.fusions.storm.cells[0].nodes[0].pos.x;
  Body.setPosition(floor, { x: floor.position.x + 30, y: floor.position.y - 20 });
  g.fusions.storm.afterStep();
  near(g.fusions.storm.cells[0].nodes[0].pos.x, x + 30);
  g.terrain = g.terrain.filter((b) => b !== floor);
  Composite.remove(g.engine.world, floor);
  g.fusions.storm.afterStep();
  assert.equal(g.fusions.storm.cells[0].links.length, 0);
  for (let i = 0; i < 100; i++) g.fusions.storm.create(100);
  assert.equal(g.fusions.storm.cells.length, STORM_CELL.limit);
});

test('new fusion transients freeze on pause and hitstop, and clear on death and room reset', () => {
  for (const stop of ['dead', 'room']) {
    const g = resonator();
    beam(g, 0.4);
    assert(g.fusions.resonator.pending.length);
    const at = g.time;
    g.setMode('paused');
    g.tick(1, { left: false, right: false, jump: false, jumpHeld: false, fire: false, aim: g.aim });
    near(g.time, at);
    assert(g.fusions.resonator.pending.length);
    g.setMode('playing');
    g.hitStop = 0.5;
    g.fusions.resonator.update();
    assert(g.fusions.resonator.pending.length);
    if (stop === 'dead') g.setMode('dead');
    else g.loadRoom();
    assert.equal(g.fusions.resonator.pending.length, 0);
  }
  const { g } = cell();
  g.setMode('dead');
  assert.equal(g.fusions.storm.cells.length, 0);
});
