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

Additional retry/result, persistence and publication evidence follows after verification. These are agent-controlled checks, not independent human feedback or new physical-device acceptance.
