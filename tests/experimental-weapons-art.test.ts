import test from 'node:test';
import assert from 'node:assert/strict';
import type { Game, Shot } from '../src/game.ts';
import {
  drawExperimentalWeapon,
  drawExperimentalWeapons,
  drawExperimentalWeaponHud,
} from '../src/experimental-weapons-art.ts';

type Kind = 'bellows' | 'debt-collector' | 'switchjack';
type Operation = { op: string; args: unknown[]; fill: unknown; stroke: unknown; alpha: number };
function canvas() {
  const operations: Operation[] = [],
    styles: Record<string, unknown> = {
      fillStyle: '#fff',
      strokeStyle: '#000',
      globalAlpha: 1,
      lineWidth: 1,
      lineCap: 'butt',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      font: '10px sans-serif',
    },
    original = { ...styles },
    stack: Record<string, unknown>[] = [];
  const c = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, key) {
      if (key === 'save') return () => stack.push({ ...styles });
      if (key === 'restore')
        return () => {
          assert(stack.length, 'unbalanced restore');
          Object.assign(styles, stack.pop());
        };
      if (key in styles) return styles[String(key)];
      return (...args: unknown[]) => {
        assert(args.filter((arg) => typeof arg === 'number').every(Number.isFinite), String(key));
        operations.push({
          op: String(key),
          args,
          fill: styles.fillStyle,
          stroke: styles.strokeStyle,
          alpha: Number(styles.globalAlpha),
        });
      };
    },
    set(_target, key, value) {
      if (key === 'globalAlpha') assert(Number.isFinite(value) && value >= 0 && value <= 1);
      if (key === 'lineWidth') assert(Number.isFinite(value) && value > 0);
      styles[String(key)] = value;
      return true;
    },
  });
  return {
    c,
    operations,
    check() {
      assert.equal(stack.length, 0);
      assert.deepEqual(styles, original);
    },
  };
}
function fixture(kind: Kind) {
  return {
    startingGun: kind,
    time: 10,
    lastShot: 9.97,
    shootAt: 10,
    mods: [],
    mode: 'playing',
    hp: 100,
    player: { position: { x: 200, y: 300 } },
    aim: { x: 800, y: 300 },
    finale: { safe: false },
    escape: null,
    cosmetics: { gun: 'standard' },
    torch: { equipped: false },
    shiftMorphs: { equipped: false },
    massDriver: { equipped: false },
    gun: { shellshock: false },
    experimentalWeapons: {
      kind,
      pressure: 0.6,
      scrapCount: 2,
      debt: 0.7,
      bolt: null as Shot | null,
      flash: 10.1,
      blocked: false,
      holding: true,
      landingPreview: null,
      ventDirection: null,
    },
    lineEnd: (_from: { x: number; y: number }, to: { x: number; y: number }) => ({ ...to }),
  } as unknown as Game;
}

test('three native silhouettes stay distinct, deterministic, state-pure and canvas-balanced', () => {
  const signatures: string[] = [];
  for (const kind of ['bellows', 'debt-collector', 'switchjack'] as const) {
    const g = fixture(kind),
      before = JSON.stringify(g),
      normal = canvas(),
      reduced = canvas();
    assert(drawExperimentalWeapon(normal.c, g, false));
    assert(drawExperimentalWeapon(reduced.c, g, true));
    normal.check();
    reduced.check();
    const again = canvas();
    drawExperimentalWeapon(again.c, g, false);
    assert.deepEqual(again.operations, normal.operations, 'art must follow simulation time only');
    assert.equal(JSON.stringify(g), before, 'drawing must not consume native state');
    signatures.push(JSON.stringify(normal.operations));
    assert(normal.operations.length < 120 && reduced.operations.length < 120);
  }
  assert.equal(new Set(signatures).size, 3);
});

test('beam, morph, shell and mass conversions keep their own existing weapon art', () => {
  const g = fixture('bellows');
  for (const converted of [g.torch, g.shiftMorphs, g.massDriver]) {
    Object.assign(converted, { equipped: true });
    const out = canvas();
    assert.equal(drawExperimentalWeapon(out.c, g, false), false);
    assert.equal(out.operations.length, 0);
    Object.assign(converted, { equipped: false });
  }
  g.gun.shellshock = true;
  assert.equal(drawExperimentalWeapon(canvas().c, g, false), false);
});

