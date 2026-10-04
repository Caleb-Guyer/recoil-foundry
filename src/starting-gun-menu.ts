import { STARTING_GUN_IDS, STARTING_GUNS, type StartingGun } from './starting-guns.ts';

export function startingGunMenu(
  root: HTMLElement,
  selected: StartingGun,
  play: (gun: StartingGun) => void,
  back: () => void,
) {
  root.innerHTML =
    '<p class="eyebrow">CAMPAIGN · STARTING GUN</p><h2 id="dialog-title">Choose your tool.</h2>' +
    '<p class="starting-gun-intro">Build it your way. Every gun uses the same upgrade pool.</p>' +
    '<div class="starting-gun-choices" role="group" aria-label="Starting gun">' +
    STARTING_GUN_IDS.map((id) => {
      const gun = STARTING_GUNS[id];
      const shape =
        id === 'shotgun'
          ? '<path d="M12 13h26l10-4h8v14h-8l-10-4H12zM19 20v9h8v-9"/>'
          : id === 'nailgun'
            ? '<path d="M10 12h43v8H10zM18 20v10h10V20M37 10V6m6 4V6m6 4V6"/>'
            : '<path d="M13 12h39v8H13zM19 20v9h9V20"/>';
      return `<button type="button" class="starting-gun-choice" data-starting-gun="${id}" aria-pressed="${id === selected}"><svg viewBox="0 0 64 36" aria-hidden="true">${shape}</svg><strong>${gun.name}</strong><span>${gun.trait}</span><p>${gun.description}</p></button>`;
    }).join('') +
    '</div><div class="actions"><button id="start-with-gun" class="primary">Start run</button><button id="starting-gun-back" class="quiet">Back</button></div>';
  const buttons = root.querySelectorAll<HTMLButtonElement>('[data-starting-gun]');
  buttons.forEach((button) => {
    button.onclick = () => {
      selected = button.dataset.startingGun as StartingGun;
      buttons.forEach((choice) => choice.setAttribute('aria-pressed', String(choice === button)));
    };
  });
  root.querySelector<HTMLButtonElement>('#start-with-gun')!.onclick = () => play(selected);
  root.querySelector<HTMLButtonElement>('#starting-gun-back')!.onclick = back;
}
