# Clock Out 3.6.0 validation

## Scope

Overtime's final escape enters the safe end of the existing departure layout at x6500, preserving the physical lift and checkpoint format. The ordinary campaign, Daily and first-lap New Game+ lifts retain their existing behavior. Overtime no longer emits timed collapse feedback during departure. Final-room rain fades over three seconds after clear; lightning already stops on clear.

At boarding, the existing commendation tracker awards After Hours while the run remains eligible. Checkpoint removal and the won transition happen immediately. The main UI captures run history and lore, waits for the existing profile write queue to settle, then releases a separate twelve-second presentation clock. Failed writes retain the existing save warning and do not trap the player. A skip requested while saving is honored when the queue settles. The result screen waits for presentation completion; the run and simulation clocks stay frozen. New runs and title reset the presentation object, so an old asynchronous save completion cannot revive it.

The lift shows deterministic silhouettes of Rooftops, Reclamation, Cooling, Furnace and Docks. Reduced effects uses stationary dissolves. The score is four bars at 80 BPM with a final D-major resolution; it follows music settings and focus state. Night Shift is the existing After Hours reward, without automatic equipping or duplicate unlocks. The real final gun uses existing weapon art.

## Checks

Nine added automated checks cover valid/strict preview URLs, retry and progress isolation, immediate victory and single reward, skip-before-save, repeated skip, reset, invalid/long frame deltas, background freeze, unassisted departure traversal, persisted victory/reward/checkpoint removal after reload, storage failure, twelve-second score structure, and audio cancellation on result/focus loss/mute. The final 58 focused finale, audio, extraction and presentation checks pass. Existing escape, Overtime, commendation and audio checks also pass.

Local production-browser checks verified the ride, daylight arrival, completed reward screen, Again, button skip, Escape and Enter skip, reduced-effects dissolves, and an 800×450 viewport. At compact height the result dialog scrolls; its actions remain reachable. Test previews left no saved run and zero discoveries, Practice victories, blueprints or Practice records. Reduced effects was restored to Off. Browser warning/error logs were empty.

The local full suite passed all 1,987 tests with zero failures or skips in 320,417.6648 ms. Final camera-start and save-gated music adjustments then passed the 58 focused checks and a fresh TypeScript/production build. The existing large-chunk advisory remains. Physical controller/touch testing and independent listening/playtester feedback were not performed for this change.

## Publication

Runtime commit `4ecc743db218e62b511a42fd11ba301a253372d1` passed all 1,987 tests again, with zero failures or skips, in 321,759.958027 ms in [Pages CI 36285354760](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36285354760). Tests completed at 01:28:26 UTC and deployment at 01:28:44 UTC on 27 September 2026. Immutable tag `v3.6.0` points to that exact runtime commit. [Release CI 36285692269](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36285692269) succeeded and published the official artifact at 01:30:02 UTC.

The [official browser ZIP](https://github.com/Caleb-Guyer/recoil-foundry/releases/download/v3.6.0/recoil-foundry-v3.6.0-site.zip) is 9,770,733 bytes, SHA-256 `4e90f000c1526c5d3d03018cd969716d557507980a2672d2de061e2001703008`. Its hash matches the GitHub-published digest; all 17 files and four root entry references passed archive checks. No source, tests, development directories or source maps are included.

That exact archive replaced the existing itch.io browser upload. The transport filename remains `recoil-foundry-v2.98.0-site.zip` for replacement; its display name is **Recoil Foundry 3.6.0 — Clock Out**. Browser play was checked and the editor confirmed Saved. The public iframe is upload `19420240`, observed at `https://html-classic.itch.zone/html/19420240/index.html?v=1790472771`. Store copy, pricing and notification/devlog settings were not changed.

Both public About screens report 3.6.0. Pages retains Room 2, one discovery and zero Practice victories/blueprints/records; itch.io retains its Daily Room 1 checkpoint and zero discoveries/victories/blueprints/records. The public Clock Out link opened the sequence, supported Skip, and reached the reward screen on natural completion. Public game and preview warning/error logs were empty. Temporary preview/editor tabs and the local server were closed; public menus and the test link remain ready. Publication is complete.
