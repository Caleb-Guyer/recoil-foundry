import {
  BACKUP_LIMIT,
  parseProgressBackup,
  progressSummary,
  type ProgressStore,
  type ProgressBackup,
} from './progress.ts';

const message = (store: ProgressStore) =>
  ({
    saved: 'Progress saved in this browser.',
    saving: 'Saving progress… Keep this tab open.',
    unavailable: 'Saving is unavailable. Keep this tab open and export a backup.',
    conflict:
      'Progress changed in another tab. Export this tab’s backup if you want to keep it, then reload to use the newer save.',
    unreadable:
      'Stored progress could not be read. Restore a valid backup to recover. The original saved data will be kept for undo.',
  })[store.state];
export function progressMenu(
  root: HTMLElement,
  store: ProgressStore,
  canRestore: boolean,
  back: () => void,
  reload: () => void,
) {
  const summary = progressSummary(store.snapshot());
  root.innerHTML =
    '<h2 id="dialog-title">Progress.</h2>' +
    '<p class="progress-intro">Your progress stays in this browser on this device. Export a backup to keep a copy or move it to another browser.</p>' +
    '<p class="progress-summary"></p><p class="progress-detail">Continue restarts the current room. Upgrade choices already offered are kept.</p>' +
    '<p id="progress-state" class="progress-state" role="status"></p>' +
    '<div class="actions"><button id="export-progress" class="primary">Export backup</button><button id="import-progress" class="quiet">Import backup</button><input id="progress-file" type="file" accept=".json,application/json" hidden></div>' +
    '<div id="import-preview" class="import-preview" hidden></div><p id="progress-feedback" class="progress-feedback" role="status"></p>' +
    '<div class="actions"><button id="back" class="quiet">Back</button><button id="retry-save" class="quiet" hidden>Retry saving</button><button id="reload-progress" class="quiet" hidden>Reload saved progress</button><button id="undo-import" class="quiet" hidden>Undo restore</button></div>';
  const get = <T extends HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  root.querySelector('.progress-summary')!.textContent =
    `${summary.run} · ${summary.upgrades} upgrade${summary.upgrades === 1 ? '' : 's'} discovered · ${summary.victories} Practice ${summary.victories === 1 ? 'victory' : 'victories'}`;
  const feedback = get('progress-feedback');
  let preview: ProgressBackup | null = null;
  let selection = 0;
  let busy = false;
  const update = () => {
    if (!root.querySelector('#progress-state')) return;
    get('progress-state').textContent =
      store.state === 'unavailable' && store.blocked
        ? 'Saving is unavailable. Export this tab’s backup, then reload after allowing browser storage.'
        : message(store);
    get<HTMLButtonElement>('back').disabled = store.restoring;
    get('retry-save').hidden = store.state !== 'unavailable' || store.blocked;
    get('reload-progress').hidden = !store.blocked;
    get('undo-import').hidden = !store.canUndo;
    get<HTMLButtonElement>('undo-import').disabled = !canRestore || busy || store.blocked;
    get<HTMLButtonElement>('import-progress').disabled = !canRestore || busy || !store.canRestore;
    if (!canRestore && !feedback.textContent)
      feedback.textContent = 'Return to the menu before restoring a backup.';
  };
  get('back').onclick = back;
  get('reload-progress').onclick = reload;
  get('retry-save').onclick = async () => {
    await store.retry();
    update();
  };
  get('export-progress').onclick = () => {
    try {
      const blob = new Blob([store.backup('2.94.0')], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'recoil-foundry-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      feedback.textContent = 'Backup download started. Keep the file somewhere safe.';
    } catch (error) {
      feedback.textContent = (error as Error).message;
    }
  };
  const file = get<HTMLInputElement>('progress-file');
  get('import-progress').onclick = () => {
    file.value = '';
    file.click();
  };
  file.onchange = async () => {
    const current = ++selection;
    preview = null;
    get('import-preview').hidden = true;
    const picked = file.files?.[0];
    if (!picked) return;
    try {
      if (picked.size > BACKUP_LIMIT) throw new Error('This backup is too large (maximum 1 MB).');
      const parsed = parseProgressBackup(await picked.text());
      if (current !== selection || !file.isConnected) return;
      preview = parsed;
      const imported = progressSummary(parsed.values);
      const panel = get('import-preview');
      panel.innerHTML =
        '<strong>Restore this backup?</strong><p class="import-summary"></p><p>This replaces your current profile. You can undo this restore from Progress.</p><div class="actions"><button id="confirm-import" class="primary">Restore backup</button><button id="cancel-import" class="quiet">Cancel</button></div>';
      panel.querySelector('.import-summary')!.textContent =
        `${imported.run} · ${imported.upgrades} upgrade${imported.upgrades === 1 ? '' : 's'} · ${imported.victories} Practice ${imported.victories === 1 ? 'victory' : 'victories'} · ${imported.commendations} commendations · ${imported.runs} recent runs`;
      panel.hidden = false;
      feedback.textContent = '';
      get('cancel-import').onclick = () => {
        preview = null;
        panel.hidden = true;
        get('import-progress').focus();
      };
      get('confirm-import').onclick = async () => {
        if (!preview || busy || !canRestore) return;
        busy = true;
        get<HTMLButtonElement>('confirm-import').disabled = true;
        update();
        const ok = await store.restore(preview);
        if (ok) reload();
        else {
          busy = false;
          feedback.textContent = 'Restore failed. Your previous saved profile is unchanged.';
          update();
        }
      };
      get('cancel-import').focus();
    } catch (error) {
      if (current === selection) feedback.textContent = (error as Error).message;
    }
  };
  get('undo-import').onclick = () => {
    const panel = get('import-preview');
    panel.innerHTML =
      '<strong>Return to the profile from before the restore?</strong><p>Progress made since that restore will be replaced. Export a backup first if you want to keep it.</p><div class="actions"><button id="confirm-undo" class="primary">Undo restore</button><button id="cancel-undo" class="quiet">Cancel</button></div>';
    panel.hidden = false;
    get('cancel-undo').onclick = () => {
      panel.hidden = true;
    };
    get('confirm-undo').onclick = async () => {
      if (busy || !canRestore) return;
      busy = true;
      get<HTMLButtonElement>('confirm-undo').disabled = true;
      update();
      if (await store.undo()) reload();
      else {
        busy = false;
        feedback.textContent = 'Undo failed. Your saved profile is unchanged.';
        update();
      }
    };
    get('cancel-undo').focus();
  };
  update();
  return update;
}
