import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import {
  reclaimerArsenalTestFromUrl,
  prepareReclaimerArsenalTest,
  RECLAIMER_ARSENAL_FORMS,
} from '../src/reclaimer-arsenal-test.ts';
import {
  finaleCampRoom,
  finaleCampSpots,
  runFinaleCamp,
} from '../scripts/reclaimer-pressure-audit.ts';
import { UPRISING_FINALES } from '../src/uprising-model.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1450, y: 400 },
};
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function preview(form: string, fight = 'campaign', mirror = 0) {
  const fixture = reclaimerArsenalTestFromUrl(
    new URL(`https://test.invalid/?test=arsenal&v=1&form=${form}&fight=${fight}&mirror=${mirror}`),
  )!;
  const g = new Game();
  g.startTest(fixture.checkpoint);
  assert(prepareReclaimerArsenalTest(g, fixture));
  return { g, fixture, a: g.finale.cinema!.arsenal };
}

for (const [phase, form] of RECLAIMER_ARSENAL_FORMS.entries())
  test(`${form} previews naturally demonstrate the signature without an attack override`, () => {
    for (const fight of ['campaign', 'overtime'])
      for (const mirror of [0, 1]) {
        const { g, a } = preview(form, fight, mirror);
        let first: number | null = null,
          writes = 0;
        const cue = ['arsenal-dash-warn', 'arsenal-plane', 'arsenal-core-warn'][phase];
        g.onSound = (name) => {
          if (name === cue) first ??= g.elapsed;
        };
        g.onCheckpoint = () => writes++;
        g.onEnemyDefeated = () => writes++;
        g.onBossDefeated = () => writes++;
        g.onCommendation = () => writes++;
        for (let frame = 0; frame < 900 && first === null && g.mode === 'playing'; frame++)
          g.tick(1 / 60, idle);
        assert(first !== null && first < 15, `${form}/${fight}/${mirror}: ${first}`);
        assert(a.enabled);
        assert.equal(writes, 0);
        assert.equal(
          g.hp > 0,
          true,
          'The normal-health fixture can see its signature before dying',
        );
        assert.equal(
          g.finale.strike,
          null,
          'C108 uses actual signature attacks rather than old rectangle overlays',
        );
        dispose(g);
      }
  });

for (const phase of [0, 1, 2] as const)
  test(`Arsenal form ${phase + 1}: floor corners and every supported shelf retain anti-camping pressure`, () => {
    for (const overtime of [false, true])
      for (const mirror of [false, true])
        for (const outcome of overtime ? (['isolated'] as const) : UPRISING_FINALES) {
          const options = { phase, overtime, mirror, outcome, revision: 108 as const };
          const room = finaleCampRoom(options),
            spots = finaleCampSpots(room.g);
          dispose(room.g);
          for (const spot of spots) {
            const row = runFinaleCamp(options, spot);
            assert(row.taken > 0, 'Untouched Arsenal camp: ' + JSON.stringify(row));
            assert(
              row.firstHit! <= 20,
              'Arsenal pressure never reached camp: ' + JSON.stringify(row),
            );
            assert(
              row.maxStep < 25,
              'A live form teleported across terrain: ' + JSON.stringify(row),
            );
          }
        }
  });

test('the reported Twinbore beam cannot erase C108 retaliation from the old safe angle', () => {
  for (const phase of [0, 1, 2] as const)
    for (const overtime of [false, true])
      for (const mirror of [false, true]) {
        const row = runFinaleCamp(
          { phase, overtime, mirror, outcome: 'isolated', reportedBuild: true, revision: 108 },
          { name: 'issue-right-floor', x: mirror ? 470 : 1530, y: 722 },
          { firing: true },
        );
        assert(row.taken > 0, 'Reported build remained untouched: ' + JSON.stringify(row));
        assert(
          row.bossHp > 0,
          'Reported build destroyed the form untouched: ' + JSON.stringify(row),
        );
      }
});

test('pausing freezes each signature and retry clears the old mechanic before restoring its native form', () => {
  for (const form of RECLAIMER_ARSENAL_FORMS) {
    const { g, fixture, a } = preview(form),
      e = g.finale.enemy!;
    if (form === 'chassis') assert(a.beginDash(e));
    else if (form === 'siege') a.beginFlight();
    else {
      a.beginCore();
      assert(a.planCollapse());
    }
    const snapshot = () =>
      JSON.stringify({
        dash: a.dash,
        flight: a.flight,
        bombs: a.bombs,
        core: a.core,
        collapses: a.collapses,
        armor: a.armor,
        clock: a.clock,
        next: a.nextSpecial,
        player: g.player.position,
        boss: e.body.position,
      });
    g.setMode('paused');
    const before = snapshot();
    for (let frame = 0; frame < 600; frame++) g.tick(1 / 60, { ...idle, right: true, fire: true });
    assert.equal(snapshot(), before);
    g.startTest(fixture.checkpoint);
    assert(prepareReclaimerArsenalTest(g, fixture));
    const fresh = g.finale.cinema!.arsenal;
    assert.notEqual(fresh, a);
    assert.equal(fresh.dash, null);
    assert.equal(fresh.flight, null);
    assert.deepEqual(fresh.bombs, []);
    assert.equal(fresh.core, null);
    assert.deepEqual(fresh.collapses, []);
    assert.equal(fresh.collapsed, 0);
    assert.equal(fresh.armor.plates, form === 'siege' ? 3 : 0);
    assert.equal(fresh.armor.exposedLeft, 0);
    assert.equal(g.finale.enemy!.hp, g.finale.enemy!.maxHp);
    dispose(g);
  }
});

test('breaking a form cancels its signature, bombs and collapse warnings before the visual transition', () => {
  for (const form of RECLAIMER_ARSENAL_FORMS) {
    const { g, a } = preview(form),
      e = g.finale.enemy!;
    if (form === 'chassis') assert(a.beginDash(e));
    else if (form === 'siege') a.beginFlight();
    else {
      a.beginCore();
      assert(a.planCollapse());
    }
    g.hitEnemy(e, 1e9);
    assert.equal(e.hp, 0);
    assert(!g.finale.cinema!.combat);
    assert.equal(a.dash, null);
    assert.equal(a.flight, null);
    assert.deepEqual(a.bombs, []);
    assert.equal(a.core, null);
    assert.deepEqual(a.collapses, []);
    assert.equal(a.armor.exposedLeft, 0);
    dispose(g);
  }
});
