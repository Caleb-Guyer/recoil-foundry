import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { MODS, validBuild } from '../src/rules.ts';
import { withParents } from '../src/branch-builds.ts';
import { EXPERIMENTAL_GUN_IDS } from '../src/starting-guns.ts';
import { weaponPilotInput } from './weapon-pilot.ts';

const combinations = [
  [],
  ['scatter', 'burst', 'kick'],
  ['shellshock', 'fuse', 'blast-surf'],
  ['mass-driver', 'ricochet', 'drop-forge'],
  ['recall', 'homecoming', 'pierce'],
  ['vector', 'afterburner'],
  ['capacitor', 'rail-spike'],
  ['afterimage', 'parallax'],
  ['suspension', 'crosshatch'],
  ['seeker-rack'],
  ['piston-lance'],
  ['cutting-torch', 'scatter'],
];
for (const gun of EXPERIMENTAL_GUN_IDS)
  for (const requested of combinations)
    test(`${gun} keeps legal ${requested.join('+') || 'native'} fittings through real bounded combat and reset`, () => {
      const mods = withParents([], requested);
      assert(mods && validBuild(mods));
      const g = new Game();
      g.startWorkshop(
        MODS.map((mod) => mod.id),
        mods,
        gun,
        'groups',
      );
      assert.deepEqual(g.mods, mods, 'No paid fitting is silently trimmed');
      let writes = 0;
      g.onCheckpoint = () => writes++;
      for (let frame = 0; frame < 300; frame++) {
        const target = g.enemies.find((enemy) => enemy.hp > 0);
        const input: Input = {
          left: false,
          right: g.player.position.x < 415,
          jump: false,
          jumpHeld: false,
          fire: frame % 90 < 65,
          aim: target?.body.position ?? { x: 700, y: 723 },
        };
        g.tick(1 / 60, weaponPilotInput(g, input));
        assert(
          [
            g.hp,
            g.player.position.x,
            g.player.position.y,
            g.experimentalWeapons.pressure,
            g.experimentalWeapons.debt,
          ].every(Number.isFinite),
        );
        assert(g.shots.length <= 180);
        assert(g.experimentalWeapons.pressure >= 0 && g.experimentalWeapons.pressure <= 1);
        assert(g.experimentalWeapons.debt >= 0 && g.experimentalWeapons.debt <= 1);
        assert(
          g.shots.every((shot) =>
            [shot.damage, shot.pos.x, shot.pos.y, shot.vel.x, shot.vel.y].every(Number.isFinite),
          ),
        );
      }
      assert(g.shotCount > 0, 'The actual trigger emits ammunition with this conversion');
      assert.equal(g.startingGun, gun);
      assert.deepEqual(g.mods, mods);
      g.setMode('paused');
      assert.equal(g.experimentalWeapons.pressure, 0);
      assert.equal(g.experimentalWeapons.debt, 0);
      assert.equal(g.experimentalWeapons.bolt, null);
      assert.equal(writes, 0);
      Matter.Composite.clear(g.engine.world, false);
      Matter.Engine.clear(g.engine);
    });
