import type { Game } from './game.ts';
import { COMMENDATIONS, type CommendationId } from './commendations.ts';
import { GUN_FINISHES, OUTFITS, drawOutfit, loadCosmetics, type Cosmetics } from './cosmetics.ts';
import { drawWeapon } from './weapon-art.ts';

export interface AppearanceOptions {
  game: Game;
  earned: readonly CommendationId[];
  preview: boolean;
  equip: (selection: Cosmetics) => void;
  logbook: () => void;
}
export function appearanceMenu(content: HTMLElement, options: AppearanceOptions) {
  const { game, earned } = options;
  content.innerHTML =
    '<div class="appearance-layout"><figure class="appearance-preview"><canvas width="720" height="380" role="img" aria-label="Equipped outfit and gun"></canvas>' +
    '<figcaption></figcaption></figure><div class="appearance-options"></div></div>' +
    '<div class="appearance-footer"><p role="status">' +
    (options.preview
      ? 'Sample rewards · selections are temporary.'
      : 'Equipped for all runs. Appearance only.') +
    '</p><button id="appearance-logbook" class="quiet">Commendations ↗</button></div>';
  const list = content.querySelector<HTMLElement>('.appearance-options')!;
  function render() {
    const selection = loadCosmetics(game.cosmetics, earned);
    list.innerHTML = (['gun', 'outfit'] as const)
      .map((slot) => {
        const choices = slot === 'gun' ? GUN_FINISHES : OUTFITS;
        return (
          '<fieldset><legend>' +
          (slot === 'gun' ? 'Gun finish' : 'Outfit') +
          '</legend><div class="appearance-choices">' +
          Object.entries(choices)
            .map(([id, item]) => {
              const locked = item.unlock && !earned.includes(item.unlock);
              const challenge = COMMENDATIONS.find((c) => c.id === item.unlock);
              const swatch = 'face' in item ? item.face : item.body;
              return (
                '<button class="appearance-choice" data-slot="' +
                slot +
                '" data-style="' +
                id +
                '" aria-pressed="' +
                (selection[slot] === id) +
                '"' +
                (locked ? ' disabled' : '') +
                '><span class="appearance-swatch" style="--swatch:' +
                swatch +
                '" aria-hidden="true"></span><span>' +
                item.name +
                (locked ? '<small>' + challenge!.name + '</small>' : '') +
                '</span></button>'
              );
            })
            .join('') +
          '</div></fieldset>'
        );
      })
      .join('');
    const canvas = content.querySelector('canvas')!;
    const c = canvas.getContext('2d')!;
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.save();
    c.scale(2, 2);
    c.strokeStyle = '#344443';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(28, 155);
    c.lineTo(332, 155);
    c.stroke();
    c.translate(132, 99);
    c.scale(3, 3);
    drawOutfit(c, selection.outfit, 1, 0);
    c.translate(0, -3);
    c.rotate(-0.12);
    drawWeapon(c, game, true);
    c.restore();
    const caption = OUTFITS[selection.outfit].name + ' / ' + GUN_FINISHES[selection.gun].name;
    content.querySelector('figcaption')!.textContent = caption;
    canvas.setAttribute('aria-label', caption + ' equipped preview');
    list.querySelectorAll<HTMLButtonElement>('[data-style]').forEach((button) => {
      button.onclick = () => {
        const next = loadCosmetics(
          { ...selection, [button.dataset.slot!]: button.dataset.style },
          earned,
        );
        options.equip(next);
        render();
        list
          .querySelector<HTMLButtonElement>(
            '[data-slot="' + button.dataset.slot + '"][data-style="' + button.dataset.style + '"]',
          )
          ?.focus();
      };
    });
  }
  content.querySelector<HTMLButtonElement>('#appearance-logbook')!.onclick = options.logbook;
  render();
}
