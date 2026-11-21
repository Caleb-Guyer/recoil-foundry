import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import {
  getGun,
  canFieldRepair,
  availableMods,
  loadCheckpoint,
  rewardMods,
  seeded,
  validSavedBuild,
  MODS,
} from '../src/rules.ts';
import { MELEE_IDS, isMeleeWeapon, type MeleeWeapon } from '../src/starting-guns.ts';
import { inspectUpgrade } from '../src/upgrade-inspection.ts';
import { MELEE_FITTINGS } from '../src/melee-fittings.ts';
import { blueprintCode, parseBlueprintCode } from '../src/blueprints.ts';
import {
  recordWeaponChallenge,
  loadWeaponUnlocks,
  unlockedStartingGuns,
} from '../src/weapon-unlocks.ts';
import { legalSwaps } from '../src/reforge-rules.ts';
import { benchEdit } from '../src/build-bench-model.ts';
import { Body, fixture, target, wall, round } from './branches-fixture.ts';

function equipped(weapon: MeleeWeapon, mods: string[] = []) {
  const g = fixture(mods);
  g.startingGun = weapon;
  g.gun = getGun(mods, weapon);
  return g;
}
function incoming(g: Game, x = 246, vx = -9) {
  return round(g, { friendly: false, pos: { x, y: 300 }, vel: { x: vx, y: 0 }, radius: 3 });
}
function trigger(g: Game, fire: boolean, dt = 1 / 60) {
  g.time += dt;
  g.melee.input(dt, { left: false, right: false, jump: false, jumpHeld: false, aim: g.aim, fire });
}

test('Katana slashes nearby exposed targets once, cannot reach through cover, and only parries incoming light rounds', () => {
  const g = equipped('katana');
  const close = target(g, 260),
    far = target(g, 350),
    behind = target(g, 150);
  const leaving = incoming(g, 239, 9),
    heavy = incoming(g),
    returned = incoming(g);
  heavy.radius = 9;
  g.fire();
  const hit = close.maxHp - close.hp;
  assert(hit > 0);
  g.time += 0.04;
  g.melee.update();
  assert.equal(close.maxHp - close.hp, hit);
  assert.equal(far.hp, far.maxHp);
  assert.equal(behind.hp, behind.maxHp);
  assert.equal(g.shots.length, 3);
  assert(returned.friendly && returned.reflected && returned.vel.x > 0);
  assert(!heavy.friendly && !leaving.friendly);

  const guarded = equipped('katana');
  const blocked = target(guarded, 262);
  wall(guarded, 228, 300, 12, 140);
  const shieldedShot = incoming(guarded);
  guarded.fire();
  assert.equal(blocked.hp, blocked.maxHp);
  assert(!shieldedShot.friendly);
});

test('Wide Guard extends parry timing and Riposte Edge spends the damage bonus on the next slash', () => {
  for (const wide of [false, true]) {
    const g = equipped('katana', wide ? ['wide-guard', 'riposte-edge'] : ['riposte-edge']);
    const e = target(g, 260);
    g.fire();
    const first = e.maxHp - e.hp;
    g.time += 0.16;
    const late = incoming(g);
    g.melee.update();
    assert.equal(late.friendly, wide);
    g.shots = []; // Only the timed parry can prime the following slash.
    const before = e.hp;
    g.time += 1;
    g.fire();
    assert(Math.abs((before - e.hp) / first - (wide ? 1.75 : 1)) < 0.001);
    const after = e.hp;
    g.time += 1;
    g.fire();
    assert(Math.abs(after - e.hp - first) < 0.001);
  }
});

