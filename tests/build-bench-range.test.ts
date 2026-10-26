import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { MODS } from '../src/rules.ts';
import { STARTING_GUN_IDS, type StartingGun } from '../src/starting-guns.ts';
import { workshopLevel, WORKSHOP_SCENARIOS, WORKSHOP_INCOMING_WARNING } from '../src/workshop.ts';
const all = MODS.map((m) => m.id);
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 560, y: 723 },
};
function step(g: Game, frames = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < frames; i++) g.tick(1 / 60, { ...idle, ...input });
}
function room(
  scenario: 'standard' | 'groups' | 'incoming' | 'cover' | 'recoil',
  mods: string[] = [],
  gun: StartingGun = 'pistol',
) {
  const g = new Game();
  g.startWorkshop(all, mods, gun, scenario);
  return g;
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}

test('every Build Bench range has clear supported targets and deterministic fresh physical layouts', () => {
  for (const { id } of WORKSHOP_SCENARIOS) {
    const g = room(id);
    assert.deepEqual(g.level, workshopLevel(id));
    assert.equal(g.enemies.length, g.workshop.targets.length);
    for (const e of g.enemies) {
      assert(e.workshopTarget);
      assert.equal(
        Matter.Query.collides(e.body, g.solidBodies).length,
        0,
        id + ': target inside cover',
      );
    }
    assert.equal(g.hazards.items.length, 0);
    assert.equal(g.waves.pending, false);
    if (id !== 'incoming') {
      step(g, 600);
      assert.equal(g.hp, 100);
      assert(!g.shots.some((s) => !s.friendly));
    }
    dispose(g);
  }
});

for (const gun of STARTING_GUN_IDS)
  test(`group range: ${gun} uses its actual gun and can damage multiple aligned targets`, () => {
    const g = room('groups', ['magnum', 'pierce'], gun);
    const targets = g.enemies.slice(0, 3);
    const hit = new Set<number>();
    step(g, 30);
    for (let n = 0; n < 180; n++) {
      step(g, 1, { fire: true, aim: { x: 700, y: 723 } });
      for (const e of targets) if (e.hp < e.maxHp) hit.add(e.id);
    }
    assert(hit.size >= 2, gun + ': actual penetration/group damage never reached the next target');
    assert.equal(g.startingGun, gun);
    assert.deepEqual(g.mods, ['magnum', 'pierce']);
    assert.equal(g.hp, 100);
    dispose(g);
  });

test('incoming emitters hold a full fixed warning before releasing a real hostile projectile', () => {
  const g = room('incoming');
  const e = g.enemies.find((e) => e.workshopTarget?.firing)!;
  while (e.state !== 'windup' && g.time < 5) step(g);
  assert.equal(e.state, 'windup');
  assert(Math.abs(e.timer - WORKSHOP_INCOMING_WARNING) < 1e-6);
  const aim = { ...e.aim },
    target = { ...e.target };
  assert.equal(g.shots.length, 0);
  for (let n = 0; n < 63; n++) {
    step(g, 1, { right: true });
    assert.deepEqual(e.aim, aim);
    assert.deepEqual(e.target, target);
    assert.equal(e.state, 'windup');
  }
  assert.equal(g.hp, 100);
  step(g, 5);
  assert(e.attacks > 0);
  assert(g.shots.some((s) => !s.friendly && s.damageCause?.enemy === 'shooter'));
  dispose(g);
});

test('incoming rounds genuinely damage health and Scrap Armor blocks through the ordinary weapon pipeline', () => {
  const bare = room('incoming');
  let damage = 0;
  bare.onDamage = (h) => (damage += h.damage);
  // Enter the firing lane beyond the untouched supply crate.
  Matter.Body.setPosition(bare.player, { x: 550, y: 722 });
  step(bare, 360);
  assert(damage > 0 && bare.hp < 100);
  dispose(bare);
  const g = room('incoming', ['magnum', 'rapid', 'scrap-armor']);
  let blocks = 0;
  g.onSound = (cue) => {
    if (cue === 'armor') blocks++;
  };
  for (let n = 0; n < 420 && !blocks; n++) {
    const crate = g.props.items.find((p) => p.kind === 'crate');
    step(g, 1, { fire: !!crate, aim: crate?.body.position ?? idle.aim });
  }
  assert(
    blocks > 0,
    'Breaking a real supply crate must earn a plate which absorbs a real incoming shot',
  );
  assert.equal(g.hp, 100, 'The earned plate blocks the first incoming hit');
  assert.deepEqual(g.mods, ['magnum', 'rapid', 'scrap-armor']);
  dispose(g);
});

test('lethal native incoming fire resets the selected scenario, full health and retained gun without progress writes', () => {
  const g = room('incoming', ['magnum'], 'carbine');
  let writes = 0;
  g.onCheckpoint = () => writes++;
  g.onEnemyDefeated = () => writes++;
  g.onBossDefeated = () => writes++;
  g.onCommendation = () => writes++;
  Matter.Body.setPosition(g.player, { x: 550, y: 722 });
  const revision = g.workshop.revision;
  for (let n = 0; n < 2400 && g.workshop.revision === revision; n++) step(g);
  assert(g.workshop.revision > revision, 'Native incoming shots eventually reset a defeated test');
  assert.equal(g.workshop.scenario, 'incoming');
  assert.equal(g.startingGun, 'carbine');
  assert.deepEqual(g.mods, ['magnum']);
  assert.equal(g.hp, 100);
  assert.equal(g.mode, 'playing');
  assert(!g.shots.some((s) => !s.friendly), 'No old projectile survives the reset');
  assert.equal(writes, 0);
  dispose(g);
});

