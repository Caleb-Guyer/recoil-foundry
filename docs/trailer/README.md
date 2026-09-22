# YouTube launch trailer

Revised September 21, 2026, for the stable **2.98.0** browser release. Revision 8 edits the picture around the song's actual closing passage and final two accents.

- [Finished MP4](Recoil-Foundry-Launch-Trailer.mp4)
- [YouTube thumbnail](Recoil-Foundry-YouTube-Thumbnail.png)
- [Title and description to paste](upload-text.txt)
- [Capture record](capture.json)
- [Measured musical accents and closing arrangement](music-beats.json)
- [Combat edit and retiming plan](edit-plan.json)
- [Music source and attribution](music-license.md)

The video is 39.18 seconds, 1920 × 1080 at 60 fps: H.264 High profile, progressive BT.709 picture, AAC-LC stereo audio at 48 kHz, and fast-start MP4 metadata. The thumbnail is a 1920 × 1080 PNG. Include the supplied music credit when uploading. This package does not publish to YouTube.

## Edit

| Time      | Content                                                                      |
| --------- | ---------------------------------------------------------------------------- |
| 0:00–0:06 | Dark factory, footsteps, close-up, gun lifting                               |
| 0:06–0:25 | Main action montage and three short gameplay captions                        |
| 0:25–0:34 | The song's closing passage; increasingly short gameplay cuts follow its fill |
| 0:34.383  | RECOIL appears on the first closing accent                                   |
| 0:34.817  | FOUNDRY appears on the second closing accent                                 |
| 0:35–0:37 | Play invitation and URL over the recording's natural ring-out                |
| 0:37–0:39 | Picture fades with the natural decay, then half a second of black            |

The six-second cold open uses two camera framings, six footsteps on metal, factory hum, a failing lamp, and mechanical gun clicks. The player stops, raises the gun, and a short dark pause leads into the first shot and music at exactly 0:06.

Sixteen combat shots follow measured accents from the recording. The closing sequence grows shorter as the song reaches its final fill. Only the first three areas, a Turf War, and the first Loader boss appear; later bosses, story reveals, and endings are omitted.

## The musical ending

Earlier versions ended the picture on a regular beat, then fabricated a short music tail. This edit uses the recording's real ending. At 0:25.20, the music skips seven complete 16-beat phrases (112 beats / 67.2 seconds) into its closing passage. A 25 ms crossfade before the aligned barline joins the excerpts. Closing action markers are measured from that passage, including its offbeat final pickup.

The final recorded accents occur at source times 4:18.856 and 4:19.296. The two title lines appear fully on those hits, with frame-rounding errors of +3.00 ms and −3.67 ms respectively. There is no added title stinger, synthetic riser, or artificial echo. Combat effects ease back for the closing fill and release immediately after the first title accent, leaving the original music prominent.

A six-frame trace of the final shot sits behind the first title line. The title stays stationary. The play invitation enters at 0:35.42 and the URL at 0:35.52, while the original recording rings out. The card begins fading during the musical decay at 0:37.48, reaches black at 0:38.68, and ends at 0:39.18.

[`trailer-ending.ts`](../../scripts/trailer-ending.ts) and [`trailer-mix.ts`](../../scripts/trailer-mix.ts) share timing from the measured arrangement in [music-beats.json](music-beats.json). Changing the title timing requires updating the musical arrangement and combat edit together.

## Capture and sound

[`trailer-intro.ts`](../../scripts/trailer-intro.ts) composes the cold open from the game's scenery, outfit, and weapon renderer with a keyframed walk, lighting, and camera. Its footsteps, mechanical clicks, room reflections, and industrial ambience are original deterministic sound design. This opening is editorial animation, separate from the simulated combat.

[`youtube-trailer.ts`](../../scripts/youtube-trailer.ts) uses the actual `Game`, `Renderer`, and `Sound` classes with legal checkpoint builds and scripted movement, aiming, jumping, and firing. Health, collision, recoil, enemy AI, and damage remain active. [`trailer-scenes.ts`](../../scripts/trailer-scenes.ts) prefers visible targets, withholds blocked shots, jumps over obstacles, and escapes stalls. No personal saves are used. This is an offline engine capture, not a human playtest or browser-performance measurement.

The scout rejects blocked firing, extended inactivity, inadequate movement, and clips with no damage. [`trailer-edit.ts`](../../scripts/trailer-edit.ts) selects real events from [candidate takes](action-takes.json) and gently retimes playback to the measured accents. Physics retains its fixed timestep. The renderer checks each exact cut, including camera framing, and aborts on missing or off-frame planned events. The six-frame background continuation beneath the title uses the same live game and camera at half speed.

[`trailer-sound.ts`](../../scripts/trailer-sound.ts) renders the game's original cues into isolated, checked buffers and places them at the retimed events. Shots and explosions are stronger than distant warnings; beams have a continuous layer. Transient shaping and gentle saturation control dense combat. Every combat clip passes an effects-level gate.

Music is **“Resonance” by Scott Buckley**, under CC BY 4.0. The mix uses a small EQ cut, brief ducking beneath effects, measured constant gain, and a final peak limiter. Its original closing passage supplies the title accents and ring-out. See [music-license.md](music-license.md) for source details and attribution. No voiceover is used. Game runtime audio is unchanged.

## Verification

All sixteen gameplay cuts passed their quality gates, and all 44 planned gameplay accents matched their assigned frames. The two title reveals match the original recording's closing accents within 3.67 ms. Waveform comparison of the encoded music found no added timing offset around either reveal (correlations 0.9997 and 0.9930). The ending, edit, and sound modules pass strict TypeScript checking. The changed gameplay sequences, twelve transition frames, and nine end-card stages were visually reviewed.

All 2,351 frames and the full audio stream decoded without errors. Final AAC measures −14.10 LUFS integrated and −1.82 dBTP without clipping. There are no unintended black or silent gaps through the musical transition. The music naturally decays below −60 dB during the final picture fade. Measurements describe the exported file, not physical-speaker listening or a completed YouTube upload.

## Rebuild

Use Node.js 24 and the project's installed dependencies. Optional capture dependencies are not shipped in the browser game:

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

Use FFmpeg with libx264 and AAC support; this export uses FFmpeg 7.1 from `imageio-ffmpeg==0.6.0`. Arial, Arial Bold, and Consolas are rasterized from Windows fonts without redistributing font files. `MEDIA_MODULE_ROOT` can point to an existing directory containing `@napi-rs/canvas`.

The default output is `../recoil-foundry-trailer`; override with `TRAILER_OUT`. `TRAILER_MUSIC` selects a local copy of the licensed song. Output includes contact sheets, a dedicated transition sheet, sequence sheets, shot and sync reviews, capture manifest, effects stem, sound-cue and mix audits, silent master, and review frames.

`--intro-only` previews the opening. `--survey` regenerates encounter candidates; `--edit-survey` rebuilds the edit from candidates and the committed musical markers. `--storyboard` validates and previews without encoding. `--mix-only` remixes existing picture and effects. `TRAILER_TAKES` overrides the candidate JSON path. Engine or dependency changes can change captures.

After a rebuild, inspect the transition, sequence, ending, and thumbnail images; decode the full MP4 and check final audio. Capture-driver regressions: `node --experimental-strip-types --test tests/trailer-scenes.test.ts`.