test('Hammer pushes real bodies and Counterweight and Sweeping Face independently increase knockback and reach', () => {
  for (const mods of [[], ['counterweight-head'], ['sweeping-face']]) {
    const g = equipped('hammer', mods);
    const e = target(g, 258, 300, 'runner');
    Body.setStatic(e.body, false);
    const far = target(g, 330, 300, 'runner');
    g.fire();
    assert(e.hp < e.maxHp);
    assert(Math.abs(e.body.velocity.x - (mods.includes('counterweight-head') ? 16 : 10)) < 0.01);
    assert.equal(far.hp < far.maxHp, mods.includes('sweeping-face'));
    assert.equal(g.shots.length, 0);
    assert(g.player.velocity.x < 0);
  }
});

test('Drive Spear charges while held and applies Quick Wind and Deep Drive to its lunge', () => {
  const thrust = (mods: string[], seconds: number) => {
    const g = equipped('spear', mods);
    const e = target(g, 260, 300, 'runner'),
      distant = target(g, 380, 300, 'runner');
    for (let n = 0; n < Math.round(seconds * 60); n++) trigger(g, true);
    assert.equal(g.shotCount, 0);
    const charge = g.melee.charge;
    trigger(g, false);
    assert.equal(g.shotCount, 1);
    assert.equal(g.shots.length, 0);
    assert.equal(g.melee.charge, 0);
    return {
      charge,
      speed: g.player.velocity.x,
      damage: e.maxHp - e.hp,
      distant: distant.hp < distant.maxHp,
    };
  };
  const tap = thrust([], 1 / 60),
    normal = thrust([], 0.35),
    fast = thrust(['quick-wind'], 0.35);
  const full = thrust([], 0.75),
    deep = thrust(['deep-drive'], 0.75);
  assert(tap.speed > 0 && tap.speed < full.speed && tap.damage < full.damage);
  assert(Math.abs(normal.charge - 0.5) < 0.001 && fast.charge > 0.999);
  assert(Math.abs(fast.damage - full.damage) < 0.001);
  assert(!full.distant && deep.distant && Math.abs(deep.damage / full.damage - 1.4) < 0.001);
  const g = equipped('spear');
  trigger(g, true, 0.3);
  g.setMode('paused');
  g.setMode('playing');
  trigger(g, true);
  trigger(g, false);
  assert.equal(g.shotCount, 0);
  assert.equal(g.melee.charge, 0);
});

test('Second Beat returns two distinct light rounds per slash, and one earned riposte survives a pause', () => {
  for (const upgraded of [false, true]) {
    const g = equipped('katana', upgraded ? ['second-beat', 'riposte-edge'] : ['riposte-edge']);
    const first = incoming(g);
    const second = incoming(g, 254);
    const third = incoming(g, 262);
    g.fire();
    assert(first.reflected);
    assert.equal(!!second.reflected, upgraded);
    assert(!third.reflected);
    g.time += 0.05;
    g.melee.update();
    assert(!third.reflected);
    assert(g.melee.riposteReady);
    g.setMode('paused');
    g.setMode('playing');
    assert(g.melee.riposteReady);
    assert.equal(g.melee.activeStrike, null);
    g.shots = [];
    const victim = target(g, 260);
    trigger(g, false);
    g.time += 1;
    g.fire();
    assert(!g.melee.riposteReady);
    assert(Math.abs(victim.maxHp - victim.hp - g.gun.damage * 1.75) < 0.0001);
  }
});

test('Rebound Clutch gives one recovery discount on enemy damage even when the hammer sweeps two targets', () => {
  for (const mods of [[], ['rebound-clutch'], ['rebound-clutch', 'rapid']]) {
    const g = equipped('hammer', mods);
    g.fire();
    assert(Math.abs(g.shootAt - g.time - g.gun.interval) < 0.00001);
    g.time += 1;
    target(g, 245, 295);
    target(g, 266, 307);
    g.fire();
    assert.equal(g.melee.activeStrike?.enemiesHit, 2);
    const recovery = g.gun.interval * (mods.includes('rebound-clutch') ? 0.75 : 1);
    const readyAt = g.shootAt;
    assert(Math.abs(readyAt - g.time - recovery) < 0.00001);
    g.time += 0.04;
    g.melee.update();
    assert.equal(g.shootAt, readyAt);
  }
});

