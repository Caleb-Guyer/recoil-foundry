import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, Body } from './branches-fixture.ts';
import { beamRecoilForecast } from './beam-pilot.ts';
import { Game } from '../src/game.ts';

test('the audit must hold jump to match the full-height jump in its trajectory forecast', () => {
  const velocities: number[] = [];
  for (const jumpHeld of [false, true]) {
    const g = new Game();
    g.start('beam-audit-jump');
    const input = {
      left: false,
      right: false,
      jump: false,
      jumpHeld,
      fire: false,
      aim: { x: 1000, y: 300 },
    };
    for (let i = 0; i < 30; i++) g.tick(1 / 60, input);
    assert(g.grounded);
    g.tick(1 / 60, { ...input, jump: true });
    assert(!g.grounded);
    velocities.push(g.player.velocity.y);
  }
  assert(velocities[0] > -8 && velocities[1] < -10, JSON.stringify(velocities));
});

for (const mods of [
  [],
  ['burst'],
  ['burst', 'pulse-chamber'],
  ['prism-array'],
  ['charge-lens'],
  ['charge-lens', 'burst'],
])
  test(`beam movement forecast matches real emitted recoil through holds, releases and recovery: ${mods.join('/') || 'continuous'}`, () => {
    const g = fixture(['cutting-torch', ...mods, 'rapid', 'magnum', 'landing']);
    let forecast = beamRecoilForecast(g);
    for (let frame = 0; frame < 360; frame++) {
      const held = frame % 120 < 53 || (frame > 240 && frame % 5 < 3);
      g.grounded = frame % 90 < 25;
      g.landingReady ||= frame % 90 === 0;
      Body.setVelocity(g.player, { x: 0, y: 0 });
      // Restart the forecast mid-pulse/charge/recovery as the movement pilot does.
      if (frame % 17 === 0) forecast = beamRecoilForecast(g);
      const unchanged = { velocity: { ...g.player.velocity }, shots: g.shotCount, time: g.time };
      const step = forecast(1 / 60, held, g.landingReady);
      assert.deepEqual(
        { velocity: { ...g.player.velocity }, shots: g.shotCount, time: g.time },
        unchanged,
      );
      const before = g.shotCount;
      g.time += 1 / 60;
      g.torch.beforeStep(1 / 60, held);
      const expected = Math.max(-23, -step.impulse * (g.grounded ? 0.21 : 1));
      assert(
        Math.abs(g.player.velocity.x - expected) < 1e-6,
        `frame ${frame}: ${g.player.velocity.x} != ${expected}`,
      );
      assert.equal(step.spentLanding, g.shotCount > before);
    }
  });
