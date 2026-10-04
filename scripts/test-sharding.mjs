export const MAX_COMBO_TEST = 'max-combos.test.ts';

// Only this fixture moves out of the regular suite. New test files remain included.
export function regularTestFiles(files) {
  if (!files.includes(MAX_COMBO_TEST)) throw new Error('Missing maximal-build fixture.');
  const selected = files
    .filter((file) => file.endsWith('.test.ts') && file !== MAX_COMBO_TEST)
    .sort();
  if (!selected.length) throw new Error('The regular test suite is empty.');
  return selected;
}

export function readMaxComboShard(env = process.env) {
  const shardValue = env.RF_MAX_COMBO_SHARD,
    totalValue = env.RF_MAX_COMBO_SHARDS;
  if (shardValue === undefined && totalValue === undefined) return { shard: 1, total: 1 };
  if (![shardValue, totalValue].every((value) => /^[1-9]\d*$/.test(value ?? '')))
    throw new Error('Set both RF_MAX_COMBO_SHARD and RF_MAX_COMBO_SHARDS to positive integers.');
  const shard = Number(shardValue),
    total = Number(totalValue);
  validateShard(shard, total);
  return { shard, total };
}

export function selectMaxComboShard(combos, { shard, total }) {
  validateShard(shard, total);
  if (!combos.length || total > combos.length)
    throw new Error('Every maximal-build shard must contain builds.');
  // Interleave the gun families to spread slow builds across runners.
  return combos.filter((_, index) => index % total === shard - 1);
}

function validateShard(shard, total) {
  if (
    !Number.isSafeInteger(shard) ||
    !Number.isSafeInteger(total) ||
    shard < 1 ||
    total < 1 ||
    shard > total
  )
    throw new Error('RF_MAX_COMBO_SHARD must be between 1 and RF_MAX_COMBO_SHARDS.');
}
