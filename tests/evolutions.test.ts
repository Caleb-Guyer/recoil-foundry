import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import {
  MODS,
  MOD_REQUIRES,
  MOD_PATHS,
  availableMods,
  validBuild,
  getGun,
  loadCheckpoint,
  rewardMods,
  seeded,
} from '../src/rules.ts';
import { AFTERSHOCK_DELAY } from '../src/demolition.ts';
const { Body, Bodies, Composite, Engine } = Matter;
const near = (a: number, b: number, eps = 1e-6) => assert(Math.abs(a - b) < eps, `${a} != ${b}`);
const added = [
  'rewire',
  'slingshot',
  'redline',
  'breach',
  'shatter',
  'convergence',
  'deadlock',
  'shockfront',
  'backfire',
];
function parents(id: string): string[] {
  return MOD_REQUIRES[id] ? [...parents(MOD_REQUIRES[id]), MOD_REQUIRES[id]] : [];
}
function fixture(mods: string[]) {
  const g = new Game();
  g.start('evolution-test');
  g.hazards.clear();
  g.breaches.clear();
  g.waves.clear();
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const e of g.enemies) {
    Composite.remove(g.engine.world, e.body);
    if (e.crane) Composite.remove(g.engine.world, e.crane.body);
  }
  g.enemies = [];
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.mods = mods;
  g.gun = getGun(mods);
  g.engine.gravity.y = 0;
  g.player.frictionAir = 0;
  Body.setPosition(g.player, { x: 600, y: 300 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.aim = { x: 1000, y: 300 };
  g.grounded = false;
  return g;
}
function wall(g: Game, x = 800, y = 300, w = 10, h = 180) {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  return b;
}
function target(g: Game, x = 760, y = 300) {
  g.spawnEnemy('shooter', x, y);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.timer = 100;
  e.hp = e.maxHp = 10000;
  return e;
}
function projectile(g: Game, x: number, y: number, friendly = false) {
  g.addShot({
    pos: { x, y },
    vel: { x: 5, y: 0 },
    damage: 10,
    life: 2,
    radius: 3,
    friendly,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
  return g.shots.at(-1)!;
}
function simulateShots(g: Game, frames = 35) {
  for (let i = 0; i < frames; i++) {
    g.time += 1 / 60;
    g.updateShots(1 / 60);
  }
}
function transit(g: Game, speed = 12) {
  Body.setPosition(g.player, { x: 600, y: 710 });
  Body.setVelocity(g.player, { x: 0, y: speed });
  g.time += 0.3;
  for (let i = 0; i < 4 && g.player.position.x < 700; i++) {
    g.portals.beforeStep();
    Engine.update(g.engine, 1000 / 60);
  }
}

test('every follow-up requires its base, preserves path locks and rejects forged rewards', () => {
  for (const id of added) {
    const base = parents(id);
    assert(!availableMods([]).some((m) => m.id === id));
    assert(
      availableMods(base).some((m) => m.id === id),
      id,
    );
    assert(validBuild([...base, id]));
    assert(!validBuild([id, ...base]));
    assert(!availableMods([...base, id]).some((m) => m.id === id));
    for (const root of ['crossfire', 'deadeye', 'shellshock']) {
      const branch = MOD_PATHS[id];
      assert.equal(
        availableMods([...new Set([root, ...base])]).some((m) => m.id === id),
        !branch || MOD_PATHS[root].path === branch.path,
        id + root,
      );
    }
    const g = fixture([]);
    g.openReward();
    g.offers = [MODS.find((m) => m.id === id)!];
    g.chooseMod(id);
    assert.deepEqual(g.mods, []);
    assert.equal(g.stage, 0);
    assert.equal(g.mode, 'upgrade');
  }
});
test('all follow-ups persist in checkpoints and remain reachable through seeded rewards', () => {
  const seen = new Set<string>();
  for (let run = 0; run < 500; run++) {
    const rng = seeded('follow-ups-' + run),
      mods: string[] = [];
    for (let room = 0; room < 11; room++) {
      const choices = rewardMods(mods, 3, rng);
      assert.equal(choices.length, 3);
      const choice =
        choices.find((m) => added.includes(m.id)) ?? choices[Math.floor(rng() * choices.length)];
      mods.push(choice.id);
      seen.add(choice.id);
      assert(validBuild(mods));
    }
  }
  for (const id of added) {
    assert(seen.has(id), id + ' unreachable');
    const g = fixture([...parents(id), id]);
    let raw: unknown;
    g.onCheckpoint = (s) => {
      raw = s;
    };
    g.save();
    const save = loadCheckpoint(JSON.parse(JSON.stringify(raw)))!;
    assert(save, id);
    g.start(save.seed, save);
    assert.deepEqual(g.gun, getGun(save.mods));
    assert.equal(g.evolutions.streak, 0);
    assert(!g.evolutions.slingReady);
  }
});
test('Backblast provides its damage boost and cone without a backward projectile; Backfire adds the volley', () => {
  for (const upgraded of [false, true]) {
    const g = fixture(upgraded ? ['backblast', 'backfire'] : ['backblast']);
    const nearRear = target(g, 540),
      farRear = target(g, 380);
    g.fire();
    near(g.gun.damage, 30);
    near(g.gun.interval, 0.22 * 1.2 * (upgraded ? 1.2 : 1));
    assert.equal(g.shots.length, upgraded ? 2 : 1);
    near(nearRear.maxHp - nearRear.hp, 24);
    near(g.player.velocity.x, -g.gun.recoil);
    Composite.remove(g.engine.world, nearRear.body);
    g.enemies = g.enemies.filter((e) => e !== nearRear);
    g.updateShots(1 / 6);
    assert.equal(farRear.hp < farRear.maxHp, upgraded);
  }
});
test('Rewire keeps exactly two portals while alternating unlimited replacements and preserving invalid attempts', () => {
  const g = fixture(['fold', 'rewire']);
  assert(g.portals.place({ x: 400, y: 740 }));
  assert(g.portals.place({ x: 1000, y: 740 }));
  for (let i = 0; i < 1000; i++) {
    const index = g.portals.nextIndex,
      other = g.portals.pair[1 - index];
    assert(!g.portals.place({ x: 300, y: 300 }));
    assert.equal(g.portals.nextIndex, index);
    assert(!g.portals.place(other!.pos));
    assert.equal(g.portals.nextIndex, index);
    assert(
      g.portals.place({
        x: index === 0 ? (i % 4 === 0 ? 500 : 400) : i % 4 === 1 ? 1100 : 1000,
        y: 740,
      }),
    );
    assert.equal(g.portals.pair[1 - index], other);
    assert.equal(g.portals.pair.length, 2);
    assert(g.portals.canPlace && g.portals.linked);
  }
  g.setMode('paused');
  assert(!g.portals.place({ x: 1500, y: 740 }));
  g.setMode('playing');
  g.loadRoom();
  assert.equal(g.portals.next, 0);
  assert(g.portals.canPlace);
});
test('Slingshot boosts actual portal travel once until a discharge spends the charge', () => {
  const g = fixture(['fold', 'slingshot', 'scatter', 'burst', 'backblast', 'backfire']);
  wall(g, 800, 500, 40, 480);
  assert(g.portals.place({ x: 600, y: 740 }));
  assert(g.portals.place({ x: 780, y: 400 }));
  transit(g);
  assert(g.player.position.x > 700);
  assert(g.evolutions.slingReady);
  near(g.player.velocity.x, -15);
  transit(g);
  near(g.player.velocity.x, -12);
  assert(g.evolutions.slingReady);
  g.fire();
  assert(!g.evolutions.slingReady);
  assert.equal(g.shots.length, 10);
  assert(g.shots.every((s) => s.charged));
  for (const s of g.shots) near(s.damage, g.gun.damage * 1.5);
  g.shots = [];
  g.fireRound();
  assert(g.shots.every((s) => !s.charged));
  for (const s of g.shots) near(s.damage, g.gun.damage);
  transit(g);
  assert(g.evolutions.slingReady);
  g.loadRoom();
  assert(!g.evolutions.slingReady);
});
test('Slingshot leaves enemy and projectile travel unboosted and preserves player speed limits', () => {
  const g = fixture(['fold', 'slingshot']);
  wall(g, 800, 500, 40, 480);
  g.portals.place({ x: 600, y: 740 });
  g.portals.place({ x: 780, y: 400 });
  const s = projectile(g, 600, 710, true);
  s.vel = { x: 0, y: 40 };
  g.updateShots(1 / 60);
  near(Math.hypot(s.vel.x, s.vel.y), 40);
  assert(!g.evolutions.slingReady);
  g.spawnEnemy('runner', 600, 710);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.body.frictionAir = 0;
  Body.setVelocity(e.body, { x: 0, y: 20 });
  g.portals.beforeStep();
  Engine.update(g.engine, 1000 / 60);
  assert(e.body.position.x > 700);
  near(Math.hypot(e.body.velocity.x, e.body.velocity.y), 20);
  assert(!g.evolutions.slingReady);
  // Move the enemy clear of the exit before sending the player through it.
  Body.setPosition(e.body, { x: 1200, y: 300 });
  transit(g, 35);
  assert(Math.abs(g.player.velocity.x) <= 23);
});
test('Redline snapshots pre-shot speed, scales smoothly, caps damage and applies equally to both volleys', () => {
  for (const speed of [0, 9, 18, 35]) {
    const g = fixture([
      'kick',
      'redline',
      'scatter',
      'backblast',
      'backfire',
      'landing',
      'airshot',
    ]);
    Body.setVelocity(g.player, { x: speed, y: 0 });
    g.landingReady = true;
    g.fire();
    const expected = g.gun.damage * g.gun.airDamage * 2 * (1 + 0.5 * Math.min(speed / 18, 1));
    assert.equal(g.shots.length, 10);
    for (const s of g.shots) near(s.damage, expected);
    assert(Math.abs(g.player.velocity.x) <= 23);
  }
});
test('Breach clears only visible hostile bullets inside the rear cone, including cover broken by the blast', () => {
  const g = fixture(['backblast', 'breach']);
  const clear = projectile(g, 550, 300),
    front = projectile(g, 680, 300),
    side = projectile(g, 550, 420),
    far = projectile(g, 440, 300),
    friend = projectile(g, 550, 300, true);
  const crate = g.props.spawn('crate', 500, 300);
  crate.hp = 1;
  const covered = projectile(g, 475, 300);
  g.fire();
  assert(!g.shots.includes(clear));
  for (const s of [front, side, far, friend, covered]) assert(g.shots.includes(s));
  assert(!g.props.items.includes(crate));
});
test('Breach does not grant a passive shield or remove bullets without its own prerequisite effect', () => {
  const g = fixture(['backblast']);
  const s = projectile(g, 520, 300);
  g.fire();
  assert(g.shots.includes(s));
  g.mods.push('breach');
  g.gun = getGun(g.mods);
  const newShot = projectile(g, 520, 300);
  g.updateShots(1 / 60);
  assert(g.shots.includes(newShot));
  g.fireRound();
  assert(!g.shots.includes(newShot));
});
test('Shatter emits six outward fragments on the first solid hit without recursive splitting or cover bypass', () => {
  const g = fixture(['split', 'shatter', 'ricochet']);
  wall(g);
  const covered = target(g, 850);
  g.fire();
  g.updateShots(1 / 6);
  const fragments = g.shots.filter((s) => s.fragment);
  assert.equal(fragments.length, 6);
  for (const s of fragments) {
    assert(s.vel.x < 0);
    near(s.damage, g.gun.damage * 0.3);
    assert(s.split);
    g.splitShot(s, { x: -1, y: 0 });
  }
  assert.equal(g.shots.filter((s) => s.fragment).length, 6);
  simulateShots(g, 50);
  assert.equal(covered.hp, covered.maxHp);
});
test('Shatter preserves ordinary Splinter enemy hits and spends one split even through piercing and banks', () => {
  const g = fixture(['split', 'shatter', 'pierce', 'ricochet']);
  target(g, 740);
  wall(g, 850);
  g.fire();
  g.updateShots(1 / 6);
  assert.equal(g.shots.filter((s) => s.fragment).length, 3);
  for (const s of g.shots.filter((s) => s.fragment)) near(s.damage, g.gun.damage * 0.2);
  g.updateShots(1 / 60);
  assert(g.shots.filter((s) => s.fragment).length <= 3);
});
test('Convergence fans out then crosses the frozen aim point and lands all three lanes', () => {
  const g = fixture(['crossfire', 'convergence']);
  g.aim = { x: 1100, y: 300 };
  const e = target(g, 1100);
  g.fire();
  const shots = [...g.shots];
  assert.equal(shots.filter((s) => s.waypoints).length, 2);
  g.aim = { x: 300, y: 100 };
  simulateShots(g, 5);
  assert(Math.abs(shots[0].pos.y - shots[2].pos.y) > 40, 'lanes did not spread');
  simulateShots(g, 25);
  near(e.maxHp - e.hp, g.gun.damage * 3);
  assert(shots.every((s) => s.hits.has(e.id)));
});
test('Convergence retains mirrored rear volleys, pellet count and one recoil impulse', () => {
  const g = fixture(['crossfire', 'convergence', 'backblast', 'backfire']);
  g.aim = { x: 950, y: 300 };
  const front = target(g, 950),
    rear = target(g, 250);
  g.fire();
  assert.equal(g.shots.length, 6);
  near(g.player.velocity.x, -g.gun.recoil);
  simulateShots(g, 30);
  near(front.maxHp - front.hp, g.gun.damage * 3);
  near(rear.maxHp - rear.hp, g.gun.damage * 3);
  const pellets = fixture(['crossfire', 'convergence', 'scatter']);
  pellets.fire();
  assert.equal(pellets.shots.length, 15);
});
test('Convergence stops bending after a real bank and cannot bend through thin cover', () => {
  for (const bank of [false, true]) {
    const g = fixture(['crossfire', 'convergence', ...(bank ? ['ricochet'] : [])]);
    wall(g, 740, 300, 2, 300);
    const e = target(g, 900);
    g.fire();
    const shots = [...g.shots];
    g.updateShots(1 / 6);
    assert.equal(e.hp, e.maxHp);
    assert(shots.every((s) => !s.waypoints));
    if (bank) assert(shots.every((s) => s.vel.x < 0 && s.banks === 1));
    else assert.equal(g.shots.length, 0);
  }
});
test('Convergence discards old aim waypoints when a round passes through a portal', () => {
  const g = fixture(['fold', 'crossfire', 'convergence']);
  wall(g, 800, 300, 20, 450);
  assert(g.portals.place({ x: 790, y: 270 }));
  assert(g.portals.place({ x: 1400, y: 740 }));
  g.fire();
  const s = g.shots[0];
  simulateShots(g, 7);
  assert(s.pos.x > 1300);
  assert(!s.waypoints);
  assert(s.vel.y < 0);
});
test('Deadlock rewards successive accurate discharges up to 60 percent and a complete miss resets it', () => {
  const g = fixture(['deadeye', 'deadlock']);
  target(g);
  for (let i = 0; i < 9; i++) {
    g.fireRound();
    near(g.shots.at(-1)!.damage, g.gun.damage * (1 + 0.12 * Math.min(5, i)));
    g.updateShots(0.1);
    assert.equal(g.evolutions.streak, Math.min(5, i + 1));
  }
  g.aim = { x: 600, y: 0 };
  g.fireRound();
  g.updateShots(2);
  assert.equal(g.evolutions.streak, 0);
  g.aim = { x: 1000, y: 300 };
  g.fireRound();
  near(g.shots.at(-1)!.damage, g.gun.damage);
});
test('Deadlock counts one success for a pellet or piercing volley and never counts child fragments', () => {
  const g = fixture(['deadeye', 'deadlock', 'scatter', 'pierce', 'split', 'backblast', 'backfire']);
  target(g, 720);
  target(g, 790);
  g.fireRound();
  g.updateShots(0.1);
  assert.equal(g.evolutions.streak, 1);
  assert(g.shots.some((s) => s.fragment));
  simulateShots(g, 30);
  assert.equal(g.evolutions.streak, 1);
});
test('Deadlock resolves hits and misses in firing order even when newer shots arrive first', () => {
  const g = fixture(['deadeye', 'deadlock']);
  target(g);
  g.aim = { x: 600, y: 0 };
  g.fireRound();
  const old = g.shots[0];
  old.vel = { x: 0, y: -1 };
  g.aim = { x: 1000, y: 300 };
  g.fireRound();
  g.updateShots(0.1);
  assert.equal(g.evolutions.streak, 0);
  old.life = 0;
  g.updateShots(0);
  assert.equal(g.evolutions.streak, 1, 'earlier miss must resolve before the newer hit');
});
test('Deadlock ignores shield blocks, terrain and props; expired or suppressed discharges count as misses', () => {
  for (const kind of ['wall', 'prop', 'shield', 'cap']) {
    const g = fixture(['deadeye', 'deadlock']);
    g.evolutions.streak = 3;
    if (kind === 'wall') wall(g, 720);
    if (kind === 'prop') g.props.spawn('crate', 720, 300);
    if (kind === 'shield') {
      const e = target(g, 720);
      e.elite = 'shielded';
      e.facing = -1;
    }
    if (kind === 'cap') for (let i = 0; i < 180; i++) projectile(g, 1500, 100, true);
    g.fireRound();
    g.updateShots(2);
    assert.equal(g.evolutions.streak, 0, kind);
  }
});
test('pause and hitstop preserve earned charges while death, room changes and retries clear them', () => {
  const g = fixture(['fold', 'slingshot', 'deadeye', 'deadlock']);
  g.evolutions.slingReady = true;
  g.evolutions.streak = 4;
  g.setMode('paused');
  g.tick(0.1, { left: false, right: false, jump: false, jumpHeld: false, fire: true, aim: g.aim });
  assert(g.evolutions.slingReady);
  assert.equal(g.evolutions.streak, 4);
  g.setMode('playing');
  g.hitStop = 0.1;
  g.tick(0.05, { left: false, right: false, jump: false, jumpHeld: false, fire: true, aim: g.aim });
  assert(g.evolutions.slingReady);
  assert.equal(g.evolutions.streak, 4);
  for (const action of [() => g.loadRoom(), () => g.setMode('dead'), () => g.start('new')]) {
    g.evolutions.slingReady = true;
    g.evolutions.streak = 4;
    action();
    assert(!g.evolutions.slingReady);
    assert.equal(g.evolutions.streak, 0);
  }
});
test('Shockfront enlarges only the delayed echo, retains its damage and cannot recursively echo', () => {
  for (const upgraded of [false, true]) {
    const g = fixture(['shellshock', 'aftershock', ...(upgraded ? ['shockfront'] : [])]);
    const e = target(g, 740);
    Body.setStatic(e.body, false);
    g.demolition.detonate({
      pos: { x: 600, y: 300 },
      damage: 100,
      radius: 96,
      launch: 0,
      kind: 'shell',
    });
    assert.equal(e.hp, e.maxHp);
    assert.equal(g.demolition.pending.length, 1);
    const echo = g.demolition.pending[0];
    near(echo.radius, upgraded ? 144 : 96);
    near(echo.damage, 40);
    g.time = AFTERSHOCK_DELAY + 0.01;
    g.demolition.update();
    assert.equal(g.demolition.pending.length, 0);
    assert.equal(e.hp < e.maxHp, upgraded);
    if (upgraded) assert(e.body.velocity.x > 0);
  }
});
test('Shockfront respects solid cover and boss knockback resistance', () => {
  const g = fixture(['shellshock', 'aftershock', 'shockfront']);
  const covered = target(g, 740);
  wall(g, 670);
  g.demolition.detonate({
    pos: { x: 600, y: 300 },
    damage: 100,
    radius: 144,
    launch: 0,
    kind: 'echo',
  });
  assert.equal(covered.hp, covered.maxHp);
  const b = fixture(['shellshock', 'aftershock', 'shockfront']);
  b.spawnEnemy('loader', 680, 300);
  const boss = b.enemies.at(-1)!;
  boss.spawn = 0;
  boss.state = 'recover';
  b.demolition.detonate({
    pos: { x: 600, y: 300 },
    damage: 40,
    radius: 144,
    launch: 0,
    kind: 'echo',
  });
  assert(boss.hp < boss.maxHp);
  assert(boss.body.velocity.x > 0 && boss.body.velocity.x < 1);
});

test('combined follow-ups stay finite and within shot, effect and pending-blast budgets during sustained play', () => {
  const shared = [
    'fold',
    'rewire',
    'slingshot',
    'kick',
    'redline',
    'backblast',
    'backfire',
    'breach',
    'scatter',
    'burst',
    'rapid',
    'split',
    'shatter',
    'ricochet',
    'pierce',
  ];
  for (const path of [
    ['crossfire', 'convergence', 'bloom'],
    ['deadeye', 'deadlock', 'execute'],
    ['shellshock', 'blast-surf', 'aftershock', 'shockfront', 'chain-reaction'],
  ]) {
    const g = fixture([...shared, ...path]);
    assert(validBuild(g.mods));
    wall(g, 1050, 400, 20, 500);
    for (let frame = 0; frame < 1200; frame++) {
      if (frame % 45 === 0 && g.enemies.length < 10)
        target(
          g,
          Math.min(1000, g.player.position.x + 200),
          Math.max(100, g.player.position.y),
        ).hp = 20;
      if (frame % 60 === 0) projectile(g, g.player.position.x - 80, g.player.position.y);
      g.hp = 100;
      g.tick(1 / 60, {
        left: false,
        right: frame % 120 < 60,
        jump: false,
        jumpHeld: true,
        fire: true,
        aim: { x: 1000, y: Math.max(100, g.player.position.y) },
      });
      assert.equal(g.mode, 'playing');
      assert(g.shots.length <= 180);
      assert(g.particles.length <= 220);
      assert(g.demolition.effects.length <= 24);
      assert(g.demolition.pending.length <= 256);
      for (const s of g.shots)
        assert(Number.isFinite(s.pos.x + s.pos.y + s.vel.x + s.vel.y + s.damage));
      assert(g.evolutions.streak <= 5);
      assert(Math.abs(g.player.velocity.x) <= 23.01);
    }
    assert(g.shotCount > 30);
    assert(g.kills > 0);
  }
});
