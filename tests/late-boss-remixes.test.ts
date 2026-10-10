import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import { Body, fixture, target } from './branches-fixture.ts';
import {
  BOSS_REMIXES,
  bossRemixFor,
  matchesRemixBoss,
  recordBossRemix,
  remixEncounter,
  BOSS_REMIXES_KEY,
} from '../src/boss-remix-rules.ts';
import { LATE_BOSS_MASTERIES } from '../src/late-boss-mastery.ts';
import { lateInterceptorAngles, sorterRemixLanes } from '../src/late-boss-patterns.ts';
import { beginInterceptorAttack, interceptorAngles } from '../src/interceptor.ts';
import { sorterFan } from '../src/reclamation.ts';
import { COMMENDATIONS, commendationVisible, type CommendationId } from '../src/commendations.ts';
import { testCheckpoint } from '../src/practice.ts';
import { loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import { loadLogbook } from '../src/logbook.ts';
import { ARCHIVE_KEY, encounterArchive, loadArchive } from '../src/archive.ts';
import { logbookCatalog } from '../src/logbook-catalog.ts';
import { goalById, type GoalProgress } from '../src/next-goal.ts';
import { loadTrackedGoal, trackedGoal } from '../src/tracked-goal.ts';
import { commendationRewards, REWARD_CATALOG } from '../src/run-rewards.ts';
import { loadCosmetics } from '../src/cosmetics.ts';
import { loadSecurityProfile } from '../src/security.ts';
import { getLevel } from '../src/levels.ts';
import { ProgressStore, parseProgressBackup } from '../src/progress.ts';
import { commandRemixAngles } from '../src/late-boss-patterns.ts';
import { newUprising, type UprisingRouteId } from '../src/uprising-model.ts';
import { playRoom } from './room-pilot.ts';
import {
  snapshotPracticeWin,
  loadPracticeRecords,
  recordPracticeWin,
} from '../src/practice-records.ts';

function campaign(id: (typeof LATE_BOSS_MASTERIES)[number]['remix']) {
  const info = BOSS_REMIXES[id];
  const seed = Array.from({ length: 50 }, (_, n) => 'RF-C91-LATE-' + n).find(
    (s) =>
      bossRemixFor(s, info.boss) === id &&
      matchesRemixBoss(id, getLevel(s, info.stage).spawns[0]?.kind),
  )!;
  const save: Checkpoint = {
    ...testCheckpoint(seed, info.stage),
    version: 6,
    encounters: 1,
    bossRemixes: 1,
    cleanBoss: true,
  };
  const g = new Game();
  g.start(seed, save);
  assert.equal(g.level.bossRemix, id);
  g.enemies[0].spawn = 0;
  return g;
}
for (const mastery of LATE_BOSS_MASTERIES) {
  const id = mastery.remix,
    info = BOSS_REMIXES[id];
  test(`${id}: new Campaign revision, honest discovery and exact Continue`, () => {
    for (const seed of ['RF-C90-OLD', 'old', 'RF-D90-2026-10-10'])
      assert.equal(bossRemixFor(seed, info.boss), undefined);
    const g = campaign(id);
    assert.deepEqual(recordBossRemix(null, g, false).seen, []);
    assert.deepEqual(recordBossRemix(null, g, true).seen, [id]);
    let saved: Checkpoint | null = null;
    g.onCheckpoint = (s) => {
      saved = s;
    };
    g.save();
    assert(saved);
    assert(loadCheckpoint(saved));
    const resumed = new Game();
    resumed.start(g.seed, saved);
    assert.deepEqual(resumed.level, g.level);
    assert.equal(resumed.commendations.cleanBoss, true);
    const first = new Game();
    first.start(g.seed);
    first.stage = info.stage;
    first.loadRoom();
    assert.equal(first.level.bossRemix, undefined);
  });
  test(`${id}: only a clean eligible Campaign kill earns its own pictured cosmetic`, () => {
    for (const mode of [
      'clean',
      'damaged',
      'continued-damage',
      'practice',
      'preview',
      'cleanup',
    ] as const) {
      let g = campaign(id);
      const awards: CommendationId[] = [];
      if (mode === 'practice') g.startPractice(remixEncounter(id));
      if (mode === 'preview')
        g.startTest({ ...testCheckpoint('REMIX-' + id, info.stage), version: 6, bossRemix: id });
      if (mode.includes('damage')) {
        g.hurtAt = -100;
        g.damagePlayer(1, { x: 100, y: 700 }, { type: 'induction', enemy: 'sorter' });
        assert.equal(g.commendations.cleanBoss, false);
        if (mode === 'continued-damage') {
          let save: Checkpoint | null = null;
          g.onCheckpoint = (s) => {
            save = s;
          };
          g.save();
          assert(save);
          const resumed = new Game();
          resumed.start(g.seed, save);
          g = resumed;
          assert.equal(g.commendations.cleanBoss, false);
        }
      }
      g.onCommendation = (award) => awards.push(award);
      const boss = g.enemies[0];
      boss.spawn = 0;
      g.hitEnemy(
        boss,
        999999,
        undefined,
        false,
        false,
        true,
        mode === 'cleanup' ? 'cleanup' : undefined,
      );
      assert.equal(awards.includes(mastery.id), mode === 'clean', mode);
      assert.equal(
        awards.filter((a) => LATE_BOSS_MASTERIES.some((m) => m.id === a)).length,
        mode === 'clean' ? 1 : 0,
      );
    }
    const rewards = commendationRewards(mastery.id);
    assert.equal(rewards.length, 1);
    const reward = REWARD_CATALOG.find((r) => r.id === rewards[0])!;
    assert.equal(reward.name, mastery.reward);
    assert.equal(reward.image, reward.id);
    const selection = reward.id.startsWith('appearance:gun:')
      ? { gun: reward.id.split(':')[2] }
      : { outfit: reward.id.split(':')[2] };
    assert.deepEqual(loadCosmetics(selection, []), { gun: 'standard', outfit: 'standard' });
    assert.notDeepEqual(loadCosmetics(selection, [mastery.id]), {
      gun: 'standard',
      outfit: 'standard',
    });
  });
  test(`${id}: encounter reveals the real arena and a trackable mastery without granting it`, () => {
    const archive = encounterArchive(null, ['remix:' + id]),
      book = loadLogbook(null);
    assert(!commendationVisible(mastery.id, [info.boss], [], []));
    assert(commendationVisible(mastery.id, [], [], [], archive.encountered));
    const entries = logbookCatalog([], book, [], archive);
    const arena = entries.find((e) => e.id === 'remix:' + id)!;
    assert.equal(arena.state, 'known');
    assert.equal(arena.name, info.name);
    assert.equal(entries.find((e) => e.id === 'commendation:' + mastery.id)!.state, 'locked');
    const p: GoalProgress = {
      weapons: { version: 1, started: true, cleared: true, overtime: true },
      security: loadSecurityProfile({ version: 1, unlocked: 3, bests: [] }),
      book,
      earned: [],
      victories: [],
      discovered: [],
      revealed: archive.encountered,
      milestones: {},
    };
    const goal = goalById(p, 'commendation:' + mastery.id)!;
    assert(goal);
    assert.equal(goal.reward, mastery.reward + ' · ' + mastery.slot);
    const pref = loadTrackedGoal({ version: 1, id: goal.id });
    assert.equal(trackedGoal(p, pref)?.id, goal.id);
    assert.equal(trackedGoal({ ...p, earned: [mastery.id] }, pref), null);
    assert.equal(goalById({ ...p, revealed: [] }, goal.id), null);
  });
}
for (const id of ['sorter-beltline', 'sorter-magnetic-return'] as const)
  test(`${id}: fields lock before discharge and the fan fires its actual warning rays`, () => {
    const g = fixture([]),
      e = target(g, 800, 300, 'sorter');
    g.stage = 15;
    g.level.bossRemix = id;
    e.state = 'windup';
    e.attack = 'slam';
    e.timer = 0.9;
    g.updateEnemy(e, 1 / 60);
    const lanes = [...e.sorter!.lanes];
    Body.setPosition(g.player, { x: 1200, y: 300 });
    e.timer = 0.4;
    g.updateEnemy(e, 1 / 60);
    assert.deepEqual(e.sorter!.lanes, lanes);
    let damage = 0;
    g.damagePlayer = () => {
      damage++;
    };
    e.timer = 0;
    g.updateEnemy(e, 1 / 60);
    assert.equal(damage, lanes.some((x) => Math.abs(1200 - x) < 55) ? 1 : 0);
    assert.equal(e.state, 'recover');
    assert(e.timer >= 1.6);
    e.state = 'windup';
    e.attack = 'fan';
    e.timer = 0;
    const rays = sorterFan(e, id);
    g.updateEnemy(e, 1 / 60);
    assert.equal(g.shots.length, rays.length);
    for (const [i, shot] of g.shots.entries())
      assert(
        Math.abs(
          Math.atan2(
            Math.sin(Math.atan2(shot.vel.y, shot.vel.x) - rays[i]),
            Math.cos(Math.atan2(shot.vel.y, shot.vel.x) - rays[i]),
          ),
        ) < 1e-8,
      );
    for (const x of [60, 200, 1000, 1800, 1940]) {
      const fields = sorterRemixLanes(id, x, 2);
      assert(fields.every((lane) => lane >= 60 && lane <= 1940));
      assert(
        Array.from({ length: 39 }, (_, n) => 60 + n * 48).some((safe) =>
          fields.every((lane) => Math.abs(lane - safe) > 80),
        ),
      );
    }
  });
for (const id of ['boss-skybridge', 'boss-crossfire'] as const)
  test(id + ': locked volleys match their warning rays, then expose the core', () => {
    const g = fixture([]),
      e = target(g, 800, 300, 'interceptor');
    g.stage = 19;
    g.level.bossRemix = id;
    beginInterceptorAttack(g, e, id === 'boss-skybridge' ? 'aimed' : 'crossfire');
    assert.equal(e.state, 'windup');
    assert(e.timer >= 1);
    for (const state of ['windup', 'followup'] as const) {
      assert.equal(e.state, state);
      e.timer = 0.2;
      const locked = { ...e.aim };
      Body.setPosition(g.player, { x: 300, y: 620 });
      g.updateEnemy(e, 1 / 60);
      assert.deepEqual(e.aim, locked);
      const rays = interceptorAngles(e, id),
        before = g.shots.length;
      e.timer = 0;
      g.updateEnemy(e, 1 / 60);
      assert.equal(g.shots.length - before, rays.length);
      for (const [i, shot] of g.shots.slice(before).entries())
        assert(
          Math.abs(
            Math.atan2(
              Math.sin(Math.atan2(shot.vel.y, shot.vel.x) - rays[i]),
              Math.cos(Math.atan2(shot.vel.y, shot.vel.x) - rays[i]),
            ),
          ) < 1e-8,
        );
    }
    assert.equal(e.state, 'recover');
    assert(e.timer >= 1.25);
    const hp = e.hp;
    g.hitEnemy(e, 100, undefined, false, false, false);
    assert.equal(hp - e.hp, 130);
    e.state = 'windup';
    const armor = e.hp;
    g.hitEnemy(e, 100, undefined, false, false, false);
    assert.equal(armor - e.hp, 35);
    if (id === 'boss-crossfire') {
      e.interceptor!.move = 'crossfire';
      e.interceptor!.volley = 0;
      const first = interceptorAngles(e, id);
      e.interceptor!.volley = 1;
      assert.notDeepEqual(interceptorAngles(e, id), first);
    }
  });
test('Beltline belts, magnetic scrap and Skybridge lifts are real physics machinery', () => {
  const belt = campaign('sorter-beltline');
  assert.equal(belt.conveyors.items.length, 2);
  assert(belt.conveyors.items[0].speed * belt.conveyors.items[1].speed < 0);
  const magnet = campaign('sorter-magnetic-return');
  assert.equal(magnet.magnets.items.length, 2);
  assert.equal(magnet.props.items.filter((p) => p.kind === 'crate').length, 2);
  const sky = campaign('boss-skybridge');
  assert.equal(sky.hazards.items.filter((h) => h.placement.kind === 'lift').length, 2);
});
for (const id of ['boss-skybridge', 'boss-crossfire'] as const) {
  test(
    id + ': Command fires its displayed rays through both volleys and opens after the pair',
    () => {
      const g = fixture([]),
        e = target(g, 800, 300, 'boss');
      g.level.bossRemix = id;
      g.stage = 19;
      e.timer = 0;
      e.state = 'idle';
      g.updateEnemy(e, 1 / 60);
      assert.equal(e.state, 'windup');
      assert(e.timer >= 1);
      for (const state of ['windup', 'followup'] as const) {
        assert.equal(e.state, state);
        const rays = commandRemixAngles(id, e),
          before = g.shots.length;
        e.timer = 0;
        g.updateEnemy(e, 1 / 60);
        assert.equal(g.shots.length - before, rays.length);
        for (const [i, s] of g.shots.slice(before).entries())
          assert(
            Math.abs(
              Math.atan2(
                Math.sin(Math.atan2(s.vel.y, s.vel.x) - rays[i]),
                Math.cos(Math.atan2(s.vel.y, s.vel.x) - rays[i]),
              ),
            ) < 1e-8,
          );
      }
      assert.equal(e.state, 'recover');
      assert(e.timer >= 1.5);
      e.attack = 'ring';
      assert.equal(commandRemixAngles(id, e).length, 8);
    },
  );
  for (const [finale, first, success] of [
    ['isolated', 'rail-escape', 'core-sabotage'],
    ['hunted', 'rail-heist', 'rail-heist'],
    ['mutiny', 'rail-escape', 'crew-relief'],
    ['overloaded', 'rail-escape', null],
  ] as const)
    test(
      id + ': ' + finale + ' retains its job consequence, arena, Continue and playable defense',
      () => {
        const g = campaign(id);
        g.uprising.run = newUprising();
        const choices: UprisingRouteId[] = [first, 'core-defense', 'crew-relief', 'roof-escape'];
        if (success === 'core-sabotage') choices[1] = 'core-sabotage';
        g.uprising.run.choices = choices;
        g.uprising.run.outcomes = choices.map((route) => ({
          route,
          result: route === success ? 'success' : 'failed',
        }));
        g.loadRoom();
        assert.equal(g.uprising.finale, finale);
        assert.equal(g.level.bossRemix, id);
        assert.equal(g.enemies[0].kind, finale === 'hunted' ? 'interceptor' : 'boss');
        if (id === 'boss-skybridge') assert.equal(g.hazards.items.length, 2);
        let save: Checkpoint | null = null;
        g.onCheckpoint = (s) => {
          save = s;
        };
        g.save();
        assert(save);
        assert(loadCheckpoint(save));
        const continued = new Game();
        continued.start(g.seed, save);
        assert.deepEqual(continued.level, g.level);
        assert.equal(continued.uprising.finale, finale);
        assert.equal(
          recordBossRemix(null, g, true).seen.length,
          0,
          'Spawn must finish before discovery',
        );
        const result = playRoom(g, 180);
        assert(result.clear && result.hp > 0, JSON.stringify({ id, finale, ...result }));
      },
    );
  test(id + ': final-room Practice records accept the full nineteen-fitting preset', () => {
    const g = new Game();
    assert(g.startPractice(remixEncounter(id)));
    assert.equal(g.stage, 19);
    assert.equal(g.mods.length, 19);
    const result = playRoom(g, 180);
    assert(result.clear && result.hp > 0);
    g.hitStop = 0;
    const idle = {
      left: false,
      right: false,
      jump: false,
      jumpHeld: false,
      fire: false,
      aim: { x: 1000, y: 300 },
    };
    for (let n = 0; n < 60 && g.mode !== 'won'; n++) g.tick(1 / 60, idle);
    assert.equal(g.mode, 'won');
    const win = snapshotPracticeWin(g, true)!;
    assert(win);
    assert.equal(loadPracticeRecords(recordPracticeWin([], win).records)[0].remix, id);
  });
}
test('all new discovery and mastery IDs round-trip through backup; old rematches migrate to arena records', () => {
  const map = new Map<string, string>();
  const disk = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
  map.set(
    BOSS_REMIXES_KEY,
    JSON.stringify({
      version: 1,
      seen: ['loader-crossdock', ...LATE_BOSS_MASTERIES.map((m) => m.remix)],
    }),
  );
  const store = new ProgressStore(() => disk);
  const archive = loadArchive(store.read(ARCHIVE_KEY));
  assert(archive.encountered.includes('remix:loader-crossdock'));
  for (const m of LATE_BOSS_MASTERIES) assert(archive.encountered.includes('remix:' + m.remix));
  assert(
    COMMENDATIONS.every((c) => !('remix' in c) || LATE_BOSS_MASTERIES.some((m) => m.id === c.id)),
  );
  assert(parseProgressBackup(store.backup('5.5.0')));
});
