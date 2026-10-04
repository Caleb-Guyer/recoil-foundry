import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { planFactory } from '../src/factory.ts';
import type { UprisingRouteId } from '../src/uprising-model.ts';
import { loadCheckpoint, seeded, type Checkpoint } from '../src/rules.ts';
import {
  UPRISING_ROUTES,
  UPRISING_FORKS,
  UPRISING_RECORDS_KEY,
  newUprising,
  loadUprisingRecords,
  recordUprising,
  uprisingChoices,
  uprisingFork,
  uprisingForks,
  uprisingContracts,
  uprisingFinale,
  uprisingPlan,
  validUprisingRun,
  validUprisingRecords,
  type UprisingRun,
} from '../src/uprising-model.ts';
import { uprisingLevel } from '../src/uprising-layout.ts';
import { UPRISING_ROOMS } from '../src/uprising-rooms.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { uprisingTestFromUrl } from '../src/uprising-test.ts';
import { uprisingMap } from '../src/uprising-menu.ts';
import { uprisingCatalog } from '../src/uprising-catalog.ts';
import { encounterArchive, acknowledgeArchiveEntry, loadArchive } from '../src/archive.ts';
import { logbookArticle } from '../src/logbook-menu.ts';
import { ProgressStore, validateProgress } from '../src/progress.ts';
import { snapshotRun, loadRunHistory } from '../src/run-history.ts';
import { dailyForDate } from '../src/daily.ts';
import { getLevel } from '../src/levels.ts';
import { playCampaign } from './campaign-pilot.ts';
import { uprisingInput } from './uprising-pilot.ts';
const { Body, Composite } = Matter;
const base = 'https://caleb-guyer.github.io/recoil-foundry/';
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1000, y: 700 },
};
const tick = (g: Game, n = 1, input: Partial<Input> = {}) => {
  for (let i = 0; i < n; i++) g.tick(1 / 60, { ...idle, ...input });
};
function preset(route: string) {
  const save = uprisingTestFromUrl(new URL('?test=uprising&route=' + route + '&v=1', base))!;
  assert(save);
  assert(loadCheckpoint(save), route);
  const g = new Game();
  g.start(save.seed, save);
  return g;
}
function checkpoint(g: Game) {
  let save: Checkpoint | null = null;
  g.onCheckpoint = (s) => (save = s);
  g.save();
  assert(save);
  const valid = loadCheckpoint(save);
  assert(valid, JSON.stringify(save));
  return valid;
}
function emptyPatrol(g: Game) {
  g.waves.clear();
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.shots = [];
}

test('four campaign forks expose eight jobs initially; contracts snapshot three extra choices', () => {
  const run = newUprising();
  assert(validUprisingRun(run));
  assert.equal(UPRISING_ROUTES.length, 11);
  for (const stage of UPRISING_FORKS) assert.equal(uprisingChoices(run, stage).length, 2);
  let records = loadUprisingRecords(null);
  for (const id of ['rail-heist', 'rail-escape', 'core-sabotage', 'core-defense'] as const)
    records = recordUprising(records, id, true);
  for (const f of ['isolated', 'hunted', 'mutiny'] as const)
    records = recordUprising(records, undefined, false, f);
  assert(uprisingContracts(records).every((c) => c.unlocked));
  assert.equal(uprisingChoices(run, 4).length, 2);
  const next = newUprising(records);
  assert.equal(uprisingChoices(next, 4).length, 3);
  assert.equal(uprisingChoices(next, 8).length, 3);
  assert.equal(uprisingChoices(next, 16).length, 3);
  assert(validUprisingRecords(records));
  assert(!validUprisingRecords({ ...records, clean: ['rail-guard'] }));
  assert(!validUprisingRun({ ...next, choices: ['core-defense'] }));
  assert(
    !validUprisingRun({
      ...next,
      choices: ['rail-heist'],
      outcomes: [{ route: 'rail-heist', result: 'failed', clean: true }],
    }),
  );
  assert(!validUprisingRun({ ...run, choices: ['rail-guard'] }));
  assert(
    !validUprisingRun({
      ...run,
      choices: ['rail-heist'],
      outcomes: [{ route: 'rail-escape', result: 'success' }],
    }),
  );
});

