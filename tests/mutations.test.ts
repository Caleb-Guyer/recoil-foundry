import { dailyForDate } from '../src/daily.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import {
  MUTATIONS,
  BLINK_TELL,
  BLINK_RECOVERY,
  GUNNER_TELL,
  mutationTestFromUrl,
  type MutationKind,
} from '../src/mutations.ts';
import { loadCheckpoint, seeded } from '../src/rules.ts';
import { Body, fixture, target, wall, round } from './branches-fixture.ts';
import { playRoom } from './room-pilot.ts';
const kinds = Object.keys(MUTATIONS) as MutationKind[];
const idle = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 300 },
};
function mutated(kind: MutationKind, x = 700, y = 300) {
  const g = fixture([]),
    e = target(g, x, y, MUTATIONS[kind].host);
  if (kind !== 'gunner') Body.setStatic(e.body, false);
  e.hp = e.maxHp = 80;
  e.timer = 0.5;
  g.mutations.decorate(e, kind);
  return { g, e };
}
function preset(kind: MutationKind, turf = false) {
  return mutationTestFromUrl(
    new URL('https://example.test/?test=mutations&mutation=' + kind + (turf ? '&arena=turf' : '')),
  )!;
}
function shell(g: Game, pos = { x: 400, y: 300 }) {
  return round(g, {
    pos,
    friendly: false,
    radius: 7,
    mutationShell: { owner: -1 },
    vel: { x: 20, y: 0 },
  });
}

test('mutations replace existing ordinary troops, are uncommon, and introduce kinds separately', () => {
  const seen = new Set<MutationKind>();
  let rare = 0,
    eligible = 0;
  for (let i = 0; i < 64; i++)
    for (const stage of [0, 1, 2, 4, 5, 6, 9, 10, 13, 14, 17, 18]) {
      const save = { ...preset('splitter'), seed: 'mutation-placement-' + i, stage };
      const g = new Game();
      g.start(save.seed, save);
      const live = g.enemies.filter((e) => e.mutation);
      const reserved = g.waves.doors.filter((d) => d.spawn.mutation);
      const found = [
        ...live.map((e) => e.mutation!.kind),
        ...reserved.map((d) => d.spawn.mutation!),
      ];
      assert(found.length <= 1);
      assert.equal(
        g.enemies.length + g.waves.doors.length,
        g.level.spawns.length,
        'no additional troops',
      );
      for (const kind of found) {
        seen.add(kind);
        assert(stage >= MUTATIONS[kind].stage);
        if ([2, 6, 10].includes(stage)) assert.equal(MUTATIONS[kind].stage, stage);
      }
      assert(live.every((e) => !e.elite && !e.squad && !e.allied && !e.eventRole));
      assert(reserved.every((d) => !d.spawn.elite && !d.spawn.squad));
      if ([5, 9, 13, 14, 17, 18].includes(stage)) {
        eligible++;
        rare += found.length;
      }
    }
  assert.deepEqual([...seen].sort(), [...kinds].sort());
  assert(rare > eligible * 0.04 && rare < eligible * 0.3, String(rare / eligible));
});

test('Turf War occasionally mutates one red without changing its formation or blue allies', () => {
  let mutatedRooms = 0;
  for (let i = 0; i < 60; i++) {
    const save = preset('gunner', true);
    save.seed = 'turf-mutant-' + i;
    const g = new Game();
    g.start(save.seed, save);
    assert.equal(g.enemies.length, 14);
    assert.equal(g.areaEvents.allies.length, 12);
    assert(g.enemies.every((e) => e.body.bounds.min.x >= g.worldWidth / 2));
    assert(
      g.areaEvents.allies.every((e) => !e.mutation && e.body.bounds.max.x <= g.worldWidth / 2),
    );
    const mutants = g.enemies.filter((e) => e.mutation);
    assert(mutants.length <= 1);
    mutatedRooms += mutants.length;
    assert(!g.waves.pending);
  }
  assert(mutatedRooms >= 5 && mutatedRooms <= 25, String(mutatedRooms));
});

