import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { beginInterceptorAttack, interceptorAngles } from '../src/interceptor.ts';
import { fireWeapon, clearArsenal, rivalImpact } from '../src/interceptor-weapons.ts';
import { RIVAL_GRIND, updateRivalGrind, grindPlanValid } from '../src/interceptor-grindshot.ts';
import { rivalWarningLanes } from '../src/interceptor-effects.ts';
import { interceptorGrindTestFromUrl } from '../src/practice.ts';
import { getGun, loadCheckpoint, distance } from '../src/rules.ts';
import { dodgePilot } from './combat-pilot.ts';
const { Body, Bodies, Composite } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1400, y: 400 },
};
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
function fixture(phase = 0, platform = false, mirror = false) {
  const g = new Game();
  g.startPractice({ kind: 'interceptor', seed: 'saw-check' });
  g.breaches.clear();
  g.destruction.clear();
  g.hazards.clear();
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.mods = [];
  g.gun = getGun([]);
  const e = g.enemies[0];
  e.spawn = 0;
  e.timer = 100;
  e.phase = phase;
  e.hp = e.maxHp * [1, 0.6, 0.25][phase];
  Body.setPosition(e.body, { x: mirror ? 1400 : 600, y: 400 });
  Body.setStatic(e.body, true);
  Body.setPosition(g.player, { x: 1000, y: 722 });
  Body.setStatic(g.player, true);
  if (platform) {
    const b = Bodies.rectangle(mirror ? 1100 : 900, 550, 200, 40, { isStatic: true });
    g.terrain.push(b);
    Composite.add(g.engine.world, b);
  }
  beginInterceptorAttack(g, e, 'grindshot');
  assert.equal(e.interceptor!.move, 'grindshot');
  return { g, e, rig: e.interceptor! };
}
function flight(g: Game, frames = 1) {
  for (let n = 0; n < frames; n++) {
    g.time += 1 / 60;
    g.updateShots(1 / 60);
  }
}
function fire({ g, e }: ReturnType<typeof fixture>) {
  fireWeapon(g, e, 'grindshot', e.interceptor!.origin, interceptorAngles(e));
}
function landed(f: ReturnType<typeof fixture>) {
  fire(f);
  for (let n = 0; n < 90 && f.g.shots.length; n++) flight(f.g);
  assert(f.rig.saws.length > 0, 'Real surface impact must create a saw');
}
function sawStep(f: ReturnType<typeof fixture>, frames = 1) {
  for (let n = 0; n < frames; n++) {
    f.g.time += 1 / 60;
    updateRivalGrind(f.g, f.e, 1 / 60);
  }
}

for (const mirror of [false, true])
  for (const phase of [0, 1, 2])
    test(`phase ${phase + 1}, mirror ${mirror}: real rounds land on marked floor/wall routes`, () => {
      const f = fixture(phase, true, mirror),
        { g, e, rig } = f;
      assert.equal(rig.grindPlans.length, phase ? 2 : 1);
      assert.equal(rig.grindBullets.length, phase ? 3 : 0);
      assert.equal(new Set(rig.grindPlans.map((p) => p.body)).size, rig.grindPlans.length);
      assert(
        rig.grindPlans.every(
          (p) => p.wrap === phase > 0 && distance(p.path[0], g.player.position) >= 90,
        ),
      );
      const frozen = rig.grindPlans.map((p) => structuredClone(p.path));
      const lanes = rivalWarningLanes(g, e);
      for (const p of rig.grindPlans) assert(lanes.some((l) => distance(l.to, p.impact) < 0.01));
      Body.setPosition(g.player, { x: 1800, y: 180 });
      landed(f);
      assert.equal(rig.saws.length, phase ? 2 : 1);
      const saws = [...rig.saws];
      for (let n = 0; n < 82; n++) {
        sawStep(f);
        for (const s of rig.saws) {
          const a = s.plan.path[s.next - 1],
            b = s.plan.path[s.next];
          near(distance(a, s.pos) + distance(s.pos, b), distance(a, b));
        }
      }
      assert.equal(rig.saws.length, 0);
      assert.deepEqual(
        rig.grindPlans.map((p) => p.path),
        frozen,
      );
      if (phase)
        assert(
          saws.some((s) => s.next > 2),
          'Later saws actually turn a corner',
        );
    });

