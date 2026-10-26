import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Level } from './levels.ts';
import { EVOLUTIONS, EXPERIMENTS, type ExperimentId, type ShiftCircuit } from './shift-run.ts';
const { Composite, Body } = Matter;
/** A closed, isolated test space. It never becomes a campaign layout. */
export function factoryUnboundRoom(g: Game, base: Level): Level {
  if (
    !g.testRun?.factoryUnbound ||
    g.stage !== g.testRun.stage ||
    g.escape ||
    g.detour ||
    g.overtime
  )
    return base;
  return {
    id: 'factory-unbound-range',
    name: 'Factory Unbound test floor',
    area: 'docks',
    boss: false,
    mirrored: false,
    solids: [
      { x: 360, y: 510, w: 28, h: 148 },
      { x: 620, y: 598, w: 180, h: 22 },
      { x: 980, y: 442, w: 210, h: 22 },
      { x: 1420, y: 610, w: 230, h: 22 },
    ],
    spawns: [
      { kind: 'runner', x: 535, y: 723 },
      { kind: 'shooter', x: 755, y: 581 },
      { kind: 'runner', x: 1125, y: 723 },
      { kind: 'shooter', x: 1490, y: 593 },
    ],
    route: [
      { x: 250, y: 720 },
      { x: 1780, y: 720 },
    ],
    hazards: [],
    setpiece: {
      rosters: [[0, 1, 2, 3]],
      weak: [],
      props: [
        { kind: 'crate', x: 840, y: 717 },
        { kind: 'cover', x: 1320, y: 697 },
        { kind: 'crate', x: 1705, y: 717 },
      ],
    },
  };
}
/** Set up only through the real controllers. No profile callbacks are attached to test runs. */
export function prepareFactoryUnbound(g: Game) {
  const fixture = g.testRun?.factoryUnbound;
  if (!fixture || g.stage !== g.testRun!.stage) return;
  const scene = fixture.scene;
  if (scene === 'rework-loop') {
    // Damage an actual source room before capturing it; this is an authored fixture,
    // not a claim that the player's previous real room was played or cleared.
    for (const enemy of [...g.enemies]) Composite.remove(g.engine.world, enemy.body);
    g.enemies = [];
    g.waves.clear();
    const crate = g.props.items.find((p) => p.kind === 'crate'),
      cover = g.props.items.find((p) => p.kind === 'cover');
    if (crate) g.props.hit(crate, crate.hp + 1, { x: 0, y: 0 }, undefined, true);
    if (cover) g.props.hit(cover, 24, { x: 0, y: 0 }, undefined, true);
    g.clear = true;
    if (g.shiftRoutes.remember() && g.shiftRoutes.enter('rework-loop')) {
      g.loadRoom();
      g.setMode('playing');
    }
  } else if (['transport', 'security', 'reclamation'].includes(scene)) {
    g.shiftRun.chooseCircuit(scene as ShiftCircuit);
  } else if (scene === 'lease' || scene === 'power' || scene === 'experiment') {
    Body.setPosition(g.player, { x: 180, y: 721 });
    g.grounded = true;
    g.shiftRun.openOffice();
  } else if (Object.hasOwn(EVOLUTIONS, scene)) {
    const id = (Object.keys(EXPERIMENTS) as ExperimentId[]).find((id) =>
      (EXPERIMENTS[id].outcomes as readonly string[]).includes(scene),
    );
    if (id) g.shiftRun.beginExperiment(id);
  }
}
