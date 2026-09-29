import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { campingRoom } from '../scripts/boss-camping-audit.ts';
import { PRACTICE_BOSSES, practiceCheckpoint, testEncounterFromUrl } from '../src/practice.ts';
import type { PracticeBoss } from '../src/practice.ts';
import { Game, type Input } from '../src/game.ts';
import { CRANE_SLAM_TELL, CRANE_SWEEP_TELL } from '../src/crane-ai.ts';
import { distance } from '../src/rules.ts';
import { getLevel } from '../src/levels.ts';

const { Body, Query } = Matter;
const originalRandom = Math.random;
test.after(() => {
  Math.random = originalRandom;
});
function step(g: Game, home: number, input: Partial<Input> = {}) {
  const dx = home - g.player.position.x - g.player.velocity.x * 5;
  g.tick(1 / 60, {
    left: dx < -8,
    right: dx > 8,
    jump: false,
    jumpHeld: false,
    fire: true,
    aim: { ...g.enemies[0]?.body.position },
    ...input,
  });
}
function threatened(
  kind: PracticeBoss | 'auditor',
  mirror: boolean,
  pos: { x: number; y: number },
) {
  const { g, e } = campingRoom(kind, mirror);
  Body.setPosition(g.player, pos);
  Body.setVelocity(g.player, { x: 0, y: 0 });
  let taken = 0;
  const damage = g.damagePlayer.bind(g);
  g.damagePlayer = (...args) => {
    const hp = g.hp;
    damage(...args);
    taken += Math.max(0, hp - g.hp);
  };
  for (
    let n = 0;
    n < 2400 && !taken && g.mode === 'playing' && e.hp > 0 && g.enemies.includes(e);
    n++
  )
    step(g, pos.x);
  assert(
    taken > 0,
    `${kind}/${mirror} camp at ${JSON.stringify(pos)}: boss=${e.hp}, state=${e.state}`,
  );
  return { g, e };
}

for (const kind of [...Object.keys(PRACTICE_BOSSES), 'auditor'] as (PracticeBoss | 'auditor')[])
  test(`${kind}: holding fire in either floor corner cannot remain untouched`, () => {
    for (const mirror of kind === 'auditor' ? [false] : [false, true])
      for (const x of [16, 1984]) threatened(kind, mirror, { x, y: 722 });
  });

test('every Crane shelf edge and mirror retains physical head routing and a full primary tell', () => {
  for (const mirror of [false, true]) {
    const base = campingRoom('crane', mirror);
    for (const shelf of base.g.level.solids)
      for (const offset of [20, shelf.w / 2, shelf.w - 20]) {
        const { g, e } = campingRoom('crane', mirror);
        const p = { x: shelf.x + offset, y: shelf.y - 18 };
        if (
          g.solidBodies.some(
            (b) =>
              p.x + 12 > b.bounds.min.x &&
              p.x - 12 < b.bounds.max.x &&
              p.y + 17 > b.bounds.min.y &&
              p.y - 17 < b.bounds.max.y,
          )
        )
          continue;
        Body.setPosition(g.player, p);
        Body.setVelocity(g.player, { x: 0, y: 0 });
        let previous = e.state;
        for (let n = 0; n < 1200 && g.hp === 100; n++) {
          const before = { ...e.crane!.head };
          step(g, p.x, { fire: false });
          assert(distance(before, e.crane!.head) <= 19.1, 'head warped');
          assert(
            Query.collides(e.crane!.body, g.terrain).every((c) => c.depth < 0.2),
            'head clipped terrain',
          );
          if (e.state === 'windup' && previous !== 'windup' && e.attack !== 'flak')
            assert.equal(e.timer, e.attack === 'slam' ? CRANE_SLAM_TELL : CRANE_SWEEP_TELL);
          previous = e.state;
        }
        assert(g.hp < 100, `safe Crane shelf: ${JSON.stringify(p)}, mirror=${mirror}`);
      }
  }
});

test('Crane camping memory freezes with pause and clears when the player relocates or retries', () => {
  const { g, e } = campingRoom('crane', false);
  step(g, g.player.position.x, { fire: false });
  for (let n = 0; n < 60 && !e.crane!.camp; n++) step(g, g.player.position.x, { fire: false });
  const memory = structuredClone(e.crane!.camp);
  assert(memory);
  g.setMode('paused');
  for (let n = 0; n < 60; n++) step(g, g.player.position.x);
  assert.deepEqual(e.crane!.camp, memory);
  g.setMode('playing');
  Body.setPosition(g.player, { x: memory.at.x + 150, y: memory.at.y });
  step(g, memory.at.x + 150, { fire: false });
  assert(e.crane!.camp!.since > memory.since);
  g.start(g.seed, practiceCheckpoint({ kind: 'crane', seed: g.seed })!);
  assert.equal(g.enemies[0].crane!.camp, undefined);
});

