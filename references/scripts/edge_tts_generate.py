import argparse
import asyncio
from pathlib import Path

import edge_tts


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--voice', required=True)
    parser.add_argument('--rate', required=True)
    parser.add_argument('--text', required=True)
    parser.add_argument('--media', required=True)
    parser.add_argument('--subtitles', required=True)
    return parser.parse_args()


async def generate(args):
    communicate = edge_tts.Communicate(args.text, args.voice, rate=args.rate, boundary='WordBoundary')
    subtitle_maker = edge_tts.SubMaker()
    media_path = Path(args.media)
    subtitles_path = Path(args.subtitles)
    media_path.parent.mkdir(parents=True, exist_ok=True)
    subtitles_path.parent.mkdir(parents=True, exist_ok=True)

    with media_path.open('wb') as audio_file:
        async for chunk in communicate.stream():
            if chunk['type'] == 'audio':
                audio_file.write(chunk['data'])
            elif chunk['type'] == 'WordBoundary':
                subtitle_maker.feed(chunk)

    subtitles_path.write_text(subtitle_maker.get_srt().rstrip() + '\n', encoding='utf-8')


if __name__ == '__main__':
    asyncio.run(generate(parse_args()))
