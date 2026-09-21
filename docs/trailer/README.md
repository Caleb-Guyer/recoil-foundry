# YouTube launch trailer

Revised on September 20, 2026, for the stable **2.98.0** browser release. Revision 4 adds a six-second atmospheric factory opening before the action. The sixteen reviewed combat takes from revision 3 and the licensed song are retained.

- [Finished MP4](Recoil-Foundry-Launch-Trailer.mp4)
- [YouTube thumbnail](Recoil-Foundry-YouTube-Thumbnail.png)
- [Title and description to paste](upload-text.txt)
- [Capture record](capture.json)
- [Music source and attribution](music-license.md)

The video is 43.20 seconds, 1920 × 1080 at 60 fps, with an H.264 High profile progressive picture, BT.709 color, and AAC-LC stereo audio at 48 kHz. The MP4 has fast-start metadata. The thumbnail is a 1920 × 1080 PNG. Include the music credit from the supplied description when uploading. This package does not publish to a YouTube account.

## Edit

| Time      | Content                                                          |
| --------- | ---------------------------------------------------------------- |
| 0:00–0:06 | Dark loading bay, footsteps, close-up, and gun lifting           |
| 0:06–0:12 | Music enters; explosions, pinwheel volleys, airborne scattershot |
| 0:12–0:19 | Prism beam, a Turf War firefight, and bouncing saw rounds        |
| 0:19–0:26 | Linked explosives, volleys, and a brief Loader encounter         |
| 0:26–0:35 | Storm Cell, ricochets, beam recoil, and crosscut saws            |
| 0:35–0:38 | Three quick action cuts                                          |
| 0:38–0:43 | Wordmark and the free itch.io play link                          |

A six-second cold open uses two camera framings, six footsteps on metal, factory hum, a failing lamp, and mechanical gun clicks. It has no title card or music. The player stops, raises the gun, and a 0.1-second dark pause leads into the first explosion and the song at exactly 0:06.

Sixteen combat shots then run for 1.2–2.4 seconds each, followed by a 4.8-second end card. The shots start during active combat. Cuts follow a 100 BPM edit grid against the stronger section of the song. Three short captions sit over gameplay. Only the first three areas, a Turf War, and the first Loader boss appear. Later bosses, story reveals, and endings are omitted.

## Capture and sound

[`scripts/trailer-intro.ts`](../../scripts/trailer-intro.ts) composes the cold open from the game's loading-dock scenery, outfit, and weapon renderer, with a keyframed walk, closer camera, lighting, and grading. It is editorial animation, separate from the simulated gameplay that follows. Its footsteps, room reflections, mechanical clicks, and industrial ambience are original deterministic sound design; no additional samples or music were downloaded. Footstep timing matches the walking cycle.

[`scripts/youtube-trailer.ts`](../../scripts/youtube-trailer.ts) drives the actual `Game`, `Renderer`, and `Sound` classes with legal preset checkpoints and scripted movement, aiming, jumping, and firing. Health, collision, recoil, enemy AI, and damage remain active. The capture driver in [`trailer-scenes.ts`](../../scripts/trailer-scenes.ts) prefers visible enemies, withholds fire when terrain or props block its aim, jumps over nearby obstacles, and reverses temporarily if it stops making progress. It keeps moving during close combat. These controls are confined to the trailer tools.

The scout samples ordinary encounters and rejects windows with blocked firing inputs, extended inactivity, too little movement, or no enemy damage. Both halves of a candidate must pass, so the shorter cuts also start with action. The renderer checks the actual cut again and requires its aim point to remain within the camera frame for at least 75% of the shot. [Selected takes](action-takes.json) retain seeds, builds, starting ticks, and scouting measurements; [capture.json](capture.json) contains the measurements for the exact final cuts. The renderer runs the preceding gameplay before recording each cut. No personal save data is used.

This is an offline engine capture, not a recording of a human playtest or evidence of browser performance. Every included build is checked by the game's compatibility rules and stays within its room's upgrade budget. The script aborts if a clip leaves active combat. Gameplay stays at native speed; the closer camera and slight push-ins are editorial framing. Title text and the small HUD are composited afterward.

Music is a recorded excerpt of **“Resonance” by Scott Buckley**, licensed under CC BY 4.0. It starts at the first combat cut, six seconds into the video, and is mixed with actual simulation sound cues. The procedural game music is disabled only in this capture script. See [music-license.md](music-license.md) for download provenance, source timing, modifications, and the credit to retain in the YouTube description. No voiceover is used. A zero-gain oscillator keeps the offline effects graph active without adding sound. The final mix is normalized, the opening is lowered afterward to preserve the quiet-to-action contrast, and the music fades out at the end.

## Verification

All 2,592 frames and the entire audio stream decoded without errors. The opening was reviewed in nine timeline frames and in an encoded full-resolution frame. All sixteen exact combat cuts passed the movement, damage, visibility, and framing checks from revision 3; their seeds, starting ticks, and gameplay measurements match the preceding edit. The existing 96-frame sequence review covers the beginning, middle, and end of every combat shot. Three regression tests cover traversing cover, choosing a visible target over a hidden one, and rejecting stationary combat. The capture driver and intro module pass strict TypeScript checking. The original Foley was checked for finite samples, headroom, and footstep transients above the room tone.

Analysis found no silence lasting one second at a −50 dB threshold. The only black interval above 0.15 seconds is the intended first 0.23 seconds of the opening fade. The six-frame pause before the action is intentional. The final AAC measures −14.26 LUFS integrated and −1.75 dBTP, without clipping. The opening averages −32.9 dBFS versus −15.6 dBFS for the first 5.9 seconds of action, retaining a clear contrast. These are file and mix measurements, not a claim of a physical speaker listening test or a completed YouTube upload.

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

The default output folder is `../recoil-foundry-trailer`; override it with `TRAILER_OUT`. `TRAILER_MUSIC` can select another local copy of the licensed track. The output folder also receives opening and action contact sheets, four sequence sheets with six evenly spaced frames per combat shot, `shot-review.json`, a capture manifest, uncompressed effects, silent picture master, and review frames. Finished delivery files and the capture record are archived here. `--intro-only` creates the opening contact sheet and an isolated Foley preview. `--survey` regenerates candidate takes; `--storyboard` previews the opening and selected shots without encoding video, using the same continuous camera updates as the final render. Both storyboard and final export fail their quality checks when any combat shot is unsuitable. `TRAILER_TAKES` overrides the take-selection JSON path.

After a rebuild, inspect the sequence sheets, contact sheet, and thumbnail, decode the entire MP4, and check the final audio before replacing the archived files. Run the capture-driver regressions with `node --experimental-strip-types --test tests/trailer-scenes.test.ts`. Engine or dependency changes can change the capture.
