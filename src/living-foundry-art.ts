import type { Vec } from './rules.ts';
import type { LivingFoundryFrame } from './living-foundry-types.ts';
import { drawLivingDocks } from './living-foundry-docks-art.ts';
import { drawLivingFurnace } from './living-foundry-furnace-art.ts';
import { drawLivingCooling } from './living-foundry-cooling-art.ts';
import { drawLivingReclamation } from './living-foundry-reclamation-art.ts';
import { drawLivingRooftops } from './living-foundry-rooftops-art.ts';

const drawZone = {
  docks: drawLivingDocks,
  furnace: drawLivingFurnace,
  cooling: drawLivingCooling,
  reclamation: drawLivingReclamation,
  rooftops: drawLivingRooftops,
};
export function drawLivingFoundry(
  c: CanvasRenderingContext2D,
  frame: LivingFoundryFrame,
  camera: Vec,
  width: number,
  height: number,
  reduced = false,
) {
  drawZone[frame.area](c, frame, camera, width, height, reduced);
}

/** Scenery is deliberately softer than collision edges and attack warnings.
 * One reusable, bounded background raster avoids repainting high-DPI gradients
 * and factory architecture at the foreground's device-pixel resolution.
 */
export class LivingFoundryBackdrop {
  private canvas: OffscreenCanvas | null = null;
  private context: OffscreenCanvasRenderingContext2D | null = null;
  private key = '';
  draw(
    c: CanvasRenderingContext2D,
    frame: LivingFoundryFrame,
    camera: Vec,
    width: number,
    height: number,
    reduced = false,
  ) {
    if (typeof OffscreenCanvas === 'undefined' || !(width > 0 && height > 0)) {
      drawLivingFoundry(c, frame, camera, width, height, reduced);
      return;
    }
    const ratio = Math.min(1, 960 / width, 600 / height);
    const w = Math.max(1, Math.ceil(width * ratio));
    const h = Math.max(1, Math.ceil(height * ratio));
    if (!this.canvas) {
      this.canvas = new OffscreenCanvas(w, h);
      this.context = this.canvas.getContext('2d');
    }
    if (!this.context) {
      drawLivingFoundry(c, frame, camera, width, height, reduced);
      return;
    }
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.key = '';
    }
    const key = JSON.stringify([
      frame.area,
      frame.variant,
      reduced ? 0 : frame.motion,
      !reduced && frame.area === 'rooftops' && frame.wind > 0 ? frame.time : 0,
      frame.power,
      frame.coolant,
      frame.salvage,
      frame.wind,
      frame.reveal,
      frame.mirrored,
      camera.x,
      camera.y,
      width,
      height,
      reduced,
    ]);
    if (key !== this.key) {
      const source = this.context;
      source.save();
      source.setTransform(w / width, 0, 0, h / height, 0, 0);
      drawLivingFoundry(
        source as unknown as CanvasRenderingContext2D,
        frame,
        camera,
        width,
        height,
        reduced,
      );
      source.restore();
      this.key = key;
    }
    c.save();
    c.imageSmoothingEnabled = true;
    c.drawImage(this.canvas, 0, 0, width, height);
    c.restore();
  }
}
