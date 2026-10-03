import { LOGBOOK_SECTIONS } from './logbook.ts';
import type { LogbookEntry, LogbookSection } from './logbook.ts';
import type { Mod } from './rules.ts';
import { archiveMark } from './archive-art.ts';
import { archiveToken } from './archive.ts';
import { catalogMatches, CATALOG_FAMILIES, type CatalogFilter } from './logbook-catalog.ts';
import { navigateControllerMenu } from './controller-menu.ts';

const names = {
  equipment: 'Equipment',
  machines: 'Machines',
  places: 'Places',
  records: 'Records',
  commendations: 'Commendations',
};
const hints = {
  equipment: 'Encounter upgrade offers during runs to recover their records.',
  machines: 'Encounter machines during runs to recover their records.',
  places: 'Reach new areas to recover their records.',
  records: 'Explore the Foundry to recover more documents.',
  commendations: 'Earn commendations in campaign or Daily runs.',
};
export const escapeLogbook = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
const fileMark =
  '<svg class="logbook-file" viewBox="0 0 48 48" aria-hidden="true"><path d="M12 6h18l7 7v29H12zM30 6v9h7M18 23h13M18 29h13M18 35h7"/></svg>';
const commendationMark = (earned: boolean) =>
  '<svg class="logbook-file commendation-mark' +
  (earned ? ' earned' : '') +
  '" viewBox="0 0 48 48" aria-hidden="true"><path d="M15 7h18v17l-9 7-9-7zM19 30l-3 11 8-4 8 4-3-11"/>' +
  (earned ? '<path d="m19 18 4 4 7-8"/>' : '') +
  '</svg>';
const questionMark =
  '<svg class="mod-mark" viewBox="0 0 56 48" aria-hidden="true"><path d="M18 15c0-12 23-12 23 0 0 7-13 8-13 15M28 37v4"/></svg>';
const entryMark = (entry: LogbookEntry, mark: (mod: Mod) => string) =>
  entry.state === 'locked'
    ? questionMark
    : entry.mod
      ? mark(entry.mod)
      : entry.earned !== undefined
        ? commendationMark(entry.earned)
        : archiveMark(entry.id) || fileMark;
const goalMark = (entry: LogbookEntry) =>
  entry.goal
    ? '<div class="logbook-goal"><strong>' +
      (entry.goal.unlocked ? 'Unlocked for new Campaign runs' : 'Unlock progress') +
      '</strong><progress max="' +
      entry.goal.target +
      '" value="' +
      entry.goal.current +
      '" aria-label="' +
      escapeLogbook(entry.goal.requirement) +
      '"></progress><span>' +
      entry.goal.current +
      ' / ' +
      entry.goal.target +
      '</span><p>' +
      escapeLogbook(entry.goal.requirement) +
      '</p></div>'
    : '';
