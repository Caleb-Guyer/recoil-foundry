// The first observer delivery is not a resize. A changed play area requires an
// explicit resume, with held inputs cleared, rather than advancing combat unseen.
export class DisplaySafety {
  private size = '';
  resized(width: number, height: number) {
    const size = `${Math.round(width)}:${Math.round(height)}`;
    const changed = this.size !== '' && size !== this.size;
    this.size = size;
    return changed;
  }
}

export function watchSessionEvents(
  win: EventTarget,
  doc: EventTarget,
  actions: {
    hidden: () => boolean;
    loseFocus: () => void;
    regainFocus: () => void;
    displayChanged: () => void;
  },
) {
  const visibility = () => (actions.hidden() ? actions.loseFocus() : actions.regainFocus());
  const events: [EventTarget, string, () => void][] = [
    [win, 'blur', actions.loseFocus],
    [win, 'pagehide', actions.loseFocus],
    [win, 'focus', actions.regainFocus],
    [win, 'pageshow', actions.regainFocus],
    [doc, 'visibilitychange', visibility],
    [doc, 'fullscreenchange', actions.displayChanged],
  ];
  for (const [target, event, handler] of events) target.addEventListener(event, handler);
  return () => {
    for (const [target, event, handler] of events) target.removeEventListener(event, handler);
  };
}
