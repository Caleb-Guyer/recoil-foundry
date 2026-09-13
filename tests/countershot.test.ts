import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input, type Shot } from '../src/game.ts';
import { validBuild, loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import { COUNTERSHOT_TEST_BUILDS, countershotTestFromUrl } from '../src/practice.ts';
import { dodgePilot } from './combat-pilot.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 400 },
};
const link = (build = 'barrage', mirror = false) =>
  new URL(`https://test/?test=countershot&build=${build}&mirror=${Number(mirror)}`);

test('Countershot boss presets are legal, mirrored, isolated and restart at full health with a ready charge', () => {
  for (const build of Object.keys(COUNTERSHOT_TEST_BUILDS))
    for (const mirror of [false, true]) {
      const save = countershotTestFromUrl(link(build, mirror))!;
      assert(validBuild(save.mods));
      assert(loadCheckpoint(save));
      assert.equal(save.mods.length, 19);
      const g = new Game(),
        writes: (Checkpoint | null)[] = [],
        victories: string[] = [];
      g.onCheckpoint = (value) => writes.push(value);
      g.onBossDefeated = (kind) => victories.push(kind);
      g.start('saved-before-countershot');
      const previous = structuredClone(writes);
      g.startTest(save);
      assert.equal(g.stage, 19);
      assert.equal(g.level.mirrored, mirror);
      assert.equal(g.enemies[0].kind, 'interceptor');
      assert.equal(g.hp, 100);
      assert(g.ballistics.counterReady);
      g.hp = 1;
      g.die();
      g.startTest(g.testRun!);
      assert.equal(g.hp, 100);
      assert(g.ballistics.counterReady);
      g.enemies[0].spawn = 0;
      g.hitEnemy(g.enemies[0], 999999);
      g.save();
      assert.deepEqual(writes, previous);
      assert.deepEqual(victories, []);
    }
  const base = countershotTestFromUrl(new URL('https://test/?test=countershot'))!;
  assert.deepEqual(base, countershotTestFromUrl(new URL('https://test/?test=countershot')));
  for (const suffix of [
    '&daily=2026-09-13',
    '&dv=55',
    '&seed=x',
    '&area=rooftops',
    '&build=unknown',
    '&build=torch&build=barrage',
    '&mirror=2',
    '&mirror=0&mirror=1',
    '&test=interceptor',
  ])
    assert.equal(
      countershotTestFromUrl(new URL('https://test/?test=countershot' + suffix)),
      null,
      suffix,
    );
});

for (const build of ['barrage', 'precision', 'torch']) {
  test(`holding fire cannot repeatedly deflect the final boss with ${build}`, () => {
    for (const mirror of [false, true]) {
      const g = new Game();
      g.startTest(countershotTestFromUrl(link(build, mirror))!);
      const boss = g.enemies[0],
        x = mirror ? 1260 : 740;
      Matter.Body.setPosition(g.player, { x, y: 722 });
      Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
      const reflected = new Set<Shot>();
      let damage = 0;
      const hurt = g.damagePlayer.bind(g);
      g.damagePlayer = (amount, source) => {
        const before = g.hp;
        hurt(amount, source);
        damage += before - g.hp;
      };
      for (let frame = 0; frame < 60 * 60 && g.mode === 'playing' && boss.hp > 0; frame++) {
        const correction = x - g.player.position.x - g.player.velocity.x * 5;
        g.tick(1 / 60, {
          ...idle,
          left: correction < -8,
          right: correction > 8,
          fire: true,
          aim: { ...boss.body.position },
        });
        for (const s of g.shots) if (s.reflected) reflected.add(s);
      }
      assert.equal(reflected.size, 1, `${build}, mirror=${mirror}`);
      assert(damage >= 70, `${build}, mirror=${mirror}: only ${damage} damage taken`);
      assert(g.shotCount > 20);
    }
  });
}

test('moving and deliberately releasing fire recharges Countershot during a real final-boss fight', () => {
  const g = new Game();
  g.startTest(countershotTestFromUrl(link('precision'))!);
  const boss = g.enemies[0],
    reflected = new Set<Shot>();
  for (let frame = 0; frame < 60 * 150 && g.mode === 'playing' && boss.hp > 0; frame++) {
    // Ordinary trigger releases only: no health, enemy, aim or physics overrides.
    const input = dodgePilot(g, boss, frame % 120 < 60);
    g.tick(1 / 60, { ...idle, ...input });
    for (const s of g.shots) if (s.reflected) reflected.add(s);
  }
  assert(reflected.size >= 2, `Only ${reflected.size} deliberate deflections`);
  assert(boss.hp < boss.maxHp / 2, `${boss.hp}/${boss.maxHp} boss health`);
});
