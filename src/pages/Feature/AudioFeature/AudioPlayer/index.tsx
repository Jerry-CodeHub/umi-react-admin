import { ProCard } from '@ant-design/pro-components';
import { useEffect } from 'react';
import Player from 'xgplayer';
import MusicPreset, { Analyze, Lyric } from 'xgplayer-music';
import 'xgplayer-music/dist/index.min.css';
import 'xgplayer/dist/index.min.css';
import { AudioPlayerStyles } from './AudioPlayer.style';
import { demoLyrics } from './lyrics';

declare global {
  interface Window {
    analyze: InstanceType<typeof Analyze> | undefined;
  }
}

type PlayerWithMode = Player & {
  mode: number;
};

export default function AudioPlayer() {
  useEffect(() => {
    const jsSelect = document.getElementById('js-select') as HTMLSelectElement | null;
    const handleSelectChange = (e: Event) => {
      const value = (e.target as HTMLSelectElement).value;
      if (window.analyze) {
        window.analyze.mode = value;
        if (value === 'lightning') {
          window.analyze.options.count = 512;
          window.analyze.options.stroke = 4;
        } else {
          if (value === 'waves') {
            window.analyze.options.stroke = 3;
          } else {
            window.analyze.options.stroke = 2;
          }
          window.analyze.options.count = 256;
        }
      }
    };

    jsSelect?.addEventListener('change', handleSelectChange);

    const player = new Player({
      id: 'mse',
      // 项目自制的正弦合成音频（此前热链第三方 CDN 上的商业歌曲，已按演示媒体自制替换的约定移除）
      url: `${PUBLIC_PATH}audio/stereo.wav`,
      volume: 0.8,
      width: '100%',
      height: 50,
      mediaType: 'audio',
      presets: ['default', MusicPreset],
      ignores: ['playbackrate'],
      controls: {
        initShow: true,
        mode: 'flex',
      },
      marginControls: true,
      videoConfig: {
        crossOrigin: 'anonymous',
      },
    });
    player.crossOrigin = 'anonymous';

    // 频谱画布限定在本组件内查找（此前 document.querySelector('canvas') 取的是全页第一个 canvas）
    const canvasEl = document.querySelector<HTMLCanvasElement>('.audio-player #canvas canvas');

    // 初始化频谱
    const analyze = new Analyze(player, canvasEl as HTMLElement, {
      bgColor: 'rgba(0,0,0,0.7)',
      stroke: 3,
    });
    window.analyze = analyze;

    // 初始化歌词模块
    const lyric = new Lyric([demoLyrics], document.querySelector('#gc'));
    lyric.bind(player);
    player.on('playing', function () {
      lyric.show();
      (player as PlayerWithMode).mode = 2;
    });
    // 画布尺寸取容器宽度而非窗口（固定头布局下 window 尺寸会溢出），高度固定。
    // 此前误取 id="canvas" 的外层 div 设置 width/height，实际从未生效
    const syncCanvasSize = () => {
      if (!canvasEl) return;
      canvasEl.width = canvasEl.parentElement?.clientWidth || 800;
      canvasEl.height = 160;
    };
    syncCanvasSize();
    window.addEventListener('resize', syncCanvasSize);

    return () => {
      jsSelect?.removeEventListener('change', handleSelectChange);
      window.removeEventListener('resize', syncCanvasSize);
      window.analyze = undefined;
      player.destroy();
    };
  }, []);

  return (
    <AudioPlayerStyles>
      <ProCard className="shadow-2xl p-0">
        <div className="audio-player">
          <div id="left">
            <div id="album"></div>
            <div id="info">
              合成示例音
              <div>来源：项目自制（正弦合成）</div>
              <div>许可：随项目 MIT</div>
            </div>
          </div>
          <div className="select">
            <select id="js-select">
              <option value="waves">waves</option>
              <option value="bars">bars</option>
              <option value="lightning">lightning</option>
              <option value="vertLines">vertLines</option>
              <option value="doubleLine">doubleLine</option>
              <option value="doubleBars">doubleBars</option>
            </select>
          </div>
          <div id="canvas">
            <canvas width="550" height="110"></canvas>
          </div>
          <div id="mask">
            <div id="gc"></div>
          </div>

          <div id="mse"></div>
        </div>
      </ProCard>
    </AudioPlayerStyles>
  );
}
