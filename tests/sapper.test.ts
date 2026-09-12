import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { getLevel, type Solid } from '../src/levels.ts';
import { getOvertimeLevel } from '../src/overtime.ts';
import { getRouteLevel, reinforceRoute } from '../src/route-layouts.ts';
import { getGun, loadCheckpoint, distance } from '../src/rules.ts';
import { sapperTestFromUrl, testCheckpoint } from '../src/practice.ts';
import { splitWaves, REINFORCEMENT_TELL } from '../src/reinforcements.ts';
import { CHARGE_FUSE, CHARGE_LIMIT, SAPPER_LOCK, SAPPER_TELL } from '../src/sapper.ts';
import { dailyForDate } from '../src/daily.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
const { Body, Bodies, Composite, Engine, Query } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1500, y: 400 },
};
function fixture() {
  const g = new Game();
  g.start('sapper-fixture');
  g.waves.clear();
  g.hazards.clear();
  g.breaches.clear();
  g.conveyors.clear();
  g.destruction.clear();
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.level.solids = [];
  g.level.route = [];
  g.spawnEnemy('sapper', 400, 400);
  const e = g.enemies[0];
  e.spawn = 0;
  e.timer = 100;
  Body.setPosition(g.player, { x: 1400, y: 400 });
  g.engine.gravity.y = 0;
  return { g, e };
}
function wall(g: Game, rect: Solid = { x: 600, y: 300, w: 60, h: 180 }, weak = false) {
  const body = Bodies.rectangle(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w, rect.h, {
    isStatic: true,
    label: 'terrain',
  });
  Composite.add(g.engine.world, body);
  g.terrain.push(body);
  g.level.solids.push(rect);
  if (weak) g.destruction.register(body, rect);
  return body;
}
function physics(g: Game, frames = 1) {
  for (let i = 0; i < frames; i++) {
    g.time += 1 / 60;
    g.props.beforeStep();
    g.sappers.beforeStep();
    g.destruction.beforeStep();
    g.portals.beforeStep();
    Engine.update(g.engine, 1000 / 60);
    g.props.afterStep(1 / 60);
    g.destruction.afterStep(1 / 60);
    g.sappers.afterStep();
  }
}
function fire(g: Game, pos: { x: number; y: number }, vel = { x: 60, y: 0 }, extra = {}) {
  g.addShot({
    pos,
    vel,
    damage: 22,
    life: 2,
    radius: 3,
    friendly: true,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
    ...extra,
  });
  const s = g.shots.at(-1)!;
  g.updateShots(1 / 60);
  return s;
}
test('the first Sapper is alone; later mixes preserve one Sapper, safe anchors and deterministic Daily rosters', () => {
  let later = 0;
  for (let n = 0; n < 30; n++)
    for (let stage = 0; stage < 20; stage++) {
      const seed = 'sapper-roster-' + n,
        l = getLevel(seed, stage),
        group = l.spawns.filter((s) => s.kind === 'sapper');
      assert.deepEqual(getLevel(seed, stage), l);
      assert(group.length <= 1);
      if (stage === 4) {
        assert.equal(group.length, 1);
        assert(l.sapperIntro);
        const [a, b] = splitWaves(l, seed, stage);
        assert.equal(a.length, 1);
        assert.equal(a[0].kind, 'sapper');
        assert.equal(b.length, l.spawns.length - 1);
      } else assert(!l.sapperIntro);
      if (stage < 4 || stage === 12 || l.boss || l.freight) assert.equal(group.length, 0);
      if (stage > 4) later += group.length;
      for (const s of group) {
        assert(!s.elite);
        assert(
          !l.solids.some(
            (b) =>
              s.x + 15 > b.x &&
              s.x - 15 < b.x + b.w &&
              s.y + 16 > b.y + 0.1 &&
              s.y - 16 < b.y + b.h,
          ),
        );
      }
      const ot = getOvertimeLevel(seed, stage);
      assert(!ot.sapperIntro);
      assert(ot.spawns.filter((s) => s.kind === 'sapper').length <= 1);
    }
  assert(later > 30);
  for (const stage of [2, 6, 10, 14, 18])
    for (const route of ['low', 'high'] as const) {
      const level = getRouteLevel('SAPPER-45', stage, route);
      for (const l of [level, reinforceRoute(level, 'SAPPER-45', stage)]) {
        assert(!l.sapperIntro);
        assert(l.spawns.filter((s) => s.kind === 'sapper').length <= 1);
      }
    }
});
test('the introduction waits for defeat, then gives the complete reinforcement warning and one normal reward', () => {
  const g = new Game();
  g.startTest(sapperTestFromUrl(new URL('https://test/?test=sapper'))!);
  assert.equal(g.enemies.length, 1);
  assert.equal(g.enemies[0].kind, 'sapper');
  g.waves.update(90);
  assert.equal(g.waves.phase, 'opening');
  assert(!g.clear);
  g.enemies[0].spawn = 0;
  g.hitEnemy(g.enemies[0], 9999);
  g.waves.update(1 / 60);
  assert.equal(g.waves.phase, 'warning');
  assert(g.waves.doors.every((d) => d.timer === REINFORCEMENT_TELL));
  assert.equal(g.mode, 'playing');
  assert.equal(g.stage, 4);
  assert.equal(g.mods.length, 4);
});
test('aim tracks early, locks its actual arc, and launches one charge only after the full tell', () => {
  for (const sign of [-1, 1]) {
    const { g, e } = fixture();
    Body.setPosition(e.body, { x: 950, y: 724 });
    Body.setPosition(g.player, { x: 950 + sign * 400, y: 722 });
    e.timer = 0;
    g.sappers.updateEnemy(e);
    assert.equal(e.state, 'windup');
    assert.equal(e.timer, SAPPER_TELL);
    const initial = structuredClone(e.sapper!.arc);
    Body.setPosition(g.player, { x: g.player.position.x + sign * 40, y: 700 });
    e.timer = SAPPER_LOCK + 0.01;
    g.sappers.updateEnemy(e);
    assert.notDeepEqual(e.sapper!.arc, initial);
    const locked = structuredClone(e.sapper!);
    Body.setPosition(g.player, { x: 1000, y: 200 });
    e.timer = 0.01;
    g.sappers.updateEnemy(e);
    assert.deepEqual(e.sapper, locked);
    assert.equal(g.sappers.items.length, 0);
    e.timer = 0;
    g.sappers.updateEnemy(e);
    assert.equal(g.sappers.items.length, 1);
    assert.equal(e.attacks, 1);
    assert.equal(e.state, 'recover');
    const p = g.sappers.items[0];
    assert(distance(p.body.velocity, locked.velocity) < 1e-8);
    assert.equal(p.charge!.at, CHARGE_FUSE);
    g.sappers.updateEnemy(e);
    assert.equal(g.sappers.items.length, 1);
  }
});
test('displacement, portal travel and a blocked muzzle cancel a stale throw', () => {
  const { g, e } = fixture();
  Body.setPosition(g.player, { x: 850, y: 400 });
  e.timer = 0;
  g.sappers.updateEnemy(e);
  assert.equal(e.state, 'windup');
  Body.setPosition(e.body, { x: 450, y: 400 });
  e.timer = 0;
  g.sappers.updateEnemy(e);
  assert.equal(e.state, 'recover');
  assert.equal(g.sappers.items.length, 0);
  e.state = 'idle';
  e.timer = 0;
  g.sappers.updateEnemy(e);
  g.sappers.disrupt(e.body);
  assert.equal(e.sapper!.arc.length, 0);
  assert.equal(e.state, 'recover');
  e.state = 'idle';
  e.timer = 0;
  g.sappers.updateEnemy(e);
  const origin = e.sapper!.origin;
  wall(g, { x: origin.x - 5, y: origin.y - 12, w: 10, h: 24 });
  e.timer = 0;
  g.sappers.updateEnemy(e);
  assert.equal(g.sappers.items.length, 0);
});
test('flight sweeps into a thin ledge, sticks outside its hull, and keeps the last part of the fuse readable', () => {
  const { g, e } = fixture();
  const surface = wall(g, { x: 600, y: 300, w: 2, h: 180 });
  const p = g.sappers.launch(e, { x: 560, y: 372 }, { x: 17, y: 0 })!;
  assert(p);
  p.charge!.at = g.time + 0.05;
  physics(g, 3);
  assert.equal(p.charge!.host, surface);
  assert(p.body.isStatic);
  assert(p.body.isSensor);
  assert(p.body.position.x < 600 - 9);
  assert(p.charge!.at - g.time > 1.16);
  assert(
    !g.solidBodies.includes(p.body),
    'attached charges must not become invisible movement blockers',
  );
  assert.equal(Query.collides(p.body, [surface]).length, 0);
});
test('a real shot knocks a stuck charge away from its wall without restoring the fuse or shooting through it', () => {
  const { g, e } = fixture();
  const surface = wall(g);
  const p = g.sappers.launch(e, { x: 550, y: 372 }, { x: 14, y: 0 })!;
  physics(g, 5);
  assert.equal(p.charge!.host, surface);
  const at = p.charge!.at;
  const s = fire(g, { x: p.body.position.x - 30, y: p.body.position.y });
  assert.equal(s.life, 0);
  assert(!p.body.isStatic);
  assert(!p.body.isSensor);
  assert.equal(p.charge!.host, undefined);
  assert(p.charge!.loose);
  assert(p.body.velocity.x < -8);
  assert.equal(p.charge!.at, at);
  assert(Number.isFinite(p.body.mass));
  assert(Number.isFinite(p.body.inertia));
  physics(g, 6);
  assert(p.body.position.x < 550);
  assert.equal(p.charge!.host, undefined);
});
test('floor charges can be batted toward enemies by either friendly or hostile rounds, without gun-stat scaling', () => {
  for (const friendly of [true, false]) {
    const { g, e } = fixture();
    const p = g.sappers.launch(e, { x: 700, y: 715 }, { x: 0, y: 12 })!;
    physics(g, 3);
    assert(p.charge!.host);
    const at = p.charge!.at;
    fire(
      g,
      { x: 670, y: p.body.position.y },
      { x: 60, y: 0 },
      { friendly, damage: 1000, pierce: 20 },
    );
    assert(p.body.velocity.x > 8 && p.body.velocity.x <= 17);
    assert(p.body.velocity.y < -3);
    assert.equal(p.charge!.at, at);
    assert(g.props.items.includes(p));
    physics(g, 2);
    assert(p.body.position.x > 710);
  }
});
test('rotating props carry attached charges and release them when removed, with no stale host or NaN velocity', () => {
  const { g, e } = fixture();
  const crate = g.props.spawn('crate', 700, 372);
  const p = g.sappers.launch(e, { x: 640, y: 372 }, { x: 14, y: 0 })!;
  physics(g, 5);
  assert.equal(p.charge!.host, crate.body);
  const local = { ...p.charge!.local };
  Body.setPosition(crate.body, { x: 780, y: 420 });
  Body.setAngle(crate.body, Math.PI / 2);
  g.sappers.beforeStep();
  assert(distance(p.body.position, { x: 780 - local.y, y: 420 + local.x }) < 0.01);
  const at = p.charge!.at;
  g.props.remove(crate);
  assert.equal(p.charge!.host, undefined);
  assert(!p.body.isStatic);
  physics(g, 2);
  assert(Number.isFinite(p.body.position.x));
  assert.equal(p.charge!.at, at);
});
test('destroying the host drops its charge instead of erasing it or detonating it early', () => {
  const { g, e } = fixture();
  const surface = wall(g, { x: 600, y: 350, w: 80, h: 130 }, true);
  const p = g.sappers.launch(e, { x: 550, y: 372 }, { x: 14, y: 0 })!;
  physics(g, 5);
  assert.equal(p.charge!.host, surface);
  const at = p.charge!.at;
  g.destruction.hitBody(surface, 200, { x: 1, y: 0 });
  assert(g.props.items.includes(p));
  assert.equal(p.charge!.host, undefined);
  assert.equal(p.charge!.at, at);
});
test('loose charges travel through portals with their real velocity and original fuse, without sticking across the map', () => {
  const { g, e } = fixture();
  g.mods = ['fold'];
  g.gun = getGun(g.mods);
  assert(g.portals.place({ x: 600, y: 740 }));
  assert(g.portals.place({ x: 1100, y: 740 }));
  const p = g.sappers.launch(e, { x: 600, y: 700 }, { x: 0, y: 14 })!;
  const at = p.charge!.at;
  physics(g, 4);
  assert(Math.abs(p.body.position.x - 1100) < 1);
  assert(p.body.velocity.y < 0);
  assert.equal(p.charge!.host, undefined);
  assert.equal(p.charge!.at, at);
});
test('charges collide harmlessly with enemy hulls and players before their warned blast', () => {
  for (const actor of ['enemy', 'player']) {
    const { g, e } = fixture();
    const body =
      actor === 'player' ? g.player : (g.spawnEnemy('shooter', 660, 372), g.enemies.at(-1)!.body);
    Body.setPosition(body, { x: 660, y: 372 });
    const p = g.sappers.launch(e, { x: 600, y: 372 }, { x: 14, y: 0 })!;
    physics(g, 8);
    assert.equal(p.charge!.host, undefined);
    assert.equal(g.hp, 100);
    if (actor === 'enemy') assert.equal(g.enemies.at(-1)!.hp, g.enemies.at(-1)!.maxHp);
    assert(p.body.position.x < body.position.x);
  }
});
test('one explosion breaks exposed weak cover but protects actors and terrain behind that same cover', () => {
  const { g, e } = fixture();
  const front = wall(g, { x: 700, y: 350, w: 40, h: 130 }, true),
    back = wall(g, { x: 795, y: 350, w: 20, h: 130 }, true);
  g.spawnEnemy('shooter', 765, 400);
  const target = g.enemies.at(-1)!;
  target.spawn = 0;
  Body.setPosition(g.player, { x: 765, y: 420 });
  const p = g.sappers.launch(e, { x: 680, y: 400 }, { x: 0, y: 0 })!;
  assert(p);
  g.sappers.detonate(p);
  assert(!g.terrain.includes(front));
  assert(g.terrain.includes(back));
  assert.equal(target.hp, target.maxHp);
  assert.equal(g.hp, 100);
  assert.equal(g.sappers.items.length, 0);
});
test('a returned charge hurts its owner and nearby enemies, stays dangerous to the player and gives no duplicate kills', () => {
  const { g, e } = fixture();
  const p = g.sappers.launch(e, { x: 600, y: 400 }, { x: 0, y: 0 })!;
  Body.setPosition(e.body, { x: 650, y: 400 });
  Body.setPosition(g.player, { x: 550, y: 400 });
  g.spawnEnemy('runner', 650, 450);
  g.enemies.at(-1)!.spawn = 0;
  g.sappers.knock(p, 22, { x: 1, y: 0 });
  g.sappers.detonate(p);
  assert.equal(g.hp, 76);
  assert.equal(g.enemies.length, 0);
  assert.equal(g.kills, 2);
  g.sappers.detonate(p);
  assert.equal(g.kills, 2);
  assert.equal(g.hp, 76);
});
test('bombs respect spawn grace and boss armor without chain-detonating other bombs', () => {
  const { g, e } = fixture();
  const a = g.sappers.launch(e, { x: 600, y: 400 }, { x: 0, y: 0 })!;
  const b = g.sappers.launch(e, { x: 630, y: 450 }, { x: 0, y: 0 })!;
  const at = b.charge!.at;
  g.spawnEnemy('loader', 700, 400);
  const boss = g.enemies.at(-1)!;
  boss.spawn = 0;
  boss.state = 'recover';
  g.spawnEnemy('runner', 660, 340);
  const entering = g.enemies.at(-1)!;
  g.sappers.detonate(a);
  assert.equal(boss.hp, boss.maxHp - 90 * 1.25);
  assert.equal(entering.hp, entering.maxHp);
  assert(g.props.items.includes(b));
  assert.equal(b.charge!.at, at);
});

