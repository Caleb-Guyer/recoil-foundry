import { WEAPON_REQUIREMENTS } from './weapon-unlocks.ts';
import { MODS } from './rules.ts';
import { workshopBuild } from './workshop-build.ts';
import { STARTING_GUNS, STARTING_GUN_IDS, type StartingGun } from './starting-guns.ts';
import { appearanceMenu, type AppearanceOptions } from './appearance-menu.ts';
import { blueprintMenu, type BlueprintStore, type MenuBack } from './blueprint-menu.ts';
import {
  BENCH_CATEGORIES,
  benchRows,
  benchInspect,
  benchEdit,
  type BenchCategory,
  type BenchFacet,
} from './build-bench-model.ts';
import {
  benchEscape,
  benchListMarkup,
  benchLinksMarkup,
  benchRemovalMarkup,
} from './build-bench-markup.ts';
import { inspectBuildChange } from './upgrade-inspection.ts';
import { upgradePreviewMarkup } from './upgrade-preview-markup.ts';
import type { UpgradePreviewView } from './upgrade-preview-view.ts';
import './build-bench.css';
import './operator-preview.css';

export interface BuildOptions {
  title?: string;
  note?: string;
  limit?: number;
  applyLabel?: string;
  change?: (mods: string[], startingGun: StartingGun) => void;
  startingGun?: StartingGun;
  unlockedGuns?: readonly StartingGun[];
  showStartingGuns?: boolean;
  blueprints?: BlueprintStore;
  seed?: string;
  initialBrowse?: { query?: string; category?: BenchCategory; facet?: BenchFacet };
  initialInspect?: string;
  range?: {
    value: string;
    choices: readonly { id: string; label: string; hint: string }[];
    change: (id: string) => void;
  };
}
export interface WorkshopMenuController {
  back: () => boolean;
  frame: (dt: number, now: number, reduced: boolean, active: boolean) => void;
  dispose: () => void;
}

