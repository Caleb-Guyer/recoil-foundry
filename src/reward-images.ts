import { Game } from './game.ts';
import { GUN_FINISHES, OUTFITS, drawOutfit, type Cosmetics } from './cosmetics.ts';
import { drawWeapon } from './weapon-art.ts';
import { getGun } from './rules.ts';
import { isStartingGun } from './starting-guns.ts';

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
      c.scale(family === 'gun' ? 8 : 5, family === 'gun' ? 8 : 5);
      c.translate(family === 'gun' ? -21 : -14, family === 'gun' ? -1 : 0);
      drawWeapon(c, preview, true);
    }
    c.restore();
  });
}
