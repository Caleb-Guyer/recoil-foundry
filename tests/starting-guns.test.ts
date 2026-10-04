import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Input } from '../src/game.ts';
import {
  getGun,
  loadCheckpoint,
  MODS,
  modDescription,
  seeded,
  type Checkpoint,
} from '../src/rules.ts';
import { STARTING_GUN_IDS, dailyStartingGun, isStartingGun } from '../src/starting-guns.ts';
import { dailyForDate, SUPPORTED_DAILY_RULESETS } from '../src/daily.ts';
import {
  blueprintCode,
  parseBlueprintCode,
  setBlueprint,
  loadBlueprints,
  validBlueprint,
} from '../src/blueprints.ts';
import { snapshotRun, loadRunHistory, RUN_HISTORY_KEY } from '../src/run-history.ts';
import { ProgressStore, parseProgressBackup, CHECKPOINT_KEY } from '../src/progress.ts';
import { BLUEPRINTS_KEY } from '../src/blueprints.ts';
import { fixture, target, Composite } from './branches-fixture.ts';
import { reforgeTestFromUrl } from '../src/reforge-rules.ts';
import { overtimeTestFromUrl } from '../src/practice.ts';

const input: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1800, y: 300 },
};
const start = (gun: (typeof STARTING_GUN_IDS)[number], seed = 'starting-tools') => {
  const g = new Game();
  g.start(seed, undefined, null, null, false, 0, true, [], null, gun);
  return g;
};
function checkpoint(g: Game) {
  let save: Checkpoint | null = null;
  g.onCheckpoint = (s) => {
    save = s;
  };
  g.save();
  assert(save);
  const valid = loadCheckpoint(save);
  assert(valid, JSON.stringify(save));
  return valid;
}
const dps = (gun: ReturnType<typeof getGun>) =>
  (gun.damage * gun.pellets * gun.burstCount) / (gun.interval * (gun.burstCount === 3 ? 3.1 : 1));

test('base tools have distinct recoil and firing patterns with equal ideal starting DPS and no free upgrades', () => {
  const pistol = getGun([]),
    shotgun = getGun([], 'shotgun'),
    nailgun = getGun([], 'nailgun');
  assert.deepEqual(getGun([], 'pistol'), pistol);
  assert.equal(pistol.damage, 24);
  assert.equal(pistol.interval, 0.22);
  assert.equal(shotgun.pellets, 5);
  assert.equal(nailgun.burstCount, 3);
  assert(shotgun.interval > pistol.interval && shotgun.recoil > pistol.recoil);
  assert(shotgun.spread > 0 && nailgun.spread === 0 && nailgun.recoil < pistol.recoil);
  for (const gun of STARTING_GUN_IDS) {
    assert(Math.abs(dps(getGun([], gun)) - dps(pistol)) < 1e-8);
    assert.deepEqual(start(gun).mods, []);
  }
  for (const bad of ['constructor', '__proto__', 'laser', '', 1, null, {}])
    assert(!isStartingGun(bad));
});

test('Scattershot and Burst improve native mechanisms and conversion descriptions stay accurate', () => {
  const scatter = getGun(['scatter'], 'shotgun'),
    burst = getGun(['burst'], 'nailgun');
  assert.equal(scatter.pellets, 9);
  assert(Math.abs((scatter.damage * scatter.pellets) / 60 - 1.6) < 1e-8);
  assert(dps(scatter) > dps(getGun([], 'shotgun')));
  assert(dps(burst) > dps(getGun([], 'nailgun')));
  assert.equal(burst.burstCount, 3);
  assert(getGun(['deadeye'], 'shotgun').spread < getGun([], 'shotgun').spread);
  const scatterMod = MODS.find((m) => m.id === 'scatter')!;
  assert.match(modDescription(scatterMod, [], 'shotgun'), /Nine pellets/);
  assert.match(modDescription(scatterMod, ['cutting-torch'], 'shotgun'), /beam/);
  assert.match(modDescription(scatterMod, ['cutting-torch', 'charge-lens'], 'shotgun'), /lance/);
  assert.match(
    modDescription(MODS.find((m) => m.id === 'burst')!, [], 'nailgun'),
    /shorter burst recovery/,
  );
});

