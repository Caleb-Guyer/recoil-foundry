import { WEAPON_REQUIREMENTS } from './weapon-unlocks.ts';
import { STARTING_GUN_IDS, STARTING_GUNS, type StartingGun } from './starting-guns.ts';

export function startingGunMenu(
  root: HTMLElement,
  selected: StartingGun,
  play: (gun: StartingGun) => void,
  back: () => void,
  unlocked: readonly StartingGun[] = ['pistol'],
) {
  if (!unlocked.includes(selected)) selected = 'pistol';
  root.innerHTML =
    '<p class="eyebrow">CAMPAIGN · STARTING GUN</p><h2 id="dialog-title">Choose your tool.</h2>' +
    '<p class="starting-gun-intro">Build it your way. Every gun uses the same upgrade pool.</p>' +
    '<div class="starting-gun-choices" role="group" aria-label="Starting gun">' +
    STARTING_GUN_IDS.map((id) => {
      const gun = STARTING_GUNS[id];
      const locked = !unlocked.includes(id);
      return `<button type="button" class="starting-gun-choice" data-starting-gun="${id}" aria-pressed="${id === selected}" aria-label="${gun.name}. ${locked ? 'Locked · ' + WEAPON_REQUIREMENTS[id] : gun.trait}. ${gun.description}" ${locked ? 'disabled' : ''}><canvas width="640" height="320" aria-hidden="true" data-reward-image="gun:${id}"></canvas><strong>${gun.name}</strong><span>${locked ? 'Locked · ' + WEAPON_REQUIREMENTS[id] : gun.trait}</span></button>`;
    }).join('') +
    '</div><p class="starting-gun-detail" id="starting-gun-detail" aria-live="polite">' +
    STARTING_GUNS[selected].description +
    '</p><div class="actions"><button id="start-with-gun" class="primary">Start run</button><button id="starting-gun-back" class="quiet">Back</button></div>';
  const buttons = root.querySelectorAll<HTMLButtonElement>('[data-starting-gun]');
  buttons.forEach((button) => {
    button.onclick = () => {
      if (!unlocked.includes(button.dataset.startingGun as StartingGun)) return;
      selected = button.dataset.startingGun as StartingGun;
      root.querySelector<HTMLElement>('#starting-gun-detail')!.textContent =
        STARTING_GUNS[selected].description;
      buttons.forEach((choice) => choice.setAttribute('aria-pressed', String(choice === button)));
    };
  });
  root.querySelector<HTMLButtonElement>('#start-with-gun')!.onclick = () => play(selected);
  root.querySelector<HTMLButtonElement>('#starting-gun-back')!.onclick = back;
}
