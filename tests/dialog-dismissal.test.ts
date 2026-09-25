import test from 'node:test';
import assert from 'node:assert/strict';
import { installDialogDismissal } from '../src/dialog-dismissal.ts';

class Dialog extends EventTarget {
  open = true;
}
const key = (name = 'Escape', repeat = false) =>
  Object.assign(new Event('keydown', { cancelable: true, bubbles: true }), {
    key: name,
    repeat,
  });

test('every Escape, including repeats, prevents native forced dismissal of a pending reward', () => {
  const modal = new Dialog();
  let canceled = 0;
  installDialogDismissal(
    modal as unknown as HTMLDialogElement,
    () => canceled++,
    () => {},
  );
  for (const repeat of [false, false, true, true, false]) {
    const event = key('Escape', repeat);
    modal.dispatchEvent(event);
    assert(event.defaultPrevented);
    assert(modal.open);
  }
  assert.equal(canceled, 3);
  const choose = key('1');
  modal.dispatchEvent(choose);
  assert(!choose.defaultPrevented, 'upgrade shortcuts keep working');
});

test('native Back/cancel requests use the game handler and forced closure recovers the active menu', () => {
  const modal = new Dialog();
  let active = true,
    canceled = 0,
    recovered = 0;
  installDialogDismissal(
    modal as unknown as HTMLDialogElement,
    () => canceled++,
    () => {
      if (active) {
        recovered++;
        modal.open = true;
      }
    },
  );
  const cancel = new Event('cancel', { cancelable: true });
  modal.dispatchEvent(cancel);
  assert(cancel.defaultPrevented);
  modal.dispatchEvent(new Event('cancel'));
  assert.equal(canceled, 2);
  modal.open = false;
  modal.dispatchEvent(new Event('close'));
  assert(modal.open);
  assert.equal(recovered, 1);
  // A queued close from a previous menu must not rebuild an already-open one.
  modal.dispatchEvent(new Event('close'));
  assert.equal(recovered, 1);
  active = false;
  modal.open = false;
  modal.dispatchEvent(new Event('close'));
  assert(!modal.open, 'choosing an upgrade or leaving a menu remains possible');
});
