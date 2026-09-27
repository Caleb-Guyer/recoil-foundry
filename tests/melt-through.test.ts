import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Shot } from '../src/game.ts';
import { MELT, meltPass } from '../src/melt-through.ts';
import {
  getGun,
  validBuild,
  availableMods,
  loadCheckpoint,
  rewardMods,
  seeded,
  type Checkpoint,
} from '../src/rules.ts';
import { traceTorch, TORCH } from '../src/torch.ts';
import { branchTestFromUrl } from '../src/branch-builds.ts';
import { welderTestFromUrl } from '../src/welder-test.ts';

const { Body, Bodies, Composite } = Matter;
const near = (a: number, b: number, eps = 1e-5) => assert(Math.abs(a - b) < eps, `${a} != ${b}`);
function arena(mods = ['melt-through']) {
  const g = new Game();
  g.start('melt-fixture');
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
  g.aim = { x: 1300, y: 300 };
  Body.setPosition(g.player, { x: 200, y: 300 });
  return g;
}
function wall(g: Game, x = 400, w = 24, h = 260, y = 300) {
  const body = Bodies.rectangle(x, y, w, h, { isStatic: true });
  g.terrain.push(body);
  Composite.add(g.engine.world, body);
  return body;
}
function shot(g: Game, extra: Partial<Shot> = {}) {
  return g.addShot({
    pos: { x: 300, y: 300 },
    vel: { x: 20, y: 0 },
    damage: 100,
    life: 2,
    friendly: true,
    radius: 2,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
    ...extra,
  })!;
}
function fly(g: Game, frames = 30, dt = 1 / 60) {
  for (let i = 0; i < frames; i++) {
    g.time += dt;
    g.updateShots(dt);
  }
}
function target(g: Game, x = 600) {
  const e = g.spawnEnemy('shooter', x, 300);
  e.spawn = 0;
  e.hp = e.maxHp = 10000;
  Body.setStatic(e.body, true);
  return e;
}
function beam(g: Game, seconds: number, dt: number) {
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    g.time += dt;
    g.torch.beforeStep(dt, true);
    g.torch.afterStep(dt);
  }
  g.torch.stop();
}

test('salvage is Welder-only; branches require their parent and exclude each other in both orders', () => {
  assert(!availableMods([]).some((m) => m.id === 'melt-through'));
  for (const branch of ['clean-cut', 'blowout']) {
    assert(!validBuild([branch]));
    assert(validBuild(['melt-through', branch]));
    assert(
      !availableMods(['melt-through', branch]).some(
        (m) => m.id === (branch === 'blowout' ? 'clean-cut' : 'blowout'),
      ),
    );
  }
  for (let stage = 0; stage < 20; stage++)
    assert(
      !rewardMods([], 200, seeded('melt'), { stage, overtime: true }).some(
        (m) => m.id === 'melt-through',
      ),
    );
});

test('thin cover reduces damage once, leaves the wall intact and stops at a second wall', () => {
  const g = arena(),
    first = wall(g),
    second = wall(g, 500),
    s = shot(g);
  fly(g, 6);
  assert(s.meltSpent);
  near(s.damage, 65);
  assert(g.terrain.includes(first));
  fly(g);
  assert(!g.shots.includes(s));
  assert(s.pos.x < second.bounds.min.x);
  near(s.damage, 65);
});

test('transit consumes real flight time, preserves speed and never draws a trail through the wall', () => {
  const g = arena(),
    b = wall(g, 400, 48),
    s = shot(g, { bounces: 1 });
  fly(g, 4);
  assert(s.meltTransit);
  assert(s.pos.x > b.bounds.min.x && s.pos.x < b.bounds.max.x);
  near(s.damage, 100);
  fly(g, 3);
  near(s.pos.x, 440);
  near(s.damage, 65);
  near(s.vel.x, 20);
  assert(s.trace!.points.every((p) => p.x > b.bounds.max.x));
});

test('Clean Cut doubles thickness and retains 85%; thick structures and grazing angles still block', () => {
  for (const [mods, thickness, passes, damage] of [
    [[], 24, false, 100],
    [['melt-through'], 60, false, 100],
    [['melt-through', 'clean-cut'], 80, true, 85],
    [['melt-through', 'clean-cut'], 110, false, 100],
  ] as [string[], number, boolean, number][]) {
    const g = arena(mods);
    wall(g, 400, thickness);
    const s = shot(g);
    fly(g);
    assert.equal(!!s.meltSpent, passes);
    near(s.damage, damage);
  }
  const g = arena(),
    b = wall(g, 400, 24, 600);
  assert.equal(meltPass(g, b, { x: 386, y: 200 }, { x: 0.1, y: 1 }, 2), null);
});

