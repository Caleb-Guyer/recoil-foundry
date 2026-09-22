# YouTube launch trailer

Revised on September 21, 2026, for the stable **2.98.0** browser release. Revision 7 smooths the gameplay-to-title transition: the final shot keeps moving beneath the wordmark, while picture and sound resolve together. The six-second factory opening, synchronized combat effects, staged play card, and closing fade are retained.

- [Finished MP4](Recoil-Foundry-Launch-Trailer.mp4)
- [YouTube thumbnail](Recoil-Foundry-YouTube-Thumbnail.png)
- [Title and description to paste](upload-text.txt)
- [Capture record](capture.json)
- [Measured musical transients](music-beats.json)
- [Combat edit and retiming plan](edit-plan.json)
- [Music source and attribution](music-license.md)

The video is 44.90 seconds, 1920 × 1080 at 60 fps, with an H.264 High profile progressive picture, BT.709 color, and AAC-LC stereo audio at 48 kHz. The MP4 has fast-start metadata. The thumbnail is a 1920 × 1080 PNG. Include the music credit from the supplied description when uploading. This package does not publish to a YouTube account.

## Edit

| Time      | Content                                                          |
| --------- | ---------------------------------------------------------------- |
| 0:00–0:06 | Dark loading bay, footsteps, close-up, and gun lifting           |
| 0:06–0:13 | Music enters; shell volleys, pinwheel, airborne scattershot      |
| 0:13–0:20 | Prism beam, Turf War, and bouncing saw rounds                    |
| 0:20–0:30 | Linked explosives, pinwheel, Loader, and Storm Cell              |
| 0:30–0:35 | Two-beat cuts: scatter, prism, saws, and Turf War                |
| 0:35–0:37 | Four single-beat cuts and an industrial rise                     |
| 0:37–0:39 | Wordmark lands on a musical impact; play invitation appears next |
| 0:39–0:43 | Clean play card with the free itch.io link                       |
| 0:43–0:45 | Picture and factory ambience fade fully to black and silence     |

A six-second cold open uses two camera framings, six footsteps on metal, factory hum, a failing lamp, and mechanical gun clicks. It has no title card or music. The player stops, raises the gun, and a 0.1-second dark pause leads into the first shot and the song at exactly 0:06.

Eighteen combat shots accelerate from ten four-beat phrases to four two-beat cuts, then four single-beat cuts. The song's 100 BPM pulse was measured from the recording, and the cut points use local transient peaks rather than an approximate stopwatch grid. Forty-eight real firing, hit, kill, and beam events land on those musical accents. Gentle speed changes and small camera accents reinforce them. Three short captions sit over gameplay. Only the first three areas, a Turf War, and the first Loader boss appear. Later bosses, story reveals, and endings are omitted.

The ending in [`trailer-ending.ts`](../../scripts/trailer-ending.ts) shares precise timing between picture, effects, and music. The final shot gradually darkens from 0:37.00, then continues at half speed beneath a quick, stationary wordmark reveal on the 0:37.20 downbeat. Its camera remains continuous as the moving background dissolves into the factory-colored card by 0:37.80. The HUD fades ahead of the reveal. Music stays continuous, and the last combat sounds fade with the picture; a softer original metal impact and musical echo complete the transition. “PLAY FREE NOW” enters at 0:38.30 and the URL at 0:38.70. The fully readable card holds for over four seconds before a 1.2-second fade begins at 0:43.20; the file ends with half a second of black and silence.

## Capture and sound

[`scripts/trailer-intro.ts`](../../scripts/trailer-intro.ts) composes the cold open from the game's loading-dock scenery, outfit, and weapon renderer, with a keyframed walk, closer camera, lighting, and grading. It is editorial animation, separate from the simulated gameplay that follows. Its footsteps, room reflections, mechanical clicks, and industrial ambience are original deterministic sound design; no additional samples or music were downloaded. Footstep timing matches the walking cycle.

[`scripts/youtube-trailer.ts`](../../scripts/youtube-trailer.ts) drives the actual `Game`, `Renderer`, and `Sound` classes with legal preset checkpoints and scripted movement, aiming, jumping, and firing. Health, collision, recoil, enemy AI, and damage remain active. The capture driver in [`trailer-scenes.ts`](../../scripts/trailer-scenes.ts) prefers visible enemies, withholds fire when terrain or props block its aim, jumps over nearby obstacles, and reverses temporarily if it stops making progress. It keeps moving during close combat. These controls are confined to the trailer tools.