export function workshopMenu(
  content: HTMLElement,
  known: readonly string[],
  initial: readonly string[],
  active: boolean,
  apply: (mods: string[], startingGun: StartingGun) => void,
  back: () => void,
  appearance?: AppearanceOptions,
  options: BuildOptions = {},
): WorkshopMenuController {
  const limit = options.limit ?? MODS.length;
  let draft = workshopBuild(initial, known);
  const unlockedGuns = options.unlockedGuns ?? ['pistol'];
  const allowStartingGuns = options.limit === undefined;
  const showGunSelector = allowStartingGuns && options.showStartingGuns !== false;
  let draftGun: StartingGun = allowStartingGuns ? (options.startingGun ?? 'pistol') : 'pistol';
  if (!unlockedGuns.includes(draftGun)) draftGun = 'pistol';
  let library: MenuBack | null = null;
  let inspected: string | null =
    options.initialInspect && known.includes(options.initialInspect)
      ? options.initialInspect
      : null;
  let clearPending = false;
  let lastEdit: { id: string; before: string[]; after: string[]; gun: StartingGun } | null = null;
  let preview: UpgradePreviewView | null = null;
  let appearanceView: ReturnType<typeof appearanceMenu> | null = null;
  let generation = 0;
  let stopped = false;
  const discovered = MODS.filter((mod) => known.includes(mod.id));
  const name = (id: string) => MODS.find((mod) => mod.id === id)?.name ?? id;
  content.innerHTML =
    '<h2 id="dialog-title"></h2>' +
    (appearance
      ? '<nav class="workshop-tabs" aria-label="Workshop sections"><button class="quiet" data-workshop-tab="build" aria-pressed="true">Build</button><button class="quiet" data-workshop-tab="appearance" aria-pressed="false"' +
        (appearance.unseen?.length ? ' aria-label="Appearance, new options available"' : '') +
        '>Appearance' +
        (appearance.unseen?.length
          ? ' <span class="new-badge" aria-hidden="true">New</span>'
          : '') +
        '</button></nav>'
      : '') +
    '<div id="workshop-build" class="build-bench"><p class="practice-note" id="workshop-note"></p>' +
    '<div class="bench-selectors">' +
    (showGunSelector
      ? '<label class="workshop-starter">Starting gun <select id="workshop-starting-gun" aria-label="Starting gun">' +
        STARTING_GUN_IDS.map(
          (id) =>
            '<option value="' +
            id +
            '"' +
            (unlockedGuns.includes(id) ? '' : ' disabled') +
            '>' +
            benchEscape(
              STARTING_GUNS[id].name +
                (unlockedGuns.includes(id) ? '' : ' · Locked · ' + WEAPON_REQUIREMENTS[id]),
            ) +
            '</option>',
        ).join('') +
        '</select></label>'
      : '') +
    (options.range
      ? '<label>Range scenario <select id="bench-range" aria-label="Range scenario">' +
        options.range.choices
          .map(
            (choice) =>
              '<option value="' +
              benchEscape(choice.id) +
              '">' +
              benchEscape(choice.label) +
              '</option>',
          )
          .join('') +
        '</select></label>'
      : '') +
    '</div>' +
    (options.range ? '<p id="bench-range-hint" class="practice-note"></p>' : '') +
    '<details class="bench-selected"><summary id="bench-selected-label">Fitted build</summary><div id="bench-selected-list" class="bench-chips"></div></details>' +
    '<div class="bench-browse"><label class="sr-only" for="workshop-search">Search collected upgrades by name or mechanic</label>' +
    '<input id="workshop-search" class="workshop-search" type="search" placeholder="Search name, effect or mechanic" autocomplete="off">' +
    '<div class="bench-filters"><label>Mechanic<select id="bench-category" aria-label="Filter by mechanic">' +
    BENCH_CATEGORIES.map(
      (category) =>
        '<option value="' + category.id + '">' + benchEscape(category.label) + '</option>',
    ).join('') +
    '</select></label><label>Show<select id="bench-facet" aria-label="Filter by availability"><option value="all">All collected</option><option value="compatible">Compatible</option><option value="followups">Available follow-ups</option><option value="selected">Fitted</option></select></label>' +
    '<button id="bench-reset-filters" class="quiet">Reset filters</button></div><p id="bench-results" class="bench-results" role="status"></p></div>' +
    '<section id="bench-inspector" class="bench-inspector" aria-label="Upgrade details and gun comparison" hidden></section>' +
    '<div id="workshop-list" class="workshop-list"></div></div>' +
    '<div id="workshop-appearance" hidden></div><div class="workshop-actions"><p id="workshop-status" class="workshop-status" role="status"></p>' +
    '<button id="workshop-apply" class="primary">' +
    (active ? 'Apply & reset' : 'Enter Workshop') +
    '</button>' +
    (options.blueprints ? '<button id="workshop-blueprints" class="quiet">Builds</button>' : '') +
    '<button id="workshop-clear" class="quiet">Clear build</button><button id="workshop-back" class="quiet">Back</button></div><div id="workshop-library" class="blueprint-panel" hidden></div>';
  content.querySelector<HTMLElement>('#dialog-title')!.textContent =
    options.title ?? 'The Workshop';
  content.querySelector<HTMLElement>('#workshop-note')!.textContent =
    options.note ??
    (discovered.length
      ? 'Build with upgrades you’ve collected. Inspect a fitting to compare the actual gun before changing your build.'
      : 'Collect upgrades during runs to unlock them here. You can practice with the starting gun.');
  const applyButton = content.querySelector<HTMLButtonElement>('#workshop-apply')!;
  if (options.applyLabel) applyButton.textContent = options.applyLabel;
  const list = content.querySelector<HTMLElement>('#workshop-list')!;
  const inspector = content.querySelector<HTMLElement>('#bench-inspector')!;
  const build = content.querySelector<HTMLElement>('#workshop-build')!;
  const search = content.querySelector<HTMLInputElement>('#workshop-search')!;
  const category = content.querySelector<HTMLSelectElement>('#bench-category')!;
  const facet = content.querySelector<HTMLSelectElement>('#bench-facet')!;
  const status = content.querySelector<HTMLElement>('#workshop-status')!;
  const gunSelect = content.querySelector<HTMLSelectElement>('#workshop-starting-gun');
  const clear = content.querySelector<HTMLButtonElement>('#workshop-clear')!;
  search.value = options.initialBrowse?.query ?? '';
  category.value = BENCH_CATEGORIES.some((c) => c.id === options.initialBrowse?.category)
    ? options.initialBrowse!.category!
    : 'all';
  facet.value = ['all', 'compatible', 'followups', 'selected'].includes(
    options.initialBrowse?.facet ?? '',
  )
    ? options.initialBrowse!.facet!
    : 'all';

  function stopPreview() {
    generation++;
    preview?.dispose();
    preview = null;
  }
  async function loadPreview(
    before: readonly string[],
    after: readonly string[],
    id: string,
    trigger: HTMLButtonElement,
  ) {
    stopPreview();
    const current = generation;
    const previewRoot = inspector.querySelector<HTMLElement>('.upgrade-preview')!;
    const idle = previewRoot.querySelector<HTMLElement>('.upgrade-preview-idle')!;
    idle.textContent = 'Loading gun comparison…';
    try {
      const { UpgradePreviewView } = await import('./upgrade-preview-view.ts');
      if (stopped || current !== generation || !content.isConnected || build.hidden || library)
        return;
      const mod = MODS.find((m) => m.id === id)!;
      preview = new UpgradePreviewView(
        previewRoot,
        new Map([[trigger, inspectBuildChange(before, after, mod, draftGun, options.seed)]]),
        true,
      );
      previewRoot.querySelector<HTMLElement>('figcaption')!.textContent = lastEdit
        ? 'Before edit'
        : 'Current gun';
      previewRoot.querySelector<HTMLElement>('[data-preview-after-label]')!.textContent = lastEdit
        ? 'After edit'
        : clearPending
          ? 'Empty build'
          : draft.includes(id)
            ? 'After removal'
            : 'With fitting';
    } catch {
      if (stopped || current !== generation || !content.isConnected) return;
      idle.textContent = 'Gun comparison could not load. Your build is unchanged. ';
      const retry = document.createElement('button');
      retry.className = 'quiet';
      retry.textContent = 'Retry comparison';
      retry.onclick = () => void loadPreview(before, after, id, trigger);
      idle.append(retry);
    }
  }
  function reveal(id: string, focus = true) {
    if (!known.includes(id) || !MODS.some((mod) => mod.id === id)) return;
    inspected = id;
    clearPending = false;
    lastEdit = null;
    renderInspector();
    list
      .querySelectorAll<HTMLButtonElement>('[data-workshop-mod]')
      .forEach((button) =>
        button.setAttribute('aria-expanded', String(button.dataset.workshopMod === id)),
      );
    if (focus) {
      inspector.scrollIntoView({ block: 'start' });
      inspector.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true });
    }
  }
  function closeInspection(id: string | null = inspected) {
    const fromClear = clearPending;
    inspected = null;
    clearPending = false;
    lastEdit = null;
    renderInspector();
    list
      .querySelectorAll<HTMLButtonElement>('[data-workshop-mod]')
      .forEach((button) => button.setAttribute('aria-expanded', 'false'));
    const previous = id
      ? list.querySelector<HTMLButtonElement>('[data-workshop-mod="' + id + '"]')
      : null;
    (fromClear ? clear : (previous ?? search)).focus({ preventScroll: true });
  }
  function commitEdit(before: string[], after: string[], id: string) {
    draft = [...after];
    clearPending = false;
    lastEdit = { id, before: [...before], after: [...after], gun: draftGun };
    inspected = id;
    render();
    options.change?.([...draft], draftGun);
    inspector.querySelector<HTMLButtonElement>('[data-bench-undo]')?.focus({ preventScroll: true });
  }
  function renderInspector() {
    stopPreview();
    const row = inspected ? benchInspect(inspected, known, draft, draftGun, limit) : null;
    if (!row && !clearPending) {
      inspector.hidden = true;
      inspector.replaceChildren();
      return;
    }
    inspector.hidden = false;
    const edited = lastEdit;
    const id = clearPending ? draft[0] : row!.mod.id;
    const proposal = clearPending
      ? { after: [] as string[], removed: [...draft], canApply: true, reason: '' }
      : benchEdit(draft, id, known, limit);
    const removal = clearPending || (!!row?.selected && !edited);
    const names = row ? benchLinksMarkup(row.requirements, known, draft, true) : '';
    inspector.innerHTML =
      '<div class="bench-inspector-heading"><h3 tabindex="-1">' +
      benchEscape(clearPending ? 'Clear this build?' : row!.mod.name) +
      '</h3><button class="quiet" data-bench-close aria-label="Close upgrade details">Close</button></div>' +
      (edited
        ? '<p class="bench-change-status" role="status">' +
          (edited.before.length > edited.after.length ? 'Removal applied.' : 'Fitting applied.') +
          ' Compare the actual gun before and after your edit.</p>'
        : '<p>' +
          benchEscape(
            clearPending ? 'Review every fitting that will be removed.' : row!.description,
          ) +
          '</p>') +
      (!edited && names
        ? '<div class="bench-path"><strong>Requires</strong><div class="bench-chips">' +
          names +
          '</div></div>'
        : '') +
      (!edited && row?.followups.length
        ? '<div class="bench-path"><strong>Collected follow-ups</strong><div class="bench-chips">' +
          benchLinksMarkup(row.followups, known, draft) +
          '</div></div>'
        : '') +
      (!edited && row && !row.selected && !row.canAdd
        ? '<p class="bench-conflict" role="note">' + benchEscape(row.reason) + '</p>'
        : '') +
      (!edited && removal ? benchRemovalMarkup(proposal.removed) : '') +
      (edited || proposal.canApply
        ? upgradePreviewMarkup()
        : '<p class="practice-note">Fit the collected requirements or resolve the conflict before comparing a legal change.</p>') +
      '<div class="bench-edit-actions">' +
      (edited
        ? '<button class="quiet" data-bench-undo>Undo edit</button><button class="quiet" data-bench-review>Back to fitting details</button>'
        : '<button class="primary" data-bench-edit' +
          (proposal.canApply ? '' : ' disabled') +
          '>' +
          (removal ? 'Confirm removal' : 'Fit upgrade') +
          '</button>' +
          '<button class="quiet" data-bench-cancel>' +
          (removal ? 'Keep build' : 'Cancel') +
          '</button>') +
      '</div>';
    inspector.querySelector<HTMLButtonElement>('[data-bench-close]')!.onclick = () =>
      closeInspection(id);
    inspector
      .querySelector<HTMLButtonElement>('[data-bench-cancel]')
      ?.addEventListener('click', () => closeInspection(id));
    inspector.querySelectorAll<HTMLButtonElement>('[data-bench-link]').forEach((button) => {
      button.onclick = () => reveal(button.dataset.benchLink!);
    });
    const edit = inspector.querySelector<HTMLButtonElement>('[data-bench-edit]');
    if (edit)
      edit.onclick = () => {
        if (stopped || !proposal.canApply) return;
        commitEdit([...draft], proposal.after, id);
      };
    inspector
      .querySelector<HTMLButtonElement>('[data-bench-undo]')
      ?.addEventListener('click', () => {
        if (
          !edited ||
          draftGun !== edited.gun ||
          JSON.stringify(draft) !== JSON.stringify(edited.after)
        )
          return;
        draft = workshopBuild(edited.before, known);
        lastEdit = null;
        render();
        options.change?.([...draft], draftGun);
        inspector
          .querySelector<HTMLButtonElement>('[data-bench-edit]')
          ?.focus({ preventScroll: true });
      });
    inspector
      .querySelector<HTMLButtonElement>('[data-bench-review]')
      ?.addEventListener('click', () => {
        lastEdit = null;
        clearPending = false;
        renderInspector();
        inspector
          .querySelector<HTMLButtonElement>('[data-bench-edit]')
          ?.focus({ preventScroll: true });
      });
    const trigger = edit ?? inspector.querySelector<HTMLButtonElement>('[data-bench-undo]');
    if (trigger && (edited || proposal.canApply))
      void loadPreview(edited?.before ?? draft, edited?.after ?? proposal.after, id, trigger);
  }
  function render(refreshInspector = true) {
    if (stopped) return;
    const rows = benchRows(known, draft, draftGun, {
      query: search.value,
      category: category.value as BenchCategory,
      facet: facet.value as BenchFacet,
      limit,
    });
    list.innerHTML = benchListMarkup(rows, inspected);
    content.querySelector<HTMLElement>('#bench-results')!.textContent =
      rows.length + ' of ' + discovered.length + ' collected upgrades';
    if (refreshInspector) {
      content.querySelector<HTMLElement>('#bench-selected-label')!.textContent =
        'Fitted build · ' + draft.length + ' upgrade' + (draft.length === 1 ? '' : 's');
      content.querySelector<HTMLElement>('#bench-selected-list')!.innerHTML = draft.length
        ? benchLinksMarkup(draft, known, draft)
        : '<p class="practice-note">No fittings yet. Your starting gun remains equipped.</p>';
      content
        .querySelectorAll<HTMLButtonElement>('#bench-selected-list [data-bench-link]')
        .forEach((button) => (button.onclick = () => reveal(button.dataset.benchLink!)));
      status.textContent =
        options.limit === undefined
          ? draft.length
            ? draft.length + ' fitted'
            : STARTING_GUNS[draftGun].name
          : draft.length +
            ' / ' +
            limit +
            ' fitted' +
            (draft.length > limit
              ? ' · Remove ' + (draft.length - limit) + ' to start'
              : draft.length === limit
                ? ' · Build full'
                : '');
      applyButton.disabled = draft.length > limit;
      clear.disabled = draft.length === 0;
    }
    list
      .querySelectorAll<HTMLButtonElement>('[data-workshop-mod]')
      .forEach((button) => (button.onclick = () => reveal(button.dataset.workshopMod!)));
    if (refreshInspector) renderInspector();
  }
  function changedFilter() {
    // Keep the reviewed edit and native comparison running while browsing.
    render(false);
  }
  search.oninput = changedFilter;
  category.onchange = changedFilter;
  facet.onchange = changedFilter;
  content.querySelector<HTMLButtonElement>('#bench-reset-filters')!.onclick = () => {
    search.value = '';
    category.value = facet.value = 'all';
    render(false);
    search.focus();
  };
  if (gunSelect) {
    gunSelect.value = draftGun;
    gunSelect.onchange = () => {
      draftGun = gunSelect.value as StartingGun;
      lastEdit = null;
      clearPending = false;
      render();
      options.change?.([...draft], draftGun);
    };
  }
  if (options.range) {
    const select = content.querySelector<HTMLSelectElement>('#bench-range')!;
    const selected = options.range.choices.some((choice) => choice.id === options.range!.value)
      ? options.range.value
      : (options.range.choices[0]?.id ?? '');
    select.value = selected;
    const update = () => {
      content.querySelector<HTMLElement>('#bench-range-hint')!.textContent =
        options.range!.choices.find((choice) => choice.id === select.value)?.hint ?? '';
    };
    select.onchange = () => {
      update();
      options.range!.change(select.value);
    };
    update();
  }
  clear.onclick = () => {
    if (!draft.length) return;
    clearPending = true;
    lastEdit = null;
    renderInspector();
    inspector.scrollIntoView({ block: 'nearest' });
    inspector.querySelector<HTMLButtonElement>('[data-bench-edit]')?.focus({ preventScroll: true });
  };
  applyButton.onclick = () => {
    if (draft.length <= limit) {
      stopPreview();
      apply([...draft], draftGun);
    }
  };
  content.querySelector<HTMLButtonElement>('#workshop-back')!.onclick = () => {
    stopPreview();
    back();
  };
  render();
  if (options.initialInspect && inspected) {
    reveal(inspected, false);
    queueMicrotask(() => {
      if (!stopped && content.isConnected && !build.hidden) {
        inspector.scrollIntoView({ block: 'start' });
        inspector.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true });
      }
    });
  }
  if (options.blueprints) {
    const open = content.querySelector<HTMLButtonElement>('#workshop-blueprints')!;
    const panel = content.querySelector<HTMLElement>('#workshop-library')!;
    open.onclick = () => {
      stopPreview();
      const shown = Array.from(content.children).filter(
        (element): element is HTMLElement => element instanceof HTMLElement && !element.hidden,
      );
      shown.forEach((element) => {
        element.hidden = true;
      });
      panel.hidden = false;
      const returnToEditor = () => {
        content.closest('dialog')?.setAttribute('aria-labelledby', 'dialog-title');
        library = null;
        panel.hidden = true;
        shown.forEach((element) => {
          element.hidden = false;
        });
        render();
        open.focus({ preventScroll: true });
      };
      library = blueprintMenu(
        panel,
        options.blueprints!,
        known,
        draft,
        (mods, startingGun) => {
          draft = workshopBuild(mods, known);
          draftGun = startingGun;
          if (gunSelect) gunSelect.value = draftGun;
          search.value = '';
          inspected = null;
          clearPending = false;
          lastEdit = null;
          options.change?.([...draft], draftGun);
          returnToEditor();
          build.scrollTop = 0;
        },
        returnToEditor,
        false,
        draftGun,
        allowStartingGuns,
        unlockedGuns,
      );
    };
  }
  if (appearance) {
    const appearanceTab = content.querySelector<HTMLButtonElement>(
      '[data-workshop-tab="appearance"]',
    )!;
    const viewAppearance = (appearanceView = appearanceMenu(
      content.querySelector<HTMLElement>('#workshop-appearance')!,
      {
        ...appearance,
        previewGun: draftGun,
        unlockedGuns,
        showTools: showGunSelector,
        viewed: (id) => {
          appearance.unseen = appearance.unseen?.filter((item) => item !== id);
          appearance.viewed?.(id);
          if (!appearance.unseen?.length) {
            appearanceTab.querySelector<HTMLElement>('.new-badge')?.remove();
            appearanceTab.removeAttribute('aria-label');
          }
        },
      },
    ));
    content.querySelectorAll<HTMLButtonElement>('[data-workshop-tab]').forEach((button) => {
      button.onclick = () => {
        const buildVisible = button.dataset.workshopTab === 'build';
        build.hidden = !buildVisible;
        content.querySelector<HTMLElement>('#workshop-appearance')!.hidden = buildVisible;
        if (!buildVisible) {
          stopPreview();
          viewAppearance.tool(draftGun);
          viewAppearance();
        } else renderInspector();
        for (const id of ['workshop-status', 'workshop-clear', 'workshop-blueprints']) {
          const element = content.querySelector<HTMLElement>('#' + id);
          if (element) element.hidden = !buildVisible;
        }
        button.focus();
        content
          .querySelectorAll<HTMLButtonElement>('[data-workshop-tab]')
          .forEach((tab) => tab.setAttribute('aria-pressed', String(tab === button)));
      };
    });
  }
  return {
    back: () => {
      if (library?.back()) return true;
      if (inspected || clearPending) {
        closeInspection();
        return true;
      }
      return false;
    },
    frame: (dt, now, reduced, active) => {
      preview?.frame(dt, now, reduced, active && !build.hidden && !library);
      appearanceView?.frame(dt, now, reduced, active && build.hidden && !library);
    },
    dispose: () => {
      stopped = true;
      stopPreview();
      appearanceView?.dispose();
      appearanceView = null;
    },
  };
}
