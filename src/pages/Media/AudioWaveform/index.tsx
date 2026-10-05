import DemoPage from '@/components/DemoPage';
import { useChartTheme } from '@/hooks/useChartTheme';
import { PauseCircleOutlined, PlayCircleOutlined, SwapOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Button, Card, Segmented, Space, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import Timeline from 'wavesurfer.js/plugins/timeline';

// 经 PUBLIC_PATH 拼接：GitHub Pages 部署在 /umi-react-admin/ 子路径下
const CLIPS = [`${PUBLIC_PATH}audio/audio.wav`, `${PUBLIC_PATH}audio/stereo.wav`];

export default function AudioWaveform() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const chart = useChartTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [clip, setClip] = useState(0);
  const [surfer, setSurfer] = useState<WaveSurfer>();
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState({ current: 0, total: 0 });
  const [meta, setMeta] = useState<{ channels: number; rate: string }>();

  // 切换音频或主题时重建（波形颜色取当前主题）
  useEffect(() => {
    if (!containerRef.current) return undefined;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      url: CLIPS[clip],
      height: 128,
      // 按峰值归一化：合成音振幅小，不归一化时波形只是一条细线
      normalize: true,
      // 未播放部分用中性灰、已播放部分用主色：进度一眼可见，颜色不和内容抢层级
      // （tertiary 而非 quaternary：图形与背景对比度要到 3:1）
      waveColor: chart.token.colorTextTertiary,
      progressColor: chart.token.colorPrimary,
      cursorColor: chart.token.colorPrimary,
      barWidth: 3,
      barGap: 2,
      barRadius: 3,
      plugins: [Timeline.create({ style: { color: chart.textSecondary } })],
    });
    const round = (value: number) => Math.round(value * 10) / 10;
    const subscriptions = [
      ws.on('ready', (duration) => {
        setPosition({ current: 0, total: round(duration) });
        const buffer = ws.getDecodedData();
        if (buffer) setMeta({ channels: buffer.numberOfChannels, rate: (buffer.sampleRate / 1000).toFixed(1) });
      }),
      ws.on('timeupdate', (time) => setPosition((p) => ({ ...p, current: round(time) }))),
      ws.on('play', () => setPlaying(true)),
      ws.on('pause', () => setPlaying(false)),
    ];
    setSurfer(ws);
    setPlaying(false);
    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe());
      ws.destroy();
    };
  }, [clip, chart]);

  return (
    <DemoPage
      descriptionId="page.audioWaveform.desc"
      source="src/pages/Media/AudioWaveform/index.tsx"
      extra={
        <Segmented
          value={clip}
          onChange={(value) => setClip(value as number)}
          options={CLIPS.map((_, index) => ({
            value: index,
            label: t('audio.clip', { index: index + 1 }),
            icon: <SwapOutlined />,
          }))}
        />
      }
    >
      <Card>
        <div ref={containerRef} className="min-h-[140px]" />
        <div className="mt-6 flex items-center justify-between">
          <Space>
            <Button
              type="primary"
              icon={playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={() => surfer?.playPause()}
              disabled={!surfer}
            >
              {t(playing ? 'audio.pause' : 'audio.play')}
            </Button>
          </Space>
          <Typography.Text type="secondary" className="tabular-nums">
            {meta && `${t('audio.meta', meta)} · `}
            {t('audio.position', { current: position.current.toFixed(1), total: position.total.toFixed(1) })}
          </Typography.Text>
        </div>
      </Card>
    </DemoPage>
  );
}
