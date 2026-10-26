import test from 'node:test';
import assert from 'node:assert/strict';
import type { Game } from '../src/game.ts';
import { drawReclaimerArsenal } from '../src/reclaimer-arsenal-art.ts';

function canvas() {
  const operations: { op: string; args: number[]; width: number }[] = [];
  const text: unknown[][] = [];
  const styles: Record<string, unknown> = { globalAlpha: 1, lineWidth: 1, lineCap: 'round' };
  const stack: Record<string, unknown>[] = [];
  const c = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, key) {
      if (key === 'save') return () => stack.push({ ...styles });
      if (key === 'restore')
        return () => {
          assert(stack.length, 'canvas state must stay balanced');
          Object.assign(styles, stack.pop());
        };
      if (key === 'fillText' || key === 'strokeText')
        return (...args: unknown[]) => text.push(args);
      if (key === 'createRadialGradient' || key === 'createLinearGradient')
        return () => ({ addColorStop() {} });
      if (
        [
          'moveTo',
          'lineTo',
          'arc',
          'fillRect',
          'strokeRect',
          'translate',
          'rotate',
          'scale',
        ].includes(String(key))
      )
        return (...args: number[]) => {
          assert(
            args.every((n) => typeof n === 'boolean' || Number.isFinite(n)),
            String(key) + ' must be finite',
          );
          operations.push({ op: String(key), args, width: Number(styles.lineWidth) });
        };
      if (key in styles) return styles[String(key)];
      return () => {};
    },
    set(_target, key, value) {
      if (key === 'globalAlpha') assert(Number.isFinite(value) && value >= 0 && value <= 1);
      if (key === 'lineWidth') assert(Number.isFinite(value) && value > 0);
      styles[String(key)] = value;
      return true;
    },
  });
  return { c, operations, text, stack };
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const next of Object.values(value)) freeze(next);
  }
  return value;
}
function fixture(dash: string, bomb: string, core: string, fallen: boolean) {
  return {
    mode: 'playing',
    time: 8,
    overtime: false,
    finale: {
      phase: 1,
      enemy: { hp: 100, body: { position: { x: 1100, y: 640 } } },
      cinema: {
        combat: true,
        arsenal: {
          active: true,
          dash: {
            state: dash,
            left: 0.35,
            duration: 0.9,
            from: { x: 500, y: 620 },
            to: { x: 900, y: 700 },
            trail: [
              { x: 520, y: 624 },
              { x: 550, y: 630 },
            ],
          },
          flight: { x: 1050, y: 200, direction: 1, time: 1.5 },
          bombs: [
            {
              pos: { x: 850, y: 480 },
              target: { x: 900, y: 722 },
              radius: 78,
              state: bomb,
              left: 0.4,
              duration: 1.7,
              age: 0.2,
            },
          ],
          armor: {
            hp: 20,
            maxHp: 100,
            plates: 2,
            exposedLeft: core === 'active' ? 2 : 0,
            exposedDuration: 4,
            flash: 0,
          },
          core: {
            angle: 1,
            left: 0.4,
            duration: 1.2,
            state: core,
            direction: -1,
            sweep: 1.1,
            origin: { x: 1100, y: 640 },
            segments: [{ from: { x: 1100, y: 640 }, to: { x: 820, y: 708 } }],
          },
          collapses: [
            { rect: { x: 600, y: 470, w: 240, h: 24 }, left: 0.7, duration: 2.2, fallen, age: 0.3 },
          ],
        },
      },
    },
  } as unknown as Game;
}

test('all arsenal warning and active states are read-only, finite and text-free at both effects settings', (t) => {
  t.mock.method(Math, 'random', () => {
    throw new Error('Rendering must not consume simulation randomness');
  });
  for (const reduced of [false, true])
    for (const dash of ['warning', 'dash', 'recover'])
      for (const bomb of ['warning', 'falling', 'blast'])
        for (const core of ['warning', 'active'])
          for (const fallen of [false, true]) {
            const g = freeze(fixture(dash, bomb, core, fallen));
            const before = JSON.stringify(g);
            const ctx = canvas();
            drawReclaimerArsenal(ctx.c, g, reduced);
            assert.equal(ctx.stack.length, 0);
            assert.equal(ctx.text.length, 0, 'combat tells cannot introduce caption clutter');
            assert(ctx.operations.length > 0);
            assert.equal(
              JSON.stringify(g),
              before,
              'painting cannot advance warnings or mutate attacks',
            );
            if (bomb !== 'blast')
              assert(
                ctx.operations.some(
                  (op) =>
                    op.op === 'arc' &&
                    op.args[0] === 900 &&
                    op.args[1] === 722 &&
                    op.args[2] === 78,
                ),
                'the visible bomb boundary must match the controller damage radius',
              );
            if (core === 'active')
              assert(
                ctx.operations.some(
                  (op) =>
                    op.op === 'lineTo' &&
                    op.args[0] === 820 &&
                    op.args[1] === 708 &&
                    op.width === 10,
                ),
                'the ten-pixel core beam must end at the exact terrain-clipped collision point',
              );
          }
});

test('old fights, noncombat scenes and the title draw no Arsenal overlays', () => {
  const cases = [
    fixture('warning', 'warning', 'warning', false),
    fixture('dash', 'falling', 'active', false),
    fixture('recover', 'blast', 'active', true),
  ];
  for (let n = 0; n < cases.length; n++) {
    const g = cases[n];
    if (n === 0) Object.assign(g.finale.cinema!.arsenal, { active: false });
    if (n === 1) Object.assign(g.finale.cinema!, { combat: false });
    if (n === 2) g.mode = 'title';
    const ctx = canvas();
    drawReclaimerArsenal(ctx.c, g);
    assert.equal(ctx.operations.length, 0);
    assert.equal(ctx.stack.length, 0);
  }
});
