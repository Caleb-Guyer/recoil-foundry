import type { DamageRoomSummary } from './damage-control.ts';
import { damageCauseText } from './damage-cause.ts';
import { escapeLogbook } from './html.ts';
import type { RoomRematchSnapshot } from './room-rematch.ts';

const amount = (value: number) =>
  value > 0 && value < 0.1 ? '<0.1' : String(Math.round(value * 10) / 10);
const hits = (count: number) => `${count} ${count === 1 ? 'hit' : 'hits'}`;
const total = (summary: DamageRoomSummary) =>
  `${amount(summary.damage)} damage · ${hits(summary.hits)}`;
const sources = (summary: DamageRoomSummary) =>
  summary.sources.length
    ? '<ul>' +
      summary.sources
        .map(
          (source) =>
            '<li>' +
            escapeLogbook(damageCauseText(source.cause)) +
            ' · ' +
            escapeLogbook(amount(source.damage)) +
            ' damage · ' +
            hits(source.hits) +
            '</li>',
        )
        .join('') +
      '</ul>'
    : '<p>No accepted health loss was recorded.</p>';
export function damageSummaryHtml(summary: DamageRoomSummary, label = 'Damage this room visit') {
  return (
    '<details class="rematch-guidance damage-summary"><summary>' +
    escapeLogbook(label) +
    ' · ' +
    escapeLogbook(total(summary)) +
    '</summary>' +
    sources(summary) +
    '<p>Recorded since entering or continuing this room.</p></details>'
  );
}
export function rematchDamageHtml(
  snapshot: RoomRematchSnapshot,
  attempt: DamageRoomSummary,
  outcome: 'won' | 'dead',
  startingHp = 100,
) {
  const original = snapshot.damageSummary;
  const known = Number.isFinite(snapshot.startingHp);
  const sameHealth = known && snapshot.startingHp === startingHp;
  const comparable = !!original && sameHealth && !snapshot.finalePractice;
  let comparison = '';
  if (comparable) {
    const damage = attempt.damage - original!.damage,
      count = attempt.hits - original!.hits;
    const change = (value: number, unit: string) =>
      value === 0
        ? `Same ${unit}`
        : `${amount(Math.abs(value))} ${value < 0 ? 'less' : 'more'} ${unit}`;
    comparison =
      '<p>' +
      escapeLogbook(
        change(damage, 'damage') +
          ' · ' +
          (count === 0
            ? 'Same hit count'
            : `${Math.abs(count)} ${count < 0 ? 'fewer' : 'more'} ${Math.abs(count) === 1 ? 'hit' : 'hits'}`),
      ) +
      '.</p>';
  }
  const baseline = original
    ? '<p>Original room visit: ' +
      escapeLogbook(total(original)) +
      (known
        ? ' · Started at ' + escapeLogbook(amount(snapshot.startingHp!)) + ' health'
        : ' · Starting health was not recorded') +
      '.</p>'
    : '';
  const caveat = snapshot.finalePractice
    ? '<p>The original totals cover a room visit; this practice attempt covers one boss form.</p>'
    : original && !sameHealth
      ? '<p>Starting health differs or was not recorded, so these totals are shown separately.</p>'
      : '';
  return (
    '<details class="rematch-guidance damage-summary"><summary>This attempt · ' +
    (outcome === 'won' ? 'Cleared' : 'Defeated') +
    ' · ' +
    escapeLogbook(total(attempt)) +
    '</summary><p>Practice started at ' +
    escapeLogbook(amount(startingHp)) +
    ' health.</p>' +
    sources(attempt) +
    baseline +
    caveat +
    comparison +
    '</details>'
  );
}
