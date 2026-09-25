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

- All six slots accepted named builds. Replacement and clear actions were verified, including cancellation. Invalid code input showed an inline error without leaving the menu. Escape from the name field cancelled replacement; nested Escape returned to the editor with focus on Builds.
- The Appearance tab correctly hides build-only controls. A 32-character unbroken name wrapped without horizontal overflow. The slot list and actions remained usable at 800×600; the temporary viewport override was reset.
- Reload retained five saved slots after clearing the sixth, Room 2, 15 discoveries and two victories. The real Progress export downloaded `recoil-foundry-backup-2026-09-25.json`; its version, seed, names and five slots were inspected. The browser's download event timed out, but the file was present in Downloads. Restoring a pre-blueprint 3.0.3 backup yielded zero blueprints; importing the exported 3.0.4 file restored all five plus the recap and campaign progress. Undo restore returned to zero slots. All restores used the visible import/confirmation UI.
- Continue restored the original campaign seed `BLUEPRINT-SAVED`, Room 2 and Heavy hitter gun. No report was submitted. Captured browser warning/error logs were empty.
- An empty starting-gun blueprint saved into slot six and loaded correctly with no upgrades.

These are automated and agent-controlled checks, not independent player feedback or new hardware acceptance.

## Release gate and artifact

Runtime commit `6aa155fed508e9db5bd07255293da6033b385ced` passed **1,912 tests, zero failures/skips** in 529.0 seconds, the production build and [Pages deployment](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36182346336). Tag `v3.0.4` points to that exact commit. The [release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36183367664) verified the matching Pages pass before packaging.

The [official ZIP](https://github.com/Caleb-Guyer/recoil-foundry/releases/download/v3.0.4/recoil-foundry-v3.0.4-site.zip) is 9,755,036 bytes, with 17 files, root `index.html`, all four entry references present, and no source, tests, dependencies, source maps or local fixtures. SHA-256: `1f59ec1e9413296442de34a84ed12ffc95e6e7e974876df6dd11cb5add326353`. Its size and digest match GitHub's published asset metadata. The itch.io upload copy preserves the existing replacement filename `recoil-foundry-v2.98.0-site.zip` and has the identical digest.

## Public verification — 25 September 2026

- GitHub Pages About & credits shows **3.0.4**. Its Room 2 save, one discovery and zero victories remain intact, with six empty blueprint slots. The live Builds menu and import preview work; a fully undiscovered five-upgrade code hides all names and disables loading. No test blueprint was saved to this public profile.
- itch.io replaced the existing game archive with upload **19400245**, display name **Recoil Foundry 3.0.4 — Dead Signal**, marked as played in the browser. The public iframe is `https://html-classic.itch.zone/html/19400245/index.html?v=1790366733`; About & credits shows **3.0.4**.
- itch.io retained Continue daily, its Room 1 save, zero discoveries and zero victories. Its Workshop exposes the six empty blueprint slots. Neither public profile received QA fixture data or a test blueprint.
- Both public games loaded successfully with no captured warning/error logs. Feature gameplay and restore/undo checks used the isolated local production build above. Temporary local/editor tabs were closed and the local preview server stopped.

Publication is complete on both hosts. No release checks remain pending; historical physical-device and independent-player limitations retain their existing scope.