for (const gun of STARTING_GUN_IDS) {
  test(`${gun} emits its real projectiles and applies recoil once per discharge`, () => {
    const g = fixture([]);
    g.startingGun = gun;
    g.gun = getGun([], gun);
    g.fire();
    assert.equal(g.shots.length, gun === 'shotgun' ? 5 : 1);
    assert.equal(g.shotCount, 1);
    assert(Math.abs(g.player.velocity.x + g.gun.recoil) < 1e-8);
    assert.equal(g.burstRemaining, gun === 'nailgun' ? 2 : 0);
    for (let frame = 0; frame < 12; frame++) g.tick(1 / 60, input);
    assert.equal(g.shotCount, gun === 'nailgun' ? 3 : 1);
    assert.equal(g.burstRemaining, 0);
  });
  test(`${gun} survives reward Continue, upgrades and fresh retries`, () => {
    const g = start(gun);
    g.openReward();
    const save = checkpoint(g),
      continued = new Game();
    continued.start(save.seed, save);
    assert.equal(continued.mode, 'upgrade');
    assert.equal(continued.startingGun, gun);
    assert.deepEqual(continued.gun, getGun([], gun));
    continued.chooseMod(continued.offers[0].id);
    assert.equal(continued.startingGun, gun);
    assert.deepEqual(continued.gun, getGun(continued.mods, gun));
    const next = checkpoint(continued),
      again = new Game();
    again.start(next.seed, next);
    assert.deepEqual(again.gun, continued.gun);
    assert.deepEqual(start(gun, 'retry-tools').gun, getGun([], gun));
    for (const bad of ['unknown', null, {}, 7])
      assert.equal(loadCheckpoint({ ...save, startingGun: bad }), null);
  });
}

test('pausing cancels queued nailgun rounds and release cannot secretly fire through menus', () => {
  const g = fixture([]);
  g.startingGun = 'nailgun';
  g.gun = getGun([], 'nailgun');
  g.fire();
  g.setMode('paused');
  for (let frame = 0; frame < 60; frame++) g.tick(1 / 60, input);
  assert.equal(g.shotCount, 1);
  assert.equal(g.burstRemaining, 0);
  g.setMode('playing');
  for (let frame = 0; frame < 60; frame++) g.tick(1 / 60, input);
  assert.equal(g.shotCount, 1);
});

test('legacy Continue defaults to the pistol even when a different gun was selected', () => {
  const save = checkpoint(start('pistol'));
  delete save.startingGun;
  assert(loadCheckpoint(save));
  const g = new Game();
  g.start(save.seed, save, null, null, false, 0, true, [], null, 'shotgun');
  assert.equal(g.startingGun, 'pistol');
  assert.deepEqual(g.gun, getGun([]));
});

for (const gun of ['shotgun', 'nailgun'] as const) {
  test(`${gun} keeps its native mechanism after a Reforge swap`, () => {
    const save = reforgeTestFromUrl(new URL('https://test/?test=reforge'))!;
    const g = new Game();
    g.startTest({ ...save, startingGun: gun });
    const before = [...g.mods],
      swap = g.reforge.offers[0];
    assert(g.reforge.choose(0));
    assert.equal(g.startingGun, gun);
    assert.deepEqual(g.mods, [...before.filter((id) => id !== swap.from), swap.to]);
    assert.deepEqual(g.gun, getGun(g.mods, gun));
    assert.notDeepEqual(g.gun, getGun(g.mods));
  });
  test(`${gun} preserves its upgraded mechanism through an Overtime Continue`, () => {
    const save = overtimeTestFromUrl(new URL('https://test/?test=overtime'))!;
    const g = new Game();
    g.startTest({ ...save, startingGun: gun });
    g.testRun = null;
    const valid = checkpoint(g),
      continued = new Game();
    continued.start(valid.seed, valid);
    assert(continued.overtime);
    assert.equal(continued.startingGun, gun);
    assert.deepEqual(continued.gun, getGun(continued.mods, gun));
    assert.deepEqual(continued.gun, g.gun);
  });
}

test('new Daily tools rotate deterministically and override Campaign choice; preserved Dailies keep the pistol', () => {
  const seen = new Set();
  for (const day of ['2026-10-03', '2026-10-04', '2026-10-05']) {
    const daily = dailyForDate(day)!;
    const expected = dailyStartingGun(daily.seed)!;
    seen.add(expected);
    for (const selected of STARTING_GUN_IDS) {
      const g = start(selected, daily.seed);
      assert.equal(g.startingGun, expected);
      const save = checkpoint(g),
        continued = new Game();
      continued.start(save.seed, save);
      assert.deepEqual(continued.gun, g.gun);
      assert.equal(
        loadCheckpoint({ ...save, startingGun: STARTING_GUN_IDS.find((id) => id !== expected) }),
        null,
      );
    }
  }
  assert.equal(seen.size, 3);
  for (const ruleset of SUPPORTED_DAILY_RULESETS.filter((v) => v < 86)) {
    const seed = dailyForDate('2026-10-03', ruleset)!.seed;
    assert.equal(start('shotgun', seed).startingGun, 'pistol');
  }
  for (const seed of ['Campaign', 'RF-D86-2026-02-30', 'RF-D86-2026-2-01'])
    assert.equal(dailyStartingGun(seed), undefined);
});