test('new campaigns keep the first zone free of jobs and offer all four districts afterward', () => {
  const run = newUprising();
  assert.equal(run.version, 2);
  assert.deepEqual(UPRISING_FORKS, [4, 8, 12, 16]);
  const g = new Game();
  g.start('second-zone-jobs', undefined, null, null, false, 0, true, [], run);
  for (let stage = 0; stage < 4; stage++) {
    assert.equal(g.stage, stage);
    assert(!g.level.uprising);
    assert.equal(g.uprising.mission, null);
    assert.equal(g.uprising.status, '');
    emptyPatrol(g);
    g.clear = true;
    g.openReward();
    assert.equal(g.mode, 'upgrade');
    assert.equal(g.uprising.choices.length, 0);
    assert.equal(uprisingChoices(run, stage).length, 0);
    assert(!g.uprising.choose('rail-heist'));
    assert(loadCheckpoint(checkpoint(g)));
    g.chooseMod(g.offers[0].id);
  }
  assert.equal(g.stage, 4);
  emptyPatrol(g);
  g.clear = true;
  g.openReward();
  assert.equal(g.uprising.choices[0].district, 'railworks');
  assert(g.uprising.choose('rail-escape'));
  g.chooseMod(g.offers[0].id);
  assert.equal(g.stage, 5);
  assert.equal(g.level.uprising, 'railworks');
  assert(loadCheckpoint(checkpoint(g)));
  const map = uprisingMap(g);
  for (const room of [6, 10, 14, 18]) assert(map.includes('Room ' + room));
  assert(!map.includes('Room 2<'));
  for (const route of UPRISING_ROUTES) assert(route.fork >= 4);
});

test('Continue keeps version-one job schedules, checkpoints and map labels intact', () => {
  const offer = uprisingTestFromUrl(new URL('?test=uprising&route=choose&v=1', base))!;
  offer.stage = 0;
  offer.uprising!.version = 1;
  assert(loadCheckpoint(offer));
  const g = new Game();
  g.start(offer.seed, offer);
  assert.equal(g.uprising.choices[0].district, 'railworks');
  assert.deepEqual(uprisingForks(g.uprising.run!), [0, 4, 12, 16]);
  assert(g.uprising.choose('rail-escape'));
  const committed = checkpoint(g);
  const copy = new Game();
  copy.start(committed.seed, committed);
  copy.chooseMod(copy.offers[0].id);
  assert.equal(copy.stage, 1);
  assert.equal(copy.uprising.mission, 'rail-escape');
  assert(uprisingMap(copy).includes('Room 2<'));
  assert(copy.reservedEncounterStages!.includes(1));
  assert(copy.reservedEncounterStages!.includes(5));
  assert(loadCheckpoint(checkpoint(copy)));
  for (const route of UPRISING_ROUTES) {
    const save = uprisingTestFromUrl(new URL('?test=uprising&route=' + route.id + '&v=1', base))!;
    save.uprising!.version = 1;
    save.stage = uprisingFork(save.uprising!, route.id) + 1;
    assert(loadCheckpoint(save), route.id);
    const continued = new Game();
    continued.start(save.seed, save);
    assert.equal(continued.uprising.mission, route.id);
    assert.equal(continued.level.id, 'uprising-' + route.id);
    assert(loadCheckpoint(checkpoint(continued)));
  }
  assert(!validUprisingRun({ ...newUprising(), version: 3 }));
});

test('strict preview links, saved run chronology and shared plan access', () => {
  for (const route of [
    ...UPRISING_ROUTES.map((r) => r.id),
    'choose',
    'choose-core',
    'choose-reclamation',
    'choose-rooftops',
    'choose-unlocked',
    'isolated',
    'hunted',
    'mutiny',
    'overloaded',
  ])
    assert(
      loadCheckpoint(uprisingTestFromUrl(new URL('?test=uprising&route=' + route + '&v=1', base))),
      route,
    );
  for (const q of [
    '?test=uprising&route=nope&v=1',
    '?test=uprising&route=choose&v=2',
    '?test=uprising&route=choose&v=1&route=rail-heist',
    '?test=uprising&route=choose&v=1&hp=999',
  ])
    assert.equal(uprisingTestFromUrl(new URL(q, base)), null);
  const save = uprisingTestFromUrl(new URL('?test=uprising&route=rail-heist&v=1', base))!;
  assert.equal(loadCheckpoint({ ...save, stage: 0 }), null);
  assert.equal(loadCheckpoint({ ...save, stage: 2 }), null);
  assert.equal(loadCheckpoint({ ...save, stage: 1 }), null);
  assert.equal(
    loadCheckpoint({ ...save, reward: { offers: ['rapid', 'ricochet', 'kick'], rerolled: false } }),
    null,
  );
  assert.equal(loadCheckpoint({ ...save, seed: dailyForDate('2026-10-03')!.seed }), null);
  assert.equal(loadCheckpoint({ ...save, version: 5 }), null);
  assert.deepEqual(uprisingPlan('rail-guard,core-recovery'), ['rail-guard', 'core-recovery']);
  assert.equal(uprisingPlan('core-defense,rail-escape'), null);
  const shared = newUprising(null, uprisingPlan('rail-guard,core-recovery')!);
  assert(validUprisingRun(shared));
  assert.deepEqual(
    uprisingChoices(shared, 4).map((r) => r.id),
    ['rail-guard'],
  );
});

