export const MAX_COMBO_TEST = 'max-combos.test.ts';

// This entry point also imports the exhaustive catalog and Reforge assertions.
// All other current and future test files remain in the regular suite.
export function regularTestFiles(files) {
  if (!files.includes(MAX_COMBO_TEST)) throw new Error('Missing maximal-build fixture.');
  const selected = files
    .filter((file) => file.endsWith('.test.ts') && file !== MAX_COMBO_TEST)
    .sort();
  if (!selected.length) throw new Error('The regular test suite is empty.');
  return selected;
}

export function readMaxComboShard(env = process.env) {
  return readShard(env, 'RF_MAX_COMBO');
}

export function readRegressionShard(env = process.env) {
  return readShard(env, 'RF_REGRESSION');
}

function readShard(env, prefix) {
  const shardValue = env[prefix + '_SHARD'],
    totalValue = env[prefix + '_SHARDS'];
  if (shardValue === undefined && totalValue === undefined) return { shard: 1, total: 1 };
  if (![shardValue, totalValue].every((value) => /^[1-9]\d*$/.test(value ?? '')))
    throw new Error(`Set both ${prefix}_SHARD and ${prefix}_SHARDS to positive integers.`);
  const shard = Number(shardValue),
    total = Number(totalValue);
  validateShard(shard, total, prefix);
  return { shard, total };
}

export function selectRegularTestShard(files, { shard, total }) {
  validateShard(shard, total, 'RF_REGRESSION');
  if (!files.length || total > files.length)
    throw new Error('Every regular-test shard must contain test files.');
  return files.filter((_, index) => index % total === shard - 1);
}

export function selectMaxComboShard(combos, { shard, total }) {
  validateShard(shard, total);
  if (!combos.length || total > combos.length)
    throw new Error('Every maximal-build shard must contain builds.');
  // Interleave the gun families to spread slow builds across runners.
  return combos.filter((_, index) => index % total === shard - 1);
}

function validateShard(shard, total, prefix = 'RF_MAX_COMBO') {
  if (
    !Number.isSafeInteger(shard) ||
    !Number.isSafeInteger(total) ||
    shard < 1 ||
    total < 1 ||
    shard > total
  )
    throw new Error(`${prefix}_SHARD must be between 1 and ${prefix}_SHARDS.`);
}
