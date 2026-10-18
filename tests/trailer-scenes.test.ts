import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import {
  actionInput,
  takeQuality,
  usableAction,
  startTake,
  PROMO_TEMPLATES,
} from '../scripts/trailer-scenes.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import { validBuild } from '../src/rules.ts';

const { Body, Bodies, Composite } = Matter;
function fixture() {
  const g = new Game();
  g.start('trailer-driver-regression');
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  Body.setPosition(g.player, { x: 400, y: 720 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.grounded = true;
  const wall = Bodies.rectangle(463, 698, 42, 84, { isStatic: true });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  return g;
}
function enemy(g: Game, x: number, y: number) {
  g.spawnEnemy('shooter', x, y);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.timer = 100;
  return e;
}

test('capture driver crosses cover instead of firing at a nearby hidden enemy', () => {
  const g = fixture();
  enemy(g, 510, 720);
  const first = actionInput(g, 0, 0);
  assert.equal(first.fire, false);
  assert.equal(first.right, true);
  assert.equal(first.jump, true);
  let crossed = false;
  for (let tick = 0; tick < 150; tick++) {
    g.tick(1 / 60, tick ? actionInput(g, tick, 0) : first);
    crossed ||= g.player.position.x > 505;
  }
  assert(crossed, 'ordinary movement and jump inputs must get over the blocking cover');
});

test('capture driver aims at a visible enemy instead of a closer hidden enemy', () => {
  const g = fixture();
  enemy(g, 510, 720);
  const visible = enemy(g, 160, 670);
  const input = actionInput(g, 0, 0);
  assert.deepEqual(input.aim, visible.body.position);
  assert.equal(input.fire, true);
});

test('scout rejects stationary combat even when it has damage and a high action score', () => {
  const frames = Array.from({ length: 144 }, (_, i) => ({
    x: 400 + Math.sin(i) * 2,
    y: 720,
    visible: true,
    blockedFire: false,
    damage: 10,
    score: 100,
  }));
  assert.equal(usableAction(takeQuality(frames), frames.length), false);
});

test('current promotional fixtures preserve all six starting tools and use legal room budgets', () => {
  const captured = new Set<string>();
  for (const template of PROMO_TEMPLATES) {
    assert(validBuild(template.mods));
    assert(template.mods.length <= template.stage);
    const g = startTake({
      ...template,
      seed: 'TRAILER-TOOL-CHECK-' + template.name,
      style: 0,
      start: 0,
      length: 144,
    });
    assert.equal(g.startingGun, 'startingGun' in template ? template.startingGun : 'pistol');
    assert(g.testRun);
    assert.equal(g.hp, 100);
    captured.add(g.startingGun);
  }
  assert.deepEqual([...captured].sort(), [...STARTING_GUN_IDS].sort());
});
