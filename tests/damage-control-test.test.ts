import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Input } from '../src/game.ts';
import {
  DAMAGE_CONTROL_IDS,
  DAMAGE_CONTROL_SCENES,
  damageControlTestFromUrl,
  damageControlLevel,
  prepareDamageControl,
} from '../src/damage-control-test.ts';
import { loadCheckpoint, getGun } from '../src/rules.ts';
import { roomRematchSnapshot, rematchEntry, RoomRematch } from '../src/room-rematch.ts';
import { damageSummaryHtml, rematchDamageHtml } from '../src/damage-summary-view.ts';
import { damageCauseText } from '../src/damage-cause.ts';
import { ReplayBuffer, replayHitsInBuffer, type ReplayHit } from '../src/death-replay.ts';
const url = (query = '') => new URL('https://test/?test=damage&v=1' + query);
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 100, y: 724 },
};
function start(scene = 'replay') {
  const spec = damageControlTestFromUrl(url('&scene=' + scene))!;
  const g = new Game();
  g.startTest(spec.checkpoint);
  return { g, spec };
}
function tick(g: Game, frames = 1) {
  for (let n = 0; n < frames && g.mode === 'playing'; n++) g.tick(1 / 60, idle);
}
function dieNaturally(g: Game) {
  for (let n = 0; n < 3600 && g.mode === 'playing'; n++) tick(g);
  assert.equal(g.mode, 'dead');
}

