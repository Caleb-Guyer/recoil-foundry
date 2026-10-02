import { playCampaign } from './campaign-pilot.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input, type Enemy, type Shot } from '../src/game.ts';
import {
  getGun,
  rewardMods,
  seeded,
  availableMods,
  validBuild,
  loadCheckpoint,
  MODS,
  type Checkpoint,
} from '../src/rules.ts';
import {
  LONGEVITY_IDS,
  unlockGoals,
  MILESTONES_KEY,
  loadMilestones,
  validMilestones,
  draftUnlocked,
} from '../src/longevity.ts';
import { logbookCatalog } from '../src/logbook-catalog.ts';
import { logbookArticle } from '../src/logbook-menu.ts';
import { loadLogbook } from '../src/logbook.ts';
import {
  ARCHIVE_KEY,
  encounterArchive,
  readArchiveEntry,
  acknowledgeArchiveEntry,
} from '../src/archive.ts';
import { modMark } from '../src/upgrade-icons.ts';
import { legalSwaps, reforgeOffers } from '../src/reforge-rules.ts';
import { ProgressStore, validateProgress, parseProgressBackup } from '../src/progress.ts';
import { dailyForDate } from '../src/daily.ts';
import { snapshotRun } from '../src/run-history.ts';
import { ARC_EFFECT_LIMIT } from '../src/arc-coil.ts';
import { withParents, completeBuild } from '../src/branch-builds.ts';
import { playRoom } from './room-pilot.ts';
import { planFactory } from '../src/factory.ts';
const { Body, Bodies, Composite } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 900, y: 400 },
};
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function fixture(mods: string[]) {
  const g = new Game();
  g.start('LONGEVITY');
  g.waves.clear();
  g.hazards.clear();
  g.breaches.clear();
  g.conveyors.clear();
  g.destruction.clear();
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.level.solids = [];
  g.level.route = [];
  g.mods = mods;
  g.gun = getGun(mods);
  Body.setPosition(g.player, { x: 180, y: 400 });
  g.grounded = false;
  return g;
}
function step(g: Game, n = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, { ...idle, ...input });
}
function target(
  g: Game,
  x: number,
  y = 720,
  kind: Enemy['kind'] = 'shooter',
  elite?: Enemy['elite'],
) {
  g.spawnEnemy(kind, x, y, elite);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.timer = 100;
  return e;
}
function round(g: Game, e: Enemy, extra: Partial<Shot> = {}) {
  g.addShot({
    pos: { x: e.body.position.x - 40, y: e.body.position.y },
    vel: { x: 64, y: 0 },
    damage: 10,
    life: 1,
    friendly: true,
    radius: 2,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: true,
    ...extra,
  });
  const s = g.shots.at(-1)!;
  g.updateShots(1 / 60);
  return s;
}
function three(g: Game, e: Enemy) {
  for (let i = 0; i < 3; i++) round(g, e);
}
function wall(g: Game, x: number, y = 600, w = 16, h = 280) {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true });
  Composite.add(g.engine.world, b);
  g.terrain.push(b);
  return b;
}

