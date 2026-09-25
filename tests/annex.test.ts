import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Input, type Enemy } from '../src/game.ts';
import { annexTestFromUrl, annexLevel, ANNEX_BUILDS } from '../src/annex-layout.ts';
import { TRANSMISSION } from '../src/annex.ts';
import { SPOOF } from '../src/spoof.ts';
import { MODS, loadCheckpoint } from '../src/rules.ts';
import { Body, Composite, wall, round, advance, beam } from './branches-fixture.ts';
import { playRoom } from './room-pilot.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 900, y: 460 },
};
function preset(build = 'gun', mirror = false) {
  return annexTestFromUrl(
    new URL(`https://example.test/?test=annex&build=${build}&mirror=${mirror ? 1 : 0}`),
  )!;
}
function game(build = 'gun', mirror = false) {
  const g = new Game();
  g.startTest(preset(build, mirror));
  return g;
}
// Collision/provenance fixtures use the real game systems, in an open section
// of the same prototype. Authored-room traversal is tested separately below.
function lab(build = 'gun') {
  const g = game(build);
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.engine.gravity.y = 0;
  Body.setPosition(g.player, { x: 200, y: 300 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  return g;
}
function enemy(g: Game, kind: Enemy['kind'] = 'shooter', x = 600, y = 300, hp = 20) {
  const e = g.spawnEnemy(kind, x, y)!;
  e.spawn = 0;
  e.timer = 100;
  e.hp = e.maxHp = hp;
  Body.setStatic(e.body, true);
  return e;
}
function charge(g: Game) {
  const sender =
    g.enemies.find((e) => e.kind === 'switchman') ?? enemy(g, 'switchman', 1250, 700, 300);
  sender.spawn = 0;
  sender.timer = 100;
  g.annex.readyAt = g.time;
  g.annex.update();
  assert.equal(g.annex.transmission?.phase, 'charging');
  return sender;
}
function finishShot(g: Game) {
  advance(g, 50);
  g.spoof.update();
}
function shoot(g: Game, aim = { x: 600, y: 300 }) {
  g.aim = aim;
  g.shootAt = g.time;
  g.fire();
  finishShot(g);
}

test('Annex links select legal isolated presets, rejecting ambiguous or mixed run modes', () => {
  for (const build of Object.keys(ANNEX_BUILDS))
    for (const mirror of [false, true]) {
      const p = preset(build, mirror);
      assert(loadCheckpoint(p));
      assert.deepEqual(p.mods, [...ANNEX_BUILDS[build as keyof typeof ANNEX_BUILDS], 'spoof']);
      const g = game(build, mirror);
      assert(g.annex.active && g.spoof.equipped);
      assert.equal(g.level.mirrored, mirror);
      assert.equal(g.level.spawns.length, 6);
      assert(!g.waves.pending);
      assert.equal(g.areaEvents.active, null);
      assert.equal(g.breaches.panels.length, 0);
      assert.equal(g.hazards.items.length, 0);
    }
  for (const suffix of [
    '&test=annex',
    '&build=nope',
    '&build=gun&build=beam',
    '&daily=2026-09-24',
    '&mirror=2',
    '&spoof=true',
    '&seed=foo',
    '&spoof=0&spoof=1',
    '&mirror=1&mirror=0',
  ])
    assert.equal(annexTestFromUrl(new URL('https://example.test/?test=annex' + suffix)), null);
  assert.equal(annexTestFromUrl(new URL('https://example.test/?test=other')), null);
  const g = new Game();
  g.start('normal-campaign');
  assert(!g.annex.active && !g.spoof.equipped);
  assert.equal(MODS.length, 105);
  const disabled = preset();
  disabled.annex!.spoof = false;
  disabled.mods = disabled.mods.filter((id) => id !== 'spoof');
  g.startTest(disabled);
  assert(g.annex.active && !g.spoof.equipped);
});

test('both room mirrors have supported shooters, clear entrances and an elevated junction', () => {
  for (const mirror of [false, true]) {
    const l = annexLevel({ mirror, spoof: true }),
      g = game('gun', mirror);
    for (const s of l.spawns) {
      assert(s.x > 400 && s.x < 1700, 'no enemy is placed against the entry');
      if (s.kind === 'shooter')
        assert(l.solids.some((b) => s.x > b.x && s.x < b.x + b.w && Math.abs(b.y - s.y - 17) < 1));
    }
    const j = { ...g.annex.junction },
      p = { ...g.annex.port };
    assert(l.solids.some((b) => j.x > b.x && j.x < b.x + b.w && b.y === 502));
    for (let i = 0; i < 90; i++) g.tick(1 / 60, idle);
    assert.deepEqual(g.annex.junction, j);
    assert.deepEqual(g.annex.port, p);
    assert(g.player.position.x > 0 && g.player.position.y < 740);
  }
});

test('port tracks, locks before firing, and emits only ordinary physical projectiles after its tell', () => {
  const g = lab();
  charge(g);
  const t = g.annex.transmission!,
    first = { ...t.aim };
  Body.setPosition(g.player, { x: 1600, y: 350 });
  g.time += 0.7;
  g.annex.update();
  assert.notDeepEqual(t.aim, first);
  assert.equal(g.shots.length, 0);
  g.time = t.at - TRANSMISSION.lock - 0.01;
  g.annex.update();
  const locked = { ...t.aim };
  Body.setPosition(g.player, { x: 200, y: 500 });
  g.time = t.at - 0.3;
  g.annex.update();
  assert.deepEqual(t.aim, locked);
  assert.equal(g.shots.length, 0);
  g.time = t.at + 0.001;
  g.annex.update();
  assert.equal(g.shots.length, 3);
  assert.equal(g.annex.volleys, 1);
  assert(g.shots.every((s) => !s.friendly && !s.allied && s.damage === 15));
  assert.equal(t.phase, 'cooldown');
});

test('a charged junction absorbs a real gun shot, damages its sender once and cannot be farmed during cooldown', () => {
  const g = lab(),
    sender = charge(g),
    old = sender.hp,
    j = g.annex.junction;
  Body.setPosition(g.player, { x: j.x - 150, y: j.y });
  shoot(g, j);
  assert.equal(g.annex.interruptions, 1);
  assert.equal(sender.hp, old - TRANSMISSION.feedback);
  assert(!g.annex.interrupt());
  shoot(g, j);
  assert.equal(sender.hp, old - TRANSMISSION.feedback);
  g.time = g.annex.transmission!.at + 0.01;
  g.annex.update();
  assert.equal(g.annex.volleys, 0);
  assert.equal(g.spoof.pending.length, 0);
});

test('beam interrupts exposed junctions but ordinary cover blocks both beam and gun hits', () => {
  for (const build of ['gun', 'beam'])
    for (const blocked of [false, true]) {
      const g = lab(build);
      charge(g);
      const j = g.annex.junction;
      Body.setPosition(g.player, { x: j.x - 200, y: j.y });
      g.aim = { ...j };
      if (blocked) wall(g, j.x - 65, j.y, 16, 100);
      if (build === 'beam') beam(g, 0.2);
      else shoot(g, j);
      assert.equal(g.annex.interruptions, blocked ? 0 : 1, build + ' cover=' + blocked);
    }
});

test('primary shell splash interrupts a nearby junction only with an open blast path', () => {
  for (const blocked of [false, true]) {
    const g = lab('shell');
    charge(g);
    const j = g.annex.junction;
    if (blocked) wall(g, j.x - 25, j.y, 12, 100);
    const s = round(g, { pos: { x: j.x - 55, y: j.y }, shell: g.demolition.payload(50) });
    g.demolition.impact(s);
    assert.equal(g.annex.interruptions, blocked ? 0 : 1);
  }
});

test('hostile port rounds hit cover and cannot travel through it into the player', () => {
  const g = lab();
  charge(g);
  const p = g.annex.port;
  Body.setPosition(g.player, { x: p.x + 240, y: p.y });
  g.annex.transmission!.aim = { x: 1, y: 0 };
  wall(g, p.x + 100, p.y, 18, 180);
  g.time = g.annex.transmission!.at + 0.001;
  g.annex.update();
  advance(g, 100);
  assert.equal(g.hp, 100);
  assert.equal(g.shots.length, 0);
});

test('pause and hitstop freeze transmission, reboot lifetime and simulation time', () => {
  const g = game();
  charge(g);
  const ally = g.factions.spawn('runner', { x: 300, y: 710 })!;
  ally.rebootUntil = g.time + 2;
  const before = { time: g.time, deadline: g.annex.transmission!.at, expiry: ally.rebootUntil };
  g.setMode('paused');
  for (let i = 0; i < 200; i++) g.tick(1 / 60, idle);
  assert.equal(g.time, before.time);
  assert.equal(g.annex.transmission!.at, before.deadline);
  assert(g.factions.allies.includes(ally));
  g.setMode('playing');
  g.hitStop = 0.2;
  g.tick(1 / 60, idle);
  assert.equal(g.time, before.time);
  assert.equal(ally.rebootUntil, before.expiry);
});

test('killing the sender cancels its unfinished hostile transmission', () => {
  const g = lab(),
    sender = charge(g);
  enemy(g, 'shooter', 400, 600, 200);
  g.hitEnemy(sender, 99999);
  g.time += 2;
  g.annex.update();
  assert.equal(g.annex.transmission, null);
  assert.equal(g.annex.volleys, 0);
  assert.equal(g.shots.length, 0);
});

for (const build of ['gun', 'beam', 'shell'])
  test(
    build + ' primary damage reboots one defeated original with fresh identity and state',
    () => {
      const g = lab(build),
        victim = enemy(g),
        backup = enemy(g, 'shooter', 1600, 500, 500);
      victim.state = 'windup';
      victim.aim = { x: -1, y: 0 };
      victim.attacks = 7;
      const hp = g.hp;
      if (build === 'beam') {
        g.aim = { ...victim.body.position };
        beam(g, 0.3);
        g.spoof.update();
      } else shoot(g, victim.body.position);
      const ally = g.factions.allies[0];
      assert(ally, build + ' converted an actual weapon kill');
      assert.equal(g.kills, 1);
      assert.equal(g.hp, hp);
      assert.equal(ally.kind, victim.kind);
      assert.notEqual(ally.id, victim.id);
      assert.notEqual(ally.body, victim.body);
      assert.equal(ally.attacks, 0);
      assert(ally.hp > 0);
      assert(ally.rebootUntil! > g.time);
      assert(!g.enemies.includes(ally));
      assert(g.enemies.includes(backup));
      g.time = ally.rebootUntil! + 0.01;
      g.factions.beforeStep(0);
      assert.equal(g.factions.allies.length, 0);
      assert.equal(g.kills, 1);
      assert.equal(g.hp, hp);
    },
  );

test('shell splash kills qualify even when the projectile hits the floor instead of its victim', () => {
  const g = lab('shell'),
    victim = enemy(g, 'runner', 600, 700, 10);
  enemy(g, 'shooter', 1600, 300, 500);
  const s = round(g, { pos: { x: 585, y: 732 }, shell: g.demolition.payload(50) });
  g.demolition.impact(s);
  g.spoof.update();
  assert(victim.hp <= 0);
  assert.equal(g.factions.allies[0]?.kind, 'runner');
  assert.equal(g.kills, 1);
});

test('fragments, reflected rounds, echoes and ally kills never create reboot chains', () => {
  for (const flags of [
    { fragment: true },
    { reflected: true },
    { echo: true },
    { friendly: false, allied: true },
  ]) {
    const g = lab();
    enemy(g);
    enemy(g, 'shooter', 1600, 300, 500);
    round(g, { damage: 100, ...flags });
    finishShot(g);
    assert.equal(g.factions.allies.length, 0);
    assert.equal(g.spoof.reboots, 0);
  }
});

test('elite, summoned and objective enemies are not converted', () => {
  for (const tag of ['elite', 'sentry', 'splitChild', 'eventRole', 'courier']) {
    const g = lab(),
      e = enemy(g);
    enemy(g, 'shooter', 1600, 300, 500);
    Object.assign(
      e,
      tag === 'elite'
        ? { elite: 'twin' }
        : tag === 'eventRole'
          ? { eventRole: 'commander' }
          : { [tag]: true },
    );
    shoot(g, e.body.position);
    assert.equal(g.factions.allies.length, 0, tag);
    assert.equal(g.spoof.reboots, 0, tag);
  }
});

test('Spoof enforces cooldown, one concurrent ally and a finite per-room conversion budget', () => {
  const g = lab();
  enemy(g, 'shooter', 1700, 600, 1000);
  const kill = () => {
    const e = enemy(g);
    round(g, { damage: 100 });
    finishShot(g);
    return e;
  };
  kill();
  assert.equal(g.factions.allies.length, 1);
  kill();
  assert.equal(g.spoof.reboots, 1);
  g.factions.removeAlly(g.factions.allies[0]);
  kill();
  assert.equal(g.spoof.reboots, 1);
  for (let i = 1; i < SPOOF.roomLimit; i++) {
    g.time = g.spoof.readyAt + 0.01;
    kill();
    assert.equal(g.spoof.reboots, i + 1);
    g.factions.removeAlly(g.factions.allies[0]);
  }
  g.time = g.spoof.readyAt + 0.01;
  kill();
  assert.equal(g.spoof.reboots, SPOOF.roomLimit);
  assert.equal(g.factions.allies.length, 0);
});

test('friendly gunfire, beam and explosions cannot hurt rebooted allies', () => {
  for (const build of ['gun', 'beam', 'shell']) {
    const g = lab(build);
    enemy(g, 'shooter', 1600, 600, 1000);
    const a = g.factions.spawn('shooter', { x: 600, y: 300 })!;
    a.spawn = 0;
    const hp = a.hp;
    if (build === 'beam') {
      g.aim = { ...a.body.position };
      beam(g, 0.5);
    } else shoot(g, a.body.position);
    if (build === 'shell')
      g.demolition.impact(
        round(g, { pos: { ...a.body.position }, shell: g.demolition.payload(200) }),
      );
    assert.equal(a.hp, hp, build);
    assert.equal(g.hp, 100);
  }
});

test('blue Switchman ports aim at reds, ignore the player, and keep ordinary cover collision', () => {
  const g = lab(),
    p = g.annex.port;
  const ally = g.factions.spawn('switchman', { x: p.x, y: 680 })!;
  ally.spawn = 0;
  ally.rebootUntil = 100;
  const target = enemy(g, 'shooter', p.x + 260, p.y, 200);
  Body.setPosition(g.player, { x: p.x + 110, y: p.y });
  g.annex.readyAt = 0;
  g.annex.update();
  assert.equal(g.annex.transmission?.owner, ally);
  assert(!g.annex.interrupt());
  g.time = g.annex.transmission!.at + 0.01;
  g.annex.update();
  assert(g.shots.length === 3 && g.shots.every((s) => s.allied && !s.friendly));
  advance(g, 70);
  assert.equal(g.hp, 100);
  assert(target.hp < 200);
  assert.equal(g.spoof.reboots, 0);
});

test('boss feedback uses actual damage, is capped and does not feed itself or convert bosses', () => {
  const g = lab(),
    boss = enemy(g, 'loader', 600, 300, 10000);
  boss.state = 'idle';
  round(g, { damage: 100 });
  advance(g, 20);
  const feedback = g.spoof.feedback.get(boss.id)!;
  assert(feedback);
  assert(Math.abs(feedback.damage - 4.8) < 1e-6, '12% of the armored 40 damage');
  for (let i = 0; i < 20; i++) {
    round(g, { damage: 100 });
    advance(g, 20);
  }
  assert.equal(feedback.damage, 24);
  const before = boss.hp;
  g.time = feedback.at + 0.01;
  g.spoof.update();
  assert(boss.hp < before);
  assert.equal(g.spoof.feedback.size, 0);
  assert.equal(g.factions.allies.length, 0);
  g.time += 10;
  g.spoof.update();
  assert.equal(g.spoof.feedback.size, 0);
});

test('combat clear removes allies and the normal exit completes exactly this prototype room', () => {
  const g = game(),
    ally = g.factions.spawn('shooter', { x: 200, y: 680 })!;
  ally.rebootUntil = 100;
  for (const e of [...g.enemies]) {
    e.spawn = 0;
    g.hitEnemy(e, 99999);
  }
  g.hitStop = 0;
  g.tick(1 / 60, idle);
  assert(g.clear);
  assert.equal(g.factions.allies.length, 0);
  assert.equal(g.annex.transmission, null);
  g.openReward();
  assert.equal(g.mode, 'won');
  assert.equal(g.stage, 8);
  assert.equal(g.offers.length, 0);
});

test('death, menu and retry remove all prototype transients without writing saves or discoveries', () => {
  const g = new Game();
  let writes = 0;
  g.onCheckpoint = () => writes++;
  g.onBossDefeated = () => writes++;
  g.onEnemyDefeated = () => writes++;
  g.onCommendation = () => writes++;
  for (const mode of ['dead', 'title'] as const) {
    g.startTest(preset());
    charge(g);
    const ally = g.factions.spawn('runner', { x: 300, y: 710 })!;
    ally.rebootUntil = 50;
    g.spoof.pending = [{ kind: 'runner', pos: { x: 400, y: 700 } }];
    const victim = g.enemies.find((e) => e.kind === 'runner')!;
    victim.spawn = 0;
    g.hitEnemy(victim, 99999);
    g.setMode(mode);
    assert.equal(g.annex.transmission, null);
    assert.equal(g.spoof.pending.length, 0);
    assert.equal(g.factions.allies.length, 0);
    g.save();
    assert(!Composite.allBodies(g.engine.world).includes(ally.body));
  }
  g.startTest(preset());
  const bodies = Composite.allBodies(g.engine.world).length;
  for (let i = 0; i < 15; i++) g.startTest(preset());
  assert.equal(g.enemies.length, 6);
  assert.equal(Composite.allBodies(g.engine.world).length, bodies);
  assert.equal(g.shots.length, 0);
  assert.equal(writes, 0);
  g.start('back-to-campaign');
  assert(!g.annex.active && !g.spoof.equipped);
});

for (const build of Object.keys(ANNEX_BUILDS))
  for (const mirror of [false, true])
    test(`ordinary-input pilot clears ${build}, mirror=${mirror}, with unmodified health and AI`, () => {
      const g = game(build, mirror);
      let reboots = 0;
      const result = playRoom(g, 100, () => {
        reboots = Math.max(reboots, g.spoof.reboots);
        return false;
      });
      assert(result.clear && result.hp > 0, JSON.stringify(result));
      assert(reboots > 0, 'the equipped prototype actually reboots a machine during combat');
      assert(g.annex.volleys > 0, 'the port fired during the encounter');
      assert(result.shots > 0);
      assert.equal(g.enemies.length, 0);
      assert.equal(g.factions.allies.length, 0);
    });
