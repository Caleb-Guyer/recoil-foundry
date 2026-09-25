# Dead Signal launch kit

Staged on `feature/dead-signal`, using **3.0.0-rc.2**. No public build, announcement, video, screenshot or store-page change has been published by this work.

Open [the review page](index.html) through a local static server to watch the teaser and inspect the images. It is documentation, excluded from the playable site's build.

| Asset                                                 | Format                                                 |
| ----------------------------------------------------- | ------------------------------------------------------ |
| [Teaser](Recoil-Foundry-Dead-Signal-Teaser.mp4)       | 23 seconds, 1920 × 1080, 60 fps, H.264 MP4, stereo AAC |
| [Transmission](01-transmission.png)                   | 1920 × 1080 PNG                                        |
| [Recoil climb](02-recoil-climb.png)                   | 1920 × 1080 PNG                                        |
| [Subversion](03-subversion.png)                       | 1920 × 1080 PNG                                        |
| [Teaser cover](Dead-Signal-Teaser-Cover.png)          | 1920 × 1080 PNG                                        |
| [Upload text and image descriptions](upload-text.txt) | Coming-soon copy; not posted                           |
| [Launch announcement](announcement.md)                | Launch-day draft; publish only after host verification |

## Editorial approach

The opening observes a real live junction before its transmission begins. The first musical bar enters quietly, the first combat cut arrives with the rhythm section, and the following cuts follow four/eight-beat boundaries at 112 BPM. A fallen red machine reboots blue on a beat. The complete eight-bar phrase resolves from its final dominant to D minor on the title reveal at 18.217 seconds. The final title holds, then picture and music fade to silence.

The music is a trailer arrangement of the game's original **“Orders After Hours”**, rendered with the production synthesizer. Effects come from actual game events and the production `Sound` voices. No third-party song, external samples, voice-over or synthetic footsteps were added. The trailer does not show or name the new boss.

## Capture and verification

[Capture manifest](capture.json) records seeds, builds, source frame windows, editorial cuts, real health, reboots and effect cues. Gameplay uses the real `Game`/`Renderer` and scripted controls; the camera is framed for the edit. No invulnerability, rewritten enemy attacks, frozen enemies, fabricated projectiles or speed changes. The small HTML HUD is reproduced from simulation values. These are engine captures, not human playtest or browser-performance evidence.

The four selected takes contain zero blocked-fire frames under the capture driver's ray checks. Their longest stationary periods are at most 11 frames; ordinary targeting, recoil and cover remain active. The conversion take shows a blue ally on screen for 193 of its 257 frames. All three final stills, the opening/action/title contact sheet and the title card were visually inspected. A full decode completed all 1,380 frames. The encoded audio measures **−15.4 LUFS integrated / −1.4 dBTP**; no clipping was detected. This is technical audio verification, not a claim of headphone/speaker listening approval.

The title-screen link is optional and never opens automatically. Back and Escape return focus to it. The menu and notes were inspected at 1280 × 720, 390 × 700, and a short 844 × 390 title viewport; the short menu remains scrollable. No combat overlay was added. The extracted rc.2 ZIP passed startup, update-dialog dismissal, About/version and route-start/pause checks. The in-app browser played the MP4 through all 23 seconds to its ended state; media-page and packaged-game warning/error logs were empty. All 1,885 existing tests and the production build pass; Vite retains the existing large-chunk advisory.

## Rebuild

Use Node 24, project dependencies, `@napi-rs/canvas@0.1.100`, `web-audio-engine@0.13.4`, and FFmpeg with libx264. These optional native tools are development-only. `MEDIA_MODULE_ROOT` points to a directory whose dependencies include the canvas package; `MEDIA_FONT_DIR` points to the local font directory containing Arial, Arial Bold and Consolas; `FFMPEG` points to the encoder executable. Install the audio dependency separately in `.media-tools/audio`.

```sh
node --experimental-strip-types scripts/dead-signal-media.ts --storyboard
node --experimental-strip-types scripts/dead-signal-media.ts
```

The default output is `../recoil-foundry-dead-signal-launch`; override it with `SIGNAL_MEDIA_OUT`. The checked-in [take survey](takes.json) selects the inputs; `surveySignalTakes()` in `scripts/dead-signal-scenes.ts` can regenerate it. Review generated media before copying the final files here. Raw WAVs, temporary renders and contact sheets stay outside the game/repository distribution.

The local review media and candidate site have separate ZIPs. Do not upload the launch kit as the playable itch.io game. At release, use the candidate site's ZIP and the established [promotion procedure](../../release-operations.md). Keep the existing public `v2.98.1` as the rollback reference until promotion succeeds.
