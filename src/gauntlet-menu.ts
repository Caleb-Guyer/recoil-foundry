import type { Game } from './game.ts';
import {
  GAUNTLET_HINTS,
  GAUNTLET_REPAIR,
  loadGauntletRecords,
  type GauntletRecord,
  gauntletRouteLabel,
  gauntletChoiceName,
  type GauntletOptions,
  type GauntletChoice,
  type GauntletMode,
  type GauntletTier,
} from './gauntlet-rules.ts';
import { BOSS_REMIXES, isBossRemix, type BossRemixId } from './boss-remix-rules.ts';
import { archiveMark } from './archive-art.ts';
import { STARTING_GUNS, type StartingGun } from './starting-guns.ts';
import { MODS } from './rules.ts';
import { practiceTime } from './practice-records.ts';
import { escapeLogbook } from './logbook-menu.ts';
import { drawArchiveImages } from './archive-images.ts';
import { rewardCards, drawRewardImages } from './reward-cards.ts';
import type { MenuBack } from './blueprint-menu.ts';

const routeLabel = gauntletRouteLabel;
export function gauntletSetup(
  root: HTMLElement,
  guns: StartingGun[],
  raw: unknown,
  start: (gun: StartingGun, options: GauntletOptions) => void,
  exit: () => void,
  options: {
    seen?: readonly BossRemixId[];
    mode?: GauntletMode;
    tier?: GauntletTier;
    gun?: StartingGun;
    preview?: boolean;
    import?: () => void;
    share?: (record: GauntletRecord) => void;
  } = {},
): MenuBack {
  let gun: StartingGun = options.gun && guns.includes(options.gun) ? options.gun : 'pistol';
  let mode: GauntletMode = options.mode === 'remix' && options.seen?.length ? 'remix' : 'classic';
  let tier: GauntletTier = options.tier ?? 'standard';
  const records = loadGauntletRecords(raw);
  function show() {
    const scores = records
      .filter(
        (r) => r.gun === gun && (r.mode ?? 'classic') === mode && (r.tier ?? 'standard') === tier,
      )
      .sort((a, b) => a.timeMs - b.timeMs);
    root.innerHTML =
      '<p class="eyebrow">' +
      (options.preview ? 'ISOLATED PREVIEW' : 'PRACTICE') +
      ' · BOSS GAUNTLET</p><h2 id="dialog-title">Five machines. One tool.</h2>' +
      '<p class="practice-note">' +
      (mode === 'remix'
        ? 'Choose your arena each round.'
        : 'Choose between two bosses each round.') +
      ' Health carries forward. Between fights, take one upgrade or repair up to ' +
      GAUNTLET_REPAIR +
      ' health. The clock counts combat only. ' +
      (options.preview
        ? 'No records, rewards or unlocks are saved.'
        : 'Your Campaign save stays available.') +
      '</p>' +
      '<div class="gauntlet-selectors"><label>Route<select id="gauntlet-mode" class="workshop-search"><option value="classic"' +
      (mode === 'classic' ? ' selected' : '') +
      '>Classic</option><option value="remix"' +
      (mode === 'remix' ? ' selected' : '') +
      (options.seen?.length ? '' : ' disabled') +
      '>Remix' +
      (options.seen?.length ? '' : ' · locked') +
      '</option></select></label>' +
      (mode === 'remix'
        ? '<label>Tier<select id="gauntlet-tier" class="workshop-search"><option value="standard"' +
          (tier === 'standard' ? ' selected' : '') +
          '>Standard</option><option value="overclocked"' +
          (tier === 'overclocked' ? ' selected' : '') +
          '>Overclocked</option></select></label>'
        : '') +
      '</div>' +
      '<p class="practice-record-note">' +
      (mode === 'remix'
        ? options.seen!.length +
          ' / 10 arenas discovered. Your discovered remixes replace the standard fight for their department. ' +
          (tier === 'overclocked'
            ? 'Stronger bosses chain fully warned counter-volleys; every other recovery remains open.'
            : 'Standard uses each arena’s original warnings and recovery.')
        : 'Discover a boss remix in Campaign to open the Remix route.') +
      '</p>' +
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
      '<p class="practice-record-note">' +
      (mode === 'remix'
        ? 'Complete the Remix route to earn Circuit Runner. Finish without choosing a repair to earn Cold Steel. '
        : 'Complete all five rounds to earn the Victor outfit. ') +
      'Best times compare the same gun, route and tier.</p>' +
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
            ' repairs</p>' +
            (r.mode === 'remix' && options.share
              ? '<button class="quiet" data-gauntlet-share="' +
                records.indexOf(r) +
                '">Share challenge</button>'
              : ''),
        )
        .join('') || '<p class="practice-record-note">No completed routes with this gun yet.</p>') +
      '</details>' +
      '<div class="actions"><button id="gauntlet-start" class="primary">Start Gauntlet ↗</button>' +
      (options.import
        ? '<button id="gauntlet-import" class="quiet">Import Gauntlet challenge</button>'
        : '') +
      '<button id="gauntlet-back" class="quiet">Back</button></div>';
    root.querySelector<HTMLSelectElement>('#gauntlet-mode')!.onchange = (event) => {
      mode = (event.target as HTMLSelectElement).value as GauntletMode;
      tier = 'standard';
      show();
      root.querySelector<HTMLSelectElement>('#gauntlet-mode')?.focus();
    };
    const tierControl = root.querySelector<HTMLSelectElement>('#gauntlet-tier');
    if (tierControl)
      tierControl.onchange = () => {
        tier = tierControl.value as GauntletTier;
        show();
        root.querySelector<HTMLSelectElement>('#gauntlet-tier')?.focus();
      };
    root.querySelectorAll<HTMLButtonElement>('[data-gauntlet-share]').forEach((b) => {
      b.onclick = () => options.share?.(records[Number(b.dataset.gauntletShare)]);
    });
    const importButton = root.querySelector<HTMLButtonElement>('#gauntlet-import');
    if (importButton) importButton.onclick = () => options.import?.();
    root.querySelectorAll<HTMLButtonElement>('[data-gauntlet-gun]').forEach(
      (b) =>
        (b.onclick = () => {
          gun = b.dataset.gauntletGun as StartingGun;
          show();
          root.querySelector<HTMLButtonElement>('[data-gauntlet-gun="' + gun + '"]')?.focus();
        }),
    );
    root.querySelector<HTMLButtonElement>('#gauntlet-start')!.onclick = () =>
      start(gun, { mode, tier });
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
    rewards: readonly string[];
    choose(kind: GauntletChoice): void;
    share?: (record: GauntletRecord) => void;
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
    '<p class="eyebrow">' +
    (s.preview ? 'PLAYTEST · ' : 'PRACTICE · ') +
    (s.mode === 'remix'
      ? 'REMIX GAUNTLET · ' + (s.tier === 'overclocked' ? 'OVERCLOCKED' : 'STANDARD')
      : 'BOSS GAUNTLET') +
    '</p>' +
    (s.challenge
      ? '<p class="practice-record-note">Challenge target · ' +
        practiceTime(s.challenge.timeMs) +
        ' · ' +
        s.challenge.hits +
        ' hits</p>'
      : '');
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
            archiveMark((isBossRemix(k) ? 'remix:' : 'enemy:') + k) +
            '<strong>' +
            gauntletChoiceName(k) +
            '</strong><span>' +
            (isBossRemix(k) ? BOSS_REMIXES[k].hint : GAUNTLET_HINTS[k]) +
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
      .forEach((b) => (b.onclick = () => options.choose(b.dataset.gauntletBoss as GauntletChoice)));
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
              ? 'Best time for this gun, route and tier.'
              : 'Completed. Your faster route record remains.'
            : 'Record could not be saved. Check Progress in Settings.'
          : 'Restart begins with full health and an unmodified gun.') +
      '</p>' +
      history +
      (won && s.challenge
        ? '<p class="practice-record-note">' +
          (s.timeMs < s.challenge.timeMs
            ? 'Target beaten by ' + practiceTime(s.challenge.timeMs - s.timeMs) + '.'
            : s.timeMs === s.challenge.timeMs
              ? 'Target time matched.'
              : 'Finished ' + practiceTime(s.timeMs - s.challenge.timeMs) + ' after the target.') +
          '</p>'
        : '') +
      rewardCards(options.rewards) +
      '<div class="actions"><button id="gauntlet-restart" class="primary">Restart Gauntlet ↗</button>' +
      (won && g.gauntlet.result?.mode === 'remix' && options.share
        ? '<button id="gauntlet-share" class="quiet">Share challenge</button>'
        : '') +
      '</div>';
    root.querySelector<HTMLButtonElement>('#gauntlet-restart')!.onclick = options.restart;
    const shareButton = root.querySelector<HTMLButtonElement>('#gauntlet-share');
    if (shareButton) shareButton.onclick = () => options.share?.(g.gauntlet.result!);
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