test('Splitter produces exactly two small, weaker, non-recursive enemies with physical clearance', () => {
  const { g, e } = mutated('splitter');
  const width = e.body.bounds.max.x - e.body.bounds.min.x;
  g.hitEnemy(e, 9999);
  assert.equal(g.enemies.length, 2);
  assert.equal(g.mutations.pending.length, 0);
  for (const child of [...g.enemies]) {
    assert(child.splitChild && !child.mutation && child.hp < 30);
    assert(child.body.bounds.max.x - child.body.bounds.min.x < width * 0.65);
    assert.equal(
      Matter.Query.collides(child.body, [
        ...g.solidBodies,
        g.player,
        ...g.enemies.filter((a) => a !== child).map((a) => a.body),
      ]).length,
      0,
    );
    child.spawn = 0;
    g.hitEnemy(child, 9999);
  }
  assert.equal(g.enemies.length, 0);
  assert.equal(g.mutations.pending.length, 0);
});

test('a full room can fit both Splitter offspring without dropping either at the ordinary spawn cap', () => {
  const { g, e } = mutated('splitter');
  for (let i = 0; i < 13; i++) target(g, 1000 + i * 45, 500);
  assert.equal(g.enemies.length, 14);
  g.hitEnemy(e, 9999);
  assert.equal(g.enemies.length, 15);
  assert.equal(g.enemies.filter((e) => e.splitChild).length, 2);
});

test('blocked offspring hold the exit and Turf War reward, then resolve without a softlock', () => {
  const { g, e } = mutated('splitter');
  g.areaEvents.active = 'turf';
  g.areaEvents.state = preset('splitter', true).areaEvent!;
  wall(g, 700, 300, 650, 650);
  g.hitEnemy(e, 9999);
  assert.equal(g.mutations.pending.length, 1);
  g.openReward();
  assert.equal(g.mode, 'playing');
  g.areaEvents.update(1 / 60);
  assert(!g.areaEvents.cacheReady);
  g.tick(1 / 60, idle);
  assert(!g.clear);
  g.time += 3.1;
  g.mutations.update();
  g.hitStop = 0;
  g.tick(1 / 60, idle);
  assert(g.clear && g.areaEvents.cacheReady);
});

test('Volatile Gunner locks a readable aim and fires one slow explosive round after its tell', () => {
  const { g, e } = mutated('gunner');
  e.mutation!.timer = 0;
  g.updateEnemy(e, 1 / 60);
  assert.equal(e.mutation!.phase, 'tell');
  const aim = { ...e.aim };
  Body.setPosition(g.player, { x: 400, y: 500 });
  g.updateEnemy(e, GUNNER_TELL - 0.01);
  assert.equal(g.shots.length, 0);
  assert.deepEqual(e.aim, aim);
  g.updateEnemy(e, 0.02);
  assert.equal(g.shots.length, 1);
  assert(g.shots[0].mutationShell && Math.hypot(g.shots[0].vel.x, g.shots[0].vel.y) < 7);
  g.updateEnemy(e, 0.5);
  assert.equal(g.shots.length, 1);
});

test('a blocked gun muzzle cancels the shot instead of firing inside cover', () => {
  const { g, e } = mutated('gunner');
  e.mutation!.timer = 0;
  g.updateEnemy(e, 1 / 60);
  wall(g, 675, 300, 10, 70);
  g.updateEnemy(e, GUNNER_TELL + 0.01);
  assert.equal(g.shots.length, 0);
});

test('a real explosive projectile collides with red troops and its blast harms either side once', () => {
  const g = fixture(['leech']);
  g.hp = 50;
  const red = target(g, 550, 300);
  red.hp = 20;
  const ally = target(g, 520, 360);
  ally.allied = true;
  ally.hp = 100;
  g.enemies = g.enemies.filter((e) => e !== ally);
  g.areaEvents.allies = [ally];
  Body.setPosition(g.player, { x: 500, y: 245 });
  const shot = shell(g);
  for (let i = 0; i < 10; i++) g.updateShots(1 / 60);
  assert(red.hp <= 0);
  assert.equal(ally.hp, 52);
  assert.equal(g.hp, 26);
  assert.equal(g.kills, 0);
  assert.equal(shot.life, 0);
  assert(!shot.mutationShell);
  g.mutations.explode(shot);
  assert.equal(ally.hp, 52);
});