test('Cover & banks uses breakable terrain, real falling crates and a complete physical reset', () => {
  const g = room('cover', ['ricochet']);
  const bodyCount = Matter.Composite.allBodies(g.engine.world).length;
  const ledge = g.destruction.pieces[0];
  const target = g.enemies[0];
  assert(ledge);
  for (let n = 0; n < 3; n++)
    g.addShot({
      pos: { x: 1040, y: 600 },
      vel: { x: 0, y: -30 },
      radius: 2,
      damage: 30,
      life: 1,
      friendly: true,
      fragment: false,
      split: false,
      bounces: 0,
      pierce: 0,
    });
  for (let n = 0; n < 180 && target.hp === target.maxHp; n++) step(g);
  assert(!g.destruction.pieces.includes(ledge));
  assert(target.hp < target.maxHp, 'Real loaded crate falls onto the target');
  assert(g.resetWorkshop());
  assert.equal(g.workshop.scenario, 'cover');
  assert.equal(g.destruction.pieces.length, 1);
  assert.equal(g.props.items.length, 4);
  assert.equal(g.shots.length, 0);
  assert.equal(g.time, 0);
  assert.equal(Matter.Composite.allBodies(g.engine.world).length, bodyCount);
  dispose(g);
});

for (const gun of STARTING_GUN_IDS)
  test(`recoil course: ordinary ${gun} controls reach the upper landing`, () => {
    const g = room('recoil', [], gun);
    for (let n = 0; n < 600 && g.player.position.x < 790; n++) {
      const p = g.player.position;
      const blocked =
        Matter.Query.ray(
          [...g.solidBodies, ...g.enemies.map((e) => e.body)],
          p,
          { x: p.x + 60, y: p.y },
          24,
        ).length > 0;
      step(g, 1, { right: true, jump: g.grounded && !!blocked });
    }
    assert(g.player.position.x > 750, gun + ': cannot enter the shaft');
    let top = 740;
    for (let n = 0; n < 1500 && g.player.position.y > 145; n++) {
      const p = g.player.position;
      step(g, 1, {
        jump: g.grounded,
        fire: true,
        aim: { x: p.x, y: p.y + 500 },
        left: p.x > 800,
        right: p.x < 770,
      });
      top = Math.min(top, g.player.position.y);
    }
    assert(top < 165, gun + ': recoil stopped at ' + top);
    for (let n = 0; n < 220; n++)
      step(g, 1, {
        right: g.player.position.x < 1400,
        fire: g.player.position.x < 1150,
        aim: { x: g.player.position.x, y: g.player.position.y + 500 },
      });
    assert(g.player.position.x > 1200, gun + ': could not cross the top lip');
    assert(g.player.position.y < 230, gun + ': did not land on the upper deck');
    assert.equal(g.hp, 100);
    dispose(g);
  });

test('scenario switches and resets retain the build, clear transients and freeze under pause and hitstop', () => {
  const g = room('incoming', ['scatter'], 'twinbore');
  step(g, 80);
  const timer = g.enemies[0].timer;
  g.setMode('paused');
  step(g, 120);
  assert.equal(g.enemies[0].timer, timer);
  g.setMode('playing');
  g.hitStop = 1;
  step(g, 20);
  assert.equal(g.enemies[0].timer, timer);
  for (const { id } of WORKSHOP_SCENARIOS) {
    assert(g.setWorkshopScenario(id));
    assert.equal(g.startingGun, 'twinbore');
    assert.deepEqual(g.mods, ['scatter']);
    assert.equal(g.time, 0);
    assert.equal(g.hp, 100);
    assert.equal(g.shots.length, 0);
  }
  g.start('outside-range');
  assert.equal(g.setWorkshopScenario('groups'), false);
  assert.equal(g.resetWorkshop(), false);
  dispose(g);
});

for (const morph of ['piston-lance', 'cable-saw', 'seeker-rack'] as const)
  test(`new Workshop ranges run the real ${morph} controller without Campaign seed gates`, () => {
    const g = room('groups', [morph]);
    Matter.Body.setPosition(g.player, { x: 440, y: 722 });
    step(g, 30);
    const target = g.enemies[0];
    let nativeFlight = false;
    for (let n = 0; n < 180; n++) {
      step(g, 1, { fire: morph !== 'seeker-rack' || n < 40, aim: { ...target.body.position } });
      nativeFlight ||= g.shiftMorphs.flights.size > 0;
    }
    assert.equal(g.shiftMorphs.equipped, morph);
    assert(nativeFlight, 'A real native morph projectile must run in this Workshop seed');
    assert(target.hp < target.maxHp, 'The actual morph must damage the range target');
    assert.deepEqual(g.mods, [morph]);
    dispose(g);
  });

test('the new Cover range supports actual Foamcaster collision pieces and reset removes them', () => {
  const g = room('cover', ['foamcaster']);
  Matter.Body.setPosition(g.player, { x: 1300, y: 650 });
  let support: Matter.Body | undefined;
  for (let n = 0; n < 120 && !support; n++) {
    step(g, 1, { fire: true, aim: { x: 1460, y: 650 } });
    support = g.shiftMorphs.foams[0]?.body;
  }
  assert(support, 'Actual terrain impacts must create a Foamcaster support');
  assert(g.terrain.includes(support));
  assert(Matter.Composite.allBodies(g.engine.world).includes(support));
  g.resetWorkshop();
  assert.equal(g.shiftMorphs.foams.length, 0);
  assert(!Matter.Composite.allBodies(g.engine.world).includes(support));
  assert.deepEqual(g.mods, ['foamcaster']);
  dispose(g);
});