test('choosing a route precedes the fitting; Continue restores either side of the decision', () => {
  const g = preset('choose');
  const offer = g.offers[0].id;
  g.chooseMod(offer);
  assert.equal(g.stage, 4);
  assert.equal(g.mods.length, 0);
  assert(!g.uprising.choose('rail-guard'));
  assert(g.uprising.choose('rail-heist'));
  assert(!g.uprising.choose('rail-escape'));
  const saved = checkpoint(g);
  assert.equal(saved.uprising?.choices[0], 'rail-heist');
  const continued = new Game();
  continued.start(saved.seed, saved);
  assert.equal(continued.uprising.choices.length, 0);
  continued.chooseMod(offer);
  assert.equal(continued.stage, 5);
  assert.equal(continued.uprising.kind, 'steal');
  assert.equal(continued.level.uprising, 'railworks');
  assert.equal(continued.uprising.anchors.length, 3);
  assert(uprisingMap(continued).includes('Prototype train'));
  assert(loadCheckpoint(checkpoint(continued)));
});

test('sabotage requires player damage, resolves once, and keeps lowered Core platforms on Continue', () => {
  const g = preset('core-sabotage');
  emptyPatrol(g);
  const positions = g.uprising.anchors.map((a) => a.body.position.y);
  const nodes = [...g.uprising.nodes];
  for (const p of nodes) g.props.hit(p, 999, { x: 1, y: 0 });
  assert(nodes.every((p) => p.hp === 100));
  tick(g);
  assert(g.uprising.waiting);
  g.hp = 70;
  let completed = 0;
  g.onUprisingMission = () => completed++;
  for (const p of nodes) g.props.hit(p, 999, { x: 1, y: 0 }, undefined, true);
  tick(g);
  assert.equal(g.uprising.outcome?.result, 'success');
  assert.equal(g.hp, 78);
  assert.equal(completed, 1);
  tick(g, 75);
  assert(
    g.uprising.anchors.every((a, i) => Math.abs(a.body.position.y - positions[i] - 70) < 0.01),
  );
  const save = checkpoint(g),
    copy = new Game();
  copy.start(save.seed, save);
  tick(copy, 75);
  assert.equal(copy.uprising.nodes.length, 0);
  assert.equal(copy.hp, save.hp);
  assert(
    copy.uprising.anchors.every((a, i) => Math.abs(a.body.position.y - positions[i] - 70) < 0.01),
  );
});

test('stolen prototypes need pickup; normal damage records a non-clean mission without losing its benefit', () => {
  const g = preset('rail-heist');
  emptyPatrol(g);
  const p = g.uprising.nodes[0];
  g.props.hit(p, 999, { x: 1, y: 0 }, undefined, true);
  tick(g);
  assert(g.uprising.waiting);
  assert(g.props.items.includes(p));
  g.damagePlayer(12);
  g.hp = 70;
  Body.setPosition(g.player, { x: p.body.position.x - 60, y: p.body.position.y });
  tick(g, 8);
  assert.equal(g.uprising.outcome?.result, 'success');
  assert.equal(g.uprising.outcome?.clean, undefined);
  assert.equal(g.hp, 78);
  assert(!g.props.items.includes(p));
  const copy = new Game(),
    save = checkpoint(g);
  copy.start(save.seed, save);
  assert.equal(copy.uprising.nodes.length, 0);
  assert.equal(copy.hp, save.hp);
});

