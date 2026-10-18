# Recoil Foundry — official gameplay trailer

Current-game trailer prepared October 18, 2026. This is a new edit and capture for **5.6.0**; the earlier 2.98.0 trailer is preserved in `docs/trailer/`.

- [Upload-ready video](Recoil-Foundry-Official-Trailer.mp4)
- [4K YouTube thumbnail](Recoil-Foundry-YouTube-Thumbnail.png)
- [All upload fields and settings](Upload-Details.md)
- [Title](Title.txt) · [Description with music credit](Description.txt) · [Tags](Tags.txt)
- [English captions](Captions.en.srt) · [Optional pinned comment](Pinned-Comment.txt)
- [Music license and source hash](Music-License.txt)
- [Capture manifest](capture.json) · [Encoded export measurements](quality-review.json)

The local delivery folder is **YouTube Trailer 5.6.0** in the task's outer workspace. It contains the MP4, thumbnail, upload copy, captions and license record. A separate ZIP contains only the delivery files. No YouTube upload or external announcement has been performed.

## The edit

**42.783 seconds, 1920 × 1080 at 60 fps.** The first frame opens in actual recoil combat. Eighteen moving shots show the pistol, shotgun, nailgun, Twinbore, Coil carbine and Pressure repeater, then combinations including beams, rotating fire, saws and explosive rounds. The Loader provides a recognizable boss encounter without showing the ending. Three short captions carry the pitch. The closing wordmark lands on the recording's actual final accents, followed by the play invitation and a readable URL.

Music is **Resonance by Scott Buckley**, a recorded industrial electronica track released under CC BY 4.0. The composer explicitly permits commercial projects with attribution. The body uses one additional musical phrase compared with the older edit; two excerpts join at a barline and keep the recording's natural conclusion. Keep the credit in Description.txt when uploading. Source and license links are in Music-License.txt.

The thumbnail composes an actual captured gameplay frame and the native wordmark, with the hook **SHOOT DOWN. FLY UP.** It is a 3840 × 2160 PNG below 0.5 MB. It uses the game's actual art and contains no generated depiction of gameplay.

## Capture and verification

The current `Game`, `Renderer` and `Sound` classes supply picture and effects. Captures use isolated legal checkpoint builds and ordinary scripted controls; health, enemy AI, damage and collision remain active. No personal save is read, no equipment is awarded, and no attacks are fabricated. This is edited engine footage rather than a browser performance measurement or human playtest.

All eighteen shots pass the movement, visibility, damage and unobstructed-firing gates. All **59** selected combat accents match their assigned video frames. All **2,567** exported frames and the full audio stream decode. Final measured audio is **−14.06 LUFS integrated**, **−1.83 dBTP**, with a worst two-second mono level difference of **−1.293 dB**. No black gaps, sustained freezes or silence occur during the action. Detected stillness and silence belong to the intentional closing card and fade. Fast-start metadata precedes the media payload.

All 108 sampled gameplay frames from the encoded MP4, the hook, end card and final thumbnail were visually inspected. Four capture-driver regressions, strict TypeScript checks for the new capture/package scripts, and the production build pass. These checks do not replace physical speaker listening or YouTube's upload processing.

## Rebuild

Use Node 24, Python with NumPy, the project dependencies, and the optional free capture tools. The default Windows renderer uses the locally installed Arial and Consolas fonts; it does not redistribute them.

```powershell
npm install --prefix .media-tools/canvas --no-audit --no-fund @napi-rs/canvas@0.1.100
npm install --prefix .media-tools/audio --no-audit --no-fund --ignore-scripts web-audio-engine@0.13.4
python -m pip install --target .media-tools/python imageio-ffmpeg==0.6.0 numpy
$env:PYTHONPATH = Join-Path (Get-Location) '.media-tools/python'
New-Item -ItemType Directory -Force .media-tools/music
Invoke-WebRequest 'https://www.scottbuckley.com.au/library/wp-content/uploads/2018/04/sb_resonance.mp3' -OutFile .media-tools/music/resonance.mp3
python scripts/action-trailer-beats.py
node --experimental-strip-types scripts/action-trailer.ts --survey
node --experimental-strip-types scripts/action-trailer.ts --plan
node --experimental-strip-types scripts/action-trailer.ts --storyboard
node --experimental-strip-types scripts/action-trailer.ts
node --experimental-strip-types scripts/action-trailer-package.ts
python scripts/action-trailer-review.py
```

The source recording's SHA-256 is checked before rendering. `TRAILER_OUT`, `TRAILER_MUSIC`, `FFMPEG` and `MEDIA_FONT_DIR` override local paths. The documented default output is `../../YouTube Trailer 5.6.0` relative to this checkout. `--survey --name=shotgun` regenerates one family. New captures can require new edit planning if the game engine changes.

The original recording and optional tool installations are excluded from Git. Review frames, intermediate picture and effects stems stay in the local delivery folder's `production/` directory. The upload video does not require any of those tools to play.
