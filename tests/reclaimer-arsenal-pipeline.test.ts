import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import {
  reclaimerPressureTestFromUrl,
  prepareReclaimerPressureTest,
} from '../src/reclaimer-pressure-test.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';

for (const gun of STARTING_GUN_IDS)
  for (const beam of [false, true])
    test(`Siege armor accepts native ${gun} ${beam ? 'torch ticks' : 'projectile collisions'} without losing fittings`, () => {
      const f = reclaimerPressureTestFromUrl(
        new URL(
          `https://test.invalid/?test=reclaimer&phase=2&build=${beam ? 'reported' : 'standard'}&v=1`,
        ),
      )!;
      f.checkpoint.seed = f.checkpoint.seed.replace('RF-C107-', 'RF-C108-');
      f.checkpoint.startingGun = gun;
      const g = new Game();
      g.startTest(f.checkpoint);
      prepareReclaimerPressureTest(g, f);
      const e = g.finale.enemy!,
        a = g.finale.cinema!.arsenal;
      // Only initial location is selected. Real input, weapon emission, collision
      // and the common damage pipeline drain the original live armor and health.
      Matter.Body.setPosition(g.player, { x: 980, y: 718 });
      Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
      const hp = e.hp,
        armor = a.armor.hp,
        mods = [...g.mods];
      const input: Input = {
        left: false,
        right: false,
        jump: false,
        jumpHeld: false,
        fire: true,
        aim: { ...e.body.position },
      };
      for (let n = 0; n < 90 && a.armor.hp === armor && a.armor.plates === 3; n++)
        g.tick(1 / 60, { ...input, aim: { ...e.body.position } });
      assert(e.hp < hp, 'Native emitted weapon damage reaches the actual boss');
      assert(a.armor.hp < armor || a.armor.plates < 3, 'That same hit drains the real armor');
      assert.equal(g.startingGun, gun);
      assert.deepEqual(g.mods, mods);
      assert.equal(g.torch.equipped, beam);
      Matter.Composite.clear(g.engine.world, false);
      Matter.Engine.clear(g.engine);
    });
