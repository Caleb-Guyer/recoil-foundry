import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import {
  AUDITOR_HP,
  COMPANY_CASE,
  auditorEligible,
  auditorTestFromUrl,
  planAuditor,
} from '../src/auditor-layout.ts';
import { AUDITOR_RECALL, AUDITOR_VISIT, AUDITOR_WARNING } from '../src/auditor.ts';
import {
  availableMods,
  distance,
  isRouteStage,
  loadCheckpoint,
  type Checkpoint,
} from '../src/rules.ts';
import { getLevel } from '../src/levels.ts';
import { dailyForDate } from '../src/daily.ts';
import { type CommendationId } from '../src/commendations.ts';

const { Body, Composite, Engine, Bodies, Query } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: COMPANY_CASE,
};
const preset = (query = '') =>
  auditorTestFromUrl(new URL('https://example.test/?test=auditor' + query))!;
function setup(query = '') {
  const g = new Game();
  g.startTest(preset(query));
  return g;
}
function step(g: Game, frames = 1, input = idle) {
  for (let i = 0; i < frames; i++) g.tick(1 / 60, input);
}
function empty(g: Game) {
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.mutations.clear();
  g.hazards.clear();
  g.fabricators.clear();
}
function arrival(g: Game) {
  empty(g);
  g.clear = false;
  g.auditor.update(2);
  assert(g.auditor.door, 'a safe entrance must exist');
  g.auditor.update(AUDITOR_WARNING - 0.01);
  assert(!g.auditor.enemy, 'door must finish warning');
  g.auditor.update(0.02);
  assert(g.auditor.enemy);
  return g.auditor.enemy;
}
function shootCase(g: Game) {
  Body.setPosition(g.player, { x: 170, y: 719 });
  for (let i = 0; i < 180 && g.mode === 'playing'; i++) step(g, 1, { ...idle, fire: true });
}
function campaign(query = '') {
  const g = new Game(),
    p = preset(query);
  if (p.stage === 4) {
    p.stage = 5;
    p.missedUpgrades = 1;
    p.auditor!.caseStage = 5;
    p.auditor!.rooms = [6, 9, 17];
    for (let i = 0; i < 100; i++) {
      p.seed = 'audit-safe-case-' + i;
      if (auditorEligible(getLevel(p.seed, p.stage))) break;
    }
  }
  g.start(p.seed, p);
  return g;
}

test('Auditor plans are deterministic, uncommon, and exclude bosses and reserved events', () => {
  let count = 0;
  for (let i = 0; i < 500; i++) {
    const seed = 'auditor-plan-' + i;
    const options = {
      event: {
        kind: 'turf' as const,
        area: 2,
        relays: [],
        caches: [],
        commander: false,
        rerolls: 0,
      },
      courier: 14,
      floodgate: 17,
      story: 5,
    };
    const s = planAuditor(seed, options);
    assert.deepEqual(s, planAuditor(seed, options));
    if (!s) continue;
    count++;
    assert(s.caseStage <= 8 && s.rooms.length === 3);
    for (const stage of [s.caseStage, ...s.rooms]) {
      assert(stage % 4 !== 3 && stage !== 13 && stage !== 5 && stage !== 14 && stage !== 17);
      assert(Math.floor(stage / 4) !== 2);
    }
  }
  assert(count > 50 && count < 190, String(count));
});

