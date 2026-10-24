import test from 'node:test';
import assert from 'node:assert/strict';
import type { Game } from '../src/game.ts';
import type { Vec } from '../src/rules.ts';
import { finaleAirliftStaging, finaleCinemaCamera } from '../src/finale-cinema-art.ts';

const cases = [false, true].flatMap((mirrored) =>
  [100, 1900].flatMap((x) =>
    [100, 680].map((y) => ({
      mirrored,
      wreck: { x, y },
      actual: { x: mirrored ? 2000 - x : x, y },
    })),
  ),
);
function finite(value: unknown) {
  if (typeof value === 'number') assert(Number.isFinite(value));
  else if (typeof value === 'object' && value !== null)
    for (const child of Object.values(value)) finite(child);
}
function movie(wreck: Vec, mirrored: boolean, clock: number) {
  // The camera only reads these values; no physics or Canvas is needed here.
  return {
    level: { mirrored },
    finale: { wreck, cinema: { active: true, state: 'airlift', clock } },
  } as unknown as Game;
}

test('edge and airborne wrecks land before the pilot is lifted at the actual pickup', () => {
  for (const { wreck } of cases) {
    const original = { ...wreck };
    assert.deepEqual(finaleAirliftStaging(wreck, 0).wreck, wreck);
    let previous = finaleAirliftStaging(wreck, 0);
    for (let frame = 0; frame <= 480; frame++) {
      const time = frame / 60;
      const pose = finaleAirliftStaging(wreck, time);
      finite(pose);
      assert.equal(pose.wreck.x, wreck.x);
      assert(pose.wreck.y >= previous.wreck.y);
      assert(pose.wreck.y <= 685);
      if (time >= 1.2) assert.equal(pose.wreck.y, 685);
      if (pose.pilot.visible) {
        assert.equal(pose.pilot.x, wreck.x);
        if (previous.pilot.visible)
          assert(Math.hypot(pose.pilot.x - previous.pilot.x, pose.pilot.y - previous.pilot.y) < 8);
      }
      if (pose.cable.visible) {
        assert.equal(pose.cable.x, pose.pilot.x);
        assert.equal(pose.cable.x, pose.plane.x);
      }
      if (time >= 3 && pose.pilot.visible) assert.equal(pose.pilot.y, pose.cable.y + 18);
      previous = pose;
    }
    assert.deepEqual(wreck, original, 'art must not modify the defeat position');
  }
});

test('airlift acting is continuous at landing, latch, boarding, relocation and touchdown', () => {
  const epsilon = 1e-5;
  for (const { wreck } of cases) {
    for (const boundary of [1.2, 3, 4.4, 5.4, 7.3]) {
      const before = finaleAirliftStaging(wreck, boundary - epsilon);
      const after = finaleAirliftStaging(wreck, boundary + epsilon);
      for (const key of ['wreck', 'plane', 'pilot', 'cable', 'siege', 'focus'] as const)
        assert(
          Math.hypot(after[key].x - before[key].x, after[key].y - before[key].y) < 0.1,
          key + ' teleports at ' + boundary,
        );
    }
    const boarded = finaleAirliftStaging(wreck, 4.4 - epsilon);
    assert(boarded.pilot.visible);
    assert(boarded.pilot.y - 18 >= boarded.plane.y - 49);
    assert(boarded.pilot.y + 21 <= boarded.plane.y + 46);
    assert.equal(boarded.pilot.x, boarded.plane.x);
    assert.equal(finaleAirliftStaging(wreck, 4.4).pilot.visible, false);
    // The aircraft only starts crossing the city after the pilot is inside.
    assert.equal(finaleAirliftStaging(wreck, 4.4).plane.x, wreck.x);
  }
});

test('the airlift delivers a complete Siege frame to the combat spawn', () => {
  for (const { wreck } of cases) {
    for (const time of [7.3, 8]) {
      const { siege, focus } = finaleAirliftStaging(wreck, time);
      assert(siege.visible);
      assert.equal(siege.drop, 1);
      assert.deepEqual({ x: siege.x, y: siege.y }, { x: 1300, y: 665 });
      assert.equal(focus.x, 1300);
    }
  }
});

test('the cinematic camera tracks the same pickup and drop in mirrored arenas', () => {
  for (const { wreck, actual, mirrored } of cases) {
    for (const time of [0, 1.2, 3, 4.4, 4.9, 5.4, 7.3, 8]) {
      const g = movie(actual, mirrored, time);
      const before = JSON.stringify(g);
      const pose = finaleAirliftStaging(wreck, time);
      assert.deepEqual(finaleCinemaCamera(g), {
        x: mirrored ? 2000 - pose.focus.x : pose.focus.x,
        y: pose.focus.y,
      });
      assert.equal(JSON.stringify(g), before);
    }
  }
});
