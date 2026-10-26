import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import {
  finaleCampRoom,
  finaleCampSpots,
  runFinaleCamp,
} from '../scripts/reclaimer-pressure-audit.ts';
import { type Game, type Input } from '../src/game.ts';
import { UPRISING_FINALES } from '../src/uprising-model.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 718 },
};
function dispose(g: Game) {
  Matter.Engine.clear(g.engine);
  Matter.Composite.clear(g.engine.world, false);
}

for (const phase of [0, 1, 2] as const)
  test(`Reclaimer form ${phase + 1}: floor corners and every supported shelf edge receive real pressure`, () => {
    for (const overtime of [false, true])
      for (const mirror of [false, true])
        for (const outcome of overtime ? (['isolated'] as const) : UPRISING_FINALES) {
          const options = { phase, overtime, mirror, outcome };
          const fixture = finaleCampRoom(options);
          const spots = finaleCampSpots(fixture.g);
          dispose(fixture.g);
          for (const spot of spots) {
            const r = runFinaleCamp(options, spot);
            assert(r.taken > 0, 'Untouchable camp: ' + JSON.stringify(r));
            assert(r.firstHit! <= 20, 'Pressure never reached camp: ' + JSON.stringify(r));
            assert(
              r.maxPursuitStep < 24,
              'Physical pursuit warped across the arena: ' + JSON.stringify(r),
            );
          }
        }
  });

for (const phase of [0, 1, 2] as const)
  test(`Reclaimer form ${phase + 1}: the reported Twinbore beam cannot hold its old stationary angle safely`, () => {
    for (const overtime of [false, true])
      for (const mirror of [false, true]) {
        const canonical = 1530;
        const r = runFinaleCamp(
          { phase, overtime, mirror, outcome: 'isolated', reportedBuild: true },
          { name: 'issue-right-floor', x: mirror ? 2000 - canonical : canonical, y: 722 },
          { firing: true },
        );
        assert(r.taken > 0, 'Reported beam camp receives no retaliation: ' + JSON.stringify(r));
        assert(
          r.bossHp > 0,
          'Reported camp killed its full-health form untouched: ' + JSON.stringify(r),
        );
      }
  });

test('all forms physically leave their initial anchor to find an exposed firing angle', () => {
  for (const phase of [0, 1, 2] as const)
    for (const overtime of [false, true])
      for (const mirror of [false, true]) {
        const r = runFinaleCamp(
          { phase, overtime, mirror, outcome: 'isolated' },
          { x: mirror ? 28 : 1972, y: 722 },
          { seconds: 10, stopAfterHit: false },
        );
        assert(r.pursuitTravel > 120, 'Boss retained its fixed anchor: ' + JSON.stringify(r));
        assert(r.maxPursuitStep < 24, 'Boss movement teleported: ' + JSON.stringify(r));
      }
});

for (const phase of [1, 2] as const)
  test(`form ${phase + 1}: targeted pressure locks once, honors its complete tell and can be walked out of`, () => {
    for (const mirror of [false, true])
      for (const outcome of ['isolated', 'overloaded'] as const) {
        const still = finaleCampRoom({ phase, mirror, outcome });
        Matter.Body.setPosition(still.g.player, { x: mirror ? 1720 : 280, y: 722 });
        const strike = still.g.finale.planStrike();
        const marks = structuredClone(strike.rects);
        assert.equal(strike.kind, 'column');
        assert(strike.left >= 1.65, 'Pressure keeps a readable full warning');
        assert(
          marks.some(
            (s) => still.g.player.position.x >= s.x && still.g.player.position.x <= s.x + s.w,
          ),
        );
        still.g.finale.strike = strike;
        still.g.finale.update(strike.left - 0.01);
        assert.equal(still.g.hp, 100, 'No damage before the warning expires');
        assert(!strike.fired);
        assert.deepEqual(strike.rects, marks);
        still.g.finale.update(0.02);
        assert(still.g.hp < 100, 'A stationary player inside the mark is actually damaged');
        assert(strike.fired);
        const afterHit = still.g.hp;
        still.g.finale.update(0.1);
        assert.equal(still.g.hp, afterHit, 'One mark does not damage every rendered frame');
        dispose(still.g);

        const moving = finaleCampRoom({ phase, mirror, outcome });
        const g = moving.g;
        Matter.Body.setPosition(g.player, { x: mirror ? 1720 : 280, y: 722 });
        Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
        moving.e.state = 'recover';
        moving.e.timer = 10;
        g.finale.strike = g.finale.planStrike();
        const warning = g.finale.strike.left;
        const locked = structuredClone(g.finale.strike.rects);
        let hit = false;
        g.onDamage = () => {
          hit = true;
        };
        const destination = (mirror ? 1720 : 280) + (mirror ? -200 : 200);
        for (let n = 0; n < Math.ceil((warning + 0.05) * 60); n++) {
          const dx = destination - g.player.position.x - g.player.velocity.x * 5;
          g.tick(1 / 60, { ...idle, left: dx < -8, right: dx > 8 });
          if (g.finale.strike)
            assert.deepEqual(g.finale.strike.rects, locked, 'Warning chased the moving player');
        }
        assert(!hit && g.hp === 100, 'Ordinary walking must escape the locked strike');
        assert(Math.abs(g.player.position.x - (mirror ? 1720 : 280)) > 100);
        assert(g.finale.strike?.fired);
        dispose(g);
      }
  });

