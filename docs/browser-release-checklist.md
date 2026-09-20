# Full browser release checklist

Updated 20 September 2026 against 2.98.0-rc.1. This is the **unfinished work list** for the browser release. Future content updates remain possible. The Unity/Steam remake is separate.

**When work is completed, remove it from this list.** Keep its evidence in a linked report or commit, not a checked-off entry. Section numbers stay stable so references to remaining work do not change. Completed balance work is archived in the [balance closeout](balance-closeout-2.92.0.md); first-session implementation and the five-scenario self-audit are archived in the [clarity report](first-session-2.93.0.md). Those implementation sections are removed. Actual first-time-player observation and human acceptance remain explicitly open in section 7.

Completed progress/recovery item 3 is archived in the [recovery report](progress-recovery-2.94.0.md), covering backups, atomic restore, visible saving failures, older saves, competing tabs and isolated modes.

Completed settings/accessibility item 4 is archived in the [settings report](settings-accessibility-2.95.0.md), covering saved key bindings, separate volumes, menu focus/scrolling, reduced effects, non-color ally markers and input safety.

Item 5 is closed under the owner's requested scope in the [performance/stability closeout](performance-closeout-2.96.1.md). Available software checks passed; unavailable hardware tests and further browser checks are explicitly deferred or waived. The [support list and known limitations](browser-support.md) are published. This records release scope and evidence without claiming that skipped tests passed or unresolved performance issues were fixed.

Presentation implementation (item 6) is archived in the [presentation report](presentation-2.97.0.md): responsive menus, ending/credits navigation, warning-priority audio and copy review. The original procedural score is retained for the browser release. Physical headphone/laptop-speaker listening remains explicitly open in the external acceptance gate below; software checks are not listening evidence.

## Scope

Item 7's release packaging is complete in the [candidate closeout](release-packaging-2.98.0-rc.1.md): player README, manual issue reporting, media/sharing preview, announcement draft, release notes and version/rollback packaging. Those tasks have been removed below. The owner requested best effort without unavailable human feedback. The candidate is explicitly labeled a prerelease; unperformed human acceptance is not marked passed.

The launch scope is frozen after the Auditor: the twenty-room campaign across five areas, 100 upgrades and branching builds, boss variants, optional challenges and events, Daily runs, Overtime, Practice, Workshop, run recaps, death replay, the Logbook, a secret ending, and cosmetic commendations. Remaining changes are fixes, tuning and essential usability work. The [balance closeout](balance-closeout-2.92.0.md#design-targets) defines the intended difficulty and duration for external validation.

## 7. External acceptance — remaining after release-candidate packaging

- [ ] Recruit a small group (suggested 8–12 players, mixing newcomers and experienced roguelike players). Observe at least five first-time players without coaching: record hesitation, misunderstood interactions/deaths and quitting; verify they can leave room one, recognize a reward, explain recoil movement and find controls/settings. Use the [observation sheet](first-session-playtest.md). Ask the group about favorite builds, repetitive sections, technical issues and whether they want another run. The agent's five-scenario audit does not satisfy this human-observation check.
- [ ] Validate the documented difficulty and duration targets in real sessions across all five areas, with weak, ordinary and strong builds. Include Storm Cell against mobile bosses, short-range Recall at Crane/Press, dense effects and recovery after damage; measure first wins, run duration and reward quality.
- [ ] Include complete detour, Auditor, secret-ending and Overtime routes in those sessions, with awkward builds and low-health entrances. Judge combined difficulty, readable deaths and access to rewards; automated encounter checks do not replace this feedback.
- [ ] Listen on physical headphones and laptop speakers during ordinary and dense combat. Check warning audibility, fatigue, relative effects/music levels and ending cues. This listening check from item 6 is grouped here with human acceptance; it has not been performed or waived.
- [ ] Triage any blockers found by the external sessions, fix them and retest affected routes/builds. The issue-report flow, [triage procedure](release-operations.md) and [visible limitations](browser-support.md) are already in place.
- [ ] Promote the verified candidate to a stable release after human acceptance, or after an explicit owner decision to accept the documented uncertainty. The candidate tag, rollback point and prerelease notes are already provided; do not label unavailable tests as passed.

Acceptance: the release candidate passes the checklist, a fresh player can start from the public link, known limitations are clear, and regressions can be reported and rolled back.

## Work order

1. Run first-session playtests and start collecting the external balance feedback.
2. Address findings from the playtests within the published release support scope.
3. Finish external release acceptance, including the physical listening check, fix any observed blockers, then promote to a stable release. Use the [session packet](external-playtest-packet.md) when people are available.

Cloud accounts, online leaderboards, multiplayer, more areas, more upgrade trees, a longer campaign, commissioned music and the Steam remake can remain future work. None is required to call this browser game complete.