test('fresh campaign plans save, continue unchanged and have usable case and entrance positions', () => {
  let plans = 0;
  for (let i = 0; i < 50; i++) {
    const g = new Game();
    let save: Checkpoint | null = null;
    g.onCheckpoint = (s) => {
      save = s;
    };
    g.start('audit-campaign-' + i);
    if (!g.auditor.state) continue;
    plans++;
    assert(loadCheckpoint(save), JSON.stringify(save));
    const h = new Game();
    h.start(g.seed, save!);
    assert.deepEqual(h.auditor.state, g.auditor.state);
    for (const route of ['low', 'high'] as const) {
      g.stage = g.auditor.state.caseStage;
      g.route = isRouteStage(g.stage) ? route : null;
      g.loadRoom();
      assert(auditorEligible(g.level) && g.auditor.caseProp);
      const body = g.auditor.caseProp.body;
      assert.equal(
        Query.collides(
          body,
          g.solidBodies.filter((b) => b !== body),
        ).length,
        0,
        g.level.id,
      );
      g.auditor.state.status = 'hunting';
      for (const stage of g.auditor.state.rooms) {
        g.stage = stage;
        g.route = isRouteStage(stage) ? route : null;
        g.loadRoom();
        assert(g.auditor.scheduled, g.level.id);
        assert(g.auditor.placement(), g.level.id);
      }
      g.auditor.state.status = 'sealed';
      g.auditor.state.visits = 0;
      delete g.auditor.state.room;
    }
  }
  assert(plans >= 6, String(plans));
});

test('test URLs are strict and every build and phase is a valid checkpoint', () => {
  for (const phase of ['case', 'hunt', 'damaged', 'final'])
    for (const build of ['standard', 'beam', 'portal'])
      assert(loadCheckpoint(preset('&phase=' + phase + '&build=' + build)));
  for (const q of [
    '&phase=no',
    '&phase=hunt&phase=hunt',
    '&seed=x',
    '&daily=2026-09-19',
    '&build=no',
    '&test=auditor',
    '&foo=x',
  ])
    assert.equal(auditorTestFromUrl(new URL('https://example.test/?test=auditor' + q)), null, q);
});

test('sealed cases ignore combat, distant shots, enemy fire and collateral explosions', () => {
  const g = setup(),
    box = g.auditor.caseProp!;
  g.props.hit(box, 9999, { x: 1, y: 0 });
  assert.equal(box.hp, 48);
  g.clear = false;
  g.spawnEnemy('shooter', 1800, 720);
  shootCase(g);
  assert.equal(box.hp, 48);
  empty(g);
  g.clear = true;
  Body.setPosition(g.player, { x: 500, y: 700 });
  g.props.hit(box, 9999, { x: 1, y: 0 }, undefined, true);
  assert.equal(box.hp, 48);
  Body.setPosition(g.player, { x: 170, y: 719 });
  const hostile = g.addShot({
    pos: { x: 130, y: 718 },
    vel: { x: -20, y: 0 },
    damage: 999,
    radius: 3,
    friendly: false,
    life: 1,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  })!;
  g.props.hit(box, 999, hostile.vel, hostile);
  assert.equal(box.hp, 48);
  assert.equal(g.auditor.state?.status, 'sealed');
});

test('ordinary shots and beam fire open the case without healing or consuming the normal room reward', () => {
  for (const build of ['standard', 'beam']) {
    const g = setup('&build=' + build);
    g.hp = 54;
    shootCase(g);
    assert.equal(g.mode, 'upgrade', build);
    assert(g.auditorReward && !g.canReroll);
    assert.equal(g.offers.length, 3);
    assert(g.offers.every((m) => availableMods(g.mods).some((a) => a.id === m.id)));
    const picked = g.offers[0].id;
    g.chooseMod(picked);
    assert.equal(g.mode, 'playing');
    assert.equal(g.stage, 4);
    assert.equal(g.hp, 54);
    assert.equal(g.mods.length, 5);
    g.chooseMod(picked);
    assert.equal(g.mods.length, 5);
    g.openReward();
    assert(!g.auditorReward && g.mode === 'upgrade');
    g.chooseMod(g.offers[0].id);
    assert.equal(g.stage, 5);
    assert.equal(g.mods.length, 6);
    assert.equal(g.hp, 66);
  }
});

