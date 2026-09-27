# Maintenance Trials 3.12.0 validation

## Local checks

- 149 focused tests passed: trial profiles, unlocks, clean certification, runtime completion, fixed-gun retries, challenge parsing, record comparison, backup migration/restore/undo, existing shafts, detours, hazards, freight, portals, commendations and release packaging.
- Both trial types completed through ordinary movement, jump and recoil-fire inputs with the starting gun, live hazards and positive health. The existing 216 climb checks still cover all 36 section arrangements per shaft with standard, recoil and Fold builds.
- Damage disqualifies a normal shaft's clean completion across Continue. Pending summit rewards can recover a missed unlock after reload without changing reward payment. Old unfinished saves are conservative about unrecorded damage history.
- Locked, mixed, malformed and outdated challenge links cannot launch an eligible trial. Preview links cannot write records or earn rewards. Trial starts never write campaign checkpoints.
- Production TypeScript/Vite build passed. The pre-existing large-chunk warning remains.
- In-app browser: locked incoming challenge; earned Practice entry, shaft setup, paired time/shot records, share-link screen, exact challenge start, pause/retry and return to title checked. A temporary profile fixture was used only on localhost and restored through the Progress UI afterward.

## Release verification

Full CI and public deployment verification are pending. This file will be updated with the exact runtime revision, test total, release archive and public checks after publication.

Browser checks are functional UI checks, not new physical-device or human playtest acceptance. Historical browser/device evidence remains in the browser support document.