test('RF2 blueprints, recaps and progress backups preserve native tools without granting discoveries', async () => {
  const disk = new Map<string, string>();
  const store = new ProgressStore(() => ({
    getItem: (k) => disk.get(k) ?? null,
    setItem: (k, v) => {
      disk.set(k, v);
    },
    removeItem: (k) => {
      disk.delete(k);
    },
  }));
  for (const gun of ['shotgun', 'nailgun'] as const) {
    const mods = ['cutting-torch', 'burst'];
    const code = blueprintCode(mods, gun),
      imported = parseBlueprintCode(code);
    assert(code.startsWith('RF2.'));
    assert.equal(imported.startingGun, gun);
    assert.deepEqual(imported.mods, mods);
    assert.equal(blueprintCode(imported.mods, imported.startingGun), code);
    const workshop = new Game();
    workshop.startWorkshop(mods, imported.mods, imported.startingGun);
    assert.equal(workshop.startingGun, gun);
    assert.deepEqual(workshop.gun, getGun(mods, gun));
    const g = start(gun),
      save = checkpoint(g);
    g.die();
    const recap = snapshotRun(g, gun)!;
    assert.equal(loadRunHistory([recap])[0].startingGun, gun);
    assert(await store.write(CHECKPOINT_KEY, save));
    assert(await store.write(RUN_HISTORY_KEY, [recap]));
    const slots = setBlueprint(loadBlueprints(null), 0, imported);
    assert(await store.write(BLUEPRINTS_KEY, slots));
    const backup = parseProgressBackup(store.backup('4.1.0'));
    assert.equal(backup.values[CHECKPOINT_KEY]!.startingGun, gun);
    assert.equal(backup.values[RUN_HISTORY_KEY][0].startingGun, gun);
    assert.equal(backup.values[BLUEPRINTS_KEY][0]!.startingGun, gun);
    const oldRecap = { ...recap };
    delete oldRecap.startingGun;
    assert.equal(loadRunHistory([oldRecap]).length, 1);
    assert.equal(loadRunHistory([{ ...recap, startingGun: 'invalid' }]).length, 0);
  }
  assert(blueprintCode([]).startsWith('RF1.'));
  assert.deepEqual(parseBlueprintCode(blueprintCode([])), { name: 'Shared build', mods: [] });
  assert(!validBlueprint({ name: 'Bad', mods: [], startingGun: 'constructor' }));
  for (const payload of [['laser', []], ['shotgun', ['rewire']], ['shotgun'], ['shotgun', [], 1]]) {
    const code =
      'RF2.' +
      btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    assert.throws(() => parseBlueprintCode(code));
  }
});

const families = [
  ['scatter', 'burst', 'rapid', 'crossfire', 'bloom', 'split', 'backfire'],
  ['cutting-torch', 'burst', 'pulse-chamber', 'scatter', 'rapid'],
  ['cutting-torch', 'charge-lens', 'scatter', 'burst'],
  ['mass-driver', 'scatter', 'burst', 'drop-forge'],
  ['shellshock', 'fuse', 'scatter', 'burst', 'aftershock'],
  ['scatter', 'burst', 'grindshot', 'ricochet', 'recall'],
];
for (const gun of ['shotgun', 'nailgun'] as const)
  for (const mods of families) {
    test(`${gun} remains finite and bounded with ${mods.join('/')}`, (t) => {
      const random = Math.random;
      Math.random = seeded('starting-tool-stress');
      t.after(() => {
        Math.random = random;
      });
      const g = fixture(mods);
      g.startingGun = gun;
      g.gun = getGun(mods, gun);
      const aim = { x: mods.includes('recall') ? 320 : 700, y: 300 };
      target(g, aim.x, aim.y);
      for (let frame = 0; frame < 900; frame++) {
        g.tick(1 / 60, {
          ...input,
          fire: !mods.includes('charge-lens') || frame % 120 < 90,
          aim,
        });
        assert(g.shots.length <= 180);
        assert(g.particles.length <= 220);
        assert([g.hp, g.player.position.x, g.player.position.y].every(Number.isFinite));
      }
      assert(g.shotCount > 0);
      assert(g.enemies[0].hp < g.enemies[0].maxHp, 'The converted gun must damage its target');
      for (const b of Composite.allBodies(g.engine.world))
        assert([b.position.x, b.position.y].every(Number.isFinite));
    });
  }
