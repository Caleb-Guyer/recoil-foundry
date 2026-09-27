# Stormfront — 3.5.0

## Scope and compatibility

Five authored layouts replace Overtime stages 16–19 for new revision-5 entries, including both third-room routes and the Interceptor finale. Seeded mirrors and previous Overtime areas remain stable. Unversioned/revision-1/2/3/4 saves retain their generation. Campaign, Daily, upgrades and earned ordinary boss Practice retain their rules; Practice ruleset remains 1.

Two or three fixed conductor lanes alternate. The first warning begins after 3.5 seconds; each full warning lasts 1.5 seconds, followed by one strike, 0.22 seconds of visual afterglow and 3.2 seconds of rest. Damage is 22 to the player, 220 to ordinary enemies or 120 before boss armor/recovery multipliers. Spawn grace and player invulnerability apply. Lightning does not count as a gun hit, destroy cover, launch actors or cancel boss attacks.

Nine conservative strips cover each lane. Swept convex geometry determines the first roof/prop intersection for each strip; the same depths draw the warning and determine damage. A strip can shorten if new cover enters, but cannot lengthen during that warning. Enemy/player exposure is captured before damage resolves. Rain is cosmetic, fixed-budget and behind terrain; no full-screen flashes are added. Reduced effects removes rain and jagged bolts while preserving the lane, charge mark and impact edge. Warning audio reserves voices and ducks effects/music through the full tell. No new dependencies, controls or HUD panels.

## Automated checks

All 1,978 tests passed locally, with zero failures or skips, in 296,751.647 ms. The 39 focused Stormfront/music checks also passed. Twelve new Stormfront tests cover deterministic generation over 24 seeds × 20 stages, all five layouts and mirrors, detached geometry, entrance/spawn clearance, old/new saves, strict presets and progression isolation. Physics checks cover full warnings after long frames, fixed targets, alternating lanes, single-hit damage, spawn grace, platform/rotated/moving cover, cover removal, every boss's armor and attack state, player immunity, death attribution, pause/hitstop, clear and reset. Both routes transition from Reclamation through Rooftops to the final departure with valid checkpoints. Base-jump traversal succeeds in both directions, mirrored/unmirrored, with loose cover present/broken (40 cases).

The initial tests identified a mirrored Skyline lane exactly on the reserved entrance boundary; it was moved 20 units inward. Two fixture errors were corrected: a supposed safe player position overlapped the next lane by three units, and a prop helper used the wrong spawn signature. TypeScript and production build pass; the existing large-chunk advisory remains.

## Combat probes

Ten normal-health, legal-preset runs used ordinary movement/aim/fire through the existing dodge pilot, with open-ascent navigation after a two-second cover stall. Eight cleared, two died; no runs capped. Successful clears took 11.15–36.22 seconds, finishing with 24–100 HP. Both Interceptor orientations cleared: 36.10 seconds/24 HP and 36.22 seconds/56 HP. Mirrored Antenna died at 44.20 seconds with one shooter remaining; mirrored Maintenance died at 84.08 seconds with one shooter remaining. Raw results: `.release-assets/overtime-rooftops-probe.json`.

These limited probes exercise combat and cover navigation, not human difficulty, enjoyment, all-build viability or player win rates. No HP/damage overrides were used, and the failures remain recorded. Independent human balance feedback remains unavailable.

## Browser and publication

All five room types were inspected through the local production build in the embedded browser, including mirrored Maintenance and Interceptor. Rain, fixed lane marks, stepped cover shadows and Interceptor attack warnings were legible. Jump/fire, pause, death and retry controls were exercised. A timed Reduced effects capture retained the lane and charge marks without rain; the setting was restored to Off. Progress remained no saved run and zero discoveries/victories/blueprints/records. Browser warning/error logs were empty.

Runtime commit: `6a88b6e6b7c2e0ee701e3f9cef213bbcb9ad2ffb`. Immutable tag: `v3.5.0`.

- [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36283060075) passed all 1,978 tests, with zero failures/skips in 316,603.682 ms, then built and deployed successfully. Tests completed at 00:43:02 UTC on 27 September 2026 (26 September locally); deployment completed at 00:43:20 UTC.
- The [release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36283380651) succeeded for the same commit. The [official ZIP](https://github.com/Caleb-Guyer/recoil-foundry/releases/download/v3.5.0/recoil-foundry-v3.5.0-site.zip) was published at 00:44:13 UTC: **9,768,005 bytes**, SHA-256 `f49ce50bd3e2e40eeace4ea803b3dc4e3bd2037514c39176b61388ee37663222`.
- Download size/checksum match GitHub metadata. All 17 files passed archive checks, with root index.html, four resolved entry references, and no source/tests/private files/maps or unsafe paths. The itch.io upload copy has an identical checksum.

Public Pages About shows 3.5.0. The existing Room 2 save, one discovery and zero Practice victories/blueprints/records remain intact. The published Antenna preset starts at TEST · OT · 17 and shows the fixed warning, stepped cover shadow and flush floor conductor. Pause works. Public main/preset warning/error logs are empty. Proof image: `../stormfront-3.5.0.png` outside the repository.

itch.io upload **19419734** contains the same verified ZIP, displayed as **Recoil Foundry 3.5.0 — Stormfront**. The transport filename remains recoil-foundry-v2.98.0-site.zip for replacement continuity. Browser playback was enabled, the editor confirmed Saved, and the public iframe serves upload 19419734. About shows 3.5.0. Continue Daily remains available with the same Room 1 save and zero discoveries/victories/blueprints/records. Warning/error logs are empty. Store copy/screenshots were retained; no devlog or issue report was submitted. Both hosts were checked through the embedded browser; retained human/hardware limitations still apply.
