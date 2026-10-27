import type { Game, Input } from './game.ts';
import { MODS, validBuild } from './rules.ts';
import { withParents } from './branch-builds.ts';
import { workshopBuild } from './workshop-build.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';
import type { WorkshopScenario } from './workshop.ts';

export const BUILD_MOTION_SCENES = ['explanations', 'readiness', 'highlights', 'practice'] as const;
export type BuildMotionScene = (typeof BUILD_MOTION_SCENES)[number];
export interface BuildMotionFixture {
  scene: BuildMotionScene;
  mods: string[];
  gun: StartingGun;
  range: WorkshopScenario;
  title: string;
  hint: string;
}
const scenes: Record<
  BuildMotionScene,
  { wanted: string[]; range: WorkshopScenario; title: string; hint: string }
> = {
  explanations: {
    wanted: ['scatter', 'piston-lance', 'momentum-battery', 'offset-nozzle', 'ricochet-harness'],
    range: 'cover',
    title: 'Your build now',
    hint: 'Expand Your build now in Pause. Inspect your actual Piston Lance, remote muzzle and movement triggers, then practice one fitting with this same gun.',
  },
  readiness: {
    wanted: ['seeker-rack', 'slip-gauge', 'momentum-battery', 'offset-nozzle'],
    range: 'incoming',
    title: 'Read the opening',
    hint: 'Hold fire over a visible target to paint a Seeker lock, then release. Bank recoil on the ground and jump to spend it; graze a small incoming round to earn a Slip Gauge burst. Readiness follows real charges, not a preloaded sample.',
  },
  highlights: {
    wanted: ['piston-lance', 'momentum-battery', 'offset-nozzle'],
    range: 'standard',
    title: 'Measured build highlights',
    hint: 'This authored range demonstration fires the actual Piston Lance, fits and fires a remote muzzle, then releases a banked jump. Its local native counters feed the report. It is not a human play session or Campaign result.',
  },
  practice: {
    wanted: ['catch-chamber', 'momentum-battery', 'ricochet-harness'],
    range: 'incoming',
    title: 'Practice this fitting',
    hint: 'Expand Your build now, choose Catch Chamber or a movement fitting, and open its suggested private range. Reset or return to this paused build; Continue and rewards remain untouched.',
  },
};
/** Explicit private fixtures: no profile collection, progress or history mutation. */
export function buildMotionTestFromUrl(url: URL): BuildMotionFixture | null {
  const p = url.searchParams;
  if (p.get('test') !== 'build-motion' || p.get('v') !== '1') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'scene', 'gun', 'v'].includes(key) || p.getAll(key).length !== 1) invalid = true;
  });
  const scene = p.get('scene') ?? 'explanations',
    gun = p.get('gun') ?? 'pistol';
  if (invalid || !BUILD_MOTION_SCENES.includes(scene as BuildMotionScene) || !isStartingGun(gun))
    return null;
  const config = scenes[scene as BuildMotionScene],
    known = MODS.map((m) => m.id);
  const mods = withParents([], config.wanted);
  if (!mods || !validBuild(mods) || workshopBuild(mods, known).length !== mods.length) return null;
  return {
    scene: scene as BuildMotionScene,
    gun,
    mods,
    range: config.range,
    title: config.title,
    hint:
      config.hint +
      ' This isolated test preserves Continue, unlocks, discoveries and saved builds.',
  };
}
/** A short, bounded ordinary-input demonstration, measured by native success callbacks. */
export function prepareBuildMotionTest(game: Game, fixture: BuildMotionFixture): void {
  if (fixture.scene !== 'highlights' || !game.workshop.active) return;
  const input: Input = {
    left: false,
    right: false,
    jump: false,
    jumpHeld: false,
    fire: false,
    aim: { x: game.player.position.x, y: 900 },
  };
  const step = (frames: number, fire = false, jump = false) => {
    for (let i = 0; i < frames; i++) {
      input.aim = { x: game.player.position.x, y: 900 };
      input.fire = fire;
      input.firePressed = fire && i === 0;
      input.jump = jump && i === 0;
      input.jumpHeld = jump;
      game.tick(1 / 60, input);
    }
  };
  step(40);
  step(1, true);
  step(35);
  step(1, true);
  step(35);
  step(1, false, true);
  step(8);
}
