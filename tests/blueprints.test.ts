import test from 'node:test';
import assert from 'node:assert/strict';
import { MODS, availableMods, getGun, validBuild } from '../src/rules.ts';
import { workshopBuild } from '../src/workshop-build.ts';
import {
  BLUEPRINT_CODE_LIMIT,
  loadBlueprints,
  validBlueprint,
  validBlueprintSlots,
  setBlueprint,
  blueprintCode,
  parseBlueprintCode,
  blueprintPreview,
} from '../src/blueprints.ts';
const all = MODS.map((mod) => mod.id);
const rawCode = (value: unknown) =>
  'RF1.' + btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

test('six named slots preserve acquisition order and detach all saved arrays', () => {
  const empty = loadBlueprints(null),
    original = { name: 'Beam / Portal', mods: ['cutting-torch', 'burst', 'fold', 'rewire'] };
  assert.deepEqual(empty, [null, null, null, null, null, null]);
  let slots = empty;
  for (let i = 0; i < 6; i++) slots = setBlueprint(slots, i, { ...original, name: 'Build ' + i });
  assert(validBlueprintSlots(slots));
  original.mods.push('light');
  assert.equal(slots[0]!.mods.length, 4);
  assert.deepEqual(empty, Array(6).fill(null));
  const copy = loadBlueprints(slots);
  copy[0]!.mods.pop();
  assert.equal(slots[0]!.mods.length, 4);
  const renamed = setBlueprint(slots, 0, { ...slots[0]!, name: 'New name' });
  assert.equal(slots[0]!.name, 'Build 0');
  assert.equal(setBlueprint(renamed, 5, null)[5], null);
  for (const index of [-1, 6, NaN, 1.5]) assert.throws(() => setBlueprint(slots, index, original));
});

test('invalid slot records, paths, duplicates and missing parents are rejected', () => {
  for (const value of [
    null,
    {},
    [],
    { name: '', mods: [] },
    { name: ' padded ', mods: [] },
    { name: 'x'.repeat(33), mods: [] },
    { name: 'line\nbreak', mods: [] },
    { name: 'No', mods: ['rewire'] },
    { name: 'No', mods: ['magnum', 'magnum'] },
    { name: 'No', mods: ['cutting-torch', 'mass-driver'] },
    { name: 'No', mods: ['unknown'] },
    { name: 'No', mods: [], seed: 'no-campaign-data' },
  ])
    assert(!validBlueprint(value));
  assert(validBlueprint({ name: '空 · <build>', mods: [] }));
  assert(!validBlueprintSlots([]));
  assert(!validBlueprintSlots(Array(7).fill(null)));
  assert(!validBlueprintSlots([{}, ...Array(5).fill(null)]));
  assert.deepEqual(loadBlueprints([{ name: 'bad', mods: ['rewire'] }]), Array(6).fill(null));
});

test('codes round-trip legal weapon families including their order and the starting gun', () => {
  for (const mods of [
    [],
    ['fold', 'rewire', 'light'],
    ['cutting-torch', 'burst', 'pulse-chamber'],
    ['cutting-torch', 'charge-lens'],
    ['cutting-torch', 'prism-array'],
    ['mass-driver', 'drop-forge'],
    ['crossfire', 'recall', 'orbit'],
    ['shellshock', 'fuse', 'implosion'],
  ]) {
    const code = blueprintCode(mods),
      imported = parseBlueprintCode(' \n' + code + '\n ');
    assert.deepEqual(imported, { name: 'Shared build', mods });
    assert.deepEqual(getGun(imported.mods), getGun(mods));
    assert.equal(blueprintCode(imported.mods), code);
    assert(code.length < BLUEPRINT_CODE_LIMIT);
  }
});

test('code parsing rejects malformed, future, oversized and incompatible payloads without echoing their contents', () => {
  const invalid = [
    '',
    'RF2.W10',
    'RF1.',
    'RF1.!!!',
    'RF1.' + 'a'.repeat(BLUEPRINT_CODE_LIMIT),
    blueprintCode([]) + '=',
    rawCode({ mods: ['magnum'] }),
    rawCode(['rewire']),
    rawCode(['magnum', 'magnum']),
    rawCode(['cutting-torch', 'mass-driver']),
    rawCode(['SECRET-FUTURE-UPGRADE']),
    rawCode([null]),
    rawCode({ __proto__: { polluted: true } }),
  ];
  for (const code of invalid)
    assert.throws(
      () => parseBlueprintCode(code),
      (error) => {
        assert(!String(error).includes('SECRET-FUTURE-UPGRADE'));
        return true;
      },
    );
  assert.throws(() => blueprintCode(['rewire']));
});

test('undiscovered names stay hidden and a known child cannot bypass an unknown prerequisite', () => {
  const blueprint = parseBlueprintCode(blueprintCode(['fold', 'rewire', 'light']));
  const known = ['rewire', 'light'];
  const preview = blueprintPreview(blueprint, known);
  assert.deepEqual(preview.mods, ['light']);
  assert.deepEqual(preview.labels, ['Undiscovered upgrade', 'Rewire', 'Light frame']);
  assert.equal(preview.hidden, 1);
  assert.equal(preview.unavailable, 2);
  assert.deepEqual(blueprint.mods, ['fold', 'rewire', 'light']);
  assert.deepEqual(known, ['rewire', 'light']);
  assert.deepEqual(blueprintPreview(blueprint, []).labels, Array(3).fill('Undiscovered upgrade'));
  assert.deepEqual(blueprintPreview(blueprint, [...known, 'fold']).mods, blueprint.mods);
});

test('previews retain oversized legal guns so the player can choose which upgrades to remove', () => {
  const blueprint = { name: 'Full gun', mods: ['fold', 'rewire', 'light', 'leech', 'kick'] };
  const preview = blueprintPreview(blueprint, all);
  assert.equal(preview.mods.length, 5, 'do not silently keep the first three');
  const trimmed = workshopBuild(
    preview.mods.filter((id) => id !== 'fold'),
    all,
  );
  assert.deepEqual(trimmed, ['light', 'leech', 'kick']);
  assert(validBuild(trimmed));
  assert.equal(blueprint.mods.length, 5, 'trimming does not edit the saved blueprint');
});

test('every generated legal family can be shared without bypassing branch compatibility', () => {
  for (const first of availableMods([], true)) {
    const mods = [first.id];
    for (let n = 0; n < 24; n++) {
      const next = availableMods(mods, true)[n % Math.max(1, availableMods(mods, true).length)];
      if (!next) break;
      mods.push(next.id);
      assert.deepEqual(parseBlueprintCode(blueprintCode(mods)).mods, mods);
    }
  }
});
