"""Decode and measure the final upload, then make review sheets from encoded frames."""
from pathlib import Path
import subprocess, json, re, struct, hashlib, os
import numpy as np

root = Path(__file__).resolve().parents[1]
out = Path(os.environ.get('TRAILER_OUT', root.parents[1] / 'YouTube Trailer 5.6.0 Revised')).resolve()
work = out / 'production'
ffmpeg = Path(os.environ.get('FFMPEG', root / '.media-tools/python/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'))
video = out / 'Recoil-Foundry-Official-Trailer.mp4'
capture = json.loads((out / 'Capture-Manifest.json').read_text())
guns = sorted({shot.get('startingGun', 'pistol') for shot in capture['shots']})
assert guns == ['carbine', 'nailgun', 'pistol', 'repeater', 'shotgun', 'twinbore'], guns
plan = json.loads((root / 'docs/trailer-5.6.0/edit-plan.json').read_text())

def invoke(arguments):
    result = subprocess.run([str(ffmpeg), '-hide_banner', *arguments], capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace')[-6000:])
    return result

decoded = invoke(['-i',str(video),'-vf','blackdetect=d=0.15:pix_th=0.03,freezedetect=n=-60dB:d=1',
                  '-af','silencedetect=n=-55dB:d=0.15','-f','null','NUL'])
log = decoded.stderr.decode(errors='replace')
(work / 'decode-review.log').write_text(log,encoding='utf-8')
for required in ['h264 (High)','1920x1080','60 fps','yuv420p','bt709','aac (LC)','48000 Hz','stereo']:
    assert required in log, f'Missing expected format: {required}'
frames = int(re.findall(r'frame=\s*(\d+)',log)[-1])
assert frames == capture['frames'], (frames,capture['frames'])
black = [float(x) for x in re.findall(r'black_start:([\d.]+)',log)]
silence = [float(x) for x in re.findall(r'silence_start: ([\d.]+)',log)]
freezes = [float(x) for x in re.findall(r'freeze_start: ([\d.]+)',log)]
fade_start = (capture['music']['closing']['titleFrame'] + 186)/60
assert all(t >= fade_start for t in black), black
assert all(t >= fade_start for t in silence), silence
assert all(t >= capture['music']['closing']['titleFrame']/60 for t in freezes), freezes

levels = invoke(['-i',str(video),'-vn','-af','loudnorm=I=-14:TP=-2:LRA=9:print_format=json','-f','null','NUL'])
meter = json.loads(re.search(r'\{\s*"input_i"[\s\S]*?\}',levels.stderr.decode()).group())
lufs, peak = float(meter['input_i']),float(meter['input_tp'])
assert -15 <= lufs <= -13, lufs
assert peak <= -1.2, peak
raw = invoke(['-v','error','-i',str(video),'-vn','-ac','2','-ar','48000','-f','f32le','pipe:1']).stdout
audio = np.frombuffer(raw,dtype='<f4').reshape(-1,2)
assert np.isfinite(audio).all()
deltas = []
for start in range(0,min(len(audio)-96000,int(capture['music']['closing']['titleFrame']/60*48000)),48000):
    window = audio[start:start+96000]
    stereo = np.sqrt(np.mean(window*window))
    mono = np.sqrt(np.mean(window.mean(axis=1)**2))
    if stereo > .001: deltas.append(float(20*np.log10(max(mono,1e-10)/stereo)))
assert min(deltas) > -4, min(deltas)

data = video.read_bytes()
atoms, pos = [],0
while pos < len(data):
    size,kind = struct.unpack_from('>I4s',data,pos)
    if size == 1: size = struct.unpack_from('>Q',data,pos+8)[0]
    elif size == 0: size = len(data)-pos
    assert size >= 8
    atoms.append({'type':kind.decode('ascii'),'offset':pos,'bytes':size})
    pos += size
assert pos == len(data)
assert next(a['offset'] for a in atoms if a['type']=='moov') < next(a['offset'] for a in atoms if a['type']=='mdat')

indices = []
for shot in plan:
    length = shot['end']-shot['start']
    indices.extend(shot['start']+round(i*(length-1)/5) for i in range(6))
select = '+'.join(f'eq(n,{i})' for i in indices)
invoke(['-v','warning','-y','-i',str(video),'-an','-vf',f"select='{select}',scale=320:180,tile=6x4:padding=2:margin=2:color=black",'-fps_mode','vfr',str(work/'encoded-sequence-%02d.png')])
invoke(['-v','warning','-y','-i',str(video),'-an','-vf','fps=1/2,scale=384:216,tile=5x6:padding=2:margin=2:color=black','-frames:v','1',str(out/'Encoded-Review.png')])
bosses = [shot['encounter']['kind'] for shot in capture['shots'] if shot.get('encounter')]
assert bosses == ['loader','press','condenser','sorter','interceptor'], bosses
assert {shot['stage']//4 for shot in capture['shots'] if shot.get('encounter')} == set(range(5))
for shot in capture['shots']:
    if shot.get('encounter'):
        assert shot['playerOnScreen'] >= .95, shot['name']
        assert len(shot['bossStates']) >= 2, shot['name']

report = {'version':capture['version'],'video':video.name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),
          'durationSeconds':capture['seconds'],'decodedFrames':frames,'width':1920,'height':1080,'fps':60,
          'videoCodec':'H.264 High / yuv420p / BT.709 / progressive','audioCodec':'AAC-LC / 48 kHz / stereo / 384 kbps',
          'integratedLufs':lufs,'truePeakDbtp':peak,'worstTwoSecondMonoDeltaDb':round(min(deltas),3),
          'blackStartsSeconds':black,'silenceStartsSeconds':silence,'freezeStartsSeconds':freezes,
          'fastStart':True,'topLevelAtoms':atoms,'shots':len(capture['shots']),
          'capturedStartingGuns':guns,'capturedBosses':bosses,'bossZones':5,'verifiedCombatAccents':len(capture['beatSync']),'maximumCombatSyncErrorFrames':max(p['errorFrames'] for p in capture['beatSync']),
          'allShotsPassQualityGates':True,'allAudioSamplesFinite':True,
          'musicSourceSha256':capture['music']['sha256'],
          'reviewNote':'Decoder, timing, loudness, peak, mono and technical checks. Encoded review sheets require separate visual inspection; these measurements do not constitute speaker listening or a YouTube upload.'}
(out/'Quality-Report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
(root/'docs/trailer-5.6.0/quality-review.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:report[k] for k in ['decodedFrames','durationSeconds','integratedLufs','truePeakDbtp','worstTwoSecondMonoDeltaDb','shots','verifiedCombatAccents','fastStart']}))
