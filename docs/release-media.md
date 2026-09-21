# Release media

The stable release also has a [45-second trailer with a mysterious factory opening, beat-synced gameplay, audible combat effects, a musical title reveal, licensed music, a thumbnail, and upload copy](trailer/README.md).

Prepared for 2.98.0-rc.1. These images and the silent clip show normal enemies and the first three areas; final encounters, secrets and endings are excluded.

Also used for stable 2.98.0, which preserves the candidate's combat and visuals. The capture manifest retains its actual recording version.

| Asset          | Format                                           | Link                                                                     |
| -------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| Loading Docks  | 1280 × 720 PNG                                   | [Image](../public/media/loading-docks.png)                               |
| Furnace Halls  | 1280 × 720 PNG                                   | [Image](../public/media/furnace-halls.png)                               |
| Cooling Works  | 1280 × 720 PNG                                   | [Image](../public/media/cooling-works.png)                               |
| Gameplay       | 18 seconds, 1280 × 720, 30 fps H.264 MP4, silent | [Watch](https://caleb-guyer.github.io/recoil-foundry/media/gameplay.mp4) |
| Social preview | 1200 × 630 PNG                                   | [Image](../public/media/social-card.png)                                 |

The title page provides Open Graph and Twitter card metadata, an absolute public image URL and descriptive alternative text. Platforms control their own caches and previews.

The [itch.io launch kit](itch-io/README.md) includes a 1260 × 1000 cover and 1600 × 450 header using the same wordmark and Loading Docks engine capture. These store assets live in the documentation folder and are not added to the playable site's download.

## Capture method

`scripts/release-media.ts` drives the actual `Game` and `Renderer` using fixed seeds, legal isolated checkpoints and scripted controls. Health, recoil, enemies and collisions remain active. No player invulnerability, enemy freezing or invented combat effects. The browser's small HTML HUD is drawn from current game values for the offline render. These are engine captures, not evidence of human playtests or browser performance. The clip is silent and cannot verify audio.

[Capture manifest](../public/media/capture.json) records version, seeds, checkpoint stages, builds, output size and ending health. Fonts are used only for rendering, not redistributed. No personal saves or profiles are captured.

## Rebuild

Run from the repository using Node.js 24 and installed project dependencies. Install `@napi-rs/canvas@0.1.100` separately for the offline script; `MEDIA_MODULE_ROOT` may point at an existing node_modules directory. Set `FFMPEG` to an FFmpeg executable with libx264 support to also encode video; without it only images and the manifest are generated. The original capture used the FFmpeg binary distributed by `imageio-ffmpeg==0.6.0`.

On Windows, set `MEDIA_FONT_DIR` to `C:/Windows/Fonts` for Arial, Arial Bold and Consolas. Otherwise the renderer uses installed fallback fonts. Then run:

```sh
node --experimental-strip-types scripts/release-media.ts
```

Inspect all three images and the sharing card after rebuilding, and decode the full MP4 to confirm it is intact. These development-only native dependencies are not included in the playable site.
