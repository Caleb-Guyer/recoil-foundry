import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, EXTRACTION_DURATION } from '../src/game.ts';
import { loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import {
  SECURITY_KEY,
  loadSecurityProfile,
  recordSecurityClear,
  validSecurityProfile,
  campaignClearScore,
  securityMenu,
  type SecurityLevel,
} from '../src/security.ts';
import { SECURITY_TELL, SECURITY_LOCK } from '../src/security-combat.ts';
import { SECURITY_LAYOUTS, redlineLayout, reinforceSecurity } from '../src/security-layouts.ts';
import { getLevel } from '../src/levels.ts';
import { splitWaves } from '../src/reinforcements.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { hazardBounds } from '../src/hazard-layouts.ts';
import { testCheckpoint, practiceCheckpoint } from '../src/practice.ts';
import { dailyForDate } from '../src/daily.ts';
import { securityTestFromUrl } from '../src/security-test.ts';
import {
  ProgressStore,
  CHECKPOINT_KEY,
  parseProgressBackup,
  validateProgress,
} from '../src/progress.ts';
import { LOGBOOK_KEY } from '../src/logbook.ts';
import { COMMENDATIONS_KEY } from '../src/commendations.ts';
import { COSMETICS_KEY, loadCosmetics } from '../src/cosmetics.ts';
import { loadRunHistory, snapshotRun, reachedRoom } from '../src/run-history.ts';

const empty = () => loadSecurityProfile(null);
const base = (level: SecurityLevel = 0, seed = 'security-check', stage = 0) => {
  const s = testCheckpoint(seed, stage)!;
  s.version = 6;
  if (level) s.security = { level, rules: 1 };
  return s;
};
const overlap = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.1 &&
  Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.1;

test('victories unlock security sequentially; lower grades stay available and records remain separate', () => {
  let p = empty();
  assert.equal(p.unlocked, 0);
  assert.deepEqual(recordSecurityClear(p, { level: 3, timeMs: 1000, seed: 'x' }), p);
  for (const level of [0, 1, 2, 3] as const) {
    p = recordSecurityClear(p, { level, timeMs: 60000 + level * 1000, seed: 'grade-' + level });
    assert.equal(p.unlocked, Math.min(3, level + 1));
  }
  assert.equal(p.bests.length, 4);
  assert(validSecurityProfile(p));
  const old = structuredClone(p);
  p = recordSecurityClear(p, { level: 1, timeMs: 100000, seed: 'slower' });
  assert.deepEqual(p, old);
  p = recordSecurityClear(p, { level: 1, timeMs: 50000, seed: 'faster' });
  assert.equal(p.bests[1].seed, 'faster');
  assert.equal(p.bests[3].seed, 'grade-3');
  assert.equal(loadSecurityProfile(null, true).unlocked, 1);
  assert.deepEqual(loadSecurityProfile(null, true).bests, []);
});
test('invalid scores and malformed profiles cannot unlock a grade', () => {
  for (const timeMs of [0, -1, NaN, Infinity, 0.5, 1e12])
    assert.deepEqual(recordSecurityClear(empty(), { level: 0, timeMs, seed: 'x' }), empty());
  for (const seed of ['', 'x'.repeat(41), dailyForDate('2026-09-29')!.seed])
    assert.deepEqual(recordSecurityClear(empty(), { level: 0, timeMs: 1, seed }), empty());
  assert(!validSecurityProfile({ version: 1, unlocked: 9, bests: [] }));
  assert(
    !validSecurityProfile({
      version: 1,
      unlocked: 3,
      bests: [{ level: 3, timeMs: -5, seed: 'x' }],
    }),
  );
  assert(validSecurityProfile({ bests: [], unlocked: 1, version: 1 }));
});
test('checkpoints preserve security and reject Daily, unknown grades and future rules', () => {
  for (const level of [1, 2, 3] as const) {
    const save = base(level);
    assert(loadCheckpoint(save));
    const g = new Game();
    let written: Checkpoint | null = null;
    g.onCheckpoint = (s) => (written = s);
    g.start(save.seed, save);
    assert.equal(g.security?.level, level);
    assert.equal(written!.security!.level, level);
    const other = new Game();
    other.start(written!.seed, loadCheckpoint(written)!);
    assert.deepEqual(other.level, g.level);
    assert.deepEqual(other.security, g.security);
  }
  for (const security of [
    { level: 0, rules: 1 },
    { level: 4, rules: 1 },
    { level: 2, rules: 2 },
    null,
  ])
    assert.equal(loadCheckpoint({ ...base(), security }), null);
  assert.equal(loadCheckpoint({ ...base(2), seed: dailyForDate('2026-09-29')!.seed }), null);
});
test('old saves, Daily, Practice and Workshop keep standard encounters and enemy health', () => {
  const g = new Game();
  g.start('security-new', undefined, null, null, false, 3);
  assert.equal(g.security?.level, 3);
  const old = base();
  g.start(old.seed, old);
  assert.equal(g.security, null);
  const daily = dailyForDate('2026-09-29')!.seed;
  const a = new Game();
  a.start(daily, undefined, null, null, false, 3);
  const b = new Game();
  b.start(daily);
  assert.equal(a.security, null);
  assert.deepEqual(a.level, b.level);
  for (const grade of [0, 1, 2, 3] as const) {
    g.start('boss-stats', base(grade, 'boss-stats', 3));
    const enemy = g.enemies[0];
    b.start('boss-stats', base(0, 'boss-stats', 3));
    assert.equal(enemy.hp, b.enemies[0].hp);
  }
  g.startPractice({ kind: 'loader', seed: 'practice' });
  assert.equal(g.security, null);
  g.startWorkshop([], []);
  assert.equal(g.security, null);
});
test('five Redline rooms have hull-clear spawn anchors, safe entrance bays and reserved machinery sweeps in both mirrors', () => {
  assert.equal(SECURITY_LAYOUTS.length, 5);
  for (let area = 0; area < 5; area++)
    for (const mirrored of [false, true]) {
      const level = redlineLayout({ ...getLevel('geometry', area * 4), mirrored }, area * 4);
      assert.equal(level.security, true);
      for (const s of level.spawns) {
        const { w, h } = ENEMY_STATS[s.kind],
          hull = { x: s.x - w / 2, y: s.y - h / 2, w, h };
        assert(s.x >= 250 && s.x <= 1750, level.name + ' entrance');
        for (const solid of level.solids)
          assert(!overlap(hull, solid), `${level.name} ${s.kind} intersects solid`);
        for (const hazard of level.hazards!)
          assert(
            !overlap(hull, hazardBounds(hazard, 44)),
            `${level.name} spawn in moving machinery`,
          );
        if (!['flyer', 'skimmer', 'sifter'].includes(s.kind))
          assert(
            Math.abs(hull.y + h - 740) < 0.1 ||
              level.solids.some(
                (solid) =>
                  Math.abs(hull.y + h - solid.y) < 0.1 &&
                  hull.x >= solid.x &&
                  hull.x + w <= solid.x + solid.w,
              ),
          );
      }
      for (const hazard of level.hazards!)
        for (const solid of level.solids)
          assert(
            !overlap(hazardBounds(hazard, 44), solid),
            level.name + ' machinery traps a rider',
          );
      assert(level.solids.every((s) => s.x >= 280 && s.x + s.w <= 1740));
    }
});
test('Security squads enter together without adding bodies, mutating layouts or occupying new hulls', () => {
  let squads = 0;
  for (let n = 0; n < 48; n++)
    for (const stage of [1, 5, 9, 13, 17]) {
      const seed = 'security-squads-' + n,
        original = getLevel(seed, stage),
        frozen = JSON.stringify(original);
      const result = reinforceSecurity(original, seed, stage, 1);
      assert.equal(JSON.stringify(original), frozen);
      assert.equal(result.spawns.length, original.spawns.length);
      assert.deepEqual(reinforceSecurity(original, seed, stage, 1), result);
      const pair = result.spawns.filter((s) => s.squad);
      if (!pair.length) continue;
      squads++;
      assert.equal(pair.length, 2);
      const [first, second] = splitWaves(result, seed, stage);
      assert.equal(first.filter((s) => s.squad).length, 0);
      assert.equal(second.filter((s) => s.squad).length, 2);
      for (const s of pair) {
        const { w, h } = ENEMY_STATS[s.kind];
        for (const solid of result.solids)
          assert(!overlap({ x: s.x - w / 2, y: s.y - h / 2, w, h }, solid));
      }
    }
  assert(squads >= 120, `Too few changed rooms: ${squads}/240`);
});
test('Redline layouts cannot replace events, bosses, optional routes or Overtime', () => {
  const g = new Game();
  g.start('redline-layout', base(3));
  assert.equal(g.level.id, 'security-docks');
  const event = {
    ...base(3),
    areaEvent: {
      kind: 'blackout' as const,
      area: 0,
      room: 0,
      relays: [],
      caches: [],
      commander: false,
      rerolls: 0,
    },
  };
  g.start(event.seed, event);
  assert.equal(g.level.id, 'security-docks');
  assert.equal(g.areaEvents.active, null);
  const laterEvent = {
    ...event,
    stage: 4,
    areaEvent: { ...event.areaEvent, area: 1, room: 4 },
  };
  g.start(laterEvent.seed, laterEvent);
  assert.notEqual(g.level.id, 'security-docks');
  assert.equal(g.areaEvents.active, 'blackout');
  g.start('security-boss', base(3, 'security-boss', 3));
  assert(g.level.boss);
  assert(!g.level.security);
  const ot = { ...base(3), overtime: { baseMods: 0, repairs: 0, remix: 5 as const } };
  g.start(ot.seed, ot);
  assert(g.level.overtimeDocks);
  assert.notEqual(g.level.id, 'security-docks');
});
test('boss counterattacks keep full warnings, lock aim and fire once without doubling recovery', () => {
  const g = new Game();
  g.start('security-boss', base(2, 'security-boss', 3));
  const e = g.enemies[0];
  e.spawn = 0;
  const sc = g.securityCombat;
  e.state = 'rush';
  sc.update(e, 1 / 60);
  e.state = 'recover';
  e.timer = 1.2;
  const shots: number[] = [];
  g.enemyShot = (_e, a) => {
    shots.push(a);
  };
  for (let i = 0; i < 30; i++) {
    sc.update(e, 1 / 60);
    e.timer -= 1 / 60;
  }
  assert.equal(shots.length, 0);
  assert(Math.abs(e.timer - 0.7) < 0.0001);
  assert.equal(sc.counters.size, 1);
  for (let i = 0; i < Math.ceil((SECURITY_TELL - SECURITY_LOCK) * 60) - 30 + 1; i++) {
    sc.update(e, 1 / 60);
    e.timer -= 1 / 60;
  }
  const aim = { ...sc.counters.get(e)!.aim };
  Matter.Body.setPosition(g.player, { x: 1900, y: 300 });
  sc.update(e, 1 / 60);
  e.timer -= 1 / 60;
  assert.deepEqual(sc.counters.get(e)!.aim, aim);
  for (let i = 0; i < 40; i++) {
    sc.update(e, 1 / 60);
    e.timer -= 1 / 60;
  }
  assert(shots.length === 2 || shots.length === 3);
  const count = shots.length;
  for (let i = 0; i < 60; i++) sc.update(e, 1 / 60);
  assert.equal(shots.length, count);
  e.state = 'rush';
  sc.update(e, 1 / 60);
  e.state = 'recover';
  sc.update(e, 1 / 60);
  assert.equal(sc.counters.size, 0, 'next attack retains ordinary recovery');
});
test('counterattacks cancel on interrupted recovery and reset on room changes', () => {
  const g = new Game();
  g.start('cancel', base(2, 'cancel', 3));
  const e = g.enemies[0];
  e.state = 'rush';
  g.securityCombat.update(e, 1 / 60);
  e.state = 'recover';
  g.securityCombat.update(e, 1 / 60);
  assert.equal(g.securityCombat.counters.size, 1);
  e.state = 'transition';
  g.securityCombat.update(e, 1 / 60);
  assert.equal(g.securityCombat.counters.size, 0);
  g.securityCombat.reset();
  e.state = 'rush';
  g.securityCombat.update(e, 1 / 60);
  e.state = 'recover';
  g.securityCombat.update(e, 1 / 60);
  g.loadRoom();
  assert.equal(g.securityCombat.counters.size, 0);
});
function extracted(level: SecurityLevel, overtimeDoor = false) {
  const g = new Game(),
    save = base(level, 'security-finish', 19);
  save.escape = true;
  g.start(save.seed, save);
  g.elapsed = 800;
  g.escape!.phase = 'extracting';
  g.escape!.depart = EXTRACTION_DURATION;
  if (overtimeDoor) g.escape!.destination = 'overtime';
  return g;
}
test('both departure choices award one campaign clearance and Redline reward before Overtime', () => {
  for (const door of [false, true]) {
    const g = extracted(3, door);
    const scores: unknown[] = [],
      awards: string[] = [];
    g.onCampaignClear = (s) => scores.push(s);
    g.onCommendation = (id) => {
      assert.equal(g.mode, 'playing');
      awards.push(id);
    };
    if (door) assert(g.startOvertime());
    else g.updateExtraction(1 / 60);
    assert.deepEqual(scores, [{ level: 3, timeMs: 800000, seed: 'security-finish' }]);
    assert.deepEqual(awards, ['redline']);
    g.recordCampaignClear();
    assert.equal(scores.length, 1);
    if (door) {
      assert.equal(g.security?.level, 3);
      assert(g.overtime);
    }
  }
});
test('death, incomplete extraction, test previews, Practice and Overtime cannot grant campaign clearance', () => {
  for (const exclusion of ['dead', 'incomplete', 'test', 'practice', 'overtime'] as const) {
    const g = extracted(2);
    if (exclusion === 'dead') g.hp = 0;
    if (exclusion === 'incomplete') g.escape!.depart = 0.5;
    if (exclusion === 'test') g.testRun = base(2);
    if (exclusion === 'practice') g.practice = { kind: 'interceptor', seed: g.seed };
    if (exclusion === 'overtime') g.overtime = { baseMods: 19, repairs: 0 };
    assert.equal(campaignClearScore(g), null, exclusion);
  }
});
test('security records, checkpoint and Redline outfit survive atomic export, restore and older backup migration', async () => {
  const disk = new Map<string, string>();
  const storage = {
    getItem: (k: string) => disk.get(k) ?? null,
    setItem: (k: string, v: string) => {
      disk.set(k, v);
    },
    removeItem: (k: string) => {
      disk.delete(k);
    },
  };
  const store = new ProgressStore(() => storage);
  let p = empty();
  for (const level of [0, 1, 2, 3] as const)
    p = recordSecurityClear(p, { level, timeMs: 1000 + level, seed: 'x' });
  store.write(SECURITY_KEY, p);
  store.write(CHECKPOINT_KEY, base(3));
  store.write(COMMENDATIONS_KEY, ['redline']);
  store.write(COSMETICS_KEY, { gun: 'standard', outfit: 'redline' });
  await store.settled();
  const backup = parseProgressBackup(store.backup('test'));
  assert.deepEqual(backup.values[SECURITY_KEY], p);
  assert.equal((backup.values[CHECKPOINT_KEY] as Checkpoint).security?.level, 3);
  assert.deepEqual(loadCosmetics(backup.values[COSMETICS_KEY], ['redline']), {
    gun: 'standard',
    outfit: 'redline',
  });
  const old = { ...backup.values } as Record<string, unknown>;
  delete old[SECURITY_KEY];
  old[LOGBOOK_KEY] = { version: 1, enemies: [], areas: [], escaped: true };
  assert.equal((validateProgress(old)![SECURITY_KEY] as typeof p).unlocked, 1);
});
test('run recaps preserve security and never mix it into Daily records', () => {
  const g = new Game();
  g.start('recap', base(2, 'recap', 5));
  g.hp = 0;
  g.setMode('dead');
  const r = snapshotRun(g, 'test', 1)!;
  assert.equal(r.security, 2);
  assert.match(reachedRoom(r), /Security II/);
  assert.equal(loadRunHistory([r])[0].security, 2);
  assert.deepEqual(
    loadRunHistory([{ ...r, seed: dailyForDate('2026-09-29')!.seed, mode: 'daily' }]),
    [],
  );
  assert.deepEqual(loadRunHistory([{ ...r, security: 99 }]), []);
});
test('preview links produce legal isolated builds and the menu disables locked grades', () => {
  for (const area of ['docks', 'furnace', 'cooling', 'reclamation', 'rooftops'])
    for (const level of [1, 2, 3])
      for (const boss of [0, 1]) {
        const save = securityTestFromUrl(
          new URL(`https://game.test/?test=security&area=${area}&level=${level}&boss=${boss}`),
        );
        assert(save);
        assert(loadCheckpoint(save), `${area} ${level} ${boss}`);
        const g = new Game();
        let writes = 0;
        g.onCheckpoint = () => writes++;
        g.startTest(save);
        assert.equal(writes, 0);
        assert.equal(g.security?.level, level);
      }
  for (const extra of ['&level=4', '&daily=2026-09-29', '&boss=loader', '&level=1&level=2'])
    assert.equal(securityTestFromUrl(new URL('https://game.test/?test=security' + extra)), null);
  const html = securityMenu(loadSecurityProfile(null, true), 0);
  assert.match(html, /data-security="2"[^>]+disabled/);
  assert.match(html, /Redline outfit/);
});
