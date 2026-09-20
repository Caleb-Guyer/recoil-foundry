# Full browser release checklist

Updated 19 September 2026 against 2.96.0. This is the **unfinished work list** for the browser release. Future content updates remain possible. The Unity/Steam remake is separate.

**When work is completed, remove it from this list.** Keep its evidence in a linked report or commit, not a checked-off entry. Section numbers stay stable so references to remaining work do not change. Completed balance work is archived in the [balance closeout](balance-closeout-2.92.0.md); first-session implementation and the five-scenario self-audit are archived in the [clarity report](first-session-2.93.0.md). Those implementation sections are removed. Actual first-time-player observation and human acceptance remain explicitly open in section 7.

Completed progress/recovery item 3 is archived in the [recovery report](progress-recovery-2.94.0.md), covering backups, atomic restore, visible saving failures, older saves, competing tabs and isolated modes.

Completed settings/accessibility item 4 is archived in the [settings report](settings-accessibility-2.95.0.md), covering saved key bindings, separate volumes, menu focus/scrolling, reduced effects, non-color ally markers and input safety. Physical-device and cross-browser acceptance remains in section 5.

## Scope

The launch scope is frozen after the Auditor: the twenty-room campaign across five areas, 100 upgrades and branching builds, boss variants, optional challenges and events, Daily runs, Overtime, Practice, Workshop, run recaps, death replay, the Logbook, a secret ending, and cosmetic commendations. Remaining changes are fixes, tuning and essential usability work. The [balance closeout](balance-closeout-2.92.0.md#design-targets) defines the intended difficulty and duration for external validation.

- [ ] Publish the supported browser/device/input list. Prioritize ordinary desktop/laptop play; advertise touch play only after it passes its own checks.

## 5. Performance and stability — release blocker

Completed software fixes, automated lifecycle checks and available-browser measurements are archived in the [performance/stability report](performance-stability-2.96.0.md). Use the [repeatable test page and acceptance procedure](performance-testing.md) for the remaining checks. These results do not establish performance on a low-end laptop or compatibility with independent browser installations.

- [ ] Test production builds in current Chrome, Edge and Firefox on Windows, plus Safari if it will be advertised. Include downloading and playing exported replay videos. Record actual versions, device specs and results.
- [ ] On those browsers, verify physical keyboard/mouse and supported controllers, including disconnect/reconnect, rumble, tab switching and native fullscreen transitions. Test real touch hardware before advertising touch support. Automated input/event tests and the in-app browser audit do not establish hardware support.
- [ ] Profile on a representative low-end laptop at its normal screen resolution. Use dense late-game builds, boss attacks, portals, explosions, replay recording and Overtime.
- [ ] Target stable 60 fps on the chosen baseline; investigate long frame stalls and sustained memory growth. If necessary, offer reduced visual effects that preserve physics and tells.

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
2. Address findings from the playtests and input/device acceptance checks.
3. Complete browser/hardware checks and presentation/audio polish.
4. Finish external release acceptance, fix blockers, tag and publish the full browser release.

Cloud accounts, online leaderboards, multiplayer, more areas, more upgrade trees, a longer campaign, commissioned music and the Steam remake can remain future work. None is required to call this browser game complete.
