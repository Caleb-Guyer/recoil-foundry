import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STARTING_GUN_IDS,
  ORIGINAL_GUN_IDS,
  EXPERIMENTAL_GUN_IDS,
  STARTING_GUNS,
  dailyStartingGun,
  isExperimentalGun,
  validStartingGunSave,
} from '../src/starting-guns.ts';
import { DAILY_RULESET, SUPPORTED_DAILY_RULESETS, dailyForDate } from '../src/daily.ts';
import { getGun, loadCheckpoint, MODS, modDescription, rewardMods, seeded } from '../src/rules.ts';
import {
  loadWeaponUnlocks,
  migrateWeaponUnlocks,
  unlockedStartingGuns,
  validWeaponUnlocks,
  availableStartingGun,
  WEAPON_REQUIREMENTS,
} from '../src/weapon-unlocks.ts';
import { loadLogbook } from '../src/logbook.ts';
import { testCheckpoint } from '../src/practice.ts';
import { blueprintCode, parseBlueprintCode } from '../src/blueprints.ts';
import { addRunRewards, validRunRewards } from '../src/run-rewards.ts';

test('the three experimental weapons retain distinct profiles and actual control instructions', () => {
  assert.equal(STARTING_GUN_IDS.length, 9);
  assert.equal(ORIGINAL_GUN_IDS.length, 6);
  for (const id of EXPERIMENTAL_GUN_IDS) {
    assert(isExperimentalGun(id));
    assert(STARTING_GUNS[id].description.length > 70);
    assert(WEAPON_REQUIREMENTS[id].length > 10);
    const gun = getGun([], id);
    assert(Object.values(gun).every((v) => typeof v !== 'number' || Number.isFinite(v)));
    assert(gun.interval > 0 && gun.damage > 0 && gun.projectileSpeed > 0);
  }
  assert.equal(getGun([], 'bellows').pellets, 5);
  assert(getGun([], 'bellows').recoil > getGun([], 'shotgun').recoil);
  assert(getGun([], 'switchjack').projectileSpeed < getGun([]).projectileSpeed / 2);
  assert.match(STARTING_GUNS.bellows.description, /Hold fire.*Release/);
  assert.match(STARTING_GUNS['debt-collector'].description, /midair.*current aim.*automatically/);
  assert.match(
    STARTING_GUNS.switchjack.description,
    /Press fire again.*relocate.*consuming.*whole body/,
  );
  for (const invalid of ['constructor', '__proto__', 'pistol', null, {}])
    assert(!isExperimentalGun(invalid));
});

test('old Daily challenges retain their original exact six-tool rotation and RF-D93 loans all nine', () => {
  assert.equal(DAILY_RULESET, 93);
  assert(SUPPORTED_DAILY_RULESETS.includes(92));
  const seen = new Set();
  for (let day = 1; day <= 18; day++) {
    const date = '2026-11-' + String(day).padStart(2, '0');
    const epochDay = Math.floor(Date.parse(date + 'T00:00:00Z') / 86400000);
    for (const version of [89, 90, 91, 92]) {
      const seed = dailyForDate(date, version)!.seed;
      const expected = ORIGINAL_GUN_IDS[epochDay % 6];
      assert.equal(dailyStartingGun(seed), expected, seed);
      assert(validStartingGunSave(expected, seed));
      for (const gun of EXPERIMENTAL_GUN_IDS) assert(!validStartingGunSave(gun, seed));
    }
    const fresh = dailyForDate(date)!.seed;
    const expected = STARTING_GUN_IDS[epochDay % 9];
    assert.equal(dailyStartingGun(fresh), expected);
    seen.add(expected);
  }
  assert.deepEqual([...seen].sort(), [...STARTING_GUN_IDS].sort());
});

test('experimental licenses migrate from earned evidence without granting unearned completion or duplicate hunt credit', () => {
  const fresh = migrateWeaponUnlocks(null, null, [], loadLogbook(null), []);
  for (const gun of EXPERIMENTAL_GUN_IDS) assert.equal(availableStartingGun(gun, fresh), 'pistol');
  const pressure = migrateWeaponUnlocks(fresh, null, [], loadLogbook(null), [], false, ['press']);
  assert(unlockedStartingGuns(pressure).includes('bellows'));
  assert(!unlockedStartingGuns(pressure).includes('debt-collector'));
  assert(!unlockedStartingGuns(pressure).includes('switchjack'));
  const oneHunt = migrateWeaponUnlocks(pressure, null, [], loadLogbook(null), [
    'cable-cut',
    'cable-cut',
  ]);
  assert(!unlockedStartingGuns(oneHunt).includes('switchjack'));
  const twoHunts = migrateWeaponUnlocks(oneHunt, null, [], loadLogbook(null), [
    'cable-cut',
    'plate-breaker',
  ]);
  assert(unlockedStartingGuns(twoHunts).includes('switchjack'));
  assert(validWeaponUnlocks(twoHunts));
  assert.deepEqual(loadWeaponUnlocks(twoHunts), twoHunts);
  assert.deepEqual(migrateWeaponUnlocks(twoHunts, null, [], loadLogbook(null), []), twoHunts);
  assert(!twoHunts.cleared && !twoHunts.overtime);
  assert(
    unlockedStartingGuns(loadWeaponUnlocks({ version: 1, cleared: true })).includes(
      'debt-collector',
    ),
  );
  assert(!validWeaponUnlocks({ ...fresh, started: true, licenses: ['bellows', 'bellows'] }));
});

for (const gun of EXPERIMENTAL_GUN_IDS) {
  test(`${gun} survives checkpoint validation, a shared blueprint and earned reward records`, () => {
    const save = { ...testCheckpoint('EXPERIMENTAL-SAVE', 2), startingGun: gun };
    const parsed = loadCheckpoint(save);
    assert(parsed);
    assert.equal(parsed.startingGun, gun);
    const blueprint = parseBlueprintCode(blueprintCode(parsed.mods, gun));
    assert.equal(blueprint.startingGun, gun);
    assert.deepEqual(blueprint.mods, parsed.mods);
    const reward = addRunRewards(null, save.seed, ['gun:' + gun]);
    assert(validRunRewards(reward));
    assert.deepEqual(reward.ids, ['gun:' + gun]);
    const offers = rewardMods([], 3, seeded(gun), {
      stage: 0,
      seed: 'RF-C120-EXPERIMENTAL',
      startingGun: gun,
    });
    assert.equal(offers.length, 3);
    assert.equal(new Set(offers.map((mod) => mod.id)).size, 3);
  });
}

test('upgrade descriptions explain the native Bellows spread and delayed Debt recoil', () => {
  const scatter = MODS.find((mod) => mod.id === 'scatter')!;
  assert.match(modDescription(scatter, [], 'bellows'), /^Nine pellets/);
  assert.match(
    modDescription(scatter, ['capacitor', 'rail-spike'], 'bellows'),
    /^Nine pellets merge/,
  );
  const kick = MODS.find((mod) => mod.id === 'kick')!;
  assert.match(modDescription(kick, [], 'debt-collector'), /Bank recoil.*vent/);
});
