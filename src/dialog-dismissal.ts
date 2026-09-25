// Repeated Escape presses can make a native dialog's cancel event
// non-cancelable. Handle the key before the browser's close request.
export function installDialogDismissal(
  modal: HTMLDialogElement,
  cancel: () => void,
  recover: () => void,
) {
  modal.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) cancel();
  });
  modal.addEventListener('cancel', (event) => {
    event.preventDefault();
    cancel();
  });
  // Also cover browser Back/close requests that cannot be canceled. The caller
  // distinguishes a deliberate state change from a stranded, still-active menu.
  modal.addEventListener('close', () => {
    if (!modal.open) recover();
  });
}
