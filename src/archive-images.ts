import Matter from 'matter-js';
import { isHunt, huntSeed } from './hunt-rules.ts';
import { BOSS_REMIXES, isBossRemix } from './boss-remix-rules.ts';
import { Game } from './game.ts';
import { Renderer } from './render.ts';
import { createAuditorRig } from './auditor.ts';
import type { EnemyKind } from './levels.ts';
import type { Checkpoint } from './rules.ts';
import { testCheckpoint } from './practice.ts';
import { newUprising } from './uprising-model.ts';
import { isRecoilTrial, recoilTrialCheckpoint } from './recoil-trial-rules.ts';
import { isToolroomRoom } from './toolroom-layouts.ts';
import { isMachineVariant, MACHINE_VARIANTS } from './patrol-machines.ts';

const images = new Map<string, HTMLCanvasElement>();
export const ARCHIVE_STAGES: Record<string, number> = {
  'area:docks': 0,
  'area:furnace': 4,
  'area:cooling': 8,
  'area:reclamation': 12,
  'area:rooftops': 16,
  'region:annex': 8,
  'region:shutdown': 19,
  'region:railworks': 5,
  'region:core': 9,
};
export function archiveCheckpoint(id: string): Checkpoint {
  if (id.startsWith('room:') && isToolroomRoom(id.slice(5)))
    return { ...testCheckpoint('RF-C89-EXP-ROOM-' + id.slice(5), 18), version: 6, mods: [] };
  if (id.startsWith('hunt:') && isHunt(id.slice(5))) {
    const kind = id.slice(5) as import('./hunt-rules.ts').HuntKind;
    return { ...testCheckpoint(huntSeed(kind), 8), version: 6, huntTest: kind };
  }
  if (id.startsWith('remix:') && isBossRemix(id.slice(6))) {
    const remix = id.slice(6) as import('./boss-remix-rules.ts').BossRemixId;
    return {
      ...testCheckpoint('REMIX-' + remix, BOSS_REMIXES[remix].stage),
      version: 6,
      bossRemix: remix,
    };
  }
  if (id.startsWith('trial:') && isRecoilTrial(id.slice(6)))
    return recoilTrialCheckpoint(id.slice(6) as import('./recoil-trial-rules.ts').RecoilTrialKind);
  const save: Checkpoint = {
    ...testCheckpoint('ARCHIVE-PHOTO', ARCHIVE_STAGES[id] ?? 0),
    version: 6,
    mods: [],
  };
  if (id === 'region:annex') {
    save.region = 'annex';
    save.annexVersion = 6;
  }
  if (id === 'region:shutdown') save.shutdown = { disabled: [3, 7, 15], chamber: true };
  if (id === 'region:railworks' || id === 'region:core') {
    save.uprising = newUprising();
    save.uprising.choices =
      id === 'region:railworks' ? ['rail-escape'] : ['rail-escape', 'core-sabotage'];
  }
  return save;
}
export function prepareArchiveEnemy(g: Game, id: string) {
  const [family, key] = id.split(':');
  const kind = (
    family === 'enemy'
      ? key
      : family === 'elite'
        ? { shielded: 'runner', twin: 'sniper', volatile: 'flyer' }[key]
        : family === 'machine' && isMachineVariant(key)
          ? MACHINE_VARIANTS[key].kind
          : { splitter: 'runner', gunner: 'shooter', blinker: 'hopper' }[key]
  ) as EnemyKind;
  g.enemies = [];
  g.spawnEnemy(
    kind,
    0,
    kind === 'crane' ? 150 : 0,
    family === 'elite' ? (key as 'shielded' | 'twin' | 'volatile') : undefined,
    undefined,
    undefined,
    family === 'mutation' ? (key as 'splitter' | 'gunner' | 'blinker') : undefined,
    family === 'machine' && isMachineVariant(key) ? key : undefined,
  );
  const enemy = g.enemies[0];
  enemy.spawn = 0;
  enemy.timer = 1;
  enemy.aim = { x: 1, y: 0 };

  if (kind === 'auditor') enemy.auditor = createAuditorRig();
  return enemy;
}
function photograph(id: string): HTMLCanvasElement {
  const cached = images.get(id);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  const g = new Game();
  g.startTest(archiveCheckpoint(id));
  g.mode = 'paused';
  const renderer = new Renderer(canvas, g);
  canvas.width = 640;
  canvas.height = 320;
  renderer.width = 640;
  renderer.height = 320;
  renderer.reduced = true;
  if (/^(enemy|elite|mutation|machine):/.test(id)) {
    const enemy = prepareArchiveEnemy(g, id);
    // Photograph the real rendered pixels, then fit their bounds. Attachments,
    // overhead health bars and the Crane hook extend past physics body bounds.
    const source = document.createElement('canvas');
    source.width = source.height = 512;
    const c = source.getContext('2d')!;
    renderer.ctx = c;
    c.translate(256 - enemy.body.position.x, 180 - enemy.body.position.y);
    renderer.drawEnemies(true);
    const pixels = c.getImageData(0, 0, 512, 512).data;
    let left = 512,
      top = 512,
      right = 0,
      bottom = 0;
    for (let y = 0; y < 512; y++)
      for (let x = 0; x < 512; x++) {
        if (!pixels[(y * 512 + x) * 4 + 3]) continue;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    const target = canvas.getContext('2d')!;
    target.fillStyle = '#111c20';
    target.fillRect(0, 0, 640, 320);
    if (left <= right && top <= bottom) {
      const w = right - left + 1,
        h = bottom - top + 1;
      const scale = Math.min(5, 460 / w, 230 / h);
      target.drawImage(
        source,
        left,
        top,
        w,
        h,
        (640 - w * scale) / 2,
        (320 - h * scale) / 2,
        w * scale,
        h * scale,
      );
    }
  } else renderer.draw(0, { camera: { x: 0, y: -160 }, scale: 640 / g.worldWidth });
  Matter.Engine.clear(g.engine);
  Matter.Composite.clear(g.engine.world, false);
  images.set(id, canvas);
  return canvas;
}
export function drawArchiveImages(root: HTMLElement) {
  root.querySelectorAll<HTMLCanvasElement>('canvas[data-archive-image]').forEach((canvas) => {
    const id = canvas.dataset.archiveImage!;
    canvas.getContext('2d')!.drawImage(photograph(id), 0, 0, canvas.width, canvas.height);
  });
}
