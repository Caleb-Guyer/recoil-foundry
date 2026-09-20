import { readFileSync } from 'node:fs';

const tag = process.argv[2];
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
if (!/^v\d+\.\d+\.\d+-rc\.\d+$/.test(tag ?? '') || tag !== `v${version}`)
  throw new Error('Candidate tag must match the package version. Stable publication is manual.');
const notes = readFileSync(new URL(`../docs/releases/${version}.md`, import.meta.url), 'utf8');
// GitHub release descriptions need absolute links back to the tagged documentation.
const base = `https://github.com/Caleb-Guyer/recoil-foundry/blob/${tag}/docs/releases/`;
process.stdout.write(
  notes.replace(/\]\((\.\.?\/[^)]+)\)/g, (_, path) => `](${new URL(path, base).href})`),
);