test('three strict damage links use legal native builds and authored health budgets', () => {
  for (const scene of DAMAGE_CONTROL_IDS) {
    const spec = damageControlTestFromUrl(url('&scene=' + scene))!;
    assert(loadCheckpoint(spec.checkpoint));
    assert.deepEqual(spec.checkpoint.mods, []);
    assert.equal(spec.checkpoint.hp, DAMAGE_CONTROL_SCENES[scene].hp);
    assert.equal(spec.checkpoint.startingGun, 'pistol');
    assert(spec.checkpoint.seed.length <= 40);
  }
  assert.equal(damageControlTestFromUrl(url())?.scene, 'hit');
  for (const query of [
    '&test=damage',
    '&v=1',
    '&scene=replay&scene=replay',
    '&scene=',
    '&scene=unknown',
    '&gun=shotgun',
    '&hp=1',
    '&camera=wide',
    '&mirror=1',
    '&build=beam',
  ])
    assert.equal(damageControlTestFromUrl(url(query)), null, query);
  assert.equal(damageControlTestFromUrl(new URL('https://test/?test=damage')), null);
  assert.equal(damageControlTestFromUrl(new URL('https://test/?test=damage&v=2')), null);
});
test('production fixture hooks preserve live AI and physics and cannot affect unrelated rooms', () => {
  for (const scene of DAMAGE_CONTROL_IDS) {
    const { g } = start(scene);
    assert.equal(g.level.id, 'damage-control-' + scene);
    assert.equal(g.hp, DAMAGE_CONTROL_SCENES[scene].hp);
    assert.deepEqual(g.gun, getGun([]));
    assert(g.enemies.length > 0 && g.enemies.every((e) => e.hp > 0));
    assert.equal(g.damageControl.summary().hits, 0);
    const level = g.level,
      entry = { ...g.player.position };
    g.testRun = null;
    assert.equal(damageControlLevel(g, level), level);
    prepareDamageControl(g);
    assert.deepEqual(g.player.position, entry);
  }
});
test('actual gunner projectiles report accepted health loss and immutable cause evidence', () => {
  const { g } = start('hit');
  for (let n = 0; n < 1200 && g.damageControl.hits.length < 2 && g.mode === 'playing'; n++) tick(g);
  const summary = g.damageControl.summary();
  assert(summary.hits >= 2);
  assert.equal(summary.damage, 100 - g.hp);
  assert.equal(summary.sources.length, 1);
  assert.deepEqual(summary.sources[0].cause, { type: 'shot', enemy: 'shooter' });
  assert.equal(summary.sources[0].damage, summary.damage);
  for (const hit of g.damageControl.hits) {
    assert(hit.origin && hit.direction);
    assert(hit.at > 1);
    assert(Object.isFrozen(hit));
  }
});
test('three natural accepted hits remain together in one genuine five-second replay window', () => {
  const { g } = start('replay'),
    buffer = new ReplayBuffer<number>();
  let capturedAt = -Infinity;
  for (let n = 0; n < 3600 && g.mode === 'playing'; n++) {
    tick(g);
    if (g.elapsed - capturedAt >= 1 / 24 || g.mode === 'dead') {
      buffer.add({ at: g.elapsed, data: g.hp, bytes: 4 });
      capturedAt = g.elapsed;
    }
  }
  assert.equal(g.mode, 'dead');
  const summary = g.damageControl.summary();
  assert.equal(summary.damage, 54);
  assert.equal(summary.hits, 3);
  const hits: ReplayHit[] = g.damageControl.hits.map((hit) => ({
    id: hit.id,
    at: hit.elapsed,
    damage: hit.damage,
    hpBefore: hit.hpBefore,
    hpAfter: hit.hpAfter,
    player: hit.player,
    origin: hit.origin,
    label: damageCauseText(hit.cause),
  }));
  const timeline = replayHitsInBuffer(buffer.frames, hits);
  assert.equal(timeline.length, 3);
  assert(timeline.every((hit) => hit.at >= 0 && hit.at <= 5));
  assert.deepEqual(
    timeline.map((hit) => hit.hpAfter),
    [36, 18, 0],
  );
});
test('death snapshots copy current-visit totals and retain original starting health before full-health practice', () => {
  const { g } = start('replay'),
    entry = rematchEntry(g)!;
  dieNaturally(g);
  const snapshot = roomRematchSnapshot(g, entry)!;
  assert.equal(snapshot.startingHp, 54);
  assert.equal(snapshot.checkpoint.hp, 100);
  assert.deepEqual(snapshot.damageSummary, g.damageControl.summary());
  snapshot.damageSummary!.sources[0].damage = 999;
  assert.equal(g.damageControl.summary().sources[0].damage, 54);
});
test('private attempts start empty, report only endpoints, reset on Retry and preserve the original result', () => {
  const { g } = start('replay'),
    entry = rematchEntry(g)!;
  dieNaturally(g);
  const original = {
    save: g.checkpointSnapshot(),
    summary: g.damageControl.summary(),
    cause: g.deathCause,
  };
  const snapshot = roomRematchSnapshot(g, entry)!,
    session = new RoomRematch(snapshot);
  let writes = 0;
  session.game.onCheckpoint = () => writes++;
  session.game.onCommendation = () => writes++;
  session.game.onCampaignClear = () => writes++;
  assert.equal(session.attemptStartingHp, 100);
  assert.equal(session.damageResult, null);
  assert.deepEqual(session.game.damageControl.summary(), { damage: 0, hits: 0, sources: [] });
  session.game.setMode('playing');
  for (let n = 0; n < 1200 && session.game.damageControl.hits.length < 2; n++) tick(session.game);
  assert.equal(session.damageResult, null, 'partial attempts never become comparisons');
  session.reset();
  assert.equal(session.damageResult, null);
  assert.equal(session.game.damageControl.summary().hits, 0);
  session.game.setMode('playing');
  dieNaturally(session.game);
  assert.equal(session.damageResult?.damage, 100);
  assert.equal(session.damageResult?.hits, 6);
  const markup = rematchDamageHtml(
    snapshot,
    session.damageResult!,
    'dead',
    session.attemptStartingHp,
  );
  assert.match(markup, /Original room visit: 54 damage/);
  assert.match(markup, /Started at 54 health/);
  assert.match(markup, /Practice started at 100 health/);
  assert.match(markup, /shown separately/);
  assert.doesNotMatch(markup, /less damage|more damage|fewer hits/);
  assert.equal(writes, 0);
  assert.deepEqual(
    { save: g.checkpointSnapshot(), summary: g.damageControl.summary(), cause: g.deathCause },
    original,
  );
  session.reset();
  assert.equal(session.damageResult, null);
  assert.equal(session.game.damageControl.summary().damage, 0);
  session.dispose();
});
test('summary markup shows current-visit sources and withholds unsupported comparison claims', () => {
  const { g } = start('replay'),
    entry = rematchEntry(g)!;
  dieNaturally(g);
  const snapshot = roomRematchSnapshot(g, entry)!;
  const detail = damageSummaryHtml(g.damageControl.summary());
  assert.match(detail, /Damage this room visit/);
  assert.match(detail, /Gunner · Gunfire/);
  assert.match(detail, /since entering or continuing/);
  const old = { ...snapshot, startingHp: undefined, damageSummary: undefined };
  const markup = rematchDamageHtml(
    old,
    {
      damage: 18,
      hits: 1,
      sources: [{ cause: { type: 'shot', enemy: 'shooter' }, damage: 18, hits: 1 }],
    },
    'won',
  );
  assert.match(markup, /Cleared · 18 damage · 1 hit/);
  assert.doesNotMatch(markup, /Original room visit|less damage|fewer hits/);
  const equalBudget = {
    ...snapshot,
    startingHp: 100,
    damageSummary: { damage: 100, hits: 6, sources: [] },
  };
  assert.match(
    rematchDamageHtml(equalBudget, { damage: 36, hits: 2, sources: [] }, 'won'),
    /64 less damage · 4 fewer hits/,
  );
  const form = {
    ...equalBudget,
    finalePractice: { reached: 2 as const, deathPhase: 1 as const, cause: null },
  };
  const formMarkup = rematchDamageHtml(form, { damage: 36, hits: 2, sources: [] }, 'won');
  assert.match(formMarkup, /one boss form/);
  assert.doesNotMatch(formMarkup, /less damage|fewer hits/);
});