test('explosive rounds stop at walls and the blast cannot damage through cover', () => {
  const g = fixture([]);
  const behind = target(g, 540, 300);
  behind.hp = 100;
  wall(g, 500, 300, 20, 180);
  const shot = shell(g);
  for (let i = 0; i < 10; i++) g.updateShots(1 / 60);
  assert.equal(behind.hp, 100);
  assert(shot.life <= 0);
});

test('hostile explosive fuel chains cannot award player kills or healing', () => {
  const g = fixture(['leech']);
  g.hp = 40;
  Body.setPosition(g.player, { x: 160, y: 100 });
  g.props.spawn('canister', 440, 300);
  g.props.spawn('canister', 550, 300);
  const red = target(g, 630, 300);
  red.hp = 1;
  const ally = target(g, 625, 345);
  ally.allied = true;
  ally.hp = 10;
  g.enemies = g.enemies.filter((e) => e !== ally);
  g.areaEvents.allies = [ally];
  const shot = shell(g, { x: 400, y: 300 });
  g.mutations.explode(shot);
  assert(red.hp <= 0);
  assert(!g.areaEvents.allies.includes(ally), 'hostile fuel chains can hurt blue troops');
  assert.equal(g.hp, 40);
  assert.equal(g.kills, 0);
});

test('Blinker shows its destination for the full tell and cannot fire immediately after moving', () => {
  const { g, e } = mutated('blinker');
  e.mutation!.timer = 0;
  g.updateEnemy(e, 1 / 60);
  const before = { ...e.body.position },
    dest = { ...e.mutation!.destination! };
  assert(Number.isFinite(dest.x));
  assert(Math.hypot(dest.x - before.x, dest.y - before.y) <= 271);
  assert(Math.hypot(dest.x - g.player.position.x, dest.y - g.player.position.y) >= 170);
  g.updateEnemy(e, BLINK_TELL - 0.01);
  assert.deepEqual(e.body.position, before);
  g.updateEnemy(e, 0.02);
  assert.deepEqual(e.body.position, dest);
  assert.equal(e.mutation!.phase, 'recover');
  assert.equal(g.shots.length, 0);
  assert.equal(Matter.Query.collides(e.body, g.solidBodies).length, 0);
  g.updateEnemy(e, BLINK_RECOVERY + 0.01);
  g.updateEnemy(e, 0.4);
  assert.equal(g.shots.length, 0);
});

for (const block of ['crate', 'player', 'enemy'] as const)
  test('Blinker cancels arrival when its marker is occupied by a ' + block, () => {
    const { g, e } = mutated('blinker');
    e.mutation!.timer = 0;
    g.updateEnemy(e, 1 / 60);
    const before = { ...e.body.position },
      p = e.mutation!.destination!;
    if (block === 'crate') g.props.spawn('crate', p.x, p.y);
    else if (block === 'enemy') target(g, p.x, p.y);
    else Body.setPosition(g.player, p);
    g.updateEnemy(e, BLINK_TELL + 0.01);
    assert.deepEqual(e.body.position, before);
    assert.equal(e.mutation!.phase, 'recover');
  });

test('pause freezes tells; death and restart clear pending offspring and teleport markers', () => {
  const { g, e } = mutated('blinker');
  e.mutation!.timer = 0;
  g.updateEnemy(e, 1 / 60);
  const timer = e.mutation!.timer;
  g.setMode('paused');
  for (let i = 0; i < 90; i++) g.tick(1 / 60, idle);
  assert.equal(e.mutation!.timer, timer);
  g.mutations.pending.push({ pos: { x: 700, y: 300 }, left: 2, at: g.time });
  g.die();
  assert.equal(g.mutations.pending.length, 0);
  assert(!e.mutation!.destination);
  g.startTest(preset('splitter'));
  assert.equal(g.mutations.pending.length, 0);
});

