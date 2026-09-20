import {
  ACTIONS,
  DEFAULT_BINDINGS,
  keyLabel,
  rebind,
  type Action,
  type Bindings,
} from './keyboard.ts';

export function keyboardMenu(root: HTMLElement, bindings: Bindings, save: () => void) {
  root.innerHTML =
    '<summary>Keyboard & mouse</summary><p class="controller-note">Select a key to change it. Esc cancels. Mouse aim, left-click fire, right-click secondary action and Esc to pause always work.</p><div class="binding-list"></div><p class="controller-note binding-status" role="status" aria-live="polite">Keys cannot share two actions.</p><button class="quiet binding-defaults">Restore default keys</button>';
  const list = root.querySelector<HTMLElement>('.binding-list')!;
  const status = root.querySelector<HTMLElement>('.binding-status')!;
  let capture: { action: Action; slot: number; button: HTMLButtonElement } | null = null;
  function cancel() {
    if (!capture) return false;
    capture.button.textContent = keyLabel(bindings[capture.action][capture.slot]);
    capture.button.removeAttribute('aria-pressed');
    capture = null;
    status.textContent = 'Key change canceled.';
    return true;
  }
  function render() {
    list.replaceChildren();
    for (const action of Object.keys(ACTIONS) as Action[]) {
      const row = document.createElement('div');
      row.className = 'binding-row';
      const name = document.createElement('span');
      name.textContent = ACTIONS[action];
      row.append(name);
      const buttons = document.createElement('span');
      buttons.className = 'binding-keys';
      bindings[action].forEach((code, slot) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'binding-key';
        button.textContent = keyLabel(code);
        button.setAttribute(
          'aria-label',
          `${ACTIONS[action]}, key ${slot + 1}: ${keyLabel(code)}. Change key`,
        );
        button.onclick = () => {
          cancel();
          capture = { action, slot, button };
          button.textContent = 'Press key…';
          button.setAttribute('aria-pressed', 'true');
          status.textContent = `Press a new key for ${ACTIONS[action].toLowerCase()}. Esc cancels.`;
        };
        button.onblur = cancel;
        buttons.append(button);
      });
      row.append(buttons);
      list.append(row);
    }
  }
  root.querySelector<HTMLButtonElement>('.binding-defaults')!.onclick = () => {
    cancel();
    Object.assign(bindings, structuredClone(DEFAULT_BINDINGS));
    render();
    save();
    status.textContent = 'Default keys restored.';
  };
  render();
  return {
    cancel,
    handleKey(e: KeyboardEvent) {
      if (!capture) return false;
      if (e.code === 'Tab') {
        cancel();
        return false;
      }
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        cancel();
        return true;
      }
      if (e.repeat) return true;
      const error =
        e.ctrlKey || e.metaKey || e.altKey
          ? 'Use a single key without Ctrl, Alt or Command.'
          : rebind(bindings, capture.action, capture.slot, e.code);
      if (error) {
        status.textContent = error;
        return true;
      }
      const { action, slot, button } = capture;
      capture = null;
      button.textContent = keyLabel(e.code);
      button.removeAttribute('aria-pressed');
      button.setAttribute(
        'aria-label',
        `${ACTIONS[action]}, key ${slot + 1}: ${keyLabel(e.code)}. Change key`,
      );
      save();
      status.textContent = `${ACTIONS[action]} set to ${keyLabel(e.code)}.`;
      return true;
    },
  };
}