test('five explicit goals use existing milestones and exclude unrelated boss or zone sightings', () => {
  const empty = loadLogbook(null);
  assert(unlockGoals(empty, [], [], null).every((g) => !g.unlocked));
  const partial = unlockGoals({ ...empty, areas: ['docks', 'furnace'] }, [], ['press'], null);
  assert.equal(partial[1].current, 2);
  assert(!partial[0].unlocked);
  assert(
    unlockGoals({ ...empty, areas: ['docks', 'furnace', 'cooling'] }, ['air-traffic'], ['loader'], {
      version: 1,
      arcBoss: true,
      circuit: true,
    }).every((g) => g.unlocked),
  );
  for (const raw of [
    { version: 2 },
    { version: 1, circuit: 1 },
    { version: 1, arcBoss: false },
    { version: 1, unknown: true },
  ])
    assert(!validMilestones(raw));
});
test('achievement cards have locked question marks, exact progress and a separate unread unlock notice', () => {
  const book = loadLogbook(null),
    locked = unlockGoals(book, [], [], null);
  const card = logbookCatalog([], book, [], null, locked).find((e) => e.id === 'mod:wing-harness')!;
  assert.equal(card.state, 'locked');
  assert.equal(card.name, 'Wing Harness');
  const html = logbookArticle(card, modMark);
  assert.match(html, /Visit three different main zones/);
  assert.match(html, /value="0"/);
  assert.doesNotMatch(html, /Descent allowance|Roof access/);
  const goals = unlockGoals(book, [], ['crane'], null),
    token = 'mod:double-jump:unlocked';
  const archive = encounterArchive(null, [token]);
  const unlocked = logbookCatalog([], book, [], archive, goals).find(
    (e) => e.id === 'mod:double-jump',
  )!;
  assert.equal(unlocked.state, 'unseen');
  assert(unlocked.unread);
  assert.equal(unlocked.notification, token);
  const read = readArchiveEntry(archive, token);
  assert(!logbookCatalog([], book, [], read, goals).find((e) => e.id === unlocked.id)!.unread);
  const seen = logbookCatalog(
    [],
    book,
    [],
    encounterArchive(read, ['mod:double-jump']),
    goals,
  ).find((e) => e.id === unlocked.id)!;
  assert.equal(seen.state, 'known');
  assert(seen.unread);
  assert.match(seen.description, /Press jump again/);
  const pending = encounterArchive(null, [token, 'mod:double-jump', 'mod:wing-harness:unlocked']);
  const opened = acknowledgeArchiveEntry(pending, seen);
  assert(opened.read.includes(token) && opened.read.includes('mod:double-jump'));
  assert(!opened.read.includes('mod:wing-harness:unlocked'));
});
test('all original cards retain access; new cards need unlocks, parents and exclusive forks', () => {
  const base = rewardMods([], 999, seeded('old-pool'), { stage: 8 });
  assert(base.every((m) => draftUnlocked(m.id)));
  assert(base.some((m) => m.id === 'magnum'));
  assert(!base.some((m) => LONGEVITY_IDS.includes(m.id as never)));
  const early = rewardMods(['arc-coil', 'tether'], 999, seeded('new'), {
    stage: 6,
    unlocks: LONGEVITY_IDS,
  });
  assert(early.some((m) => m.id === 'double-jump'));
  assert(early.some((m) => m.id === 'static-reservoir'));
  assert(!early.some((m) => m.id === 'ground-fault' || m.id === 'conductive-tether'));
  const late = rewardMods(['arc-coil', 'tether'], 999, seeded('new'), {
    stage: 7,
    unlocks: LONGEVITY_IDS,
  });
  for (const id of LONGEVITY_IDS)
    assert(
      late.some((m) => m.id === id),
      id,
    );
  assert(!validBuild(['tether', 'conductive-tether']));
  assert(validBuild(['tether', 'arc-coil', 'conductive-tether']));
  for (const pair of [
    ['ground-fault', 'daisy-chain'],
    ['ground-fault', 'short-circuit'],
    ['conductive-tether', 'grapnel'],
    ['conductive-tether', 'snapback'],
  ])
    assert.equal(withParents([], pair), null);
  assert(
    !availableMods(['arc-coil', 'grapnel', 'tether']).some((m) => m.id === 'conductive-tether'),
  );
});
test('Daily rewards and reforges ignore personal unlocks for every supported ruleset', () => {
  for (let rules = 78; rules <= 85; rules++) {
    const seed = `RF-D${rules}-2026-10-02`;
    for (const mods of [[], ['arc-coil', 'tether'], ['deadeye', 'arc-coil']]) {
      assert.deepEqual(
        rewardMods(mods, 3, seeded(seed), { stage: 8, seed }),
        rewardMods(mods, 3, seeded(seed), { stage: 8, seed, unlocks: LONGEVITY_IDS }),
      );
      assert.deepEqual(
        reforgeOffers(mods, seed, 7),
        reforgeOffers(mods, seed, 7, undefined, LONGEVITY_IDS),
      );
    }
  }
  assert(
    !legalSwaps(['magnum', 'arc-coil', 'tether'], 7).some((s) =>
      LONGEVITY_IDS.includes(s.to as never),
    ),
  );
  assert(
    legalSwaps(['magnum', 'arc-coil', 'tether'], 7, undefined, LONGEVITY_IDS).some(
      (s) => s.to === 'conductive-tether',
    ),
  );
});
test('Continue and replay preserve the starting pool; malformed snapshots are rejected', () => {
  const g = new Game();
  let saved: Checkpoint | null = null;
  g.onCheckpoint = (s) => (saved = s);
  g.start('SNAPSHOT', undefined, null, null, false, 0, true, LONGEVITY_IDS);
  g.openReward();
  assert(saved);
  assert.deepEqual(loadCheckpoint(saved)?.unlocks, LONGEVITY_IDS);
  const copy = new Game();
  copy.start(g.seed, loadCheckpoint(saved)!);
  assert.deepEqual(copy.unlocks, g.unlocks);
  assert.deepEqual(copy.offers, g.offers);
  g.setMode('dead');
  const recap = snapshotRun(g, 'snapshot', 1)!;
  assert.deepEqual(recap.unlocks, LONGEVITY_IDS);
  const old = { ...saved!, unlocks: undefined };
  const resume = new Game();
  resume.start(g.seed, old);
  assert.deepEqual(resume.unlocks, []);
  for (const unlocks of [['unknown'], ['double-jump', 'double-jump'], null])
    assert.equal(loadCheckpoint({ ...saved!, unlocks }), null);
  const daily = new Game();
  daily.start(
    dailyForDate('2026-10-02')!.seed,
    undefined,
    null,
    null,
    false,
    0,
    true,
    LONGEVITY_IDS,
  );
  assert.deepEqual(daily.unlocks, []);
});
test('milestones, unread unlocks and acknowledgements survive backup, restore and undo', async () => {
  const map = new Map<string, string>(),
    disk = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
    };
  const store = new ProgressStore(() => disk);
  await store.write(MILESTONES_KEY, { version: 1, circuit: true });
  await store.write(
    ARCHIVE_KEY,
    encounterArchive(store.read(ARCHIVE_KEY), ['mod:conductive-tether:unlocked']),
  );
  const backup = parseProgressBackup(store.backup('3.20.0'));
  const reload = new ProgressStore(() => disk);
  assert(loadMilestones(reload.read(MILESTONES_KEY)).circuit);
  await reload.write(MILESTONES_KEY, { version: 1, arcBoss: true });
  assert(await reload.restore(backup));
  assert(loadMilestones(reload.read(MILESTONES_KEY)).circuit);
  assert(await reload.undo());
  assert(loadMilestones(reload.read(MILESTONES_KEY)).arcBoss);
  const bad = structuredClone(store.snapshot());
  bad[MILESTONES_KEY] = { version: 2 };
  assert.equal(validateProgress(bad), null);
});
test('Double Jump consumes one fresh press, keeps horizontal recoil and only ground contact recharges it', () => {
  const g = fixture(['double-jump']);
  g.engine.gravity.y = 0;
  g.time = 1;
  g.jumpAt = -1;
  Body.setVelocity(g.player, { x: 13, y: 5 });
  step(g, 1, { jump: true, jumpHeld: true });
  assert(!g.mobility.airJumpReady);
  assert(g.player.velocity.y < -9);
  assert(g.player.velocity.x > 12);
  Body.setVelocity(g.player, { x: 0, y: 5 });
  step(g, 1, { jump: true, jumpHeld: true });
  assert(g.player.velocity.y > 0);
  Body.setPosition(g.player, { x: 1100, y: 400 });
  step(g);
  assert(!g.mobility.airJumpReady);
  g.setMode('paused');
  g.setMode('playing');
  assert(!g.mobility.airJumpReady);
  Body.setPosition(g.player, { x: 1100, y: 722 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  step(g);
  assert(g.mobility.airJumpReady);
});
test('Wing Harness preserves upward recoil and has a finite airborne glide budget', () => {
  const g = fixture(['wing-harness']);
  g.engine.gravity.y = 0;
  Body.setVelocity(g.player, { x: 9, y: -12 });
  step(g, 1, { jumpHeld: true });
  assert(g.player.velocity.y < -10);
  near(g.mobility.glideLeft, 1.2);
  Body.setVelocity(g.player, { x: 9, y: 10 });
  step(g, 1, { jumpHeld: true });
  assert(g.mobility.gliding);
  assert(g.player.velocity.y < 4);
  assert(g.player.velocity.x > 8);
  const left = g.mobility.glideLeft;
  g.setMode('paused');
  step(g, 10, { jumpHeld: true });
  near(g.mobility.glideLeft, left);
  g.setMode('playing');
  for (let i = 0; i < 100; i++) {
    Body.setPosition(g.player, { x: 400, y: 400 });
    Body.setVelocity(g.player, { x: 0, y: 8 });
    step(g, 1, { jumpHeld: true });
  }
  assert.equal(g.mobility.glideLeft, 0);
  assert(g.player.velocity.y > 7);
  assert(!g.mobility.gliding);
  Body.setPosition(g.player, { x: 400, y: 722 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  step(g);
  near(g.mobility.glideLeft, 1.2);
});
test('Ground Fault reaches at most three grounded enemies and leaves airborne or covered targets untouched', () => {
  const g = fixture(['arc-coil', 'ground-fault']);
  g.engine.gravity.y = 0;
  const a = target(g, 600),
    targets = [target(g, 650), target(g, 700), target(g, 750), target(g, 785)],
    air = target(g, 630, 540, 'flyer');
  const hp = targets.map((e) => e.hp);
  three(g, a);
  for (let i = 0; i < 3; i++) near(hp[i] - targets[i].hp, 9);
  near(targets[3].hp, hp[3]);
  near(air.hp, air.maxHp);
  assert.equal(g.arcs.effects.length, 3);
  assert.equal(g.arcs.charges.size, 0);
  const blocked = fixture(['arc-coil', 'ground-fault']);
  const origin = target(blocked, 500),
    peer = target(blocked, 650);
  wall(blocked, 570);
  three(blocked, origin);
  near(peer.hp, peer.maxHp);
});
test('Static Reservoir stores one cell per three recoil shots and spends it once without charging secondary hits', () => {
  const g = fixture(['arc-coil', 'static-reservoir']);
  g.engine.gravity.y = 0;
  const a = target(g, 600, 400),
    b = target(g, 690, 400),
    c = target(g, 750, 400);
  for (let i = 0; i < 12; i++) g.mobility.shot({ x: 0, y: 1 });
  assert(g.arcs.reservoirReady);
  assert.equal(g.arcs.reservoirShots, 0);
  three(g, a);
  near(b.maxHp - b.hp, 12);
  near(c.maxHp - c.hp, 6);
  assert(!g.arcs.reservoirReady);
  assert.equal(g.arcs.charges.size, 0);
  three(g, a);
  near(c.maxHp - c.hp, 6);
  g.mobility.shot({ x: 0, y: 1 });
  g.mobility.shot({ x: 0, y: 1 });
  assert.equal(g.arcs.reservoirShots, 2);
  g.grounded = true;
  g.arcs.update();
  assert.equal(g.arcs.reservoirShots, 0);
});
test('Conductive Tether sends one bounded transfer down a live cable; expiry, walls, shields and allies resist it', () => {
  for (const variant of ['live', 'expired', 'wall', 'shield', 'allied']) {
    const g = fixture(['arc-coil', 'tether', 'conductive-tether']);
    g.engine.gravity.y = 0;
    const a = target(g, 500, 400),
      b = target(g, 800, 400, 'runner', variant === 'shield' ? 'shielded' : undefined);
    b.facing = -1;
    if (variant === 'allied') b.allied = true;
    g.tethers.link = {
      a,
      b,
      length: 300,
      until: variant === 'expired' ? g.time : g.time + 4,
      tension: 0,
    };
    if (variant === 'wall') wall(g, 650, 400);
    three(g, a);
    near(b.maxHp - b.hp, variant === 'live' ? 4.2 : variant === 'shield' ? 4.2 * 0.1 : 0);
    assert(g.arcs.charges.size === 0);
    assert(g.arcs.effects.length <= 1);
  }
});
test('only real hostile links and credited Arc Coil boss defeats award progression evidence', () => {
  for (const mode of ['campaign', 'practice', 'workshop', 'test', 'allied', 'cleanup']) {
    const g = fixture(['tether', 'arc-coil']);
    if (mode === 'practice') g.practice = { kind: 'loader', seed: g.seed, mods: g.mods };
    if (mode === 'workshop') g.workshop.active = true;
    if (mode === 'test')
      g.testRun = { version: 6, seed: g.seed, stage: 0, mods: [], hp: 100, kills: 0, elapsed: 0 };
    const awarded: string[] = [];
    g.onMilestone = (id) => awarded.push(id);
    const a = target(g, 500, 400),
      b = target(g, 700, 400, 'runner');
    if (mode === 'allied') b.allied = true;
    round(g, a);
    round(g, b);
    const boss = target(g, 1000, 400, 'loader');
    g.hitEnemy(
      boss,
      9999,
      undefined,
      false,
      false,
      mode !== 'allied',
      mode === 'cleanup' ? 'cleanup' : undefined,
    );
    if (mode === 'campaign') assert.deepEqual(awarded, ['circuit', 'arcBoss']);
    else if (mode === 'cleanup') assert.deepEqual(awarded, ['circuit']);
    else assert.deepEqual(awarded, []);
  }
});
test('new electrical and mobility combinations keep finite physics and bounded effects in actual Workshop combat', () => {
  for (const goals of [
    ['ground-fault', 'conductive-tether'],
    ['short-circuit', 'conductive-tether'],
    ['daisy-chain', 'conductive-tether'],
    ['ground-fault', 'grapnel'],
    ['ground-fault', 'snapback'],
  ]) {
    const mods = completeBuild(withParents([], ['shellshock', ...goals])!)!;
    const g = new Game();
    g.startWorkshop(mods, mods);
    for (let frame = 0; frame < 300; frame++) {
      const enemy = g.enemies.find((e) => e.spawn <= 0);
      g.tick(1 / 60, {
        ...idle,
        right: frame < 60,
        left: frame > 240,
        jump: frame === 30 || frame === 45,
        jumpHeld: frame < 180,
        fire: frame % 90 < 75,
        aim: enemy ? { ...enemy.body.position } : { x: 1100, y: 550 },
      });
      assert(
        [g.player.position.x, g.player.position.y, g.player.velocity.x, g.player.velocity.y].every(
          Number.isFinite,
        ),
      );
      assert(g.arcs.effects.length <= ARC_EFFECT_LIMIT);
      assert(g.shots.length <= 180);
    }
    assert(g.shotCount > 0);
    g.setMode('dead');
    assert.equal(g.arcs.effects.length, 0);
    assert(!g.arcs.reservoirReady);
    assert.equal(g.tethers.link, null);
  }
});

test('earned mobility and electric fittings can clear ordinary rooms with live damage, AI and recoil physics', (t) => {
  const cases = [
    {
      seed: 'LONGEVITY-ROOM-0',
      stage: 6,
      mods: ['double-jump', 'wing-harness', 'light', 'kick', 'magnum', 'leech'],
    },
    {
      seed: 'LONGEVITY-ROOM-1',
      stage: 10,
      mods: [
        'arc-coil',
        'tether',
        'conductive-tether',
        'ground-fault',
        'static-reservoir',
        'double-jump',
        'wing-harness',
        'magnum',
        'leech',
        'rapid',
      ],
    },
    {
      seed: 'LONGEVITY-ROOM-2',
      stage: 11,
      mods: [
        'arc-coil',
        'tether',
        'conductive-tether',
        'ground-fault',
        'static-reservoir',
        'double-jump',
        'wing-harness',
        'magnum',
        'leech',
        'rapid',
        'airshot',
      ],
    },
  ];
  for (const c of cases) {
    const save: Checkpoint = {
      version: 6,
      ...c,
      hp: 100,
      kills: 0,
      elapsed: 0,
      unlocks: [...LONGEVITY_IDS],
      factory: planFactory(c.seed),
      ...([6, 10].includes(c.stage) ? { route: 'low' as const } : {}),
    };
    assert(loadCheckpoint(save));
    const g = new Game();
    g.start(save.seed, save);
    if (g.level.boss) playCampaign(g, { pathMods: [], seconds: 200, stop: (g) => g.clear });
    const report = g.level.boss
      ? {
          clear: g.clear,
          hp: g.hp,
          kills: g.kills,
          time: g.time,
          shots: g.shotCount,
          player: { ...g.player.position },
          enemies: g.enemies.map((e) => ({ kind: e.kind, hp: e.hp, pos: { ...e.body.position } })),
        }
      : playRoom(g, 100, () => g.clear);
    t.diagnostic(JSON.stringify({ ...c, ...report, enemyCount: report.enemies.length }));
    assert(report.clear, c.seed);
    assert(report.hp > 0, c.seed);
    assert(report.shots > 0);
  }
});