test('a late gunshot sends a physical charge back into its owner before its fuse expires', () => {
  const { g, e } = fixture();
  g.engine.gravity.y = 1;
  Body.setPosition(e.body, { x: 850, y: 724 });
  Body.setPosition(g.player, { x: 580, y: 722 });
  const p = g.sappers.launch(e, { x: 650, y: 715 }, { x: 0, y: 10 })!;
  physics(g, 4);
  assert(p.charge!.host);
  p.charge!.at = g.time + 0.65;
  const deadline = p.charge!.at;
  fire(g, { x: 620, y: p.body.position.y });
  physics(g, 40);
  assert.equal(p.charge!.at, deadline);
  assert(e.hp <= 0);
  assert.equal(g.kills, 1);
  assert.equal(g.hp, 100);
  assert.equal(g.sappers.items.length, 0);
});
test('the global charge cap holds, and killing the owner does not shorten a remaining bomb’s fuse', () => {
  const { g, e } = fixture();
  for (let i = 0; i < 10; i++) g.sappers.launch(e, { x: 500 + i * 30, y: 372 }, { x: 0, y: 0 });
  assert.equal(g.sappers.items.length, CHARGE_LIMIT);
  g.spawnEnemy('shooter', 1700, 400);
  const at = g.sappers.items[0].charge!.at;
  g.hitEnemy(e, 1000);
  assert.equal(g.sappers.items[0].charge!.at, at);
  assert.equal(g.sappers.items.length, CHARGE_LIMIT);
  physics(g, 160);
  assert.equal(g.sappers.items.length, 0);
});
test('pause and hitstop freeze charges; death, room clears, retries and escape remove them', () => {
  const { g, e } = fixture();
  const p = g.sappers.launch(e, { x: 600, y: 400 }, { x: 5, y: 0 })!;
  const pos = { ...p.body.position },
    at = p.charge!.at,
    time = g.time;
  g.setMode('paused');
  for (let i = 0; i < 200; i++) g.tick(1 / 60, idle);
  assert.equal(g.time, time);
  assert.deepEqual(p.body.position, pos);
  assert.equal(p.charge!.at, at);
  g.setMode('playing');
  g.hitStop = 1;
  g.tick(0.1, idle);
  assert.deepEqual(p.body.position, pos);
  assert.equal(g.time, time);
  g.setMode('dead');
  assert.equal(g.sappers.items.length, 0);
  assert(!Composite.allBodies(g.engine.world).includes(p.body));
  for (const mode of ['room', 'clear']) {
    const { g, e } = fixture();
    const p = g.sappers.launch(e, { x: 600, y: 400 }, { x: 5, y: 0 })!;
    if (mode === 'room') g.loadRoom();
    else {
      g.hitEnemy(e, 9999);
      g.hitStop = 0;
      g.tick(1 / 60, idle);
      assert(g.clear);
    }
    assert.equal(g.sappers.items.length, 0);
    assert(!Composite.allBodies(g.engine.world).includes(p.body));
  }
});
test('test links and Continue preserve saves and reset only room-local charge state', () => {
  const save = sapperTestFromUrl(new URL('https://test/?test=sapper'));
  assert(save);
  assert(loadCheckpoint(save));
  const g = new Game();
  let writes = 0;
  g.onCheckpoint = () => writes++;
  g.onBossDefeated = () => writes++;
  g.startTest(save);
  const layout = structuredClone(g.level);
  g.save();
  g.startTest(g.testRun!);
  assert.deepEqual(g.level, layout);
  assert.equal(writes, 0);
  assert.equal(g.stage, 4);
  for (const seed of ['SAPPER-45', dailyForDate('2026-09-12')!.seed]) {
    const s = testCheckpoint(seed, 4),
      run = new Game();
    run.start(seed, s);
    const expected = run.enemies.map((e) => e.kind);
    let stored: unknown;
    run.onCheckpoint = (s) => (stored = s);
    run.save();
    const cp = loadCheckpoint(stored);
    assert(cp);
    run.start(seed, cp);
    assert.deepEqual(
      run.enemies.map((e) => e.kind),
      expected,
    );
    assert.equal(run.sappers.items.length, 0);
  }
  for (const q of [
    'test=sapper&test=sapper',
    'test=sapper&daily=2026-09-12',
    'test=sapper&mode=overtime',
    'test=sapper&seed=x',
    'test=sapper&area=docks',
  ])
    assert.equal(sapperTestFromUrl(new URL('https://test/?' + q)), null);
});
test('normal movement and a legal four-upgrade gun can defeat the introduction and advance to its next wave', () => {
  const g = new Game();
  g.startTest(sapperTestFromUrl(new URL('https://test/?test=sapper'))!);
  const sapper = g.enemies[0];
  for (let i = 0; i < 3600 && g.mode === 'playing' && sapper.hp > 0; i++) {
    const p = g.player.position,
      target = sapper.body.position,
      dx = target.x - p.x;
    const move = dx > 280 ? 1 : dx < -280 ? -1 : 0;
    const blocked =
      move && Query.ray(g.solidBodies, p, { x: p.x + move * 65, y: p.y }, 26).length > 0;
    const danger = g.sappers.items.some(
      (b) => b.charge!.at - g.time < 1 && distance(p, b.body.position) < 160,
    );
    g.tick(1 / 60, {
      ...idle,
      left: move < 0,
      right: move > 0 || (!move && danger),
      jump: g.grounded && (!!blocked || danger || target.y < p.y - 60),
      fire: true,
      aim: { ...target },
    });
  }
  assert(
    sapper.hp <= 0,
    `Sapper survived: ${sapper.hp}, player ${g.hp}, at ${JSON.stringify(g.player.position)}`,
  );
  assert(g.hp > 0);
  g.hitStop = 0;
  g.tick(1 / 60, idle);
  assert.equal(g.waves.phase, 'warning');
});