test('floor shot sweeps toward a camper, hits once, and an ordinary jump clears it', () => {
  for (const jump of [false, true]) {
    const f = fixture();
    landed(f);
    const initial = f.g.hp;
    if (jump) {
      Body.setStatic(f.g.player, false);
      f.g.grounded = true;
    }
    f.e.state = 'recover';
    f.e.timer = 10;
    for (let n = 0; n < 90; n++)
      f.g.tick(1 / 60, { ...idle, jump: jump && n === 0, jumpHeld: jump });
    assert.equal(f.g.hp, initial - (jump ? 0 : RIVAL_GRIND.damage));
    assert.equal(f.rig.saws.length, 0);
  }
});

test('immunity consumes the saw without repeated damage or a physical wedge', () => {
  const f = fixture();
  landed(f);
  const s = f.rig.saws[0],
    before = { ...f.g.player.velocity };
  Body.setPosition(f.g.player, { x: s.pos.x + 10, y: 722 });
  f.g.hurtAt = f.g.time;
  sawStep(f, 2);
  assert.equal(f.g.hp, 100);
  assert.equal(f.rig.saws.length, 0);
  assert.deepEqual(f.g.player.velocity, before);
});

test('crates intercept entry rounds; moved or destroyed supports never relocate their warnings', () => {
  for (const obstacle of ['crate', 'moved', 'destroyed']) {
    const f = fixture(),
      p = f.rig.grindPlans[0];
    if (obstacle === 'crate') {
      const c = f.g.props.spawn(
        'crate',
        (p.origin.x + p.impact.x) / 2,
        (p.origin.y + p.impact.y) / 2,
      );
      Body.setStatic(c.body, true);
    } else if (obstacle === 'moved') Body.translate(p.body, { x: 20, y: 0 });
    else {
      f.g.terrain = f.g.terrain.filter((b) => b !== p.body);
      Composite.remove(f.g.engine.world, p.body);
    }
    fire(f);
    flight(f.g, 90);
    assert.equal(f.rig.saws.length, 0, obstacle);
    if (obstacle !== 'crate') {
      assert(!grindPlanValid(f.g, p));
      assert.equal(rivalWarningLanes(f.g, f.e).length, 0);
    }
  }
});

test('player interception, reflection and portal redirection cannot spawn a remote saw', () => {
  for (const obstacle of ['player', 'reflected', 'portal']) {
    const f = fixture(),
      p = f.rig.grindPlans[0];
    if (obstacle === 'player')
      Body.setPosition(f.g.player, {
        x: (p.origin.x + p.impact.x) / 2,
        y: (p.origin.y + p.impact.y) / 2,
      });
    if (obstacle === 'portal') {
      f.g.mods = ['fold'];
      f.g.gun = getGun(f.g.mods);
      assert(f.g.portals.place({ x: p.impact.x, y: 740 }));
      assert(f.g.portals.place({ x: 1600, y: 740 }));
    }
    fire(f);
    if (obstacle === 'reflected') {
      const s = f.g.shots[0];
      s.friendly = true; // updateRivalAmmo performs ownership cleanup
    }
    flight(f.g, 120);
    assert.equal(f.rig.saws.length, 0, obstacle);
  }
});

test('new cover blocks a travelling blade even when the hit destroys that cover', () => {
  const f = fixture();
  landed(f);
  const s = f.rig.saws[0];
  const c = f.g.props.spawn('crate', s.pos.x + 60, 716);
  c.hp = 1;
  Body.setStatic(c.body, true);
  const hp = f.g.hp;
  sawStep(f, 60);
  assert(!f.g.props.items.includes(c));
  assert.equal(f.rig.saws.length, 0);
  assert.equal(f.g.hp, hp);
});

test('moving or removing support also cancels a blade already travelling on it', () => {
  for (const remove of [false, true]) {
    const f = fixture();
    landed(f);
    const p = f.rig.saws[0].plan;
    if (remove) f.g.terrain = f.g.terrain.filter((b) => b !== p.body);
    else Body.rotate(p.body, 0.01);
    sawStep(f);
    assert.equal(f.rig.saws.length, 0);
  }
});

test('hitstop and pause freeze saws; phase, player death, boss death and retry clear all hazards', () => {
  const f = fixture();
  landed(f);
  const saw = f.rig.saws[0],
    before = { ...saw.pos },
    life = saw.life;
  f.g.setMode('paused');
  for (let i = 0; i < 10; i++) f.g.tick(1 / 60, idle);
  assert.deepEqual(saw.pos, before);
  near(saw.life, life);
  f.g.setMode('playing');
  f.g.hitStop = 0.1;
  f.g.tick(1 / 60, idle);
  assert.deepEqual(saw.pos, before);
  near(saw.life, life);
  f.g.hitStop = 0;
  f.e.hp = f.e.maxHp * 0.6;
  f.g.tick(1 / 60, idle);
  assert.equal(f.rig.saws.length, 0);
  assert.equal(f.rig.grindPlans.length, 0);
  for (const end of ['player', 'boss', 'retry', 'title']) {
    const f = fixture();
    landed(f);
    if (end === 'player') f.g.die();
    if (end === 'boss') f.g.hitEnemy(f.e, 999999);
    if (end === 'title') f.g.setMode('title');
    if (end === 'retry') f.g.startPractice({ kind: 'interceptor', seed: 'saw-check' });
    assert(f.g.enemies.every((e) => !e.interceptor?.saws.length));
    assert(!f.g.shots.some((s) => !s.friendly && s.life > 0));
  }
});

