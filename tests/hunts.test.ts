import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import {
  HUNTS,
  HUNT_KINDS,
  huntSeed,
  huntLevel,
  planHunt,
  type HuntKind,
} from '../src/hunt-rules.ts';
import { huntTestFromUrl } from '../src/hunt-test.ts';
import { huntMuzzle } from '../src/hunts.ts';
import { loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import {
  loadEncounters,
  practiceCheckpoint,
  testCheckpoint,
  canPractice,
} from '../src/practice.ts';
import { archiveCheckpoint, prepareArchiveEnemy } from '../src/archive-images.ts';
import {
  snapshotPracticeWin,
  recordPracticeWin,
  challengeFromRecord,
  challengeCode,
  parseChallengeCode,
  challengeAccess,
} from '../src/practice-records.ts';
import { loadRunHistory, snapshotRun } from '../src/run-history.ts';
import { COMMENDATIONS, loadCommendations } from '../src/commendations.ts';
import { commendationRewards, loadRunRewards } from '../src/run-rewards.ts';
import { ProgressStore, validateProgress, CHECKPOINT_KEY } from '../src/progress.ts';
import { ENEMY_GUIDES } from '../src/archive-art.ts';
import { ENEMY_NAMES } from '../src/damage-cause.ts';
import { gauntletEncounter } from '../src/gauntlet-rules.ts';
import { dailyForDate } from '../src/daily.ts';
import { fixture, wall, round, target } from './branches-fixture.ts';
import { playRoom } from './room-pilot.ts';
const { Body, Query } = Matter;
const idle = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1460, y: 705 },
};
test('Bulwark floor attacks start clear of the platforms and pressure the center lane', () => {
  const g = new Game();
  g.startTest(preview('bulwark'));
  Body.setPosition(g.player, { x: 1000, y: 722 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  const e = g.enemies[0];
  for (let n = 0; n < 1200 && g.mode === 'playing'; n++) {
    const muzzle = huntMuzzle(e);
    assert.equal(
      Query.region(g.terrain, {
        min: { x: muzzle.x - 5, y: muzzle.y - 5 },
        max: { x: muzzle.x + 5, y: muzzle.y + 5 },
      }).length,
      0,
      'the actual projectile origin must clear the platform hull',
    );
    const dx = 1000 - g.player.position.x - g.player.velocity.x * 5;
    g.tick(1 / 60, { ...idle, left: dx < -8, right: dx > 8 });
  }
  assert(g.hp < 100, 'live, warned volleys must reach a stationary player in the center lane');
});
function preview(kind: HuntKind, gun = 'pistol') {
  return huntTestFromUrl(new URL(`https://test/?test=hunt&hunt=${kind}&gun=${gun}&v=1`))!;
}
function campaign(kind: HuntKind) {
  for (let n = 0; n < 400; n++) {
    const seed = 'HUNT-RUN-' + n,
      plan = planHunt(seed);
    if (!plan || plan.kind !== kind) continue;
    const save: Checkpoint = {
      ...testCheckpoint(seed, plan.stage),
      version: 6,
      encounters: 1,
      huntRules: 1,
      hunt: plan,
    };
    const g = new Game();
    g.start(seed, save);
    if (g.hunts.door) return g;
  }
  throw Error('No eligible hunt seed');
}
function enter(g: Game) {
  g.clear = true;
  g.time = 1;
  g.clearAt = 0;
  g.grounded = true;
  Body.setPosition(g.player, { x: g.hunts.door!.x, y: 722 });
  g.tick(1 / 60, { ...idle, jump: true });
}
function kill(g: Game, credited = true) {
  const e = g.enemies[0];
  e.spawn = 0;
  g.hitEnemy(e, 100000, undefined, false, false, credited, credited ? undefined : 'cleanup');
  g.hitStop = 0;
  g.tick(1 / 60, idle);
}
test('rare hunt RNG yields at most one deterministic machine from zone two onward', () => {
  const seen = new Set<HuntKind>(),
    stages = new Set<number>();
  let offered = 0;
  for (let n = 0; n < 400; n++) {
    const seed = 'HUNT-RNG-' + n,
      p = planHunt(seed);
    assert.deepEqual(p, planHunt(seed));
    if (p) {
      offered++;
      seen.add(p.kind);
      stages.add(p.stage);
      assert(p.stage >= 4);
      assert.equal(p.phase, 'available');
    }
  }
  assert(offered > 140 && offered < 260);
  assert.equal(seen.size, 3);
  assert.deepEqual(
    [...stages].sort((a, b) => a - b),
    [4, 8, 12, 16],
  );
  assert.equal(planHunt(dailyForDate('2026-10-04')!.seed), null);
});
test('fresh enabled Campaigns save the plan; legacy, Daily and isolated modes do not acquire hunts', () => {
  const g = new Game();
  let cp: Checkpoint | null = null;
  g.onCheckpoint = (s) => {
    cp = s;
  };
  g.start(
    'HUNT-RUN-3',
    undefined,
    null,
    null,
    false,
    0,
    false,
    [],
    null,
    'pistol',
    1,
    false,
    false,
    false,
    true,
  );
  assert.equal(cp!.huntRules, 1);
  assert(loadCheckpoint(cp));
  const c = new Game();
  c.start(cp!.seed, cp!);
  assert.deepEqual(c.hunts.state, g.hunts.state);
  const old = { ...cp! };
  delete old.huntRules;
  delete old.hunt;
  c.start(old.seed, old);
  assert.equal(c.hunts.enabled, false);
  c.start(
    dailyForDate('2026-10-04')!.seed,
    undefined,
    null,
    null,
    false,
    0,
    false,
    [],
    null,
    'pistol',
    1,
    true,
    true,
    true,
    true,
  );
  assert.equal(c.hunts.enabled, false);
  c.startWorkshop([]);
  assert.equal(c.hunts.enabled, false);
  c.startPractice({ kind: 'loader', seed: 'LOADER-SHIFT-5' });
  assert.equal(c.hunts.enabled, false);
  g.setMode('dead');
  const recap = snapshotRun(g, 'hunt-recap')!;
  assert.equal(loadRunHistory([recap])[0].huntRules, 1);
  assert.deepEqual(loadRunHistory([{ ...recap, huntRules: 2 }]), []);
});
test('preview URLs reject duplicate, mixed and unknown parameters and checkpoint modes', () => {
  for (const kind of HUNT_KINDS) assert(loadCheckpoint(preview(kind)));
  for (const query of [
    'hunt=unknown',
    'hunt=bulwark&hunt=demolisher',
    'test=hunt',
    'gun=laser',
    'v=2',
    'daily=1',
    'seed=x',
    'workshop=1',
    'boss=loader',
    'unknown=1',
  ])
    assert.equal(huntTestFromUrl(new URL('https://test/?test=hunt&' + query)), null, query);
  const s = preview('bulwark');
  for (const patch of [
    { stage: 4 },
    { seed: 'forged' },
    { huntRules: 1 },
    { detour: true },
    { escape: true },
    { overtime: { baseMods: 8, repairs: 0 } },
    { bossRemix: 'loader-crossdock' },
  ])
    assert.equal(loadCheckpoint({ ...s, ...patch }), null);
  const g = campaign('bulwark');
  let cp: Checkpoint | null = null;
  g.onCheckpoint = (s) => (cp = s);
  g.save();
  for (const patch of [
    { kind: 'demolisher' },
    { stage: 0 },
    { phase: 'finished' },
    { reward: 'reroll' },
    { rerollSpent: true },
    { extra: true },
  ])
    assert.equal(loadCheckpoint({ ...cp!, hunt: { ...cp!.hunt, ...patch } }), null);
  assert.throws(() => gauntletEncounter('bulwark'), /Unknown/);
});
for (const kind of HUNT_KINDS) {
  test(`${kind} entrance requires a cleared patrol and deliberate jump at a safe door`, () => {
    const g = campaign(kind),
      door = { ...g.hunts.door! },
      parent = g.stage;
    assert.equal(
      Query.region(g.terrain, { min: { x: door.x - 40, y: 645 }, max: { x: door.x + 40, y: 737 } })
        .length,
      0,
    );
    g.grounded = true;
    Body.setPosition(g.player, { x: door.x, y: 722 });
    assert(!g.hunts.enter(true));
    g.clear = true;
    g.time = 1;
    g.clearAt = 0;
    assert(!g.hunts.enter(false));
    Body.setPosition(g.player, { x: door.x - 100, y: 722 });
    assert(!g.hunts.enter(true));
    const hp = g.hp,
      mods = [...g.mods];
    enter(g);
    assert.equal(g.level.hunt, kind);
    assert.equal(g.stage, parent);
    assert.equal(g.hp, hp);
    assert.deepEqual(g.mods, mods);
    assert(g.detour);
    assert.deepEqual(g.level, huntLevel(kind));
    assert.equal(g.enemies.length, 1);
    assert.equal(g.hunts.door, null);
  });
  test(`${kind} Continue restores the fight and pending reward once; service rejoins the cleared room`, () => {
    const g = campaign(kind),
      stage = g.stage;
    let cp: Checkpoint | null = null,
      awards = 0,
      wins = 0;
    g.onCheckpoint = (s) => (cp = s);
    g.onCommendation = () => awards++;
    g.hunts.onClear = () => wins++;
    enter(g);
    assert(loadCheckpoint(cp));
    const fight = structuredClone(cp!);
    const c = new Game();
    c.start(fight.seed, fight);
    assert.equal(c.level.hunt, kind);
    assert.equal(c.hunts.state!.phase, 'fight');
    kill(g);
    assert.equal(g.mode, 'upgrade');
    assert.equal(awards, 1);
    assert.equal(wins, 1);
    assert(loadCheckpoint(cp));
    assert.equal(cp!.reward, undefined);
    c.onCommendation = () => awards++;
    c.start(cp!.seed, cp!);
    assert.equal(c.mode, 'upgrade');
    assert(c.clear);
    assert.equal(c.enemies.length, 0);
    assert.equal(awards, 1);
    c.hp = 40;
    assert(c.hunts.choose('repair'));
    assert.equal(c.hp, 70);
    assert.equal(c.stage, stage);
    assert(!c.detour);
    assert(c.clear);
    assert(!c.hunts.choose('repair'));
    assert.equal(c.hp, 70);
    c.onCheckpoint = (s) => (cp = s);
    c.save();
    assert(loadCheckpoint(cp));
    const restored = new Game();
    restored.start(cp!.seed, cp!);
    assert(restored.clear);
    assert.equal(restored.hp, 70);
    assert(!restored.hunts.enter(true));
    assert.equal(restored.hunts.state!.phase, 'finished');
  });
  test(`${kind} uncredited kills, previews and Practice cannot grant Campaign hunt rewards`, () => {
    const g = campaign(kind);
    let awards = 0,
      wins = 0;
    g.onCommendation = () => awards++;
    g.hunts.onClear = () => wins++;
    enter(g);
    kill(g, false);
    assert.equal(awards, 0);
    assert.equal(wins, 0);
    assert.equal(g.hunts.state!.phase, 'skipped');
    assert(!g.detour);
    assert(g.clear);
    const p = new Game();
    p.onCommendation = () => awards++;
    p.hunts.onClear = () => wins++;
    p.startPractice({ kind, seed: huntSeed(kind) });
    kill(p);
    assert.equal(p.mode, 'won');
    assert.equal(awards, 0);
    assert.equal(wins, 0);
  });
  test(`${kind} victory unlocks native pictures, appearance rewards and separate Practice records`, () => {
    const record = { kind, seed: huntSeed(kind) },
      g = new Game();
    assert.deepEqual(loadEncounters([record]), [record]);
    assert(!canPractice(record, []));
    assert(canPractice(record, [record]));
    assert.deepEqual(loadEncounters([{ ...record, seed: 'fake' }]), []);
    assert.equal(practiceCheckpoint(record)!.huntTest, kind);
    g.startTest(archiveCheckpoint('hunt:' + kind));
    assert.equal(g.level.hunt, kind);
    assert.equal(prepareArchiveEnemy(g, 'enemy:' + kind).kind, kind);
    assert(ENEMY_NAMES[kind]);
    assert(ENEMY_GUIDES[kind]);
    const id = HUNTS[kind].commendation;
    assert(COMMENDATIONS.some((c) => c.id === id));
    assert.deepEqual(loadCommendations([id]), [id]);
    const rewards = commendationRewards(id);
    assert.equal(rewards.length, 1);
    assert(loadRunRewards({ version: 1, seed: 'x', ids: rewards }));
    g.startPractice(record);
    kill(g);
    const win = snapshotPracticeWin(g, true)!;
    assert(win);
    const result = recordPracticeWin([], win);
    const challenge = challengeFromRecord(result.record);
    assert.deepEqual(parseChallengeCode(challengeCode(challenge)), challenge);
    assert(challengeAccess(challenge, [record], g.mods).allowed);
    delete g.level.hunt;
    assert.equal(snapshotPracticeWin(g, true), null);
    g.startTest(preview(kind));
    kill(g);
    assert.equal(snapshotPracticeWin(g, true), null);
  });
  for (const gun of ['pistol', 'shotgun', 'nailgun'])
    test(`${gun} clears ${kind} using ordinary inputs with no profile writes`, () => {
      const g = new Game();
      let writes = 0,
        awards = 0;
      g.onCheckpoint = () => writes++;
      g.onCommendation = () => awards++;
      g.startTest(preview(kind, gun));
      const result = playRoom(g, 100);
      assert(result.clear && result.hp > 0, JSON.stringify({ kind, gun, ...result }));
      assert.equal(g.mode, 'won');
      assert.equal(writes, 0);
      assert.equal(awards, 0);
      assert.equal(g.props.items.filter((p) => p.hunt).length, 0);
    });
}
test('skipping the side door keeps the normal room upgrade and never offers another hunt', () => {
  const g = campaign('cableweaver');
  g.clear = true;
  g.openReward();
  assert.equal(g.hunts.state!.phase, 'skipped');
  assert.equal(g.mode, 'upgrade');
  const stage = g.stage;
  g.chooseMod(g.offers[0].id);
  assert.equal(g.stage, stage + 1);
  assert.equal(g.hunts.door, null);
});
test('hunt reroll credit survives Continue, costs no health and is consumed exactly once', () => {
  const g = campaign('bulwark');
  let cp: Checkpoint | null = null;
  g.onCheckpoint = (s) => (cp = s);
  enter(g);
  kill(g);
  assert(g.hunts.choose('reroll'));
  g.openReward();
  assert(g.canReroll);
  g.hp = 5;
  const before = g.offers.map((m) => m.id);
  assert(g.rerollReward());
  assert.equal(g.hp, 5);
  assert(!g.hunts.freeReroll);
  assert(g.hunts.state!.rerollSpent);
  assert(g.offers.every((m) => !before.includes(m.id)));
  assert(!g.rerollReward());
  assert(loadCheckpoint(cp));
  const store = new ProgressStore(() => ({
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  }));
  assert(validateProgress({ ...store.snapshot(), [CHECKPOINT_KEY]: cp }));
  const c = new Game();
  c.start(cp!.seed, cp!);
  assert(!c.hunts.freeReroll);
  assert.equal(c.hp, 5);
  assert.deepEqual(c.offers, g.offers);
});
test('special rooms own their entrances and never receive a hunt door', () => {
  for (const flag of [
    'annex',
    'story',
    'shutdown',
    'courier',
    'floodgate',
    'sortingPit',
    'freight',
    'crossing',
    'uprising',
    'boss',
  ]) {
    const g = campaign('bulwark');
    (g.level as any)[flag] = true;
    g.hunts.reset(false);
    assert.equal(g.hunts.door, null, flag);
    assert.equal(g.hunts.state!.phase, 'skipped');
  }
});
test('Cableweaver anchors warn before live damage; actual bullets cut cables and foreign fire does not', () => {
  const g = fixture([]);
  target(g, 1500, 300);
  g.level.hunt = 'cableweaver';
  const a = g.hunts.ownedProp('anchor', 500, 22),
    b = g.hunts.ownedProp('anchor', 770, 22);
  g.hunts.cables.push({ anchors: [a, b], liveAt: 1.2, endsAt: 3.8 });
  Body.setPosition(g.player, { x: 635, y: 722 });
  g.time = 1;
  g.hunts.update();
  assert.equal(g.hp, 100);
  g.time = 1.3;
  g.hunts.update();
  assert.equal(g.hp, 86);
  g.props.hit(a, 100, { x: 10, y: 0 }, undefined, false, false);
  assert(g.props.items.includes(a));
  g.hunts.cutAlong({ x: 630, y: 600 }, { x: 630, y: 730 }, 3, false);
  assert.equal(g.hunts.cables.length, 1);
  g.hitStop = 0;
  round(g, { pos: { x: 630, y: 660 }, vel: { x: 0, y: 28 } });
  for (let i = 0; i < 5; i++) g.tick(1 / 60, idle);
  assert.equal(g.hunts.cables.length, 0);
  assert(!g.props.items.includes(a));
  assert(!g.props.items.includes(b));
});
test('cable cut tracing respects solid cover and cable expiry clears both anchors', () => {
  const g = fixture([]);
  target(g, 1500, 300);
  g.level.hunt = 'cableweaver';
  const a = g.hunts.ownedProp('anchor', 500, 22),
    b = g.hunts.ownedProp('anchor', 770, 22);
  g.hunts.cables.push({ anchors: [a, b], liveAt: 1.2, endsAt: 3.8 });
  wall(g, 635, 675, 150, 20);
  round(g, { pos: { x: 630, y: 630 }, vel: { x: 0, y: 28 } });
  for (let i = 0; i < 5; i++) g.tick(1 / 60, idle);
  assert.equal(g.hunts.cables.length, 1);
  g.time = 4;
  g.hunts.update();
  assert.equal(g.hunts.cables.length, 0);
  assert.equal(g.props.items.length, 0);
});
test('Bulwark plates have real collision, intercept shots, move under fire and expose its core', () => {
  const g = new Game();
  g.startTest(preview('bulwark'));
  const e = g.enemies[0],
    p = g.hunts.plates[0];
  assert(!p.body.isStatic);
  assert(g.solidBodies.includes(p.body));
  assert(g.lineEnd({ x: 1000, y: 697 }, { x: 1460, y: 697 }).x < 1450);
  const vx = p.body.velocity.x;
  g.props.hit(p, 10, { x: 20, y: 0 }, undefined, true);
  assert(p.body.velocity.x > vx);
  assert.equal(g.hunts.armor(e), 0.7);
  for (const plate of [...g.hunts.plates])
    g.props.hit(plate, 100, { x: 10, y: 0 }, undefined, true);
  assert.equal(g.hunts.armor(e), 1);
  assert.equal(e.state, 'recover');
  assert.equal(e.timer, 1.6);
  g.hunts.makePlates();
  assert.equal(g.hunts.supplies, 2);
  for (const plate of [...g.hunts.plates])
    g.props.hit(plate, 100, { x: 10, y: 0 }, undefined, true);
  g.hunts.makePlates();
  assert.equal(g.hunts.plates.length, 0);
});
test('Demolisher charges disarm without a blast, warn for a full fuse, respect cover and stop on death', () => {
  const g = fixture([]);
  g.level.hunt = 'demolisher';
  let p = g.hunts.ownedProp('mine', 500, 12);
  g.hunts.mines.push({ prop: p, explodesAt: 2.8 });
  Body.setPosition(g.player, { x: 510, y: 722 });
  g.time = 2.7;
  g.hunts.update();
  assert.equal(g.hp, 100);
  g.props.hit(p, 15, { x: 1, y: 0 }, undefined, true);
  assert.equal(g.hunts.mines.length, 0);
  g.time = 3;
  g.hunts.update();
  assert.equal(g.hp, 100);
  p = g.hunts.ownedProp('mine', 500, 12);
  g.hunts.mines.push({ prop: p, explodesAt: 5.8 });
  wall(g, 550, 690, 18, 90);
  Body.setPosition(g.player, { x: 590, y: 722 });
  g.time = 6;
  g.hunts.update();
  assert.equal(g.hp, 100);
  assert.equal(g.hunts.mines.length, 0);
  p = g.hunts.ownedProp('mine', 500, 12);
  g.hunts.mines.push({ prop: p, explodesAt: 8.8 });
  g.hunts.clearGear();
  g.time = 9;
  g.hunts.update();
  assert.equal(g.hp, 100);
  assert.equal(g.props.items.length, 0);
});
test('hunt warnings, fuses and physical shields freeze during pause and supplies stay finite', () => {
  for (const kind of HUNT_KINDS) {
    const g = new Game();
    g.startTest(preview(kind));
    const e = g.enemies[0];
    e.spawn = 0;
    e.state = 'windup';
    e.timer = 0;
    e.target = { x: 900, y: 730 };
    e.attack = 'mortar';
    g.hunts.updateEnemy(e);
    const time = g.time,
      gear = JSON.stringify(g.hunts.mines.map((m) => m.explodesAt));
    g.setMode('paused');
    for (let i = 0; i < 200; i++) g.tick(1 / 60, idle);
    assert.equal(g.time, time);
    assert.equal(JSON.stringify(g.hunts.mines.map((m) => m.explodesAt)), gear);
    g.setMode('playing');
    for (let i = 0; i < 30; i++) {
      g.time += 5;
      g.hunts.update();
      e.state = 'windup';
      e.timer = 0;
      e.attack = 'mortar';
      g.hunts.updateEnemy(e);
    }
    assert(g.hunts.supplies <= (kind === 'cableweaver' ? 5 : kind === 'demolisher' ? 6 : 2));
    assert(g.hunts.cables.length <= 2);
    assert(g.hunts.mines.length <= 2);
    assert(g.hunts.plates.length <= 2);
  }
});
test('depleted supplies warn the actual fallback volley rather than marking a nonexistent hazard', () => {
  for (const kind of ['cableweaver', 'demolisher'] as const) {
    const g = new Game();
    g.startTest(preview(kind));
    const e = g.enemies[0];
    e.spawn = 0;
    e.timer = 0;
    e.attacks = 0;
    g.hunts.supplies = 6;
    g.updateEnemy(e, 1 / 60);
    assert.equal(e.state, 'windup');
    assert.equal(e.attack, 'fan');
    assert.equal(e.timer, 1.15);
    assert.equal(g.shots.length, 0);
    e.timer = 0;
    g.updateEnemy(e, 1 / 60);
    assert.equal(g.shots.length, 3);
  }
});
