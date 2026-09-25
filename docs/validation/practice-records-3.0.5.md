# Practice records and shared challenges — 3.0.5

## Implementation

Practice wins retain fastest and cleanest scores independently, each with the winning time, accepted damage-hit count and timestamp. The key includes boss kind, exact seed, ordered upgrade IDs and `PRACTICE_RULESET`. Equal metrics retain the old score; ties use the other metric. Records are bounded to 200 arena/build combinations, retaining the most recent record improvements. Mutable result/build arrays are detached.

The game counts positive accepted damage after immunity checks. Healing does not reduce hits. Starting any attempt resets the counter; the existing active simulation timer excludes pause and impact freeze. Capture requires a living player, cleared arena, zero combat enemies, the expected stage/seed and the original gun. Direct URL test fights, losses, Workshop and forced victory mode alone cannot produce records.

RFC1 codes contain rules, boss, seed, upgrades and target time/hits, encoded as canonical UTF-8 JSON/base64url. Bounded strict validation rejects damaged codes, duplicates, invalid IDs, illegal acquisition order, missing prerequisites and oversized guns. Import never awards records or discoveries. Accepting a challenge requires a real recorded victory over its boss kind (the friend's seed may differ), every upgrade discovered, and matching current rules. The start handler checks the exact seed/build again. Retry preserves the target; Edit build is hidden during a fixed challenge.

Progress stores include the new field atomically with backup/restore/undo and conflict handling. Older profiles/backups normalize a missing field to an empty list. Malformed provided fields fail validation. Archived rules can retain retired upgrade IDs without making the rest of the profile unreadable. They cannot start or share a current race.

### Future balance updates

Increment `PRACTICE_RULESET` in `src/practice-records.ts` whenever boss AI, arena generation, physics, presets or upgrade balance changes. Cosmetic/menu-only changes may retain it. Do not compare or replay a different ruleset using the current simulation. Preserve the stored record decoder on rollback: unchanged pre-3.0.5 clients reject profiles containing the new field. These are local personal records and unverified shared targets, not an authoritative leaderboard.

## Automated evidence

63 focused checks passed across Practice records, existing Practice, Progress, blueprints, Workshop and dialog dismissal. New coverage includes accepted/grace/paused damage, healing, resets, real engine win capture, eligibility exclusion, all ten bosses' preset reproduction, independent best metrics, ties, seed/order/rules isolation, bounds, malformed/Unicode codes, spoiler masking, discovery gates, old-profile migration, current/archived backup restore and undo. TypeScript and the production build passed; the existing large-chunk advisory remains.

## Browser evidence

The production build is tested on isolated `127.0.0.1:4199` with a disposable imported profile: 15 discoveries, Loader/Switchboard victories, three synthetic record fixtures including an archive, and a Room 2 campaign checkpoint. The fixtures exercise presentation and do not claim genuine player performance. No public profile receives them.

- A fresh profile hides Practice. After import only the two defeated bosses appear.
- Loader setup shows its preset best and separate fewest-hit metric. Records retain distinct custom/preset guns; details display their exact build and arena. Share code and Copy code work.
- Archived balance records appear in a collapsed section and disable racing. Back/Escape returns through records, setup and the boss list.
- Importing an unbeaten Press challenge hides its name and disables Start. Importing an undiscovered upgrade hides the name and disables Start.
- A permitted challenge starts Loader in the friend's different `record-100` arena with exactly Heavy hitter / Hair trigger / Kickback. Pause hides Edit build. The report preview confirms Practice, the shared seed and gun; no report is submitted.

- A natural challenge loss displays 0:07.73 / 4 hits and the 2:00.00 / 2-hit target, without a record/share award. Retry preserves `record-100`, the original gun and the fixed-build pause menu. The result layout has clear spacing.
- Reload retains the Room 2 campaign, 15 discoveries, two victories and all three fixture records. Exported backup data passes the production parser and exactly matches the original records and campaign checkpoint.
- Restoring an actual 3.0.4 backup imports its five blueprints and no Practice records. Undo restores the prior three records and zero blueprints. Warning/error logs are empty.

Winning capture for all ten boss kinds is covered by engine tests; this browser session verifies real challenge startup, loss/retry and fixture-backed record presentation, not a human-played victory. These are agent-controlled checks, not independent human feedback or new physical-device acceptance.

## Release evidence

Runtime commit `b0b2fe9a326ab8fdb7ec212bdf9df7ff6b73129d` passed all **1,922 tests** (zero failures/skips, 543.5 seconds), build and deployment in [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36185757134). The immutable `v3.0.5` tag passed the [release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36186797071).

The official [release artifact](https://github.com/Caleb-Guyer/recoil-foundry/releases/tag/v3.0.5), `recoil-foundry-v3.0.5-site.zip`, is 9,758,838 bytes and matches GitHub's published SHA-256 digest:

`ca92387df4390ca1e21c9b90222fa25ab53d4474c010961e9307f8b00e9d3981`

The ZIP contains 17 files, root `index.html`, and all four relative entry references. It excludes source/tests, dependencies, private working files and source maps. The itch.io upload copy is byte-identical and retains the existing upload filename for replacement.

Public Pages startup, About and report preview show 3.0.5, with the existing Room 2 checkpoint, one discovery, zero victories/blueprints and zero records preserved. Practice remains hidden until earned. Warning/error logs are empty; no issue was submitted.

The matching ZIP is itch.io upload `19400641`, displayed as **Recoil Foundry 3.0.5 — Dead Signal**. Its public game starts normally and About shows 3.0.5. Continue daily and the Room 1 checkpoint remain intact with zero discoveries, victories, blueprints and records. Warning/error logs are empty. No public save was replaced or seeded with fixtures. Publication checks are complete.
