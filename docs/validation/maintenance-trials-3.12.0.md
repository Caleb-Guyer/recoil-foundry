# Maintenance Trials 3.12.0 validation

## Local checks

- 149 focused tests passed: trial profiles, unlocks, clean certification, runtime completion, fixed-gun retries, challenge parsing, record comparison, backup migration/restore/undo, existing shafts, detours, hazards, freight, portals, commendations and release packaging.
- Both trial types completed through ordinary movement, jump and recoil-fire inputs with the starting gun, live hazards and positive health. The existing 216 climb checks still cover all 36 section arrangements per shaft with standard, recoil and Fold builds.
- Damage disqualifies a normal shaft's clean completion across Continue. Pending summit rewards can recover a missed unlock after reload without changing reward payment. Old unfinished saves are conservative about unrecorded damage history.
- Locked, mixed, malformed and outdated challenge links cannot launch an eligible trial. Preview links cannot write records or earn rewards. Trial starts never write campaign checkpoints.
- Production TypeScript/Vite build passed. The pre-existing large-chunk warning remains.
- In-app browser: locked incoming challenge; earned Practice entry, shaft setup, paired time/shot records, share-link screen, exact challenge start, pause/retry and return to title checked. A temporary profile fixture was used only on localhost and restored through the Progress UI afterward.
- Final navigation fix: locked challenges offer Start a run, and linked/invalid trial titles offer New run. The former was clicked in the browser and reached an ordinary room-one campaign with the challenge URL removed. The trial tests and production build passed again after this fix.
- Servicewear and its factory report were inspected through the non-persistent commendation preview. The finish screen was visually checked using the real result markup with a synthetic score, both record messages, the cosmetic reward and a shared target. That layout fixture was removed by the subsequent production rebuild.

## Release verification

- Runtime revision: `1791228c2f05474e0d45c4cdd95760ae841e95e3`.
- [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36353411913) passed **2,084 tests**, with zero failures, skips or cancellations, in 1,132,052.666257 ms. Build and deployment also passed. The earlier run was superseded by the final navigation fix.
- [Release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36354632344) passed for tag `v3.12.0` at the same runtime revision. The stable release was published on 27 September 2026 at 22:15:36 UTC.
- Official archive: `recoil-foundry-v3.12.0-site.zip`, **9,787,443 bytes**, 17 files. All four relative entry assets exist; the archive excludes source, tests, node_modules, work files and source maps.
- SHA-256: `351bf3e381742ff21470c8cca15fc2fbc8f92fc2c8387fb59f344c616039c4da`, verified against GitHub's asset digest and the byte-identical itch.io upload copy.
- itch.io upload: `19438077`, displayed as **Recoil Foundry 3.12.0 — Maintenance Trials**, enabled for browser playback. The public page loads `/html/19438077/index.html?v=1790547443` and shows **3.12.0** in About & credits. Its existing Daily room-one save and zero-discovery/Practice/blueprint/record totals are intact. No devlog, pricing or disclosure changes were made.
- GitHub Pages shows **3.12.0** in About & credits. Both public trial links launch the correct fixed-gun mode. The existing room-two campaign and one discovered upgrade remain unchanged, with zero boss Practice victories, blueprints or Practice records and no shaft unlock gained by the preview.
- No browser errors were reported by either public game during these checks.

Browser checks are functional UI checks, not new physical-device or human playtest acceptance. Historical browser/device evidence remains in the browser support document.

## Compatibility contract

Record identity includes shaft kind, seed, layout revision and trial rules. Preserve layout revisions 1 and 2 for old saves and challenges. Increase `TRIAL_RULES` when the starting gun, movement or shaft physics changes competitively; archived records remain viewable but cannot be raced against new rules. A rollback must retain the maintenance profile key, clean-shaft checkpoint field and Servicewear commendation/cosmetic decoding. Deploying an unchanged 3.11.0 client is not a compatible rollback over a 3.12.0 profile.
