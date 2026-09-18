import { LOGBOOK_SECTIONS, LOGBOOK_TOTALS, logbookMatches } from './logbook.ts';
import type { LogbookEntry, LogbookSection } from './logbook.ts';
import type { Mod } from './rules.ts';

const names = {
  equipment: 'Equipment',
  machines: 'Machines',
  places: 'Places',
  records: 'Records',
};
const hints = {
  equipment: 'Collect upgrades to recover their records.',
  machines: 'Defeat machines during runs to recover their records.',
  places: 'Reach new areas to recover their records.',
  records: 'Explore the Foundry to recover more documents.',
};
export const escapeLogbook = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
const fileMark =
  '<svg class="logbook-file" viewBox="0 0 48 48" aria-hidden="true"><path d="M12 6h18l7 7v29H12zM30 6v9h7M18 23h13M18 29h13M18 35h7"/></svg>';
export interface LogbookViewState {
  section: LogbookSection;
  selected: string;
  query: string;
}
export function logbookArticle(entry: LogbookEntry, mark: (mod: Mod) => string) {
  return (
    '<div class="logbook-entry-top">' +
    (entry.mod ? mark(entry.mod) : fileMark) +
    '<div><p class="logbook-entry-label">' +
    escapeLogbook(entry.label) +
    '</p><h3 id="logbook-entry-title" tabindex="-1">' +
    escapeLogbook(entry.name) +
    '</h3></div></div>' +
    (entry.description
      ? '<p class="logbook-function">' + escapeLogbook(entry.description) + '</p>'
      : '') +
    '<div class="logbook-document"><p class="logbook-source">' +
    escapeLogbook(entry.lore[0]) +
    '</p>' +
    entry.lore[2]
      .split('\n\n')
      .map((paragraph) => '<p>' + escapeLogbook(paragraph) + '</p>')
      .join('') +
    '<p class="logbook-author">' +
    escapeLogbook(entry.lore[1]) +
    '</p></div>'
  );
}
export function logbookMenu(
  content: HTMLElement,
  entries: readonly LogbookEntry[],
  state: LogbookViewState,
  mark: (mod: Mod) => string,
  back: () => void,
  preview = false,
) {
  content.innerHTML =
    '<div class="logbook-header"><div><p class="eyebrow">FOUNDRY ARCHIVE</p><h2 id="dialog-title">Logbook.</h2></div>' +
    '<button id="back" class="quiet">Back</button></div>' +
    (preview
      ? '<p class="logbook-preview">Sample records · your collection stays unchanged.</p>'
      : '') +
    '<nav class="logbook-sections" aria-label="Logbook sections">' +
    LOGBOOK_SECTIONS.map(
      (section) =>
        '<button class="quiet" data-section="' +
        section +
        '" aria-pressed="false">' +
        names[section] +
        '</button>',
    ).join('') +
    '</nav>' +
    '<div class="logbook-layout"><section class="logbook-index" aria-label="Recovered entries">' +
    '<label class="sr-only" for="logbook-search">Find a recovered entry</label><input id="logbook-search" type="search" placeholder="Find a record" autocomplete="off" maxlength="80">' +
    '<p id="logbook-count" class="logbook-count" role="status"></p><div id="logbook-list" class="logbook-list"></div></section>' +
    '<article id="logbook-entry" class="logbook-entry" tabindex="0" data-controller-scroll="true" aria-labelledby="logbook-entry-title"></article></div>';
  const search = content.querySelector<HTMLInputElement>('#logbook-search')!;
  const list = content.querySelector<HTMLElement>('#logbook-list')!;
  const detail = content.querySelector<HTMLElement>('#logbook-entry')!;
  search.value = state.query;
  function render() {
    const sectionEntries = entries.filter((entry) => entry.section === state.section);
    const matches = logbookMatches(entries, state.section, state.query);
    const selected = matches.find((entry) => entry.id === state.selected) ?? matches[0];
    state.selected = selected?.id ?? '';
    content.querySelector<HTMLElement>('#logbook-count')!.textContent = state.query.trim()
      ? matches.length + ' matching records'
      : sectionEntries.length + ' / ' + LOGBOOK_TOTALS[state.section] + ' recovered';
    content
      .querySelectorAll<HTMLButtonElement>('[data-section]')
      .forEach((button) =>
        button.setAttribute('aria-pressed', String(button.dataset.section === state.section)),
      );
    list.innerHTML =
      matches
        .map(
          (entry) =>
            '<button class="logbook-item" data-entry="' +
            escapeLogbook(entry.id) +
            '" aria-pressed="' +
            (entry.id === state.selected) +
            '">' +
            (entry.mod ? mark(entry.mod) : fileMark) +
            '<span>' +
            escapeLogbook(entry.name) +
            '</span></button>',
        )
        .join('') +
      (!state.query.trim() && sectionEntries.length < LOGBOOK_TOTALS[state.section]
        ? '<p class="logbook-locked">' +
          (LOGBOOK_TOTALS[state.section] - sectionEntries.length) +
          ' unrecovered<br><span>' +
          hints[state.section] +
          '</span></p>'
        : '');
    detail.innerHTML = selected
      ? logbookArticle(selected, mark)
      : '<div class="logbook-empty"><h3 id="logbook-entry-title">' +
        (state.query.trim() ? 'No matching records.' : 'No records recovered.') +
        '</h3><p>' +
        (state.query.trim() ? 'Try another name or clear the search.' : hints[state.section]) +
        '</p></div>';
    detail.scrollTop = 0;
    list.querySelectorAll<HTMLButtonElement>('[data-entry]').forEach((button) => {
      button.onclick = () => {
        state.selected = button.dataset.entry!;
        render();
        // Keep keyboard/controller focus in the index; article text remains in document order.
        Array.from(list.querySelectorAll<HTMLButtonElement>('[data-entry]'))
          .find((item) => item.dataset.entry === state.selected)
          ?.focus({ preventScroll: true });
      };
    });
  }
  content.querySelectorAll<HTMLButtonElement>('[data-section]').forEach((button) => {
    button.onclick = () => {
      state.section = button.dataset.section as LogbookSection;
      state.query = search.value = '';
      state.selected = '';
      list.scrollTop = 0;
      render();
    };
  });
  search.oninput = () => {
    state.query = search.value;
    render();
  };
  content.querySelector<HTMLButtonElement>('#back')!.onclick = back;
  render();
}
