import Matter from 'matter-js';
import { Game, type Enemy, type Shot } from '../src/game.ts';
import { getGun } from '../src/rules.ts';
export const { Body, Bodies, Composite, Engine } = Matter;
export function fixture(mods: string[]) {
  const g = new Game();
  g.start('branches-fixture');
  g.waves.clear();
  g.hazards.clear();
  g.breaches.clear();
  g.destruction.clear();
  g.conveyors.clear();
  g.pressure.clear();
  g.crossing.clear();
  g.freight.clear();
  g.counterweights.clear();
  g.loaderArena.clear();
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.mods = mods;
  g.gun = getGun(mods);
  g.engine.gravity.y = 0;
  Body.setPosition(g.player, { x: 200, y: 300 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.aim = { x: 1400, y: 300 };
  g.grounded = false;
  return g;
}
export function target(g: Game, x = 600, y = 300, kind: Enemy['kind'] = 'shooter', shield = false) {
  g.spawnEnemy(kind, x, y, shield ? 'shielded' : undefined);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.hp = e.maxHp = 100000;
  e.timer = 100;
  Body.setStatic(e.body, true);
  return e;
}
export function wall(g: Game, x: number, y: number, w: number, h: number) {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  return b;
}
export function round(g: Game, extra: Partial<Shot> = {}) {
  g.addShot({
    pos: { x: 400, y: 300 },
    vel: { x: 25, y: 0 },
    damage: g.gun.damage,
    life: 1.4,
    friendly: true,
    radius: 2.5,
    bounces: g.gun.bounces,
    pierce: g.gun.pierce,
    bankGrowth: g.gun.bankGrowth,
    fragment: false,
    split: false,
    ...extra,
  });
  return g.shots.at(-1)!;
}
export function beam(g: Game, seconds: number, held = true, dt = 1 / 60) {
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    g.time += dt;
    g.ballistics.charge(dt, held);
    g.torch.beforeStep(dt, held);
    g.torch.afterStep(dt);
  }
}
export function advance(g: Game, frames = 1, dt = 1 / 60) {
  for (let i = 0; i < frames; i++) {
    g.time += dt;
    g.ballistics.update();
    g.updateShots(dt);
    g.demolition.update();
    g.grind.update(dt);
  }
}
