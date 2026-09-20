import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseMetadata, hasVerifiedDeployment } from '../scripts/release-metadata.mjs';

test('stable and candidate releases keep distinct publication status', () => {
  assert.deepEqual(releaseMetadata('2.98.0', 'v2.98.0'), {
    tag: 'v2.98.0',
    version: '2.98.0',
    prerelease: false,
  });
  assert.equal(releaseMetadata('2.98.0-rc.1', 'v2.98.0-rc.1').prerelease, true);
});

test('release metadata rejects wrong versions, malformed tags and path traversal', () => {
  for (const tag of [
    undefined,
    'main',
    'v2.98',
    'v2.98.1',
    'v2.98.0-rc.1',
    'v../../secret',
    'v2.98.0;echo bad',
  ])
    assert.throws(() => releaseMetadata('2.98.0', tag));
});

test('publication requires successful deployment of this exact commit from main', () => {
  const good = {
    head_sha: 'a'.repeat(40),
    head_branch: 'main',
    status: 'completed',
    conclusion: 'success',
  };
  assert.equal(hasVerifiedDeployment([good], good.head_sha), true);
  assert.equal(hasVerifiedDeployment([good], 'b'.repeat(40)), false);
  for (const change of [
    { head_branch: 'other' },
    { status: 'in_progress' },
    { conclusion: 'failure' },
    { conclusion: 'cancelled' },
    { conclusion: 'skipped' },
  ])
    assert.equal(hasVerifiedDeployment([{ ...good, ...change }], good.head_sha), false);
  assert.equal(hasVerifiedDeployment([], good.head_sha), false);
});
