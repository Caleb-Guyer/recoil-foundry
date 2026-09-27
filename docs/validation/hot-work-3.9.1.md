# Hot Work 3.9.1 validation

## Scope

Adds one commendation, two cosmetic rewards and an original maintenance record. No balance, world generation, save-format or permanent progression gates change. In-progress barricade evidence is transient because Continue restarts an unfinished encounter; the actual award persists immediately through the existing commendation store.

## Targeted checks

The focused command passes **101 tests**, including nine new Hot Work checks and the existing commendation, Welder, props, progress, logbook and Melt-through suites:

`node --experimental-strip-types --test tests/hot-work.test.ts tests/commendations.test.ts tests/welder.test.ts tests/props.test.ts tests/progress.test.ts tests/logbook.test.ts tests/melt-through.test.ts`

- Both spawned walls must be destroyed in the same deployment, followed by the credited Welder victory. Duplicate hits cannot count twice. A later deployment retains a previously completed pair for the same enemy.
- Partial pairs from separate deployments, cancelled warnings, expired walls, cleanup, train removal, hostile/allied fire and enemy impacts cannot qualify.
- Death, room reload, Continue, uncredited kills, Practice, tests and Workshop cannot carry partial progress into an award.
- Real projectile sweeps, beam damage, steel-ball impacts and player shell blasts can break qualifying walls. Player-triggered canister blasts count; enemy-triggered blasts do not. Player ability damage carries separate attribution without granting the Auditor case's direct-fire trigger.
- Both appearance selections require Hot Work, independently equip, survive progress backup/restore and reload, and expose their report only when earned or in the isolated preview.

Expanded regressions (including Demolition, Arc Coil, Grindshot, salvage evolutions and release packaging) pass **184 tests**, with no failures or skips. The production TypeScript/Vite build passes; the existing large-chunk warning remains.

Local in-app browser inspection at 1280 × 720 confirms the Hot Work objective, dual reward label and full maintenance report fit the logbook. Both new selections appear in Workshop → Appearance, independently select, and display the raised visor, jacket stitching and recessed gun vents without clipping. The preview explicitly identifies its selections as temporary.

Returning to the normal local game restores Workwear / Standard issue and both new rewards remain disabled behind Hot Work. The local preview produced no console warnings or errors.

## Ordinary-input challenge smoke

[Recorded results](hot-work-3.9.1-audit.json): fifteen 90-second attempts, using the existing beam, volley and explosive presets in all five authored Welder rooms. The pilot prioritizes visible barricades and delays directly firing at The Welder until a pair is broken. It does not heal, teleport, remove enemies or alter their attacks.

One Furnace/volley attempt destroyed a valid pair, defeated The Welder and earned Hot Work while clearing the actual room (37.98 seconds, 8 HP remaining). Fourteen attempts died; none timed out or produced non-finite state. The pilot frequently failed to create space for a second barricade. This is evidence that the challenge is attainable through ordinary inputs and correctly awards during a full encounter, not a human difficulty assessment or a claim of equal success across areas/builds. The controlled regression checks cover each weapon's damage attribution separately.

## Publication evidence

- Runtime commit: `612d20ad6da90d88548709f254249c16830ce9ba`, tag `v3.9.1`.
- [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36294918633): **2,045 tests passed**, zero failures/skips, including all 4,096 maximal guns; build and deployment succeeded. Test duration: 1,096,957.721 ms.
- [Release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36295878720): success on the same commit. Stable archive published 27 September 2026 at 04:59:34 UTC.
- Official archive: `recoil-foundry-v3.9.1-site.zip`, 9,779,245 bytes, 17 files, four relative entry references. Root entry and referenced assets verified; no sources, tests, credentials, source maps or development files packaged.
- SHA-256: `68a075d6a30ac44d282a9007b86889e5a421542546896e01593b31421791bfc5`, matched against GitHub's asset digest. The exact bytes were uploaded to itch.io.
- itch.io upload `19422261`, display **Recoil Foundry 3.9.1 — Hot Work**, replacing `19421686`. The new upload identity was checked before enabling browser play and saving.
- Both public About screens show **3.9.1**. The public Pages preview shows the Hot Work report and selectable Forgehand / Kiln appearance. No console warnings/errors in the preview or itch.io game.
- Existing progress retained: Pages Room 2, one upgrade, zero Practice victories/blueprints/records; itch.io Daily Room 1, zero upgrades/Practice victories/blueprints/records.
- No devlog or messages sent. No new human or physical-device claims; existing limits remain in [browser support](../browser-support.md).

Publication checks are complete.
