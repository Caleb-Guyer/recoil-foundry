import type { Game } from './game.ts';
import { COMMENDATIONS, commendationVisible, type CommendationId } from './commendations.ts';
import { GUN_FINISHES, OUTFITS, loadCosmetics, type Cosmetics } from './cosmetics.ts';
import { OperatorPreviewView, operatorPreviewMarkup } from './operator-preview.ts';
import type { StartingGun } from './starting-guns.ts';
import type { AppearanceItemId } from './appearance-notices.ts';

export interface AppearanceOptions {
  game: Game;
  earned: readonly CommendationId[];
  preview: boolean;
  previewGun?: StartingGun;
  unlockedGuns?: readonly StartingGun[];
  showTools?: boolean;
  defeated?: readonly string[];
  discovered?: readonly string[];
  revealed?: readonly string[];
  unseen?: readonly AppearanceItemId[];
  viewed?: (id: AppearanceItemId) => void;
  equip: (selection: Cosmetics) => void;
  logbook: () => void;
}
export function appearanceMenu(content: HTMLElement, options: AppearanceOptions) {
  const { game, earned } = options;
  const unseen = new Set(options.unseen);
  let preview: OperatorPreviewView | null = null;
  let disposed = false;
  let previewGun = options.previewGun ?? 'pistol';
  const previewOptions = () => ({
    selection: loadCosmetics(game.cosmetics, earned),
    earned,
    gun: previewGun,
    unlockedGuns: options.unlockedGuns,
    showTools: options.showTools,
  });
  function acknowledge(id: AppearanceItemId) {
    if (!options.preview && unseen.delete(id)) options.viewed?.(id);
  }
  content.innerHTML =
    '<div class="appearance-layout"><figure class="appearance-preview operator-preview">' +
    operatorPreviewMarkup(previewOptions()) +
    '</figure><div class="appearance-options"></div></div>' +
    '<div class="appearance-footer"><p role="status">' +
    (options.preview
      ? 'Sample rewards · selections are temporary.'
      : 'Equipped for all runs. Appearance only.') +
    '</p><button id="appearance-logbook" class="quiet">Commendations ↗</button></div>';
  const list = content.querySelector<HTMLElement>('.appearance-options')!;
  function render() {
    if (disposed) return;
    const selection = loadCosmetics(game.cosmetics, earned);
    list.innerHTML = (['gun', 'outfit'] as const)
      .map((slot) => {
        const choices = slot === 'gun' ? GUN_FINISHES : OUTFITS;
        return (
          '<fieldset><legend>' +
          (slot === 'gun' ? 'Gun finish' : 'Outfit') +
          '</legend><div class="appearance-choices">' +
          Object.entries(choices)
            .filter(
              ([, item]) =>
                !item.unlock ||
                commendationVisible(
                  item.unlock,
                  options.defeated ?? [],
                  earned,
                  options.discovered,
                  options.revealed,
                ),
            )
            .map(([id, item]) => {
              const locked = item.unlock && !earned.includes(item.unlock);
              const unread = !locked && unseen.has(`${slot}:${id}` as AppearanceItemId);
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
                (unread ? ' aria-label="' + item.name + ', new appearance"' : '') +
                (locked ? ' disabled' : '') +
                '><span class="appearance-swatch" style="--swatch:' +
                swatch +
                '" aria-hidden="true"></span><span>' +
                item.name +
                (unread ? ' <span class="new-badge" aria-hidden="true">New</span>' : '') +
                (locked ? '<small>' + challenge!.name + '</small>' : '') +
                '</span></button>'
              );
            })
            .join('') +
          '</div></fieldset>'
        );
      })
      .join('');
    const caption = OUTFITS[selection.outfit].name + ' / ' + GUN_FINISHES[selection.gun].name;
    content.querySelector('figcaption')!.textContent = caption;
    preview?.update(selection);
    list.querySelectorAll<HTMLButtonElement>('[data-style]').forEach((button) => {
      button.onclick = () => {
        if (button.disabled) return;
        const next = loadCosmetics(
          { ...selection, [button.dataset.slot!]: button.dataset.style },
          earned,
        );
        options.equip(next);
        viewSelection();
        list
          .querySelector<HTMLButtonElement>(
            '[data-slot="' + button.dataset.slot + '"][data-style="' + button.dataset.style + '"]',
          )
          ?.focus();
      };
    });
  }
  function viewSelection() {
    if (disposed) return;
    const selection = loadCosmetics(game.cosmetics, earned);
    acknowledge(`gun:${selection.gun}`);
    acknowledge(`outfit:${selection.outfit}`);
    render();
    if (!preview)
      preview = new OperatorPreviewView(
        content.querySelector<HTMLElement>('.appearance-preview')!,
        previewOptions(),
      );
  }
  content.querySelector<HTMLButtonElement>('#appearance-logbook')!.onclick = options.logbook;
  render();
  return Object.assign(viewSelection, {
    frame: (dt: number, now: number, reduced: boolean, active: boolean) =>
      preview?.frame(dt, now, reduced, active),
    tool: (gun: StartingGun) => {
      if (disposed) return;
      previewGun = gun;
      preview?.tool(gun);
    },
    dispose: () => {
      disposed = true;
      preview?.dispose();
      preview = null;
    },
  });
}