test('intake cues are cover-clipped, finite and reduced motion removes their travelling phase', () => {
  const g = fixture('bellows'),
    open = canvas();
  drawExperimentalWeapons(open.c, g, true);
  const before = JSON.stringify(g);
  g.time += 0.27;
  const later = canvas();
  drawExperimentalWeapons(later.c, g, true);
  assert.deepEqual(later.operations, open.operations);
  assert.equal(open.operations.filter((op) => op.op === 'translate').length, 5);
  g.lineEnd = (from) => ({ ...from });
  const covered = canvas();
  drawExperimentalWeapons(covered.c, g, false);
  assert.equal(covered.operations.filter((op) => op.op === 'translate').length, 0);
  open.check();
  later.check();
  covered.check();
  assert.equal(JSON.parse(before).experimentalWeapons.pressure, g.experimentalWeapons.pressure);
});

function preview(ready = true) {
  return {
    from: { x: 200, y: 300 },
    to: { x: 420, y: 280 },
    half: { x: 11, y: 19 },
    ready,
    reason: ready ? 'ready' : 'obstructed',
    remainingLife: 0.6,
    distance: 221,
    launchCooldown: 0.4,
    needsRelease: false,
  };
}
function copy(out: ReturnType<typeof canvas>) {
  return out.operations.filter((op) => op.op === 'fillText').map((op) => String(op.args[0]));
}

test('Switchjack shows full landing hull and live unsafe route before any failed press', () => {
  const g = fixture('switchjack');
  Object.assign(g.experimentalWeapons, {
    bolt: { pos: { x: 420, y: 280 }, life: 1.1 } as Shot,
    landingPreview: preview(),
  });
  const live = canvas();
  drawExperimentalWeapons(live.c, g, true);
  assert(
    live.operations.some((op) => op.op === 'strokeRect' && String(op.args) === '409,261,22,38'),
  );
  assert(live.operations.some((op) => op.op === 'lineTo' && op.args[0] === 420));
  const hud = canvas();
  g.shootAt = g.time + 0.4;
  drawExperimentalWeaponHud(hud.c, g, 320, 220);
  assert(copy(hud).includes('CLEAR · 0.6s'), 'remaining life uses shared preview, not shot.life');
  assert(copy(hud).includes('Tap: relocate · spends bolt'));
  assert(
    !copy(hud).some((text) => text.includes('CYCLING')),
    'next-bolt recovery cannot disable relocation',
  );
  Object.assign(g.experimentalWeapons, { blocked: false, landingPreview: preview(false) });
  const blocked = canvas();
  drawExperimentalWeapons(blocked.c, g, true);
  drawExperimentalWeaponHud(blocked.c, g, 320, 220);
  assert(blocked.operations.some((op) => op.stroke === '#e5b58b'));
  assert(copy(blocked).includes('BLOCKED · 0.6s'));
  assert(copy(blocked).includes('Route or landing blocked'));
  live.check();
  hud.check();
  blocked.check();
});

test('native HUD is absent in menus, death, extraction and safe cinematics', () => {
  const g = fixture('debt-collector');
  for (const mode of ['title', 'paused', 'dead', 'upgrade', 'won'] as const) {
    g.mode = mode;
    const out = canvas();
    drawExperimentalWeapons(out.c, g, false);
    drawExperimentalWeaponHud(out.c, g, 640, 360);
    assert.equal(out.operations.length, 0);
  }
  g.mode = 'playing';
  Object.assign(g.finale, { safe: true });
  const safe = canvas();
  drawExperimentalWeaponHud(safe.c, g, 640, 360);
  assert.equal(safe.operations.length, 0);
});

test('Bellows HUD distinguishes charging through recovery from a ready release', () => {
  const g = fixture('bellows');
  Object.assign(g.experimentalWeapons, { pressure: 1 });
  g.shootAt = g.time + 0.3;
  const recovering = canvas();
  drawExperimentalWeaponHud(recovering.c, g, 640, 360);
  const recoveryCopy = copy(recovering);
  assert(recoveryCopy.includes('Cycling · hold to charge'));
  assert(recoveryCopy.includes('CYCLING · SCRAP 2/4'));
  assert(!recoveryCopy.includes('Full charge · release to blast'));
  g.shootAt = g.time;
  const ready = canvas();
  drawExperimentalWeaponHud(ready.c, g, 640, 360);
  assert(copy(ready).includes('Full charge · release to blast'));
  assert(copy(ready).includes('FULL · SCRAP 2/4'));
  recovering.check();
  ready.check();
});

