import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import {
  AREA_EVENTS,
  eventTestFromUrl,
  planAreaEvent,
  validAreaEvent,
  type AreaEventKind,
} from '../src/area-events.ts';
import {
  getGun,
  loadCheckpoint,
  MOD_REQUIRES,
  rewardMods,
  seeded,
  type Checkpoint,
} from '../src/rules.ts';
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
function killAll(g: Game) {
  g.waves.clear();
  for (const e of [...g.enemies]) {
    e.spawn = 0;
    g.hitEnemy(e, 99999);
  }
  g.hitStop = 0;
}

test('event plans are deterministic, optional, and limited to one middle area', () => {
  const seen = new Set<string>();
  let absent = 0;
  for (let i = 0; i < 500; i++) {
    const seed = 'event-plan-' + i,
      a = planAreaEvent(seed);
    assert.deepEqual(a, planAreaEvent(seed));
    if (!a) {
      absent++;
      continue;
    }
    seen.add(a.kind + a.area);
    assert(validAreaEvent(a, 0, false));
  }
  assert.equal(seen.size, 9);
  assert(absent > 80 && absent < 180);
});
test('links validate and isolated event runs cannot write saves or boss discoveries', () => {
  for (const kind of Object.keys(AREA_EVENTS) as AreaEventKind[]) {
    const save = preset(kind);
    assert(loadCheckpoint(save));
    const g = new Game();
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.onBossDefeated = () => writes++;
    g.startTest(save);
    assert.equal(g.areaEvents.active, kind);
    killAll(g);
    g.openReward();
    g.chooseMod(g.offers[0].id);
    g.die();
    assert.equal(writes, 0);
  }
  for (const suffix of [
    'event=bogus',
    'event=turf&event=blackout',
    'event=turf&daily=2026-09-16',
    'event=turf&seed=foo',
    'event=turf&test=events',
  ])
    assert.equal(eventTestFromUrl(new URL('https://example.test/?test=events&' + suffix)), null);
});
test('old checkpoints, Workshop, practice, detours and Overtime do not gain event machinery', () => {
  const g = game('blackout');
  g.detour = true;
  g.stage = 6;
  g.loadRoom();
  assert.equal(g.areaEvents.active, null);
  g.startWorkshop(['magnum'], ['magnum']);
  assert.equal(g.areaEvents.active, null);
  const save = preset('blackout');
  delete save.areaEvent;
  g.start(save.seed, save);
  assert.equal(g.areaEvents.state, null);
  g.startTest(preset('blackout'));
  g.overtime = { baseMods: 4, repairs: 0 };
  g.loadRoom();
  assert.equal(g.areaEvents.active, null);
});
test('objectives have clear floor placement across all event areas, routes and seeded layouts', () => {
  for (let i = 0; i < 35; i++)
    for (const area of [1, 2, 3])
      for (const offset of [0, 1, 2]) {
        const save = preset('blackout');
        save.seed = 'event-placement-' + i;
        save.stage = area * 4 + offset;
        save.areaEvent!.area = area;
        const g = new Game();
        g.startTest(save);
        const relay = g.enemies.find((e) => e.eventRole === 'relay')!;
        assert(relay);
        assert.equal(relay.body.bounds.max.y, 740);
        assert.equal(
          Matter.Query.collides(relay.body, g.solidBodies).length,
          0,
          `${g.level.id} ${JSON.stringify(g.areaEvents.site)}`,
        );
        assert.equal(g.enemies.length <= 14, true);
        if (offset === 2)
          for (const route of ['low', 'high'] as const) {
            g.route = route;
            g.loadRoom();
            const r = g.enemies.find((e) => e.eventRole === 'relay')!;
            assert.equal(Matter.Query.collides(r.body, g.solidBodies).length, 0, g.level.id);
          }
      }
});
test('Blackout beam is telegraphed, cover clipped, and cannot repeat damage to a target', () => {
  const g = fixture([]);
  g.areaEvents.state = preset('blackout').areaEvent!;
  g.areaEvents.active = 'blackout';
  const e = target(g, 500, 300);
  e.eventRole = 'relay';
  e.timer = 0;
  Body.setPosition(g.player, { x: 900, y: 300 });
  g.areaEvents.updateEnemy(e, 1 / 60);
  assert(g.areaEvents.beam?.warning);
  const cover = wall(g, 700, 300, 30, 150);
  e.timer = 0;
  g.areaEvents.updateEnemy(e, 1);
  assert.equal(g.areaEvents.beam!.warning, false);
  g.areaEvents.update(1 / 60);
  assert.equal(g.hp, 100);
  Composite.remove(g.engine.world, cover);
  g.terrain = g.terrain.filter((b) => b !== cover);
  g.areaEvents.update(1 / 60);
  assert.equal(g.hp, 81);
  g.hurtAt = -100;
  g.areaEvents.update(1 / 60);
  assert.equal(g.hp, 81);
  g.hitEnemy(e, 1e6);
  assert.equal(g.areaEvents.beam, null);
});
test('relay objectives accept ordinary rounds and beams, and all three earn persistent recovery', () => {
  const g = game('blackout');
  for (const stage of [4, 5, 6]) {
    g.stage = stage;
    g.loadRoom();
    const relay = g.enemies.find((e) => e.eventRole === 'relay')!;
    relay.spawn = 0;
    const p = relay.body.position;
    // An actual primary projectile resolves through Game.updateShots.
    round(g, { pos: { x: p.x - 40, y: p.y }, vel: { x: 25, y: 0 }, damage: 1000 });
    for (let frame = 0; frame < 4; frame++) g.updateShots(1 / 60);
    assert(relay.hp <= 0);
    assert.equal(g.areaEvents.state!.relays.length, stage - 3);
  }
  assert.equal(g.areaEvents.roomHeal, 6);
  g.stage = 8;
  g.loadRoom();
  assert.equal(g.areaEvents.active, null);
  assert.equal(g.areaEvents.roomHeal, 6);
  const beamGame = fixture(['cutting-torch']);
  beamGame.areaEvents.state = preset('blackout').areaEvent!;
  beamGame.areaEvents.active = 'blackout';
  const relay = target(beamGame, 400, 300);
  relay.eventRole = 'relay';
  relay.hp = 40;
  for (let i = 0; i < 120 && relay.hp > 0; i++) {
    beamGame.time += 1 / 60;
    beamGame.torch.beforeStep(1 / 60, true);
    beamGame.torch.afterStep(1 / 60);
  }
  assert(relay.hp <= 0);
});
test('rival fire hits the opposing crew but cannot proc player healing, kills or upgrades', () => {
  const g = fixture(['leech', 'coolant-rounds', 'tether']);
  g.hp = 40;
  const a = target(g, 400, 300);
  a.crew = 0;
  const b = target(g, 600, 300);
  b.crew = 1;
  b.hp = 10;
  g.enemyShot(a, 0, 20, 30);
  for (let i = 0; i < 20; i++) g.updateShots(1 / 60);
  assert(b.hp <= 0);
  assert.equal(g.hp, 40);
  assert.equal(g.kills, 0);
  assert.equal(g.areaEvents.crewKills, 0);
});
test('rival fire respects cover and still threatens the player', () => {
  const g = fixture([]);
  const a = target(g, 400, 300);
  a.crew = 0;
  const b = target(g, 700, 300);
  b.crew = 1;
  b.hp = 100;
  const cover = wall(g, 550, 300, 25, 150);
  g.enemyShot(a, 0, 20, 30);
  for (let i = 0; i < 20; i++) g.updateShots(1 / 60);
  assert.equal(b.hp, 100);
  Composite.remove(g.engine.world, cover);
  g.terrain = g.terrain.filter((t) => t !== cover);
  Body.setPosition(g.player, { x: 550, y: 300 });
  g.enemyShot(a, 0, 20, 30);
  for (let i = 0; i < 20; i++) g.updateShots(1 / 60);
  assert.equal(g.hp, 70);
  assert.equal(b.hp, 100);
});
test('Turf War requires two credited kills and physical collection; salvage is spent once', () => {
  const g = game('turf');
  const crew = g.enemies.filter((e) => e.crew !== undefined);
  assert(crew.length >= 2);
  for (const e of crew.slice(0, 2)) {
    e.spawn = 0;
    g.hitEnemy(e, 99999);
  }
  assert(g.areaEvents.cacheReady);
  assert.equal(g.areaEvents.state!.rerolls, 0);
  Body.setPosition(g.player, g.areaEvents.site);
  g.areaEvents.update(1 / 60);
  g.areaEvents.update(1 / 60);
  assert.equal(g.areaEvents.state!.rerolls, 1);
  assert.deepEqual(g.areaEvents.state!.caches, [4]);
  killAll(g);
  g.openReward();
  g.hp = 1;
  assert(g.canReroll);
  assert(g.rerollReward());
  assert.equal(g.hp, 1);
  assert.equal(g.areaEvents.state!.rerolls, 0);
  assert(!g.rerollReward());
});
test('Daily salvage is healing; Daily still has exactly one predetermined card and no reroll', () => {
  const g = game('turf');
  g.seed = 'RF-D65-2026-09-16';
  g.hp = 40;
  for (const e of g.enemies.filter((e) => e.crew !== undefined)) {
    e.spawn = 0;
    g.hitEnemy(e, 99999);
  }
  Body.setPosition(g.player, g.areaEvents.site);
  g.areaEvents.update(1 / 60);
  assert.equal(g.hp, 56);
  assert.equal(g.areaEvents.state!.rerolls, 0);
  killAll(g);
  g.openReward();
  assert.equal(g.offers.length, 1);
  assert.equal(g.canReroll, false);
});
test('Lockdown hunt is opt-in, warns before arrival, blocks the exit, and cancels later patrols', () => {
  const g = game('lockdown');
  killAll(g);
  g.tick(1 / 60, idle);
  assert(g.clear);
  assert(!g.areaEvents.input(true));
  Body.setPosition(g.player, g.areaEvents.site);
  assert(g.areaEvents.input(true));
  assert(!g.clear);
  assert(g.areaEvents.pending);
  assert(!g.enemies.some((e) => e.eventRole === 'commander'));
  g.time += 1.2;
  g.areaEvents.update(1 / 60);
  const commander = g.enemies.find((e) => e.eventRole === 'commander')!;
  assert(commander);
  assert(!g.areaEvents.pending);
  assert(!g.areaEvents.input(true));
  commander.spawn = 0;
  g.hitEnemy(commander, 99999);
  assert(g.areaEvents.state!.commander);
  g.stage++;
  g.loadRoom();
  const n = g.enemies.length;
  g.time += 20;
  g.areaEvents.update(1 / 60);
  assert.equal(g.enemies.length, n);
  assert(!g.areaEvents.input(true));
});
test('Lockdown patrols are bounded and never spawn over the body cap', () => {
  const g = game('lockdown');
  g.time += 11;
  g.areaEvents.update(1 / 60);
  const n = g.enemies.length;
  assert(g.areaEvents.patrolDone);
  for (let i = 0; i < 100; i++) {
    g.time++;
    g.areaEvents.update(1);
  }
  assert.equal(g.enemies.length, n);
});
test('Clearance favors legal follow-ups, preserves boss salvage and never duplicates a card', () => {
  const g = game('lockdown');
  g.areaEvents.state!.commander = true;
  for (let i = 0; i < 80; i++) {
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
test('event progress survives reward reload and rejects duplicated, future or unrelated claims', () => {
  const g = new Game();
  g.start(preset('blackout').seed, preset('blackout'));
  let save: Checkpoint | null = null;
  g.onCheckpoint = (s) => (save = s);
  killAll(g);
  g.openReward();
  assert(save);
  assert(loadCheckpoint(save));
  const resumed = new Game();
  resumed.start(save.seed, loadCheckpoint(save)!);
  assert.deepEqual(resumed.areaEvents.state, g.areaEvents.state);
  assert.equal(resumed.enemies.length, 0);
  for (const change of [
    { relays: [4, 4] },
    { relays: [4, 5] },
    { caches: [4] },
    { rerolls: 1 },
    { kind: 'bogus' },
  ])
    assert.equal(loadCheckpoint({ ...save, areaEvent: { ...save.areaEvent, ...change } }), null);
  resumed.chooseMod(resumed.offers[0].id);
  assert.equal(resumed.stage, 5);
});
test('event mechanics pause and stop cleanly on death', () => {
  const g = game('lockdown');
  Body.setPosition(g.player, g.areaEvents.site);
  g.clear = true;
  g.areaEvents.input(true);
  g.setMode('paused');
  const time = g.time;
  for (let i = 0; i < 120; i++) g.tick(1 / 60, idle);
  assert.equal(g.time, time);
  assert(!g.enemies.some((e) => e.eventRole === 'commander'));
  g.setMode('playing');
  g.die();
  assert.equal(g.areaEvents.active, null);
  assert(!g.areaEvents.pending);
  assert.equal(g.areaEvents.beam, null);
});

for (const kind of Object.keys(AREA_EVENTS) as AreaEventKind[])
  test(`${kind} test room clears with its four-upgrade gun, normal health and ordinary inputs`, (t) => {
    const common = Matter.Common as typeof Matter.Common & { _nextId: number; _seed: number };
    common._nextId = common._seed = 0;
    const random = Math.random;
    Math.random = seeded('event-pilot');
    t.after(() => {
      Math.random = random;
    });
    const g = game(kind);
    const result = playRoom(g, 75);
    assert(result.clear && result.hp > 0, JSON.stringify(result));
    if (kind === 'blackout') assert.deepEqual(g.areaEvents.state!.relays, [4]);
    if (kind === 'turf') assert(g.areaEvents.cacheReady);
    if (kind === 'lockdown') {
      // Position at the interaction only; the entire commander fight uses inputs.
      Body.setPosition(g.player, g.areaEvents.site);
      Body.setVelocity(g.player, { x: 0, y: 0 });
      g.tick(1 / 60, { ...idle, jump: true });
      assert(g.areaEvents.hunted);
      const hunt = playRoom(g, 50);
      assert(hunt.clear && hunt.hp > 0 && g.areaEvents.state!.commander, JSON.stringify(hunt));
    }
    t.diagnostic(JSON.stringify(result));
  });