test('Continue preserves the offered and claimed case, and subsequent ordinary route choice', () => {
  let g = campaign();
  empty(g);
  g.clear = true;
  g.hp = 57;
  let save: Checkpoint | null = null;
  g.onCheckpoint = (s) => {
    save = s;
  };
  shootCase(g);
  assert(save && loadCheckpoint(save), JSON.stringify(save));
  const offered = structuredClone(save);
  g = new Game();
  g.start(offered!.seed, offered!);
  assert(g.auditorReward && g.clear && !g.auditor.caseProp);
  g.onCheckpoint = (s) => {
    save = s;
  };
  g.chooseMod(g.offers[0].id);
  assert(save && loadCheckpoint(save), JSON.stringify(save));
  const claimed = structuredClone(save);
  g = new Game();
  g.start(claimed!.seed, claimed!);
  assert.equal(g.mods.length, 5);
  assert(g.clear && !g.auditor.caseProp);
  assert.equal(g.hp, 57);
  assert.equal(g.mode, 'playing');
  g.onCheckpoint = (s) => {
    save = s;
  };
  g.openReward(false, 'high');
  assert(save && loadCheckpoint(save), JSON.stringify(save));
  g.chooseMod(g.offers[0].id);
  assert(save && loadCheckpoint(save), JSON.stringify(save));
  assert.equal(g.stage, 6);
  assert.equal(g.route, 'high');
});

test('Daily cases always provide one deterministic compatible upgrade', () => {
  const offers: string[] = [];
  for (let i = 0; i < 2; i++) {
    const p = preset();
    p.seed = dailyForDate('2026-09-19')!.seed;
    const g = new Game();
    g.startTest(p);
    shootCase(g);
    assert.equal(g.offers.length, 1);
    assert(!g.canReroll);
    offers.push(g.offers[0].id);
  }
  assert.equal(offers[0], offers[1]);
});

test('an ignored case never creates a pursuer or blocks the exit', () => {
  const g = setup();
  g.openReward();
  g.chooseMod(g.offers[0].id);
  empty(g);
  step(g, 300);
  assert(!g.auditor.enemy && !g.auditor.pending && g.clear);
  assert.equal(g.auditor.state?.status, 'sealed');
});

test('arrival reserves the exit until a full warning completes at a clear, distant entrance', () => {
  const g = setup('&phase=hunt');
  assert(g.auditor.pending);
  g.openReward();
  assert.equal(g.mode, 'playing');
  g.auditor.update(2);
  const door = { ...g.auditor.door! };
  assert(distance(door, g.player.position) >= 320);
  Body.setPosition(g.player, door);
  g.auditor.update(AUDITOR_WARNING);
  assert(!g.auditor.enemy && !g.auditor.door);
  g.auditor.update(0.01);
  assert(g.auditor.door);
  assert.equal(g.auditor.warning, AUDITOR_WARNING);
  g.auditor.update(AUDITOR_WARNING + 0.01);
  const e = g.auditor.enemy!;
  assert(e && e.spawn > 0);
  assert.equal(Query.collides(e.body, g.solidBodies).length, 0);
  g.hitEnemy(e, 9999);
  assert.equal(e.hp, AUDITOR_HP);
});

test('damage persists through pause, Continue and retreat; the third visit never retreats', () => {
  const g = campaign('&phase=hunt'),
    e = arrival(g);
  e.spawn = 0;
  let save: Checkpoint | null = null;
  g.onCheckpoint = (s) => {
    save = s;
  };
  g.hitEnemy(e, 300);
  assert(e.hp < AUDITOR_HP);
  const hp = e.hp;
  g.setMode('paused');
  assert(save && loadCheckpoint(save), JSON.stringify(save));
  const h = new Game();
  h.start(g.seed, save!);
  assert.equal(arrival(h).hp, hp);
  assert.equal(h.auditor.state?.visits, 1);
  h.auditor.update(AUDITOR_VISIT);
  assert(h.auditor.recall > 0 && h.auditor.enemy);
  h.auditor.enemy!.spawn = 0;
  h.hitEnemy(h.auditor.enemy!, 100);
  const recalledHp = h.auditor.state!.hp;
  h.auditor.update(AUDITOR_RECALL);
  assert(!h.auditor.enemy && !h.auditor.pending && h.auditor.state?.retreated);
  assert.equal(h.kills, 0);
  h.stage = 9;
  h.loadRoom();
  assert.equal(arrival(h).hp, recalledHp);
  assert.equal(h.auditor.state?.visits, 2);
  h.auditor.retreat();
  h.stage = 17;
  h.loadRoom();
  arrival(h);
  h.auditor.update(AUDITOR_VISIT + 10);
  assert(h.auditor.enemy && !h.auditor.recall);
  assert.equal(h.auditor.state?.visits, 3);
});

