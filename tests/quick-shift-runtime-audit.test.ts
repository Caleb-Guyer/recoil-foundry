import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { quickShiftFromSeed } from '../src/quick-shift-rules.ts';
import { loadQuickShiftContinue, quickShiftLevel } from '../src/quick-shift.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1300, y: 400 },
};
function tick(g: Game, n = 1, input = idle) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, input);
}
function begin(code: string) {
  const g = new Game();
  assert(g.quickShift.begin(quickShiftFromSeed('RF-Q1-' + code)!, 'pistol'));
  return g;
}
function choose(g: Game, wanted: readonly string[] = []) {
  while (g.quickShift.state?.phase === 'draft') {
    const q = g.quickShift.state;
    const index = q.mods.length;
    const id = wanted[index] ?? q.offers[0];
    assert(q.offers.includes(id), id + ' must be an actual seeded choice');
    assert(g.quickShift.chooseMod(id));
  }
  if (g.quickShift.state?.phase === 'route') assert(g.quickShift.chooseRoute('high'));
  if (g.quickShift.state?.phase === 'job') assert(g.quickShift.chooseJob('accept'));
}
function resolve(g: Game) {
  const round = g.quickShift.state!.round;
  for (let i = 0; i < 7000 && g.quickShift.state?.phase === 'fight'; i++) {
    g.hp = 100;
    if (round !== 4 && g.clear) Matter.Body.setPosition(g.player, { x: 1920, y: 722 });
    for (const e of [...g.enemies]) if (e.spawn <= 0) g.hitEnemy(e, 100000);
    tick(g);
  }
  assert.notEqual(g.quickShift.state?.phase, 'fight');
}

test('a fresh Quick Shift starts a new local report rather than inheriting Campaign totals', () => {
  const g = new Game();
  g.start('RF-C108-PREVIOUS');
  g.combatReport.reset({
    version: 1,
    heatTransfers: 7,
    bankCharges: 9,
    armorBlocks: 4,
    bloodworkHealing: 12,
    fromStage: 0,
    activations: { 'piston-lance': 15 },
    activationFromStage: 0,
  });
  assert(g.quickShift.begin(quickShiftFromSeed('RF-Q1-AUDIT0')!, 'pistol'));
  choose(g, ['rapid', 'burst', 'leech']);
  const report = g.combatReport.snapshot();
  assert.equal(report.heatTransfers, 0);
  assert.equal(report.bankCharges, 0);
  assert.equal(report.armorBlocks, 0);
  assert.equal(report.bloodworkHealing, 0);
  assert.deepEqual(report.activations, {});
  assert.equal(report.partial, undefined);
});

test('real Bloodwork healing survives room changes, repeated snapshots and a room-entry Continue', () => {
  const g = begin('AUDIT0');
  choose(g, ['rapid', 'burst', 'leech']);
  tick(g, 80);
  g.hurtAt = -10;
  g.damagePlayer(20);
  const target = g.enemies.find((e) => e.spawn <= 0 && !e.allied)!;
  assert(target);
  g.hitEnemy(target, 100000);
  const healed = g.combatReport.snapshot().bloodworkHealing;
  assert(healed > 0, 'an actual credited kill with Bloodwork heals the injured player');
  g.setMode('paused');
  const saved = g.quickShift.snapshot();
  assert(saved);
  assert.equal(saved.checkpoint.combatResults!.bloodworkHealing, healed);
  assert.deepEqual(g.quickShift.snapshot(), saved, 'sampling does not count an event twice');
  const restored = new Game();
  assert(restored.quickShift.resume(saved));
  assert.equal(restored.combatReport.snapshot().bloodworkHealing, healed);
  saved.checkpoint.combatResults!.bloodworkHealing = 999;
  assert.equal(
    restored.combatReport.snapshot().bloodworkHealing,
    healed,
    'save arrays and reports stay isolated',
  );
  resolve(restored);
  const afterRoom = restored.combatReport.snapshot().bloodworkHealing;
  assert(afterRoom >= healed);
  choose(restored);
  assert.equal(restored.quickShift.state!.round, 1);
  assert.equal(restored.combatReport.snapshot().bloodworkHealing, afterRoom);
});

