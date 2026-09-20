# itch.io launch

**Published 20 September 2026:** [Play Recoil Foundry on itch.io](https://caleb-guyer.itch.io/recoil-foundry). The uploaded build is the complete browser release, **2.98.0**, unchanged from the stable GitHub release. Project ID: `5033600`. No recruitment messages or player feedback have been recorded.

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
- Screenshots: Loading Docks, Furnace Halls, Cooling Works from [the media kit](../release-media.md).
- Video: use the actual MP4 link in the description. The trailer field only accepts supported video hosts; it is not a YouTube upload.
- AI disclosure: Yes, with Code and Text & Dialog selected. The game uses code-drawn art and procedural audio; no image or audio generation model assets are used.
- Theme: background `#0a1419`, content `#142127`, text `#e9eadc`, links/buttons `#acc3b6`. Simple sans-serif typography, visible screenshots, no additional decorative background.
- Embed: click to launch fullscreen, with scrollbars off and Loading Docks as the launch background. Screenshots use the sidebar layout; comments are enabled.

The uploaded file is the existing [stable release ZIP](https://github.com/Caleb-Guyer/recoil-foundry/releases/download/v2.98.0/recoil-foundry-v2.98.0-site.zip), not the repository or this launch folder. It has `index.html` at its root and uses relative asset URLs. SHA-256: `595985cd384363fbfce714213bc0415638d12b44c17c9ff5e6cda3b837daf13a`.

## Sharing with classmates

Send personally to 5–10 willing classmates. Do not reveal late encounters or coach their first run.

> I made a free browser game called Recoil Foundry. You build one gun, and its recoil throws you around while you fight through a factory. Try it on a laptop with a mouse: https://caleb-guyer.itch.io/recoil-foundry
>
> After a run, tell me what was fun, what was confusing or unfair, and whether you wanted another go. Honest answers help me decide what to fix next.

Use the [first-session sheet](../first-session-playtest.md) for observations and the [feedback packet](../external-playtest-packet.md) for longer sessions. Record anonymous IDs and actual comments. Fix reproducible broken behavior first; use recurring feedback to guide balance or clarity changes.

## Launch verification

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
