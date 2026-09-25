# Dead Signal player session sheet

**Build: 3.0.2. Human sessions recorded: 0.** The completed [agent self-audit](validation/first-session-3.0.2.md) is separate. This sheet is for the moderator; do not show its observation goals to the player. Keep the live build stable during a batch of sessions.

## Invitation draft

> Want to try my browser game? Play however you normally would, and stop whenever you want. Afterward, tell me what you liked and what got in your way. You don't need to be good at it: https://caleb-guyer.itch.io/recoil-foundry

This draft has not been sent. Aim for 5–10 willing first-time players with a mix of roguelike experience. Do not require a GitHub account or collect personal details. Record anonymous IDs only. Prefer a browser profile without previous game progress; never erase someone's save for this test.

## Observe without coaching

Allow about 10–15 minutes, or stop whenever the participant wants. Do not explain recoil, choose upgrades, suggest another run, or mention the Annex before they discover it. If they ask for help, record what happened before helping. A session with coaching remains useful; mark it as assisted rather than silently counting it as unassisted.

Record the first thing that obstructs play, how they respond, what upgrade they choose and why, their first death or stopping point, and whether they choose Again on their own. Record attempts to restart even if an interface problem prevents them. A player who reaches neither death nor victory has no restart opportunity; do not count that as a refusal.

Only assess the Annex if they naturally reach the regional fork. Otherwise mark it **not reached**, not missed. If they reach it, note whether they visibly inspect the upper exit and which door they choose. Do not reveal future encounters.

| ID  | Version / browser / input | Experience / starting choice | Room 1 / recoil observation | Chosen upgrade / their reason | End point / confusion / assistance | Restart opportunity / unprompted attempt? | Fork reached / noticed / route |
| --- | ------------------------- | ---------------------------- | --------------------------- | ----------------------------- | ---------------------------------- | ----------------------------------------- | ------------------------------ |
| 01  | Not tested                | —                            | —                           | —                             | —                                  | —                                         | —                              |
| 02  | Not tested                | —                            | —                           | —                             | —                                  | —                                         | —                              |
| 03  | Not tested                | —                            | —                           | —                             | —                                  | —                                         | —                              |
| 04  | Not tested                | —                            | —                           | —                             | —                                  | —                                         | —                              |
| 05  | Not tested                | —                            | —                           | —                             | —                                  | —                                         | —                              |
| 06  | Not tested                | —                            | —                           | —                             | —                                  | —                                         | —                              |
| 07  | Not tested                | —                            | —                           | —                             | —                                  | —                                         | —                              |
| 08  | Not tested                | —                            | —                           | —                             | —                                  | —                                         | —                              |
| 09  | Not tested                | —                            | —                           | —                             | —                                  | —                                         | —                              |
| 10  | Not tested                | —                            | —                           | —                             | —                                  | —                                         | —                              |

## Ask afterward

- What did you think was making you move through the air?
- Which upgrade changed how you played? Was there one you regretted?
- What felt confusing or unfair?
- What made you continue or stop?

Keep their wording separate from the moderator's interpretation. A stated desire to play again is not the same as an observed unprompted restart.

For a reproducible problem, use **Feedback** after the run or **Pause → Report an issue**. Choose Bug, Difficulty or Suggestion. The player can edit details and use **Copy details** to share them directly with the owner if they do not want a GitHub account. Do not ask them to post empty templates or private information. Record version, seed, room, route, build, steps and outcome with the observation.

## Choose a focused patch

Fix reproducible crashes, save loss, blocked progress or inaccessible core actions first. For clarity or balance changes, look for a repeated concrete problem across independent sessions, then reproduce it in the recorded seed/build. One severe reproducible defect need not wait for more participants.

Summarize counts with their denominator: “2 of 3 players with a restart opportunity restarted,” not “40% retention” from five sessions when two never reached a result. Keep assisted sessions and not-reached forks explicit. Small samples suggest where to investigate; they do not establish population-wide ratings.

Choose at most three evidence-backed fixes for 3.0.3. Each needs an observed trigger, a small proposed change and a retest. If no repeatable issue emerges, keep 3.0.2 stable. Do not add another feature solely to fill a patch.
