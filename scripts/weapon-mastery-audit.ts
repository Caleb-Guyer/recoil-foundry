import { mkdirSync, writeFileSync } from 'node:fs';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { testCheckpoint } from '../src/practice.ts';
import { availableMods, seeded, distance } from '../src/rules.ts';
import { dodgePilot } from '../tests/combat-pilot.ts';
const challenge = process.argv[2] ?? 'bank-job';
const start = Number(process.argv[3] ?? 0),
  count = Number(process.argv[4] ?? 8);
const stage = challenge === 'bank-job' ? 3 : 9;
const mods =
  challenge === 'bank-job'
    ? ['ricochet', 'banker', 'magnum']
    : challenge === 'air-traffic'
      ? ['kick', 'airshot', 'rapid', 'scatter', 'magnum', 'leech', 'light', 'pierce', 'ricochet']
      : ['fold', 'rewire', 'ricochet', 'pierce', 'magnum', 'rapid', 'scatter', 'leech', 'light'];
const chosen: string[] = [];
for (const id of mods) {
  if (!availableMods(chosen).some((m) => m.id === id)) throw Error('Illegal build ' + id);
  chosen.push(id);
}
const results = [];
for (let seedIndex = start; seedIndex < start + count; seedIndex++) {
  Matter.Common._nextId = Matter.Common._seed = 0;
  Math.random = seeded('weapon-mastery-inputs');
  const seed = 'weapon-mastery-' + seedIndex,
    g = new Game();
  const save = { ...testCheckpoint(seed, stage), mods: [...mods] };
  g.start(seed, save);
  const awards: string[] = [];
  g.onCommendation = (id) => awards.push(id);
  let maxAir = 0,
    maxDeliveries = 0;
  for (
    let frame = 0;
    frame < 7200 && g.mode === 'playing' && !g.clear && !awards.includes(challenge);
    frame++
  ) {
    const p = g.player.position,
      target = g.enemies
        .filter((e) => e.spawn <= 0 && e.hp > 0)
        .sort((a, b) => distance(p, a.body.position) - distance(p, b.body.position))[0];
    let input: Input = {
      left: false,
      right: false,
      jump: g.grounded,
      jumpHeld: true,
      fire: false,
      aim: { x: p.x, y: 740 },
    };
    if (target) {
      if (challenge === 'bank-job') {
        const aim = { x: target.body.position.x, y: 1474 - target.body.position.y };
        input = { ...input, ...dodgePilot(g, target, true, { aim }), aim };
      } else if (challenge === 'air-traffic') {
        const t = target.body.position,
          lift = p.y > 520 || g.player.velocity.y > 3;
        input.aim = lift ? { x: p.x + (t.x - p.x) * 0.3, y: p.y + 600 } : { ...t };
        input.fire = true;
        input.right = p.x < t.x - 65;
        input.left = p.x > t.x + 65;
      } else {
        // Fire into a floor entrance; a ceiling outlet delivers the rounds downward.
        // Both clicks go through the same portal-request path as right click.
        if (g.portals.nextIndex === 0 && frame % 12 === 0) {
          const point = { x: Math.max(100, Math.min(1900, p.x)), y: 740 };
          if (g.portals.candidate(point)) g.portalRequest = point;
        } else if (g.portals.nextIndex === 1 && frame % 12 === 0) {
          const point = { x: Math.max(100, Math.min(1900, target.body.position.x)), y: 0 };
          if (g.portals.candidate(point)) g.portalRequest = point;
        }
        const entry = g.portals.pair[0];
        input.aim = entry?.pos ?? { x: p.x, y: 740 };
        input.fire = !!g.portals.linked;
        input.right = p.x < 700;
        input.left = p.x > 950;
      }
    }
    g.tick(1 / 60, input);
    maxAir = Math.max(maxAir, g.commendations.weapons['airborne']);
    maxDeliveries = Math.max(maxDeliveries, g.commendations.weapons['deliveries']);
  }
  const row = {
    challenge,
    seed,
    stage,
    mods,
    layout: g.level.name,
    mirrored: g.level.mirrored,
    awards,
    mode: g.mode,
    clear: g.clear,
    hp: g.hp,
    seconds: +g.elapsed.toFixed(2),
    kills: g.kills,
    maxAir,
    maxDeliveries,
    portalPlacements: g.portals.next,
  };
  results.push(row);
  console.log(JSON.stringify(row));
}
mkdirSync(new URL('../.release-assets/', import.meta.url), { recursive: true });
writeFileSync(
  new URL('../.release-assets/weapon-mastery-' + challenge + '-3.17.0.json', import.meta.url),
  JSON.stringify({ ordinaryInputs: true, alteredCombatState: false, results }, null, 2) + '\n',
);
