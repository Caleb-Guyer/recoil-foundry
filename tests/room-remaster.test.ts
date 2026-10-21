import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { getLevel } from '../src/levels.ts';
import { toolroomRoomLevel } from '../src/toolroom-layouts.ts';
import { ROOM_REMASTERS, remasterTestFromUrl, roomRemasterEnabled } from '../src/room-remaster.ts';
import { combatClarity } from '../src/combat-readability.ts';
import { validBuild } from '../src/rules.ts';

const checkpoint = (id: string, extra = '') =>
  remasterTestFromUrl(new URL('https://test/?test=rooms&room=' + id + '&v=1' + extra))!;
const overlap = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.1 &&
  Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.1;
function start(id: string, mirror = false) {
  const g = new Game();
  g.startTest(checkpoint(id, mirror ? '&mirror=1' : ''));
  return g;
}
function clearPatrol(g: Game) {
  for (const e of g.enemies) Matter.Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.areaEvents.clear();
  g.hazards.clear();
}

test('six isolated remaster links reconstruct the authored room, mirrored geometry and legal builds', () => {
  for (const [id, room] of Object.entries(ROOM_REMASTERS))
    for (const mirror of [false, true]) {
      const save = checkpoint(id, mirror ? '&mirror=1' : '');
      assert(save);
      assert(validBuild(save.mods));
      const g = start(id, mirror);
      assert(g.testRun);
      assert(g.level.remastered);
      assert.equal(g.level.id, room.source);
      assert.equal(g.stage, room.stage);
      assert.equal(g.level.area, room.area);
      assert.deepEqual(
        g.level.solids,
        room.solids.map((s) => ({ ...s, x: mirror ? 2000 - s.x - s.w : s.x })),
      );
      assert(g.level.route[0].x < g.level.route.at(-1)!.x);
      const clone = new Game();
      clone.startTest(g.testRun!);
      assert.deepEqual(clone.level, g.level, 'retry reconstructs the same fixture');
    }
  for (const build of ['beam', 'blast']) {
    const g = new Game();
    g.startTest(checkpoint('roof-braces', '&build=' + build + '&gun=shotgun'));
    assert(validBuild(g.mods));
    assert.equal(g.startingGun, 'shotgun');
    assert(g.mods.length <= g.stage);
  }
  for (const suffix of [
    '&gun=bad',
    '&mirror=2',
    '&v=2',
    '&room=overpass',
    '&build=unknown',
    '&seed=custom',
    '&extra=1',
  ])
    assert.equal(
      remasterTestFromUrl(new URL('https://test/?test=rooms&room=overpass&v=1' + suffix)),
      null,
      suffix,
    );
  assert.equal(
    checkpoint('overpass', '&build=beam'),
    null,
    'early fixture cannot grant a late build',
  );
});

test('new Campaigns remaster existing designs while earlier Campaign, Daily and opening layouts retain their rules', () => {
  assert(roomRemasterEnabled('RF-C92-TEST'));
  assert(!roomRemasterEnabled('RF-C91-TEST'));
  assert(!roomRemasterEnabled('RF-D92-2026-10-21'));
  for (let i = 0; i < 40; i++) {
    assert(!getLevel('RF-C92-OPEN-' + i, 0).remastered, 'first room retains its onboarding layout');
    assert(!getLevel('RF-C91-OLD-' + i, 2).remastered);
    assert(!getLevel('RF-D92-2026-10-21', 2).remastered);
  }
  for (const id of ['warm-exchange', 'upper-return', 'scrap-bridge', 'roof-braces'] as const) {
    assert(toolroomRoomLevel(id, 'furnace', 6, 'RF-C92-TEST', true).remastered);
    assert(!toolroomRoomLevel(id, 'furnace', 6, 'RF-C91-TEST', true).remastered);
  }
  assert(
    Array.from({ length: 60 }, (_, i) => getLevel('RF-C92-LAYOUT-' + i, 1)).some(
      (l) => l.id === 'overpass' && l.remastered,
    ),
  );
});

test('mirrored patrol hulls, authored props, entrance and exit have physical clearance', () => {
  for (const id of Object.keys(ROOM_REMASTERS))
    for (const mirror of [false, true]) {
      const g = start(id, mirror),
        actors = [
          { x: 127, y: 662, w: 26, h: 36 },
          { x: 1840, y: 590, w: 160, h: 150 },
          ...g.level.spawns.map((s) => {
            const { w, h } = ENEMY_STATS[s.kind];
            return { x: s.x - w / 2, y: s.y - h / 2, w, h };
          }),
        ];
      const props = g.props.items.map((p) => ({
        x: p.body.bounds.min.x,
        y: p.body.bounds.min.y,
        w: p.body.bounds.max.x - p.body.bounds.min.x,
        h: p.body.bounds.max.y - p.body.bounds.min.y,
      }));
      for (const a of actors)
        for (const s of [...g.level.solids, ...props])
          assert(!overlap(a, s), `${id} ${mirror}: actor intersects cover`);
      for (const p of props)
        for (const s of g.level.solids) assert(!overlap(p, s), `${id}: prop intersects terrain`);
    }
});

