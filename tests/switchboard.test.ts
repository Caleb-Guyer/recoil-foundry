import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Game, type Input } from '../src/game.ts';
import { SIGNAL, signalEscape, signalPoint, signalUnstick } from '../src/switchboard.ts';
import {
  SWITCHBOARD_BUILDS,
  switchboardLevel,
  switchboardTestFromUrl,
} from '../src/switchboard-layout.ts';
import { drawSwitchboard, drawSwitchboardArena } from '../src/switchboard-art.ts';
import { loadCheckpoint, validBuild, type Checkpoint } from '../src/rules.ts';
import { dailyForDate } from '../src/daily.ts';
import { dailyRegion } from '../src/regions.ts';
import { practiceCheckpoint, loadEncounters } from '../src/practice.ts';
import { migrateLogbook } from '../src/logbook.ts';
import { Body, Composite, round, advance, beam, wall } from './branches-fixture.ts';
import { dodgePilot } from './combat-pilot.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1000, y: 400 },
};
function preset(build = 'gun', mirror = false) {
  return switchboardTestFromUrl(
    new URL(`https://test/?test=switchboard&build=${build}&mirror=${+mirror}`),
  )!;
}
function game(build = 'gun', mirror = false) {
  const g = new Game();
  g.startTest(preset(build, mirror));
  const e = g.enemies[0];
  e.spawn = 0;
  return { g, e, r: e.switchboard! };
}
function lab(build = 'gun') {
  const f = game(build),
    { g, e } = f;
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  for (const p of [...g.props.items]) g.props.remove(p);
  g.engine.gravity.y = 0;
  Body.setPosition(g.player, { x: 500, y: 700 });
  Body.setPosition(e.body, { x: 1400, y: 300 });
  return f;
}
function step(f: ReturnType<typeof game>, seconds: number) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    f.g.time += 1 / 60;
    f.g.switchboard.update(f.e, 1 / 60);
  }
}
function saveOf(g: Game) {
  let save: Checkpoint | undefined;
  g.onCheckpoint = (s) => {
    save = s;
  };
  g.save();
  assert(save && loadCheckpoint(save), JSON.stringify(save));
  return save;
}

test('strict boss presets use legal builds, both mirrors, and isolated progression', () => {
  for (const build of Object.keys(SWITCHBOARD_BUILDS))
    for (const mirror of [false, true]) {
      const s = preset(build, mirror);
      assert(loadCheckpoint(s) && validBuild(s.mods));
      const { g, e } = game(build, mirror);
      let writes = 0;
      g.onCheckpoint =
        g.onBossDefeated =
        g.onEnemyDefeated =
          () => {
            writes++;
          };
      assert.equal(g.level.mirrored, mirror);
      assert(g.inAnnex && g.level.boss);
      assert.equal(g.enemies.length, 1);
      assert.equal(e.kind, 'switchboard');
      g.save();
      g.hitEnemy(e, 1e9);
      g.hitStop = 0;
      g.tick(1 / 60, idle);
      assert.equal(g.mode, 'won');
      assert.equal(writes, 0);
      g.startTest(s);
      assert.equal(g.enemies.length, 1);
      assert.equal(g.switchboard.enemy!.switchboard!.interruptions, 0);
    }
  for (const extra of [
    '&test=switchboard',
    '&build=nope',
    '&build=beam&build=gun',
    '&mirror=2',
    '&seed=x',
    '&daily=2026-09-25',
    '&mirror=0&mirror=1',
  ])
    assert.equal(switchboardTestFromUrl(new URL('https://test/?test=switchboard' + extra)), null);
});

test('three emitter fixtures and junctions clear arena terrain in both mirrors', () => {
  for (const mirror of [false, true]) {
    const { g, e } = game('gun', mirror);
    assert.deepEqual(g.level, switchboardLevel(g.seed, mirror));
    for (let slot = 0; slot < 3; slot++)
      for (const part of ['port', 'junction'] as const) {
        const p = signalPoint(g, slot, part),
          size = part === 'port' ? 29 : 20;
        assert(
          g.level.solids.every(
            (s) =>
              p.x + size < s.x ||
              p.x - size > s.x + s.w ||
              p.y + size < s.y ||
              p.y - size > s.y + s.h,
          ),
        );
      }
    assert.equal(signalUnstick(g, e), null);
    assert.equal(g.waves.pending, false);
  }
});

