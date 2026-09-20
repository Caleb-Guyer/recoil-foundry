import { readFileSync } from 'node:fs';
import { releaseMetadata } from './release-metadata.mjs';

const tag = process.argv[2];
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
releaseMetadata(version, tag);
const notes = readFileSync(new URL(`../docs/releases/${version}.md`, import.meta.url), 'utf8');
// GitHub release descriptions need absolute links back to the tagged documentation.
const base = `https://github.com/Caleb-Guyer/recoil-foundry/blob/${tag}/docs/releases/`;
process.stdout.write(
  notes.replace(/\]\((\.\.?\/[^)]+)\)/g, (_, path) => `](${new URL(path, base).href})`),
);
