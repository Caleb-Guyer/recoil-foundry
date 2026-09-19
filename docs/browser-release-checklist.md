# Full browser release checklist

Updated 19 September 2026 against 2.93.0. This is the **unfinished work list** for the browser release. Future content updates remain possible. The Unity/Steam remake is separate.

**When work is completed, remove it from this list.** Keep its evidence in a linked report or commit, not a checked-off entry. Section numbers stay stable so references to remaining work do not change. Completed balance work is archived in the [balance closeout](balance-closeout-2.92.0.md); first-session implementation and the five-scenario self-audit are archived in the [clarity report](first-session-2.93.0.md). Those implementation sections are removed. Actual first-time-player observation and human acceptance remain explicitly open in section 7.

## Scope

The launch scope is frozen after the Auditor: the twenty-room campaign across five areas, 100 upgrades and branching builds, boss variants, optional challenges and events, Daily runs, Overtime, Practice, Workshop, run recaps, death replay, the Logbook, a secret ending, and cosmetic commendations. Remaining changes are fixes, tuning and essential usability work. The [balance closeout](balance-closeout-2.92.0.md#design-targets) defines the intended difficulty and duration for external validation.

- [ ] Publish the supported browser/device/input list. Prioritize ordinary desktop/laptop play; advertise touch play only after it passes its own checks.

## 3. Progress and recovery — release blocker

Current persistence uses browser local storage. Checkpoint validation and migration exist; a user-facing backup/import flow is not present.

- [ ] Add a validated progress export/import covering the campaign checkpoint, collected upgrades, Logbook, commendations, equipped cosmetics, Practice victories and relevant personal records. Invalid imports must leave existing progress untouched.
- [ ] Explain that progress is local to this browser. Surface failed writes; do not silently imply progress was saved.
- [ ] Test Continue, death, fresh-seed retry, Daily retry, refresh during reward selection, tab closure, multi-tab changes, older saves and unavailable storage.
- [ ] Verify that all test links, Workshop and Practice remain isolated from real progress.

Acceptance: the player can back up and restore progress, update the game without losing valid records, and recover safely from a failed or invalid import.

## 4. Settings and accessibility — release blocker for advertised controls

Sound, Music and Screen shake toggles, controller options, keyboard/mouse input and touch controls already exist. Keyboard controls are currently fixed; audio has toggles rather than user-facing volume sliders.

- [ ] Add saved keyboard rebinding, duplicate-binding handling and restore defaults. Verify every active mechanic and menu can be reached with advertised inputs.
- [ ] Add separate effects and music volume controls with clear mute behavior.
- [ ] Audit focus order, modal scrolling, visible focus, controller navigation, readable scaling and reduced-motion attack warnings.
- [ ] Ensure hostile attacks, allies, interactables and danger warnings remain distinguishable by shape, motion or pattern as well as color.
- [ ] Verify pause/resume on focus loss, controller disconnect, resize and fullscreen changes.

Acceptance: settings persist, controls do not become trapped or unusable, and reduced effects preserve essential combat information.

## 5. Performance and stability — release blocker

The simulation and effects already have limits, and the automated suite covers many real collision and combat cases. This does not establish performance on a low-end laptop or compatibility with every browser.

- [ ] Test production builds in current Chrome, Edge and Firefox on Windows, plus Safari if it will be advertised. Record actual versions, device specs and results.
- [ ] Profile on a representative low-end laptop at its normal screen resolution. Use dense late-game builds, boss attacks, portals, explosions, replay recording and Overtime.
- [ ] Target stable 60 fps on the chosen baseline; investigate long frame stalls and sustained memory growth. If necessary, offer reduced visual effects that preserve physics and tells.
- [ ] Run long sessions with repeated death/retry, room transitions, menus, audio restarts and replay export. Check memory/voice cleanup and responsiveness.
- [ ] Resolve crashes, inaccessible exits, stuck encounters, lost input, invalid physics and progression softlocks before release.
- [ ] Run the complete automated suite and production build for the final candidate. Smoke-test the actual deployed assets, not only localhost.

Acceptance: no known reproducible crash, progress-loss or softlock bugs; baseline hardware remains playable in stress scenes; unsupported optional features fail gracefully.

## 6. Presentation, sound and endings — final polish

- [ ] Audit all menus at laptop sizes and narrower supported layouts, including long upgrade descriptions, reward screens, Logbook, Appearance, recaps and endings.
- [ ] Finish a consistent visual pass over silhouettes, warning effects, environment contrast, hit reactions and transitions. Keep the combat HUD minimal.
- [ ] Decide whether the existing original procedural score is the final browser soundtrack. A commissioned soundtrack can be a later update; it need not block this release if the current score is deliberately accepted.
- [ ] Mix effects, music and warning sounds across headphones and laptop speakers. Warnings must remain audible during dense combat.
- [ ] Review the normal ending, secret ending and Overtime completion as complete experiences, including readable results, rewards, return-to-menu behavior and credits.
- [ ] Proofread upgrade descriptions and lore for accuracy, consistent names and unresolved placeholders.

Acceptance: every supported screen is readable, the audio mix serves combat, and each ending gives a clear sense of completion.

## 7. External playtest and release packaging — final gate

- [ ] Recruit a small group (suggested 8–12 players, mixing newcomers and experienced roguelike players). Observe at least five first-time players without coaching: record hesitation, misunderstood interactions/deaths and quitting; verify they can leave room one, recognize a reward, explain recoil movement and find controls/settings. Use the [observation sheet](first-session-playtest.md). Ask the group about favorite builds, repetitive sections, technical issues and whether they want another run. The agent's five-scenario audit does not satisfy this human-observation check.
- [ ] Validate the documented difficulty and duration targets in real sessions across all five areas, with weak, ordinary and strong builds. Include Storm Cell against mobile bosses, short-range Recall at Crane/Press, dense effects and recovery after damage; measure first wins, run duration and reward quality.
- [ ] Include complete detour, Auditor, secret-ending and Overtime routes in those sessions, with awkward builds and low-health entrances. Judge combined difficulty, readable deaths and access to rewards; automated encounter checks do not replace this feedback.
- [ ] Triage and fix blockers, then retest affected routes/builds. Keep minor known issues in a visible list.
- [ ] Replace the changelog-heavy README landing section with a concise player introduction, controls, support information and links; retain development history separately.
- [ ] Add an in-game version/credits entry and a simple issue-report link. Include version, mode, seed and room when practical, without uploading personal data automatically.
- [ ] Prepare final screenshots, a short gameplay clip, a useful sharing preview and a public release announcement draft.
- [ ] Tag the final release, keep a rollback point, verify GitHub Pages deployment and publish accurate release notes and supported platforms.

Acceptance: the release candidate passes the checklist, a fresh player can start from the public link, known limitations are clear, and regressions can be reported and rolled back.

## Work order

1. Run first-session playtests and start collecting the external balance feedback.
2. Address those findings alongside progress backup and settings gaps.
3. Complete browser/hardware checks and presentation/audio polish.
4. Finish external release acceptance, fix blockers, tag and publish the full browser release.

Cloud accounts, online leaderboards, multiplayer, more areas, more upgrade trees, a longer campaign, commissioned music and the Steam remake can remain future work. None is required to call this browser game complete.
