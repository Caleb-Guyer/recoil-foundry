import Matter from 'matter-js';
import type { Game, Input } from './game.ts';
import { branchTestFromUrl } from './branch-builds.ts';
import { interceptorGrindTestFromUrl, overtimeTestFromUrl } from './practice.ts';
import type { Checkpoint } from './rules.ts';

export const STABILITY_CASES = [
  { id: 'volley', name: 'Dense volley', build: 'pinwheel' },
  { id: 'explosions', name: 'Chain explosions', build: 'cluster' },
  { id: 'portals', name: 'Portal volleys', build: 'relay' },
  { id: 'beam', name: 'Prism beam', build: 'prism' },
  { id: 'boss', name: 'Boss arsenal', build: '' },
  { id: 'overtime', name: 'Overtime', build: '' },
] as const;

export function stabilityCheckpoint(index: number): Checkpoint {
  const scenario = STABILITY_CASES[index % STABILITY_CASES.length];
  if (scenario.id === 'boss')
    return interceptorGrindTestFromUrl(
      new URL('https://test/?test=interceptor-grindshot&phase=3'),
    )!;
  if (scenario.id === 'overtime')
    return overtimeTestFromUrl(new URL('https://test/?test=overtime&area=cooling'))!;
  return branchTestFromUrl(new URL(`https://test/?test=branches&build=${scenario.build}&max=1`))!;
}

// Exercises real inputs, health, cooldowns and enemy AI. This is a load driver,
// not a campaign-completion or human-difficulty assessment.
export function stabilityInput(g: Game, tick: number): Input {
  const p = g.player.position;
  let nearest = g.enemies[0];
  for (const e of g.enemies)
    if (
      !nearest ||
      Math.hypot(e.body.position.x - p.x, e.body.position.y - p.y) <
        Math.hypot(nearest.body.position.x - p.x, nearest.body.position.y - p.y)
    )
      nearest = e;
  const phase = tick % 360;
  let aim = nearest ? { ...nearest.body.position } : { x: p.x + 600, y: p.y + 100 };
  if (g.portals.linked && phase < 120) aim = { ...g.portals.pair[0]!.pos };
  else if (phase > 270) aim = { x: p.x + Math.cos(tick / 60) * 220, y: p.y + 400 };
  const dx = aim.x - p.x;
  return {
    left: dx < -150,
    right: dx > 150,
    jump: g.grounded && tick % 55 === 0,
    jumpHeld: phase < 300,
    fire: g.mods.includes('charge-lens') ? phase % 90 < 65 : phase % 120 < 108,
    aim,
  };
}

export function startStabilityCase(g: Game, index: number) {
  g.startTest(stabilityCheckpoint(index));
  if (STABILITY_CASES[index % STABILITY_CASES.length].id === 'portals') {
    for (let x = 200; x < g.worldWidth - 100 && g.portals.next < 2; x += 140)
      g.portals.place({ x, y: 740 });
  }
}

export function stabilityCounts(g: Game) {
  return {
    bodies: Matter.Composite.allBodies(g.engine.world).length,
    constraints: Matter.Composite.allConstraints(g.engine.world).length,
    pairs: g.engine.pairs.list.length,
    shots: g.shots.length,
    particles: g.particles.length,
    enemies: g.enemies.length,
    props: g.props.items.length,
  };
}

export function assertFiniteWorld(g: Game) {
  if (![g.hp, g.time, g.elapsed].every(Number.isFinite)) throw new Error('Non-finite game state');
  for (const body of Matter.Composite.allBodies(g.engine.world))
    if (
      ![body.position.x, body.position.y, body.velocity.x, body.velocity.y, body.angle].every(
        Number.isFinite,
      )
    )
      throw new Error(`Non-finite physics body: ${body.label}`);
  for (const shot of g.shots)
    if (![shot.pos.x, shot.pos.y, shot.vel.x, shot.vel.y, shot.life].every(Number.isFinite))
      throw new Error('Non-finite projectile');
  if (g.shots.length > 180 || g.particles.length > 220) throw new Error('Combat budget exceeded');
}
