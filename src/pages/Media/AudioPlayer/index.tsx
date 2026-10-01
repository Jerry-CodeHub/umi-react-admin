import DemoPage from '@/components/DemoPage';
import { demoLyrics } from '@/demo/lyrics';
import { useIntl } from '@umijs/max';
import { Card, Segmented, Space, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import Player from 'xgplayer';
import MusicPreset, { Analyze, Lyric } from 'xgplayer-music';
import 'xgplayer-music/dist/index.min.css';
import 'xgplayer/dist/index.min.css';
import './AudioPlayer.css';

type SpectrumMode = 'waves' | 'bars' | 'lightning' | 'vertLines' | 'doubleLine' | 'doubleBars';
const MODES: SpectrumMode[] = ['waves', 'bars', 'lightning', 'vertLines', 'doubleLine', 'doubleBars'];

/** 各频谱样式的采样数与线宽 */
const MODE_OPTIONS: Record<SpectrumMode, { count: number; stroke: number }> = {
  waves: { count: 256, stroke: 3 },
  bars: { count: 256, stroke: 2 },
  lightning: { count: 512, stroke: 4 },
  vertLines: { count: 256, stroke: 2 },
  doubleLine: { count: 256, stroke: 2 },
  doubleBars: { count: 256, stroke: 2 },
};

type PlayerWithMode = Player & { mode: number };

export default function AudioPlayer() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const playerRef = useRef<HTMLDivElement>(null);
  const lyricsRef = useRef<HTMLDivElement>(null);
  const spectrumRef = useRef<HTMLCanvasElement>(null);
  const analyzeRef = useRef<InstanceType<typeof Analyze>>(undefined);
  const [mode, setMode] = useState<SpectrumMode>('waves');
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playerRef.current || !spectrumRef.current || !lyricsRef.current) return undefined;
    const player = new Player({
      el: playerRef.current,
      // 项目自制的正弦合成音频（此前热链第三方 CDN 上的商业歌曲，已按演示媒体自制替换的约定移除）
      url: `${PUBLIC_PATH}audio/stereo.wav`,
      volume: 0.8,
      width: '100%',
      height: 50,
      mediaType: 'audio',
      presets: ['default', MusicPreset],
      ignores: ['playbackrate'],
      controls: { initShow: true, mode: 'flex' },
      marginControls: true,
      lang: intl.locale === 'en-US' ? 'en' : 'zh-cn',
    });

    const canvas = spectrumRef.current;
    const syncCanvasSize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = 160;
    };
    syncCanvasSize();
    const observer = new ResizeObserver(syncCanvasSize);
    observer.observe(canvas.parentElement!);

    analyzeRef.current = new Analyze(player, canvas, { bgColor: 'rgba(0,0,0,0)', stroke: 3 });
    const lyric = new Lyric([demoLyrics[intl.locale === 'en-US' ? 'en-US' : 'zh-CN']], lyricsRef.current);
    lyric.bind(player);
    player.on('playing', () => {
      lyric.show();
      (player as PlayerWithMode).mode = 2;
      setPlaying(true);
    });
    player.on('pause', () => setPlaying(false));
    player.on('ended', () => setPlaying(false));

    return () => {
      observer.disconnect();
      analyzeRef.current = undefined;
      player.destroy();
    };
  }, [intl.locale]);

  useEffect(() => {
    const analyze = analyzeRef.current;
    if (!analyze) return;
    analyze.mode = mode;
    Object.assign(analyze.options, MODE_OPTIONS[mode]);
  }, [mode]);

  return (
    <DemoPage
      descriptionId="page.audioPlayer.desc"
      source="src/pages/Media/AudioPlayer/index.tsx"
      extra={
        <Space>
          <Typography.Text type="secondary">{t('audio.mode')}</Typography.Text>
          <Segmented<SpectrumMode> size="small" value={mode} onChange={setMode} options={MODES} />
        </Space>
      }
    >
      <Card styles={{ body: { padding: 0 } }}>
        <div className={`audio-player-demo${playing ? ' playing' : ''}`}>
          <div className="stage-left">
            <div className="album" />
            <div className="info">
              {t('audio.title')}
              <small>{t('audio.source')}</small>
            </div>
          </div>
          <div className="spectrum">
            <canvas ref={spectrumRef} />
          </div>
          <div className="lyrics-mask">
            <div ref={lyricsRef} className="lyrics" />
          </div>
          <div className="controls" ref={playerRef} />
        </div>
      </Card>
    </DemoPage>
  );
}
