import {
  WEAPON_REQUIREMENTS,
  weaponChallengeStatus,
  loadWeaponUnlocks,
  type WeaponUnlocks,
} from './weapon-unlocks.ts';
import { escapeLogbook } from './html.ts';
import { STARTING_GUN_IDS, STARTING_GUNS, type StartingGun } from './starting-guns.ts';

export interface StartingGunMenuOptions {
  tryTool?: (gun: StartingGun) => void;
  onSelect?: (gun: StartingGun) => void;
  profile?: WeaponUnlocks;
}
export function startingGunMenu(
  root: HTMLElement,
  selected: StartingGun,
  play: (gun: StartingGun) => void,
  back: () => void,
  unlocked: readonly StartingGun[] = ['pistol'],
  options: StartingGunMenuOptions = {},
) {
  if (!unlocked.includes(selected)) selected = 'pistol';
  root.innerHTML =
    '<p class="eyebrow">CAMPAIGN · STARTING GUN</p><h2 id="dialog-title">Choose your tool.</h2>' +
    '<p class="starting-gun-intro">Build it your way. Every gun uses the same upgrade pool.</p>' +
    '<div class="starting-gun-choices" role="group" aria-label="Starting gun">' +
    STARTING_GUN_IDS.map((id) => {
      const gun = STARTING_GUNS[id];
      const locked = !unlocked.includes(id);
      const challenge = locked
        ? weaponChallengeStatus(id, options.profile ?? loadWeaponUnlocks(null))
        : null;
      const challengeProgress = challenge
        ? `<div class="logbook-goal starting-gun-challenge" data-weapon-challenge="${id}"><strong>${escapeLogbook(challenge.name)}</strong><progress max="${challenge.target}" value="${challenge.current}" aria-label="${escapeLogbook(gun.name + ' best attempt: ' + challenge.requirement)}"></progress><span>Best attempt · ${challenge.current} / ${challenge.target} ${escapeLogbook(challenge.unit)}</span><p>${id === 'switchjack' ? 'One damage-free flight, then a safe landing. ' : 'One room; best attempt, not a total. '}Campaign or Daily.${id === 'switchjack' && !challenge.complete && challenge.current >= challenge.target ? ' Safe landing still required to unlock.' : ''}</p></div>`
        : '';
      return `<div class="starting-gun-option"><button type="button" class="starting-gun-choice" data-starting-gun="${id}" aria-pressed="${id === selected}" aria-label="${gun.name}. ${locked ? 'Locked · ' + WEAPON_REQUIREMENTS[id] : gun.trait}. ${gun.description}" ${locked ? 'disabled' : ''}><canvas width="640" height="320" aria-hidden="true" data-reward-image="gun:${id}"></canvas><strong>${gun.name}</strong><span>${locked ? 'Locked · ' + WEAPON_REQUIREMENTS[id] : gun.trait}</span></button>${challengeProgress}${locked && options.tryTool ? `<button type="button" class="quiet starting-gun-try" data-try-locked-gun="${id}" aria-label="Try ${gun.name} in a private range">Try tool</button>` : ''}</div>`;
    }).join('') +
    '</div><p class="starting-gun-detail" id="starting-gun-detail" aria-live="polite">' +
    STARTING_GUNS[selected].description +
    '</p><div class="actions"><button id="start-with-gun" class="primary">Start run</button>' +
    (options.tryTool ? '<button id="try-tool" class="quiet">Try tool</button>' : '') +
    '<button id="starting-gun-back" class="quiet">Back</button></div>';
  const buttons = root.querySelectorAll<HTMLButtonElement>('[data-starting-gun]');
  buttons.forEach((button) => {
    button.onclick = () => {
      if (!unlocked.includes(button.dataset.startingGun as StartingGun)) return;
      selected = button.dataset.startingGun as StartingGun;
      root.querySelector<HTMLElement>('#starting-gun-detail')!.textContent =
        STARTING_GUNS[selected].description;
      buttons.forEach((choice) => choice.setAttribute('aria-pressed', String(choice === button)));
      options.onSelect?.(selected);
    };
  });
  root.querySelector<HTMLButtonElement>('#start-with-gun')!.onclick = () => {
    if (unlocked.includes(selected)) play(selected);
  };
  const trial = root.querySelector<HTMLButtonElement>('#try-tool');
  if (trial)
    trial.onclick = () => {
      if (unlocked.includes(selected)) options.tryTool?.(selected);
    };
  root.querySelectorAll<HTMLButtonElement>('[data-try-locked-gun]').forEach((button) => {
    button.onclick = () => {
      const gun = button.dataset.tryLockedGun as StartingGun;
      if (STARTING_GUN_IDS.includes(gun)) options.tryTool?.(gun);
    };
  });
  root.querySelector<HTMLButtonElement>('#starting-gun-back')!.onclick = back;
}
