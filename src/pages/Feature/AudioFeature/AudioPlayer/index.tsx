import { ProCard } from '@ant-design/pro-components';
import { useEffect } from 'react';
import Player from 'xgplayer';
import MusicPreset, { Analyze, Lyric } from 'xgplayer-music';
import 'xgplayer-music/dist/index.min.css';
import 'xgplayer/dist/index.min.css';
import { AudioPlayerStyles } from './AudioPlayer.style';
import lyricData from './lyrics.json';

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
      url: '//sf1-cdn-tos.huoshanstatic.com/obj/media-fe/xgplayer_doc_video/music/audio.mp3', //[{ src: '//sf1-cdn-tos.huoshanstatic.com/obj/media-fe/xgplayer_doc_video/music/audio.mp3', name: '林宥嘉·脆弱一分钟', poster: '//sf1-cdn-tos.huoshanstatic.com/obj/media-fe/xgplayer_doc_video/music/poster-small.jpeg' }],
      volume: 0.8,
      // width: window.innerWidth,
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
    const lyricTxts = lyricData.lyrics;

    // 初始化频谱
    const analyze = new Analyze(player, document.querySelector('canvas') as HTMLElement, {
      bgColor: 'rgba(0,0,0,0.7)',
      stroke: 3,
    });
    window.analyze = analyze;

    // 初始化歌词模块
    const lyric = new Lyric([lyricTxts], document.querySelector('#gc'));
    lyric.bind(player);
    player.on('playing', function () {
      lyric.show();
      (player as PlayerWithMode).mode = 2;
    });
    let canvasDom = document.getElementById('canvas') as HTMLCanvasElement;
    // 画布尺寸取容器宽度而非窗口（固定头布局下 window 尺寸会溢出），高度固定
    const syncCanvasSize = () => {
      canvasDom.width = canvasDom.parentElement?.clientWidth || canvasDom.clientWidth || 800;
      canvasDom.height = 160;
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
              脆弱一分钟
              <div>歌手：林宥嘉</div>
              <div>专辑：脆弱一分钟 </div>
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
