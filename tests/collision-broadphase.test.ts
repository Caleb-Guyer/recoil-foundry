import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { firstSolid, sweepBox } from '../src/collisions.ts';
import { seeded } from '../src/rules.ts';

test('bounded queries match exhaustive convex sweeps for rotated and moving cover and padded hulls', () => {
  const random = seeded('convex-query-audit');
  const bodies = Array.from({ length: 40 }, () =>
    Matter.Bodies.rectangle(
      random() * 1600,
      random() * 800,
      12 + random() * 150,
      8 + random() * 90,
      { angle: random() * Math.PI },
    ),
  );
  for (let sample = 0; sample < 600; sample++) {
    const body = bodies[sample % bodies.length];
    Matter.Body.setPosition(body, { x: random() * 1600, y: random() * 800 });
    Matter.Body.setAngle(body, random() * Math.PI);
    const from = { x: random() * 2000 - 200, y: random() * 1000 - 100 },
      to = { x: random() * 2000 - 200, y: random() * 1000 - 100 };
    const half = {
      x: sample % 3 === 0 ? 0 : random() * 20,
      y: sample % 3 === 0 ? 0 : random() * 20,
    };
    let expected: ReturnType<typeof firstSolid>;
    for (const b of bodies) {
      const hit = sweepBox(from, to, half, b);
      if (hit && (!expected || hit.t < expected.t)) expected = { ...hit, body: b };
    }
    assert.deepEqual(
      firstSolid(from, to, half, bodies),
      expected,
      'Exact time, normal and nearest body',
    );
  }
});
test('distant geometry never enters the expensive convex vertex projection', () => {
  let projections = 0;
  const bodies = Array.from({ length: 300 }, (_, i) =>
    Matter.Bodies.rectangle(2000 + i * 20, 1500, 12, 12),
  );
  for (const body of bodies) {
    const vertices = body.vertices;
    Object.defineProperty(body, 'vertices', {
      get() {
        projections++;
        return vertices;
      },
    });
  }
  assert.equal(
    firstSolid({ x: 100, y: 100 }, { x: 130, y: 140 }, { x: 7, y: 7 }, bodies),
    undefined,
  );
  assert.equal(projections, 0);
  const near = Matter.Bodies.rectangle(115, 120, 20, 20, { angle: 0.3 });
  assert.equal(
    firstSolid({ x: 100, y: 100 }, { x: 130, y: 140 }, { x: 7, y: 7 }, [...bodies, near])?.body,
    near,
  );
  assert.equal(projections, 0);
});