test('horizontal and rotated platforms use their real hull; floor, outer walls, props and machinery stay solid', () => {
  const g = arena();
  const platform = wall(g, 400, 300, 24, 400);
  assert(meltPass(g, platform, { x: 400, y: 386 }, { x: 0, y: 1 }, 2));
  Body.setAngle(platform, Math.PI / 4);
  assert(meltPass(g, platform, { x: 430, y: 370 }, { x: -1, y: 1 }, 2));
  for (const b of g.terrain.slice(0, 4))
    assert.equal(meltPass(g, b, b.position, { x: 1, y: 0 }, 2), null);
  const crate = g.props.spawn('crate', 600, 300);
  assert.equal(meltPass(g, crate.body, { x: 560, y: 300 }, { x: 1, y: 0 }, 2), null);
  const machine = Bodies.rectangle(800, 300, 24, 200, { isStatic: true });
  assert.equal(meltPass(g, machine, { x: 786, y: 300 }, { x: 1, y: 0 }, 2), null);
});

test('touching and overlapping cover cannot be skipped as one thin surface', () => {
  const g = arena(),
    b = wall(g);
  wall(g, 420, 24);
  assert.equal(meltPass(g, b, { x: 386, y: 300 }, { x: 1, y: 0 }, 2), null);
});

test('bullets hit enemies behind thin cover at reduced power, including targets flush with the exit', () => {
  for (const x of [430, 600]) {
    const g = arena();
    wall(g);
    const e = target(g, x);
    shot(g);
    fly(g);
    near(10000 - e.hp, 65);
  }
});

test('enemy, reflected and fragment shots cannot melt cover or create Blowout chains', () => {
  for (const extra of [
    { friendly: false },
    { reflected: true },
    { fragment: true },
    { blade: true as const },
  ]) {
    const g = arena(['melt-through', 'blowout']);
    wall(g);
    const s = shot(g, extra);
    fly(g);
    assert(!s.meltSpent);
    assert(!g.shots.some((s) => s.molten));
  }
});

test('Blowout is three short-range, nonrecursive fragments and does not consume the original round', () => {
  const g = arena(['melt-through', 'blowout', 'split', 'shellshock']);
  wall(g);
  const s = shot(g);
  fly(g, 6);
  const fragments = g.shots.filter((s) => s.molten);
  assert.equal(fragments.length, 3);
  assert(
    fragments.every((s) => s.fragment && s.split && !s.shell && !s.meltSpent && s.life <= 0.18),
  );
  near(
    fragments.reduce((n, s) => n + s.damage, 0),
    100 * 0.55 * 0.36,
  );
  assert(g.shots.includes(s));
  fly(g, 15);
  assert(!g.shots.some((s) => s.molten));
});

test('shell damage is reduced with direct damage and detonates only on the far-side impact', () => {
  const g = arena(['melt-through', 'shellshock']);
  wall(g);
  const s = shot(g),
    payload = s.shell!.damage;
  fly(g, 6);
  near(s.damage, 55 * 0.65);
  near(s.shell!.damage, payload * 0.65);
  const e = target(g, 600);
  fly(g, 20);
  assert(e.hp < 10000);
  assert(!s.shell);
});

test('spent passage survives a ricochet; Recall cannot regain its wall budget on return', () => {
  const g = arena(['melt-through']);
  wall(g);
  wall(g, 600, 120);
  const s = shot(g, { bounces: 1 });
  fly(g, 30);
  assert(s.meltSpent);
  assert(s.pos.x > 412);
  assert(!g.shots.includes(s));
  const r = arena(['melt-through', 'recall', 'retrace']);
  wall(r, 340);
  const returning = shot(r);
  fly(r, 40);
  assert(returning.meltSpent);
  assert(returning.recall?.returning);
  assert(returning.pos.x > 352);
});

test('expired shots cannot emerge, deal damage, or release exit fragments', () => {
  const g = arena(['melt-through', 'blowout']);
  wall(g, 400, 48);
  const e = target(g);
  const s = shot(g, { life: 0.08 });
  fly(g);
  assert(!g.shots.includes(s));
  near(e.hp, 10000);
  assert(!g.shots.some((s) => s.molten));
});

