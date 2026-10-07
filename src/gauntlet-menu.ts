import type { Game } from './game.ts';
import { PRACTICE_BOSSES, type PracticeBoss } from './practice.ts';
import {
  GAUNTLET_HINTS,
  GAUNTLET_REPAIR,
  loadGauntletRecords,
  type GauntletRecord,
} from './gauntlet-rules.ts';
import { STARTING_GUNS, type StartingGun } from './starting-guns.ts';
import { MODS } from './rules.ts';
import { practiceTime } from './practice-records.ts';
import { escapeLogbook } from './logbook-menu.ts';
import { drawArchiveImages } from './archive-images.ts';
import { rewardCards, drawRewardImages } from './reward-cards.ts';
import type { MenuBack } from './blueprint-menu.ts';

const routeLabel = (r: readonly PracticeBoss[]) =>
  r.map((k) => PRACTICE_BOSSES[k].name).join(' → ');
export function gauntletSetup(
  root: HTMLElement,
  guns: StartingGun[],
  raw: unknown,
  start: (gun: StartingGun) => void,
  exit: () => void,
): MenuBack {
  let gun: StartingGun = 'pistol';
  const records = loadGauntletRecords(raw);
  function show() {
    const scores = records.filter((r) => r.gun === gun).sort((a, b) => a.timeMs - b.timeMs);
    root.innerHTML =
      '<p class="eyebrow">PRACTICE · BOSS GAUNTLET</p><h2 id="dialog-title">Five machines. One tool.</h2>' +
      '<p class="practice-note">Choose between two bosses each round. Health carries forward. Between fights, take one upgrade or repair up to ' +
      GAUNTLET_REPAIR +
      ' health. The clock counts combat only. Your Campaign save stays available.</p>' +
      '<div class="workshop-actions" aria-label="Starting gun">' +
      guns
        .map(
          (id) =>
            '<button class="quiet" data-gauntlet-gun="' +
            id +
            '" aria-pressed="' +
            (id === gun) +
            '">' +
            STARTING_GUNS[id].name +
            '</button>',
        )
        .join('') +
      '</div>' +
      '<p class="practice-record-note">Complete all five rounds to earn the Victor outfit. Best times compare the same starting gun and boss route.</p>' +
      '<details class="build"><summary>Route records · ' +
      scores.length +
      '</summary>' +
      (scores
        .map(
          (r) =>
            '<p class="practice-record-note"><strong>' +
            practiceTime(r.timeMs) +
            ' · ' +
            r.hits +
            ' hits · ' +
            r.shots +
            ' shots</strong><br>' +
            routeLabel(r.route) +
            '<br>' +
            (r.mods.length
              ? escapeLogbook(r.mods.map((id) => MODS.find((m) => m.id === id)!.name).join(', '))
              : 'Unmodified gun') +
            ' · ' +
            r.repairs +
            ' repairs</p>',
        )
        .join('') || '<p class="practice-record-note">No completed routes with this gun yet.</p>') +
      '</details>' +
      '<div class="actions"><button id="gauntlet-start" class="primary">Start Gauntlet ↗</button><button id="gauntlet-back" class="quiet">Back</button></div>';
    root.querySelectorAll<HTMLButtonElement>('[data-gauntlet-gun]').forEach(
      (b) =>
        (b.onclick = () => {
          gun = b.dataset.gauntletGun as StartingGun;
          show();
          root.querySelector<HTMLButtonElement>('[data-gauntlet-gun="' + gun + '"]')?.focus();
        }),
    );
    root.querySelector<HTMLButtonElement>('#gauntlet-start')!.onclick = () => start(gun);
    root.querySelector<HTMLButtonElement>('#gauntlet-back')!.onclick = exit;
  }
  show();
  return {
    back() {
      exit();
      return true;
    },
  };
}
export function gauntletRunMenu(
  root: HTMLElement,
  g: Game,
  options: {
    outcome: { best: boolean; records: GauntletRecord[] } | null;
    reward: boolean;
    choose(kind: PracticeBoss): void;
    restart(): void;
    exit(): void;
  },
): MenuBack {
  const s = g.gauntlet.state!;
  const progress =
    '<p class="result-line">' +
    Math.round(s.hp) +
    ' health <span>·</span> ' +
    practiceTime(s.timeMs) +
    '</p>';
  const history = s.route.length
    ? '<details class="build"><summary>Route & gun</summary><p class="practice-record-note">' +
      routeLabel(s.route) +
      '<br>' +
      STARTING_GUNS[s.gun].name +
      ' · ' +
      (s.mods.length
        ? escapeLogbook(s.mods.map((id) => MODS.find((m) => m.id === id)!.name).join(', '))
        : 'Unmodified gun') +
      ' · ' +
      s.repairs +
      ' repairs</p></details>'
    : '';
  const eyebrow =
    '<p class="eyebrow">' + (s.preview ? 'PLAYTEST · ' : 'PRACTICE · ') + 'BOSS GAUNTLET</p>';
  if (s.phase === 'route') {
    root.innerHTML =
      eyebrow +
      '<h2 id="dialog-title">Choose boss ' +
      (s.cleared + 1) +
      ' of 5.</h2>' +
      progress +
      '<div class="gauntlet-grid">' +
      g.gauntlet.choices
        .map(
          (k) =>
            '<button class="gauntlet-choice" data-gauntlet-boss="' +
            k +
            '">' +
            '<canvas width="640" height="320" role="img" aria-label="' +
            PRACTICE_BOSSES[k].name +
            '" data-archive-image="enemy:' +
            k +
            '"></canvas><strong>' +
            PRACTICE_BOSSES[k].name +
            '</strong><span>' +
            GAUNTLET_HINTS[k] +
            '</span></button>',
        )
        .join('') +
      '</div>' +
      history +
      '<p class="practice-record-note">No healing on entry. You keep this gun throughout the Gauntlet.' +
      (s.preview ? ' Playtest: records and rewards stay untouched.' : '') +
      '</p>';
    root
      .querySelectorAll<HTMLButtonElement>('[data-gauntlet-boss]')
      .forEach((b) => (b.onclick = () => options.choose(b.dataset.gauntletBoss as PracticeBoss)));
    drawArchiveImages(root);
  } else if (s.phase === 'service') {
    root.innerHTML =
      eyebrow +
      '<h2 id="dialog-title">Upgrade or repair.</h2>' +
      progress +
      '<p class="practice-record-note">Boss ' +
      s.cleared +
      ' of 5 defeated. Choose one before the next fight.</p><div class="gauntlet-grid">' +
      s.offers
        .map((id) => {
          const m = MODS.find((m) => m.id === id)!;
          return (
            '<button class="gauntlet-choice gauntlet-service" data-gauntlet-service="' +
            id +
            '"><strong>' +
            m.name +
            '</strong><span>' +
            m.description +
            '</span></button>'
          );
        })
        .join('') +
      '<button class="gauntlet-choice gauntlet-service" data-gauntlet-service="repair"' +
      (s.hp >= 100 ? ' disabled' : '') +
      '><strong>Repair</strong><span>' +
      (s.hp >= 100
        ? 'Health is already full.'
        : 'Recover ' +
          Math.min(GAUNTLET_REPAIR, Math.ceil(100 - s.hp)) +
          ' health. Pass up an upgrade.') +
      '</span></button></div>' +
      history;
    root
      .querySelectorAll<HTMLButtonElement>('[data-gauntlet-service]')
      .forEach((b) => (b.onclick = () => g.gauntlet.service(b.dataset.gauntletService!)));
  } else {
    const won = s.phase === 'complete';
    root.innerHTML =
      eyebrow +
      '<h2 id="dialog-title">' +
      (won ? 'Gauntlet complete.' : 'Gauntlet ended.') +
      '</h2>' +
      '<p class="result-line">' +
      s.cleared +
      ' / 5 bosses <span>·</span> ' +
      practiceTime(s.timeMs) +
      '</p><p class="practice-record-note">' +
      s.hits +
      ' hits · ' +
      s.shots +
      ' shots. ' +
      (s.preview
        ? 'Playtest: no records or rewards saved.'
        : won
          ? options.outcome
            ? options.outcome.best
              ? 'Best time for this gun and route.'
              : 'Completed. Your faster route record remains.'
            : 'Record could not be saved. Check Progress in Settings.'
          : 'Restart begins with full health and an unmodified gun.') +
      '</p>' +
      history +
      (options.reward ? rewardCards(['appearance:outfit:victor', 'gun:repeater']) : '') +
      '<div class="actions"><button id="gauntlet-restart" class="primary">Restart Gauntlet ↗</button></div>';
    root.querySelector<HTMLButtonElement>('#gauntlet-restart')!.onclick = options.restart;
    drawRewardImages(root, g);
  }
  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.innerHTML =
    '<button id="gauntlet-quit" class="quiet">' +
    (s.phase === 'complete' || s.phase === 'dead' ? 'Menu' : 'Quit Gauntlet') +
    '</button>';
  root.append(actions);
  root.querySelector<HTMLButtonElement>('#gauntlet-quit')!.onclick = options.exit;
  return {
    back() {
      options.exit();
      return true;
    },
  };
}