test('evacuation bypasses patrol kills, while a late arrival loses only the objective', () => {
  const success = preset('rail-escape');
  const kills = success.kills;
  for (const p of success.uprising.room!.switches!) {
    Body.setPosition(success.player, p);
    Body.setVelocity(success.player, { x: 0, y: 0 });
    tick(success, 1, { jump: true });
  }
  const zone = success.uprising.evacuation!;
  Body.setPosition(success.player, { x: zone.x + zone.w / 2, y: zone.y + zone.h - 18 });
  Body.setVelocity(success.player, { x: 0, y: 0 });
  tick(success, 3);
  assert.equal(success.uprising.outcome?.result, 'success');
  assert(success.enemies.length > 0);
  assert(success.clear);
  assert.equal(success.kills, kills);
  const failed = preset('rail-escape');
  emptyPatrol(failed);
  failed.time = failed.uprising.deadline + 1;
  tick(failed);
  assert.equal(failed.uprising.outcome?.result, 'failed');
  assert(!failed.uprising.escapeReady);
  assert(failed.clear);
  failed.openReward();
  failed.chooseMod(failed.offers[0].id);
  assert.equal(failed.stage, 6);
  assert(loadCheckpoint(checkpoint(failed)));
});

test('each job has distinct supported geometry, clear objectives and an unobstructed exit lane', () => {
  const layouts = new Set<string>();
  for (const route of UPRISING_ROUTES) {
    const g = preset(route.id),
      room = UPRISING_ROOMS[route.id];
    layouts.add(JSON.stringify(room.solids));
    for (const p of [...g.props.items])
      assert.equal(Matter.Query.collides(p.body, g.terrain).length, 0, route.id + ' prop overlap');
    for (const spawn of g.level.spawns) {
      const { w, h } = ENEMY_STATS[spawn.kind],
        body = Matter.Bodies.rectangle(spawn.x, spawn.y, w, h);
      assert.equal(Matter.Query.collides(body, g.terrain).length, 0, route.id + ' spawn overlap');
    }
    for (const p of [...room.objectives, ...(room.switches ?? [])])
      assert(
        room.solids.some(
          (s) => p.x > s.x + 22 && p.x < s.x + s.w - 22 && Math.abs(p.y + 22 - s.y) < 2,
        ) ||
          (route.mission === 'defend' && Math.abs(p.y + 28 - 740) < 2),
        route.id + ' unsupported objective',
      );
    assert(
      room.solids.every((s) => s.x + s.w <= 1780),
      route.id + ' exit obstruction',
    );
    if (room.evacuation) {
      const zone = room.evacuation;
      assert(zone.x + zone.w < 1860);
      assert(
        room.solids.some(
          (s) => s.x <= zone.x && s.x + s.w >= zone.x + zone.w && s.y === zone.y + zone.h,
        ),
      );
    }
    for (const site of room.defenseEntries ?? []) {
      const body = Matter.Bodies.rectangle(
        site.x,
        site.y,
        ENEMY_STATS.flyer.w,
        ENEMY_STATS.flyer.h,
      );
      assert.equal(Matter.Query.collides(body, g.terrain).length, 0, route.id + ' defense entry');
    }
  }
  assert.equal(layouts.size, 11);
});

test('evacuation cannot be rushed along the floor, triggered through a platform, or boarded out of order', () => {
  for (const id of ['rail-escape', 'roof-escape']) {
    const g = preset(id),
      u = g.uprising,
      switches = u.room!.switches!,
      zone = u.evacuation!;
    Body.setPosition(g.player, switches[1]);
    tick(g, 1, { jump: true });
    assert.equal(u.routeStep, 0);
    Body.setPosition(g.player, { x: switches[0].x, y: switches[0].y + 52 });
    tick(g, 1, { jump: true });
    assert.equal(u.routeStep, 0, 'cannot interact through the supporting platform');
    Body.setPosition(g.player, { x: zone.x + zone.w / 2, y: 720 });
    tick(g, 3);
    assert.equal(u.outcome, undefined);
    Body.setPosition(g.player, { x: 1930, y: 720 });
    tick(g, 3);
    assert.equal(u.outcome, undefined, 'the room exit is not the evacuation pad');
    const rush = preset(id);
    tick(rush, 300, { right: true });
    assert.equal(
      rush.uprising.outcome,
      undefined,
      'five seconds of running cannot complete the job',
    );
  }
});

