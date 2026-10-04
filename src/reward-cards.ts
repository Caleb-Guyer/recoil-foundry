import { Game } from './game.ts';
import { GUN_FINISHES, OUTFITS, drawOutfit, type Cosmetics } from './cosmetics.ts';
import { drawWeapon } from './weapon-art.ts';
import { getGun, MODS } from './rules.ts';
import { modMark } from './upgrade-icons.ts';
import { isStartingGun } from './starting-guns.ts';
import { REWARD_CATALOG } from './run-rewards.ts';
import { escapeLogbook } from './logbook-menu.ts';
import { archiveMark } from './archive-art.ts';
import { drawArchiveImages } from './archive-images.ts';

export function rewardImage(id: string, name: string) {
  return (
    '<canvas class="reward-image" width="640" height="320" role="img" aria-label="' +
    escapeLogbook(name) +
    '" data-reward-image="' +
    escapeLogbook(id) +
    '"></canvas>'
  );
}
export function rewardCards(ids: readonly string[]) {
  const rewards = REWARD_CATALOG.filter((r) => ids.includes(r.id));
  if (!rewards.length) return '';
  return (
    '<section class="run-rewards" aria-label="Rewards earned this run"><h3>Earned this run</h3><div class="reward-cards">' +
    rewards
      .map(
        (r) =>
          '<article class="reward-card">' +
          (r.image.startsWith('uprising:')
            ? archiveMark(
                r.id === 'uprising:rail-license'
                  ? 'region:railworks'
                  : r.id === 'uprising:core-license'
                    ? 'region:core'
                    : 'area:rooftops',
              )
            : r.image.startsWith('mod:')
              ? modMark(MODS.find((m) => m.id === r.id.slice(4))!)
              : rewardImage(r.image, r.name)) +
          '<small>' +
          r.label +
          '</small><strong>' +
          r.name +
          '</strong><p>' +
          escapeLogbook(r.detail) +
          '</p></article>',
      )
      .join('') +
    '</div><button id="earned-rewards" class="quiet">View rewards in Logbook ↗</button></section>'
  );
}
let weaponPreview: Game | undefined;
export function drawRewardImages(root: HTMLElement, game: Game) {
  root.querySelectorAll<HTMLCanvasElement>('canvas[data-reward-image]').forEach((canvas) => {
    const [family, slot, style] = canvas.dataset.rewardImage!.split(':');
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#111c20';
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.save();
    c.translate(320, 165);
    if (family === 'appearance' && slot === 'outfit' && Object.hasOwn(OUTFITS, style)) {
      c.scale(6, 6);
      drawOutfit(c, style as Cosmetics['outfit'], 1, 0);
    } else {
      // A separate view object prevents the reward preview from equipping anything.
      const preview = (weaponPreview ??= new Game());
      preview.cosmetics = { ...game.cosmetics };
      preview.mods = [];
      preview.time = 10;
      preview.lastShot = -99;
      preview.muzzle = 0;
      preview.startingGun = family === 'gun' && isStartingGun(slot) ? slot : game.startingGun;
      preview.gun = getGun([], preview.startingGun);
      if (family === 'appearance' && slot === 'gun' && Object.hasOwn(GUN_FINISHES, style))
        preview.cosmetics.gun = style as Cosmetics['gun'];
      c.scale(5, 5);
      c.translate(-14, 0);
      drawWeapon(c, preview, true);
    }
    c.restore();
  });
  drawArchiveImages(root);
}
