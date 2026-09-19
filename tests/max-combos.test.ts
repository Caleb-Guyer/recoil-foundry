import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import { maxCombos } from '../src/branch-builds.ts';
import { MASS_DRIVER } from '../src/mass-driver.ts';
import { GRIND } from '../src/grindshot.ts';
import { CLUSTER_LIMIT } from '../src/demolition.ts';
import { RESONATOR, STORM_CELL } from '../src/cross-fusions.ts';

test('every maximal build fires in the actual Workshop with finite physics and bounded secondary effects', () => {
  for (const combo of maxCombos()) {
    const g = new Game();
    g.startWorkshop(combo.mods, combo.mods);
    assert.deepEqual(g.mods, combo.mods);
    for (let frame = 0; frame < 180; frame++) {
      const target = g.enemies.filter((e) => e.spawn <= 0)[frame < 90 ? 0 : 1];
      const aim = target ? { ...target.body.position } : { x: 1100, y: 550 };
      const fire = g.mods.includes('charge-lens')
        ? g.torch.chargeProgress < 1
        : g.mods.includes('rail-spike')
          ? g.ballistics.charges > 0 || g.burstRemaining > 0
          : frame % 90 < 75;
      g.tick(1 / 60, {
        left: frame > 120,
        right: frame < 30,
        jump: frame === 45,
        jumpHeld: false,
        fire,
        aim,
      });
      assert(
        Number.isFinite(g.player.position.x) && Number.isFinite(g.player.position.y),
        combo.code,
      );
      assert(g.shots.length <= 180, combo.code);
      assert(
        g.shots.filter((s) => s.massDriver && s.life > 0).length <= MASS_DRIVER.limit,
        combo.code,
      );
      assert(g.grind.saws.length <= GRIND.limit, combo.code);
      assert(g.demolition.bomblets.length <= CLUSTER_LIMIT, combo.code);
      assert(g.tripwires.wires.length <= 2, combo.code);
      assert(g.fusions.resonator.pending.length <= RESONATOR.limit, combo.code);
      assert(g.fusions.storm.cells.length <= STORM_CELL.limit, combo.code);
      for (const s of g.shots)
        assert([s.pos.x, s.pos.y, s.vel.x, s.vel.y, s.damage].every(Number.isFinite), combo.code);
    }
    assert(g.shotCount > 0, combo.code);
    g.setMode('dead');
    assert.equal(g.demolition.bomblets.length, 0);
    assert.equal(g.grind.saws.length, 0);
    assert.equal(g.fusions.resonator.pending.length, 0);
    assert.equal(g.fusions.storm.cells.length, 0);
  }
});