test('steel balls and charged rail rounds retain their own mechanics through a wall', () => {
  for (const mods of [['mass-driver'], ['deadeye', 'capacitor', 'rail-spike']]) {
    const g = arena(['melt-through', ...mods]);
    wall(g);
    if (mods.includes('rail-spike')) g.ballistics.charge(1, false);
    g.fireRound();
    const s = g.shots[0],
      before = s.damage;
    if (mods.includes('mass-driver')) assert(s.massDriver);
    else assert(s.rail);
    fly(g, 20);
    assert(s.meltSpent);
    assert(!s.meltTransit);
    near(s.damage, before * MELT.gain);
  }
});

test('beam tracing is pure, spends range inside cover, reduces gain and stops at the next wall', () => {
  const g = arena(['melt-through', 'cutting-torch']);
  const a = wall(g),
    b = wall(g, 600);
  const paths = traceTorch(g);
  assert.equal(paths.length, 2);
  assert(paths[0].melt);
  assert(!paths[0].body);
  near(paths[1].gain, 0.65);
  assert.equal(paths[1].body, b);
  assert(g.terrain.includes(a));
  assert.equal(g.melt.marks.length, 0);
  assert.equal(g.shots.length, 0);
  g.terrain = g.terrain.filter((w) => w !== b);
  const open = traceTorch(g);
  near(open.at(-1)!.b.x, 200 + TORCH.range, 0.1);
});

test('beam portal continuation carries its spent wall budget', () => {
  const g = arena(['melt-through', 'cutting-torch']);
  const b = wall(g);
  const paths = traceTorch(
    g,
    false,
    0,
    12,
    { used: true },
    {
      from: { x: 300, y: 300 },
      dir: { x: 1, y: 0 },
      remaining: 700,
      banks: 0,
      pierce: 0,
      gain: 0.65,
      radius: 1.5,
      meltSpent: true,
    },
  );
  assert.equal(paths.length, 1);
  assert.equal(paths[0].body, b);
  assert(!paths[0].melt);
});

test('real portals retain a spent passage for both projectiles and beams', () => {
  for (const torch of [false, true]) {
    const g = arena(['melt-through', 'fold', ...(torch ? ['cutting-torch'] : [])]);
    wall(g);
    wall(g, 600, 40, 600, 400);
    const platform = wall(g, 1300, 250, 24, 550);
    assert(g.portals.place({ x: 580, y: 300 }));
    assert(g.portals.place({ x: 1300, y: 740 }));
    if (torch) {
      const paths = traceTorch(g);
      assert(paths[0].melt);
      const exit = paths.find((p) => p.portalExit)!.portalExit!;
      assert(exit.meltSpent);
      assert.equal(paths.at(-1)!.body, platform);
      assert.equal(paths.filter((p) => p.melt).length, 1);
    } else {
      const s = shot(g);
      fly(g, 45);
      assert(s.meltSpent);
      near(s.damage, 65);
      assert(s.pos.x > 1200);
      assert(s.pos.y > 550);
      assert(!g.shots.includes(s));
    }
  }
});

test('rotated thin terrain permits a real projectile exit without a phantom AABB impact', () => {
  const g = arena();
  const b = wall(g, 400, 24, 260);
  Body.setAngle(b, Math.PI / 4);
  const s = shot(g);
  fly(g, 12);
  assert(s.meltSpent);
  assert(g.shots.includes(s));
  near(s.damage, 65);
});

test('burst, charge and prism beams all transmit damage and bounded molten payloads', () => {
  for (const branch of ['burst', 'pulse-chamber', 'charge-lens', 'prism-array']) {
    const g = arena([
      'melt-through',
      'blowout',
      'cutting-torch',
      ...(branch === 'pulse-chamber' ? ['burst'] : []),
      branch,
    ]);
    wall(g);
    const e = target(g);
    if (branch === 'prism-array') Body.setPosition(e.body, { x: 600, y: 333 });
    if (branch === 'charge-lens') {
      for (let i = 0; i < 50; i++) {
        g.time += 1 / 60;
        g.torch.beforeStep(1 / 60, true);
        g.torch.afterStep(1 / 60);
      }
      for (let i = 0; i < 10; i++) {
        g.time += 1 / 60;
        g.torch.beforeStep(1 / 60, false);
        g.torch.afterStep(1 / 60);
      }
      g.torch.stop();
    } else beam(g, 0.6, 1 / 60);
    assert(e.hp < 10000, branch);
    assert(
      g.shots.some((s) => s.molten),
      branch,
    );
    assert(g.shots.length <= 30, branch);
  }
});

