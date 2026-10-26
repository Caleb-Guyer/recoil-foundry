import { MODS } from './rules.ts';
import type { BenchRow } from './build-bench-model.ts';

export const benchEscape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const name = (id: string) => MODS.find((mod) => mod.id === id)?.name ?? id;

export function benchListMarkup(rows: readonly BenchRow[], inspected: string | null) {
  return (
    rows
      .map(
        (row) =>
          '<button class="workshop-mod bench-choice" data-workshop-mod="' +
          row.mod.id +
          '" data-fitted="' +
          row.selected +
          '" aria-expanded="' +
          (inspected === row.mod.id) +
          '" aria-controls="bench-inspector"><span class="workshop-mod-name"><strong>' +
          benchEscape(row.mod.name) +
          '</strong><span aria-hidden="true">' +
          (row.selected ? '✓' : '↗') +
          '</span></span><span class="workshop-mod-copy">' +
          benchEscape(row.description) +
          '</span><span class="bench-availability">' +
          benchEscape(row.selected ? 'Fitted' : row.canAdd ? 'Available to fit' : row.reason) +
          '</span>' +
          (row.path ? '<span class="mod-path">' + benchEscape(row.path) + '</span>' : '') +
          '</button>',
      )
      .join('') || '<p class="practice-note">No collected upgrades match. Try another filter.</p>'
  );
}

export function benchLinksMarkup(
  ids: readonly string[],
  known: readonly string[],
  draft: readonly string[],
  missingOnly = false,
) {
  const visible = ids.filter((id) => known.includes(id));
  const hidden = ids.length - visible.length;
  return (
    visible
      .map(
        (id) =>
          '<button class="quiet bench-path-link" data-bench-link="' +
          id +
          '">' +
          benchEscape(name(id)) +
          (draft.includes(id)
            ? ' <span aria-label="fitted">✓</span>'
            : missingOnly
              ? ' · Missing'
              : '') +
          '</button>',
      )
      .join('') +
    (hidden
      ? '<span class="bench-uncollected">' +
        hidden +
        ' uncollected requirement' +
        (hidden === 1 ? '' : 's') +
        '</span>'
      : '')
  );
}

export function benchRemovalMarkup(ids: readonly string[]) {
  return (
    '<div class="bench-removal" role="note"><strong>' +
    (ids.length > 1 ? 'These fittings will be removed:' : 'This fitting will be removed:') +
    '</strong><ul>' +
    ids.map((id) => '<li>' + benchEscape(name(id)) + '</li>').join('') +
    '</ul><p>Your build changes only when you confirm.</p></div>'
  );
}
