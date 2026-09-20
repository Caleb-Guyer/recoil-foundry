export const ACTIONS = {
  left: 'Move left',
  right: 'Move right',
  jump: 'Jump',
  fire: 'Fire',
  portal: 'Secondary action',
  pause: 'Pause',
  controls: 'Controls',
  retry: 'Retry / reset',
} as const;
export type Action = keyof typeof ACTIONS;
export type Bindings = Record<Action, string[]>;
export const DEFAULT_BINDINGS: Bindings = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space', 'KeyW', 'ArrowUp'],
  fire: ['KeyF'],
  portal: ['KeyE'],
  pause: ['KeyP'],
  controls: ['KeyH'],
  retry: ['KeyR'],
};
const names: Record<string, string> = {
  Space: 'Space',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ShiftLeft: 'Left Shift',
  ShiftRight: 'Right Shift',
  Backspace: 'Backspace',
  BracketLeft: '[',
  BracketRight: ']',
  Semicolon: ';',
  Quote: "'",
  Backslash: '\\',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Minus: '−',
  Equal: '=',
  Backquote: '`',
  Home: 'Home',
  End: 'End',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  Insert: 'Insert',
  Delete: 'Delete',
};
// Menu navigation, reward numbers, browser shortcuts and Escape remain available.
export function bindable(code: string) {
  return /^(Key[A-Z]|Numpad[0-9])$/.test(code) || Object.hasOwn(names, code);
}
export function keyLabel(code: string) {
  return names[code] ?? (code.startsWith('Key') ? code.slice(3) : code.replace('Numpad', 'Num '));
}
export function loadBindings(raw: unknown): Bindings {
  const defaults = () => structuredClone(DEFAULT_BINDINGS);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults();
  const result = {} as Bindings,
    seen = new Set<string>();
  for (const action of Object.keys(ACTIONS) as Action[]) {
    const codes = (raw as Record<string, unknown>)[action];
    if (!Array.isArray(codes) || codes.length !== DEFAULT_BINDINGS[action].length)
      return defaults();
    for (const code of codes) {
      if (typeof code !== 'string' || !bindable(code) || seen.has(code)) return defaults();
      seen.add(code);
    }
    result[action] = [...codes];
  }
  return result;
}
export function rebind(
  bindings: Bindings,
  action: Action,
  slot: number,
  code: string,
): string | null {
  if (!bindable(code)) return 'That key is reserved for menus or your browser. Choose another key.';
  if (!Number.isInteger(slot) || slot < 0 || slot >= bindings[action].length)
    return 'Unknown binding.';
  for (const other of Object.keys(ACTIONS) as Action[])
    for (const [index, value] of bindings[other].entries())
      if (value === code && (other !== action || index !== slot))
        return `${keyLabel(code)} is already assigned to ${ACTIONS[other].toLowerCase()}. Choose another key.`;
  bindings[action][slot] = code;
  return null;
}
export function matches(bindings: Bindings, action: Action, code: string) {
  return bindings[action].includes(code);
}
export function held(bindings: Bindings, action: Action, keys: ReadonlySet<string>) {
  return bindings[action].some((code) => keys.has(code));
}
export function bindingLabel(bindings: Bindings, action: Action) {
  return bindings[action].map(keyLabel).join(' / ');
}