test('Tandem Point boosts later enemies once, in contact order, with either facing or spawn order', () => {
  for (const sign of [-1, 1])
    for (const fitted of [false, true]) {
      const g = equipped('spear', fitted ? ['tandem-point'] : []);
      const far = target(g, 200 + sign * 96),
        near = target(g, 200 + sign * 52);
      const late = target(g, 200 + sign * 168);
      g.aim = { x: 200 + sign * 300, y: 300 };
      g.fire();
      const first = near.maxHp - near.hp;
      assert(first > 0);
      const later = first * (fitted ? 1.4 : 1);
      assert(Math.abs(far.maxHp - far.hp - later) < 0.001);
      assert.equal(late.hp, late.maxHp);
      Body.setPosition(g.player, { x: 200 + sign * 72, y: 300 });
      g.time += 0.04;
      g.melee.update();
      assert(Math.abs(late.maxHp - late.hp - later) < 0.001);
      assert.equal(near.maxHp - near.hp, first);
    }
});

test('melee can open a cracked panel from either side and an intervening solid protects it', () => {
  for (const weapon of MELEE_IDS)
    for (const sign of [-1, 1]) {
      const g = equipped(weapon);
      const panel = g.breaches.spawnPanel({ x: sign > 0 ? 246 : 142, y: 265, w: 12, h: 70 });
      const hidden = target(g, 200 + sign * 82);
      g.aim = { x: 200 + sign * 300, y: 300 };
      const solid = wall(g, 200 + sign * 30, 300, 8, 120);
      g.fire();
      assert.equal(panel.hp, panel.maxHp);
      g.terrain = g.terrain.filter((b) => b !== solid);
      panel.hp = 1;
      g.time += 1;
      g.fire();
      assert.equal(g.breaches.panels.length, 0);
      assert.equal(hidden.hp, hidden.maxHp);
      g.time += 1;
      g.fire();
      assert(hidden.hp < hidden.maxHp);
    }
});

test('quick taps in the recovery window survive native input ticks; earlier taps expire', () => {
  for (const gun of ['katana', 'hammer'] as const)
    for (const wait of [0.08, 0.28]) {
      const g = equipped(gun);
      target(g, 1100);
      g.shootAt = g.time + wait;
      for (let n = 0; n < 30; n++)
        g.tick(1 / 60, {
          aim: g.aim,
          left: false,
          right: false,
          jump: false,
          jumpHeld: false,
          fire: false,
          firePressed: n === 0,
        });
      assert.equal(g.shotCount, wait < 0.12 ? 1 : 0);
    }
});

test('a buffered spear release preserves aim and charge exactly once and pause cancels it', () => {
  for (const pause of [false, true]) {
    const g = equipped('spear');
    g.shootAt = g.time + 0.27;
    for (let i = 0; i < 12; i++) trigger(g, true);
    const charge = g.melee.charge;
    trigger(g, false);
    assert.equal(g.shotCount, 0);
    if (pause) {
      g.setMode('paused');
      g.setMode('playing');
    }
    g.aim = { x: 0, y: 300 };
    for (let i = 0; i < 6; i++) trigger(g, false);
    assert.equal(g.shotCount, pause ? 0 : 1);
    if (!pause) {
      assert.equal(g.melee.activeStrike?.charge, charge);
      assert((g.melee.activeStrike?.aim.x ?? 0) > 0.99);
      assert(g.player.velocity.x > 0);
    }
    for (let i = 0; i < 30; i++) trigger(g, false);
    assert.equal(g.shotCount, pause ? 0 : 1);
  }
});

