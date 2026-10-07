import Matter from 'matter-js';
import { Game, type Input } from './game.ts';
import { getGun, type Checkpoint } from './rules.ts';
import type { StartingGun } from './starting-guns.ts';
import { TOOLROOM_MODS } from './toolroom-catalog.ts';
const { Body, Bodies, Composite, Engine } = Matter;
const scenarios = new WeakMap<Game, string>();
const inspectedIds = new WeakMap<Game, string>();

// Each inspection owns its own real Game, physics world and random stream.
// No callback is connected to the player's run, profile, sound or discoveries.
export function createUpgradeDemo(
  mods: readonly string[],
  startingGun: StartingGun,
  seed = 'GUN-COMPARISON',
  scenario = '',
) {
  const g = new Game();
  inspectedIds.set(g, scenario);
  const family = TOOLROOM_MODS.find((m) => m.id === scenario)?.family;
  if (family === 'thermal') scenario = 'heat-relay';
  if (family === 'banking')
    scenario =
      scenario === 'bank-capacitor' || scenario === 'bank-memory' ? 'overkill-bank' : scenario;
  if (family === 'defense' && scenario !== 'field-patch')
    scenario = scenario === 'reclamation' ? 'reclamation' : 'scrap-armor';
  scenarios.set(g, scenario);
  const save: Checkpoint = {
    version: 6,
    seed,
    stage: 0,
    hp: 100,
    mods: [...mods],
    startingGun,
    kills: 0,
    elapsed: 0,
  };
  g.start(save.seed, save, null, save, true);
  // Preserve even a legacy build exactly, without Workshop acquisition filters.
  g.mods = [...mods];
  g.gun = getGun(mods, startingGun);
  g.workshop.slots = [];
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.level.solids = [];
  const wall = Bodies.rectangle(870, 610, 24, 260, { isStatic: true, label: 'terrain' });
  Composite.add(g.engine.world, wall);
  g.terrain.push(wall);
  for (const x of [510, 670]) {
    const e = g.spawnEnemy('runner', x, 723)!;
    e.workshopTarget = { home: { x, y: 723 }, moving: false };
    e.spawn = 0;
    e.hp = e.maxHp = 160;
    if ((scenario === 'heat-relay' || scenario === 'overkill-bank') && x === 510)
      e.hp = e.maxHp = scenario === 'heat-relay' ? 60 : 10;
  }
  g.props.spawn('crate', 760, 717);
  if (scenario === 'scrap-armor' || scenario === 'reclamation') g.props.spawn('cover', 350, 697);
  if (scenario === 'reclamation' || scenario === 'field-patch') {
    g.hp = 76;
    g.hurtAt = -6;
  }
  Body.setPosition(g.player, { x: 180, y: 721 });
  g.waves.clear();
  return g;
}

export function upgradeDemoInput(g: Game, step: number): Input {
  const t = step / 60,
    p = g.player.position;
  const scenario = scenarios.get(g);
  if (
    scenario &&
    [
      'collimator',
      'heat-relay',
      'overkill-bank',
      'scrap-armor',
      'reclamation',
      'field-patch',
    ].includes(scenario)
  ) {
    const target = g.enemies[0];
    const cover = g.props.items.find((prop) => prop.kind === 'cover');
    if (
      scenario === 'scrap-armor' &&
      step === (inspectedIds.get(g) === 'plate-retainer' ? 300 : 180)
    )
      g.addShot({
        pos: { x: p.x + 160, y: p.y },
        vel: { x: -8, y: 0 },
        damage: inspectedIds.get(g) === 'reinforced-plate' ? 24 : 14,
        life: 1.4,
        friendly: false,
        radius: 2.5,
        bounces: 0,
        pierce: 0,
        fragment: false,
        split: false,
      });
    return {
      left: p.x > 220,
      right: p.x < 165,
      jump: false,
      jumpHeld: false,
      fire: scenario !== 'field-patch' && t > 0.15 && t < 4.6,
      aim:
        (scenario === 'scrap-armor' || scenario === 'reclamation') && cover
          ? { ...cover.body.position }
          : scenario === 'collimator' && t > 2 && t < 2.4
            ? { x: 670, y: 620 + Math.sin(t * 18) * 100 }
            : target
              ? { ...target.body.position }
              : { x: 870, y: 610 },
    };
  }
  const jump = step === 190 || step === 300;
  // Shoot, release to recharge/release stored rounds, then recoil through a jump.
  // A late bank tests scenery-dependent effects on the same physical wall.
  const fire = (t >= 0.35 && t < 1.75) || (t >= 2.8 && t < 4.1) || (t >= 4.7 && t < 5.8);
  const aim =
    t >= 4.7 ? { x: 870, y: 610 } : t >= 3.2 && t < 3.6 ? { x: p.x, y: 800 } : { x: 670, y: 720 };
  return {
    left: p.x > 390,
    right: p.x < 165,
    jump,
    jumpHeld: jump,
    fire,
    firePressed: [21, 168, 282].includes(step),
    aim,
    ...(g.portals.equipped && step === 5 ? { portal: { x: 858, y: 610 } } : {}),
    ...(g.portals.equipped && step === 7 ? { portal: { x: 400, y: 740 } } : {}),
  };
}
export function destroyUpgradeDemo(g: Game) {
  g.setMode('title');
  Composite.clear(g.engine.world, false);
  Engine.clear(g.engine);
  Matter.Events.off(
    g.engine,
    'beforeSolve beforeUpdate afterUpdate collisionStart collisionActive collisionEnd',
  );
}