export interface LogbookViewState {
  section: LogbookSection;
  selected: string;
  query: string;
  filter?: CatalogFilter;
  family?: string;
}
export function logbookArticle(entry: LogbookEntry, mark: (mod: Mod) => string) {
  if (entry.state === 'unseen')
    return (
      '<div class="logbook-entry-top silhouette">' +
      entryMark(entry, mark) +
      '<div><p class="logbook-entry-label">' +
      escapeLogbook(entry.label) +
      '</p><h3 id="logbook-entry-title" tabindex="-1">' +
      escapeLogbook(entry.name) +
      '</h3></div></div><p class="logbook-function">' +
      (entry.section === 'equipment'
        ? 'Encounter this upgrade during a run to recover its function and records.'
        : entry.section === 'machines'
          ? 'Encounter this machine during a run to recover its behavior and records.'
          : entry.section === 'places'
            ? 'Reach this site during a run to recover its records.'
            : entry.section === 'commendations'
              ? 'Explore more of the Foundry to reveal this challenge.'
              : 'Explore the Foundry to recover this document.') +
      '</p>' +
      goalMark(entry)
    );
  return (
    '<div class="logbook-entry-top">' +
    entryMark(entry, mark) +
    '<div><p class="logbook-entry-label">' +
    escapeLogbook(entry.label) +
    '</p><h3 id="logbook-entry-title" tabindex="-1">' +
    escapeLogbook(entry.name) +
    '</h3></div></div>' +
    (entry.description
      ? '<p class="logbook-function">' + escapeLogbook(entry.description) + '</p>'
      : '') +
    (entry.unlock && !entry.goal && entry.unlock !== entry.description
      ? '<p class="logbook-unlock"><strong>Unlock:</strong> ' + escapeLogbook(entry.unlock) + '</p>'
      : '') +
    goalMark(entry) +
    (entry.reward
      ? '<p class="commendation-reward">' +
        escapeLogbook(entry.reward) +
        '<span>' +
        (entry.earned
          ? 'Available in Workshop → Appearance'
          : 'Complete the challenge to unlock.') +
        '</span></p>'
      : '') +
    (entry.earned ? '<button class="quiet commendation-equip">Open Appearance ↗</button>' : '') +
    (entry.earned === false || entry.state === 'locked'
      ? '<p class="logbook-locked">Report not yet filed.<br><span>Campaign and Daily runs count. Practice, Workshop and test runs do not.</span></p>'
      : '<div class="logbook-document"><p class="logbook-source">' +
        escapeLogbook(entry.lore[0]) +
        '</p>' +
        entry.lore[2]
          .split('\n\n')
          .map((paragraph) => '<p>' + escapeLogbook(paragraph) + '</p>')
          .join('') +
        '<p class="logbook-author">' +
        escapeLogbook(entry.lore[1]) +
        '</p></div>')
  );
}
export function logbookMenu(
  content: HTMLElement,
  entries: readonly LogbookEntry[],
  state: LogbookViewState,
  mark: (mod: Mod) => string,
  back: () => void,
  preview = false,
  appearance?: () => void,
  openEntry?: (entry: LogbookEntry) => void,
) {
  const opened = new Set<string>();
  const filters: { id: CatalogFilter; name: string }[] = [
    { id: 'all', name: 'All' },
    { id: 'known', name: 'Discovered' },
    { id: 'unseen', name: 'Undiscovered' },
    { id: 'locked', name: 'Locked' },
    { id: 'unread', name: 'New' },
  ];
  const unread = (entry: LogbookEntry) => !!entry.unread && !opened.has(archiveToken(entry));
  const badge = (show: boolean) =>
    show ? '<span class="new-badge" aria-hidden="true">New</span>' : '';
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
        badge(entries.some((e) => e.section === section && unread(e))) +
        '</button>',
    ).join('') +
    '</nav>' +
    '<section id="logbook-goals" class="logbook-goals" aria-label="Next goals"></section>' +
    '<div class="logbook-layout"><section class="logbook-index" aria-label="Recovered entries">' +
    '<label class="sr-only" for="logbook-search">Find a record</label><input id="logbook-search" type="search" placeholder="Find a record" autocomplete="off" maxlength="80">' +
    '<div class="logbook-filters" role="group" aria-label="Collection filters">' +
    filters
      .map(
        (f) =>
          '<button class="quiet" data-filter="' +
          f.id +
          '" aria-pressed="false">' +
          f.name +
          '</button>',
      )
      .join('') +
    '</div>' +
    '<label class="logbook-family" for="logbook-family">Upgrade family<select id="logbook-family">' +
    CATALOG_FAMILIES.map(
      (f) => '<option value="' + f.id + '">' + escapeLogbook(f.name) + '</option>',
    ).join('') +
    '</select></label>' +
    '<p id="logbook-count" class="logbook-count" role="status"></p><div id="logbook-list" class="logbook-list"></div></section>' +
    '<article id="logbook-entry" class="logbook-entry" tabindex="0" data-controller-scroll="true" aria-labelledby="logbook-entry-title"></article></div>';
  const search = content.querySelector<HTMLInputElement>('#logbook-search')!;
  const list = content.querySelector<HTMLElement>('#logbook-list')!;
  const detail = content.querySelector<HTMLElement>('#logbook-entry')!;
  search.value = state.query;
  const family = content.querySelector<HTMLSelectElement>('#logbook-family')!;
  family.value = state.family ?? 'all';
  function render() {
    const goals = entries.filter((e) => e.goal && !e.goal.unlocked);
    const goalsPanel = content.querySelector<HTMLElement>('#logbook-goals')!;
    goalsPanel.hidden = state.section !== 'equipment' || preview;
    goalsPanel.innerHTML =
      '<strong>' +
      (goals.length ? 'Next goals' : 'All five achievement fittings unlocked') +
      '</strong>' +
      goals
        .slice(0, 3)
        .map(
          (e) =>
            '<button class="quiet" data-goal="' +
            e.id +
            '">' +
            escapeLogbook(e.name) +
            '<span>' +
            e.goal!.current +
            ' / ' +
            e.goal!.target +
            '</span></button>',
        )
        .join('') +
      '<p>Campaign and Daily count toward goals. New fittings enter the next Campaign draft; existing runs keep their starting pool.</p>';
    goalsPanel.querySelectorAll<HTMLButtonElement>('[data-goal]').forEach(
      (button) =>
        (button.onclick = () => {
          state.section = 'equipment';
          state.selected = button.dataset.goal!;
          state.query = search.value = '';
          state.filter = 'locked';
          state.family = family.value = 'all';
          render();
          detail.focus();
        }),
    );
    const sectionEntries = entries.filter((entry) => entry.section === state.section);
    const filtered = entries.map((e) => ({
      ...e,
      unread: unread(e),
      state: e.state ?? ('known' as const),
    }));
    const matches = catalogMatches(
      filtered,
      state.section,
      state.query,
      state.filter,
      state.section === 'equipment' ? state.family : 'all',
    );
    const selected = sectionEntries.find((entry) => entry.id === state.selected) ?? matches[0];
    state.selected = selected?.id ?? '';
    content.querySelector<HTMLElement>('#logbook-count')!.textContent = state.query.trim()
      ? matches.length + ' matching records'
      : (state.section === 'commendations'
          ? sectionEntries.filter((entry) => entry.earned).length
          : sectionEntries.filter((e) => !e.state || e.state === 'known').length) +
        ' / ' +
        sectionEntries.length +
        (state.section === 'commendations' ? ' earned' : ' discovered') +
        ' · ' +
        matches.length +
        ' shown';
    family.parentElement!.hidden = state.section !== 'equipment';
    content
      .querySelectorAll<HTMLButtonElement>('[data-filter]')
      .forEach((button) =>
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.filter === (state.filter ?? 'all')),
        ),
      );
    content.querySelectorAll<HTMLButtonElement>('[data-section]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.section === state.section));
      const section = button.dataset.section as LogbookSection;
      button.innerHTML =
        names[section] + badge(entries.some((e) => e.section === section && unread(e)));
      button.setAttribute(
        'aria-label',
        names[section] +
          (entries.some((e) => e.section === section && unread(e)) ? ', new entries' : ''),
      );
    });
    list.innerHTML =
      matches
        .map(
          (entry) =>
            '<button class="logbook-item' +
            (entry.state === 'unseen' ? ' silhouette' : '') +
            '" data-entry="' +
            escapeLogbook(entry.id) +
            '" aria-pressed="' +
            (entry.id === state.selected) +
            '" aria-label="' +
            escapeLogbook(
              entry.name +
                ', ' +
                (entry.state === 'locked'
                  ? 'locked'
                  : entry.state === 'unseen'
                    ? entry.label.toLowerCase()
                    : 'discovered') +
                (unread(entry) ? ', new entry' : ''),
            ) +
            '">' +
            entryMark(entry, mark) +
            '<span>' +
            escapeLogbook(entry.name) +
            '</span>' +
            badge(unread(entry)) +
            '</button>',
        )
        .join('') +
      (!matches.length
        ? '<p class="logbook-locked">No matching entries.<br><span>Try another filter or clear the search.</span></p>'
        : '');
    const emptyHeading = state.query.trim()
      ? 'No matching records.'
      : state.filter === 'unread'
        ? 'No new records.'
        : state.filter === 'locked'
          ? 'No locked entries.'
          : state.filter === 'unseen'
            ? 'No undiscovered entries.'
            : 'No records recovered.';
    const emptyHint = state.query.trim()
      ? 'Try another name or clear the search.'
      : state.filter === 'unread'
        ? 'You are caught up in this view. New discoveries will appear here.'
        : state.filter === 'locked' || state.filter === 'unseen'
          ? 'Choose All to browse the records in this view.'
          : hints[state.section];
    detail.innerHTML = selected
      ? logbookArticle(selected, mark)
      : '<div class="logbook-empty"><h3 id="logbook-entry-title">' +
        emptyHeading +
        '</h3><p>' +
        emptyHint +
        '</p></div>';
    detail.scrollTop = 0;
    const equip = detail.querySelector<HTMLButtonElement>('.commendation-equip');
    if (equip) {
      equip.hidden = !appearance;
      if (appearance) equip.onclick = appearance;
    }
    list.querySelectorAll<HTMLButtonElement>('[data-entry]').forEach((button) => {
      button.onclick = () => {
        state.selected = button.dataset.entry!;
        const entry = entries.find((e) => e.id === state.selected)!;
        if (unread(entry) && !preview) {
          openEntry?.(entry);
          opened.add(archiveToken(entry));
        }
        render();
        // Keep keyboard/controller focus in the index; article text remains in document order.
        (
          Array.from(list.querySelectorAll<HTMLButtonElement>('[data-entry]')).find(
            (item) => item.dataset.entry === state.selected,
          ) ?? detail
        ).focus({ preventScroll: true });
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
    state.selected = '';
    render();
  };
  family.onchange = () => {
    state.family = family.value;
    state.selected = '';
    render();
  };
  list.onkeydown = (event) => {
    const direction = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[
      event.key
    ] as 'up' | 'down' | 'left' | 'right' | undefined;
    if (direction) {
      event.preventDefault();
      navigateControllerMenu(list, direction);
    }
  };
  content.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((button) => {
    button.onclick = () => {
      state.filter = button.dataset.filter as CatalogFilter;
      state.selected = '';
      list.scrollTop = 0;
      render();
    };
  });
  content.querySelector<HTMLButtonElement>('#back')!.onclick = back;
  render();
}