test('licenses progress from a close defeat to a Katana boss to the final Hammer victory; trials and incidental bosses cannot grant them', () => {
  let profile = loadWeaponUnlocks({ version: 2, started: true, licenses: ['bellows'] });
  function earn(
    weapon: MeleeWeapon | 'pistol',
    kind: 'runner' | 'press' | 'interceptor' | 'bulwark',
    stage: number,
    distance: number,
    mode = 'campaign',
  ) {
    const g = fixture([]);
    g.startingGun = weapon;
    g.stage = stage;
    g.level = { ...g.level, boss: kind !== 'runner' };
    if (mode === 'daily') g.seed = 'RF-D93-2026-11-20';
    if (mode === 'workshop') g.workshop.active = true;
    if (mode === 'practice') g.practice = { kind: 'loader', seed: 'TRAINING' };
    const earned: MeleeWeapon[] = [];
    g.onWeaponChallengeProgress = (id, progress, complete) => {
      if (!isMeleeWeapon(id)) return;
      earned.push(id);
      profile = recordWeaponChallenge(profile, id, progress, complete);
    };
    const e = target(g, 200 + distance, 300, kind);
    if (kind === 'press') e.hunt = { route: [], nextPlan: 1, nearPlayer: false };
    g.hitEnemy(e, 1e8);
    g.weaponChallenges.defeated(e);
    return earned;
  }
  assert.deepEqual(earn('pistol', 'runner', 0, 121), []);
  assert.deepEqual(earn('pistol', 'runner', 0, 40, 'practice'), []);
  assert.deepEqual(earn('pistol', 'runner', 0, 120), ['katana']);
  assert.deepEqual(earn('pistol', 'press', 3, 400), []);
  assert.deepEqual(earn('katana', 'press', 3, 400, 'daily'), []);
  assert.deepEqual(earn('katana', 'bulwark', 8, 400), []);
  assert.deepEqual(earn('katana', 'press', 3, 400, 'workshop'), []);
  assert.deepEqual(earn('katana', 'press', 3, 400), ['hammer']);
  assert.deepEqual(earn('hammer', 'press', 3, 400), []);
  assert.deepEqual(earn('hammer', 'interceptor', 19, 400), ['spear']);
  assert(MELEE_IDS.every((id) => unlockedStartingGuns(loadWeaponUnlocks(profile)).includes(id)));
  assert(unlockedStartingGuns(profile).includes('bellows'));
});

test('native Campaign offers, saved rewards, blueprints, refits and the Workshop respect the equipped melee tool', () => {
  const all = MODS.map((m) => m.id);
  for (const weapon of MELEE_IDS) {
    const own = MELEE_FITTINGS.filter((f) => f.weapon === weapon);
    const wrong = MELEE_FITTINGS.find((f) => f.weapon !== weapon)!.id;
    const seed = 'RF-C111-MELEE';
    const g = new Game();
    g.start(seed, undefined, null, null, false, 0, true, [], null, weapon);
    g.openReward();
    const cp = loadCheckpoint(g.checkpointSnapshot());
    assert(cp && cp.startingGun === weapon);
    const resumed = new Game();
    resumed.start(seed, cp);
    assert.deepEqual(
      resumed.offers.map((m) => m.id),
      g.offers.map((m) => m.id),
    );
    for (const f of own) {
      assert(availableMods([], false, false, weapon).some((m) => m.id === f.id));
      assert(benchEdit([], f.id, all, all.length, weapon).canApply);
      assert(
        inspectUpgrade([], f, weapon).changes.some((change) => change.before !== change.after),
      );
      assert.equal(parseBlueprintCode(blueprintCode([f.id], weapon)).startingGun, weapon);
      assert.throws(() => blueprintCode([f.id], 'pistol'));
    }
    assert(
      !availableMods([], false, false, weapon).some((m) => m.id === wrong || m.id === 'scatter'),
    );
    assert(!benchEdit([], wrong, all, all.length, weapon).canApply);
    const build: string[] = [];
    for (let pick = 0; pick < 27; pick++) {
      const stage = Math.min(18, pick);
      const offers = rewardMods(build, 3, seeded(weapon + stage), {
        seed,
        stage,
        startingGun: weapon,
        factory: true,
      });
      assert(offers.length > 0);
      build.push(offers[0].id);
    }
    assert(validSavedBuild(build, undefined, weapon));
    const swaps = legalSwaps([own[0].id, 'light'], 8, undefined, [], seed, weapon);
    assert(
      swaps.length > 0 &&
        swaps.every((s) =>
          validSavedBuild(
            ['light', own[0].id].filter((id) => id !== s.from).concat(s.to),
            undefined,
            weapon,
          ),
        ),
    );
    assert(!validSavedBuild([wrong], undefined, weapon));
  }
});