test('early kills cancel pursuit, preserve other enemies and award only legitimate campaign progress', () => {
  for (const preview of [false, true]) {
    const g = preview ? setup('&phase=hunt') : campaign('&phase=hunt');
    const awards: CommendationId[] = [],
      discoveries: string[] = [],
      bosses: string[] = [];
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.onCommendation = (id) => awards.push(id);
    g.onEnemyDefeated = (kind) => discoveries.push(kind);
    g.onBossDefeated = (kind) => bosses.push(kind);
    const e = arrival(g);
    e.spawn = 0;
    g.spawnEnemy('runner', 1700, 720);
    const other = g.enemies.at(-1)!;
    g.auditor.age = AUDITOR_VISIT;
    g.auditor.update(0.01);
    assert(g.auditor.recall > 0);
    g.hitEnemy(e, 9999);
    g.hitEnemy(e, 9999);
    assert.equal(g.auditor.state?.status, 'defeated');
    assert(!g.auditor.pending);
    assert(g.enemies.includes(other) && other.hp > 0);
    assert.deepEqual(awards, preview ? [] : ['closed-account']);
    assert.deepEqual(discoveries, preview ? [] : ['auditor']);
    assert.deepEqual(bosses, []);
    assert.equal(writes > 0, !preview);
  }
});

test('each ranged attack has a locked telegraph and real cover stops the outgoing rounds', () => {
  for (const attack of ['burst', 'fan', 'sweep'] as const) {
    const g = setup('&phase=final'),
      e = arrival(g);
    e.spawn = 0;
    Body.setPosition(e.body, { x: 200, y: 690 });
    Body.setPosition(g.player, { x: 400, y: 690 });
    e.state = 'windup';
    e.timer = 0.4;
    e.aim = { x: 1, y: 0 };
    e.auditor!.attack = attack;
    Body.setPosition(g.player, { x: 400, y: 600 });
    g.updateEnemy(e, 0.3);
    assert.deepEqual(e.aim, { x: 1, y: 0 });
    assert.equal(g.shots.length, 0);
    Body.setPosition(g.player, { x: 400, y: 690 });
    const cover = Bodies.rectangle(290, 640, 30, 190, { isStatic: true });
    g.terrain.push(cover);
    Composite.add(g.engine.world, cover);
    g.updateEnemy(e, 0.11);
    assert.equal(e.state, 'rush');
    let fired = 0;
    for (let i = 0; i < 90; i++) {
      g.time += 1 / 60;
      if (e.state === 'rush') {
        const before = g.shots.length;
        g.updateEnemy(e, 1 / 60);
        fired += g.shots.length - before;
      }
      g.updateShots(1 / 60);
    }
    assert.equal(fired, attack === 'burst' ? 3 : 5, attack);
    assert.equal(g.hp, 100, attack);
    assert(!g.shots.some((s) => !s.friendly && s.pos.x > cover.bounds.max.x));
  }
});