test('moving machinery keeps its entire sweep clear and leaves standing clearance after sabotage', () => {
  for (const route of UPRISING_ROUTES) {
    const g = preset(route.id);
    for (const a of g.uprising.anchors) {
      const rail = g.level.uprising === 'railworks';
      const start = rail ? -85 : -25,
        end = rail ? 85 : route.id === 'core-sabotage' ? 70 : 25;
      for (let offset = start; offset <= end; offset += 5) {
        Body.setPosition(a.body, { x: a.x + (rail ? offset : 0), y: a.y + (rail ? 0 : offset) });
        assert.equal(
          Matter.Query.collides(
            a.body,
            g.terrain.filter((b) => b !== a.body),
          ).length,
          0,
          route.id + ' machinery sweep',
        );
        assert(740 - a.body.bounds.max.y >= 44, route.id + ' floor clearance');
      }
      Body.setPosition(a.body, { x: a.x, y: a.y });
    }
    for (const lower of g.level.solids)
      for (const upper of g.level.solids) {
        const gap = lower.y - upper.y - upper.h;
        const overlap = Math.min(lower.x + lower.w, upper.x + upper.w) - Math.max(lower.x, upper.x);
        assert(!(gap > 0 && gap < 44 && overlap > 30), route.id + ' narrow standing corridor');
      }
  }
});

test('evacuation geometry is owned by its job and never leaks into later rooms or extraction', () => {
  const g = preset('rail-escape');
  assert(g.uprising.evacuation);
  g.uprising.abandon();
  g.stage = 6;
  g.loadRoom();
  assert.equal(g.uprising.evacuation, undefined);
  assert.equal(g.uprising.switchTarget, undefined);
  g.stage = 19;
  g.loadRoom();
  g.clear = true;
  g.startEscape();
  assert(g.escape);
  assert.equal(g.uprising.evacuation, undefined);
  assert.equal(g.uprising.room, null);
});

test('authored jobs retain Security squads without replacing their objective geometry', () => {
  for (const route of UPRISING_ROUTES) {
    const save = uprisingTestFromUrl(new URL('?test=uprising&route=' + route.id + '&v=1', base))!;
    save.security = { level: 2, rules: 1 };
    const g = new Game();
    g.start(save.seed, save);
    assert(g.level.security, route.id);
    assert(
      g.level.spawns.some((s) => s.squad?.role === 'lead'),
      route.id,
    );
    assert(
      g.level.spawns.some((s) => s.squad?.role === 'support'),
      route.id,
    );
    assert.deepEqual(g.level.solids, UPRISING_ROOMS[route.id].solids);
    assert.equal(g.level.spawns.length, UPRISING_ROOMS[route.id].spawns.length);
  }
});

test('defense ignores friendly fire, warns bounded waves, respects pause and failure, and never softlocks a clear room', () => {
  const g = preset('core-defense');
  emptyPatrol(g);
  const p = g.uprising.nodes[0];
  g.props.hit(p, 999, { x: 1, y: 0 }, undefined, true);
  assert.equal(p.hp, 280);
  Body.setPosition(g.player, { x: 970, y: 720 });
  tick(g, 1, { jump: true });
  assert.notEqual(g.uprising.armedAt, null);
  const at = g.uprising.armedAt!;
  g.setMode('paused');
  tick(g, 300);
  assert.equal(g.time, at);
  assert.equal(g.uprising.defenseWave, 0);
  g.setMode('playing');
  g.time = at + 3.1;
  tick(g);
  assert.equal(g.uprising.defenseWave, 1);
  assert.equal(g.enemies.length, 2);
  assert(g.enemies.every((e) => e.spawn > 0));
  assert.deepEqual(g.uprising.target(g.enemies[0]), p.body.position);
  g.props.hit(p, 999, { x: 1, y: 0 });
  tick(g);
  assert.equal(g.uprising.outcome?.result, 'failed');
  emptyPatrol(g);
  tick(g);
  assert(g.clear);
  assert(!g.uprising.waiting);
  const defended = preset('core-defense');
  emptyPatrol(defended);
  Body.setPosition(defended.player, { x: 970, y: 720 });
  tick(defended, 1, { jump: true });
  defended.time = defended.uprising.armedAt! + 18.1;
  tick(defended);
  assert.equal(defended.uprising.outcome?.result, 'success');
});

