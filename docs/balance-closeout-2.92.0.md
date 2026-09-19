# Balance closeout — release item 1

19 September 2026. The balance implementation and automated validation are complete. Item 1 is removed from the [active release checklist](browser-release-checklist.md). This report keeps the completed work and its limits; actual player acceptance remains in the external playtest gate. No human sessions or hardware benchmarks are claimed here.

The [original audit](balance-audit-2.92.0.md) retains 232 cases, 368 room/escape visits, the opening reward safeguard, Shaped Charge and Cluster Shell tuning, compatibility coverage for all 1,024 maximum builds, known-exploit checks, and full normal/Daily/Overtime combat regressions. This closeout does not change gameplay, Daily ruleset 78 or version 2.92.0.

## Design targets

The browser release keeps twenty rooms and five areas. Aim for a **20–30 minute successful main-route run** by a player familiar with the controls, including upgrade decisions. Optional routes can take longer; Overtime is a deliberate extension. These are design targets to validate with players, not estimates derived from accelerated simulation.

For a newcomer familiar with keyboard/mouse action games, target a first normal win after roughly **3–8 attempts**, with visible improvement between attempts. Experienced roguelike players may win sooner. Avoid mandatory grinding or permanent stat bonuses. Later areas and bosses should punish repeated mistakes, while movement, firing position and upgrade choices offer a way to recover. Do not make every random build equally strong or shorten the campaign to force these targets.

## Follow-up decisions

All 41 follow-up cases, including failures, are saved in [the machine-readable results](balance-closeout-2.92.0.json).

| Question                                                     | Measurement                                                                                                                                                                                                                                                                                         | Decision                                                                                                                                                                                                          |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Are Shaped Charge and Cluster Shell stuck at the final boss? | With a 150-second input budget, Shaped clears in 108.0 simulation seconds with 34 HP; Cluster clears in 107.55 seconds with 86 HP.                                                                                                                                                                  | Keep the 2.92 damage changes. The old 90-second limit cut off both viable fights. Add victory regressions for both.                                                                                               |
| Is Storm Cell doing useful damage against a moving boss?     | The unchanged preset deals 4,693.5 of 5,850 HP before dying at 109.22 seconds. Its ordinary-room case already clears.                                                                                                                                                                               | Retain its crowd-control specialization. This pilot loss does not establish a broken weapon or justify another damage increase. Trap placement and perceived boss pacing remain explicit external playtest cases. |
| Why did two Recall campaigns stall?                          | The pilot was aiming at overhead motors from outside Recall's return distance. It now closes distance and uses recoil ascent while preserving boss dodge responses. The two cases end in combat deaths, with Crane at 475 HP and Press at 306 HP, instead of timing out without sustained progress. | Preserve Recall's short-range tradeoff. The pilot limitation is addressed; these are not claimed as victories or proof of comfortable human positioning.                                                          |
| Can optional content be entered with reduced health?         | Eighteen Auditor preset fights across three pursuit phases, three builds and 100/60 starting HP all defeat the Auditor. Fourteen of sixteen detour fights clear; nine of those also beat the immediately following boss with carried health.                                                        | Keep the optional risk. The Rooftops utility build dies in the detour at both health levels; other losses occur at the following bosses. Detour bonuses never add healing.                                        |
| Does the secret finale work as one continuous encounter?     | All three waves and all three controls are completed using normal movement, jumps and shots. A 100-HP entrance finishes at 86; a 60-HP entrance finishes at 80.                                                                                                                                     | Add the low-health route as a regression. Bloodwork can heal from actual kills; controls grant no healing or upgrades.                                                                                            |

## Coverage and limits

The optional audit uses validated checkpoints, legal stage-sized builds, real health, enemy AI and collision. Detours are followed by an actual offered upgrade and their next boss, without resetting health. This combat comparison opens the earned reward directly after a clear; physical detour-door traversal has separate existing tests. Auditor tests use its isolated yard and do not simulate three visits woven through a complete campaign; the portal preset is not an optimized portal-placement pilot. The shutdown test starts at the secret chamber, physically shoots its controls and carries damage/healing through every wave to the ending. The main campaign's relay discovery and escalation have separate progression tests.

The additional audit has no encounter timeouts. Deaths remain recorded rather than being healed away or rerun until a win. Automated survival is not a human win-rate estimate. Combined full-route feel, dense effects on real laptops, repetitive rooms and the design targets above remain part of sections 5–7 of the release checklist.

## Validation

**1,507 tests passed, with no failures or skips.** The production build passed. The added regressions cover Shaped Charge and Cluster Shell defeating the live final boss, and the low-health secret finale reaching its ending with ordinary inputs. All existing campaign and exploit tests also passed. The build produces the same gameplay assets as 2.92.0; its existing bundle-size warning remains a performance follow-up, not a failed build. Checklist checks found no completed checkboxes or item-1 section, and all local report links resolve.

## Reproduce

```powershell
npm test
npm run build
npm run balance -- optional
$env:BALANCE_FILTER = '^(storm|shaped|cluster):boss$'
$env:BALANCE_SECONDS = '150'
npm run balance -- branches
Remove-Item Env:BALANCE_SECONDS
$env:BALANCE_FILTER = '65:precision|2026-09-19:daily'
npm run balance -- campaign
Remove-Item Env:BALANCE_FILTER
```

`BALANCE_SECONDS` sets the isolated encounter input limit between 0 and 600 seconds, excluding 0. Campaigns retain their separate room/run limits.

[Play the campaign](https://caleb-guyer.github.io/recoil-foundry/?v=2.92.0) · [Shaped Charge boss test](https://caleb-guyer.github.io/recoil-foundry/?test=branches&build=shaped&room=boss&v=2.92.0) · [Cluster Shell boss test](https://caleb-guyer.github.io/recoil-foundry/?test=branches&build=cluster&room=boss&v=2.92.0) · [Secret finale test — spoilers](https://caleb-guyer.github.io/recoil-foundry/?test=shutdown&scene=finale&v=2.92.0). Isolated test links preserve campaign progress.
