import './route-preview.css';
import { BoundedCache } from './bounded-cache.ts';
import { Renderer } from './render.ts';
import { createRoutePhotographGame, destroyRoutePhotographGame } from './route-preview-photo.ts';
import { routePreviewKey, routePreviewTraits, type RoutePreview } from './route-preview.ts';

const WIDTH = 320;
const HEIGHT = 136;

// Two retained 320 x 136 real game photographs, under 350 KiB of RGBA pixels.
// Games and their physics worlds are released immediately after each picture.
export class RoutePreviewView {
  readonly root: HTMLElement;
  private readonly label: HTMLElement;
  private readonly title: HTMLElement;
  private readonly traits: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private cache = this.newCache();
  private images: HTMLCanvasElement[] = [];
  private current: RoutePreview | null = null;
  private currentKey = '';
  private stopped = false;
  private newCache() {
    return new BoundedCache<string, HTMLCanvasElement>(2, (canvas) => {
      canvas.width = canvas.height = 0;
      this.images = this.images.filter((image) => image !== canvas);
    });
  }
  constructor(parent: HTMLElement) {
    this.root = document.createElement('aside');
    this.root.className = 'route-preview';
    this.root.hidden = true;
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');
    this.root.setAttribute('aria-atomic', 'true');
    this.label = document.createElement('span');
    this.label.className = 'route-preview-label';
    this.title = document.createElement('strong');
    this.canvas = document.createElement('canvas');
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.canvas.setAttribute('aria-hidden', 'true');
    this.traits = document.createElement('span');
    this.traits.className = 'route-preview-traits';
    this.root.append(this.label, this.title, this.canvas, this.traits);
    parent.append(this.root);
  }
  private photograph(preview: RoutePreview, key: string) {
    const cached = this.cache.get(key);
    if (cached) return cached;
    const source = document.createElement('canvas');
    source.width = WIDTH;
    source.height = HEIGHT;
    const game = createRoutePhotographGame(preview);
    try {
      const renderer = new Renderer(source, game);
      // Detached canvases have no CSS layout. Fix the complete room framing.
      source.width = WIDTH;
      source.height = HEIGHT;
      renderer.width = WIDTH;
      renderer.height = HEIGHT;
      renderer.reduced = true;
      renderer.draw(0, {
        camera: { x: 0, y: 0 },
        scale: WIDTH / game.worldWidth,
        player: false,
        navigation: false,
      });
      this.images.push(source);
      this.cache.set(key, source);
      return source;
    } catch (error) {
      source.width = source.height = 0;
      throw error;
    } finally {
      destroyRoutePhotographGame(game);
    }
  }
  update(preview: RoutePreview | null) {
    if (this.stopped) return;
    if (!preview) {
      this.root.hidden = true;
      this.current = null;
      if (this.canvas.hidden) this.currentKey = '';
      return;
    }
    this.root.hidden = false;
    if (preview === this.current) return;
    this.current = preview;
    const key = routePreviewKey(preview);
    if (key === this.currentKey) return;
    this.currentKey = key;
    this.label.textContent =
      'Next room · ' + (preview.route === 'high' ? 'High route' : 'Low route');
    this.title.textContent = preview.level.name;
    this.traits.textContent = routePreviewTraits(preview.level).join(' · ');
    const context = this.canvas.getContext('2d');
    context?.clearRect(0, 0, WIDTH, HEIGHT);
    try {
      if (!context) throw new Error('Route picture context unavailable');
      context.drawImage(this.photograph(preview, key), 0, 0);
      this.canvas.hidden = false;
    } catch {
      // Geometry text remains usable if canvas allocation fails. Re-entry may retry.
      this.canvas.hidden = true;
      // Avoid retrying a failed allocation every animation frame. Leaving and
      // approaching the door again retries the photograph.
    }
  }
  dispose() {
    if (this.stopped) return;
    this.stopped = true;
    this.root.remove();
    for (const image of this.images) image.width = image.height = 0;
    this.images = [];
    this.cache = this.newCache();
    this.canvas.width = this.canvas.height = 0;
    this.current = null;
  }
}
