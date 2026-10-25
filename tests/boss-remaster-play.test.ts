import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { bossRemasterTestFromUrl } from '../src/boss-remaster-test.ts';
import { remasterPools } from '../src/boss-remaster-layout.ts';
import { playRoom } from './room-pilot.ts';
import { SorterRemaster, SORTER_REMASTER } from '../src/sorter-remaster.ts';

const DT = 1 / 60;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1000, y: 300 },
};
function fixture(boss: 'condenser' | 'sorter', mirror: boolean) {
  const scene = bossRemasterTestFromUrl(
    new URL(`https://example.test/?test=boss-remaster&boss=${boss}&mirror=${mirror ? 1 : 0}&v=1`),
  );
  assert(scene);
  const g = new Game();
  let checkpointWrites = 0,
    awards = 0;
  g.onCheckpoint = () => {
    checkpointWrites++;
  };
  g.onBossDefeated = () => {
    awards++;
  };
  g.startTest(scene.checkpoint);
  assert.equal(g.level.bossRemaster, boss);
  assert.equal(g.level.mirrored, mirror);
  assert.equal(g.startingGun, 'pistol');
  const e = g.enemies.find((enemy) => enemy.kind === boss)!;
  assert(e);
  assert.equal(e.hp, e.maxHp);
  return { g, e, writes: () => checkpointWrites, awards: () => awards };
}
function assertNativeBounds(g: Game) {
  const b = {
    min: {
      x: Math.min(...g.player.vertices.map((v) => v.x)),
      y: Math.min(...g.player.vertices.map((v) => v.y)),
    },
    max: {
      x: Math.max(...g.player.vertices.map((v) => v.x)),
      y: Math.max(...g.player.vertices.map((v) => v.y)),
    },
  };
  assert([g.hp, b.min.x, b.max.x, b.min.y, b.max.y].every(Number.isFinite));
  assert(b.min.x >= -1 && b.max.x <= g.worldWidth + 1, 'player escaped native side walls');
  assert(b.max.y <= 741, 'player fell through native arena floor');
}

// These are complete fights, using the unchanged ordinary-input room pilot.
// No health, enemy state, terrain, collision or projectile damage is altered.
for (const boss of ['condenser', 'sorter'] as const)
  for (const mirror of [false, true])
    test(`${boss} mirror=${mirror}: earned pistol build clears all three remaster phases through native combat`, () => {
      const { g, e, writes, awards } = fixture(boss, mirror);
      const phases = new Set<number>(),
        arenaPhases = new Set<number>();
      let friendlyRounds = 0,
        hostileRounds = 0;
      const addShot = g.addShot.bind(g);
      g.addShot = (shot) => {
        if (shot.friendly) friendlyRounds++;
        else hostileRounds++;
        return addShot(shot);
      };
      const result = playRoom(g, 180, () => {
        phases.add(e.phase);
        assertNativeBounds(g);
        const visual = g.bossRemaster.visual;
        if (visual?.stage === 'combat') {
          arenaPhases.add(visual.phase);
          if (boss === 'condenser')
            assert.deepEqual(g.level.coolant, remasterPools(visual.phase, mirror));
          for (const cue of visual.warnings) {
            assert(cue.progress >= 0 && cue.progress <= 1);
            if (cue.kind !== 'lane') continue;
            assert(cue.width > 0 && cue.top < cue.bottom);
            assert(cue.x - cue.width / 2 >= 0 && cue.x + cue.width / 2 <= g.worldWidth);
            if (boss === 'condenser') {
              assert.equal(cue.top, 684);
              assert.equal(cue.bottom, 740);
              assert(
                g.level.coolant?.some((p) => p.x === cue.x - cue.width / 2 && p.w === cue.width),
                'rendered front does not match its native coolant span',
              );
            }
          }
        }
        return e.hp <= 0;
      });
      assert(
        e.hp <= 0,
        `native fight failed: player=${g.hp}, boss=${Math.round(e.hp)}, attacks=${e.attacks}`,
      );
      assert(result.hp > 0);
      assert.deepEqual([...phases].sort(), [0, 1, 2]);
      assert.deepEqual([...arenaPhases].sort(), [0, 1, 2]);
      assert(friendlyRounds > 30 && hostileRounds > 10);
      assert(e.attacks >= 4, 'fixture skipped the authored attack sequences');
      assert.equal(g.kills, 1);
      assert.equal(g.bossRemaster.visual?.stage, 'destroyed');
      assert.equal(g.clear, false, 'native room reward skipped the destruction beat');
      const hpAfterKill = g.hp;
      for (let frame = 0; frame < 90; frame++) g.tick(DT, idle);
      assert.equal(g.clear, true);
      assert.equal(g.bossRemaster.visual, null);
      assert.equal(g.hp, hpAfterKill);
      g.save();
      assert.equal(writes(), 0, 'isolated test changed Continue');
      assert.equal(awards(), 0, 'isolated test awarded a campaign boss discovery');
    });

