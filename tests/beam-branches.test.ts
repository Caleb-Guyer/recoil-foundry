import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, target, beam, wall, Body, round } from './branches-fixture.ts';
import { TORCH, traceTorch } from '../src/torch.ts';
import { getGun } from '../src/rules.ts';
const near = (a: number, b: number, e = 1e-5) => assert(Math.abs(a - b) < e, `${a} != ${b}`);

test('Pulse Chamber keeps the burst budget and gives only the narrow finisher extra penetration', () => {
  const g = fixture(['cutting-torch', 'burst', 'pulse-chamber']);
  const front = target(g),
    rear = target(g, 800);
  const payload = g.gun.damage * TORCH.output;
  beam(g, 0.1);
  near(front.maxHp - front.hp, payload * 0.7);
  near(rear.hp, rear.maxHp);
  beam(g, 0.15);
  near(front.maxHp - front.hp, payload * 1.4);
  near(rear.hp, rear.maxHp);
  beam(g, 0.15);
  near(front.maxHp - front.hp, payload * 3);
  near(rear.maxHp - rear.hp, payload * 1.6 * 0.8);
  assert(g.torch.finisher);
  const segment = traceTorch(g).find((s) => s.enemy === rear);
  assert(segment);
});

test('all three beam modes integrate real damage across 30, 60 and 120 Hz', () => {
  for (const mode of ['pulse-chamber', 'charge-lens', 'prism-array']) {
    const damages = [];
    for (const hz of [30, 60, 120]) {
      const g = fixture(['cutting-torch', 'burst', 'scatter', mode]);
      const e = target(g, 400);
      Body.scale(e.body, 1, 10);
      if (mode === 'charge-lens') {
        beam(g, 1, true, 1 / hz);
        near(e.hp, e.maxHp);
        beam(g, 1, false, 1 / hz);
      } else beam(g, 1, true, 1 / hz);
      damages.push(e.maxHp - e.hp);
      assert(damages.at(-1)! > 0);
      assert(Number.isFinite(g.player.velocity.x));
    }
    near(damages[0], damages[1]);
    near(damages[1], damages[2]);
  }
});

test('Charge Lens fires on deliberate release, rewards a full charge and cannot tap through recovery', () => {
  const g = fixture(['cutting-torch', 'charge-lens']);
  const e = target(g);
  beam(g, 0.8);
  near(e.hp, e.maxHp);
  assert.equal(g.shotCount, 0);
  near(g.torch.chargeProgress, 1);
  beam(g, 0.1, false);
  near(e.maxHp - e.hp, g.gun.damage * TORCH.output * 4);
  assert.equal(g.shotCount, 1);
  assert(g.player.velocity.x < -15);
  for (let i = 0; i < 12; i++) beam(g, 1 / 60, i % 2 === 0);
  assert.equal(g.shotCount, 1);
  const partial = fixture(['cutting-torch', 'charge-lens']);
  const p = target(partial);
  beam(partial, 0.2);
  beam(partial, 0.1, false);
  assert(p.maxHp - p.hp > 0 && p.maxHp - p.hp < e.maxHp - e.hp);
});

test('charged Burst spends each available cell once and never recharges while lances are queued', () => {
  const g = fixture([
    'cutting-torch',
    'charge-lens',
    'burst',
    'capacitor',
    'reserve-cell',
    'landing',
  ]);
  const e = target(g);
  g.ballistics.charges = 2;
  g.landingReady = true;
  beam(g, 0.8);
  assert.equal(g.ballistics.charges, 2);
  beam(g, 0.4, false);
  assert.equal(g.shotCount, 3);
  assert.equal(g.ballistics.charges, 0);
  assert(!g.landingReady);
  const per = g.gun.damage * TORCH.output * 4 * 0.45;
  near(e.maxHp - e.hp, per * (4 + 2 + 1));
  assert(g.ballistics.idle < 0.85);
});

