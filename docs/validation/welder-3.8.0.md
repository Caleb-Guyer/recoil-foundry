# The Welder 3.8.0 validation

## Encounter contract

New Overtime entries use an independent seeded 30% selection. One eligible, non-fork, non-boss room reserves the grounded lead/support pair's existing space for a 58 × 60 Welder. Its full hull is checked against authored terrain, prop reservations and machinery sweeps. The lead/support pair is replaced, roster indices are remapped, and reinforcement anchor reuse excludes the Welder. Existing saves without a reservation do not retroactively receive one.

The machine has 2,400 health, 55% incoming damage while closed and 150% during its 2.2-second recovery. Attacks have a 1.25-second warning; seam positions and bolt direction stay fixed after commitment. Seams last 2.6 seconds, have at most three segments, use the player's normal damage grace, and disappear when their supporting terrain is destroyed. Barricades are 24 × 84, have 110 health, expire after six seconds, and are capped at two. Creation rechecks live occupancy and support; blocked warnings cancel. Expiry and destruction cannot farm scrap or demolition charges. Pause, death, reset and room transition clear or freeze the appropriate state.

The optional persisted reservation moves through scheduled → defeated → claimed. A cleared room first offers the Welder bonus, then its ordinary reward; only the ordinary reward advances the stage and provides the normal room heal. The bonus cannot reroll. Upgrade compatibility, exhausted-pool repair fallback, route choice, build counts and Continue validation use the existing reward systems. Real defeats unlock lore and Practice; previews, Practice, cleanup and uncredited removals do not.

## Verification

- Thirteen dedicated regression tests cover deterministic rarity and reservation geometry over 400 seeds, all 25 area/build previews, legacy saves, malformed links/states, fixed warnings, airborne avoidance, pause, destructible/expiring cover, occupied placement cancellation, overheat damage, cleanup, reward resume and duplicate claims, and earned Practice/lore isolation.
- The affected Practice, Practice records, difficulty, audio and Welder suites pass together: 72 tests. Practice fixture generation now supports this optional encounter in both room orientations.
- Type checking and the production build pass. Vite retains its existing large-chunk advisory.
- Browser inspection confirms the isolated entry, room rendering, Welder silhouette and floor/bolt warnings through ordinary controls. This is not a human difficulty acceptance study.
- The reproducible ordinary-input audit covers five builds in each of five authored encounter rooms: 25 runs, 25 arrivals, 21 Welder defeats, 20 full room clears, five player deaths, and zero 90-second timeouts. All physics coordinates remain finite. Observed maxima are three seams and one barricade; focused tests separately exercise the two-barricade cap. Results retain failed runs rather than modifying health or removing opponents.

Run `node --experimental-strip-types scripts/welder-audit.ts` to reproduce the diagnostic. [Recorded results](welder-3.8.0-audit.json) are diagnostic evidence, not player win-rate estimates. Full release CI and publication receipts follow.

## Publication receipts

- Runtime commit: `0fd3ac86b89fe318aad2401a64f7ac4b431a940e`; immutable tag `v3.8.0`.
- [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36289544860): all **2,011 tests passed**, zero failures/skips, followed by the production build and successful deployment. Test duration: 435,748.686 ms. The initial local run exposed an import cycle and missing optional-boss fixture handling; both were fixed before this clean full-suite run.
- [Release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36289936025): success for the same runtime commit. The [official ZIP](https://github.com/Caleb-Guyer/recoil-foundry/releases/download/v3.8.0/recoil-foundry-v3.8.0-site.zip) was published at 2026-09-27 02:56:18 UTC.
- Archive: **9,775,731 bytes**, **17 files**, four valid relative entry references; root index.html, with no source/tests/dependencies/private files or source maps. SHA-256 **E2D028C16419B1BEA70980727435A6A2B98F09C03D0D175E6F783185A0621702**, matched against GitHub's asset digest and the exact upload copy.
- Existing itch.io project: replacement upload **19421154**, display name **Recoil Foundry 3.8.0 — The Welder**, browser playback checked, Save confirmed. The public page loads `https://html-classic.itch.zone/html/19421154/index.html?v=1790477974`.
- Both public About panels report **3.8.0**. Pages retains Room 2, one discovered upgrade and zero Practice victories/blueprints/records; itch retains its Daily Room 1 and zero discoveries/victories/blueprints/records. No player storage was reset.
- The public isolated Welder link starts TEST · OT · 02 / 20, preserves progress and returns to its test menu. Warning/error logs were empty on that test and the refreshed itch.io page. Local reduced-effects replay inspection retained the visible molten line and machine silhouette.
- Public test screenshot: `outputs/welder-3.8.0.png` in the task workspace. Temporary local server and editor were closed after verification. No devlog or player messages were sent.

Publication is complete. Human balance acceptance and broader physical-device coverage remain the existing disclosed limitations.
