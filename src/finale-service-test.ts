import Matter from 'matter-js';
import type { Game } from './game.ts';
import { availableMods, validSavedBuild, type Checkpoint } from './rules.ts';
import { draftUnlocked } from './longevity.ts';
import { withParents } from './branch-builds.ts';
import { testCheckpoint } from './practice.ts';
import { isFinaleServiceTestSeed } from './finale-service.ts';

export function finaleServiceTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (p.get('test') !== 'final-service' || p.get('v') !== '1') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'v', 'build', 'choice', 'mirror'].includes(key) || p.getAll(key).length !== 1)
      invalid = true;
  });
  const build = p.get('build') ?? 'standard',
    choice = p.get('choice') ?? 'room',
    mirror = p.get('mirror') ?? '0';
  if (
    invalid ||
    !['standard', 'beam', 'fusion'].includes(build) ||
    !['room', 'repair', 'refit', 'leave'].includes(choice) ||
    !['0', '1'].includes(mirror)
  )
    return null;
  const cp = testCheckpoint('RF-C98-SERVICE-' + build.toUpperCase() + '-' + mirror, 19);
  cp.version = 6;
  cp.hp = 57;
  if (build !== 'standard') {
    const mods = withParents(
      ['magnum', 'rapid', 'kick', 'light', 'airshot', 'scatter', 'pierce', 'leech', 'landing'],
      build === 'beam' ? ['cutting-torch', 'burst', 'prism-array'] : ['resonator'],
    );
    if (!mods || !validSavedBuild(mods)) return null;
    while (mods.length < 19) {
      const next = availableMods(mods).find((mod) => draftUnlocked(mod.id, [], cp.seed));
      if (!next) return null;
      mods.push(next.id);
    }
    cp.mods = mods;
  }
  if (!validSavedBuild(cp.mods)) return null;
  return cp;
}

// Only the explicit isolated link is positioned here. The ordinary Campaign
// starts at its real entrance, and this helper never touches profile callbacks.
export function prepareFinaleServiceTest(g: Game, url?: URL): boolean {
  if (
    !g.testRun ||
    !isFinaleServiceTestSeed(g.testRun.seed) ||
    g.stage !== 19 ||
    g.finale.cinema?.state !== 'approach'
  )
    return false;
  const requested = url ? finaleServiceTestFromUrl(url) : null;
  if (url && requested?.seed !== g.seed) return false;
  const mirror = g.testRun.seed.endsWith('-1');
  if (g.level.mirrored !== mirror) {
    g.level.mirrored = mirror;
    g.finale.rebuild();
  }
  const site = g.finaleService.site;
  if (!site) return false;
  Matter.Body.setPosition(g.player, { x: site.x + (mirror ? 45 : -45), y: site.floor - 18 });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  const idle = {
    left: false,
    right: false,
    jump: false,
    jumpHeld: false,
    fire: false,
    aim: { ...g.player.position },
  };
  for (let frame = 0; frame < 3; frame++) g.tick(1 / 60, idle);
  if (url && (url.searchParams.get('choice') ?? 'room') !== 'room')
    return g.finaleService.interact();
  return true;
}
