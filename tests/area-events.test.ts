import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import {
  AREA_EVENTS,
  TURF_RED_COUNT,
  TURF_BLUE_COUNT,
  TURF_SPACING,
  eventTestFromUrl,
  planAreaEvent,
  validAreaEvent,
  type AreaEventKind,
} from '../src/area-events.ts';
import { loadCheckpoint, MOD_REQUIRES, rewardMods, seeded, type Checkpoint } from '../src/rules.ts';
import { ENEMY_STATS, enemyHealth } from '../src/enemies.ts';
import { todayDaily } from '../src/daily.ts';
import { freightSelected } from '../src/freight-layout.ts';
import { Body, Composite, fixture, round, target, wall } from './branches-fixture.ts';
import { playRoom } from './room-pilot.ts';
const idle = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 400 },
};
function preset(kind: AreaEventKind) {
  return eventTestFromUrl(new URL('https://example.test/?test=events&event=' + kind))!;
}
function game(kind: AreaEventKind) {
  const g = new Game();
  g.startTest(preset(kind));
  return g;
}
function kill(g: Game, keepBox = false) {
  for (const e of [...g.enemies])
    if (!keepBox || e.eventRole !== 'relay') {
      e.spawn = 0;
      g.hitEnemy(e, 99999);
    }
  g.hitStop = 0;
}
function settle(g: Game, frames = 160) {
  for (let i = 0; i < frames && g.mode === 'playing'; i++) {
    g.hitStop = 0;
    g.tick(1 / 60, idle);
  }
}

