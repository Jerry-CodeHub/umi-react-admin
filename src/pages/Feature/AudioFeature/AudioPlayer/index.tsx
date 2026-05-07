import { ProCard } from '@ant-design/pro-components';
import { useEffect } from 'react';
import Player from 'xgplayer';
import MusicPreset, { Analyze, Lyric } from 'xgplayer-music';
import 'xgplayer-music/dist/index.min.css';
import 'xgplayer/dist/index.min.css';
import { AudioPlayerStyles } from './AudioPlayerStyle';

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
    const lyricTxts = `[00:00.00] 脆弱一分钟\n[00:00.00] 作曲 : 林家谦\n[00:00.00] 作词 : 徐世珍/吴辉福\n[00:00.000]编曲：林家谦\n[00:00.000]时钟不要走\n[00:04.220]让我脆弱一分钟\n[00:07.440]要多久才能习惯被放手\n[00:15.800]马克杯空了 暖暖的温热\n[00:22.660]却还在我手中停留\n[00:27.960]\n[00:29.790]勇气不要走\n[00:32.200]给我理由再冲动\n[00:35.690]去相信爱情 就算还在痛\n[00:43.960]如果我不说不会有人懂\n[00:50.720]失去你我有多寂寞\n[00:55.610]还是愿意\n[00:57.580]付出一切仅仅为了一个好梦\n[01:03.980]梦里有人真心爱我 陪我快乐也陪我沉默\n[01:11.260]没有无缘无故的痛承受越多越成熟\n[01:18.630]能让你拥抱更好的我\n[01:25.030] 谁也不要走\n[01:28.270]应该是一种奢求\n[01:31.900]可是我只想 握紧你的手\n[01:39.780]我宁愿等候 也不愿错过\n[01:46.630]你对我微笑的时候\n[01:56.780]\n[02:18.910]还是愿意\n[02:21.320]用尽全力仅仅为了一个以后\n[02:27.870]哪怕生命并不温柔哪怕被幸福一再反驳\n[02:34.870]也要相信伤痕累累 其实只是在琢磨\n[02:42.070]能让你为之一亮 的我\n[02:53.910]\n[02:56.350]制作人：林宥嘉\n[02:57.750]制作助理：张婕汝\n[02:59.010]录音师：陈文骏、叶育轩\n[03:00.410]录音室：白金录音室\n[03:01.740]混音师：SimonLi @ nOiz\n[03:03.000]OP: Terence Lam Production & Co. (Warner/Chappell Music, HK Ltd.)\n[03:04.050]SP: Warner/Chappell Music Taiwan Ltd.\n[03:04.910]OP：Universal Ms Publ Ltd Taiwan\n`;

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
    canvasDom.width = window.innerWidth;
    canvasDom.height = window.innerHeight * 0.25;

    return () => {
      jsSelect?.removeEventListener('change', handleSelectChange);
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
