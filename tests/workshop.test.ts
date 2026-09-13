import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { MODS, availableMods, validBuild, loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import {
  discoverBuild,
  loadDiscoveries,
  workshopBuild,
  workshopLink,
} from '../src/workshop-build.ts';
import { workshopLevel } from '../src/workshop.ts';
import { testCheckpoint } from '../src/practice.ts';
import { musicScene } from '../src/music-score.ts';
import { dailyForDate } from '../src/daily.ts';
const { Body, Composite, Query } = Matter;
const all = MODS.map((mod) => mod.id);
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 500, y: 723 },
};
function step(g: Game, count = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < count; i++) g.tick(1 / 60, { ...idle, ...input });
}
function room(mods: string[] = []) {
  const g = new Game();
  g.startWorkshop(all, mods);
  return g;
}

test('discovery records contain only collected upgrade ids, survive losses, and ignore invalid builds', () => {
  assert.deepEqual(loadDiscoveries(null), []);
  assert.deepEqual(loadDiscoveries({ magnum: true }), []);
  assert.deepEqual(loadDiscoveries(['magnum', 'magnum', null, {}, 'repair', 'future-enemy']), [
    'magnum',
  ]);
  const known = discoverBuild([], ['ricochet', 'banker']);
  assert.deepEqual(discoverBuild(known, ['drop-forge']), known);
  assert.deepEqual(discoverBuild(known, []), known);
  assert.deepEqual(
    discoverBuild(known, ['fold', 'rewire']),
    loadDiscoveries([...known, 'fold', 'rewire']),
  );
  assert(!known.includes('mass-driver'));
});

test('every Workshop selection uses normal paths, prerequisites, fusion and gun transformation rules', () => {
  for (const known of [all, ['mass-driver', 'drop-forge', 'fold'], []]) {
    const selected: string[] = [];
    for (const mod of MODS) {
      const candidate = workshopBuild([...selected, mod.id], known);
      const allowed =
        known.includes(mod.id) && availableMods(selected, true).some((m) => m.id === mod.id);
      assert.equal(candidate.includes(mod.id), allowed || selected.includes(mod.id));
      assert(validBuild(candidate));
      selected.splice(0, selected.length, ...candidate);
    }
  }
  assert.deepEqual(
    workshopBuild(['mass-driver', 'drop-forge', 'rail-spike', 'cutting-torch'], all),
    ['mass-driver', 'drop-forge'],
  );
  assert.deepEqual(
    workshopBuild(
      ['deadeye', 'execute', 'rivet', 'fracture', 'capacitor', 'rail-spike', 'light'].filter(
        (id) => id !== 'deadeye',
      ),
      all,
    ),
    ['capacitor', 'light'],
  );
  assert.deepEqual(
    workshopBuild(
      ['fold', 'rewire', 'slingshot', 'light'].filter((id) => id !== 'fold'),
      all,
    ),
    ['light'],
  );
  assert.deepEqual(workshopBuild(['crossfire', 'recall', 'orbit', 'deadeye', 'execute'], all), [
    'crossfire',
    'recall',
    'orbit',
  ]);
  assert.deepEqual(workshopBuild(['mass-driver', 'drop-forge'], ['drop-forge']), []);
  assert.deepEqual(workshopBuild({ mods: all }, all), []);
});