test('Switchjack reads shared validation once per draw, distinguishes release, geometry and next launch', () => {
  const g = fixture('switchjack'),
    state = { ...preview(), needsRelease: true },
    before = JSON.stringify(g);
  let reads = 0;
  Object.defineProperty(g.experimentalWeapons, 'landingPreview', {
    configurable: true,
    get: () => {
      reads++;
      return state;
    },
  });
  for (const draw of [
    (out: ReturnType<typeof canvas>) => drawExperimentalWeapon(out.c, g, true),
    (out: ReturnType<typeof canvas>) => drawExperimentalWeapons(out.c, g, true),
    (out: ReturnType<typeof canvas>) => drawExperimentalWeaponHud(out.c, g, 320, 220),
  ]) {
    const out = canvas(),
      prior = reads;
    draw(out);
    assert.equal(reads - prior, 1);
    out.check();
  }
  const release = canvas();
  drawExperimentalWeaponHud(release.c, g, 320, 220);
  assert(copy(release).includes('Release, then tap to relocate'));
  for (const [reason, hint] of [
    ['too-close', 'Let the bolt travel farther'],
    ['out-of-range', 'Move closer to the bolt'],
    ['boundary', 'Landing outside room'],
    ['crusher', 'Landing in crusher sweep'],
  ]) {
    Object.assign(state, { ready: false, reason });
    const out = canvas();
    drawExperimentalWeaponHud(out.c, g, 320, 220);
    assert(copy(out).includes(hint));
    out.check();
  }
  Object.defineProperty(g.experimentalWeapons, 'landingPreview', {
    value: null,
    configurable: true,
    writable: true,
  });
  assert.equal(JSON.stringify(g), before, 'drawing only consumed copied preview data');
  g.shootAt = g.time + 0.23;
  const cycling = canvas();
  drawExperimentalWeaponHud(cycling.c, g, 320, 220);
  assert(copy(cycling).includes('CYCLING 0.3s'));
  assert(copy(cycling).includes('Wait to launch the next bolt'));
  cycling.check();
});

test('Debt empty, small, near-full and paid kicks communicate distinct pressure and direction', () => {
  const g = fixture('debt-collector');
  for (const [debt, hint] of [
    [0, 'Hold fire to bank recoil'],
    [0.1, 'Release for a small kick'],
    [0.9, 'Release · auto-vent at full'],
  ] as const) {
    Object.assign(g.experimentalWeapons, { debt });
    const out = canvas();
    drawExperimentalWeaponHud(out.c, g, 320, 220);
    drawExperimentalWeapons(out.c, g, true);
    assert(copy(out).includes(hint));
    assert.equal(out.operations.filter((op) => op.op === 'translate').length, debt ? 1 : 0);
    out.check();
  }
  g.mods.push('gimbal-mount');
  const steered = canvas();
  drawExperimentalWeapons(steered.c, g, true);
  assert.equal(steered.operations.length, 0, 'Gimbal must not promise an opposite-aim kick');
  Object.assign(g.experimentalWeapons, { debt: 0, ventDirection: { x: 0, y: -1 } });
  const paid = canvas();
  drawExperimentalWeapons(paid.c, g, true);
  drawExperimentalWeaponHud(paid.c, g, 320, 220);
  assert(paid.operations.some((op) => op.op === 'rotate' && op.args[0] === -Math.PI / 2));
  assert(copy(paid).includes('VENTED'));
  steered.check();
  paid.check();
});

test('compact HUD stays within its original panel at narrow widths without render mutations', () => {
  for (const width of [180, 240, 320])
    for (const kind of ['bellows', 'debt-collector', 'switchjack'] as const) {
      const g = fixture(kind);
      Object.assign(g.experimentalWeapons, {
        landingPreview: kind === 'switchjack' ? preview(false) : null,
      });
      const before = JSON.stringify(g),
        out = canvas();
      drawExperimentalWeaponHud(out.c, g, width, 220);
      for (const op of out.operations.filter((op) => op.op === 'fillText')) {
        assert(Number(op.args[1]) >= 12 && Number(op.args[1]) <= width - 12);
        assert(Number(op.args[3]) > 0 && Number(op.args[3]) <= width - 24);
        assert(!String(op.args[0]).includes('jump'));
      }
      assert.equal(JSON.stringify(g), before);
      out.check();
    }
});
