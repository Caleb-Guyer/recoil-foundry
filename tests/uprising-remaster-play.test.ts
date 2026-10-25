import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import { loadCheckpoint } from '../src/rules.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { UPRISING_ROUTES } from '../src/uprising-model.ts';
import { uprisingRemasterTestFromUrl } from '../src/uprising-remaster-test.ts';
import { playCampaign } from './campaign-pilot.ts';
import { uprisingRemasterInput } from './uprising-remaster-pilot.ts';

for (const route of UPRISING_ROUTES)
  for (const gun of STARTING_GUN_IDS)
    test(`new ${route.id} completes its full native mission with ordinary ${gun} controls`, (t) => {
      const source = uprisingRemasterTestFromUrl(
        new URL(`https://test/?test=uprising-remaster&route=${route.id}&v=1`),
      )!;
      source.checkpoint.startingGun = gun;
      assert(loadCheckpoint(source.checkpoint));
      const g = new Game();
      g.startTest(source.checkpoint);
      let writes = 0;
      g.onCheckpoint = () => writes++;
      g.onCommendation = () => writes++;
      playCampaign(g, {
        pathMods: [],
        seconds: 210,
        beforeInput: uprisingRemasterInput,
        stop: (g) => !!g.uprising.outcome && g.clear,
      });
      assert.equal(
        g.uprising.outcome?.result,
        'success',
        `${route.id} stalled: phase=${g.uprising.remaster.phase},x=${g.player.position.x},y=${g.player.position.y},hp=${g.hp},target=${JSON.stringify(g.uprising.remaster.objectiveTarget)},status=${g.uprising.status},enemies=${g.enemies.map((e) => e.kind + ':' + Math.round(e.hp) + '@' + Math.round(e.body.position.x) + ',' + Math.round(e.body.position.y))}`,
      );
      assert(g.clear, `the completed ${route.id} still needs its normal combat clear`);
      assert(g.hp > 0);
      assert(g.shotCount > 0 || route.mission === 'escape');
      assert.equal(writes, 0);
      assert(g.uprising.outcome?.reward);
      t.diagnostic(
        JSON.stringify({
          route: route.id,
          gun,
          seconds: Number(g.time.toFixed(2)),
          hp: g.hp,
          shots: g.shotCount,
          completedStations: g.uprising.remaster.completedStations,
          groups: g.uprising.remaster.snapshot.groups.length,
        }),
      );
      Matter.Composite.clear(g.engine.world, false);
      Matter.Engine.clear(g.engine);
    });