test('railcars carry standing players and pause freezes machinery', () => {
  const g = preset('rail-heist');
  emptyPatrol(g);
  const a = g.uprising.anchors[0];
  Body.setPosition(g.player, { x: a.body.position.x, y: a.body.bounds.min.y - 18 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  const x = g.player.position.x;
  tick(g, 90);
  assert(g.player.position.x > x + 30);
  assert(Math.abs(g.player.bounds.max.y - a.body.bounds.min.y) < 6);
  const pos = { ...a.body.position };
  g.setMode('paused');
  tick(g, 60);
  assert.deepEqual(a.body.position, pos);
});

test('consequences alter later physical encounters and all four finales have distinct defense behavior', () => {
  const sabotage = preset('isolated').uprising.run!,
    hunted = preset('hunted').uprising.run!,
    mutiny = preset('mutiny').uprising.run!,
    overload = preset('overloaded').uprising.run!;
  for (const [run, expected] of [
    [sabotage, 'isolated'],
    [hunted, 'hunted'],
    [mutiny, 'mutiny'],
    [overload, 'overloaded'],
  ] as const)
    assert.equal(uprisingFinale(run), expected);
  const base = getLevel('consequences', 6),
    original = structuredClone(base);
  const sabotaged = uprisingLevel(base, sabotage, 6);
  assert.equal(sabotaged.hazards?.length, 0);
  assert.equal(sabotaged.vents?.length, 0);
  assert.deepEqual(base, original);
  const chased = uprisingLevel(base, hunted, 6);
  assert(chased.spawns.length >= base.spawns.length + 1);
  assert(chased.name.includes('cargo pursuit'));
  const crew = preset('mutiny');
  assert.equal(crew.props.items.filter((p) => p.kind === 'cover' && p.maxHp === 150).length, 2);
  assert.equal(preset('hunted').enemies[0].kind, 'interceptor');
  const isolated = preset('isolated'),
    boss = isolated.enemies[0];
  boss.phase = 2;
  boss.hp = boss.maxHp * 0.2;
  boss.attacks = 1;
  boss.timer = 0;
  Body.setPosition(boss.body, { x: 1000, y: 300 });
  Body.setPosition(isolated.player, { x: 700, y: 300 });
  isolated.updateBoss(boss);
  assert.equal(boss.attack, 'fan');
  const crewBoss = crew.enemies[0];
  crewBoss.state = 'windup';
  crewBoss.timer = 0;
  crewBoss.attack = 'aimed';
  crew.updateBoss(crewBoss);
  assert.equal(crewBoss.state, 'recover');
});

test('old saves, Daily, Practice and Workshop retain their original campaign rules', () => {
  const old = new Game();
  old.start('legacy-uprising');
  assert.equal(old.uprising.run, null);
  const saved = checkpoint(old);
  const continued = new Game();
  continued.start(saved.seed, saved, null, null, false, 0, true, [], newUprising());
  assert.equal(continued.uprising.run, null);
  const daily = new Game();
  daily.start(
    dailyForDate('2026-10-03')!.seed,
    undefined,
    null,
    null,
    false,
    0,
    true,
    [],
    newUprising(),
  );
  assert.equal(daily.uprising.run, null);
  const workshop = new Game();
  workshop.startWorkshop([]);
  assert.equal(workshop.uprising.run, null);
  const practice = new Game();
  practice.startPractice({ kind: 'boss', seed: 'practice-uprising' });
  assert.equal(practice.uprising.run, null);
});

test('profile backup migration, contract badges and recent run snapshots keep campaign records independent', async () => {
  const disk = new Map<string, string>(),
    store = new ProgressStore(() => ({
      getItem: (k) => disk.get(k) ?? null,
      setItem: (k, v) => {
        disk.set(k, v);
      },
      removeItem: (k) => {
        disk.delete(k);
      },
    }));
  const initial = store.snapshot();
  delete (initial as Record<string, unknown>)[UPRISING_RECORDS_KEY];
  assert.deepEqual(validateProgress(initial)?.[UPRISING_RECORDS_KEY], loadUprisingRecords(null));
  const records = recordUprising(recordUprising(null, 'rail-heist', true), 'rail-escape');
  await store.write(UPRISING_RECORDS_KEY, records);
  assert.deepEqual(store.read(UPRISING_RECORDS_KEY), records);
  assert(validateProgress(store.snapshot()));
  const archive = encounterArchive(null, ['region:railworks', 'uprising:rail-license:unlocked']);
  const entries = uprisingCatalog(archive, records),
    contract = entries.find((e) => e.id === 'uprising:rail-license')!;
  assert(contract.unread);
  assert.equal(contract.state, 'known');
  const read = acknowledgeArchiveEntry(archive, contract);
  assert(loadArchive(read).read.includes(contract.notification!));
  assert(!loadArchive(read).read.includes('region:railworks'));
  const pending = entries.find((e) => e.id === 'uprising:core-license')!;
  assert(logbookArticle(pending).includes('Campaign jobs count'));
  const g = preset('rail-heist');
  g.setMode('dead');
  const recap = snapshotRun(g, 'uprising-recap')!;
  assert(recap.uprising);
  assert.deepEqual(loadRunHistory([recap])[0].uprising, recap.uprising);
  const before = structuredClone(recap.uprising);
  g.uprising.run!.choices[0] = 'rail-escape';
  assert.deepEqual(recap.uprising, before);
});

for (const route of UPRISING_ROUTES)
  test('ordinary controls complete and exit ' + route.name, (t) => {
    const g = preset(route.id);
    playCampaign(g, {
      pathMods: ['magnum', 'light', 'airshot', 'swift'],
      seconds: 120,
      beforeInput: uprisingInput,
      stop: () => g.mode === 'upgrade',
    });
    assert.equal(
      g.uprising.outcome?.result,
      'success',
      JSON.stringify({
        route: route.id,
        hp: g.hp,
        mode: g.mode,
        time: g.time,
        p: g.player.position,
        nodes: g.uprising.nodes.map((p) => ({ hp: p.hp, pos: p.body.position })),
        enemies: g.enemies.map((e) => ({ kind: e.kind, hp: e.hp, pos: e.body.position })),
      }),
    );
    assert(g.hp > 0);
    assert.equal(g.mode, 'upgrade');
    assert(loadCheckpoint(checkpoint(g)));
    t.diagnostic(
      JSON.stringify({ job: route.id, seconds: Math.round(g.time * 10) / 10, hp: g.hp }),
    );
  });

test('the train evacuation is reachable with a starting gun and requires a real route traversal', (t) => {
  const save = uprisingTestFromUrl(new URL('?test=uprising&route=rail-escape&v=1', base))!;
  save.mods = [];
  const g = new Game();
  g.start(save.seed, save);
  playCampaign(g, {
    pathMods: [],
    seconds: 60,
    beforeInput: uprisingInput,
    stop: () => g.mode === 'upgrade',
  });
  assert.equal(
    g.uprising.outcome?.result,
    'success',
    JSON.stringify({ hp: g.hp, time: g.time, step: g.uprising.routeStep, p: g.player.position }),
  );
  assert.equal(g.mode, 'upgrade');
  assert(g.time > 5 && g.time < 40);
  t.diagnostic(
    JSON.stringify({ job: 'rail-escape', build: 'starting gun', seconds: g.time, hp: g.hp }),
  );
});

test('skipping a recovery or sabotage job at a cleared exit records failure and preserves Continue', () => {
  for (const id of ['rail-heist', 'core-sabotage', 'core-defense']) {
    const g = preset(id);
    emptyPatrol(g);
    Body.setPosition(g.player, { x: 1870, y: 720 });
    tick(g);
    assert.equal(g.uprising.outcome?.result, 'failed');
    assert(g.clear);
    assert(loadCheckpoint(checkpoint(g)));
    g.openReward();
    assert(loadCheckpoint(checkpoint(g)));
  }
});

const campaigns: Record<string, UprisingRouteId[]> = {
  isolated: ['rail-escape', 'core-sabotage', 'crew-relief', 'signal-cut'],
  hunted: ['rail-heist', 'core-defense', 'scrap-raid', 'roof-escape'],
  mutiny: ['rail-escape', 'core-defense', 'crew-relief', 'roof-escape'],
  overloaded: ['rail-escape', 'core-defense', 'crew-relief', 'roof-escape'],
};
test('new Factory plans retain their condition outside mission slots and reserve jobs from competing encounters', () => {
  for (let i = 0; i < 120; i++) {
    const seed = 'uprising-plans-' + i,
      g = new Game();
    g.start(seed, undefined, null, null, false, 0, true, [], newUprising());
    assert.equal(g.factory?.version, 4);
    assert.equal(g.factory?.condition, planFactory(seed).condition);
    assert.deepEqual(
      g.factory?.encounters.slice(0, 2).map((e) => e.stage),
      [1, 4],
    );
    const reserved = g.reservedEncounterStages!;
    assert.deepEqual(uprisingForks(g.uprising.run!), [4, 8, 12, 16]);
    assert(reserved.includes(9));
    if (g.floodgate.stage !== null) assert(!reserved.includes(g.floodgate.stage));
    for (const stage of [
      g.courier.state?.stage,
      g.auditor.state?.caseStage,
      g.story.state?.stage,
      ...(g.auditor.state?.rooms ?? []),
    ])
      if (stage !== undefined) assert(!reserved.includes(stage));
    assert(loadCheckpoint(checkpoint(g)));
  }
});
for (const condition of ['freight', 'power'] as const)
  test('complete Uprising campaign with ' + condition + ' shifts', (t) => {
    const oldRandom = Math.random;
    Math.random = seeded('uprising-campaign-' + condition);
    t.after(() => {
      Math.random = oldRandom;
    });
    const common = Matter.Common as typeof Matter.Common & { _nextId: number; _seed: number };
    common._nextId = common._seed = 0;
    // Isolate Power signatures from the optional late contrasting encounter;
    // the finale campaigns separately exercise a Faction conflict shift.
    const seed = Array.from({ length: 100 }, (_, i) => 'factory-test-' + i).find(
      (seed) =>
        planFactory(seed).condition === condition &&
        (condition !== 'power' || planFactory(seed).encounters.length === 2),
    )!;
    const g = new Game();
    g.start(seed, undefined, null, null, false, 0, true, [], newUprising(null, campaigns.isolated));
    const priorities = [
      'leech',
      'countershot',
      'magnum',
      'rapid',
      'scatter',
      'airshot',
      'pierce',
      'ricochet',
      'light',
      'burst',
      'backblast',
      'spoof',
      'standing-orders',
      'priority-target',
      'deadeye',
      'execute',
      'fracture',
      'banker',
      'capacitor',
      'reserve-cell',
      'rail-spike',
    ];
    const seen = new Set<number>();
    playCampaign(g, {
      pathMods: [],
      seconds: 1000,
      chooseUpgrade: () =>
        priorities.find((id) => g.offers.some((m) => m.id === id)) ?? g.offers[0].id,
      beforeInput: (g) => {
        if (g.factory?.encounters.some((e) => e.stage === g.stage)) seen.add(g.stage);
        return uprisingInput(g);
      },
    });
    assert.equal(
      g.mode,
      'won',
      JSON.stringify({
        condition,
        seed,
        stage: g.stage,
        hp: g.hp,
        time: g.time,
        cause: g.deathCause,
      }),
    );
    assert(seen.has(1) && seen.has(4));
    assert.equal(g.uprising.run?.outcomes.length, 4);
  });
for (const [finale, plan] of Object.entries(campaigns))
  test('complete twenty-room campaign · ' + finale, (t) => {
    const g = new Game();
    g.start('NRW1FY', undefined, null, null, false, 0, true, [], newUprising(null, plan));
    let snapshots = 0;
    g.onCheckpoint = (s) => {
      if (s) {
        snapshots++;
        assert(loadCheckpoint(s), JSON.stringify(s));
      }
    };
    const priorities = [
      'leech',
      'countershot',
      'magnum',
      'rapid',
      'scatter',
      'airshot',
      'pierce',
      'ricochet',
      'light',
      'burst',
      'backblast',
      'spoof',
      'standing-orders',
      'priority-target',
      'deadeye',
      'execute',
      'fracture',
      'banker',
      'capacitor',
      'reserve-cell',
      'rail-spike',
    ];
    const result = playCampaign(g, {
      pathMods: [],
      seconds: 1000,
      chooseUpgrade: () =>
        priorities.find((id) => g.offers.some((m) => m.id === id)) ?? g.offers[0].id,
      beforeInput: (game) => {
        if (finale === 'overloaded' && game.stage === 13 && game.uprising.waiting)
          game.uprising.abandon();
        return uprisingInput(game);
      },
    });
    assert.equal(
      g.mode,
      'won',
      JSON.stringify({
        stage: g.stage,
        hp: g.hp,
        time: g.time,
        cause: g.deathCause,
        uprising: g.uprising.run,
      }),
    );
    assert(result.escapeSeen);
    assert.equal(g.uprising.run?.choices.length, 4);
    assert.equal(g.uprising.run?.outcomes.length, 4);
    assert.equal(uprisingFinale(g.uprising.run!), finale);
    assert(snapshots > 20);
    t.diagnostic(
      JSON.stringify({ finale, hp: g.hp, seconds: g.time, outcomes: g.uprising.run?.outcomes }),
    );
  });