test('mutation links reject mixed modes, unknown values and duplicate parameters', () => {
  for (const suffix of [
    'mutation=bogus',
    'mutation=splitter&mutation=gunner',
    'mutation=gunner&arena=no',
    'mutation=gunner&arena=turf&arena=turf',
    'mutation=gunner&daily=2026-09-16',
    'mutation=blinker&seed=foo',
  ])
    assert.equal(
      mutationTestFromUrl(new URL('https://example.test/?test=mutations&' + suffix)),
      null,
    );
});

test('a mutation reserved for wave two survives the actual reinforcement doorway', () => {
  const g = new Game();
  const save = preset('blinker');
  save.seed = 'MUTATION-81-0-blinker';
  g.startTest(save);
  const door = g.waves.doors.find((d) => d.spawn.mutation === 'blinker');
  assert(door);
  for (const e of [...g.enemies]) g.hitEnemy(e, 99999);
  for (let i = 0; i < 120; i++) g.waves.update(1 / 60);
  const e = g.enemies.find((e) => e.mutation?.kind === 'blinker');
  assert(e?.fromDoor && e.spawn > 0, 'door appearance keeps spawn grace and mutation behavior');
});

test('Blinker stays vulnerable during its warning and cannot complete a teleport after being killed', () => {
  const { g, e } = mutated('blinker');
  e.mutation!.timer = 0;
  g.updateEnemy(e, 1 / 60);
  assert(e.mutation!.destination);
  g.hitEnemy(e, 9999);
  const before = { ...e.body.position };
  g.updateEnemy(e, 2);
  assert.deepEqual(e.body.position, before);
  assert(!g.enemies.includes(e));
});

test('ordinary and Daily checkpoints recreate the same mutation without adding save metadata', () => {
  for (const seed of ['mutation-reload', dailyForDate('2026-09-16')!.seed]) {
    const save = { ...preset('splitter'), seed };
    const first = new Game();
    first.start(seed, save);
    const second = new Game();
    second.start(seed, loadCheckpoint(structuredClone(save))!);
    const roster = (g: Game) => [
      ...g.enemies.map((e) => [e.kind, e.mutation?.kind, e.body.position.x, e.body.position.y]),
      ...g.waves.doors.map((d) => [d.spawn.kind, d.spawn.mutation, d.spawn.x, d.spawn.y]),
    ];
    assert.deepEqual(roster(first), roster(second));
  }
});

for (const kind of kinds)
  for (const turf of [false, true])
    test(
      kind +
        (turf ? ' Turf War' : '') +
        ' preset is repeatable, isolated, and playable at normal health',
      (t) => {
        const common = Matter.Common as typeof Matter.Common & { _nextId: number; _seed: number };
        common._nextId = common._seed = 0;
        const random = Math.random;
        Math.random = seeded('mutation-pilot');
        t.after(() => {
          Math.random = random;
        });
        const save = preset(kind, turf);
        assert(loadCheckpoint(save));
        const g = new Game();
        let writes = 0;
        g.onCheckpoint = () => writes++;
        g.onBossDefeated = () => writes++;
        g.startTest(save);
        const snapshot = () => [
          ...g.enemies
            .filter((e) => e.mutation)
            .map((e) => [e.kind, e.mutation!.kind, e.body.position.x, e.body.position.y]),
          ...g.waves.doors
            .filter((d) => d.spawn.mutation)
            .map((d) => [d.spawn.kind, d.spawn.mutation, d.spawn.x, d.spawn.y]),
        ];
        const before = snapshot();
        assert.equal(before.length, 1);
        assert.equal(before[0][1], kind);
        const result = playRoom(g, 90);
        assert(result.clear && result.hp > 0, JSON.stringify(result));
        assert.equal(g.mutations.pending.length, 0);
        if (turf) assert(g.areaEvents.cacheReady);
        g.openReward();
        g.save();
        g.startTest(g.testRun!);
        assert.deepEqual(snapshot(), before);
        assert.equal(writes, 0);
        t.diagnostic(JSON.stringify({ kind, turf, ...result }));
      },
    );
