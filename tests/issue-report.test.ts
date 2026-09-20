import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import { dailyForDate } from '../src/daily.ts';
import { testCheckpoint } from '../src/practice.ts';
import { issueDetails, issueDraftUrl } from '../src/issue-report.ts';
import { GAME_VERSION } from '../src/version.ts';

test('report includes run details but title omits previous run information', () => {
  const g = new Game();
  g.startTest(testCheckpoint('REPORT-TEST', 2));
  const details = issueDetails(g);
  assert.ok(details.includes(`Version: ${GAME_VERSION}`));
  assert.match(details, /Mode: Preset test/);
  assert.match(details, /Seed: "REPORT-TEST"/);
  assert.match(details, /Room: 3 \/ docks/);
  assert.match(details, /Gun: magnum, rapid/);
  g.setMode('title');
  assert.match(issueDetails(g), /Mode: Title/);
  assert.doesNotMatch(issueDetails(g), /REPORT-TEST|Room:|Gun:|Seed:/);
});

test('Daily and campaign reports identify their modes without changing the run', () => {
  const g = new Game();
  g.start(dailyForDate('2026-09-20')!.seed);
  const before = [g.mode, g.seed, g.hp, g.time];
  assert.match(issueDetails(g), /Mode: Daily/);
  assert.deepEqual([g.mode, g.seed, g.hp, g.time], before);
  g.start('NORMAL');
  assert.match(issueDetails(g), /Mode: Campaign/);
});

test('draft encodes text into a fixed GitHub destination and bounds its length', () => {
  const body = 'An issue &labels=admin\n# <script>alert("x")</script> + ?seed=secret 🚂';
  const url = new URL(issueDraftUrl(body));
  assert.equal(url.origin, 'https://github.com');
  assert.equal(url.pathname, '/Caleb-Guyer/recoil-foundry/issues/new');
  assert.equal(url.searchParams.get('body'), body);
  assert.equal(url.searchParams.has('labels'), false);
  assert.equal(new URL(issueDraftUrl('x'.repeat(7000))).searchParams.get('body')!.length, 6000);
});