test('Thermal charge focus needs one exposed target and is lost when aiming away', () => {
  const output = (lose: boolean, cover: boolean) => {
    const g = fixture(['cutting-torch', 'charge-lens', 'thermal-runaway']);
    const e = target(g);
    if (cover) wall(g, 400, 300, 20, 400);
    beam(g, 0.8);
    if (lose) {
      g.aim.y = 0;
      beam(g, 0.1);
      g.aim.y = 300;
    }
    beam(g, 0.1, false);
    return { damage: e.maxHp - e.hp, g };
  };
  const hot = output(false, false),
    cold = output(true, false);
  near(hot.damage / cold.damage, 1.75);
  near(output(false, true).damage, 0);
});

test('pausing, death and room changes cancel a stored charge without a release shot', () => {
  for (const action of ['pause', 'death', 'room']) {
    const g = fixture(['cutting-torch', 'charge-lens']);
    target(g);
    beam(g, 0.8);
    const count = g.shotCount;
    if (action === 'pause') {
      g.setMode('paused');
      g.setMode('playing');
    } else if (action === 'death') {
      g.setMode('dead');
      g.setMode('playing');
    } else g.loadRoom();
    beam(g, 0.2, false);
    assert.equal(g.shotCount, count);
    assert.equal(g.torch.charging, 0);
  }
});

test('Prism splits actual hit lanes and combines their declared energy on an overlapping target', () => {
  const g = fixture(['cutting-torch', 'prism-array']);
  const left = target(g, 600, 261),
    right = target(g, 600, 333),
    center = target(g, 600, 297);
  beam(g, 0.1);
  assert(left.hp < left.maxHp && right.hp < right.maxHp);
  near(center.hp, center.maxHp);
  const wide = fixture(['cutting-torch', 'prism-array']);
  const e = target(wide, 400);
  Body.scale(e.body, 1, 10);
  beam(wide, 0.1);
  near(e.maxHp - e.hp, (wide.gun.damage * TORCH.output * 1.2 * 0.1) / wide.gun.interval);
  assert(wide.torch.segments.length <= TORCH.segments);
});

test('Prism thermal heat belongs to its first ray and shared hit effects cannot multiply a charge', () => {
  const g = fixture([
    'cutting-torch',
    'prism-array',
    'thermal-runaway',
    'countershot',
    'backblast',
    'backfire',
  ]);
  const a = target(g, 600, 261),
    b = target(g, 600, 333);
  beam(g, 2);
  assert(a.maxHp - a.hp > b.maxHp - b.hp);
  assert(g.torch.segments.length + g.torch.rear.length <= TORCH.segments);
  const bullets = [-1, 1].map((sign) =>
    round(g, { friendly: false, radius: 3, pos: { x: 350, y: 297 + sign * 13.5 }, damage: 300 }),
  );
  beam(g, 0.1);
  assert.equal(bullets.filter((s) => s.reflected).length, 1);
  assert(bullets.filter((s) => s.reflected).every((s) => s.damage <= 24));
});

test('all beam branches respect frontal shields, nearer rotated cover and blocked muzzles', () => {
  for (const mode of ['pulse-chamber', 'charge-lens', 'prism-array']) {
    const g = fixture(['cutting-torch', 'burst', 'scatter', mode]);
    const e = target(g, 700);
    const cover = wall(g, 430, 300, 20, 350);
    Body.setAngle(cover, 0.2);
    beam(g, 1);
    beam(g, 0.5, false);
    near(e.hp, e.maxHp);
    const h = fixture(['cutting-torch', 'burst', 'scatter', 'pierce', 'thermal-runaway', mode]);
    const shield = target(h, 400, 300, 'shooter', true),
      behind = target(h, 700);
    shield.facing = -1;
    Body.scale(shield.body, 1, 10);
    beam(h, 1);
    beam(h, 0.5, false);
    assert(shield.hp < shield.maxHp);
    near(behind.hp, behind.maxHp);
    near(h.torch.heat, 0);
    Body.setPosition(g.player, { x: 417, y: 300 });
    beam(g, 1);
    beam(g, 0.5, false);
    near(e.hp, e.maxHp);
  }
});
