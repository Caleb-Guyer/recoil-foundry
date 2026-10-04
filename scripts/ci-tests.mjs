import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { regularTestFiles } from './test-sharding.mjs';

const directory = new URL('../tests/', import.meta.url);
const files = regularTestFiles(readdirSync(directory)).map((file) =>
  fileURLToPath(new URL(file, directory)),
);
console.log(`Running ${files.length} regular test files; maximal builds run in separate CI jobs.`);
const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', ...files], {
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