test('all three tools can trigger a real pressure valve and break a fuse in reach, while an intervening wall protects both', () => {
  for (const weapon of MELEE_IDS)
    for (const covered of [true, false]) {
      const g = equipped(weapon);
      const vent = g.pressure.spawn({
        x: 600,
        y: 738,
        dir: { x: 0, y: -1 },
        valve: { x: 264, y: 300 },
        width: 75,
        length: 380,
        offset: 0,
      });
      vent.phase = 'ready';
      g.areaEvents.state = {
        kind: 'blackout',
        area: 0,
        relays: [],
        commander: false,
        caches: [],
        rerolls: 0,
      };
      g.areaEvents.active = 'blackout';
      g.areaEvents.powered = false;
      g.areaEvents.fuseBox = g.props.spawn('fuse', 262, 325);
      if (covered) wall(g, 225, 300, 12, 150);
      g.aim = { x: 500, y: 321 };
      g.fire();
      assert.equal(vent.phase, covered ? 'ready' : 'warn', weapon);
      assert.equal(g.areaEvents.powered, !covered, weapon);
    }
});

test('only the final defeat of the actual room 20 Reclaimer earns the Drive Spear', () => {
  const g = new Game();
  g.start('RF-C111-RECLAIMER-MELEE', undefined, null, null, false, 0, true, [], null, 'hammer');
  g.stage = 19;
  g.loadRoom();
  const cinema = g.finale.cinema!,
    boss = g.finale.enemy!;
  assert(cinema && boss);
  const earned: string[] = [];
  g.onWeaponChallengeProgress = (id, _value, complete) => {
    if (id === 'spear' && complete) earned.push(id);
  };
  Body.setPosition(g.player, { x: cinema.x(1120), y: 718 });
  for (const [form, ending] of [
    ['duel', 'airlift'],
    ['siege', 'core-opening'],
    ['rupture', 'destruction'],
  ] as const) {
    for (let i = 0; i < 400 && cinema.state !== form; i++) cinema.advance(0.05);
    assert.equal(cinema.state, form);
    assert.deepEqual(earned, []);
    g.hitEnemy(boss, 1e9);
    assert.equal(cinema.state, ending);
  }
  assert.deepEqual(earned, ['spear']);
});

test('an exhausted melee reward offers Field repair and advances the room without fitting an invalid card', () => {
  const g = equipped('spear');
  const seed = 'ARCHIVED-TOOLS';
  g.seed = seed;
  const context = { stage: 18, seed, startingGun: 'spear' as const, unlocks: [] };
  assert(!canFieldRepair([], context));
  while (true) {
    const offers = rewardMods(g.mods, 1, seeded(seed + g.mods.length), context);
    if (!offers.length) break;
    g.mods.push(offers[0].id);
  }
  assert(canFieldRepair(g.mods, context));
  g.stage = 18;
  const before = [...g.mods];
  g.hp = 50;
  g.openReward();
  assert.deepEqual(
    g.offers.map((m) => m.id),
    ['repair'],
  );
  g.chooseMod('repair');
  assert.equal(g.stage, 19);
  assert.equal(g.missedUpgrades, 1);
  assert.deepEqual(g.mods, before);
  assert(g.hp >= 74);
});
