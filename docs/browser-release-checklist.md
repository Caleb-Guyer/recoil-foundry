# Full browser release checklist

Planning baseline: 2.91.0, 19 September 2026. This records proposed release requirements, not completed sign-off. Future content updates remain possible. The Unity/Steam remake is separate.

Latest update: **2.92.0 — balance engineering pass completed**. Checked items below have supporting automated evidence; human playtesting and release acceptance remain open. See the [balance report and measurements](balance-audit-2.92.0.md).

## Scope

The browser game already has a twenty-room campaign across five areas, 100 upgrades and branching builds, boss variants, optional challenges and events, Daily runs, Overtime, Practice, Workshop, run recaps, death replay, the Logbook, a secret ending, and cosmetic commendations. Finish and stabilize these systems before adding another major path or area.

- [ ] Freeze the launch feature list after the Auditor; accept bug fixes, tuning and essential usability work.
- [ ] Choose the intended first-win difficulty and successful-run duration. Measure real sessions against those goals instead of extending or shortening the campaign automatically.
- [ ] Publish the supported browser/device/input list. Prioritize ordinary desktop/laptop play; advertise touch play only after it passes its own checks.

## 1. Complete-run balance and pacing — release blocker

- [x] Measure legal utility-heavy, ordinary and damage-focused profiles across the five areas and all boss variants. Record damage, effective healing, rewards, density, duration, deaths and timeouts: 232 cases and 368 room/escape visits are archived in the balance report.
- [x] Run upgrade compatibility and mechanic regressions, every branch preset, and finite-physics/effect-budget checks for all 1,024 maximum combinations. Add realistic charged-weapon input to the pilots.
- [x] Repeat automated known-exploit checks: overhead/corner/cover camps, Countershot and Breach spam, portal budgets/collisions, and moving machinery pinned by players, crates, steel balls or explosions.
- [x] Complete normal and Daily combat runs using actual offered upgrades with current encounters enabled. Keep the fifteen scripted campaign/Overtime combat regressions and event, detour, secret-chamber and Auditor progression/encounter tests passing.
- [x] Apply measured, targeted tuning: preserve a shared firepower option in early rewards, strengthen Shaped Charge and Cluster Shell, retain bounded echoes/children and advance Daily to ruleset 78. Preserve the twenty-room campaign and existing boss warning windows.
- [ ] Human-play weak, ordinary and strong builds through every area; choose first-win difficulty and successful-run duration targets. Judge recovery, reward quality, readable deaths and dominant strategies in real sessions.
- [ ] Human-play complete detour, optional-pursuit, secret-ending and Overtime routes, including awkward builds and low-health entrances. Judge combined encounter difficulty and access to rewards.
- [ ] Resolve the report's human follow-ups: demolition/Storm Cell kill times against mobile bosses, short-range Recall positioning at Crane/Press, dense-build readability, and repetitive rooms. Change difficulty or layouts where that evidence calls for it.

Acceptance: multiple builds can finish; weak builds still have viable decisions; powerful builds have distinct strengths without automatic wins; failures are avoidable and understandable. Automated pilots supplement human sessions.

## 2. First-session clarity — release blocker

- [ ] Watch at least five first-time players start without verbal coaching. Record where they hesitate, misread an interaction, die without understanding why, or quit.
- [ ] Ensure the opening teaches moving, jumping, aiming, recoil flight, room completion and upgrade selection through safe situations and brief contextual guidance.
- [ ] Verify that normal exits, optional routes, the extraction lift and Overtime lift are distinguishable. Preserve hidden future encounters and lore.
- [ ] Check new mechanics such as sealed cases, relays and terminals for consistent visual language and useful feedback, without permanent objective text.
- [ ] Make controls easy to reopen and audio state easy to understand. Keep restarting fast.

Acceptance: new players can leave the first room, recognize a reward and explain recoil movement without assistance. They can find controls and settings when needed.

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

- [ ] Recruit a small group (suggested 8–12 players, mixing newcomers and experienced roguelike players). Ask them to play naturally and report confusing deaths, favorite builds, repetitive sections, technical issues and whether they want another run.
- [ ] Triage and fix blockers, then retest affected routes/builds. Keep minor known issues in a visible list.
- [ ] Replace the changelog-heavy README landing section with a concise player introduction, controls, support information and links; retain development history separately.
- [ ] Add an in-game version/credits entry and a simple issue-report link. Include version, mode, seed and room when practical, without uploading personal data automatically.
- [ ] Prepare final screenshots, a short gameplay clip, a useful sharing preview and a public release announcement draft.
- [ ] Tag the final release, keep a rollback point, verify GitHub Pages deployment and publish accurate release notes and supported platforms.

Acceptance: the release candidate passes the checklist, a fresh player can start from the public link, known limitations are clear, and regressions can be reported and rolled back.

## Work order

1. Finish the Auditor and freeze major additions.
2. Complete human balance acceptance from the 2.92.0 report and first-session playtests; the automated balance/tuning pass is complete.
3. Address those findings alongside progress backup and settings gaps.
4. Complete browser/hardware checks and presentation/audio polish.
5. Run a final external playtest, fix blockers, tag and publish the full browser release.

Cloud accounts, online leaderboards, multiplayer, more areas, more upgrade trees, a longer campaign, commissioned music and the Steam remake can remain future work. None is required to call this browser game complete.
