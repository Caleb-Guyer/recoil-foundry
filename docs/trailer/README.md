# YouTube launch trailer

Revised on September 20, 2026, for the stable **2.98.0** browser release. This action edit replaces the first trailer.

- [Finished MP4](Recoil-Foundry-Launch-Trailer.mp4)
- [YouTube thumbnail](Recoil-Foundry-YouTube-Thumbnail.png)
- [Title and description to paste](upload-text.txt)
- [Capture record](capture.json)
- [Music source and attribution](music-license.md)

The video is 37.20 seconds, 1920 × 1080 at 60 fps, with an H.264 High profile progressive picture, BT.709 color, and AAC-LC stereo audio at 48 kHz. The MP4 has fast-start metadata. The thumbnail is a 1920 × 1080 PNG. Include the music credit from the supplied description when uploading. This package does not publish to a YouTube account.

## Edit

| Time      | Content                                                        |
| --------- | -------------------------------------------------------------- |
| 0:00–0:06 | Cluster explosions, pinwheel volleys, and airborne scattershot |
| 0:06–0:13 | Prism beam, a Turf War firefight, and bouncing saw rounds      |
| 0:13–0:20 | Linked explosives, volleys, and a brief Loader encounter       |
| 0:20–0:29 | Storm Cell, ricochets, beam recoil, and crosscut saws          |
| 0:29–0:32 | Three quick action cuts                                        |
| 0:32–0:37 | Wordmark and the free itch.io play link                        |

Sixteen combat shots run for 1.2–2.4 seconds each, followed by a 4.8-second end card. The shots start during active combat. Cuts follow a 100 BPM edit grid against the stronger section of the song. Three short captions sit over gameplay. Only the first three areas, a Turf War, and the first Loader boss appear. Later bosses, story reveals, and endings are omitted.

## Capture and sound

[`scripts/youtube-trailer.ts`](../../scripts/youtube-trailer.ts) drives the actual `Game`, `Renderer`, and `Sound` classes with legal preset checkpoints and scripted movement, aiming, jumping, and firing. Health, collision, recoil, enemy AI, and damage remain active. The action scout in [`trailer-scenes.ts`](../../scripts/trailer-scenes.ts) samples ordinary encounters and finds short highlights using nearby threats, damage, projectiles, and movement. [Selected takes](action-takes.json) retain seeds, builds, inputs, and starting ticks. The renderer runs the preceding gameplay before recording each cut. No personal save data is used.

This is an offline engine capture, not a recording of a human playtest or evidence of browser performance. Every included build is checked by the game's compatibility rules and stays within its room's upgrade budget. The script aborts if a clip leaves active combat. Gameplay stays at native speed; the closer camera and slight push-ins are editorial framing. Title text and the small HUD are composited afterward.

Music is a recorded excerpt of **“Resonance” by Scott Buckley**, licensed under CC BY 4.0. It is mixed with actual simulation sound cues. The procedural game music is disabled only in this capture script. See [music-license.md](music-license.md) for download provenance, source timing, modifications, and the credit to retain in the YouTube description. No voiceover is used. A zero-gain oscillator keeps the offline effects graph active without adding sound. The final mix is normalized and fades out at the end.

## Verification

All 2,232 video frames and the entire audio stream decoded without errors. Seventeen timeline frames, full-resolution action shots, and the thumbnail were visually inspected. Analysis found no silence lasting one second at a −50 dB threshold and no black gap lasting 0.15 seconds. The final AAC measures −14.41 LUFS integrated and −2.37 dBTP, without clipping. These are file and mix measurements, not a claim of a physical speaker listening test or a completed YouTube upload.

## Rebuild

Use Node.js 24 and the project's installed dependencies. Install these optional capture dependencies separately; they are not game dependencies and are not shipped in the browser build:

```powershell
npm install --prefix .media-tools/audio --no-audit --no-fund --ignore-scripts web-audio-engine@0.13.4
npm install --prefix .media-tools/canvas --no-audit --no-fund @napi-rs/canvas@0.1.100
$env:MEDIA_MODULE_ROOT = (Join-Path (Get-Location) '.media-tools/canvas/node_modules')
$env:MEDIA_FONT_DIR = 'C:/Windows/Fonts'
$env:FFMPEG = 'C:/path/to/ffmpeg.exe'
New-Item -ItemType Directory -Force .media-tools/music
Invoke-WebRequest 'https://www.scottbuckley.com.au/library/wp-content/uploads/2018/04/sb_resonance.mp3' -OutFile .media-tools/music/resonance.mp3
node --experimental-strip-types scripts/youtube-trailer.ts
```

Use an FFmpeg build with libx264 and AAC support. The original export used FFmpeg 7.1 distributed by `imageio-ffmpeg==0.6.0`. Arial, Arial Bold, and Consolas are read from the Windows fonts folder for rasterization; font files are not redistributed. `MEDIA_MODULE_ROOT` may instead point to an existing directory containing `@napi-rs/canvas`.

The default output folder is `../recoil-foundry-trailer`; override it with `TRAILER_OUT`. `TRAILER_MUSIC` can select another local copy of the licensed track. The output folder also receives an action contact sheet, capture manifest, uncompressed effects, silent picture master, and review frames. Finished delivery files and the capture record are archived here. `--survey` regenerates candidate takes; `--storyboard` previews selected shots without encoding video. `TRAILER_TAKES` overrides the take-selection JSON path.

After a rebuild, inspect the contact sheet and thumbnail, decode the entire MP4, and check the final audio before replacing the archived files. Engine or dependency changes can change the capture.
