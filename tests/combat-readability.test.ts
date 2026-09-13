import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Shot } from '../src/game.ts';
import {
  incomingEdgeCues,
  effectOpacity,
  attackBrace,
  EDGE_CUE_TIME,
} from '../src/combat-readability.ts';

const view = { x: 200, y: 100, w: 800, h: 600 };
const player = { x: 500, y: 400 };
function round(overrides: Partial<Shot> = {}): Shot {
  return {
    id: 1,
    pos: { x: 1100, y: 400 },
    prev: { x: 1108, y: 400 },
    vel: { x: -8, y: 0 },
    damage: 20,
    life: 3,
    friendly: false,
    radius: 5,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: true,
    hits: new Set(),
    banks: 0,
    bankGrowth: 0,
    charged: false,
    launch: { pos: { x: 1200, y: 400 }, at: 0 },
    ...overrides,
  };
}
const cues = (shots: Shot[], solids: Matter.Body[] = [], at = 0.1) =>
  incomingEdgeCues(shots, player, view, at, solids, 28);

test('edge cues mark newly fired incoming shots and merge a volley into one brief flash', () => {
  const shot = round();
  const before = structuredClone(shot);
  const cue = cues([shot])[0];
  assert(cue);
  assert.equal(cue.pos.x, 972);
  assert.equal(cue.pos.y, 400);
  assert.equal(cue.angle, 0);
  assert.equal(cues([shot, round({ id: 2, pos: { x: 1100, y: 408 } })]).length, 1);
  assert(cues([shot], [], 0.35)[0].alpha < cue.alpha);
  assert.equal(cues([shot], [], EDGE_CUE_TIME).length, 0);
  assert.deepEqual(shot, before, 'Rendering must not alter projectile state');
});

test('edge cues omit friendly, reflected, spent, departing, missed and visible attacks', () => {
  for (const change of [
    { friendly: true },
    { friendly: true, reflected: true },
    { life: 0 },
    { life: 0.1 },
    { vel: { x: 8, y: 0 } },
    { vel: { x: 0, y: 0 } },
    { pos: { x: 1100, y: 600 } },
    { pos: { x: 950, y: 400 } },
    { launch: { pos: { x: 950, y: 400 }, at: 0 } },
    { launch: undefined },
  ])
    assert.equal(cues([round(change)]).length, 0, JSON.stringify(change));
});

test('cover suppresses a warning until the actual obstruction moves or is destroyed', () => {
  const wall = Matter.Bodies.rectangle(800, 400, 30, 250, { isStatic: true });
  Matter.Body.setAngle(wall, Math.PI / 9);
  assert.equal(cues([round()], [wall]).length, 0);
  Matter.Body.setPosition(wall, { x: 800, y: 100 });
  assert.equal(cues([round()], [wall]).length, 1);
  assert.equal(cues([round()], []).length, 1);
});

test('edge cues work above, below, left and after the camera moves without leaking enemy locations', () => {
  for (const point of [
    { x: 100, y: 400 },
    { x: 500, y: 0 },
    { x: 500, y: 800 },
  ]) {
    const angle = Math.atan2(player.y - point.y, player.x - point.x);
    const shot = round({
      pos: point,
      launch: { pos: point, at: 0 },
      vel: { x: Math.cos(angle) * 9, y: Math.sin(angle) * 9 },
    });
    const cue = cues([shot])[0];
    assert(cue);
    assert(cue.pos.x >= 228 && cue.pos.x <= 972 && cue.pos.y >= 128 && cue.pos.y <= 672);
  }
  assert.equal(
    incomingEdgeCues([round()], player, { x: 450, y: 100, w: 800, h: 600 }, 0.1, [], 28).length,
    0,
  );
});

test('cosmetic effects fade near bullet paths, retain distant impacts, and do not mutate bullets', () => {
  const shot = round({ pos: { x: 500, y: 400 } });
  assert.equal(effectOpacity({ x: 500, y: 400 }, 3, [shot]), 0.18);
  assert.equal(effectOpacity({ x: 470, y: 400 }, 3, [shot]), 0.18);
  assert.equal(effectOpacity({ x: 500, y: 600 }, 3, [shot]), 1);
  assert.equal(effectOpacity(shot.pos, 40, []), 1);
  assert(effectOpacity({ x: 500, y: 450 }, 3, [shot]) > 0.18);
});

test('hit sounds distinguish armor, exposed damage and kills without changing damage rules', () => {
  const g = new Game();
  g.startWorkshop([]);
  const events: string[] = [];
  g.onSound = (event) => events.push(event);
  const armor = g.enemies.find((e) => e.elite === 'shielded')!;
  const hp = armor.hp;
  assert.equal(
    g.hitEnemy(armor, 20, { x: armor.body.position.x - 100, y: armor.body.position.y }),
    true,
  );
  assert.equal(armor.hp, hp - 2);
  assert.deepEqual(events, ['armor']);
  events.length = 0;
  g.hitEnemy(armor, 20, { x: armor.body.position.x + 100, y: armor.body.position.y });
  assert.equal(armor.hp, hp - 22);
  assert.deepEqual(events, ['hit']);
  events.length = 0;
  g.hitEnemy(armor, 10000);
  assert.deepEqual(events, ['kill']);
  g.spawnEnemy('loader', 800, 300);
  const loader = g.enemies.at(-1)!;
  loader.state = 'windup';
  events.length = 0;
  const armoredHp = loader.hp;
  g.hitEnemy(loader, 100);
  assert.equal(loader.hp, armoredHp - 40);
  assert.deepEqual(events, ['armor']);
  events.length = 0;
  loader.state = 'recover';
  g.hitEnemy(loader, 100);
  assert.equal(loader.hp, armoredHp - 165);
  assert.deepEqual(events, ['hit']);
  events.length = 0;
  g.hitEnemy(loader, 1, undefined, false);
  assert.deepEqual(events, []);
});

test('attack braces show the final windup and never mark idle bosses, Workshop targets or shield turns', () => {
  const g = new Game();
  g.startWorkshop([]);
  assert.equal(attackBrace(g.enemies[0]), 0);
  g.spawnEnemy('loader', 800, 300);
  const enemy = g.enemies.at(-1)!;
  enemy.spawn = 0;
  enemy.state = 'windup';
  enemy.timer = 0.15;
  assert(attackBrace(enemy) > 0);
  enemy.state = 'recover';
  assert.equal(attackBrace(enemy), 0);
  enemy.state = 'idle';
  assert.equal(attackBrace(enemy), 0);
  enemy.state = 'windup';
  enemy.spawn = 0.2;
  assert.equal(attackBrace(enemy), 0);
  enemy.spawn = 0;
  enemy.elite = 'shielded';
  assert.equal(attackBrace(enemy), 0);
});

test('live enemy shots retain their firing origin for cues and room reset clears them', () => {
  const g = new Game();
  g.startWorkshop([]);
  g.spawnEnemy('shooter', 500, 350);
  const enemy = g.enemies.at(-1)!;
  enemy.spawn = 0;
  g.enemyShot(enemy, Math.PI);
  const shot = g.shots.at(-1)!;
  assert.deepEqual(shot.launch, { pos: { ...enemy.body.position }, at: g.time });
  Matter.Body.setPosition(enemy.body, { x: 600, y: 350 });
  assert.equal(shot.launch!.pos.x, 500);
  g.startWorkshop([]);
  assert.equal(g.shots.length, 0);
});
