# Security Levels 3.16.0 validation

## Implementation and compatibility

Optional `security: { level, rules: 1 }` checkpoints opt into the new behavior; the absent field retains Standard. Daily checkpoints reject the field. Practice and Workshop clear it on entry. Daily rules remain 85 and Practice rules remain 2 because those modes do not use Security Levels.

`rf-security-v1` joins the atomic progress profile. Older profiles/backups migrate without fabricating best times; an escaped/Shutdown record or an Overtime checkpoint unlocks Security I. Best first-lap times persist independently of the ten-entry recent-run history. Grade selection is checked against progression before starting or replaying a run. Test presets cannot write either checkpoints or mastery rewards.

Both departure elevators record the base campaign before Overtime starts. The normal extraction and Shutdown ending use the same completion guard. Death, unfinished extraction, Practice and test runs cannot qualify. Redline's outfit preserves the shared player hull, visor and weapon indicators.

## Automated checks

- 14 focused security tests cover sequential unlocks, invalid scores, per-level records, save reconstruction, Daily/Practice isolation, boss health, all five layouts in both mirrors, squad hulls and wave placement across 240 rooms, warning/lock timing, interrupted counters, both exit choices, reward eligibility, backup migration and preview links.
- Initial full local suite: **2,150 passed**, no failures/skips/cancellations. This run began before the final counter-recovery pacing adjustment and progress-summary text; their focused tests are rerun separately, and final exact-commit CI is the publication gate.
- TypeScript and production build pass. Vite retains the existing large-chunk advisory.
- The [50-case input audit](security-inputs-3.16.0.json) uses normal player controls, legal room-count builds, unchanged health and unmodified AI/terrain. It compares Standard and Adapted across ten boss variants and both mirrors, then plays all Redline checkpoints. All ten checkpoint cases clear. The saved JSON contains boss failures as well as wins; it is not a claim of universal human playability.
- Final focused rerun: **66 passed**, including persistence, cosmetics, lore and recent-run regressions.
- Final exact-commit [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36653774531): **2,150 passed**, zero failures/skips/cancellations, followed by a successful production build and deployment. Runtime commit: `276001f1e9932c2c3fdd6f6677077c8f6f022d36`.
- A [four-campaign input audit](security-campaigns-3.16.0.json) uses seed `path-run-67`, normal health and actually offered upgrades. Standard, Adapted and Redline reach extraction and record the correct first-lap clearance; Reinforced ends in room 14 from a Borer shot. All 163 saved checkpoints validate. These are reproducible pilot outcomes, not estimates of human win rates or evidence that difficulty increases monotonically for every build.

The initial counter prototype added its whole warning on top of a full recovery, unintentionally extending free damage windows. Final pacing consumes the existing recovery during the counter warning and guarantees 0.55 seconds afterward. Tells, shot damage and health remain unchanged. The generic pilot also loses some Crane/Kiln baseline fights, so those paired losses do not establish an impossible Security encounter.

## Browser scope

The in-app browser verifies the built title selector, per-level records, real Redline start, preview isolation, pause and Progress restore. UI fixtures are confined to localhost and removed through Undo restore after testing. No public saved profile is replaced. Physical standalone-browser/hardware checks are not claimed.

## Publication

GitHub Pages serves the final 3.16.0 build. All seven squad, boss and regional Redline test URLs return HTTP 200 and the current entry assets. The three entry JavaScript/CSS assets match the local production build by SHA-256. This is an HTTP/artifact check; no fresh public browser UI check is claimed.

Tag `v3.16.0` passed the [release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36655375814). The [official release](https://github.com/Caleb-Guyer/recoil-foundry/releases/tag/v3.16.0) archive has 17 files, a root `index.html`, all four referenced entry assets and no source/test/dependency directories, source maps or path traversal. Its 9,800,002 bytes and SHA-256 `83108df149303ac484c75e7d5819efc72bc5fa94528fcfd29c12f0bc6e51a5c7` match GitHub's asset metadata. [Artifact receipt](security-3.16.0-artifact.json).

The initial itch.io update was blocked by browser control. The available Windows helper could not restore Edge: state capture reported `window is minimized`, and activation repeatedly reported `user input was detected in this window; call get_window_state before continuing`. No itch.io upload or page changes were submitted during that attempt, leaving itch.io on 3.15.0 at that time.

**Resolved by the cumulative 3.17.0 release.** Browser control became available, the verified 3.17.0 archive replaced the existing upload, browser playback was enabled, and the public iframe reported 3.17.0 while retaining its Daily room 1 save. Security Levels are included in that build. See the [Weapon Mastery publication receipt](weapon-mastery-3.17.0.md); no separate 3.16.0 upload remains necessary.
