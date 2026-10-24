import test from 'node:test';
import assert from 'node:assert/strict';
import { DamageControl, DAMAGE_RECOVERY } from '../src/damage-control.ts';
import {
  DAMAGE_IMPACT_TIME,
  damageFeedbackState,
  drawDamageFeedback,
  showDamageFeedback,
} from '../src/damage-feedback-art.ts';
import { Game, type Mode } from '../src/game.ts';
import { Renderer } from '../src/render.ts';

function hit(direction: { x: number; y: number } | undefined = { x: 1, y: 0 }) {
  const control = new DamageControl();
  return control.record({
    at: 1,
    elapsed: 4,
    hpBefore: 100,
    hpAfter: 82,
    player: { x: 500, y: 400 },
    cause: { type: 'shot', enemy: 'shooter' },
    direction,
  })!;
}
function canvas() {
  const strokes: { color: unknown; alpha: number; lineWidth: number; path: unknown[] }[] = [];
  const fills: { color: unknown; args: number[] }[] = [];
  const transforms: { type: string; args: number[] }[] = [];
  let path: unknown[] = [],
    matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const state: Record<string, unknown> = { globalAlpha: 1, lineWidth: 1 };
  const stack: Record<string, unknown>[] = [];
  const surface = {
    width: 1280,
    height: 720,
    getBoundingClientRect: () => ({ width: 1280, height: 720 }),
  };
  const target = {
    canvas: surface,
    beginPath() {
      path = [];
    },
    moveTo(...args: number[]) {
      path.push(['moveTo', ...args]);
    },
    lineTo(...args: number[]) {
      path.push(['lineTo', ...args]);
    },
    arc(...args: number[]) {
      path.push(['arc', ...args]);
    },
    roundRect(...args: number[]) {
      path.push(['roundRect', ...args]);
    },
    stroke() {
      strokes.push({
        color: state.strokeStyle,
        alpha: Number(state.globalAlpha),
        lineWidth: Number(state.lineWidth),
        path: [...path],
      });
    },
    fillRect(...args: number[]) {
      fills.push({ color: state.fillStyle, args });
    },
    save() {
      stack.push({ ...state });
    },
    restore() {
      const old = stack.pop();
      if (old) {
        for (const k of Object.keys(state)) delete state[k];
        Object.assign(state, old);
      }
    },
    translate(...args: number[]) {
      transforms.push({ type: 'translate', args });
    },
    rotate(...args: number[]) {
      transforms.push({ type: 'rotate', args });
    },
    scale(...args: number[]) {
      transforms.push({ type: 'scale', args });
    },
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
      matrix = { a, b, c, d, e, f };
    },
    getTransform() {
      return { ...matrix };
    },
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: (s: string) => ({ width: s.length * 7 }),
    getLineDash: () => [],
  };
  const ctx = new Proxy(target, {
    get: (t, k) => (k in t ? Reflect.get(t, k) : k in state ? state[String(k)] : () => {}),
    set: (_t, k, v) => {
      state[String(k)] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return {
    ctx,
    surface: Object.assign(surface, { getContext: () => ctx }) as unknown as HTMLCanvasElement,
    strokes,
    fills,
    transforms,
    state,
    clear() {
      strokes.length = fills.length = transforms.length = 0;
    },
  };
}
function fixture() {
  const g = new Game();
  g.start('damage-feedback');
  return g;
}

test('accepted hit feedback uses actual direction and ends with the unchanged protection window', () => {
  const h = hit();
  assert.equal(DAMAGE_RECOVERY, 0.75);
  assert.equal(damageFeedbackState(h, 0.99), null);
  assert.equal(damageFeedbackState(h, 1 + DAMAGE_RECOVERY), null);
  assert.equal(damageFeedbackState(h, Infinity), null);
  assert.equal(damageFeedbackState(null, 1), null);
  assert.deepEqual(damageFeedbackState(h, 1)!.direction, { x: 1, y: 0 });
  assert(damageFeedbackState(h, 1.1)!.impact > 0);
  assert.equal(damageFeedbackState(h, 1 + DAMAGE_IMPACT_TIME)!.impact, 0);
  assert(damageFeedbackState(h, 1.7)!.recovery > 0);
  for (const reduced of [false, true]) {
    let recovery = 1,
      impact = 1;
    for (let frame = 0; frame < 75; frame++) {
      const state = damageFeedbackState(h, 1 + frame / 100, reduced)!;
      assert(
        state.recovery <= recovery && state.impact <= impact,
        'One hold/fade cannot flicker or pulse',
      );
      recovery = state.recovery;
      impact = state.impact;
    }
  }
});

test('unknown origins and falls receive a recovery outline without invented directional marks', () => {
  const h = hit(undefined);
  // Explicit undefined triggers the helper default; record a truly unknown origin separately.
  const model = new DamageControl();
  const unknown = model.record({
    at: 1,
    elapsed: 1,
    hpBefore: 100,
    hpAfter: 90,
    player: { x: 500, y: 400 },
    cause: { type: 'unknown' },
  })!;
  const fall = model.record({
    at: 2,
    elapsed: 2,
    hpBefore: 90,
    hpAfter: 80,
    player: { x: 500, y: 400 },
    origin: { x: 0, y: 0 },
    direction: { x: -1, y: -1 },
    cause: { type: 'fall' },
  })!;
  for (const value of [unknown, fall]) {
    const state = damageFeedbackState(value, value.at)!,
      out = canvas();
    assert(state.recovery > 0);
    assert.equal(state.impact, 0);
    assert.equal(state.direction, null);
    drawDamageFeedback(out.ctx, value, value.at, { x: 600, y: 400 }, 1);
    assert(out.strokes.some((s) => s.color === '#ead6bc'));
    assert(!out.strokes.some((s) => s.color === '#e79a87'));
    assert(!out.transforms.some((t) => t.type === 'rotate'));
  }
  assert.equal(damageFeedbackState({ ...h, damage: 0 }, 1), null);
  assert.equal(damageFeedbackState({ ...h, direction: { x: NaN, y: 1 } }, 1)!.impact, 0);
});

test('all bearings use the copied incoming direction and every scale keeps a bounded separated silhouette', () => {
  for (const direction of [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: 1 },
  ])
    for (const scale of [0.55, 1, 1.8]) {
      const h = hit(direction),
        out = canvas();
      drawDamageFeedback(out.ctx, h, 1.1, { x: 720, y: 340 }, scale, false, 1);
      assert.deepEqual(out.transforms[0], { type: 'translate', args: [720, 340] });
      assert.equal(
        out.transforms.find((t) => t.type === 'rotate')!.args[0],
        Math.atan2(direction.y, direction.x),
      );
      assert.equal(out.strokes.length, 4);
      assert(out.strokes.every((s) => Number.isFinite(s.alpha) && s.alpha > 0 && s.alpha <= 0.86));
      assert(out.strokes.every((s) => s.lineWidth * scale <= 5.001));
      assert(out.strokes.every((s) => JSON.stringify(s.path).length < 500));
    }
});

test('reduced effects and dense combat retain identical cue geometry with no wash, text, randomness or gameplay writes', () => {
  const h = hit(),
    before = JSON.stringify(h),
    normal = canvas(),
    reduced = canvas();
  const random = Math.random;
  Math.random = () => {
    throw Error('Damage art consumed RNG');
  };
  try {
    drawDamageFeedback(normal.ctx, h, 1.1, { x: 500, y: 400 }, 0.9, false, 0);
    drawDamageFeedback(reduced.ctx, h, 1.1, { x: 500, y: 400 }, 0.9, true, 1);
  } finally {
    Math.random = random;
  }
  assert.deepEqual(
    normal.strokes.map((s) => s.path),
    reduced.strokes.map((s) => s.path),
  );
  assert.deepEqual(normal.transforms, reduced.transforms);
  assert.equal(normal.fills.length + reduced.fills.length, 0);
  assert.equal(JSON.stringify(h), before);
  assert.equal(normal.state.globalAlpha, 1);
  assert.equal(reduced.state.globalAlpha, 1);
  for (const scale of [0, NaN, Infinity, -1]) {
    const out = canvas();
    drawDamageFeedback(out.ctx, h, 1, { x: 1, y: 1 }, scale);
    assert.equal(out.strokes.length, 0);
  }
});

test('real Game accepted damage, rejected followups and actual HP loss drive the production Renderer', () => {
  const g = fixture(),
    out = canvas(),
    r = new Renderer(out.surface, g);
  r.reduced = true;
  r.reset();
  g.damagePlayer(18, { x: 600, y: 700 }, { type: 'shot', enemy: 'shooter' });
  const first = g.damageControl.lastHit!;
  assert.equal(first.damage, 18);
  assert.equal(g.hp, 82);
  g.damagePlayer(18, { x: 0, y: 700 }, { type: 'shot', enemy: 'flyer' });
  assert.equal(g.damageControl.lastHit, first);
  assert.equal(g.hp, 82);
  r.draw(16);
  assert(out.strokes.some((s) => s.color === '#ead6bc'));
  assert(out.strokes.some((s) => s.color === '#e79a87'));
  assert(
    !out.fills.some((s) => typeof s.color === 'string' && s.color.startsWith('rgba(222,64,44,')),
  );
  out.clear();
  g.time = DAMAGE_RECOVERY;
  r.draw(32);
  assert(!out.strokes.some((s) => s.color === '#ead6bc' || s.color === '#e79a87'));
  g.hp = 4;
  g.damagePlayer(18, undefined, { type: 'contact', enemy: 'runner' });
  assert.equal(g.damageControl.lastHit!.damage, 4, 'Overkill presentation uses HP actually lost');
  assert.equal(g.mode, 'dead');
});

test('a fast real reward transition retains the protection outline after the new room clears hit metadata', () => {
  const g = fixture(),
    out = canvas(),
    r = new Renderer(out.surface, g);
  // A normal continued Campaign without a Factory-event overlay keeps this
  // renderer fixture independent of the blackout's separate DOM light buffer.
  g.start('damage-transition', {
    version: 6,
    seed: 'damage-transition',
    stage: 0,
    hp: 100,
    mods: [],
    kills: 0,
    elapsed: 0,
  });
  r.reduced = true;
  g.time = 2;
  g.damagePlayer(18, { x: 600, y: 700 }, { type: 'shot', enemy: 'shooter' });
  const hurtAt = g.hurtAt;
  assert(g.damageControl.lastHit);
  g.enemies = [];
  g.waves.clear();
  g.clear = true;
  g.openReward();
  assert.equal(g.mode, 'upgrade');
  assert.equal(g.time, 2, 'The reward screen pauses simulation time');
  g.chooseMod(g.offers[0].id);
  assert.equal(g.stage, 1);
  assert.equal(g.mode, 'playing');
  assert.equal(g.damageControl.lastHit, null, 'The new room owns no prior impact metadata');
  assert.equal(g.hurtAt, hurtAt, 'The unchanged simulation retains the real protection window');
  const state = damageFeedbackState(null, g.time, true, g.hurtAt)!;
  assert(state.recovery > 0);
  assert.equal(state.impact, 0);
  assert.equal(state.direction, null);
  r.reset();
  r.draw(16);
  assert(out.strokes.some((s) => s.color === '#ead6bc'));
  assert(!out.strokes.some((s) => s.color === '#e79a87'));
  const hp = g.hp;
  g.damagePlayer(18, { x: 500, y: 700 }, { type: 'shot' });
  assert.equal(g.hp, hp, 'The visible outline corresponds to actual rejected damage');
  assert.equal(g.damageControl.lastHit, null);
  out.clear();
  g.time = hurtAt + DAMAGE_RECOVERY;
  r.draw(32);
  assert(!out.strokes.some((s) => s.color === '#ead6bc' || s.color === '#e79a87'));
});

test('a zero-loss protection gate shows recovery without fabricated damage or direction', () => {
  const g = fixture(),
    out = canvas(),
    r = new Renderer(out.surface, g);
  r.reduced = true;
  g.time = 3;
  g.damagePlayer(0, { x: 700, y: 700 }, { type: 'shot' });
  assert.equal(g.hp, 100);
  assert.equal(g.damageControl.lastHit, null);
  assert.equal(g.damageControl.summary().hits, 0);
  assert.equal(g.hurtAt, 3);
  r.draw(16);
  assert(out.strokes.some((s) => s.color === '#ead6bc'));
  assert(!out.strokes.some((s) => s.color === '#e79a87'));
  assert.equal(damageFeedbackState(null, 3, false, 4), null, 'A future gate cannot grant a visual');
  assert.equal(damageFeedbackState(null, 3, false, NaN), null);
});

test('paused, title, workshop, authored photos and finale safety suppress feedback while boss combat permits it', () => {
  const g = fixture(),
    out = canvas(),
    r = new Renderer(out.surface, g);
  r.reduced = true;
  g.damagePlayer(18, { x: 500, y: 700 }, { type: 'shot' });
  for (const mode of ['paused', 'title', 'upgrade', 'dead', 'won'] as Mode[]) {
    g.mode = mode;
    assert.equal(showDamageFeedback(g), false);
    out.clear();
    r.draw(16);
    assert(!out.strokes.some((s) => s.color === '#ead6bc' || s.color === '#e79a87'));
  }
  g.mode = 'playing';
  assert(showDamageFeedback(g));
  assert.equal(showDamageFeedback(g, true), false);
  out.clear();
  r.draw(20, { camera: { x: 0, y: -160 }, scale: 0.32, player: true });
  assert(!out.strokes.some((s) => s.color === '#ead6bc' || s.color === '#e79a87'));
  g.startWorkshop([]);
  assert.equal(showDamageFeedback(g), false);
  g.start('RF-C99-damage-finale', {
    version: 6,
    seed: 'RF-C99-damage-finale',
    stage: 19,
    hp: 100,
    mods: [],
    kills: 0,
    elapsed: 0,
  });
  assert(g.finale.cinema);
  assert.equal(showDamageFeedback(g), false);
  g.finale.cinema!.state = 'duel';
  assert(showDamageFeedback(g), 'Live boss combat keeps real recovery visible');
});