test('remastered patrol rooms retain machine and teamwork introductions on valid terrain anchors', () => {
  for (const id of ['warm-exchange', 'upper-return', 'scrap-bridge', 'roof-braces'] as const)
    for (const stage of [6, 10, 14, 18])
      for (const teamwork of [false, true]) {
        const level = toolroomRoomLevel(id, 'furnace', stage, 'RF-C92-ROOM-CHECK', teamwork);
        const intro =
          stage === 6 ? 'shutter' : stage === 10 ? 'strider' : stage === 14 ? 'mortar' : null;
        if (intro) assert(level.spawns.some((s) => s.kind === intro && !s.machineVariant));
        if (teamwork && (stage === 6 || stage === 10)) assert(level.spawns.some((s) => s.teamwork));
        for (const s of level.spawns) {
          const { w, h } = ENEMY_STATS[s.kind],
            a = { x: s.x - w / 2, y: s.y - h / 2, w, h };
          for (const solid of level.solids)
            assert(!overlap(a, solid), `${id} ${stage} ${s.kind} intersects terrain`);
        }
      }
});

test('every remastered ground route is traversable in both directions without shooting or upgrades', () => {
  for (const id of Object.keys(ROOM_REMASTERS))
    for (const reverse of [false, true]) {
      const g = start(id);
      clearPatrol(g);
      Matter.Body.setPosition(g.player, { x: reverse ? 1860 : 140, y: 680 });
      const path = (reverse ? [...g.level.route].reverse() : [...g.level.route]).concat([
        { x: reverse ? 110 : 1890, y: 716 },
      ]);
      let index = 0,
        stuck = 0,
        lastX = g.player.position.x;
      for (let tick = 0; tick < 4200 && index < path.length && g.mode === 'playing'; tick++) {
        const p = g.player.position,
          target = path[index],
          dx = target.x - p.x,
          dy = p.y - target.y;
        if (Math.abs(dx) < 40 && Math.abs(dy) < 65) {
          index++;
          continue;
        }
        stuck = Math.abs(p.x - lastX) < 0.4 ? stuck + 1 : 0;
        lastX = p.x;
        const move = dx > 12 ? 1 : dx < -12 ? -1 : 0;
        const blocked =
          move && Matter.Query.ray(g.solidBodies, p, { x: p.x + move * 70, y: p.y }, 24).length > 0;
        g.tick(1 / 60, {
          left: move < 0,
          right: move > 0,
          jump: g.grounded && (dy > 50 || !!blocked || stuck > 12),
          jumpHeld: true,
          fire: false,
          aim: { x: p.x, y: p.y + 500 },
        });
        if (g.mode === 'upgrade' && !reverse) {
          index = path.length;
          break;
        }
      }
      assert.equal(
        index,
        path.length,
        `${id} ${reverse ? 'reverse' : 'forward'} stopped at ${index} (${g.player.position.x},${g.player.position.y})`,
      );
    }
});

test('a plain pistol reaches every optional upper landing from the entrance using ordinary movement and recoil', () => {
  for (const id of Object.keys(ROOM_REMASTERS))
    for (const mirror of [false, true])
      for (const deck of start(id, mirror).level.solids.filter((s) => s.h === 22)) {
        const g = start(id, mirror);
        clearPatrol(g);
        const launch = deck.x - 55,
          landing = deck.x + 55;
        let phase = 'approach',
          landed = false;
        for (let tick = 0; tick < 3600 && g.mode === 'playing'; tick++) {
          const p = g.player.position;
          if (phase === 'approach' && Math.abs(p.x - launch) < 14) phase = 'rise';
          if (phase === 'rise' && p.y < deck.y - 65) phase = 'land';
          const dx = (phase === 'land' ? landing : launch) - p.x,
            move = dx > 8 ? 1 : dx < -8 ? -1 : 0;
          const blocked =
            move &&
            Matter.Query.ray(g.solidBodies, p, { x: p.x + move * 65, y: p.y }, 24).length > 0;
          g.tick(1 / 60, {
            left: move < 0,
            right: move > 0,
            jump: g.grounded && (phase === 'rise' || !!blocked),
            jumpHeld: true,
            fire: phase === 'rise',
            aim: { x: p.x, y: p.y + 500 },
          });
          if (
            phase === 'land' &&
            g.grounded &&
            Math.abs(g.player.position.x - landing) < 40 &&
            Math.abs(g.player.position.y - (deck.y - 18)) < 12
          ) {
            landed = true;
            break;
          }
        }
        assert(landed, `${id} ${mirror}: could not land at ${deck.x}, ${deck.y}`);
      }
});

test('dense-combat presentation reacts only to visible friendly effects and never mutates the simulation', () => {
  const g = start('upper-return'),
    view = { x: 0, y: 0, w: 2000, h: 900 };
  assert.equal(combatClarity(g, view).pressure, 0);
  g.startTest(checkpoint('upper-return', '&build=beam'));
  clearPatrol(g);
  for (let i = 0; i < 90; i++)
    g.tick(1 / 60, { fire: true, jump: false, jumpHeld: false, aim: { x: 1800, y: 500 } });
  const active = g.torch.segments.length;
  assert(active > 0);
  // Populate real cosmetic records without altering hitboxes or weapon rules.
  for (let i = 0; i < 100; i++)
    g.particles.push({
      pos: { x: 1000, y: 500 },
      vel: { x: 0, y: 0 },
      life: 1,
      max: 1,
      color: '#fff',
      size: 3,
      kind: 'spark',
    });
  const snapshot = () =>
    JSON.stringify({
      hp: g.hp,
      gun: g.gun,
      time: g.time,
      kills: g.kills,
      shots: g.shots,
      segments: g.torch.segments.map((s) => ({ a: s.a, b: s.b, power: s.power })),
      particles: g.particles,
    });
  const before = snapshot();
  const dense = combatClarity(g, view);
  assert(dense.pressure > 0);
  assert(dense.particles < 1);
  assert(dense.glow < 1);
  assert(dense.motion < 1);
  assert.equal(combatClarity(g, { x: 5000, y: 5000, w: 100, h: 100 }).pressure, 0);
  assert.equal(snapshot(), before);
});
