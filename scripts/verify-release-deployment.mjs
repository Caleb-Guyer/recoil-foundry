import { readFileSync } from 'node:fs';
import { hasVerifiedDeployment } from './release-metadata.mjs';

const sha = process.argv[2];
const data = JSON.parse(readFileSync(0, 'utf8'));
if (!/^[0-9a-f]{40}$/.test(sha ?? '') || !hasVerifiedDeployment(data.workflow_runs ?? [], sha))
  throw new Error('Publish only after this exact commit has passed the main Pages workflow.');
console.log(`Verified tests, build and Pages deployment for ${sha}.`);
