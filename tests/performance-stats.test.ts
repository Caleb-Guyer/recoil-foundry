import test from 'node:test';
import assert from 'node:assert/strict';
import { TimingStats } from '../src/performance-stats.ts';
import { Game } from '../src/game.ts';
import {
  STABILITY_CASES,
  startStabilityCase,
  stabilityInput,
  stabilityCounts,
  assertFiniteWorld,
} from '../src/stability-scenarios.ts';
import { validBuild } from '../src/rules.ts';

test('timing summaries count real stalls and tolerate unavailable or invalid measurements', () => {
  const stats = new TimingStats();
  assert.equal(stats.report().meanMs, null);
  for (const value of [NaN, Infinity, -1]) stats.add(value);
  for (let i = 0; i < 95; i++) stats.add(16.666);
  for (let i = 0; i < 4; i++) stats.add(34);
  stats.add(800);
  const report = stats.report();
  assert.equal(report.samples, 100);
  assert.equal(report.p50Ms, 16.7);
  assert.equal(report.p95Ms, 16.7);
  assert.equal(report.p99Ms, 34);
  assert.equal(report.maxMs, 800);
  assert.equal(report.over20, 5);
  assert.equal(report.over34, 5);
  assert.equal(report.over50, 1);
  for (let i = 0; i < 100000; i++) stats.add(5);
  assert.equal(stats.report().p95Ms, 5);
});

test('every browser stress preset uses a legal isolated build and resets the real physics world', () => {
  const g = new Game();
  let saves = 0;
  g.onCheckpoint = () => saves++;
  for (let index = 0; index < STABILITY_CASES.length; index++) {
    startStabilityCase(g, index);
    assert(g.testRun);
    assert(validBuild(g.mods), STABILITY_CASES[index].id);
    if (STABILITY_CASES[index].id === 'portals') assert(g.portals.linked);
    const baseline = stabilityCounts(g);
    for (let i = 0; i < 180; i++) g.tick(1 / 60, stabilityInput(g, i));
    assertFiniteWorld(g);
    g.save();
    startStabilityCase(g, index);
    assert.deepEqual(stabilityCounts(g), baseline);
  }
  assert.equal(saves, 0);
});