test('charge collides with crates and walls, while movement can jump ordinary obstacles', () => {
  const g = setup('&phase=final'),
    e = arrival(g);
  e.spawn = 0;
  Body.setPosition(e.body, { x: 320, y: 710 });
  Body.setPosition(g.player, { x: 1100, y: 570 });
  e.state = 'idle';
  e.timer = 100;
  let high = e.body.position.y,
    furthest = e.body.position.x;
  for (let i = 0; i < 300; i++) {
    g.time += 1 / 60;
    g.updateEnemy(e, 1 / 60);
    Engine.update(g.engine, 1000 / 60);
    high = Math.min(high, e.body.position.y);
    furthest = Math.max(furthest, e.body.position.x);
  }
  assert(high < 610 && furthest > 590, JSON.stringify({ high, furthest }));
  const wall = Bodies.rectangle(350, 600, 30, 280, { isStatic: true });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  Body.setPosition(e.body, { x: 290, y: 710 });
  Body.setVelocity(e.body, { x: 0, y: 0 });
  const crate = g.props.spawn('crate', 318, 718);
  Body.setStatic(crate.body, true);
  e.state = 'rush';
  e.timer = 0.4;
  e.aim = { x: 1, y: 0 };
  e.auditor!.attack = 'charge';
  for (let i = 0; i < 40; i++) {
    g.time += 1 / 60;
    g.updateEnemy(e, 1 / 60);
    Engine.update(g.engine, 1000 / 60);
  }
  assert(e.body.bounds.max.x < 350);
});

test('pause and hitstop freeze the encounter; restarting clears its runtime state', () => {
  const g = setup('&phase=hunt'),
    e = arrival(g);
  const age = g.auditor.age,
    pos = { ...e.body.position };
  g.setMode('paused');
  step(g, 120);
  assert.equal(g.auditor.age, age);
  assert.deepEqual(e.body.position, pos);
  g.setMode('playing');
  g.hitStop = 1;
  step(g, 20);
  assert.equal(g.auditor.age, age);
  g.startTest(preset());
  assert(!g.auditor.enemy && g.auditor.caseProp);
  assert.equal(g.auditor.age, 0);
});

test('malformed pursuit states and unearned extra upgrades are rejected', () => {
  const p = preset('&phase=hunt'),
    s = p.auditor!;
  for (const auditor of [
    null,
    {},
    { ...s, hp: NaN },
    { ...s, hp: 0 },
    { ...s, visits: 4 },
    { ...s, rooms: [5, 7, 9] },
    { ...s, rooms: [5, 5, 9] },
    { ...s, status: 'defeated' },
    { ...s, status: 'offered' },
    { ...s, visits: 1 },
    { ...s, retreated: true },
    { ...s, caseStage: 3 },
  ])
    assert.equal(loadCheckpoint({ ...p, auditor }), null, JSON.stringify(auditor));
  assert.equal(loadCheckpoint({ ...p, auditor: undefined, detours: [] }), null);
  assert.equal(loadCheckpoint({ ...p, floodgate: 9 }), null);
});

test('the bonus remains valid through room rewards, detours, escape and Overtime', () => {
  const g = campaign();
  empty(g);
  g.clear = true;
  shootCase(g);
  g.chooseMod(g.offers[0].id);
  let save: Checkpoint | null = null;
  g.onCheckpoint = (s) => {
    save = s;
  };
  while (g.stage < 19) {
    if (g.auditor.pending) {
      const e = arrival(g);
      e.spawn = 0;
      g.hitEnemy(e, 9999);
    }
    empty(g);
    g.clear = true;
    g.openReward(g.stage === 10 && !g.detour);
    assert.equal(g.mode, 'upgrade');
    g.chooseMod(g.offers[0].id);
    assert(save && loadCheckpoint(save), JSON.stringify(save));
  }
  assert(g.detours.includes(2));
  empty(g);
  g.clear = true;
  g.startEscape();
  assert(save && loadCheckpoint(save), JSON.stringify(save));
  const overtime = {
    ...save!,
    stage: 0,
    escape: undefined,
    route: undefined,
    overtime: { baseMods: g.mods.length, repairs: 0 },
  };
  assert(loadCheckpoint(overtime));
  const h = new Game();
  h.start(overtime.seed, overtime);
  h.stage = 5;
  h.loadRoom();
  assert(!h.auditor.pending && !h.auditor.enemy && !h.auditor.caseProp);
});
