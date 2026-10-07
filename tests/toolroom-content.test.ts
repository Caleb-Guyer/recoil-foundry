import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import { ENEMY_STATS, enemyShielded } from '../src/enemies.ts';
import { PATROL_MACHINES, MACHINE_VARIANTS, MACHINE_VARIANT_IDS } from '../src/patrol-machines.ts';
import { toolroomRoomLevel, TOOLROOM_ROOM_IDS, toolroomLevel } from '../src/toolroom-layouts.ts';
import { toolroomTestFromUrl, TOOLROOM_BUILDS } from '../src/toolroom-test.ts';
import { getLevel } from '../src/levels.ts';
import { PROP_STATS } from '../src/props.ts';
import { splitWaves } from '../src/reinforcements.ts';
import { encounterPlan, shapeEncounter } from '../src/encounter-pacing.ts';
import { fixture, target, wall, round, advance, beam, Body } from './branches-fixture.ts';
import { mortarPoint, mortarImpact, machineAngles } from '../src/patrol-machine-system.ts';
import { enemyArchiveIds, encounterArchive, loadArchive } from '../src/archive.ts';
import { archiveCheckpoint, prepareArchiveEnemy } from '../src/archive-images.ts';
import { logbookCatalog } from '../src/logbook-catalog.ts';
import { loadLogbook } from '../src/logbook.ts';
import { archiveMark } from '../src/archive-art.ts';
import { playRoom } from './room-pilot.ts';
import { LONGEVITY_IDS } from '../src/longevity.ts';
import { newUprising } from '../src/uprising-model.ts';
import { encounterTestFromUrl } from '../src/encounter-test.ts';

test('real Campaign pipeline offers every new layout while leaving the opening unchanged', () => {
  const rooms = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const g = new Game();
    g.start(
      'RF-C89-coverage-' + i,
      undefined,
      null,
      null,
      false,
      0,
      true,
      LONGEVITY_IDS,
      newUprising(),
    );
    assert(!g.level.toolroom && !g.areaEvents.encounter);
    for (const stage of [6, 10, 14, 18]) {
      g.stage = stage;
      g.loadRoom();
      if (g.level.toolroom) rooms.add(g.level.toolroom);
    }
  }
  assert.deepEqual([...rooms].sort(), [...TOOLROOM_ROOM_IDS].sort());
});
test('new evacuation runs require a continuous visible boarding hold; leaving resets it', () => {
  const save = encounterTestFromUrl(
    new URL('https://test/?test=encounters&route=roof-escape&gun=carbine'),
  )!;
  assert(save);
  const g = new Game();
  g.startTest(save);
  const u = g.uprising,
    zone = u.evacuation!;
  assert(zone);
  u.routeStep = u.room!.switches!.length;
  const input = { left: false, right: false, jump: false, fire: false, aim: { x: 1000, y: 700 } };
  Body.setPosition(g.player, {
    x: zone.x + zone.w / 2,
    y: zone.y + zone.h - (g.player.bounds.max.y - g.player.bounds.min.y) / 2,
  });
  g.grounded = true;
  u.update(input, 1 / 60);
  assert.equal(u.boardingProgress, 0);
  assert(!u.outcome);
  g.time += 1;
  u.update(input, 1 / 60);
  near(u.boardingProgress, 0.5);
  Body.translate(g.player, { x: -zone.w, y: 0 });
  u.update(input, 1 / 60);
  assert.equal(u.boardingAt, null);
  Body.translate(g.player, { x: zone.w, y: 0 });
  u.update(input, 1 / 60);
  g.time += 2.01;
  u.update(input, 1 / 60);
  assert.equal(u.outcome?.result, 'success');
});

const near = (a: number, b: number, tolerance = 1e-6) =>
  assert(Math.abs(a - b) < tolerance, `${a} != ${b}`);
