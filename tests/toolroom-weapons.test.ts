import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { getGun, loadCheckpoint, MODS, modDescription, type Checkpoint } from '../src/rules.ts';
import { STARTING_GUN_IDS, dailyStartingGun, type StartingGun } from '../src/starting-guns.ts';
import {
  loadWeaponUnlocks,
  migrateWeaponUnlocks,
  unlockedStartingGuns,
  validWeaponUnlocks,
} from '../src/weapon-unlocks.ts';
import { loadLogbook } from '../src/logbook.ts';
import { blueprintCode, parseBlueprintCode } from '../src/blueprints.ts';
import { torchRayCount } from '../src/torch-pattern.ts';
import { addRunRewards, validRunRewards } from '../src/run-rewards.ts';
import { loadArchive, encounterArchive } from '../src/archive.ts';
import { logbookCatalog } from '../src/logbook-catalog.ts';
import { testCheckpoint } from '../src/practice.ts';
import { fixture } from './branches-fixture.ts';
import { shotLight } from '../src/projectile-light.ts';
import { rewardCards } from '../src/reward-cards.ts';
import { TOOLROOM_IDS } from '../src/toolroom-catalog.ts';

const guns = ['twinbore', 'carbine', 'repeater'] as const;
test('large unlock rewards preserve all pictured tools and fittings behind an accessible closed disclosure', () => {
  const html = rewardCards([
    ...guns.map((gun) => 'gun:' + gun),
    ...TOOLROOM_IDS.map((id) => 'mod:' + id),
  ]);
  assert.equal((html.match(/class="reward-card"/g) ?? []).length, 27);
  assert.equal((html.split('<details')[0].match(/class="reward-card"/g) ?? []).length, 6);
  assert.match(html, /<details class="reward-overflow"><summary>Show 21 more rewards<\/summary>/);
  assert(!html.includes(' open'));
  for (const gun of guns) assert(html.includes('data-reward-image="gun:' + gun + '"'));
  for (const id of TOOLROOM_IDS) assert(html.includes(MODS.find((mod) => mod.id === id)!.name));
});
test('native ammunition lights match its tool and conversions keep their own light', () => {
  const colors = [];
  for (const gun of guns) {
    const g = tool(gun);
    g.fire();
    assert(g.shots.length);
    const shot = g.shots[0];
    assert.equal(shot.nativeTool, gun);
    colors.push(shotLight(shot, [])!.color);
    assert.equal(shotLight(shot, ['coolant-rounds'])!.color, '#9bdbe5');
    assert.equal(
      shotLight({ ...shot, shell: { radius: 60, damage: 20 } } as never, [])!.color,
      '#f1ad61',
    );
  }
  assert.equal(new Set(colors).size, 3);
});
const input = { left: false, right: false, jump: false, fire: false, aim: { x: 1500, y: 680 } };
function tool(gun: StartingGun, mods: string[] = []) {
  const g = fixture(mods);
  g.startingGun = gun;
  g.gun = getGun(mods, gun);
  Matter.Body.setPosition(g.player, { x: 240, y: 620 });
  g.grounded = false;
  g.aim = input.aim;
  return g;
}
test('licenses reward three distinct achievements without granting completion guns', () => {
  const fresh = migrateWeaponUnlocks(null, null, [], loadLogbook(null), []);
  assert.deepEqual(unlockedStartingGuns(fresh), ['pistol']);
  const oneHunt = migrateWeaponUnlocks(fresh, null, [], loadLogbook(null), ['cable-cut']);
  assert(!unlockedStartingGuns(oneHunt).includes('carbine'));
  const all = migrateWeaponUnlocks(
    oneHunt,
    null,
    [],
    loadLogbook(null),
    ['cable-cut', 'plate-breaker', 'gauntlet-cleared'],
    false,
    ['kiln'],
  );
  assert.deepEqual(unlockedStartingGuns(all), ['pistol', ...guns]);
  assert(all.started && !all.cleared && !all.overtime);
  assert(validWeaponUnlocks(all));
  assert.deepEqual(loadWeaponUnlocks(all), all);
  assert.deepEqual(migrateWeaponUnlocks(all, null, [], loadLogbook(null), []), all);
  for (const licenses of [[], ['carbine', 'carbine'], ['unknown'], null, 'carbine'])
    assert(!validWeaponUnlocks({ ...fresh, started: true, licenses }));
  const duplicateHunt = migrateWeaponUnlocks(null, null, [], loadLogbook(null), [
    'cable-cut',
    'cable-cut',
  ]);
  assert(!unlockedStartingGuns(duplicateHunt).includes('carbine'));
});
test('old Daily rotations stay fixed; new dates rotate all six loaned tools', () => {
  const old = new Set<StartingGun | undefined>(),
    expanded = new Set<StartingGun | undefined>();
  for (let day = 1; day <= 12; day++) {
    const date = '2026-10-' + String(day).padStart(2, '0');
    old.add(dailyStartingGun('RF-D88-' + date));
    expanded.add(dailyStartingGun('RF-D89-' + date));
  }
  assert.deepEqual([...old].sort(), STARTING_GUN_IDS.slice(0, 3).sort());
  assert.deepEqual([...expanded].sort(), [...STARTING_GUN_IDS].sort());
});
for (const gun of guns) {
  test(`${gun} fires its native projectiles with actual recoil and bounded output`, () => {
    const g = tool(gun),
      cues: string[] = [];
    g.onSound = (cue) => cues.push(cue);
    g.fire();
    assert.equal(g.shots.length, gun === 'twinbore' ? 2 : 1);
    assert(g.player.velocity.x < 0 && g.lastShot === g.time);
    assert(cues.includes(gun + '-shot'));
    const base = getGun([]);
    assert(
      Math.abs((g.gun.damage * g.gun.pellets) / g.gun.interval - base.damage / base.interval) <
        1e-8,
    );
    assert.equal(g.gun.pierce, gun === 'carbine' ? 1 : 0);
    if (gun === 'twinbore') assert.notEqual(g.shots[0].vel.y, g.shots[1].vel.y);
    if (gun === 'repeater') {
      const before = g.shotCount;
      for (let frame = 0; frame < 30; frame++) g.tick(1 / 60, { ...input, fire: true });
      assert(g.shotCount - before >= 3);
      assert.equal(g.burstRemaining, 0);
    }
  });
  test(`${gun} survives Continue, shared blueprints and reward art identity`, () => {
    const g = new Game();
    g.start('toolroom-save', {
      ...testCheckpoint('toolroom-save', 10),
      mods: ['scatter', 'ricochet'],
      startingGun: gun,
      missedUpgrades: 8,
    });
    let save: Checkpoint | null = null;
    g.onCheckpoint = (value) => {
      save = value;
    };
    g.save();
    assert(save);
    assert(loadCheckpoint(save));
    const next = new Game();
    next.startTest(save);
    assert.equal(next.startingGun, gun);
    assert.deepEqual(next.gun, g.gun);
    const code = blueprintCode(g.mods, gun);
    assert.equal(parseBlueprintCode(code).startingGun, gun);
    assert.deepEqual(parseBlueprintCode(code).mods, g.mods);
    const reward = addRunRewards(null, 'TOOLS', ['gun:' + gun]);
    assert(validRunRewards(reward) && reward.ids.includes('gun:' + gun));
    assert(loadArchive(encounterArchive(null, ['gun:' + gun])).encountered.includes('gun:' + gun));
    const catalog = logbookCatalog([], loadLogbook(null), [], null, [], null, {
      version: 1,
      started: true,
      cleared: false,
      overtime: false,
      licenses: [gun],
    });
    assert.equal(catalog.find((e) => e.id === 'gun:' + gun)?.state, 'known');
    assert.equal(catalog.find((e) => e.id === 'gun:' + gun)?.weapon, gun);
  });
  test(`${gun} keeps its pattern, penetration and cadence through beam and fitting acquisition order`, () => {
    for (const mods of [
      [],
      ['scatter'],
      ['scatter', 'crossfire', 'burst', 'pierce', 'deadeye'],
      ['scatter', 'cutting-torch', 'prism-array'],
    ]) {
      const forward = getGun(mods, gun),
        reverse = getGun([...mods].reverse(), gun);
      for (const key of Object.keys(forward) as (keyof typeof forward)[])
        assert(
          typeof forward[key] === 'number'
            ? Math.abs((forward[key] as number) - (reverse[key] as number)) < 1e-9
            : forward[key] === reverse[key],
        );
      const built = getGun(mods, gun);
      if (mods.includes('cutting-torch'))
        assert.equal(torchRayCount(built, mods, 'RF-C89-new'), built.pellets * built.lanes * 2);
      if (gun === 'carbine' && mods.includes('pierce')) assert.equal(built.pierce, 3);
    }
    const description = modDescription(
      MODS.find((m) => m.id === 'scatter')!,
      [],
      gun,
      'RF-C89-new',
    );
    if (gun === 'twinbore') assert(description.startsWith('Six pellets'));
  });
}
