import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { SORTING } from '../src/sorting-pit.ts';
import {
  sortingPitTestFromUrl,
  planSortingPit,
  SORTING_LAYOUTS,
} from '../src/sorting-pit-layout.ts';
import { loadCheckpoint, getGun, type Checkpoint } from '../src/rules.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { traceTorch } from '../src/torch.ts';
import { playRoom } from './room-pilot.ts';
const { Body, Bodies, Composite, Query } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1000, y: 300 },
};
const preset = (q = '') => sortingPitTestFromUrl(new URL('https://test/?test=sorting-pit' + q))!;
function game(q = '') {
  const g = new Game();
  g.startTest(preset(q));
  return g;
}
function step(g: Game, n = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, { ...idle, ...input });
}
function quiet(g: Game) {
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.shots = [];
  g.spawnEnemy('shooter', 1900, 300).spawn = 1000;
}
function lifted(g: Game) {
  quiet(g);
  step(g, 260);
  assert.equal(g.sortingPit.phase, 'lift');
  assert(g.sortingPit.held.length > 0);
}
function shot(g: Game, friendly = true, allied = false) {
  const coil = g.sortingPit.coil;
  g.addShot({
    pos: { x: coil.x - 90, y: coil.y },
    vel: { x: 1000, y: 0 },
    damage: 24,
    life: 3,
    friendly,
    ...(allied ? { allied: true } : {}),
    radius: 3,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
  for (let i = 0; i < 8; i++) g.updateShots(1 / 60);
}

test('Sorting Pit is seeded and uncommon, skips Daily and every competing encounter', () => {
  let count = 0;
  const stages = new Set();
  for (let i = 0; i < 400; i++) {
    const seed = 'sort-plan-' + i,
      s = planSortingPit(seed);
    assert.equal(s, planSortingPit(seed));
    if (s !== null) {
      count++;
      stages.add(s);
      assert([12, 14].includes(s));
    }
    assert.equal(planSortingPit('RF-D84-2026-09-27'), null);
    assert.equal(
      planSortingPit(seed, {
        areaEvent: {
          kind: 'blackout',
          area: 3,
          relays: [],
          caches: [],
          commander: false,
          rerolls: 0,
        },
      }),
      null,
    );
    assert.notEqual(planSortingPit(seed, { courier: { stage: 12, status: 'pending' } }), 12);
    assert.notEqual(
      planSortingPit(seed, { story: { kind: 'dispatch', stage: 12, recovered: false } }),
      12,
    );
    assert.notEqual(
      planSortingPit(seed, {
        auditor: { caseStage: 1, rooms: [4, 8, 14], status: 'sealed', hp: 1800, visits: 0 },
      }),
      14,
    );
  }
  assert(count > 110 && count < 195, String(count));
  assert.deepEqual([...stages], [14]);
});

test('new campaigns persist the encounter; old checkpoints and unrelated previews keep their rooms', () => {
  let chosen: Game | undefined,
    saved: Checkpoint | null = null;
  for (let i = 0; i < 100; i++) {
    const g = new Game();
    g.onCheckpoint = (v) => (saved = v);
    g.start('sort-save-' + i);
    if (g.sortingPit.stage !== null) {
      chosen = g;
      break;
    }
  }
  assert(chosen && saved && loadCheckpoint(saved));
  const h = new Game();
  h.start(chosen.seed, saved!);
  assert.equal(h.sortingPit.stage, chosen.sortingPit.stage);
  const old = preset();
  delete old.sortingPit;
  h.start(old.seed, old);
  assert(!h.sortingPit.active);
  h.startTest({ ...preset(), seed: 'OTHER-PREVIEW' });
  assert(!h.sortingPit.active);
  for (const bad of [null, 13, 15, '12', -1, NaN])
    assert.equal(loadCheckpoint({ ...preset(), sortingPit: bad }), null);
  assert.equal(loadCheckpoint({ ...preset(), seed: 42 }), null);
  assert.equal(loadCheckpoint({ ...preset(), auditor: { rooms: 42 } }), null);
});

test('all six arenas have clear supported spawns, fixed shelters, finite props and no unrelated machinery', () => {
  for (const layout of SORTING_LAYOUTS)
    for (const mirror of ['', '&mirror=1']) {
      const g = game(`&layout=${layout}${mirror}`);
      assert(g.sortingPit.active);
      assert.equal(g.level.sortingPit, layout);
      assert.equal(g.enemies.length + g.waves.doors.length, 10);
      assert.equal(Query.collides(g.player, g.solidBodies).length, 0);
      for (const s of g.level.spawns) {
        const d = ENEMY_STATS[s.kind];
        assert.equal(
          Query.collides(Bodies.rectangle(s.x, s.y, d.w, d.h), g.solidBodies).length,
          0,
          JSON.stringify({ layout, mirror, s }),
        );
      }
      assert.equal(g.props.items.length, layout === 'feed' ? 6 : 4);
      assert.equal(g.conveyors.items.length, layout === 'feed' ? 2 : 0);
      assert(
        !g.hazards.items.length &&
          !g.mutations.pending.length &&
          !g.magnets.items.length &&
          !g.pressure.items.length,
      );
      assert(g.level.solids.filter((s) => s.y === 525).length === 2);
    }
});

test('magnet lifts several physical props, gives the complete warning, then returns them to the floor', () => {
  const g = game();
  const cues: string[] = [];
  g.onSound = (v) => cues.push(v);
  lifted(g);
  const s = g.sortingPit;
  assert.equal(s.held.length, 4);
  assert(s.held.every(({ prop }) => prop.body.position.y < 520 && !prop.body.isStatic));
  while (s.phase !== 'warning' && g.time < 10) step(g);
  assert.equal(s.phase, 'warning');
  assert(s.timer > SORTING.warning - 0.03);
  step(g, 45);
  assert.equal(s.drops.size, 0);
  assert.equal(s.phase, 'warning');
  step(g, 30);
  assert.equal(s.phase, 'drop');
  assert.equal(s.drops.size, 4);
  step(g, 160);
  assert.equal(s.drops.size, 0);
  assert(g.props.items.every((p) => p.body.position.y > 700));
  assert(
    cues.includes('sorting-lift') && cues.includes('sorting-warn') && cues.includes('sorting-drop'),
  );
});

test('coil reacts only to player fire, respects cover, and cannot have its warning extended by spam', () => {
  for (const allied of [false, true]) {
    const g = game();
    lifted(g);
    shot(g, false, allied);
    assert.equal(g.sortingPit.phase, 'lift');
  }
  const g = game();
  lifted(g);
  const coil = g.sortingPit.coil;
  const wall = Bodies.rectangle(coil.x - 50, coil.y, 10, 90, { isStatic: true });
  g.terrain.push(wall);
  shot(g);
  assert.equal(g.sortingPit.phase, 'lift');
  g.terrain.pop();
  shot(g);
  assert.equal(g.sortingPit.phase, 'warning');
  const t = g.sortingPit.timer;
  shot(g);
  assert.equal(g.sortingPit.timer, t);
  assert(!g.sortingPit.trigger());
  step(g, 40);
  assert.equal(g.sortingPit.drops.size, 0);
  step(g, 15);
  assert(g.sortingPit.drops.size > 0);
});

test('Ray, shells and Mass Driver can operate the coil; a blocked beam cannot', () => {
  for (const build of ['beam', 'shell', 'ball']) {
    const g = game('&build=' + build);
    lifted(g);
    const coil = g.sortingPit.coil;
    Body.setPosition(g.player, { x: coil.x - 130, y: coil.y + 3 });
    Body.setVelocity(g.player, { x: 0, y: 0 });
    g.aim = coil;
    if (build === 'beam') {
      assert(traceTorch(g).some((s) => s.sortingCoil));
      const wall = Bodies.rectangle(coil.x - 70, coil.y, 12, 70, { isStatic: true });
      g.terrain.push(wall);
      assert(!traceTorch(g).some((s) => s.sortingCoil));
      g.terrain.pop();
    }
    step(g, 30, { fire: true, aim: coil });
    assert.equal(g.sortingPit.phase, 'warning', build);
  }
});

test('falling scrap really collides with enemies and the player, while settled scrap is safe', () => {
  for (const player of [false, true]) {
    const g = game();
    lifted(g);
    const s = g.sortingPit,
      p = s.held[0].prop,
      x = p.body.position.x;
    const target = player ? g.player : g.spawnEnemy('runner', x, 722).body;
    const enemy = g.enemies.find((e) => e.body === target);
    if (enemy) enemy.spawn = 1000;
    Body.setPosition(target, { x, y: 720 });
    Body.setVelocity(target, { x: 0, y: 0 });
    s.trigger();
    step(g, 52);
    if (enemy) enemy.spawn = 0;
    // Isolate the collision while preserving Matter gravity and contact resolution.
    if (enemy) enemy.cooldown = 100;
    const hp = enemy?.hp ?? g.hp;
    for (let i = 0; i < 110 && (enemy ? enemy.hp >= hp : g.hp >= hp); i++) {
      if (enemy) {
        Body.setVelocity(target, { x: 0, y: target.velocity.y });
        enemy.state = 'idle';
        enemy.cooldown = 100;
      }
      step(g);
    }
    assert(
      (enemy?.hp ?? g.hp) < hp,
      JSON.stringify({ player, hp, now: enemy?.hp ?? g.hp, pos: p.body.position }),
    );
    if (player) assert.equal(g.deathCause?.type, undefined);
    step(g, 140);
    assert(!s.drops.has(p));
  }
});

test('pause freezes the cycle and clear/reward/next room remove all hazardous state', () => {
  const g = game();
  lifted(g);
  g.sortingPit.trigger();
  const timer = g.sortingPit.timer,
    positions = g.props.items.map((p) => ({ ...p.body.position }));
  g.setMode('paused');
  step(g, 120);
  assert.equal(g.sortingPit.timer, timer);
  assert.deepEqual(
    g.props.items.map((p) => p.body.position),
    positions,
  );
  g.setMode('playing');
  g.clear = true;
  step(g);
  assert.equal(g.sortingPit.phase, 'done');
  assert(!g.sortingPit.held.length && !g.sortingPit.drops.size && !g.sortingPit.trigger());
  const hp = g.hp;
  step(g, 120);
  assert.equal(g.hp, hp);
  g.openReward();
  assert.equal(g.mode, 'upgrade');
  g.sortingPit.stage = null;
  g.stage = 13;
  g.loadRoom();
  assert(!g.sortingPit.active);
});

test('destroyed or displaced loads are released, blocked props are never pulled through platforms, and no crates respawn', () => {
  const g = game();
  lifted(g);
  const s = g.sortingPit,
    p = s.held[0].prop;
  g.props.hit(p, 1000, { x: 1, y: 0 });
  step(g);
  assert(!s.held.some((h) => h.prop === p));
  const next = s.held[0].prop;
  Body.setPosition(next.body, { x: 1500, y: 400 });
  step(g);
  assert(!s.held.some((h) => h.prop === next));
  for (const p of [...g.props.items]) g.props.remove(p);
  step(g, 1500);
  assert.equal(g.props.items.length, 0);
  assert.equal(s.held.length, 0);
  const sheltered = g.props.spawn('crate', 500, 710);
  s.phase = 'rest';
  s.timer = 0;
  step(g);
  assert(!s.held.some((h) => h.prop === sheltered));
});

test('test links validate builds and isolate saves; ambiguous inputs are rejected', () => {
  for (const build of ['standard', 'beam', 'portal', 'shell', 'ball']) {
    const p = preset('&build=' + build);
    assert(loadCheckpoint(p), build);
    const g = new Game();
    let saves = 0;
    g.onCheckpoint = () => saves++;
    g.startTest(p);
    g.save();
    g.die();
    assert.equal(saves, 0);
  }
  for (const q of [
    '&layout=other',
    '&mirror=0',
    '&build=none',
    '&layout=feed&layout=pit',
    '&test=sorting-pit',
    '&seed=x',
  ])
    assert.equal(preset(q), null, q);
});

test('ordinary-input combat can clear every arena and mirror with at least two distinct gun builds', (t) => {
  for (const layout of SORTING_LAYOUTS)
    for (const mirror of ['', '&mirror=1']) {
      let cleared = 0;
      for (const build of ['standard', 'beam', 'portal']) {
        const q = `&layout=${layout}${mirror}&build=${build}`,
          g = game(q),
          result = playRoom(g, 150);
        t.diagnostic(JSON.stringify({ q, ...result }));
        if (result.clear && result.hp > 0) {
          cleared++;
          assert.equal(result.kills, 10);
        }
      }
      assert(cleared >= 2, JSON.stringify({ layout, mirror, cleared }));
    }
});

test('portal-routed player bullets and beams hit the coil only on their actual exit path', () => {
  for (const beam of [false, true]) {
    const g = game();
    lifted(g);
    const coil = g.sortingPit.coil;
    g.mods = beam ? ['fold', 'cutting-torch'] : ['fold'];
    g.gun = getGun(g.mods);
    const wall = Bodies.rectangle(260, 400, 40, 600, { isStatic: true });
    g.terrain.push(wall);
    Composite.add(g.engine.world, wall);
    assert(g.portals.place({ x: 280, y: 278 }));
    // A vertical exit wall keeps the shot below the non-solid overhead magnet.
    const exit = Bodies.rectangle(coil.x - 110, 180, 20, 330, { isStatic: true });
    g.terrain.push(exit);
    Composite.add(g.engine.world, exit);
    assert(g.portals.place({ x: coil.x - 100, y: 278 }));
    Body.setPosition(g.player, { x: 370, y: 281 });
    g.aim = { x: 0, y: 278 };
    if (beam) {
      assert(traceTorch(g).some((s) => s.sortingCoil));
      step(g, 1, { fire: true, aim: g.aim });
    } else {
      g.addShot({
        pos: { x: 355, y: 278 },
        vel: { x: -1000, y: 0 },
        damage: 20,
        life: 3,
        friendly: true,
        radius: 3,
        bounces: 0,
        pierce: 0,
        fragment: false,
        split: false,
      });
      for (let i = 0; i < 30; i++) g.updateShots(1 / 60);
    }
    assert.equal(g.sortingPit.phase, 'warning');
  }
});

test('normal movement and jumping traverse every cleared layout without crates or recoil', () => {
  for (const layout of SORTING_LAYOUTS)
    for (const mirror of ['', '&mirror=1']) {
      const g = game(`&layout=${layout}${mirror}`);
      quiet(g);
      g.clear = true;
      for (const p of [...g.props.items]) g.props.remove(p);
      g.mods = [];
      g.gun = getGun([]);
      for (let i = 0; i < 1800 && g.player.position.x < 1800 && g.mode === 'playing'; i++)
        step(g, 1, { right: true, jump: g.grounded });
      assert(
        g.player.position.x > 1800,
        JSON.stringify({ layout, mirror, pos: g.player.position }),
      );
      assert.equal(g.shotCount, 0);
    }
});
