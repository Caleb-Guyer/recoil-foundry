import test from 'node:test';
import assert from 'node:assert/strict';
import { drawBossRemaster, drawBossRemasterWarnings } from '../src/boss-remaster-art.ts';
import type { BossRemasterVisual } from '../src/boss-remaster-cues.ts';

type Operation = { op: string; args: number[]; width?: number; cap?: string };
function canvas() {
  const operations: Operation[] = [];
  const text: unknown[][] = [];
  const styles: Record<string, unknown> = { globalAlpha: 1, lineWidth: 1, lineCap: 'round' };
  const stack: Record<string, unknown>[] = [];
  let depth = 0;
  const c = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, key) {
      if (key === 'save')
        return () => {
          stack.push({ ...styles });
          depth++;
        };
      if (key === 'restore')
        return () => {
          assert(stack.length, 'canvas state must be balanced');
          Object.assign(styles, stack.pop());
          depth--;
        };
      if (key === 'fillText' || key === 'strokeText')
        return (...args: unknown[]) => text.push(args);
      if (key === 'setLineDash') return () => {};
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
            args.every(Number.isFinite),
            String(key) + ' must not pass non-finite canvas geometry',
          );
          operations.push({
            op: String(key),
            args,
            width: Number(styles.lineWidth),
            cap: String(styles.lineCap),
          });
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
  return {
    c,
    operations,
    text,
    styles,
    get depth() {
      return depth;
    },
  };
}
const visual = (kind: 'condenser' | 'sorter'): BossRemasterVisual => ({
  kind,
  center: { x: 1400, y: 380 },
  phase: 1,
  stage: 'combat',
  progress: 0.5,
  warnings: [
    {
      kind: 'lane',
      x: 900,
      width: 84,
      top: 50,
      bottom: 740,
      progress: 0.7,
      active: false,
      locked: true,
    },
    { kind: 'lane', x: 1350, width: 430, top: 684, bottom: 740, progress: 1, active: true },
    {
      kind: 'segment',
      from: { x: 64, y: 690 },
      to: { x: 1936, y: 690 },
      width: 100,
      progress: 0.4,
      active: false,
    },
    {
      kind: 'fan',
      from: { x: 1400, y: 380 },
      ends: [
        { x: 1960, y: 600 },
        { x: 260, y: 490 },
      ],
      width: 22,
      progress: 0.9,
      active: false,
      locked: true,
    },
  ],
});

test('warning footprints exactly retain supplied lanes, clipped rays and sweep extents in both effects modes', () => {
  for (const kind of ['condenser', 'sorter'] as const) {
    const state = visual(kind),
      before = structuredClone(state),
      ordinary = canvas(),
      reduced = canvas();
    drawBossRemasterWarnings(ordinary.c, state, false);
    drawBossRemasterWarnings(reduced.c, state, true);
    assert.deepEqual(
      reduced.operations,
      ordinary.operations,
      'Reduced effects must preserve every danger edge and safe gap',
    );
    assert.deepEqual(state, before, 'Drawing must not move or retarget an attack');
    const fills = ordinary.operations.filter((op) => op.op === 'fillRect').map((op) => op.args);
    assert.deepEqual(fills, [
      [858, 50, 84, 690],
      [1135, 684, 430, 56],
    ]);
    assert(
      ordinary.operations.some(
        (op) => op.op === 'lineTo' && op.args[0] === 1936 && op.args[1] === 690,
      ),
    );
    assert(
      ordinary.operations.some(
        (op) => op.op === 'moveTo' && op.args[0] === 64 && op.args[1] === 690,
      ),
    );
    assert(
      ordinary.operations.some((op) => op.op === 'moveTo' && op.width === 100 && op.cap === 'butt'),
    );
    assert(ordinary.operations.some((op) => op.op === 'moveTo' && op.width === 22));
    assert.equal(ordinary.depth, 0);
    assert.equal(ordinary.styles.lineCap, 'round', 'Renderer state belongs to the caller');
    assert.equal(ordinary.text.length, 0);
  }
});

test('startup, phase breaks and destruction are deterministic bounded native art without text or input mutation', () => {
  for (const kind of ['condenser', 'sorter'] as const)
    for (const stage of ['startup', 'transition', 'combat', 'destroyed'] as const)
      for (const progress of [0, 0.25, 0.6, 1])
        for (const effects of [false, true]) {
          const state = { ...visual(kind), stage, progress },
            before = structuredClone(state);
          const out = canvas(),
            second = canvas();
          drawBossRemaster(out.c, state, effects);
          drawBossRemaster(second.c, state, effects);
          assert.deepEqual(out.operations, second.operations);
          assert.deepEqual(state, before);
          assert.equal(out.text.length, 0);
          assert.equal(out.depth, 0);
          assert(out.operations.length < 160, 'A phase beat cannot create unbounded debris');
        }
});

test('expired or malformed presentation cannot leave ghost attacks or invalid canvas geometry', () => {
  const expired = canvas();
  drawBossRemasterWarnings(expired.c, { ...visual('sorter'), stage: 'destroyed' }, false);
  assert.equal(expired.operations.length, 0);
  const invalid = canvas();
  drawBossRemaster(invalid.c, { ...visual('condenser'), center: { x: NaN, y: 10 } }, false);
  assert.equal(invalid.operations.length, 0);
  drawBossRemasterWarnings(
    invalid.c,
    {
      ...visual('condenser'),
      warnings: [
        { kind: 'lane', x: NaN, width: 84, top: 50, bottom: 740, progress: 0.2, active: false },
        { kind: 'lane', x: 200, width: 84, top: 740, bottom: 50, progress: 0.2, active: true },
        {
          kind: 'segment',
          from: { x: 40, y: 80 },
          to: { x: Infinity, y: 100 },
          width: 10,
          progress: 1,
          active: true,
        },
      ],
    },
    true,
  );
  assert.equal(invalid.operations.length, 0);
  assert.equal(invalid.depth, 0);
});
