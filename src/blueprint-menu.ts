import {
  BLUEPRINT_NAME_LIMIT,
  BLUEPRINT_CODE_LIMIT,
  loadBlueprints,
  setBlueprint,
  blueprintCode,
  parseBlueprintCode,
  blueprintPreview,
  validBlueprintMods,
  type Blueprint,
  type BlueprintSlots,
} from './blueprints.ts';

export interface BlueprintStore {
  read(): BlueprintSlots;
  write(slots: BlueprintSlots): Promise<boolean>;
}
export interface MenuBack {
  back(): boolean;
}
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );

export function blueprintMenu(
  root: HTMLElement,
  store: BlueprintStore,
  known: readonly string[],
  current: readonly string[],
  load: ((mods: string[]) => void) | null,
  exit: () => void,
  saveOnly = false,
): MenuBack {
  let busy = false;
  let backAction = exit;
  let importText = '';
  const get = <T extends HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  function screen(title: string, body: string, actions: string, back: () => void) {
    root.closest('dialog')?.setAttribute('aria-labelledby', 'blueprint-title');
    backAction = back;
    root.innerHTML =
      '<h2 id="blueprint-title">' +
      escape(title) +
      '</h2>' +
      '<div class="blueprint-scroll">' +
      body +
      '</div><p id="blueprint-status" class="blueprint-status" role="status"></p>' +
      '<div class="workshop-actions">' +
      actions +
      '<button id="blueprint-back" class="quiet">Back</button></div>';
    get<HTMLButtonElement>('blueprint-back').onclick = () => {
      if (!busy) backAction();
    };
    root
      .querySelector<HTMLElement>('input, textarea, button:not(:disabled)')
      ?.focus({ preventScroll: true });
  }
  async function commit(index: number, value: Blueprint | null) {
    if (busy) return;
    let slots: BlueprintSlots;
    try {
      slots = setBlueprint(store.read(), index, value);
    } catch (error) {
      get('blueprint-status').textContent = (error as Error).message;
      return;
    }
    busy = true;
    root.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      button.disabled = true;
    });
    const ok = await store.write(slots).catch(() => false);
    busy = false;
    if (!root.isConnected) return;
    list();
    get('blueprint-status').textContent = ok
      ? value
        ? 'Blueprint saved.'
        : 'Slot cleared.'
      : 'Could not save. Check Settings → Progress.';
  }
  function nameSlot(index: number, blueprint: Blueprint, rename = false) {
    const existing = store.read()[index];
    screen(
      rename ? 'Rename blueprint.' : existing ? 'Replace blueprint?' : 'Save blueprint.',
      (existing && !rename
        ? '<p>Replace <strong>' +
          escape(existing.name) +
          '</strong> in slot ' +
          (index + 1) +
          '?</p>'
        : '') +
        '<label for="blueprint-name">Name</label><input id="blueprint-name" class="workshop-search" maxlength="' +
        BLUEPRINT_NAME_LIMIT +
        '" autocomplete="off">',
      '<button id="blueprint-save" class="primary">' +
        (rename ? 'Rename' : existing ? 'Replace blueprint' : 'Save blueprint') +
        '</button>',
      rename ? () => detail(index) : () => list(blueprint),
    );
    const input = get<HTMLInputElement>('blueprint-name');
    input.value = rename ? blueprint.name : (existing?.name ?? blueprint.name);
    const save = () => {
      void commit(index, { name: input.value.trim(), mods: [...blueprint.mods] });
    };
    get<HTMLButtonElement>('blueprint-save').onclick = save;
    input.onkeydown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        save();
      }
    };
    input.select();
  }
  function list(pending?: Blueprint) {
    const slots = loadBlueprints(store.read());
    screen(
      pending ? 'Choose a slot.' : 'Builds.',
      (pending ? '<p class="practice-note">Choose where to save this build.</p>' : '') +
        '<div class="blueprint-slots">' +
        slots
          .map(
            (slot, i) =>
              '<button class="practice-fight" data-blueprint-slot="' +
              i +
              '"' +
              (!slot && !pending ? ' disabled' : '') +
              '><span><small>0' +
              (i + 1) +
              '</small> ' +
              escape(slot?.name ?? 'Empty slot') +
              '</span><span>' +
              (slot ? (slot.mods.length ? slot.mods.length + ' upgrades' : 'Starting gun') : '—') +
              '</span></button>',
          )
          .join('') +
        '</div>',
      pending
        ? ''
        : '<button id="blueprint-save-current" class="primary"' +
            (validBlueprintMods(current) ? '' : ' disabled') +
            '>Save current build</button>' +
            (saveOnly ? '' : '<button id="blueprint-import" class="quiet">Import code</button>'),
      pending ? (saveOnly ? exit : () => list()) : exit,
    );
    root.querySelectorAll<HTMLButtonElement>('[data-blueprint-slot]').forEach((button) => {
      button.onclick = () => {
        const i = Number(button.dataset.blueprintSlot);
        if (pending) nameSlot(i, pending);
        else detail(i);
      };
    });
    if (!pending) {
      get<HTMLButtonElement>('blueprint-save-current').onclick = () =>
        list({ name: 'Build', mods: [...current] });
      if (!saveOnly) get<HTMLButtonElement>('blueprint-import').onclick = importCode;
    }
  }
  function previewBody(blueprint: Blueprint) {
    const preview = blueprintPreview(blueprint, known);
    return (
      (preview.labels.length
        ? '<ul class="recap-build">' +
          preview.labels.map((label) => '<li>' + escape(label) + '</li>').join('') +
          '</ul>'
        : '<p>Starting gun.</p>') +
      (preview.unavailable
        ? '<p class="practice-note blueprint-note">' +
          preview.hidden +
          ' undiscovered · ' +
          preview.mods.length +
          ' usable now. Loading uses only collected upgrades with their prerequisites.</p>'
        : '')
    );
  }
  function loadAction(blueprint: Blueprint) {
    if (!load) return '';
    const preview = blueprintPreview(blueprint, known);
    return (
      '<button id="blueprint-load" class="primary"' +
      (preview.unavailable && !preview.mods.length ? ' disabled' : '') +
      '>' +
      (preview.unavailable ? 'Load available upgrades' : 'Load build') +
      '</button>'
    );
  }
  function bindLoad(blueprint: Blueprint) {
    const button = root.querySelector<HTMLButtonElement>('#blueprint-load');
    if (button && load) button.onclick = () => load(blueprintPreview(blueprint, known).mods);
  }
  function detail(index: number) {
    const blueprint = store.read()[index];
    if (!blueprint) {
      list();
      return;
    }
    screen(
      blueprint.name,
      previewBody(blueprint),
      loadAction(blueprint) +
        '<button id="blueprint-rename" class="quiet">Rename</button><button id="blueprint-share" class="quiet">Share code</button><button id="blueprint-clear" class="quiet">Clear slot</button>',
      () => list(),
    );
    bindLoad(blueprint);
    get<HTMLButtonElement>('blueprint-rename').onclick = () => nameSlot(index, blueprint, true);
    get<HTMLButtonElement>('blueprint-share').onclick = () => share(index, blueprint);
    get<HTMLButtonElement>('blueprint-clear').onclick = () => {
      screen(
        'Clear this slot?',
        '<p>' + escape(blueprint.name) + '</p>',
        '<button id="blueprint-confirm-clear" class="primary">Clear slot</button>',
        () => detail(index),
      );
      get<HTMLButtonElement>('blueprint-confirm-clear').onclick = () => {
        void commit(index, null);
      };
    };
  }
  function share(index: number, blueprint: Blueprint) {
    screen(
      'Share build.',
      '<label for="blueprint-code">Blueprint code</label><textarea id="blueprint-code" class="workshop-search blueprint-code" readonly></textarea>',
      '<button id="blueprint-copy" class="primary">Copy code</button>',
      () => detail(index),
    );
    const field = get<HTMLTextAreaElement>('blueprint-code');
    field.value = blueprintCode(blueprint.mods);
    get<HTMLButtonElement>('blueprint-copy').onclick = async () => {
      try {
        await navigator.clipboard.writeText(field.value);
        if (field.isConnected) get('blueprint-status').textContent = 'Code copied.';
      } catch {
        if (!field.isConnected) return;
        field.focus();
        field.select();
        get('blueprint-status').textContent = 'Press Ctrl+C to copy the selected code.';
      }
    };
  }
  function importCode() {
    screen(
      'Import build.',
      '<label for="blueprint-code">Blueprint code</label><textarea id="blueprint-code" class="workshop-search blueprint-code" maxlength="' +
        BLUEPRINT_CODE_LIMIT +
        '" placeholder="RF1.…" spellcheck="false"></textarea>',
      '<button id="blueprint-preview" class="primary">Preview build</button>',
      () => list(),
    );
    const field = get<HTMLTextAreaElement>('blueprint-code');
    field.value = importText;
    field.oninput = () => {
      importText = field.value;
    };
    get<HTMLButtonElement>('blueprint-preview').onclick = () => {
      let blueprint: Blueprint;
      try {
        blueprint = parseBlueprintCode(field.value);
      } catch (error) {
        get('blueprint-status').textContent = (error as Error).message;
        return;
      }
      screen(
        'Shared build.',
        previewBody(blueprint),
        loadAction(blueprint) + '<button id="blueprint-keep" class="quiet">Save blueprint</button>',
        importCode,
      );
      bindLoad(blueprint);
      get<HTMLButtonElement>('blueprint-keep').onclick = () => list(blueprint);
    };
  }
  list(saveOnly ? { name: 'Run build', mods: [...current] } : undefined);
  return {
    back() {
      if (!busy) backAction();
      return true;
    },
  };
}