test('only normal and Daily rewards record discoveries, while Workshop and preset modes cannot write a run', () => {
  for (const seed of ['workshop-earned', dailyForDate('2026-09-13')!.seed]) {
    const g = new Game();
    let known: string[] = [],
      saved: Checkpoint | null = null,
      writes = 0,
      victories = 0;
    g.onCheckpoint = (save) => {
      saved = save;
      writes++;
      if (save) known = discoverBuild(known, save.mods);
    };
    g.onBossDefeated = () => victories++;
    g.start(seed);
    for (const e of [...g.enemies]) g.hitEnemy(e, 10000);
    g.waves.clear();
    g.clear = true;
    g.openReward();
    const chosen = g.offers[0].id;
    assert(!known.includes(chosen));
    g.chooseMod(chosen);
    assert.deepEqual(known, [chosen]);
    const checkpoint = structuredClone(saved) as unknown as Checkpoint;
    assert(loadCheckpoint(checkpoint));
    const before = writes;
    g.startWorkshop(known, [chosen, 'mass-driver']);
    assert.deepEqual(g.mods, [chosen]);
    g.save();
    g.openReward();
    g.chooseMod('mass-driver');
    assert.equal(g.mode, 'playing');
    assert(!g.canChooseRoute && !g.canDetour && !g.canOvertime && !g.canReroll);
    g.startEscape();
    g.startOvertime();
    for (const e of [...g.enemies]) g.hitEnemy(e, 10000);
    step(g, 180);
    Body.setPosition(g.player, { x: 1940, y: 720 });
    step(g, 80);
    assert(!g.clear && !g.escape);
    g.die();
    g.setMode('title');
    assert.equal(writes, before);
    assert.equal(victories, 0);
    assert.deepEqual(saved, checkpoint);
    g.startTest(testCheckpoint('test-discovery', 9));
    assert.equal(writes, before);
    assert.deepEqual(known, [chosen]);
    g.startPractice({ kind: 'condenser', seed: 'practice-discovery' });
    assert.equal(writes, before);
    g.start(checkpoint.seed, checkpoint);
    assert(!g.workshop.active);
    assert.equal(g.stage, checkpoint.stage);
    assert.deepEqual(g.mods, checkpoint.mods);
    g.die();
    assert.equal(saved, null);
    assert.deepEqual(known, [chosen]);
  }
});

test('range starts with clear target hulls, supported loads and no hostile machinery or future encounters', () => {
  const g = room();
  assert.equal(g.enemies.length, 4);
  assert.equal(g.destruction.pieces.length, 2);
  assert.equal(g.props.items.length, 3);
  assert.equal(
    g.hazards.items.length + g.waves.doors.length + g.cargo.items.length + g.pressure.items.length,
    0,
  );
  for (const e of g.enemies) {
    assert(e.workshopTarget);
    assert.equal(Query.collides(e.body, g.solidBodies).length, 0);
  }
  step(g, 900);
  assert.equal(g.hp, 100);
  assert.equal(g.mode, 'playing');
  assert.equal(g.shots.length, 0);
  assert(!musicScene(g).boss);
  assert.equal(musicScene(g).intensity, 0);
  assert.deepEqual(workshopLevel(), workshopLevel());
});

test('moving targets travel through real physics, stop at cover, and never shoot', () => {
  const g = room();
  const e = g.enemies.find((e) => e.workshopTarget!.moving)!;
  let lo = e.body.position.x,
    hi = lo;
  for (let i = 0; i < 500; i++) {
    step(g);
    lo = Math.min(lo, e.body.position.x);
    hi = Math.max(hi, e.body.position.x);
  }
  assert(hi - lo > 160);
  assert(lo > 900 && hi < 1180);
  const wall = Matter.Bodies.rectangle(1175, 690, 25, 100, { isStatic: true });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  for (let i = 0; i < 600; i++) {
    step(g);
    assert(e.body.bounds.max.x < 1170);
  }
  assert.equal(g.shots.length, 0);
});

test('targets accept actual projectiles and directional armor retains its normal damage reduction', () => {
  const g = room();
  step(g, 35);
  const plain = g.enemies[0],
    armor = g.enemies[1];
  Body.setPosition(g.player, { x: 370, y: 722 });
  step(g, 24, { fire: true, aim: { ...plain.body.position } });
  assert(plain.hp < plain.maxHp);
  const before = armor.hp;
  assert(g.hitEnemy(armor, 100, { x: 740, y: 723 }));
  assert.equal(armor.hp, before - 10);
  assert(!g.hitEnemy(armor, 100, { x: 820, y: 723 }));
  assert.equal(armor.hp, before - 110);
});

test('destroyed targets return after a delay, wait for occupied mounts, and freeze during pause or hitstop', () => {
  const g = room();
  step(g, 35);
  const e = g.enemies[0],
    pos = { ...e.workshopTarget!.home };
  g.hitEnemy(e, 10000);
  g.hitStop = 0;
  step(g);
  const waiting = g.workshop.slots[0].remaining;
  assert(waiting > 1);
  g.setMode('paused');
  step(g, 200);
  assert.equal(g.workshop.slots[0].remaining, waiting);
  g.setMode('playing');
  g.hitStop = 1;
  step(g, 20);
  assert.equal(g.workshop.slots[0].remaining, waiting);
  g.hitStop = 0;
  Body.setPosition(g.player, pos);
  Body.setVelocity(g.player, { x: 0, y: 0 });
  step(g, 120);
  assert.equal(g.workshop.slots[0].enemy, undefined);
  Body.setPosition(g.player, { x: 150, y: 720 });
  step(g, 2);
  const fresh = g.workshop.slots[0].enemy!;
  assert(fresh && fresh.id !== e.id && fresh.hp === fresh.maxHp);
  assert(fresh.spawn > 0);
});