test('all nine rooms keep spawn hulls, cover, supports and exits separate across progression and variants', () => {
  const seen = new Set<string>();
  for (const id of TOOLROOM_ROOM_IDS)
    for (const stage of [6, 10, 14, 18])
      for (let i = 0; i < 12; i++) {
        const level = toolroomRoomLevel(id, 'furnace', stage, 'geometry-' + i, true);
        const obstacles = [
          ...level.solids,
          ...level.setpiece!.props.map((p) => {
            const s = PROP_STATS[p.kind];
            return { x: p.x - s.w / 2, y: p.y - s.h / 2, w: s.w, h: s.h };
          }),
        ];
        for (const spawn of level.spawns) {
          const s = ENEMY_STATS[spawn.kind];
          assert(spawn.x - s.w / 2 > 250 && spawn.x + s.w / 2 < 1840, id + spawn.kind);
          assert(
            !obstacles.some(
              (b) =>
                spawn.x + s.w / 2 > b.x + 0.1 &&
                spawn.x - s.w / 2 < b.x + b.w - 0.1 &&
                spawn.y + s.h / 2 > b.y + 0.1 &&
                spawn.y - s.h / 2 < b.y + b.h - 0.1,
            ),
            id + ':' + spawn.kind + ':' + stage,
          );
          if (spawn.machineVariant) {
            assert.equal(MACHINE_VARIANTS[spawn.machineVariant].kind, spawn.kind);
            seen.add(spawn.machineVariant);
          }
        }
        assert(obstacles.every((b) => b.x + b.w < 1830 && b.x > 250));
        if (stage === 6 || stage === 10) {
          const pair = level.spawns.filter((s) => s.teamwork);
          assert.equal(pair.length, 2, id + stage);
          if (stage === 10) assert(pair.some((s) => s.kind === 'shooter' || s.kind === 'flyer'));
        }
        if (level.machineIntro) {
          const [opening, reserve] = splitWaves(level, 'intro', stage);
          assert.equal(opening.length, 1);
          assert.equal(opening[0].kind, level.machineIntro);
          assert(!opening[0].machineVariant);
          shapeEncounter(opening, reserve, level, encounterPlan(level, 'intro', stage));
          assert.equal(opening.length, 1);
        }
      }
  assert.deepEqual([...seen].sort(), [...MACHINE_VARIANT_IDS].sort());
});
test('legacy campaigns keep their layouts; new workrooms begin after zone one and preserve special routes', () => {
  const g = new Game();
  for (const seed of ['RF-C88-history', 'old-run', 'RF-C89-fresh']) {
    g.seed = seed;
    for (let stage = 0; stage < 20; stage++) {
      g.stage = stage;
      const level = getLevel(seed, stage);
      const actual = toolroomLevel(g, level);
      if (seed !== 'RF-C89-fresh' || ![6, 10, 14, 18].includes(stage)) assert.equal(actual, level);
      if (stage < 4) assert(!actual.toolroom);
      for (const flag of [
        'annex',
        'freight',
        'fabricatorIntro',
        'story',
        'shutdown',
        'courier',
      ] as const) {
        const special = { ...level, [flag]: true } as never;
        assert.equal(toolroomLevel(g, special), special);
      }
    }
  }
});
for (const id of [...Object.keys(PATROL_MACHINES), ...MACHINE_VARIANT_IDS])
  test(id + ' locks its warned pattern, then fires and offers an exposed recovery', () => {
    const g = fixture([]),
      info = (MACHINE_VARIANTS as Record<string, { kind: 'shutter' | 'strider' | 'mortar' }>)[id];
    const kind = info?.kind ?? (id as 'shutter' | 'strider' | 'mortar');
    const e = target(g, 700, 300, kind);
    if (info) e.patrol!.variant = id as never;
    e.timer = 0;
    g.updateEnemy(e, 1 / 60);
    assert.equal(e.state, 'windup');
    assert(e.timer >= 0.9);
    e.timer = 0.38;
    const aim = { ...e.aim },
      plans = structuredClone(e.patrol!.arcs);
    Body.setPosition(g.player, { x: 300, y: 380 });
    g.updateEnemy(e, 0.1);
    assert.deepEqual(e.aim, aim);
    assert.deepEqual(e.patrol!.arcs, plans);
    const angles = machineAngles(e);
    e.timer = 0.001;
    g.updateEnemy(e, 0.01);
    if (kind === 'mortar') {
      assert.equal(g.patrolMachines.shells.length, id === 'mortar-twin' ? 2 : 1);
      for (const s of g.patrolMachines.shells) assert(plans.some((arc) => arc.to.x === s.arc.to.x));
      if (id === 'mortar-twin') {
        const [a, b] = g.patrolMachines.shells;
        assert(Math.abs(a.arc.to.x - b.arc.to.x) > a.arc.radius + b.arc.radius + 26);
      }
    } else {
      assert.equal(g.shots.filter((s) => !s.friendly).length, angles.length);
      for (let i = 0; i < angles.length; i++)
        near(Math.sin(Math.atan2(g.shots[i].vel.y, g.shots[i].vel.x) - angles[i]), 0);
    }
    if (id === 'shutter-burst') {
      assert.equal(e.state, 'followup');
      near(e.timer, 0.95);
      e.timer = 0;
      g.updateEnemy(e, 0.01);
      assert.equal(g.shots.length, 2);
    }
    assert.equal(e.state, 'recover');
    assert(e.timer >= 1.3);
    assert(!enemyShielded(e, { x: -e.facing, y: 0 }));
  });
