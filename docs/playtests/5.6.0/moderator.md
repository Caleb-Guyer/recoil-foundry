# 5.6.0 playtest — moderator and triage sheet

**Status: recruitment open; zero human sessions logged.** Target 5–10 willing first-time players, with returning players tracked separately. The public devlog invites volunteers; this file does not claim anyone has been recruited or observed. The ten slots below are placeholders.

Give participants only the [normal game link](https://caleb-guyer.itch.io/recoil-foundry) and permission to play normally for about ten minutes or stop sooner. Do not demonstrate recoil, select upgrades, reveal encounters or suggest retrying. Observe their own choices. If they ask for help, record when it was provided and mark the session assisted.

Keep 5.6.0 as the baseline for a batch. If a critical defect requires an update, record the new version and keep those observations separate. Do not erase a player's save; use willing genuine newcomers for first-session observations. No artificial progress fixtures or unlocked preview links are part of this test.

## Log actual sessions

Use anonymous IDs. Record browser/input, approximate duration and existing roguelike experience. Note whether the player watched the trailer, read controls or received help. These exposures affect interpretation and are not grounds to discard an honest report.

| Slot | Status      | Version / browser / input / duration | First time / prior exposure | First room / first upgrade | First confusion or death / assistance | Restart opportunity / actual action | Their reason for continuing or stopping |
| ---- | ----------- | ------------------------------------ | --------------------------- | -------------------------- | ------------------------------------- | ----------------------------------- | --------------------------------------- |
| P01  | Not started | —                                    | —                           | —                          | —                                     | —                                   | —                                       |
| P02  | Not started | —                                    | —                           | —                          | —                                     | —                                   | —                                       |
| P03  | Not started | —                                    | —                           | —                          | —                                     | —                                   | —                                       |
| P04  | Not started | —                                    | —                           | —                          | —                                     | —                                   | —                                       |
| P05  | Not started | —                                    | —                           | —                          | —                                     | —                                   | —                                       |
| P06  | Not started | —                                    | —                           | —                          | —                                     | —                                   | —                                       |
| P07  | Not started | —                                    | —                           | —                          | —                                     | —                                   | —                                       |
| P08  | Not started | —                                    | —                           | —                          | —                                     | —                                   | —                                       |
| P09  | Not started | —                                    | —                           | —                          | —                                     | —                                   | —                                       |
| P10  | Not started | —                                    | —                           | —                          | —                                     | —                                   | —                                       |

For each actual session, note the earliest concrete point of hesitation and what the player does next. Look for their understanding of recoil, upgrade choices, attack warnings and the next objective without leading them toward those answers. Only assess bosses, rewards or routes they actually reach; otherwise record **not reached**.

Ask the [three player questions](README.md) after play. Keep the player's words separate from your interpretation. A wish to retry is self-reported intent, not an observed restart. Remote comments and issue forms are self-reports unless a session was actually observed. Record the report URL and count a player only once when they use both channels.

## Choose up to three fixes for 5.6.1

Fix reproducible crashes, save loss, inaccessible controls or blocked progress first; one severe repeatable defect does not need several reports. For clarity and balance changes, look for the same concrete friction across independent sessions, then reproduce it using the reported version, seed, room and build.

| Priority | Evidence / independent reports | Reproducible trigger | Small proposed fix | Retest / result |
| -------- | ------------------------------ | -------------------- | ------------------ | --------------- |
| 1        | Awaiting feedback              | —                    | —                  | Not tested      |
| 2        | Awaiting feedback              | —                    | —                  | Not tested      |
| 3        | Awaiting feedback              | —                    | —                  | Not tested      |

Report denominators: “2 of 3 observed players with a restart opportunity restarted.” A player who never reaches a result is not a failed retry. Keep assisted sessions, returning players and self-reports explicit. This small round guides investigation; it does not establish population-wide retention or a universal difficulty rating.

Do not promise a patch deadline or choose changes before evidence arrives. If there is no repeatable issue, leave the tested build stable. Record retests of the affected flow when fixes are made.
