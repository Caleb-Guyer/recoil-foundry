# Opening and replay-flow self-audit — 3.0.2

25 September 2026. The owner asked the agent to perform the proposed player test. This records technical checks and an agent's UI inspection. **No independent participants were recruited or observed. No enjoyment, voluntary-restart rate, or newcomer difficulty result is claimed.**

## Result and release decision

No new reproducible progression or UI blocker was found in this bounded pass. Keep the published 3.0.2 build stable. There is no gameplay change or 3.0.3 release from this audit. Human feedback is still unavailable; the prepared [session sheet](../playtest-3.0.2.md) is ready when participants are available. This does not reopen the closed browser-release checklist.

## Browser observations

Used the verified release ZIP from runtime commit `0bc55580cf8878908731d53bd4670129a470ada8`, extracted and served on a fresh localhost origin in the available Chromium-based in-app browser, at its normal 1280×720 viewport. ZIP SHA-256: `4f6ceda05b8b41bac8411c5db3c58bfacdb2526a0f026d7dee4b15ffeb102e18`. Public-host saves were not touched.

| Flow              | Actual observation                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fresh profile     | Play, Daily run, Workshop and Learn to play are available. Title includes the short “Shoot down. Go up.” cue. No Continue or earned Practice entries appear on the clean profile.                                                                                                                                                                                                                      |
| Warm-up           | Entered through Learn to play. Movement/jump/fire inputs advanced the guide to the recoil cue; jumping and firing downward advanced it to the target exercise. Controls explains airborne recoil with a diagram. Back restores the warm-up; Done restores the title. Target destruction and full completion are covered by the automated simulation, not claimed as completed in this browser session. |
| First room        | Started a normal campaign with the starting gun. The temporary movement hint appeared, then expired. Pause focused Resume. Sound and Music were enabled.                                                                                                                                                                                                                                               |
| Death and restart | Intentionally took no combat action; enemies killed the player in room 1, at 0:22. The result focuses Again and offers Menu, Watch replay and Feedback. Feedback correctly shows dead state and seed `11S9DQW`, docks/staggered. Again starts seed `1G2JJI`, docks/terraces; the new report is paused with the starting gun. This tests restart behavior, not willingness to restart.                  |
| Upgrade choice    | The isolated reroll preset shows Backblast, Burst fire and Shellshock, with readable descriptions, three cards and the explicit 12-health reroll cost. Reroll replaces all three with Bank shot, Banker and Hair trigger; it becomes disabled, announces the cost, and focuses the heading. Choosing Bank shot resumes gameplay.                                                                       |
| Regional fork     | The isolated cleared fork visibly has amber Annex above, teal Cooling below, illuminated steps and an upward arrow. The camera settles with both labels visible. Physical traversal and route selection are covered by the tests below. This inspection does not establish that an uncoached player notices or chooses Annex.                                                                          |
| Console           | Both audit tabs had zero captured warning/error entries. No GitHub issue was submitted.                                                                                                                                                                                                                                                                                                                |

## Five normal opening probes

Reproduce with `node --experimental-strip-types scripts/first-session-audit.ts` from the repository root. The script writes `.release-assets/first-session-3.0.2.json`. [Recorded raw output](first-session-3.0.2/openings.json) preserves every offered and selected card, layout, time and health value.

These are five seeds using the **same existing skilled campaign pilot**, not five people or simulated personality types. Each starts a normal campaign at room 1 with 100 health and no upgrades. Movement, aiming, fire and exits use normal simulation input. The policy always chooses the leftmost offered card; it uses no rerolls, health grants, enemy removal or physics overrides. The probe stops at room 4, death or 240 simulated seconds. The pilot knows terrain, targeting and encounter rules and can react every tick. It does not model reading time, confusion or beginner reflexes.

| Seed          | Result         | Simulated seconds | Health at room 4 | Selected upgrade IDs             |
| ------------- | -------------- | ----------------- | ---------------- | -------------------------------- |
| OPENING-302-1 | Reached room 4 | 45.6              | 100              | airshot, tripwire, kick          |
| OPENING-302-2 | Reached room 4 | 34.9              | 67               | deadeye, mass-driver, deadlock   |
| OPENING-302-3 | Reached room 4 | 40.2              | 100              | crossfire, vector, ricochet      |
| OPENING-302-4 | Reached room 4 | 75.9              | 100              | tether, crossfire, convergence   |
| OPENING-302-5 | Reached room 4 | 41.2              | 96               | crossfire, ricochet, convergence |

All fifteen reward screens contained three distinct legal options, and all five resulting builds were legal. No run died or timed out. These data show functioning opening progression and varied offers in this sample. They do not establish human win rate, enjoyment or adequate difficulty. The freight-crossing seed took longer; a single pilot trace is insufficient evidence for a pacing change.

## Focused regression checks

`node --experimental-strip-types --test tests/first-session.test.ts tests/progress.test.ts tests/annex-route.test.ts tests/issue-report.test.ts`

**110 passed, zero failed/skipped**, 6.64 seconds. Includes actual-input completion of all warm-up lessons and isolation from progress; guide expiry and mode boundaries; normal fresh retry versus fixed Daily seed; reward/save restoration; both physical regional exits and threshold safety; legal optional Subversion offers; Annex continuations; and editable report context. The full 1,891-test release result remains recorded in the [3.0.2 publication evidence](run-feedback-3.0.2.md); it was not rerun for this documentation-only game review.

## What remains unknown

Whether new players discover recoil without coaching, which choices they find exciting, whether they voluntarily restart, and whether they notice the Annex. Automated success is not a substitute for those observations. Existing beam-boss weaknesses from the [3.0.1 technical audit](dead-signal-3.0.1.md) remain a hypothesis to investigate if reproduced in play; this opening probe does not resolve them. No new physical hardware or separate browser certification is claimed.