test('Shutter front armor has actual reduced damage, an unprotected flank, and a visible opening at aim lock', () => {
  const g = fixture([]),
    e = target(g, 600, 300, 'shutter');
  e.facing = -1;
  g.hitEnemy(e, 20, { x: 200, y: 300 });
  near(e.hp, 100000 - 6);
  g.hitEnemy(e, 20, { x: 800, y: 300 });
  near(e.hp, 100000 - 26);
  e.state = 'windup';
  e.timer = 0.3;
  assert(!g.hitEnemy(e, 20, { x: 200, y: 300 }));
  near(e.hp, 100000 - 46);
});
test('mortar arcs warn the actual cover impact, shells can be shot or beamed apart, and cleanup is finite', () => {
  const g = fixture([]),
    e = target(g, 700, 300, 'mortar');
  e.timer = 0;
  g.updateEnemy(e, 0.01);
  e.timer = 0;
  g.updateEnemy(e, 0.01);
  const shell = g.patrolMachines.shells[0];
  assert(shell);
  const block = wall(g, 350, 510, 140, 26);
  const predicted = mortarImpact(g, shell.arc);
  assert(predicted.y < 510, 'warning includes raised cover');
  for (let i = 0; i < 240 && g.patrolMachines.shells.length; i++) {
    g.time += 1 / 60;
    g.patrolMachines.tick(1 / 60);
  }
  const blast = g.patrolMachines.blasts[0];
  assert(blast);
  near(blast.pos.x, predicted.x, 2);
  near(blast.pos.y, predicted.y, 2);
  e.timer = 0;
  e.state = 'idle';
  g.updateEnemy(e, 0.01);
  e.timer = 0;
  g.updateEnemy(e, 0.01);
  const next = g.patrolMachines.shells[0];
  assert(next);
  next.pos = { x: 450, y: 300 };
  next.previous = { ...next.pos };
  round(g, { pos: { x: 420, y: 300 }, vel: { x: 40, y: 0 } });
  advance(g, 1);
  assert.equal(g.patrolMachines.shells.length, 0);
  e.state = 'idle';
  e.timer = 0;
  g.updateEnemy(e, 0.01);
  e.timer = 0;
  g.updateEnemy(e, 0.01);
  g.patrolMachines.shells[0].pos = { x: 450, y: 300 };
  g.mods = ['cutting-torch'];
  beam(g, 0.1);
  assert.equal(g.patrolMachines.shells.length, 0);
  g.patrolMachines.clear();
  g.patrolMachines.blasts.push({ pos: block.position, radius: 60, until: g.time + 0.1 });
  g.time += 0.2;
  g.patrolMachines.tick(0.01);
  assert.equal(g.patrolMachines.blasts.length, 0);
  near(mortarPoint(shell.arc, 1).x, shell.arc.to.x);
});
test('new machines and variants use the real enemy renderer and persist individual Logbook discoveries', () => {
  const g = fixture([]);
  for (const id of MACHINE_VARIANT_IDS) {
    const e = prepareArchiveEnemy(g, 'machine:' + id);
    assert.equal(e.patrol?.variant, id);
    assert.equal(e.kind, MACHINE_VARIANTS[id].kind);
    const ids = enemyArchiveIds(e);
    assert(ids.includes('machine:' + id));
    const archive = encounterArchive(null, [...ids, 'room:cover-line']);
    assert(loadArchive(archive).encountered.includes('room:cover-line'));
    const entries = logbookCatalog([], loadLogbook(null), [], archive);
    assert.equal(entries.find((r) => r.id === 'machine:' + id)?.state, 'known');
    assert(archiveMark('machine:' + id).includes('data-archive-image'));
  }
  for (const id of TOOLROOM_ROOM_IDS) {
    g.startTest(archiveCheckpoint('room:' + id));
    assert.equal(g.level.toolroom, id);
  }
});
for (const id of TOOLROOM_ROOM_IDS)
  test('pistol clears ' + id + ' with ordinary input and intact physics', () => {
    const g = new Game();
    g.startTest(
      toolroomTestFromUrl(new URL('https://example.test/?test=toolroom&gun=pistol&room=' + id))!,
    );
    const result = playRoom(g, 90);
    assert(result.clear && result.hp > 0, JSON.stringify({ id, ...result }));
    assert(result.time > 5, 'a full patrol must take more than a five-second sprint');
  });
for (const gun of ['twinbore', 'carbine', 'repeater'])
  for (const build of Object.keys(TOOLROOM_BUILDS).filter((b) => b !== 'native'))
    test(
      gun + ' + ' + build + ' fitting circuit clears its authored patrol through normal controls',
      () => {
        const g = new Game();
        g.startTest(
          toolroomTestFromUrl(
            new URL('https://example.test/?test=toolroom&gun=' + gun + '&build=' + build),
          )!,
        );
        const result = playRoom(g, 90);
        assert(result.clear && result.hp > 0, JSON.stringify({ gun, build, ...result }));
      },
    );
