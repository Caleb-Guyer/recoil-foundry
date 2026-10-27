import type { Game } from './game.ts';
import { MODS } from './rules.ts';
import { buildConnections } from './combat-report-menu.ts';
import { STARTING_GUNS } from './starting-guns.ts';
import { WORKSHOP_SCENARIOS } from './workshop.ts';
import { buildMotion, type BuildMotionRow } from './build-motion.ts';
import { escapeLogbook as escape } from './html.ts';

export function buildMotionRowsMarkup(rows: readonly BuildMotionRow[]) {
  return rows
    .map(
      (row) =>
        '<article class="motion-fitting" data-motion-fitting="' +
        escape(row.id) +
        '">' +
        '<div class="motion-fitting-heading"><h4>' +
        escape(row.name) +
        '</h4><span class="motion-state" data-state="' +
        row.state +
        '">' +
        escape(row.state[0].toUpperCase() + row.state.slice(1)) +
        '</span></div>' +
        '<p class="motion-trigger">' +
        escape(row.trigger) +
        '</p><p>' +
        escape(row.detail) +
        '</p>' +
        (row.progress !== undefined
          ? '<progress max="1" value="' +
            Math.max(0, Math.min(1, row.progress)) +
            '" aria-label="' +
            escape(row.name) +
            ' readiness"></progress>'
          : '') +
        '<button class="quiet motion-practice-shortcut" data-motion-practice="' +
        escape(row.id) +
        '">Practice ' +
        escape(row.name) +
        '<span> · ' +
        escape(WORKSHOP_SCENARIOS.find((s) => s.id === row.scenario)!.label) +
        '</span></button></article>',
    )
    .join('');
}
export function buildMotionMarkup(game: Game, open = false) {
  const rows = buildMotion(game);
  const connections = buildConnections(game).filter(
    (connection) => !rows.some((row) => row.name === connection.title),
  );
  return (
    '<details id="motion-build" class="motion-build"' +
    (open ? ' open' : '') +
    '><summary>Your build now<span>' +
    escape(STARTING_GUNS[game.startingGun].name) +
    ' · ' +
    game.mods.length +
    ' fittings</span></summary>' +
    '<p class="motion-build-note">States describe this moment when you resume. Practice uses a separate range with your equipped build; your run stays paused.</p>' +
    '<ul class="motion-connections">' +
    connections
      .map(
        (c) =>
          '<li><strong>' + escape(c.title) + '</strong><span>' + escape(c.detail) + '</span></li>',
      )
      .join('') +
    '</ul>' +
    '<div class="motion-fittings">' +
    buildMotionRowsMarkup(rows) +
    '</div>' +
    (!rows.length && !game.mods.length
      ? '<p>Add fittings during the run to find new triggers and combinations.</p>'
      : '') +
    (game.mods.length
      ? '<p class="motion-owned"><strong>Fitted:</strong> ' +
        game.mods.map((id) => escape(MODS.find((m) => m.id === id)?.name ?? id)).join(' · ') +
        '</p>'
      : '') +
    '</details>'
  );
}