test('successful sabotage still removes paired machinery and gives more warning and recovery', () => {
  const isolated = finaleCampRoom({ phase: 2, outcome: 'isolated' });
  const ordinary = finaleCampRoom({ phase: 2, outcome: 'overloaded' });
  const weakened = isolated.g.finale.planStrike();
  const normal = ordinary.g.finale.planStrike();
  assert.equal(weakened.rects.length, 1);
  assert(normal.rects.length > weakened.rects.length);
  assert(weakened.left > normal.left);
  for (const [fixture, strike] of [
    [isolated, weakened],
    [ordinary, normal],
  ] as const) {
    fixture.g.finale.strike = strike;
    fixture.g.finale.update(strike.left + 0.01);
    fixture.g.finale.update(0.3);
    assert.equal(fixture.g.finale.strike, null);
  }
  assert(isolated.g.finale.nextStrike > ordinary.g.finale.nextStrike);
  dispose(isolated.g);
  dispose(ordinary.g);
});

test('the pressure repair does not rewrite the archived cinematic ruleset', () => {
  const old = runFinaleCamp(
    { phase: 2, revision: 97, outcome: 'isolated' },
    { x: 1470, y: 722 },
    { seconds: 20 },
  );
  assert.equal(old.taken, 0);
  assert.equal(old.bossTravel, 0);
});

for (const contact of [
  { name: 'underside of a shelf', boss: { x: 650, y: 560 }, player: { x: 650, y: 482 } },
  { name: 'floor after recoil', boss: { x: 743.67, y: 703.05 }, player: { x: 1340, y: 60 } },
])
  test(`Chassis escapes planner padding at the ${contact.name} through real collision`, () => {
    const { g, e, cinema } = finaleCampRoom({ phase: 0, outcome: 'isolated' });
    Matter.Body.setPosition(e.body, contact.boss);
    Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
    e.interceptor!.origin = { ...contact.boss };
    e.state = 'idle';
    e.timer = 0;
    Matter.Body.setPosition(g.player, contact.player);
    Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
    const mask = e.body.collisionFilter.mask;
    let damage = 0,
      travel = 0,
      maxStep = 0,
      maxPenetration = 0;
    let last = { ...e.body.position };
    const warnedAttacks = new Set<string>();
    g.onDamage = (hit) => {
      damage += hit.damage;
    };
    for (let frame = 0; frame < 20 * 60 && !damage && g.mode === 'playing'; frame++) {
      const pursuing = e.attack === 'vault' && cinema.pursuit.route.length > 0;
      const dx = contact.player.x - g.player.position.x - g.player.velocity.x * 5;
      g.tick(1 / 60, { ...idle, left: dx < -8, right: dx > 8 });
      const step = Math.hypot(e.body.position.x - last.x, e.body.position.y - last.y);
      if (pursuing) {
        travel += step;
        maxStep = Math.max(maxStep, step);
      }
      last = { ...e.body.position };
      if (e.state === 'windup' && e.attack !== 'vault') warnedAttacks.add(e.interceptor!.move);
      maxPenetration = Math.max(
        maxPenetration,
        ...Matter.Query.collides(e.body, g.terrain).map((c) => c.depth),
      );
      assert(!e.body.isSensor, 'Escaping clearance padding cannot disable collision');
      assert.equal(e.body.collisionFilter.mask, mask);
    }
    assert(travel > 120, `Boss remained caught at ${contact.name}: travel=${travel}`);
    assert(maxStep < 24, `Padding escape teleported: step=${maxStep}`);
    assert(
      maxPenetration < 0.3,
      `Padding escape crossed physical terrain: penetration=${maxPenetration}`,
    );
    assert(warnedAttacks.size > 0, 'Reaching a firing lane must resume warned attacks');
    assert(damage > 0, `Boss could not threaten the player from ${contact.name}`);
    dispose(g);
  });