test('Crane substitutes a reachable slam when a settled camper blocks the scheduled sweep', () => {
  const { g, e } = campingRoom('crane', true);
  Body.setPosition(g.player, { x: 1260, y: 300 });
  let previous = e.state,
    alternate = false;
  for (let n = 0; n < 900 && g.mode === 'playing'; n++) {
    step(g, 1260, { fire: false });
    if (
      e.state === 'windup' &&
      previous !== 'windup' &&
      e.attack === 'slam' &&
      e.attacks % 2 === 0
    ) {
      assert(g.time - e.crane!.camp!.since >= 3);
      assert.equal(e.timer, CRANE_SLAM_TELL);
      assert(distance(e.crane!.head, e.crane!.from) < 8);
      alternate = true;
      break;
    }
    previous = e.state;
  }
  assert(alternate, 'Crane repeatedly fell back to flak instead of the reachable primary attack');
});

test('Auditor commits to high ledges and pressures the former free-kill cover pocket', () => {
  for (const position of [
    { x: 432, y: 722 },
    { x: 770, y: 412 },
    { x: 1330, y: 402 },
  ])
    threatened('auditor', false, position);
});

test('archived Daily encounters retain their old rules while Practice uses current boss rules', () => {
  for (const rules of [78, 79, 80, 81, 82, 83, 84, 85]) {
    const g = new Game();
    g.start(`RF-D${rules}-2026-09-20`);
    assert.equal(g.adaptiveBosses, rules >= 85);
    g.startPractice({ kind: getLevel(g.seed, 3).spawns[0].kind as PracticeBoss, seed: g.seed });
    assert(g.adaptiveBosses);
  }
});

test('Loader recoil hover and repeated firing on the high ledge cannot interrupt its pursuit forever', () => {
  for (const mirror of [false, true]) {
    const { g, e } = campingRoom('loader', mirror);
    threatened('loader', mirror, { x: e.body.position.x, y: 60 });
    const shelf = g.level.solids[4];
    threatened('loader', mirror, { x: shelf.x + shelf.w / 2, y: shelf.y - 18 });
  }
});

test('Kiln shells reach every grounded shelf camper in both mirrors', () => {
  for (const mirror of [false, true]) {
    const base = campingRoom('kiln', mirror);
    for (const shelf of base.g.level.solids) {
      const { g, e } = campingRoom('kiln', mirror),
        x = shelf.x + shelf.w / 2;
      Body.setPosition(g.player, { x, y: shelf.y - 18 });
      for (let n = 0; n < 1500 && g.hp === 100; n++) step(g, x, { fire: false });
      assert(g.hp < 100, `Kiln shelf ${x}, mirror=${mirror}, state=${e.state}`);
    }
  }
});

test('Turbine breaks loose cover instead of abandoning a boxed-in player', () => {
  const { g, e } = campingRoom('turbine', false);
  Body.setPosition(g.player, { x: 578, y: 722 });
  let taken = 0;
  const damage = g.damagePlayer.bind(g);
  g.damagePlayer = (...args) => {
    const hp = g.hp;
    damage(...args);
    taken += Math.max(0, hp - g.hp);
  };
  for (let n = 0; n < 1800 && taken < 44; n++) step(g, 578, { fire: false });
  assert(taken >= 44 && e.attacks > 0, 'pressure stopped after the first hit');
});

test('Kiln clears low debris and cannot repeat a blocked mortar forever at a cover edge', () => {
  const { g, e } = campingRoom('kiln', false),
    shelf = g.level.solids[3];
  const home = shelf.x + shelf.w / 2;
  Body.setPosition(g.player, { x: home, y: shelf.y - 18 });
  let taken = 0;
  const damage = g.damagePlayer.bind(g);
  g.damagePlayer = (...args) => {
    const hp = g.hp;
    damage(...args);
    taken += Math.max(0, hp - g.hp);
  };
  for (let n = 0; n < 3600 && g.mode === 'playing' && e.hp > 0 && taken < 52; n++) step(g, home);
  assert(taken >= 52, 'Kiln stalled after the first hit while a low prop pinned its treads');
});

test('Crane direct tests select both real mirrors without saving or granting Practice victories', () => {
  for (const mirror of [0, 1]) {
    const entry = testEncounterFromUrl(new URL(`https://test/?test=crane&mirror=${mirror}`));
    assert(entry && entry.kind === 'crane');
    const g = new Game(),
      writes: unknown[] = [],
      victories: unknown[] = [];
    g.onCheckpoint = (value) => writes.push(value);
    g.onBossDefeated = (value) => victories.push(value);
    g.startPractice(entry);
    assert.equal(g.level.mirrored, !!mirror);
    assert.equal(g.enemies[0].kind, 'crane');
    assert.equal(g.mods.length, 3);
    g.hitEnemy(g.enemies[0], 99999);
    assert.deepEqual(writes, []);
    assert.deepEqual(victories, []);
  }
  for (const q of [
    '&mirror=2',
    '&mirror=0&mirror=1',
    '&test=loader',
    '&seed=x',
    '&daily=2026-09-29',
    '&build=x',
  ])
    assert.equal(testEncounterFromUrl(new URL('https://test/?test=crane' + q)), null);
});