The scout samples ordinary encounters and rejects windows with blocked firing inputs, extended inactivity, too little movement, or no enemy damage. [`trailer-edit.ts`](../../scripts/trailer-edit.ts) chooses nearby action moments from those candidate encounters and builds the [edit plan](edit-plan.json). The renderer checks each exact cut again and requires its aim point to remain within the camera frame for at least 75% of the shot. [Candidate takes](action-takes.json) retain seeds and builds; [capture.json](capture.json) contains the final cuts, event timestamps, retiming curves, and quality measurements. The renderer runs the preceding gameplay before recording each cut. No personal save data is used.

This is an offline engine capture, not a recording of a human playtest or evidence of browser performance. Every included build is checked by the game's compatibility rules and stays within its room's upgrade budget. Physics continues at its original fixed timestep; monotone retiming changes playback speed between approximately 0.77× and 1.27× to place real events on the beat. Combat outcomes are not changed. The script aborts if a clip leaves active combat, a planned event is missing, or an event lands on the wrong video frame. The closer camera, small impact accents, title text, and HUD are editorial presentation.

The earlier export's combat-effects stem averaged approximately −44.4 dBFS, so the external song overwhelmed it. [`trailer-sound.ts`](../../scripts/trailer-sound.ts) now renders the game's original `Sound` cues into isolated, checked buffers and places them at the retimed events. Weapon shots and explosions receive stronger levels than distant enemies and warning sounds; the beam has a separate continuous layer. The full effects bus stays active during buffer generation. Transient shaping and gentle bus saturation keep dense combat controlled. Each exported combat clip must pass an effects-level check, preventing a silently missing or buried stem from being accepted again.

Music is a recorded excerpt of **“Resonance” by Scott Buckley**, licensed under CC BY 4.0. It begins at 0:06. [`trailer-mix.ts`](../../scripts/trailer-mix.ts) lowers it, makes a small EQ cut around the weapon effects, and briefly ducks it beneath impacts. A measured constant gain and final peak limiter preserve the quiet opening. The arrangement continues through the title downbeat, then tapers into an echo tail. Original synthesized industrial air, a metal impact, and factory room tone complete the ending; the room tone fades with the picture. No additional samples were downloaded. See [music-license.md](music-license.md) for attribution. No voiceover is used, and the game's runtime audio is unchanged.

## Verification

All eighteen cuts passed the movement, damage, visibility, and framing checks. The final shot stays in active gameplay throughout its additional half-speed transition. Twelve closely spaced transition frames and nine title-card stages were visually reviewed. All 48 planned musical accents match their assigned video frames with zero frame error; the measured song peaks are quantized to 60 fps. Every original sound buffer is checked for finite, nonzero output; every combat clip must have an effects RMS above −33 dBFS and a peak above 0.15 before final mixing. The ending, edit, and sound modules pass strict TypeScript checking.

All 2,694 frames and the complete audio stream decoded without errors. Final AAC audio measures −14.09 LUFS integrated and −1.79 dBTP, without clipping. Picture and audio analysis confirm there is no black or silent gap through the title transition. The final fade reaches black and silence. The effects in every combat shot remain above the audibility gate. These are file and mix measurements, not a claim of a physical speaker listening test or a completed YouTube upload.

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

The default output folder is `../recoil-foundry-trailer`; override it with `TRAILER_OUT`. `TRAILER_MUSIC` can select another local copy of the licensed track. The output folder receives contact and sequence sheets, `shot-review.json`, `sync-audit.json`, the capture manifest, raw effects, sound-cue and mix audits, the silent master, and review frames. `--intro-only` creates the opening preview. `--survey` regenerates encounter candidates; `--edit-survey` rebuilds the musical edit from those candidates and the committed beat map. `--storyboard` previews the edit and validates event timing without encoding. `--mix-only` remixes the existing silent master and effects stem without recapturing the picture. Storyboard and final export fail their checks when any combat shot or planned musical event is unsuitable. `TRAILER_TAKES` overrides the encounter-candidate JSON path.

After a rebuild, inspect the sequence sheets, contact sheet, and thumbnail, decode the entire MP4, and check the final audio before replacing the archived files. Run the capture-driver regressions with `node --experimental-strip-types --test tests/trailer-scenes.test.ts`. Engine or dependency changes can change the capture.
