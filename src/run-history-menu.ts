import { AREAS } from './areas.ts';
import { MODS } from './rules.ts';
import { damageCauseText } from './damage-cause.ts';
import { canPracticeRunBuild, canReplayRun, reachedRoom, type RunRecap } from './run-history.ts';

export const escapeRecapText = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
const time = (seconds: number) =>
  Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
export function recapBody(run: RunRecap, index: number, known: readonly string[]) {
  const canBuild = canPracticeRunBuild(run, known),
    replay = canReplayRun(run);
  return (
    '<div class="recap-body"><dl class="recap-facts">' +
    (run.outcome === 'dead'
      ? '<dt>Ended by</dt><dd>' + escapeRecapText(damageCauseText(run.cause)) + '</dd>'
      : '') +
    '<dt>Reached</dt><dd>' +
    reachedRoom(run) +
    ' · ' +
    AREAS[run.area].name +
    '</dd>' +
    '<dt>Layout</dt><dd>' +
    escapeRecapText(run.roomName) +
    '</dd>' +
    '<dt>Run</dt><dd>' +
    time(run.elapsed) +
    ' · ' +
    run.kills +
    ' kills' +
    (run.mode === 'daily' ? ' · Daily' : '') +
    '</dd>' +
    '<dt>Seed</dt><dd class="recap-seed">' +
    escapeRecapText(run.seed) +
    '</dd></dl>' +
    '<h3>Your gun</h3>' +
    (run.mods.length
      ? '<ul class="recap-build">' +
        run.mods
          .map((id) => '<li>' + escapeRecapText(MODS.find((mod) => mod.id === id)!.name) + '</li>')
          .join('') +
        '</ul>'
      : '<p class="recap-note">Starting gun.</p>') +
    '<div class="actions"><button class="quiet" data-recap-build="' +
    index +
    '"' +
    (canBuild ? '' : ' disabled') +
    '>Try build in Workshop</button>' +
    '<button class="quiet" data-recap-replay="' +
    index +
    '"' +
    (replay ? '' : ' disabled') +
    '>Replay seed</button></div>' +
    '<p class="recap-note">' +
    (replay
      ? 'Replay starts a new run with the starting gun. Your choices can change the route and build.'
      : 'Seed replay is unavailable for this older set of game rules.') +
    (!canBuild ? ' This build needs upgrades unavailable in your collection.' : '') +
    '</p></div>'
  );
}
export function resultRecap(run: RunRecap, known: readonly string[]) {
  return (
    '<details class="run-recap"><summary>Run recap</summary>' +
    recapBody(run, 0, known) +
    '<button id="recap-history" class="quiet">Recent runs</button></details>'
  );
}
export function runHistoryMenu(records: readonly RunRecap[], known: readonly string[]) {
  return (
    '<h2 id="dialog-title">Recent runs.</h2><p class="recap-note">Last 10 finished runs · Saved on this device</p>' +
    '<div class="run-history-list">' +
    records
      .map((run, i) => {
        const date = new Date(run.finishedAt);
        const label = date.toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
        return (
          '<details class="run-recap"><summary><span class="recap-heading">' +
          (run.outcome === 'won' ? 'Escaped' : 'Lost') +
          ' · ' +
          reachedRoom(run) +
          (run.mode === 'daily' ? ' · Daily' : '') +
          '<span>' +
          time(run.elapsed) +
          '</span></span>' +
          '<time datetime="' +
          date.toISOString() +
          '">' +
          escapeRecapText(label) +
          '</time></summary>' +
          recapBody(run, i, known) +
          '</details>'
        );
      })
      .join('') +
    (!records.length ? '<p class="recap-note">Finish a run to save its recap here.</p>' : '') +
    '</div><div class="actions"><button id="back" class="primary">Back</button></div>'
  );
}
export function bindRecapActions(
  content: HTMLElement,
  records: readonly RunRecap[],
  known: readonly string[],
  replay: (run: RunRecap) => void,
  workshop: (run: RunRecap) => void,
) {
  content.querySelectorAll<HTMLButtonElement>('[data-recap-replay]').forEach((button) => {
    const run = records[Number(button.dataset.recapReplay)];
    button.onclick = () => {
      if (run && canReplayRun(run)) replay(run);
    };
  });
  content.querySelectorAll<HTMLButtonElement>('[data-recap-build]').forEach((button) => {
    const run = records[Number(button.dataset.recapBuild)];
    button.onclick = () => {
      if (run && canPracticeRunBuild(run, known)) workshop(run);
    };
  });
}