test('native Piston Lance discharges carry their measured activation dictionary into the next room', () => {
  const g = begin('AUDIT239');
  const sequence = [
    'magnum',
    'burst',
    'airshot',
    'capacitor',
    'reserve-cell',
    'kick',
    'piston-lance',
  ];
  choose(g, sequence);
  resolve(g);
  choose(g, sequence);
  resolve(g);
  choose(g, sequence);
  assert.equal(g.quickShift.state!.round, 2);
  assert(g.mods.includes('piston-lance'));
  tick(g, 45);
  g.hitStop = 0;
  const p = g.player.position;
  tick(g, 1, { ...idle, fire: true, aim: { x: p.x, y: p.y + 350 } });
  tick(g, 25);
  const count = g.combatReport.snapshot().activations?.['piston-lance'] ?? 0;
  assert(count > 0, 'native ordinary fire emits the measured morph discharge');
  g.setMode('paused');
  const saved = g.quickShift.snapshot()!;
  assert.equal(saved.checkpoint.combatResults!.activations!['piston-lance'], count);
  const restored = new Game();
  assert(restored.quickShift.resume(saved));
  assert.equal(restored.combatReport.snapshot().activations!['piston-lance'], count);
  resolve(restored);
  const afterRoom = restored.combatReport.snapshot().activations!['piston-lance'];
  choose(restored);
  assert.equal(restored.quickShift.state!.round, 3);
  assert.equal(restored.combatReport.snapshot().activations!['piston-lance'], afterRoom);
});

test('Continue retains spent active time and per-room hit penalties while pause adds no time', () => {
  const g = begin('AUDITTIME');
  choose(g);
  tick(g, 100);
  g.hurtAt = -10;
  g.damagePlayer(9);
  tick(g, 20);
  g.setMode('paused');
  const elapsed = g.elapsed;
  tick(g, 100);
  assert.equal(g.elapsed, elapsed);
  const first = g.quickShift.snapshot()!;
  assert(first.state.timeMs >= 1000);
  assert.equal(first.state.roomHits, 1);
  const next = new Game();
  assert(next.quickShift.resume(first));
  tick(next, 60);
  next.setMode('paused');
  const second = next.quickShift.snapshot()!;
  assert(second.state.timeMs >= first.state.timeMs + 900);
  assert(second.state.roomTimeMs >= first.state.roomTimeMs + 900);
  assert.equal(second.state.roomHits, 1, 'entry retry cannot erase a clean-job hit');
  const forged = structuredClone(second);
  forged.state.roomTimeMs = forged.state.timeMs + 1;
  assert.equal(loadQuickShiftContinue(forged), null);
});

test('every shared seed gives physically distinct post-fork routes, including the formerly identical ROUTE2 plan', () => {
  const codes = ['ROUTE2', ...Array.from({ length: 101 }, (_, i) => 'PATH' + i)];
  const physical = (level: ReturnType<typeof quickShiftLevel>) => ({
    solids: level.solids,
    spawns: level.spawns,
    route: level.route,
    props: level.setpiece?.props,
    combatFlow: level.combatFlow,
  });
  for (const code of codes) {
    const challenge = quickShiftFromSeed('RF-Q1-' + code)!;
    const changed: number[] = [];
    for (let round = 1; round <= 3; round++) {
      const low = quickShiftLevel({ challenge, round, selectedRoute: 'low' });
      const high = quickShiftLevel({ challenge, round, selectedRoute: 'high' });
      if (JSON.stringify(physical(low)) !== JSON.stringify(physical(high))) changed.push(round);
      assert.deepEqual(
        physical(high),
        physical(quickShiftLevel({ challenge, round, selectedRoute: 'high' })),
        'the chosen route remains reproducible',
      );
    }
    assert(
      changed.length > 0,
      code + ' must change real terrain, placements or encounter geometry',
    );
  }
  const formerlyIdentical = quickShiftFromSeed('RF-Q1-ROUTE2')!;
  for (let round = 1; round <= 3; round++)
    assert.notDeepEqual(
      physical(quickShiftLevel({ challenge: formerlyIdentical, round, selectedRoute: 'low' })),
      physical(quickShiftLevel({ challenge: formerlyIdentical, round, selectedRoute: 'high' })),
      'ROUTE2 round ' + round + ' uses the physical mirror fallback',
    );
});