test('continuous beam and Blowout integrate the same damage at 30, 60 and 120 Hz', () => {
  const totals: number[] = [];
  for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
    const g = arena(['melt-through', 'blowout', 'cutting-torch']);
    wall(g);
    const e = target(g);
    beam(g, 0.6, dt);
    const fragments = g.shots.filter((s) => s.molten);
    assert(fragments.length <= 12);
    const expected = (g.gun.damage * TORCH.output * 0.6) / g.gun.interval;
    near(10000 - e.hp, expected * MELT.gain);
    near(
      fragments.reduce((n, s) => n + s.damage, 0),
      expected * 0.36,
    );
    totals.push(10000 - e.hp);
    assert(g.melt.marks.length <= 32);
  }
  near(totals[0], totals[2]);
});

test('a beam tap earns only its lit fraction of fragment damage; room reset discards pending effects', () => {
  const g = arena(['melt-through', 'blowout', 'cutting-torch']);
  wall(g);
  beam(g, 1 / 60, 1 / 60);
  near(
    g.shots.reduce((n, s) => n + s.damage, 0),
    ((g.gun.damage * TORCH.output) / 60 / g.gun.interval) * 0.36,
  );
  g.loadRoom();
  assert.equal(g.melt.marks.length, 0);
  assert.equal(g.shots.length, 0);
});

test('all six playable presets are legal, repeatable and isolated from progress', () => {
  for (const name of ['melt', 'clean-cut', 'blowout', 'melt-beam', 'melt-shell', 'melt-ball']) {
    const s = branchTestFromUrl(new URL('https://test/?test=branches&build=' + name))!;
    assert(loadCheckpoint(s));
    const g = new Game();
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.startTest(s);
    assert(g.mods.includes('melt-through'));
    g.startTest(g.testRun!);
    assert.equal(writes, 0);
  }
});

test('Welder offers the salvage once, preserves choices through Continue, and clears salvage before the ordinary reward', () => {
  for (const take of [true, false]) {
    const save = welderTestFromUrl(new URL('https://test/?test=welder'))!;
    const g = new Game();
    let checkpoint: Checkpoint | null = null;
    g.onCheckpoint = (s) => {
      if (s) checkpoint = structuredClone(s);
    };
    g.start(save.seed, save);
    g.welder.state!.status = 'defeated';
    g.waves.clear();
    g.enemies = [];
    g.clear = true;
    g.openReward();
    assert(g.offers.some((m) => m.id === 'melt-through'));
    assert(loadCheckpoint(checkpoint));
    const resumed = new Game();
    resumed.start(save.seed, checkpoint!);
    assert.deepEqual(resumed.offers, g.offers);
    g.chooseMod(take ? 'melt-through' : g.offers.find((m) => m.id !== 'melt-through')!.id);
    assert.equal(g.mods.includes('melt-through'), take);
    assert(!g.welderReward);
    assert.equal(g.earnedSalvage, null);
    assert(!g.offers.some((m) => m.id === 'melt-through'));
    assert(loadCheckpoint(checkpoint));
  }
});

test('pre-update Welder choices resume unchanged and forged salvage outside that bonus is rejected', () => {
  const save = welderTestFromUrl(new URL('https://test/?test=welder'))!;
  const g = new Game();
  let checkpoint: Checkpoint | null = null;
  g.onCheckpoint = (s) => {
    if (s) checkpoint = structuredClone(s);
  };
  g.start(save.seed, save);
  g.welder.state!.status = 'defeated';
  g.waves.clear();
  g.enemies = [];
  g.clear = true;
  g.openReward();
  const old = structuredClone(checkpoint!);
  delete old.reward!.salvage;
  old.reward!.offers = availableMods(old.mods)
    .slice(0, 3)
    .map((m) => m.id);
  assert(loadCheckpoint(old));
  const resumed = new Game();
  resumed.start(old.seed, old);
  assert.deepEqual(
    resumed.offers.map((m) => m.id),
    old.reward!.offers,
  );
  assert(!resumed.offers.some((m) => m.id === 'melt-through'));
  const forged = structuredClone(checkpoint!);
  delete forged.reward!.welder;
  delete forged.welder;
  assert.equal(loadCheckpoint(forged), null);
});

test('death and menu discard pending beam fragments before resetting the weapon', () => {
  for (const mode of ['dead', 'title'] as const) {
    const g = arena(['melt-through', 'blowout', 'cutting-torch']);
    wall(g);
    g.time += 1 / 60;
    g.torch.beforeStep(1 / 60, true);
    g.torch.afterStep(1 / 60);
    assert(g.melt.marks.length);
    assert.equal(g.shots.length, 0);
    g.setMode(mode);
    assert.equal(g.shots.length, 0);
    assert.equal(g.melt.marks.length, 0);
  }
});
