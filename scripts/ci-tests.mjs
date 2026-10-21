import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { regularTestFiles, readRegressionShard, selectRegularTestShard } from './test-sharding.mjs';

const directory = new URL('../tests/', import.meta.url);
const all = regularTestFiles(readdirSync(directory));
const shard = readRegressionShard();
const files = selectRegularTestShard(all, shard).map((file) =>
  fileURLToPath(new URL(file, directory)),
);
console.log(
  `Regular shard ${shard.shard}/${shard.total}: running ${files.length} of ${all.length} test files; exhaustive catalog, Reforge and Workshop checks run in maximal-build jobs.`,
);
const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', ...files], {
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
