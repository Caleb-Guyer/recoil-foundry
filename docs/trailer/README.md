# YouTube launch trailer

Prepared on September 20, 2026, for the stable **2.98.0** browser release.

- [Finished MP4](Recoil-Foundry-Launch-Trailer.mp4)
- [YouTube thumbnail](Recoil-Foundry-YouTube-Thumbnail.png)
- [Title and description to paste](upload-text.txt)
- [Capture record](capture.json)

The video is 34.62 seconds, 1920 × 1080 at 60 fps, with an H.264 High profile progressive picture, BT.709 color, and AAC-LC stereo audio at 48 kHz. The MP4 has fast-start metadata. The thumbnail is a 1920 × 1080 PNG. These files are upload-ready; this package does not publish to a YouTube account.

## Edit

| Time      | Content                                                       |
| --------- | ------------------------------------------------------------- |
| 0:00–0:05 | Recoil flight; “Shoot down. Go up.”; “One gun.” title beat    |
| 0:06–0:11 | Scattershot and ricochets; “100 upgrades. Build it your way.” |
| 0:12–0:17 | Prism beam                                                    |
| 0:17–0:23 | Pinwheel volleys                                              |
| 0:23–0:29 | Cluster shells and blast movement                             |
| 0:29–0:35 | Wordmark, tagline, and the free itch.io play link             |

Only ordinary encounters in the first three areas appear. Final bosses, later areas, story reveals, and endings are omitted.

## Capture and sound

[`scripts/youtube-trailer.ts`](../../scripts/youtube-trailer.ts) drives the actual `Game`, `Renderer`, `Sound`, and `Music` classes with legal preset checkpoints and scripted movement, aiming, jumping, and firing. Health, collision, recoil, enemy AI, and damage remain active. Four combat clips include 100 frames of ordinary inputs before the cut starts. The camera is framed more closely for the trailer; title text and the minimal HUD are composited afterward. No personal save data is used.

This is an offline engine capture, not a recording of a human playtest or evidence of browser performance. Every included build is checked by the game's compatibility rules and stays within its room's upgrade budget. The script aborts if a clip leaves the playing state.

The soundtrack uses the game's original Furnace Halls score at its native 104 BPM, continuing across the edit, mixed with real simulation sound cues. There is no licensed song, stock track, voiceover, or external recording. A zero-gain oscillator keeps the offline audio engine's music filter graph active across note gaps; it adds no audible content and changes no game runtime code. The mix is normalized and fades out at the end.

## Verification

The finished export was decoded from beginning to end: all 2,077 video frames and its audio stream decoded without errors. Thirteen timeline frames, full-resolution action shots, and the thumbnail were visually inspected. Audio analysis found no silence lasting one second at a −50 dB threshold. The final AAC measures approximately −16.86 LUFS integrated and −1.26 dBTP, without clipping. These are file and mix measurements, not a claim of a physical speaker listening test or a completed YouTube upload.

## Rebuild

Use Node.js 24 and the project's installed dependencies. Install these optional capture dependencies separately; they are not game dependencies and are not shipped in the browser build:

```powershell
npm install --prefix .media-tools/audio --no-audit --no-fund --ignore-scripts web-audio-engine@0.13.4
npm install --prefix .media-tools/canvas --no-audit --no-fund @napi-rs/canvas@0.1.100
$env:MEDIA_MODULE_ROOT = (Join-Path (Get-Location) '.media-tools/canvas/node_modules')
$env:MEDIA_FONT_DIR = 'C:/Windows/Fonts'
$env:FFMPEG = 'C:/path/to/ffmpeg.exe'
node --experimental-strip-types scripts/youtube-trailer.ts
```

Use an FFmpeg build with libx264 and AAC support. The original export used FFmpeg 7.1 distributed by `imageio-ffmpeg==0.6.0`. Arial, Arial Bold, and Consolas are read from the Windows fonts folder for rasterization; font files are not redistributed. `MEDIA_MODULE_ROOT` may instead point to an existing directory containing `@napi-rs/canvas`.

The default output folder is `../recoil-foundry-trailer`; override it with `TRAILER_OUT`. That folder also receives a contact sheet, capture manifest, uncompressed mix, silent picture master, and review frames. Only the finished MP4, thumbnail, and capture record are archived here. `--survey` evaluates candidate room seeds without rendering.

After a rebuild, inspect the contact sheet and thumbnail, decode the entire MP4, and check the final audio before replacing the archived files. Engine or dependency changes can change the capture.