test('teaches sweep, ground and playback before combining two independently warned emitters', () => {
  const f = lab(),
    { g, e, r } = f;
  e.hp = e.maxHp * 0.4;
  for (const kind of ['sweep', 'ground', 'playback']) {
    while (e.state !== 'windup') step(f, 1 / 60);
    assert.equal(e.phase, 0);
    assert.deepEqual(
      r.plans.map((p) => p.kind),
      [kind],
    );
    const old = r.fired;
    step(f, 1.38);
    assert.equal(r.fired, old, 'full warning before any round');
    while (e.state !== 'recover') step(f, 1 / 60);
    assert(r.fired > old);
  }
  while (e.state !== 'transition') step(f, 1 / 60);
  assert.equal(e.phase, 1);
  assert.equal(e.state, 'transition');
  assert(!g.shots.some((s) => s.signalOwner === e.id));
  while (e.state !== 'windup') step(f, 1 / 60);
  assert.equal(r.plans.length, 2);
  assert.notEqual(r.plans[0].slot, r.plans[1].slot);
  step(f, 1.02);
  assert(r.plans.every((p) => p.locked && p.escape && !p.cut));
  assert(signalEscape(g, r.plans));
  assert(r.plans[1].delay > 0);
});

test('playback freezes three actual positions and does not track after lock', () => {
  const f = lab(),
    { g, e, r } = f;
  e.attacks = 2;
  g.switchboard.begin(e);
  const first = { ...g.player.position };
  Body.setPosition(g.player, { x: 620, y: 650 });
  step(f, 0.31);
  Body.setPosition(g.player, { x: 730, y: 610 });
  step(f, 0.31);
  const p = r.plans[0];
  assert(p.locked && !p.cut);
  assert.deepEqual(p.marks, [first, { x: 620, y: 650 }, { x: 730, y: 610 }]);
  const snapshot = structuredClone({ marks: p.marks, angles: p.angles });
  Body.setPosition(g.player, { x: 1600, y: 150 });
  step(f, 0.7);
  assert.deepEqual({ marks: p.marks, angles: p.angles }, snapshot);
  assert.equal(p.sent, 0);
});

test('a junction cancels only one pattern, has a shared lockout, and opens a damage window', () => {
  const f = lab(),
    { g, e, r } = f;
  e.phase = 1;
  g.switchboard.begin(e);
  const [p, other] = r.plans,
    hp = e.hp;
  assert(g.switchboard.interrupt(p.slot));
  assert(p.cut && !other.cut);
  assert.equal(r.cooldown, SIGNAL.cooldown);
  assert.equal(r.opening, SIGNAL.opening);
  assert.equal(hp - e.hp, 70 * 1.55);
  assert(!g.switchboard.interrupt(other.slot));
  assert.equal(g.spoof.feedback.size, 0);
  step(f, 2.6);
  assert(r.fired > 0 && other.sent > 0);
  assert(!g.switchboard.interrupt(other.slot));
  const previous = e.hp;
  e.state = 'idle';
  r.opening = 0;
  g.hitEnemy(e, 100);
  assert.equal(previous - e.hp, 60);
});

for (const build of ['gun', 'beam', 'shell'])
  for (const blocked of [false, true])
    test(`${build}: junction hits use the weapon pipeline and respect cover=${blocked}`, () => {
      const { g, e, r } = lab(build);
      e.attacks = 1;
      g.switchboard.begin(e);
      const p = r.plans[0],
        j = signalPoint(g, p.slot, 'junction');
      Body.setPosition(g.player, { x: j.x - 200, y: j.y });
      g.aim = { ...j };
      if (blocked) wall(g, j.x - (build === 'shell' ? 25 : 65), j.y, 12, 100);
      if (build === 'beam') beam(g, 0.2);
      else if (build === 'shell')
        g.demolition.impact(
          round(g, { pos: { x: j.x - 55, y: j.y }, shell: g.demolition.payload(50) }),
        );
      else {
        g.fire();
        advance(g, 30);
      }
      assert.equal(r.interruptions, blocked ? 0 : 1);
    });

test('boss projectiles are physical, portal-compatible, and cleared by sender death', () => {
  const f = lab('portal'),
    { g, e, r } = f;
  assert(g.portals.place({ x: 400, y: 740 }));
  assert(g.portals.place({ x: 1600, y: 740 }));
  e.attacks = 1;
  g.switchboard.begin(e);
  step(f, 1.42);
  const s = g.shots.find((s) => s.signalOwner === e.id)!;
  assert(s && !s.friendly);
  assert.deepEqual(s.source, r.plans[0].origin);
  s.pos = { x: 400, y: 710 };
  s.vel = { x: 0, y: 45 };
  g.updateShots(1 / 60);
  assert(s.pos.x > 1500 && s.vel.y < 0);
  assert.equal(s.signalOwner, e.id);
  s.pos = { x: 900, y: 300 };
  s.vel = { x: 30, y: 0 };
  wall(g, 930, 300, 10, 100);
  g.updateShots(1 / 60);
  assert(!g.shots.includes(s));
  step(f, 0.2);
  assert(g.shots.some((s) => s.signalOwner === e.id));
  const reflected = round(g, { reflected: true, signalOwner: e.id });
  g.hitEnemy(e, 1e9);
  assert(g.shots.includes(reflected));
  assert(!g.shots.some((s) => s.signalOwner === e.id && !s.friendly));
  assert.equal(e.switchboard, undefined);
});

