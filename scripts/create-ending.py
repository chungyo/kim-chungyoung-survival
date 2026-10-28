#!/usr/bin/env python3
"""Build the Korean ending film from its original stills and synthesized music.

Requires ffmpeg, NumPy and Apple SD Gothic Neo on this Mac. It does not run
when the game is played; the generated MP4 is served as a static asset.
"""
from pathlib import Path
import subprocess
import tempfile
import wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
FONT = '/System/Library/Fonts/AppleSDGothicNeo.ttc'
FPS = 24
SCENES = [
    ('childhood.png', '일산, 어린 시절', '내가 처음 바람을 앞지르려 했던 곳은\n일산 알미공원이었다.', 6),
    ('childhood.png', '바퀴와 바이올린', '발끝으로 춤을 배우고, 손끝으로 활을 켰다.\n어느 날 그 떨림은 콩쿠르의 상이 되어 돌아왔다.', 7),
    ('campus.png', '백석동에서 흑석동으로', '살던 동네가 바뀌고, 마주하는 풍경도 달라졌다.\n흑석동에서 나는 전교 1등의 기쁨을 알았다.', 7),
    ('campus.png', '조금 돌아간 길', '롤로 밤을 채우던 경문고를 지나,\n재수 끝에 한양대 ERICA에서\n프랑스어로 쓰인 문장들 앞에 앉았다.', 9),
    ('service.png', '청와대의 시간', '청와대에서 군복을 입고 보낸 날들.\n지나고 보니 그 시간도 내 이야기의 한 장이었다.', 7),
    ('developer.png', '다시, 처음부터', '프랑스어를 읽던 내가\n가천대에서 코드와 AI를 다시 배우기 시작했다.', 7),
    ('developer.png', '만들어가는 사람', 'MacBook을 열고 한 줄씩 코드를 썼다.\n플래드랩스에서는 사람들과 함께 답을 찾아갔다.', 7),
    ('developer.png', '서른을 앞두고', '개발자, AI 엔지니어, 그리고 PM.\n내가 되고 싶은 사람은 하나의 이름으로는 다 담기지 않는다.', 8),
    ('developer.png', '지나온 길', '바퀴 위에서 보내던 오후와\n활 끝에서 울리던 소리, 그리고 낯선 문장과 코드까지.\n서로 다른 시간들이\n결국 지금의 나에게로 이어졌다.', 10),
    ('developer.png', '다음 장', '서른을 앞둔 지금,\n내 이야기는 아직 끝나지 않았다.\n그리고 나는 그 다음 장을,\n내 손으로 써 내려가려 한다.', 10),
]


def make_music(path: Path, duration: int) -> None:
    """A quiet, original piano-like arpeggio made with additive synthesis."""
    sr = 44100
    output = np.zeros(duration * sr, dtype=np.float64)
    chords = [[48, 55, 60, 64], [43, 50, 55, 59], [45, 52, 57, 60], [41, 48, 53, 57]]
    melody = [76, 79, 81, 79, 76, 74, 72, 74, 76, 79, 84, 81, 79, 76, 74, 72]

    def note(midi: int, at: float, length: float, level: float) -> None:
        start = int(at * sr)
        count = min(int(length * sr), len(output) - start)
        if count <= 0:
            return
        t = np.arange(count) / sr
        f = 440 * 2 ** ((midi - 69) / 12)
        env = np.minimum(t / 0.025, 1) * np.exp(-t * 1.5)
        tone = np.sin(2 * np.pi * f * t) + 0.22 * np.sin(4 * np.pi * f * t) * np.exp(-t * 3)
        output[start:start + count] += level * env * tone

    step = 0.75
    for i in range(int(duration / step)):
        chord = chords[(i // 8) % len(chords)]
        note(chord[i % 4], i * step, 2.5, 0.11)
        if i % 2 == 0:
            note(melody[(i // 2) % len(melody)], i * step, 2.3, 0.075)
    fade = min(sr * 2, len(output))
    output[:fade] *= np.linspace(0, 1, fade)
    output[-fade:] *= np.linspace(1, 0, fade)
    pcm = np.int16(np.clip(output, -0.9, 0.9) * 32767)
    with wave.open(str(path), 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sr)
        f.writeframes(pcm.tobytes())


def run(args: list[str]) -> None:
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL)


def main() -> None:
    with tempfile.TemporaryDirectory(prefix='chungyoung-ending-') as temp:
        tmp = Path(temp)
        clips = []
        for i, (image, chapter, caption, duration) in enumerate(SCENES):
            title = tmp / f'chapter-{i}.txt'
            lines = tmp / f'caption-{i}.txt'
            title.write_text(chapter, encoding='utf-8')
            lines.write_text(caption, encoding='utf-8')
            dest = tmp / f'scene-{i:02}.mp4'
            # Slow camera movement, a dark caption area and gentle fade transitions.
            alpha = f"if(lt(t,0.65),t/0.65,if(gt(t,{duration - 0.75}),({duration}-t)/0.75,1))"
            vf = (
                "scale=1360:765:force_original_aspect_ratio=increase,crop=1360:765,"
                "zoompan=z='min(zoom+0.00035,1.055)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1280x720:fps=24,"
                "drawbox=x=0:y=460:w=iw:h=260:color=black@0.43:t=fill,"
                f"drawtext=fontfile='{FONT}':textfile='{title}':fontsize=21:fontcolor=0xA8DED0:x=72:y=55:alpha='{alpha}':shadowcolor=black:shadowx=2:shadowy=2,"
                f"drawtext=fontfile='{FONT}':textfile='{lines}':fontsize=32:line_spacing=8:fontcolor=0xFFF5E3:x=(w-text_w)/2:y=h-text_h-55:alpha='{alpha}':shadowcolor=black:shadowx=2:shadowy=2,"
                f"fade=t=in:st=0:d=0.55,fade=t=out:st={duration - 0.55}:d=0.55,format=yuv420p"
            )
            run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-loop', '1', '-framerate', str(FPS),
                 '-i', str(ASSETS / 'ending' / image), '-t', str(duration), '-vf', vf, '-an',
                 '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-r', str(FPS), str(dest)])
            clips.append(dest)
            print(f'{i + 1}/{len(SCENES)} 장면 완성', flush=True)
        listing = tmp / 'concat.txt'
        listing.write_text(''.join(f"file '{p}'\n" for p in clips), encoding='utf-8')
        music = tmp / 'music.wav'
        make_music(music, sum(scene[3] for scene in SCENES))
        output = ASSETS / 'chungyoung-ending.mp4'
        rendered = tmp / 'chungyoung-ending.mp4'
        run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(listing),
             '-i', str(music), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', str(rendered)])
        rendered.replace(output)
        print(f'완료: {output}', flush=True)


if __name__ == '__main__':
    main()
