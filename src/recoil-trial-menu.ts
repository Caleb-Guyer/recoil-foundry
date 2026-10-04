import {
  RECOIL_TRIALS,
  type RecoilTrialKind,
  type RecoilTrialProfile,
} from './recoil-trial-rules.ts';
import { STARTING_GUNS, type StartingGun } from './starting-guns.ts';
import { MODS } from './rules.ts';
import { escapeLogbook } from './logbook-menu.ts';
import { practiceTime } from './practice-records.ts';
import type { MenuBack } from './blueprint-menu.ts';
import { loadRecoilGhosts, recoilChallenge, type RecoilChallenge } from './recoil-race-rules.ts';
import { recoilRaceMenu } from './recoil-race-menu.ts';
export function recoilTrialMenu(
  root: HTMLElement,
  profile: RecoilTrialProfile,
  guns: StartingGun[],
  start: (kind: RecoilTrialKind, gun: StartingGun, challenge?: RecoilChallenge) => void,
  exit: () => void,
  options: {
    ghosts?: unknown;
    showGhost?: boolean;
    ghostChange?(show: boolean): void;
    challenge?: RecoilChallenge;
    share?: RecoilChallenge;
    invalid?: boolean;
  } = {},
): MenuBack {
  let gun: StartingGun = 'pistol';
  let nested: MenuBack | null = null,
    showGhost = options.showGhost ?? true;
  const ghosts = loadRecoilGhosts(options.ghosts);
  function codes(
    extra: { challenge?: RecoilChallenge; share?: RecoilChallenge; invalid?: boolean } = {},
  ) {
    nested = recoilRaceMenu(root, {
      profile,
      guns,
      ...extra,
      start: (ch) => start(ch.kind, ch.gun, ch),
      exit: () => {
        nested = null;
        show();
      },
    });
  }
  function show() {
    root.innerHTML =
      '<p class="eyebrow">RECOIL TRIALS</p><h2 id="dialog-title">Find your footing.</h2><p class="practice-note">Clear a course during Campaign to practise it here. Full health, no upgrades. Your campaign save stays available.</p>' +
      (guns.length > 1
        ? '<div class="workshop-actions" aria-label="Starting gun">' +
          guns
            .map(
              (id) =>
                '<button class="quiet" data-trial-gun="' +
                id +
                '" aria-pressed="' +
                (id === gun) +
                '">' +
                STARTING_GUNS[id].name +
                '</button>',
            )
            .join('') +
          '</div>'
        : '') +
      '<label class="recoil-race-option"><input id="race-ghost" type="checkbox"' +
      (showGhost ? ' checked' : '') +
      '>Race my ghost</label>' +
      '<p class="practice-record-note">A new Practice best records your ghost. Checkpoint comparisons appear briefly during the course.</p><div class="practice-list">' +
      (Object.keys(RECOIL_TRIALS) as RecoilTrialKind[])
        .map((kind) => {
          const info = RECOIL_TRIALS[kind],
            unlocked = profile.clears.includes(kind),
            best = profile.records.find((r) => r.kind === kind && r.gun === gun && !r.mods.length),
            ghost = ghosts.find((r) => r.kind === kind && r.gun === gun);
          return (
            '<div class="recoil-course-actions"><button class="practice-fight" data-trial-course="' +
            kind +
            '"' +
            (unlocked ? '' : ' disabled') +
            '><span>' +
            info.name +
            '</span><span>' +
            (unlocked ? (best ? practiceTime(best.timeMs) : 'Start ↗') : 'Clear in Campaign') +
            (ghost ? ' · Ghost' : '') +
            '</span></button>' +
            (ghost && unlocked
              ? '<button class="quiet" data-trial-share="' +
                kind +
                '" aria-label="Share ' +
                info.name +
                ' challenge">Share</button>'
              : '') +
            '</div>' +
            (unlocked
              ? '<p class="practice-record-note">' +
                info.instruction +
                ' Mastery: clean clear ≤ ' +
                info.mastery / 1000 +
                's.' +
                (profile.mastered.includes(kind) ? ' Cosmetic earned.' : '') +
                '</p>'
              : '')
          );
        })
        .join('') +
      '</div><details class="build"><summary>Campaign records · matching gun and build</summary>' +
      (profile.records
        .filter((r) => r.mods.length)
        .map(
          (r) =>
            '<p class="practice-record-note"><strong>' +
            RECOIL_TRIALS[r.kind].name +
            ' · ' +
            practiceTime(r.timeMs) +
            '</strong><br>' +
            STARTING_GUNS[r.gun].name +
            ' · ' +
            r.shots +
            ' shots<br>' +
            escapeLogbook(r.mods.map((id) => MODS.find((m) => m.id === id)!.name).join(', ')) +
            '</p>',
        )
        .join('') || '<p class="practice-record-note">No Campaign build records yet.</p>') +
      '</details><div class="actions"><button id="recoil-import" class="quiet">Import trial challenge</button><button id="recoil-back" class="quiet">Back</button></div>';
    const checkbox = root.querySelector<HTMLInputElement>('#race-ghost')!;
    checkbox.onchange = () => {
      showGhost = checkbox.checked;
      options.ghostChange?.(showGhost);
    };
    root.querySelector<HTMLButtonElement>('#recoil-import')!.onclick = () => codes();
    root.querySelectorAll<HTMLButtonElement>('[data-trial-share]').forEach(
      (b) =>
        (b.onclick = () => {
          const ghost = ghosts.find((r) => r.kind === b.dataset.trialShare && r.gun === gun);
          if (ghost) codes({ share: recoilChallenge(ghost) });
        }),
    );
    root.querySelectorAll<HTMLButtonElement>('[data-trial-gun]').forEach(
      (b) =>
        (b.onclick = () => {
          gun = b.dataset.trialGun as StartingGun;
          show();
          root.querySelector<HTMLButtonElement>('[data-trial-gun="' + gun + '"]')?.focus();
        }),
    );
    root.querySelectorAll<HTMLButtonElement>('[data-trial-course]').forEach(
      (b) =>
        (b.onclick = () => {
          const kind = b.dataset.trialCourse as RecoilTrialKind;
          if (profile.clears.includes(kind)) start(kind, gun);
        }),
    );
    root.querySelector<HTMLButtonElement>('#recoil-back')!.onclick = exit;
  }
  if (options.challenge || options.share || options.invalid) codes(options);
  else show();
  return {
    back() {
      if (nested) return nested.back();
      exit();
      return true;
    },
  };
}