test('pause and hitstop freeze warnings; death, retry and room changes discard them', () => {
  const { g, e, r } = game();
  g.switchboard.begin(e);
  const before = JSON.stringify(r);
  g.setMode('paused');
  for (let i = 0; i < 60; i++) g.tick(1 / 60, idle);
  assert.equal(JSON.stringify(r), before);
  g.setMode('playing');
  g.hitStop = 1;
  g.tick(1 / 60, idle);
  assert.equal(JSON.stringify(r), before);
  g.setMode('dead');
  assert.equal(e.switchboard, undefined);
  g.startTest(preset());
  const fresh = g.enemies[0];
  assert.equal(fresh.switchboard!.plans.length, 0);
  g.loadRoom();
  assert.equal(fresh.switchboard, undefined);
});

test('Spoof gives bounded feedback against Switchboard without creating an ally', () => {
  const { g, e } = lab('subversion');
  const before = e.hp;
  round(g, { pos: { x: 1300, y: 300 }, damage: 500 });
  advance(g, 6);
  assert(e.hp < before);
  const feedback = g.spoof.feedback.get(e.id)!;
  assert(feedback && feedback.damage > 0 && feedback.damage <= g.spoof.stats.cap);
  g.time += 2;
  g.spoof.update();
  g.time += 1;
  g.spoof.update();
  assert.equal(g.spoof.pending.length, 0);
  assert.equal(g.factions.allies.length, 0);
});

test('ordinary physics frees the hull from a chamfer contact instead of stranding it', () => {
  const { g, e } = game('shell', true);
  Body.setPosition(g.player, { x: 508.375, y: 722 });
  Body.setPosition(e.body, { x: 578.506, y: 514.623 });
  e.hunt = undefined;
  assert(signalUnstick(g, e));
  const start = { ...e.body.position };
  for (let i = 0; i < 90; i++) g.tick(1 / 60, idle);
  assert(Math.hypot(e.body.position.x - start.x, e.body.position.y - start.y) > 50);
});

test('ceiling contact retains an escape and cannot silently cancel every attack', () => {
  const f = game(),
    { g, e, r } = f;
  Body.setPosition(g.player, { x: 1000, y: 18 });
  g.switchboard.begin(e);
  step(f, 0.62);
  assert(r.plans[0].locked && r.plans[0].escape && !r.plans[0].cut);
  step(f, 1);
  assert(r.fired > 0);
});

test('reduced effects retains warning shapes, with bounded state and no combat labels', () => {
  const f = lab(),
    { g, e, r } = f;
  e.phase = 1;
  g.switchboard.begin(e);
  step(f, 1.02);
  let strokes = 0,
    labels = 0;
  const c = new Proxy(
    {},
    {
      get: (_, k) =>
        k === 'stroke' ? () => strokes++ : k === 'fillText' ? () => labels++ : () => {},
      set: () => true,
    },
  ) as CanvasRenderingContext2D;
  drawSwitchboardArena(c, g);
  drawSwitchboard(c, e, true);
  assert(strokes > 10 && labels === 0);
  for (let i = 0; i < 3600; i++) {
    step(f, 1 / 60);
    g.updateShots(1 / 60);
    g.hp = 100;
    assert(
      r.plans.length <= 2 && r.plans.every((p) => p.marks.length <= 3 && p.angles.length <= 5),
    );
    assert(g.shots.length <= 10);
  }
});

test('old regional saves retain their boss; revision three persists boss, reward and Reclamation return', () => {
  for (const revision of [undefined, 1, 2, 3] as const) {
    const s = preset();
    delete s.switchboardTest;
    s.annexVersion = revision;
    const g = new Game();
    g.start(s.seed, s);
    assert.equal(g.level.id === 'annex-switchboard', revision === 3);
    const saved = saveOf(g),
      resumed = new Game();
    resumed.start(saved.seed, saved);
    assert.deepEqual(resumed.level, g.level);
    assert.equal(saved.annexVersion, revision ?? 1);
    if (revision !== 3) continue;
    const e = g.enemies[0];
    e.spawn = 0;
    let victories = 0;
    g.onBossDefeated = (kind) => {
      assert.equal(kind, 'switchboard');
      victories++;
    };
    g.hitEnemy(e, 1e9);
    g.hitEnemy(e, 1e9);
    assert.equal(victories, 1);
    g.hitStop = 0;
    for (let i = 0; i < 120 && !g.clear; i++) g.tick(1 / 60, idle);
    assert(g.clear);
    g.openReward();
    const reward = saveOf(g);
    assert.equal(reward.reward!.enteringRoute, undefined);
    resumed.start(reward.seed, reward);
    assert.equal(resumed.mode, 'upgrade');
    assert.deepEqual(
      resumed.offers.map((m) => m.id),
      g.offers.map((m) => m.id),
    );
    resumed.chooseMod(resumed.offers[0].id);
    assert.equal(resumed.stage, 12);
    assert.equal(resumed.level.area, 'reclamation');
    assert(!resumed.inAnnex);
  }
});