test('shooting a loaded ledge drops a physical crate onto a target', () => {
  const g = room();
  step(g, 45);
  const target = g.enemies[0],
    x = 500;
  for (let i = 0; i < 3; i++) {
    g.addShot({
      pos: { x, y: 585 },
      vel: { x: 0, y: -30 },
      radius: 2,
      damage: 24,
      life: 1,
      friendly: true,
      fragment: false,
      split: false,
      bounces: 0,
      pierce: 0,
    });
    g.updateShots(1 / 60);
    g.updateShots(1 / 60);
    g.updateShots(1 / 60);
  }
  assert.equal(g.destruction.pieces.length, 1);
  for (let n = 0; n < 150 && target.hp === target.maxHp; n++) step(g);
  assert(target.hp < target.maxHp);
});

test('ordinary movement enters the shaft and repeated downward shots reach its upper landing', () => {
  const g = room();
  for (let i = 0; i < 600 && g.player.position.x < 1590; i++) {
    const p = g.player.position;
    const blocked =
      Query.ray([...g.solidBodies, ...g.enemies.map((e) => e.body)], p, { x: p.x + 60, y: p.y }, 24)
        .length > 0;
    step(g, 1, { right: true, jump: g.grounded && blocked });
  }
  assert(g.player.position.x > 1560, JSON.stringify(g.player.position));
  let top = 740;
  for (let i = 0; i < 720 && g.player.position.y > 150; i++) {
    const p = g.player.position;
    step(g, 1, {
      jump: g.grounded,
      fire: true,
      aim: { x: p.x, y: p.y + 500 },
      left: p.x > 1600,
      right: p.x < 1570,
    });
    top = Math.min(top, g.player.position.y);
  }
  assert(top < 170, `Recoil stopped at ${top}`);
  for (let i = 0; i < 120; i++) step(g, 1, { right: g.player.position.x < 1700 });
  assert(g.player.position.x > 1660);
  assert(g.player.position.y < 220);
});

test('reset restores the same gun and physical room and removes all transient effects', () => {
  const mods = ['mass-driver', 'drop-forge', 'fold', 'rewire', 'rapid', 'kick', 'pierce'];
  const g = room(mods),
    original = structuredClone(g.level);
  const bodyCount = Composite.allBodies(g.engine.world).length;
  for (let i = 0; i < 12; i++) {
    step(g, 90, { jump: true, fire: true, aim: { x: 500, y: 723 } });
    g.destruction.hitBody(g.destruction.pieces[0]?.body, 1000, { x: 0, y: 1 });
    g.startWorkshop(all, g.mods);
    assert.deepEqual(g.mods, mods);
    assert.deepEqual(g.level, original);
    assert.equal(g.time, 0);
    assert.equal(g.hp, 100);
    assert.equal(g.shots.length, 0);
    assert.equal(g.particles.length, 0);
    assert.equal(g.destruction.pieces.length, 2);
    assert.equal(Composite.allBodies(g.engine.world).length, bodyCount);
    assert(g.portals.pair.every((portal) => !portal));
  }
  g.start('after-workshop');
  assert(!g.workshop.active && !g.enemies.some((e) => e.workshopTarget));
  assert.equal(g.workshop.slots.length, 0);
});

test('Workshop links preserve discovery gating and reject mixed modes', () => {
  assert(workshopLink(new URL('https://game/?workshop=1')));
  for (const suffix of [
    '',
    '?workshop=0',
    '?workshop=1&workshop=1',
    '?workshop=1&test=dropworks',
    '?workshop=1&daily=2026-09-13',
    '?workshop=1&seed=x',
  ])
    assert(!workshopLink(new URL('https://game/' + suffix)));
});
