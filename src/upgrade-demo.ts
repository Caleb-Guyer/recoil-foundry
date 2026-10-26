import Matter from 'matter-js';
import { Game, type Input, type Enemy } from './game.ts';
import { getGun, type Checkpoint } from './rules.ts';
import type { StartingGun } from './starting-guns.ts';
import { TOOLROOM_MODS } from './toolroom-catalog.ts';
import { isShiftMod } from './shift-catalog.ts';
import { mountPoint } from './shift-upgrades.ts';
const { Body, Bodies, Composite, Engine } = Matter;
const scenarios = new WeakMap<Game, string>();
const inspectedIds = new WeakMap<Game, string>();
const shiftDemoActors = new WeakMap<Game, { shooter?: Enemy }>();

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
  if (isShiftMod(scenario)) setupShiftDemo(g, scenario);
  return g;
}

function setupShiftDemo(g: Game, scenario: string) {
  // These are native practice actors and geometry; upgrade state is earned only by the input script.
  if (['catch-chamber', 'slip-gauge', 'ghost-shift'].includes(scenario)) {
    for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
    g.enemies = [];
    if (scenario === 'ghost-shift') {
      const recruit = g.spawnEnemy('runner', 390, 723)!;
      recruit.spawn = 0;
      const target = g.spawnEnemy('shooter', 720, 723)!;
      target.spawn = 0;
      target.workshopTarget = { home: { x: 720, y: 723 }, moving: false };
      const heavy = g.spawnEnemy('welder', 790, 710)!;
      heavy.spawn = 0;
      heavy.workshopTarget = { home: { x: 790, y: 710 }, moving: false };
    } else {
      const shooter = g.spawnEnemy('shooter', 710, 723)!;
      shooter.spawn = 0;
      shooter.workshopTarget = { home: { x: 710, y: 723 }, moving: false };
      shiftDemoActors.set(g, { shooter });
    }
  }
  if (
    [
      'gate-snare',
      'foamcaster',
      'scrap-comet',
      'offset-nozzle',
      'windmill',
      'spring-rivets',
    ].includes(scenario)
  )
    for (const prop of [...g.props.items]) g.props.remove(prop);
  if (['ricochet-harness'].includes(scenario)) {
    const body = Bodies.rectangle(90, 610, 20, 260, { isStatic: true, label: 'terrain' });
    Composite.add(g.engine.world, body);
    g.terrain.push(body);
  }
  if (scenario === 'hot-wire' || scenario === 'polarity-rounds') {
    const e = g.enemies[1];
    Body.setPosition(e.body, { x: 670, y: 624 });
    e.workshopTarget = { home: { x: 670, y: 624 }, moving: false };
    const body = Bodies.rectangle(670, 650, 36, 20, { isStatic: true, label: 'terrain' });
    Composite.add(g.engine.world, body);
    g.terrain.push(body);
  }
  if (scenario === 'scrap-comet') for (const x of [590, 680, 770]) g.props.spawn('crate', x, 717);
}
function shiftDemoInput(g: Game, step: number, id: string): Input {
  const t = step / 60,
    p = g.player.position,
    targets = [...g.enemies].sort((a, b) => a.body.position.x - b.body.position.x);
  const aim = targets[0]?.body.position ?? { x: 720, y: 720 };
  const base: Input = {
    left: false,
    right: false,
    jump: false,
    jumpHeld: false,
    fire: false,
    aim: { ...aim },
  };
  if (id === 'slip-gauge' || id === 'catch-chamber') {
    const shooter = shiftDemoActors.get(g)?.shooter;
    if (shooter && g.enemies.includes(shooter) && [8, 110, 220].includes(step)) {
      const at = id === 'slip-gauge' ? { x: p.x, y: p.y - 32 } : p;
      g.enemyShot(
        shooter,
        Math.atan2(at.y - shooter.body.position.y, at.x - shooter.body.position.x),
        8,
        14,
      );
    }
  }
  if (id === 'slip-gauge')
    return {
      ...base,
      right: t > 1.45 && t < 2,
      jump: step === 86 || step === 98,
      jumpHeld: step >= 86 && step < 96,
    };
  if (id === 'seeker-rack')
    return {
      ...base,
      fire:
        (t >= 0.02 && t < 0.4) ||
        (t >= 1.3 && t < 1.7) ||
        (t >= 2.8 && t < 3.2) ||
        (t >= 4.3 && t < 4.7),
    };
  if (id === 'catch-chamber')
    return {
      ...base,
      fire:
        (t >= 0.05 && t < 0.5) ||
        (t >= 1.25 && t < 1.65) ||
        (t >= 2.6 && t < 3) ||
        (t >= 4 && t < 4.4),
    };
  if (id === 'gate-snare') {
    const fire = [20, 48, 110, 138, 210, 238].includes(step),
      near = Math.floor(step / 28) % 2 === 0;
    return {
      ...base,
      fire,
      firePressed: fire,
      aim: { x: near ? 340 : 760, y: 740 },
      ...(step === 3 ? { portal: { x: 858, y: 600 } } : {}),
      ...(step === 5 ? { portal: { x: 650, y: 740 } } : {}),
    };
  }
  if (id === 'foamcaster')
    return {
      ...base,
      right: t > 1.25 && t < 2.5 && p.x < 380,
      jump: step === 90,
      jumpHeld: step >= 90 && step < 105,
      fire: (t >= 0.1 && t < 0.8) || (t >= 3 && t < 3.6),
      aim: { x: 350, y: 740 },
    };
  if (id === 'piston-lance' || id === 'cable-saw')
    return {
      ...base,
      right: p.x < 350,
      left: p.x > 400,
      fire: t >= 0.15 && t < 5.8,
      aim: { x: aim.x, y: aim.y + (id === 'cable-saw' ? Math.sin(t * 4) * 60 : 0) },
    };
  if (id === 'polarity-rounds')
    return {
      ...base,
      fire: (t >= 0.1 && t < 1.3) || (t >= 3 && t < 4.2),
      aim: { ...(targets[g.shotCount % Math.max(1, targets.length)]?.body.position ?? aim) },
    };
  if (id === 'ricochet-harness')
    return {
      ...base,
      jump: step === 8 || step === 160,
      jumpHeld: t < 0.5,
      fire: t > 0.2 && t < 2.5,
      aim: { x: p.x + 600, y: p.y },
    };
  if (id === 'spring-rivets') {
    const pad = g.shiftUpgrades.rivets[0],
      at = pad ? mountPoint(pad) : { x: 260, y: 740 };
    return {
      ...base,
      right: t > 0.7 && p.x < at.x - 12,
      left: t > 0.7 && p.x > at.x + 12,
      jump: step === 5 || (t > 1 && g.grounded && Math.abs(p.x - at.x) < 35),
      jumpHeld: t < 0.4,
      fire: t > 0.12 && t < 0.45,
      aim: { x: p.x + 70, y: 740 },
    };
  }
  if (id === 'wake-wire')
    return {
      ...base,
      right: t > 0.2 && t < 1.3,
      jump: step === 7,
      jumpHeld: t < 0.4,
      fire: t > 0.2 && t < 1.2,
      aim: { x: p.x - 600, y: p.y },
    };
  if (id === 'false-silhouette') {
    const kick = g.gun.recoil,
      vy = g.player.velocity.y;
    return {
      ...base,
      jump: step === 2 || step === 240,
      jumpHeld: t < 0.4 || (t >= 4 && t < 4.4),
      fire: !g.grounded && vy > kick * 0.4 && vy < kick * 0.65 && (t < 2.2 || t > 4),
      aim: { x: p.x, y: p.y + 500 },
    };
  }
  if (id === 'gimbal-mount')
    return {
      ...base,
      right: t > 0.2 && t < 3,
      jump: step === 9,
      jumpHeld: t < 0.5,
      fire: t > 0.2 && t < 3,
      aim: { x: p.x + 700, y: p.y },
    };
  if (id === 'momentum-exchange')
    return {
      ...base,
      right: t < 1.5,
      jump: step === 8,
      jumpHeld: t < 0.5,
      fire: t > 0.2 && t < 2,
      aim: { ...aim },
    };
  if (id === 'offset-nozzle')
    return {
      ...base,
      fire: (t > 0.1 && t < 0.4) || (t > 0.65 && t < 1.5) || (t > 2.5 && t < 3.5),
      aim: t < 0.45 ? { x: 350, y: 740 } : { ...aim },
    };
  if (id === 'momentum-battery')
    return {
      ...base,
      fire: (t > 0.15 && t < 1.3) || (t > 3 && t < 4),
      jump: step === 90 || step === 260,
      jumpHeld: (t >= 1.5 && t < 1.8) || (t >= 4.33 && t < 4.6),
      aim: { ...aim },
    };
  if (id === 'hot-wire') {
    const link = g.tethers.link;
    const to = link
      ? {
          x: (link.a.body.position.x + link.b.body.position.x) / 2,
          y: (link.a.body.position.y + link.b.body.position.y) / 2,
        }
      : (targets[g.shotCount % Math.max(1, targets.length)]?.body.position ?? aim);
    return { ...base, fire: (t > 0.08 && t < 1.4) || (t > 2.4 && t < 3.6), aim: { ...to } };
  }
  if (id === 'windmill') return { ...base, fire: t > 0.1 && t < 4.8, aim: { x: 450, y: 740 } };
  if (id === 'scrap-comet') return { ...base, fire: t > 0.1 && t < 4.8, aim: { x: 690, y: 705 } };
  if (id === 'ghost-shift') return { ...base, fire: t > 0.1 && t < 5.8, aim: { ...aim } };
  return base;
}

export function upgradeDemoInput(g: Game, step: number): Input {
  const t = step / 60,
    p = g.player.position;
  const scenario = scenarios.get(g);
  if (scenario && isShiftMod(scenario)) return shiftDemoInput(g, step, scenario);
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
