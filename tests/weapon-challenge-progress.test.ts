import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadWeaponUnlocks,
  migrateWeaponUnlocks,
  recordWeaponChallenge,
  unlockedStartingGuns,
  validWeaponUnlocks,
  weaponChallengeStatus,
  WEAPON_UNLOCKS_KEY,
} from '../src/weapon-unlocks.ts';
import { loadLogbook } from '../src/logbook.ts';
import { ProgressStore, parseProgressBackup, validateProgress } from '../src/progress.ts';
import { EXPERIMENTAL_GUN_IDS } from '../src/starting-guns.ts';

test('5.48 ownership migrates once; future old milestones cannot bypass new challenges', () => {
  const old = migrateWeaponUnlocks(
    { version: 1, started: true, cleared: true, overtime: false },
    null,
    [],
    loadLogbook(null),
    ['cable-cut', 'plate-breaker'],
    false,
    ['press'],
  );
  assert.equal(old.version, 2);
  for (const gun of EXPERIMENTAL_GUN_IDS) assert(unlockedStartingGuns(old).includes(gun));
  assert(validWeaponUnlocks(old));
  assert.deepEqual(migrateWeaponUnlocks(old, null, [], loadLogbook(null), []), old);

  const fresh = migrateWeaponUnlocks(null, null, [], loadLogbook(null), []);
  const later = migrateWeaponUnlocks(
    fresh,
    null,
    [],
    loadLogbook(null),
    ['cable-cut', 'plate-breaker', 'gauntlet-cleared', 'after-hours'],
    true,
    ['kiln'],
  );
  for (const gun of EXPERIMENTAL_GUN_IDS) assert(!unlockedStartingGuns(later).includes(gun));
  assert.deepEqual(unlockedStartingGuns(later), [
    'pistol',
    'shotgun',
    'nailgun',
    'twinbore',
    'carbine',
    'repeater',
  ]);
});

test('older backups without a weapon profile still retain their previously earned tools', () => {
  const migrated = migrateWeaponUnlocks(
    null,
    null,
    [],
    loadLogbook({ version: 1, escaped: true }),
    ['cable-cut', 'fuse-pulled'],
    false,
    ['kiln'],
  );
  for (const gun of EXPERIMENTAL_GUN_IDS) assert(unlockedStartingGuns(migrated).includes(gun));
  const debt = loadWeaponUnlocks({ version: 1, cleared: true });
  assert(debt.licenses?.includes('debt-collector'));
  assert(
    unlockedStartingGuns(migrateWeaponUnlocks(debt, null, [], loadLogbook(null), [])).includes(
      'debt-collector',
    ),
  );
});

test('best attempts survive reload but do not add together or grant a premature flight unlock', () => {
  let p = recordWeaponChallenge(null, 'bellows', 2, false);
  p = recordWeaponChallenge(loadWeaponUnlocks(p), 'bellows', 1, false);
  assert.equal(p.challenges?.bellows, 2);
  assert(!unlockedStartingGuns(p).includes('bellows'));
  p = recordWeaponChallenge(p, 'bellows', 2, true);
  assert(!unlockedStartingGuns(p).includes('bellows'));
  p = recordWeaponChallenge(p, 'bellows', 3, true);
  assert(unlockedStartingGuns(p).includes('bellows'));
  assert.deepEqual(recordWeaponChallenge(p, 'bellows', 3, true), p);

  p = recordWeaponChallenge(p, 'switchjack', 500, false);
  assert.equal(weaponChallengeStatus('switchjack', p)?.current, 500);
  assert.equal(weaponChallengeStatus('switchjack', p)?.complete, false);
  p = recordWeaponChallenge(p, 'switchjack', 500, true);
  assert.equal(weaponChallengeStatus('switchjack', p)?.complete, true);
  assert(validWeaponUnlocks(p));
});

test('progress backups preserve partial challenges and permanent licenses together', async () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
  const store = new ProgressStore(() => storage);
  let p = recordWeaponChallenge(store.read(WEAPON_UNLOCKS_KEY), 'debt-collector', 3, true);
  p = recordWeaponChallenge(p, 'switchjack', 350, false);
  await store.write(WEAPON_UNLOCKS_KEY, p);
  const reopened = new ProgressStore(() => storage);
  assert.deepEqual(reopened.read(WEAPON_UNLOCKS_KEY), p);
  const backup = parseProgressBackup(reopened.backup('5.49.0'));
  assert.deepEqual(backup.values[WEAPON_UNLOCKS_KEY], p);
  assert(validateProgress(backup.values));
  assert(!unlockedStartingGuns(p).includes('shotgun'));
});

test('backup validation rejects malformed challenge evidence and duplicate licenses', () => {
  const p = loadWeaponUnlocks({ version: 2, started: true });
  for (const challenges of [
    { switchjack: 501 },
    { bellows: 4 },
    { bellows: 1.5 },
    { bellows: 0 },
    { bellows: NaN },
    { switchjack: Infinity },
    { unknown: 1 },
    [],
    null,
    {},
  ])
    assert(!validWeaponUnlocks({ ...p, challenges }), JSON.stringify(challenges));
  assert(!validWeaponUnlocks({ ...p, licenses: ['debt-collector', 'debt-collector'] }));
  assert(validWeaponUnlocks({ version: 1, started: true, cleared: true, overtime: false }));
  assert(
    !validWeaponUnlocks({
      version: 1,
      started: true,
      cleared: true,
      overtime: false,
      challenges: { bellows: 1 },
    }),
  );
  assert.deepEqual(recordWeaponChallenge(p, 'bellows', NaN, true), p);
  assert.deepEqual(recordWeaponChallenge(p, 'switchjack', -1, true), p);
  assert.equal(weaponChallengeStatus('pistol', p), null);
});
