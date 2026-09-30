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

The initial counter prototype added its whole warning on top of a full recovery, unintentionally extending free damage windows. Final pacing consumes the existing recovery during the counter warning and guarantees 0.55 seconds afterward. Tells, shot damage and health remain unchanged. The generic pilot also loses some Crane/Kiln baseline fights, so those paired losses do not establish an impossible Security encounter.

## Browser scope

The in-app browser verifies the built title selector, per-level records, real Redline start, preview isolation, pause and Progress restore. UI fixtures are confined to localhost and removed through Undo restore after testing. No public saved profile is replaced. Physical standalone-browser/hardware checks are not claimed.

Publication evidence will be recorded after the final Pages and release workflows complete.
