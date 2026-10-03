import type { Game } from './game.ts';
import {
  UPRISING_FORKS,
  UPRISING_DISTRICTS,
  FINALE_NAMES,
  uprisingRoute,
  uprisingFinale,
  type UprisingRouteId,
} from './uprising-model.ts';

export function uprisingMap(game: Game) {
  const run = game.uprising.run;
  if (!run) return '';
  return (
    '<ol class="uprising-map" aria-label="Factory route">' +
    UPRISING_FORKS.map((fork, i) => {
      const id = run.choices[i],
        outcome = run.outcomes.find((o) => o.route === id);
      return (
        '<li' +
        (game.stage >= fork && game.stage < (UPRISING_FORKS[i + 1] ?? 20)
          ? ' aria-current="step"'
          : '') +
        '><span>Room ' +
        (fork + 2) +
        '</span><strong>' +
        (id
          ? uprisingRoute(id).name
          : ['Railworks', 'Foundry Core', 'Reclamation', 'Rooftops'][i]) +
        '</strong><small>' +
        (outcome
          ? outcome.result === 'success'
            ? 'Complete' + (outcome.clean ? ' · no damage' : '')
            : 'Objective missed'
          : id
            ? 'Route committed'
            : 'Choose after room ' + (fork + 1)) +
        '</small></li>'
      );
    }).join('') +
    '</ol><p class="uprising-finale">Final defense: <strong>' +
    FINALE_NAMES[uprisingFinale(run)] +
    '</strong>. Successful objectives can change this response.</p>'
  );
}

export function uprisingRouteMenu(content: HTMLElement, game: Game) {
  const routes = game.uprising.choices;
  const symbols = { steal: '◇', sabotage: 'ϟ', defend: '▣', escape: '↗' };
  content.innerHTML =
    '<p class="eyebrow">FACTORY UPRISING · NEXT ROUTE</p><h2 id="dialog-title">Choose your next job.</h2><p>Four decisions. Twenty rooms. Each route rejoins the campaign after its mission.</p>' +
    uprisingMap(game) +
    '<div class="choices uprising-choices">' +
    routes
      .map(
        (r, i) =>
          '<button class="mod" data-uprising-route="' +
          r.id +
          '"><span class="uprising-symbol" aria-hidden="true">' +
          symbols[r.mission] +
          '</span><kbd>' +
          (i + 1) +
          '</kbd><strong>' +
          r.name +
          '</strong><span class="tag">' +
          UPRISING_DISTRICTS[r.district] +
          ' · ' +
          { steal: 'Recover', sabotage: 'Sabotage', defend: 'Defend', escape: 'Escape' }[
            r.mission
          ] +
          '</span><p>' +
          r.objective +
          '</p><p class="uprising-effect">' +
          r.consequence +
          '</p></button>',
      )
      .join('') +
    '</div><p class="hint">To skip a job, clear the patrol and take the exit. Route choices and completed objectives are saved. Extra routes unlock through contracts in the Logbook.</p>';
  content
    .querySelectorAll<HTMLButtonElement>('[data-uprising-route]')
    .forEach(
      (b) => (b.onclick = () => game.uprising.choose(b.dataset.uprisingRoute as UprisingRouteId)),
    );
}
