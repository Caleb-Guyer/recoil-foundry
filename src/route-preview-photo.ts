import Matter from 'matter-js';
import { Game } from './game.ts';
import type { RoutePreview } from './route-preview.ts';

// A photograph owns a separate engine. It cannot advance the live player,
// consume the combat random stream or invoke that player's progress callbacks.
export function createRoutePhotographGame(preview: RoutePreview): Game {
  const game = new Game();
  try {
    game.startTest(structuredClone(preview.checkpoint), preview.level);
    for (const enemy of [...game.enemies, ...game.areaEvents.allies])
      Matter.Composite.remove(game.engine.world, enemy.body);
    game.enemies = [];
    game.areaEvents.allies = [];
    game.waves.clear();
    game.teamwork.clear();
    game.shots = [];
    game.particles = [];
    game.mode = 'paused';
    return game;
  } catch (error) {
    destroyRoutePhotographGame(game);
    throw error;
  }
}
export function destroyRoutePhotographGame(game: Game) {
  Matter.Composite.clear(game.engine.world, false);
  Matter.Engine.clear(game.engine);
}
