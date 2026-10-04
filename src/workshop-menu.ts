import { WEAPON_REQUIREMENTS } from './weapon-unlocks.ts';
import {
  MODS,
  MOD_REQUIRES,
  FUSION_REQUIRES,
  availableMods,
  modPathLabel,
  modDescription,
} from './rules.ts';
import { workshopBuild } from './workshop-build.ts';
import { STARTING_GUNS, STARTING_GUN_IDS, type StartingGun } from './starting-guns.ts';
import { BRANCH_PARENTS } from './upgrade-branches.ts';
import { appearanceMenu, type AppearanceOptions } from './appearance-menu.ts';
import { blueprintMenu, type BlueprintStore, type MenuBack } from './blueprint-menu.ts';

interface BuildOptions {
  title?: string;
  note?: string;
  limit?: number;
  applyLabel?: string;
  change?: (mods: string[], startingGun: StartingGun) => void;
  startingGun?: StartingGun;
  unlockedGuns?: readonly StartingGun[];
  showStartingGuns?: boolean;
  blueprints?: BlueprintStore;
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
) {
  const limit = options.limit ?? MODS.length;
  let draft = workshopBuild(initial, known);
  const unlockedGuns = options.unlockedGuns ?? ['pistol'];
  const allowStartingGuns = options.limit === undefined;
  const showGunSelector = allowStartingGuns && options.showStartingGuns !== false;
  let draftGun: StartingGun = allowStartingGuns ? (options.startingGun ?? 'pistol') : 'pistol';
  if (!unlockedGuns.includes(draftGun)) draftGun = 'pistol';
  let library: MenuBack | null = null;
  const discovered = MODS.filter((mod) => known.includes(mod.id));
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
    '<div id="workshop-build">' +
    '<p class="practice-note" id="workshop-note"></p>' +
    (showGunSelector
      ? '<label class="workshop-starter">Starting gun <select id="workshop-starting-gun" aria-label="Starting gun">' +
        STARTING_GUN_IDS.map(
          (id) =>
            `<option value="${id}" ${unlockedGuns.includes(id) ? '' : 'disabled'}>${STARTING_GUNS[id].name}${unlockedGuns.includes(id) ? '' : ' · Locked · ' + WEAPON_REQUIREMENTS[id]}</option>`,
        ).join('') +
        '</select></label>'
      : '') +
    (discovered.length > 12
      ? '<label class="sr-only" for="workshop-search">Find a collected upgrade</label><input id="workshop-search" class="workshop-search" type="search" placeholder="Find an upgrade" autocomplete="off">'
      : '') +
    '<div id="workshop-list" class="workshop-list"></div></div>' +
    '<div id="workshop-appearance" hidden></div>' +
    '<div class="workshop-actions"><p id="workshop-status" class="workshop-status" role="status"></p><button id="workshop-apply" class="primary">' +
    (active ? 'Apply & reset' : 'Enter Workshop') +
    '</button>' +
    (options.blueprints ? '<button id="workshop-blueprints" class="quiet">Builds</button>' : '') +
    '<button id="workshop-clear" class="quiet">Clear build</button><button id="workshop-back" class="quiet">Back</button></div><div id="workshop-library" class="blueprint-panel" hidden></div>';
  content.querySelector<HTMLElement>('#dialog-title')!.textContent =
    options.title ?? 'The Workshop';
  content.querySelector<HTMLElement>('#workshop-note')!.textContent =
    options.note ??
    (discovered.length
      ? 'Build with upgrades you’ve collected. Normal path rules apply.'
      : 'Collect upgrades during runs to unlock them here. You can practice with the starting gun.');
  if (options.applyLabel)
    content.querySelector<HTMLElement>('#workshop-apply')!.textContent = options.applyLabel;
  const list = content.querySelector<HTMLElement>('#workshop-list')!;
  const search = content.querySelector<HTMLInputElement>('#workshop-search');
  const status = content.querySelector<HTMLElement>('#workshop-status')!;
  const gunSelect = content.querySelector<HTMLSelectElement>('#workshop-starting-gun');
  if (gunSelect) {
    gunSelect.value = draftGun;
    gunSelect.onchange = () => {
      draftGun = gunSelect.value as StartingGun;
      render();
      options.change?.([...draft], draftGun);
    };
  }
  const clear = content.querySelector<HTMLButtonElement>('#workshop-clear')!;
  function render() {
    const eligible = new Set(availableMods(draft, true).map((mod) => mod.id));
    const matches = discovered.filter((mod) =>
      mod.name.toLowerCase().includes(search?.value.trim().toLowerCase() ?? ''),
    );
    list.innerHTML =
      matches
        .map((mod) => {
          const picked = draft.includes(mod.id),
            compatible = picked || eligible.has(mod.id),
            full = !picked && draft.length >= limit,
            enabled = compatible && !full;
          const missing = [
            ...new Set([
              MOD_REQUIRES[mod.id],
              ...(FUSION_REQUIRES[mod.id] ?? []),
              ...(BRANCH_PARENTS[mod.id] ?? []),
            ]),
          ].filter((id) => id && !draft.includes(id));
          const reason = !compatible
            ? missing.length
              ? 'Fit ' +
                missing.map((id) => MODS.find((mod) => mod.id === id)!.name).join(' + ') +
                ' first.'
              : 'Incompatible with this build.'
            : full
              ? 'Build full. Remove an upgrade to swap.'
              : modDescription(mod, draft, draftGun);
          return (
            '<button class="workshop-mod" data-workshop-mod="' +
            mod.id +
            '" aria-pressed="' +
            picked +
            '" title="' +
            reason +
            '"' +
            (enabled ? '' : ' disabled') +
            '><span class="workshop-mod-name"><strong>' +
            mod.name +
            '</strong><span aria-hidden="true">' +
            (picked ? '✓' : '+') +
            '</span></span><span class="workshop-mod-copy">' +
            (compatible ? modDescription(mod, draft, draftGun) : reason) +
            '</span>' +
            (modPathLabel(mod.id)
              ? '<span class="mod-path">' + modPathLabel(mod.id) + '</span>'
              : '') +
            '</button>'
          );
        })
        .join('') ||
      (search?.value ? '<p class="practice-note">No collected upgrades match.</p>' : '');
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
    content.querySelector<HTMLButtonElement>('#workshop-apply')!.disabled = draft.length > limit;
    clear.disabled = draft.length === 0;
    list.querySelectorAll<HTMLButtonElement>('[data-workshop-mod]').forEach((button) => {
      button.onclick = () => {
        const id = button.dataset.workshopMod!;
        if (!draft.includes(id) && draft.length >= limit) return;
        const before = draft.length;
        draft = workshopBuild(
          draft.includes(id) ? draft.filter((mod) => mod !== id) : [...draft, id],
          known,
        );
        render();
        options.change?.([...draft], draftGun);
        if (before - draft.length > 1) status.textContent += ' · Dependent upgrades removed';
        list.querySelector<HTMLButtonElement>('[data-workshop-mod="' + id + '"]')?.focus();
      };
    });
  }
  if (search)
    search.oninput = () => {
      render();
      content.querySelector<HTMLElement>('#workshop-build')!.scrollTop = 0;
    };
  clear.onclick = () => {
    draft = [];
    render();
    options.change?.([], draftGun);
    content.querySelector<HTMLButtonElement>('#workshop-apply')!.focus();
  };
  content.querySelector<HTMLButtonElement>('#workshop-apply')!.onclick = () => {
    if (draft.length <= limit) apply([...draft], draftGun);
  };
  content.querySelector<HTMLButtonElement>('#workshop-back')!.onclick = back;
  render();
  if (options.blueprints) {
    const open = content.querySelector<HTMLButtonElement>('#workshop-blueprints')!;
    const panel = content.querySelector<HTMLElement>('#workshop-library')!;
    open.onclick = () => {
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
          if (search) search.value = '';
          render();
          options.change?.([...draft], draftGun);
          returnToEditor();
          content.querySelector<HTMLElement>('#workshop-build')!.scrollTop = 0;
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
    appearanceMenu(content.querySelector<HTMLElement>('#workshop-appearance')!, appearance);
    content.querySelectorAll<HTMLButtonElement>('[data-workshop-tab]').forEach((button) => {
      button.onclick = () => {
        const build = button.dataset.workshopTab === 'build';
        content.querySelector<HTMLElement>('#workshop-build')!.hidden = !build;
        content.querySelector<HTMLElement>('#workshop-appearance')!.hidden = build;
        if (!build && !appearance.preview) {
          appearance.viewed?.();
          button.querySelector<HTMLElement>('.new-badge')?.remove();
          button.removeAttribute('aria-label');
        }
        for (const id of ['workshop-status', 'workshop-clear', 'workshop-blueprints']) {
          const element = content.querySelector<HTMLElement>('#' + id);
          if (element) element.hidden = !build;
        }
        button.focus();
        content
          .querySelectorAll<HTMLButtonElement>('[data-workshop-tab]')
          .forEach((tab) => tab.setAttribute('aria-pressed', String(tab === button)));
      };
    });
  }
  return { back: () => library?.back() ?? false };
}