test('a displaced locked boss cancels the entire attack and retains a real recovery weakness', () => {
  const f = fixture();
  Body.translate(f.e.body, { x: 11, y: 0 });
  f.g.tick(1 / 60, idle);
  assert.equal(f.e.state, 'idle');
  assert.equal(f.rig.grindPlans.length, 0);
  assert.equal(f.g.shots.length, 0);
  beginInterceptorAttack(f.g, f.e, 'grindshot');
  const hp = f.e.hp;
  f.g.hitEnemy(f.e, 100);
  near(hp - f.e.hp, 35);
  f.g.hitStop = 0;
  for (let n = 0; n < 100 && f.e.state === 'windup'; n++) f.g.tick(1 / 60, idle);
  assert.equal(f.e.state, 'recover');
  assert(f.e.timer >= 1.68);
  const open = f.e.hp;
  f.g.hitEnemy(f.e, 100);
  near(open - f.e.hp, 130);
});

test('active saw count is bounded and explicit arsenal cleanup clears queued impacts', () => {
  const f = fixture();
  fire(f);
  const shot = f.g.shots[0],
    p = f.rig.grindPlans[0];
  shot.pos = { ...p.impact };
  for (let n = 0; n < 20; n++) rivalImpact(f.g, shot, p.body);
  assert.equal(f.rig.saws.length, RIVAL_GRIND.limit);
  clearArsenal(f.g, f.e);
  assert.equal(f.rig.saws.length, 0);
  assert.equal(shot.life, 0);
});

test('focused test links validate phases/mirrors and preserve checkpoints and earned victories', () => {
  const url = (q = '') => new URL('https://test/?test=interceptor-grindshot' + q);
  for (const phase of [1, 2, 3])
    for (const mirror of [0, 1]) {
      const save = interceptorGrindTestFromUrl(url(`&phase=${phase}&mirror=${mirror}`));
      assert(save && loadCheckpoint(save));
      const g = new Game(),
        writes: unknown[] = [],
        wins: unknown[] = [];
      g.onCheckpoint = (s) => writes.push(s);
      g.onBossDefeated = (k) => wins.push(k);
      g.startTest(save);
      assert.equal(g.enemies[0].hp, g.enemies[0].maxHp);
      assert.equal(g.enemies[0].phase, phase - 1);
      assert.equal(g.level.mirrored, !!mirror);
      g.enemies[0].spawn = 0;
      g.hitEnemy(g.enemies[0], 999999);
      g.die();
      g.startTest(save);
      assert.equal(g.enemies[0].phase, phase - 1);
      assert.deepEqual(writes, []);
      assert.deepEqual(wins, []);
      g.start(save.seed, save);
      assert.equal(g.enemies[0].phase, 0, 'A normal seed does not select test behavior');
    }
  for (const suffix of [
    '&phase=0',
    '&phase=4',
    '&phase=2&phase=2',
    '&mirror=3',
    '&test=interceptor-grindshot',
    '&daily=2026-09-12',
    '&dv=47',
    '&seed=x',
    '&route=low',
    '&area=rooftops',
    '&build=base',
    '&mode=overtime',
  ])
    assert.equal(interceptorGrindTestFromUrl(url(suffix)), null, suffix);
});

for (const mirror of [0, 1])
  test(`focused final-phase fight demonstrates actual saws and remains beatable, mirror=${mirror}`, () => {
    const g = new Game();
    g.startTest(
      interceptorGrindTestFromUrl(
        new URL('https://test/?test=interceptor-grindshot&phase=3&mirror=' + mirror),
      )!,
    );
    const e = g.enemies[0];
    let blades = 0;
    for (let n = 0; n < 10800 && g.mode === 'playing' && e.hp > 0; n++) {
      g.tick(1 / 60, { ...idle, jumpHeld: true, ...dodgePilot(g, e) });
      blades = Math.max(blades, e.interceptor!.saws.length);
    }
    assert(blades > 0, 'The boss must demonstrate the new attack before it can be defeated');
    assert(g.hp > 0 && e.hp <= 0);
  });