for (const boss of ['condenser', 'sorter'] as const)
  for (const mirror of [false, true])
    test(`${boss} mirror=${mirror}: ordinary running and jumping crosses the real arena without a weapon`, () => {
      const { g, e, writes, awards } = fixture(boss, mirror);
      let highest = g.player.position.y;
      for (
        let frame = 0;
        frame < 720 && g.mode === 'playing' && g.player.position.x < 1810;
        frame++
      ) {
        g.tick(DT, { ...idle, right: true, jump: g.grounded });
        highest = Math.min(highest, g.player.position.y);
        assertNativeBounds(g);
      }
      assert(
        g.player.position.x >= 1810,
        `geometry blocked traversal at ${JSON.stringify(g.player.position)}`,
      );
      assert(highest < 620, 'the route did not exercise its raised paths');
      assert.equal(g.shotCount, 0);
      assert.equal(e.hp, e.maxHp);
      assert.equal(g.hp, 100);
      assert.equal(g.kills, 0);
      assert.equal(writes(), 0);
      assert.equal(awards(), 0);
    });

for (const mirror of [false, true])
  test(`sorter mirror=${mirror}: both low service decks hold a physically settled player safely above the whole floor sweep`, () => {
    for (const deckIndex of [0, 1]) {
      const scene = bossRemasterTestFromUrl(
        new URL(
          `https://example.test/?test=boss-remaster&boss=sorter&phase=2&mirror=${mirror ? 1 : 0}&v=1`,
        ),
      );
      assert(scene);
      const g = new Game();
      let writes = 0,
        awards = 0;
      g.onCheckpoint = () => {
        writes++;
      };
      g.onBossDefeated = () => {
        awards++;
      };
      g.startTest(scene.checkpoint);
      const decks = g.level.solids.filter((s) => s.h >= 100).sort((a, b) => a.x - b.x);
      assert.equal(decks.length, 2);
      const deck = decks[deckIndex];
      assert.equal(deck.y, 620);
      assert.equal(deck.h, 120);
      Matter.Body.setPosition(g.player, { x: deck.x + deck.w / 2, y: deck.y - 48 });
      Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
      assert.equal(g.player.isStatic, false);
      const rig = g.bossRemaster.rig;
      assert(rig instanceof SorterRemaster);
      let swept = false,
        crossedPlayer = false,
        settled = false,
        finished = false;
      for (let frame = 0; frame < 360 && g.mode === 'playing'; frame++) {
        g.tick(DT, idle);
        assertNativeBounds(g);
        const feet = Math.max(...g.player.vertices.map((v) => v.y));
        if (frame === 60) {
          assert(g.grounded, 'native gravity did not settle the player on the deck');
          assert(feet >= deck.y - 0.5 && feet < deck.y + 1);
          settled = true;
        }
        if (rig.move === 'magnet' && rig.state === 'attack') {
          swept = true;
          assert(settled);
          assert(feet < SORTER_REMASTER.sweepTop);
          for (const cue of rig.cues)
            if (
              cue.kind === 'lane' &&
              cue.active &&
              cue.x - cue.width / 2 < g.player.position.x + 13 &&
              cue.x + cue.width / 2 > g.player.position.x - 13
            ) {
              crossedPlayer = true;
              assert.equal(cue.top, SORTER_REMASTER.sweepTop);
              assert(feet < cue.top);
            }
        } else if (swept) {
          finished = true;
          break;
        }
      }
      assert(
        swept && crossedPlayer && finished,
        'the complete real floor sweep did not cross this settled player',
      );
      assert.equal(g.hp, 100, 'a safe deck allowed the floor sweep to damage the player');
      assert.equal(g.shotCount, 0);
      assert.equal(g.kills, 0);
      assert.equal(writes, 0);
      assert.equal(awards, 0);
    }
  });