test('earned practice reloads Switchboard without falsely discovering Cooling Works', () => {
  const victory = { kind: 'switchboard' as const, seed: 'real-annex-victory' };
  assert.deepEqual(loadEncounters([victory]), [victory]);
  const s = practiceCheckpoint(victory)!;
  assert(loadCheckpoint(s));
  const g = new Game();
  g.startPractice(victory);
  assert.equal(g.level.id, 'annex-switchboard');
  assert.equal(g.enemies[0].kind, 'switchboard');
  const lore = migrateLogbook(null, null, [], [victory]);
  assert(lore.annex && !lore.areas.includes('cooling'));
});

// Captured from f2ae3b5 before Switchboard integration: full rooms, both regions and all rewards.
const oldDaily: { seed: string; region: string; rooms: string[]; rewards: string[] }[] = JSON.parse(
  readFileSync(new URL('./fixtures/daily81.json', import.meta.url), 'utf8'),
);
for (const old of oldDaily)
  test(old.seed + ': exact Daily 81 layout and reward compatibility', () => {
    const g = new Game();
    g.start(old.seed);
    g.areaEvents.state = null;
    g.auditor.state = null;
    assert.equal(g.region, old.region);
    for (let stage = 0; stage < 20; stage++) {
      assert.equal(
        g.level.id + ':' + createHash('sha256').update(JSON.stringify(g.level)).digest('hex'),
        old.rooms[stage],
      );
      if (stage === 19) break;
      g.openReward();
      assert.deepEqual(
        g.offers.map((m) => m.id),
        [old.rewards[stage]],
      );
      g.chooseMod(g.offers[0].id);
    }
  });

test('Daily 82 fixes the region and keeps exactly one reward after the new boss', () => {
  const seen = new Set<string>();
  for (let day = 1; day <= 8; day++) {
    const seed = dailyForDate(`2026-09-${String(day).padStart(2, '0')}`)!.seed;
    const g = new Game();
    g.start(seed);
    g.areaEvents.state = null;
    g.auditor.state = null;
    assert.equal(g.region, dailyRegion(seed));
    seen.add(g.region!);
    for (let i = 0; i < 12; i++) {
      if (i === 11) assert.equal(g.level.id === 'annex-switchboard', g.region === 'annex');
      g.openReward();
      assert.equal(g.offers.length, 1);
      assert(saveOf(g));
      g.chooseMod(g.offers[0].id);
    }
    assert.equal(g.stage, 12);
    assert(!g.inAnnex);
  }
  assert.equal(seen.size, 2);
});

for (const build of Object.keys(SWITCHBOARD_BUILDS))
  for (const mirror of [false, true])
    test(`${build} mirror=${mirror}: ordinary input wins through both phases`, (t) => {
      const { g, e } = game(build, mirror);
      let input = idle,
        phase = 0;
      if (build === 'portal') {
        assert(g.portals.place({ x: 270, y: 740 }));
        assert(g.portals.place({ x: 1730, y: 740 }));
      }
      for (let i = 0; i < 60 * 100 && g.mode === 'playing'; i++) {
        if (i % 6 === 0) input = { ...idle, ...dodgePilot(g, e) };
        g.tick(1 / 60, input);
        phase = Math.max(phase, e.phase);
      }
      const result = { build, mirror, mode: g.mode, hp: g.hp, seconds: g.time, boss: e.hp, phase };
      assert.equal(g.mode, 'won', JSON.stringify(result));
      assert.equal(phase, 1);
      t.diagnostic(JSON.stringify(result));
    });

for (const build of ['gun', 'counter'])
  for (const mirror of [false, true])
    for (const pos of [
      { x: 45, y: 722 },
      { x: 550, y: 722 },
      { x: 1000, y: 140 },
      { x: 1955, y: 722 },
    ])
      test(`${build} mirror=${mirror}: stationary firing at ${pos.x},${pos.y} loses`, () => {
        const { g, e } = game(build, mirror);
        // Perfect stationary aim and free hover deliberately favor the cheese attempt.
        Body.setPosition(g.player, pos);
        Body.setStatic(g.player, true);
        for (let i = 0; i < 60 * 90 && g.mode === 'playing'; i++)
          g.tick(1 / 60, { ...idle, fire: true, aim: { ...e.body.position } });
        assert.equal(g.mode, 'dead', JSON.stringify({ build, mirror, pos, hp: g.hp, boss: e.hp }));
      });
