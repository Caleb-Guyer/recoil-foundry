# Build blueprints — 3.0.4

## Implementation

Six named slots live in the existing atomic progress profile. Blueprint validation enforces upgrade IDs, legal order, prerequisites, path exclusions and uniqueness. Share codes contain only a versioned upgrade sequence, never the local name, seed or progress. Import previews mask unknown names and loading filters discoveries and dependencies. Oversized practice drafts keep every upgrade and disable Start until the player trims them; the stored blueprint is detached from that draft.

Workshop and earned Practice editors have one Builds button. Finished-run recaps expose Save blueprint with the existing legal/discovered-build guard. Rename, replacement and clearing require explicit actions. Back and Escape return through the nested menu. Normal campaign and Daily loadouts are unchanged; practice victory gates and progress isolation still apply.

Older profiles and version-1 backups without the new blueprint field normalize to six empty slots. Malformed new fields are rejected. Backup export, restore, undo and profile conflict handling include blueprints. A rollback must retain the new profile field and decoder; an unchanged older client rejects profiles saved by 3.0.4.

## Local validation

- 62 focused tests passed across blueprint legality/code round trips, progression migration/backup/undo, practice, Workshop, recap actions and dialog dismissal.
- TypeScript and the production Vite build passed. The existing large-chunk advisory remains.
- A production preview at a fresh local origin, `127.0.0.1:4198`, imported a disposable backup through the real Progress UI: 15 discoveries, two victories, a five-upgrade Workshop gun, one finished run and a Room 2 checkpoint. Public profiles were not modified.
- Saved and renamed a five-upgrade build, including literal angle brackets and ampersands in its name. Share code and Copy code succeeded.
- An imported five-upgrade build showed two unnamed undiscovered upgrades. Saving retained all five; loading used only the three legal discovered upgrades.
- Loader practice preserved an oversized five-upgrade blueprint and disabled Start with “Remove 2 to start.” Removing Fold also removed Rewire. The remaining Light frame / Bloodwork / Kickback gun started correctly and survived Retry.
- Recent runs saved the actual three-upgrade recap into a separate named slot. The original five-upgrade slot stayed intact.

Further browser and publication evidence is recorded below after verification. These are automated and agent-controlled checks, not independent player feedback or new hardware acceptance.
