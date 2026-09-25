# itch.io launch

**Dead Signal 3.0.1 published 25 September 2026:** [Play Recoil Foundry on itch.io](https://caleb-guyer.itch.io/recoil-foundry). The current build is **3.0.1**, identical to the verified stable GitHub release ZIP. Project ID: `5033600`. The [3.0 launch devlog](https://caleb-guyer.itch.io/recoil-foundry/devlog/1676915/dead-signal-is-here-recoil-foundry-30) remains public; no direct recruitment messages were sent.

## Page

- Account: Caleb-Guyer.
- Title: Recoil Foundry.
- Slug: recoil-foundry.
- Tagline: Build one absurd gun. Use its recoil to stay alive.
- Classification: Games. Kind: HTML. Status: Released. Price: free, no payments.
- Genre: Action. Relevant tags: Roguelike, Physics, Shooter, 2D, Platformer, Singleplayer.
- Language: English. Input: keyboard and mouse. Single player. Mobile-friendly and native platform claims are off.
- Accessibility: configurable controls and interactive tutorial. Session duration: about a half-hour, based on the 20–30 minute successful-run design target, not a measured player average.
- Description: [ready-to-paste HTML](description.html).
- Cover: [1260 × 1000](assets/cover.png). Header: [1600 × 450](assets/banner.png).
- Screenshots: Transmission, Recoil climb and Subversion from [the Dead Signal launch kit](../launch/dead-signal/README.md), followed by the existing Loading Docks, Furnace Halls and Cooling Works images.
- Video: use the actual MP4 link in the description. The trailer field only accepts supported video hosts; it is not a YouTube upload.
- AI disclosure: Yes, with Code and Text & Dialog selected. The game uses code-drawn art and procedural audio; no image or audio generation model assets are used.
- Theme: background `#0a1419`, content `#142127`, text `#e9eadc`, links/buttons `#acc3b6`. Simple sans-serif typography, visible screenshots, no additional decorative background.
- Embed: click to launch fullscreen, with scrollbars off and Loading Docks as the launch background. Screenshots use the sidebar layout; comments are enabled.

The uploaded file is the [3.0.1 stable release ZIP](https://github.com/Caleb-Guyer/recoil-foundry/releases/download/v3.0.1/recoil-foundry-v3.0.1-site.zip), not the repository or this launch folder. It has root `index.html`, relative assets and 17 files. SHA-256: `f2332703cd04af76bed3a4c3505a64e38058c0318b0a88bc03b588f3cbb619ec`. The replacement used the previous transport filename, `recoil-foundry-v2.98.0-site.zip`, with display name **Recoil Foundry 3.0.1 — Dead Signal**. Its bytes are the verified 3.0.1 artifact.

## Current 3.0.1 verification

[Audit and publication evidence](../validation/dead-signal-3.0.1.md) record the matching workflows, archive digest, 1,889 passing tests and public smoke checks. itch.io upload **19398338** is browser playable. Its actual store iframe shows 3.0.1 in About and Report an issue. Continue daily and Room 1 progress remain intact; warm-up jump/fire, pause, reset and return to menu passed with no browser warnings/errors. Store copy, screenshots and trailer remain the 3.0 launch presentation.

## Archived Dead Signal 3.0 verification

[Publication evidence](../validation/dead-signal-3.0.md) records successful same-commit Pages/release workflows, the downloaded archive's digest and file inspection, and live checks on both sites. itch.io upload **19397514** is browser playable. The public iframe shows **3.0.0** in About and Report an issue; **Continue daily** and its Room 1 progress remain intact after warm-up jump/fire, pause, reset and return to menu. The published itch-hosted reward test also passed Escape, reroll and selection checks. Browser warning/error logs were empty during these checks.

The public store page was checked after saving: **Dead Signal is here**, 105 upgrades, the 23-second trailer link and the new screenshots are visible. An editor synchronization issue was corrected before the announcement was posted. The launch devlog is marked **Published** and retains spoiler-light copy. These are publication smoke checks, not independent player feedback or new hardware/audio certification. Earlier release evidence below remains historical.

## Patch 2.98.1 verification

- Commit `4d579d148840a3078eb968616a6d58e0d41530b5` passed all 1,571 local tests, TypeScript and the production build. Its [Pages workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36078168553) passed before tagging, and the [release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36078834142) published `v2.98.1`.
- The downloaded ZIP matches GitHub's SHA-256 digest. Its 16 files contain 2,698,226 uncompressed bytes; `index.html` and all four relative entry assets resolve inside the archive.
- itch.io accepted the replacement as upload `19388095`. Browser playback was re-enabled, the display name updated, and the editor confirmed **Saved**. The public page remained **Published**.
- The live itch.io iframe reports **2.98.1** in About & credits. Its existing **Continue daily** entry remained available after the update. Warm-up startup, jump/fire input, pause and return to menu worked without overwriting that run. No browser warnings or errors were recorded in this smoke test.
- GitHub Pages also reports **2.98.1** in About & credits and Report an issue. Its existing **Continue** entry survived warm-up checks. The deployed reward test survived six Escape presses, a reroll, reward selection and pausing afterward.

These are patch smoke checks. The original launch and hardware evidence below retains its original scope.

## Sharing with classmates

Send personally to 5–10 willing classmates. Do not reveal late encounters or coach their first run.

> I made a free browser game called Recoil Foundry. You build one gun, and its recoil throws you around while you fight through a factory. Try it on a laptop with a mouse: https://caleb-guyer.itch.io/recoil-foundry
>
> After a run, tell me what was fun, what was confusing or unfair, and whether you wanted another go. Honest answers help me decide what to fix next.

Use the [first-session sheet](../first-session-playtest.md) for observations and the [feedback packet](../external-playtest-packet.md) for longer sessions. Record anonymous IDs and actual comments. Fix reproducible broken behavior first; use recurring feedback to guide balance or clarity changes.

## Original 2.98.0 launch verification

- The stable ZIP checksum matches the release; 16 files plus two directory entries, 2,697,193 uncompressed bytes. Root `index.html` and all four relative entry assets resolve within the ZIP, within itch.io's size and path limits.
- itch.io accepted the upload and showed **Published** after saving public visibility. An independent request without the browser's login returned HTTP 200, the expected page title, description and Run game control, and no owner panel.
- The actual itch.io iframe launched in fullscreen. Warm-up rendered; keyboard jump/fire inputs, pause/resume and return to menu worked.
- An ordinary run reported **Progress saved in this browser**. Reloading the store page retained **Continue**, which resumed the room.
- Daily Run displayed **DAILY · 01 / 20**. Its report panel showed version `2.98.0`, Daily mode and seed `RF-D78-2026-09-20` (ruleset 78).
- No game runtime errors appeared in the browser log. Two earlier warnings came from itch.io's dashboard script.
- Cover, header, launch background, three screenshots and description were inspected. Store links remained intact after save; the theme survived reload. The page was reviewed at 1440px and the normal approximately 929px browser width, then the temporary viewport override was removed.

These are launch smoke checks, not new human playtests, audio listening notes, or a complete replay/device certification. Existing [browser support limits](../browser-support.md) remain applicable. The GitHub mirror and its saves remain available.

## Artwork reproduction

Run `node scripts/itch-media.mjs` with the same optional `MEDIA_MODULE_ROOT` and `MEDIA_FONT_DIR` settings described in the [media kit](../release-media.md). The cover and header combine an existing engine capture with the established canvas wordmark. They do not depict invented gameplay or expose late encounters.

Page setup follows itch.io's [getting started](https://itch.io/docs/creators/getting-started), [HTML5 upload](https://itch.io/docs/creators/html5), and [page design](https://itch.io/docs/creators/design) documentation. Theme and upload verification must reflect the live editor, not assumed settings.
