# Dead Signal 3.0 publication

Published 25 September 2026 with the owner's authorization. Runtime commit: `50f9c5a514255994fb60d13d620161d4ba90c936`; immutable stable tag: `v3.0.0`. Previous stable rollback reference: `v2.98.1`.

## Build and artifact

- Local regression suite: **1,885 passed, zero failed/skipped**, 308.2 seconds. TypeScript and Vite production build passed; the existing large-chunk advisory remains.
- [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36161216441) tested, built and deployed that exact main commit successfully before tagging.
- [Release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36162154559) passed the same-commit deployment gate and published the [stable release](https://github.com/Caleb-Guyer/recoil-foundry/releases/tag/v3.0.0).
- Downloaded artifact: `recoil-foundry-v3.0.0-site.zip`, **9,750,667 bytes**. SHA-256 `14f89d176a9aa06699ca95aecc54646c6344b65a9d9e8c1b5cbb41da2e4f1a39`, verified against GitHub's asset digest.
- ZIP inspection: 17 files, 10,498,649 uncompressed bytes, root `index.html`, all four relative entry assets resolve. No source, development harness, dependencies or private files. The additional file is the optional update trailer; startup does not load it.

## Public smoke checks

Checks used the available in-app browser, preserving the existing saves. They are bounded publication checks, not a new full human campaign or hardware certification.

| Check | GitHub Pages | itch.io |
| --- | --- | --- |
| Public version | About and Report an issue show 3.0.0 | Actual store iframe About and Report an issue show 3.0.0 |
| Existing progress before/after | Continue; Room 2, 1 upgrade discovered, 0 Practice victories | Continue daily; Room 1, 0 upgrades discovered, 0 Practice victories |
| Gameplay input | Warm-up jump/fire render correctly | Same, inside the store iframe |
| Pause/reset/menu | Warm-up reset and return to menu work | Same; Continue daily remains available |
| Audio settings | Sound and Music remain on, both volumes 100%; no audio startup warning | Same |
| Reward flow | Isolated reroll preset: Escape preserves the reward, reroll spends 12 health, selection enters gameplay and pause works | Same preset on the published itch-hosted game file |
| New route | Public fork preset renders separate Annex/Cooling exits; Broadcast Floor preset enters room 9 and pauses/resumes | Same verified release artifact; route progression is covered by the existing automated campaign and route suite |
| Browser warnings/errors | None recorded in these checks | None recorded in these checks |

No normal or Daily run was started over during these checks. The actual itch.io iframe is `https://html-classic.itch.zone/html/19397514/index.html`; its upload ID is **19397514**. The replacement retained the previous transport filename `recoil-foundry-v2.98.0-site.zip`, with display name **Recoil Foundry 3.0 — Dead Signal**. Its bytes are exactly the verified 3.0 release ZIP. Browser playback is enabled; free/public/fullscreen settings remain in place.

## Presentation

The itch.io page now opens with **Dead Signal is here**, describes 105 upgrades and the new route, and links the public 23-second trailer. The three new gameplay images lead the existing screenshots. A rich-text editor synchronization issue was caught by checking the public page and corrected before publication of the [launch devlog](https://caleb-guyer.itch.io/recoil-foundry/devlog/1676915/dead-signal-is-here-recoil-foundry-30). The devlog is published with the final title card, three new screenshots and spoiler-light copy. No YouTube upload or direct recruitment messages were sent.

The final trailer uses the original game score and real engine effects, closes with **Play now**, and fully decodes all 1,380 frames at 1080p/60. Encoded audio measures −15.4 LUFS integrated and −1.4 dBTP. Its public MP4 played all 23 seconds at 1920×1080 to its ended state, with no media error or browser warning. Technical audio checks are not headphone/speaker listening approval.

## Limits retained

The [balance report](../plans/dead-signal-balance.md) retains the campaign probes, pilot navigation timeouts, modest-build difficulty limits and performance measurements. Independent first-time-player feedback, listening approval and physical low-end testing remain unavailable. These are disclosed limitations, not completed human tests. The owner authorized this publication; no release work remains on the weekend checklist. Future feedback can guide patches without reopening completed deployment work.