test('seeded events remain optional, repeatable and Blackout selects exactly one combat room', () => {
  const seen = new Set<string>();
  let absent = 0;
  for (let i = 0; i < 250; i++) {
    const seed = 'event-plan-' + i,
      a = planAreaEvent(seed);
    assert.deepEqual(a, planAreaEvent(seed));
    if (!a) {
      absent++;
      continue;
    }
    seen.add(a.kind + a.area);
    assert(validAreaEvent(a, 0, false));
    if (a.kind === 'blackout') {
      assert.equal(Math.floor(a.room! / 4), a.area);
      assert(a.room! % 4 < 3);
      assert(!freightSelected(seed, a.room!));
    }
  }
  assert.equal(seen.size, 9);
  assert(absent > 30 && absent < 100);
});
test('all direct links are legal, reject mixed modes, and never write campaign saves or unlocks', () => {
  for (const kind of Object.keys(AREA_EVENTS) as AreaEventKind[]) {
    const save = preset(kind);
    assert(loadCheckpoint(save));
    const g = new Game();
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.onBossDefeated = () => writes++;
    g.startTest(save);
    assert.equal(g.areaEvents.active, kind);
    g.save();
    g.die();
    g.startTest(g.testRun!);
    assert.equal(writes, 0);
    assert.equal(g.hp, 100);
  }
  for (const suffix of [
    'event=bogus',
    'event=turf&event=blackout',
    'event=turf&daily=2026-09-16',
    'event=turf&seed=foo',
  ])
    assert.equal(eventTestFromUrl(new URL('https://example.test/?test=events&' + suffix)), null);
});
test('old checkpoints, Workshop, detours, bosses and Overtime do not gain event encounters', () => {
  const g = game('blackout');
  g.stage = 5;
  g.loadRoom();
  assert.equal(g.areaEvents.active, null);
  g.stage = 6;
  g.detour = true;
  g.loadRoom();
  assert.equal(g.areaEvents.active, null);
  g.startWorkshop(['magnum'], ['magnum']);
  assert.equal(g.areaEvents.active, null);
  const save = preset('blackout');
  delete save.areaEvent;
  g.start(save.seed, save);
  assert.equal(g.areaEvents.state, null);
  g.startTest(preset('turf'));
  g.stage = 7;
  g.loadRoom();
  assert.equal(g.areaEvents.active, null);
  assert.equal(g.areaEvents.allies.length, 0);
  g.stage = 4;
  g.overtime = { baseMods: 4, repairs: 0 };
  g.loadRoom();
  assert.equal(g.areaEvents.active, null);
});
test('event boxes and terminals occupy clear floor across areas, routes and mirrored seeded layouts', () => {
  for (let i = 0; i < 20; i++)
    for (const area of [1, 2, 3])
      for (const offset of [0, 1, 2]) {
        const save = preset('blackout');
        save.seed = 'event-placement-' + i;
        save.stage = area * 4 + offset;
        save.areaEvent!.area = area;
        save.areaEvent!.room = save.stage;
        const g = new Game();
        g.startTest(save);
        if (g.level.freight) {
          assert.equal(g.areaEvents.active, null);
          assert(!g.waves.held);
          continue;
        }
        const box = g.enemies.find((e) => e.eventRole === 'relay')!;
        assert(box);
        assert.equal(box.body.bounds.max.y, 740);
        assert.equal(Matter.Query.collides(box.body, g.solidBodies).length, 0, g.level.id);
        if (offset === 2)
          for (const route of ['low', 'high'] as const) {
            g.route = route;
            g.loadRoom();
            const e = g.enemies.find((e) => e.eventRole === 'relay')!;
            assert.equal(Matter.Query.collides(e.body, g.solidBodies).length, 0, g.level.id);
          }
      }
});
test('events preserve the freight shaft boarding waves and never strand objectives below its lift', () => {
  const seed = Array.from({ length: 100 }, (_, i) => 'event-freight-' + i).find((s) =>
    freightSelected(s, 5),
  )!;
  assert(seed);
  for (const kind of Object.keys(AREA_EVENTS) as AreaEventKind[]) {
    const save = preset(kind);
    save.seed = seed;
    save.stage = 5;
    if (kind === 'blackout') save.areaEvent!.room = 5;
    const g = new Game();
    g.startTest(save);
    assert(g.level.freight && g.freight.active);
    assert.equal(g.areaEvents.active, null);
    assert.equal(g.areaEvents.allies.length, 0);
    assert.equal(g.enemies.length, 0);
    assert.equal(g.waves.doors.length, 7);
    assert(!g.waves.held);
  }
});
test('Blackout holds its reserve indefinitely and a single shot reveals the exit and releases wave two once', () => {
  const g = game('blackout');
  assert(g.areaEvents.dark && g.waves.held && g.waves.pending);
  kill(g, true);
  for (let i = 0; i < 1800; i++) g.waves.update(1 / 60);
  assert.equal(g.waves.phase, 'opening');
  assert(g.waves.doors.every((d) => d.state === 'sealed'));
  g.openReward();
  assert.equal(g.mode, 'playing');
  const box = g.enemies.find((e) => e.eventRole === 'relay')!,
    p = box.body.position;
  round(g, { pos: { x: p.x - 24, y: p.y }, vel: { x: 12, y: 0 }, damage: 1 });
  g.updateShots(1 / 60);
  assert.equal(box.hp, 0);
  assert(!g.areaEvents.dark && !g.waves.held);
  assert.equal(g.waves.phase, 'warning');
  assert.deepEqual(g.areaEvents.state!.relays, [4]);
  assert.equal(g.areaEvents.roomHeal, 6);
  const doors = g.waves.doors.length;
  g.areaEvents.killed(box, true);
  assert.equal(g.waves.doors.length, doors);
  settle(g);
  assert(g.enemies.length > 0);
  assert(!g.clear);
  g.waves.clear();
  kill(g);
  g.tick(1 / 60, idle);
  assert(g.clear);
  g.stage = 5;
  g.loadRoom();
  assert.equal(g.areaEvents.active, null);
  assert(!g.waves.held);
});
test('the power box can also be activated with an actual beam', () => {
  const g = fixture(['cutting-torch']);
  g.areaEvents.active = 'blackout';
  g.areaEvents.state = preset('blackout').areaEvent!;
  g.waves.held = true;
  const box = target(g, 400, 300);
  box.eventRole = 'relay';
  box.hp = 1;
  for (let i = 0; i < 30 && box.hp > 0; i++) {
    g.time += 1 / 60;
    g.torch.beforeStep(1 / 60, true);
    g.torch.afterStep(1 / 60);
  }
  assert(box.hp <= 0);
  assert(g.areaEvents.powered);
  assert(!g.waves.held);
});
test('Turf War starts as a large simultaneous battle with blue allies on the left and no second wave', () => {
  for (let i = 0; i < 12; i++) {
    const save = preset('turf');
    save.seed = 'turf-density-' + i;
    const g = new Game();
    g.startTest(save);
    assert.equal(g.enemies.length, TURF_RED_COUNT, g.level.id);
    assert.equal(g.areaEvents.allies.length, TURF_BLUE_COUNT);
    assert(g.areaEvents.allies.every((e) => e.allied && e.body.bounds.max.x <= g.worldWidth / 2));
    assert.equal(g.waves.doors.length, 0);
    assert(!g.waves.pending);
    for (const e of [...g.enemies, ...g.areaEvents.allies])
      assert.equal(
        Matter.Query.collides(e.body, g.solidBodies).length,
        0,
        g.level.id + ' ' + e.kind,
      );
  }
});
test('Turf War divides territory in half with 14 reds and 12 blues across seeded areas and routes', () => {
  for (let i = 0; i < 12; i++)
    for (const area of [1, 2, 3])
      for (const offset of [0, 1, 2]) {
        const save = preset('turf');
        save.seed = 'turf-spread-' + i;
        save.stage = area * 4 + offset;
        save.areaEvent!.area = area;
        const g = new Game();
        g.startTest(save);
        if (g.level.freight) continue;
        for (const route of offset === 2 ? ([undefined, 'low', 'high'] as const) : [undefined]) {
          if (route) {
            g.route = route;
            g.loadRoom();
          }
          assert.equal(g.enemies.length, TURF_RED_COUNT, g.level.id);
          assert.equal(g.areaEvents.allies.length, TURF_BLUE_COUNT, g.level.id);
          const kinds = new Set(g.areaEvents.allies.map((e) => e.kind));
          assert.deepEqual([...kinds].sort(), ['flyer', 'runner', 'shooter']);
          for (const [index, e] of g.enemies.entries()) {
            assert(e.body.bounds.min.x >= g.worldWidth / 2, g.level.id + ' red crossed midfield');
            assert(
              Math.hypot(
                e.body.position.x - g.player.position.x,
                e.body.position.y - g.player.position.y,
              ) >= 480,
            );
            for (const other of g.enemies.slice(index + 1))
              assert(
                Math.hypot(
                  e.body.position.x - other.body.position.x,
                  e.body.position.y - other.body.position.y,
                ) >=
                  TURF_SPACING - 0.1,
                g.level.id + ' crowded pair',
              );
          }
          assert.equal(g.enemies.length - g.areaEvents.allies.length, 2);
          // Both teams occupy the rear, middle and front of their own half.
          for (const [team, side] of [
            [g.areaEvents.allies, 0],
            [g.enemies, 1],
          ] as const) {
            const width = g.worldWidth / 2;
            for (let lane = 0; lane < 3; lane++) {
              const min = side * width + (lane * width) / 3,
                max = min + width / 3;
              assert(
                team.filter((e) => e.body.position.x >= min && e.body.position.x < max).length >= 2,
                g.level.id + ' empty territory ' + side + ':' + lane,
              );
            }
            for (const [index, e] of team.entries())
              for (const other of team.slice(index + 1))
                assert(
                  Math.hypot(
                    e.body.position.x - other.body.position.x,
                    e.body.position.y - other.body.position.y,
                  ) >=
                    TURF_SPACING - 0.1,
                  'crowded formation',
                );
          }
          for (const e of [...g.enemies, ...g.areaEvents.allies])
            assert.equal(
              Matter.Query.collides(e.body, g.solidBodies).length,
              0,
              g.level.id + ' overlap ' + e.kind,
            );
          for (const e of g.areaEvents.allies) {
            assert(e.body.bounds.max.x <= g.worldWidth / 2);
            assert.equal(e.hp, enemyHealth(e.kind, g.stage));
            assert.equal(e.maxHp, e.hp);
            assert.equal(e.body.isStatic, e.kind === 'shooter');
            if (e.kind !== 'flyer')
              assert(
                Matter.Query.ray(g.terrain, e.body.position, {
                  x: e.body.position.x,
                  y: e.body.position.y + ENEMY_STATS[e.kind].h / 2 + 3,
                }).length,
                'ground unit must have support',
              );
          }
        }
      }
});
test('allied shooters and flyers keep their original single-shot and three-shot attacks', () => {
  for (const kind of ['shooter', 'flyer'] as const) {
    const g = fixture([]);
    g.areaEvents.active = 'turf';
    const ally = target(g, 300, 300, kind);
    ally.allied = true;
    ally.timer = 0;
    ally.aim = { x: 1, y: 0 };
    g.enemies = [];
    g.areaEvents.allies = [ally];
    target(g, 800, 300);
    g.areaEvents.beforeStep(1 / 60);
    assert.equal(g.shots.length, kind === 'shooter' ? 1 : 3);
    assert(g.shots.every((s) => s.allied && !s.friendly && s.damage === 14));
    assert.equal(ally.timer, kind === 'shooter' ? 1.2 : 1.55);
  }
});
test('allied runners use melee against red enemies without hurting the player or awarding kill effects', () => {
  const g = fixture(['leech']);
  g.hp = 40;
  g.areaEvents.active = 'turf';
  const ally = target(g, 400, 300, 'runner');
  ally.allied = true;
  g.enemies = [];
  g.areaEvents.allies = [ally];
  const red = target(g, 425, 300);
  red.hp = 30;
  Body.setPosition(g.player, { x: 400, y: 300 });
  g.updateEnemy(ally, 1 / 60);
  assert.equal(red.hp, 15);
  g.updateEnemy(ally, 1 / 60);
  assert.equal(red.hp, 15, 'contact has a recovery instead of damage every frame');
  g.time += 0.66;
  g.updateEnemy(ally, 1 / 60);
  assert(red.hp <= 0);
  assert.equal(g.hp, 40);
  assert.equal(g.kills, 0);
  assert.equal(g.shots.length, 0);
});
test('allied targeting chooses red enemies and never falls back to the player', () => {
  const g = game('turf');
  const ally = g.areaEvents.allies[0];
  Body.setPosition(ally.body, { x: 180, y: 160 });
  ally.spawn = 0;
  ally.timer = 0;
  const e = g.enemies[0];
  Body.setPosition(e.body, { x: 340, y: 160 });
  e.spawn = 0;
  g.areaEvents.beforeStep(1 / 60);
  const shot = g.shots.find((s) => s.allied)!;
  assert(shot);
  assert(shot.vel.x > 0);
  assert.equal(shot.friendly, false);
  kill(g);
  g.shots = [];
  ally.timer = 0;
  g.areaEvents.beforeStep(1 / 60);
  assert.equal(g.shots.length, 0);
});
test('blue bullets pass the player, damage red enemies, and cannot trigger player kill bonuses', () => {
  const g = fixture(['leech', 'countershot']);
  g.hp = 40;
  const e = target(g, 650, 300);
  e.hp = 10;
  Body.setPosition(g.player, { x: 500, y: 300 });
  round(g, {
    pos: { x: 400, y: 300 },
    vel: { x: 20, y: 0 },
    damage: 30,
    friendly: false,
    allied: true,
  });
  for (let i = 0; i < 20; i++) g.updateShots(1 / 60);
  assert(e.hp <= 0);
  assert.equal(g.hp, 40);
  assert.equal(g.kills, 0);
});
test('player projectiles and beams pass through allies without spending a hit or hurting them', () => {
  for (const beam of [false, true]) {
    const g = fixture(beam ? ['cutting-torch'] : []);
    const ally = target(g, 400, 300);
    ally.allied = true;
    g.enemies = g.enemies.filter((e) => e !== ally);
    g.areaEvents.allies = [ally];
    const enemy = target(g, 550, 300),
      before = enemy.hp,
      alliedHp = ally.hp;
    if (beam)
      for (let i = 0; i < 60; i++) {
        g.time += 1 / 60;
        g.torch.beforeStep(1 / 60, true);
        g.torch.afterStep(1 / 60);
      }
    else {
      round(g, { pos: { x: 300, y: 300 } });
      for (let i = 0; i < 15; i++) g.updateShots(1 / 60);
    }
    assert(enemy.hp < before);
    assert.equal(ally.hp, alliedHp);
    g.hitEnemy(ally, 1e6);
    assert.equal(ally.hp, alliedHp);
    g.fireBackblast({ x: -1, y: 0 }, 9999);
    assert.equal(ally.hp, alliedHp);
  }
});
test('allied fire is blocked by cover and cannot be reflected or consume interception charges', () => {
  const g = fixture(['countershot']);
  const e = target(g, 700, 300);
  wall(g, 550, 300, 30, 180);
  const before = e.hp;
  const shot = round(g, { friendly: false, allied: true });
  assert(!g.ballistics.reflectRound(shot, shot.pos));
  assert(g.ballistics.counterReady);
  for (let i = 0; i < 20; i++) g.updateShots(1 / 60);
  assert.equal(e.hp, before);
  assert(shot.life <= 0);
});
test('red gunmen return fire at closer visible blue allies and respect cover', () => {
  const g = fixture([]);
  g.areaEvents.active = 'turf';
  const red = target(g, 800, 300, 'flyer');
  const ally = target(g, 650, 300);
  ally.allied = true;
  g.enemies = g.enemies.filter((e) => e !== ally);
  g.areaEvents.allies = [ally];
  Body.setPosition(g.player, { x: 1200, y: 300 });
  assert.equal(g.areaEvents.combatTarget(red), ally.body.position);
  red.timer = 1;
  g.updateEnemy(red, 1 / 60);
  assert(red.aim.x < 0);
  wall(g, 720, 300, 25, 180);
  assert.equal(g.areaEvents.combatTarget(red), g.player.position);
  g.areaEvents.active = null;
  assert.equal(g.areaEvents.combatTarget(red), g.player.position);
});
test('blue shots cannot detonate canisters or damage cover beside the player', () => {
  for (const kind of ['canister', 'cover'] as const) {
    const g = fixture([]);
    const prop = g.props.spawn(kind, 500, 300);
    const before = prop.hp;
    const shot = round(g, { friendly: false, allied: true, damage: 9999 });
    for (let i = 0; i < 10; i++) g.updateShots(1 / 60);
    assert.equal(prop.hp, before);
    assert.equal(prop.armedAt, Infinity);
    assert(g.props.items.includes(prop));
    assert.equal(g.hp, 100);
    assert(shot.life <= 0);
  }
});
test('red projectiles can defeat blue allies without awarding kills or blocking the exit', () => {
  const g = fixture([]);
  const ally = target(g, 600, 300);
  ally.allied = true;
  ally.hp = 10;
  g.enemies = [];
  g.areaEvents.allies = [ally];
  round(g, { pos: { x: 400, y: 300 }, vel: { x: 20, y: 0 }, damage: 30, friendly: false });
  for (let i = 0; i < 20; i++) g.updateShots(1 / 60);
  assert.equal(g.areaEvents.allies.length, 0);
  assert.equal(g.kills, 0);
});
test('surviving allies leave after the last red enemy, never need killing, and salvage is collected once', () => {
  const g = game('turf');
  kill(g);
  g.tick(1 / 60, idle);
  assert(g.clear && g.areaEvents.cacheReady);
  assert.notEqual(g.areaEvents.departingAt, null);
  Body.setPosition(g.player, g.areaEvents.site);
  g.areaEvents.update(1 / 60);
  g.areaEvents.update(1 / 60);
  assert.equal(g.areaEvents.state!.rerolls, 1);
  for (let i = 0; i < 190; i++) {
    g.time += 1 / 60;
    g.areaEvents.beforeStep(1 / 60);
  }
  assert.equal(g.areaEvents.allies.length, 0);
  assert(!g.waves.pending);
  g.openReward();
  g.hp = 1;
  assert(g.rerollReward());
  assert.equal(g.hp, 1);
  assert(!g.rerollReward());
});
test('Daily salvage heals and its reward stays one fixed legal card', () => {
  const g = game('turf');
  g.seed = todayDaily().seed;
  g.hp = 40;
  kill(g);
  g.areaEvents.update(1 / 60);
  Body.setPosition(g.player, g.areaEvents.site);
  g.areaEvents.update(1 / 60);
  assert.equal(g.hp, 56);
  assert.equal(g.areaEvents.state!.rerolls, 0);
  g.openReward();
  assert.equal(g.offers.length, 1);
  assert(!g.canReroll);
});
test('Lockdown requires its terminal instead of an automatic second wave, every affected room', () => {
  const g = game('lockdown');
  assert(g.waves.held);
  Body.setPosition(g.player, g.areaEvents.site);
  assert(!g.areaEvents.input(true));
  kill(g);
  for (let i = 0; i < 1800; i++) g.waves.update(1 / 60);
  assert(g.waves.held && g.areaEvents.terminalReady);
  g.tick(1 / 60, idle);
  assert(!g.clear);
  g.openReward();
  assert.equal(g.mode, 'playing');
  assert(g.areaEvents.input(true));
  assert(!g.areaEvents.input(true));
  assert(g.areaEvents.pending && !g.waves.held);
  settle(g);
  const commander = g.enemies.find((e) => e.eventRole === 'commander')!;
  assert(commander);
  assert(g.enemies.length >= 4);
  assert(!g.clear);
  g.waves.clear();
  kill(g);
  g.tick(1 / 60, idle);
  assert(g.clear && g.areaEvents.state!.commander);
  g.stage = 6;
  g.loadRoom();
  assert(g.waves.held);
  kill(g);
  Body.setPosition(g.player, g.areaEvents.site);
  assert(g.areaEvents.input(true));
  settle(g);
  assert(g.enemies.some((e) => e.eventRole === 'commander'));
});
test('Clearance preserves legal follow-ups and boss salvage', () => {
  const g = game('lockdown');
  g.areaEvents.state!.commander = true;
  g.waves.clear();
  kill(g);
  for (let i = 0; i < 25; i++) {
    g.seed = 'clearance-' + i;
    g.openReward();
    assert(g.offers.some((m) => MOD_REQUIRES[m.id]));
    assert.equal(new Set(g.offers.map((m) => m.id)).size, g.offers.length);
    assert(
      g.offers.every((m) =>
        rewardMods(g.mods, 100, seeded('all'), { stage: 4 }).some((a) => a.id === m.id),
      ),
    );
    g.setMode('playing');
  }
  g.stage = 7;
  g.earnedSalvage = 'cinder';
  g.openReward();
  assert.equal(g.offers[0].id, 'cinder');
});
test('event progress survives reward reload; single-room Blackout rejects future or duplicate claims', () => {
  const g = new Game();
  g.start(preset('blackout').seed, preset('blackout'));
  let save: Checkpoint | null = null;
  g.onCheckpoint = (s) => (save = s);
  kill(g);
  g.waves.clear();
  g.openReward();
  assert(save && loadCheckpoint(save));
  const resumed = new Game();
  resumed.start(save.seed, loadCheckpoint(save)!);
  assert.deepEqual(resumed.areaEvents.state, g.areaEvents.state);
  assert(!resumed.areaEvents.dark);
  for (const change of [
    { relays: [4, 4] },
    { relays: [4, 5] },
    { room: 7 },
    { room: 8 },
    { caches: [4] },
    { rerolls: 1 },
  ])
    assert.equal(loadCheckpoint({ ...save, areaEvent: { ...save.areaEvent, ...change } }), null);
  resumed.chooseMod(resumed.offers[0].id);
  assert.equal(resumed.stage, 5);
  assert.equal(resumed.areaEvents.active, null);
});
test('pause freezes terminal arrival and death or restart removes allied bodies and event state', () => {
  const g = game('lockdown');
  kill(g);
  Body.setPosition(g.player, g.areaEvents.site);
  g.areaEvents.input(true);
  g.setMode('paused');
  const time = g.time;
  for (let i = 0; i < 120; i++) g.tick(1 / 60, idle);
  assert.equal(g.time, time);
  assert(!g.enemies.some((e) => e.eventRole === 'commander'));
  g.die();
  assert(!g.areaEvents.pending);
  g.startTest(preset('turf'));
  const bodies = g.areaEvents.allies.map((e) => e.body);
  g.die();
  assert.equal(g.areaEvents.allies.length, 0);
  assert(bodies.every((b) => !Matter.Composite.allBodies(g.engine.world).includes(b)));
});
for (const kind of Object.keys(AREA_EVENTS) as AreaEventKind[])
  test(kind + ' revised encounter clears with normal health and ordinary combat input', (t) => {
    const common = Matter.Common as typeof Matter.Common & { _nextId: number; _seed: number };
    common._nextId = common._seed = 0;
    const random = Math.random;
    Math.random = seeded('event-pilot');
    t.after(() => {
      Math.random = random;
    });
    const g = game(kind);
    if (kind === 'lockdown') {
      const first = playRoom(g, 45, () => g.areaEvents.terminalReady);
      assert(g.areaEvents.terminalReady && g.hp > 0, JSON.stringify(first));
      Body.setPosition(g.player, g.areaEvents.site);
      Body.setVelocity(g.player, { x: 0, y: 0 });
      g.tick(1 / 60, { ...idle, jump: true });
      assert(g.areaEvents.hunted);
    }
    const result = playRoom(g, 90);
    assert(result.clear && result.hp > 0, JSON.stringify(result));
    if (kind === 'blackout') assert(g.areaEvents.powered);
    if (kind === 'lockdown') assert(g.areaEvents.state!.commander);
    if (kind === 'turf') assert(g.areaEvents.cacheReady);
    t.diagnostic(JSON.stringify(result));
  });
