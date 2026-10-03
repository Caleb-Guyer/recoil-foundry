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
  const benefits: Record<UprisingRouteId, string> = {
    'rail-heist': 'Stolen cargo draws pursuit crews.',
    'rail-escape': 'Evacuate without a cargo pursuit.',
    'rail-guard': 'Crew cover in later boss fights.',
    'core-sabotage': 'Disable later machinery and weaken the finale.',
    'core-defense': 'Progress toward Core certification.',
    'core-recovery': 'Stolen research draws pursuit crews.',
    'crew-relief': 'Crew cover in the final fight.',
    'scrap-raid': 'Cargo pursuit changes the finale.',
    'signal-cut': 'Disable the final boss’s ring attack.',
    'roof-escape': 'Evacuate without another pursuit.',
    'roof-relief': 'Crew cover in the final fight.',
  };
  const objective = (id: UprisingRouteId) => {
    const r = uprisingRoute(id);
    return r.mission === 'steal'
      ? 'Break the case, then collect the prototype.'
      : r.mission === 'defend'
        ? 'Activate the generator. Protect it for 18 seconds.'
        : r.mission === 'escape'
          ? 'Open two route switches, then board within 40 seconds.'
          : id === 'core-sabotage'
            ? 'Destroy both relays to lower the platforms.'
            : 'Destroy both command relays.';
  };
  content.innerHTML =
    '<p class="eyebrow">NEXT JOB · ROOM ' +
    (game.stage + 2) +
    '</p><h2 id="dialog-title">' +
    UPRISING_DISTRICTS[routes[0].district] +
    '.</h2><div class="uprising-choices">' +
    routes
      .map(
        (r, i) =>
          '<button class="job-choice" data-uprising-route="' +
          r.id +
          '"><span class="job-title"><strong>' +
          r.name +
          '</strong><kbd>' +
          (i + 1) +
          '</kbd></span><span class="tag">' +
          { steal: 'Recover', sabotage: 'Sabotage', defend: 'Defend', escape: 'Escape' }[
            r.mission
          ] +
          '</span><p>' +
          objective(r.id) +
          '</p><small class="uprising-effect">' +
          benefits[r.id] +
          '</small></button>',
      )
      .join('') +
    '</div><p class="hint uprising-reward">Success restores 8 health. Skip a job from Pause.</p><details class="uprising-progress"><summary>Campaign progress</summary>' +
    uprisingMap(game) +
    '<p class="hint">Extra jobs unlock through contracts in the Logbook.</p></details>';
  content
    .querySelectorAll<HTMLButtonElement>('[data-uprising-route]')
    .forEach(
      (b) => (b.onclick = () => game.uprising.choose(b.dataset.uprisingRoute as UprisingRouteId)),
    );
}
