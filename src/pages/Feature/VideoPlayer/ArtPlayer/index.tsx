import { ProCard } from '@ant-design/pro-components';
import ArtPlayer from 'artplayer';
import { useEffect, useRef } from 'react';

const VideoArtPlayer = () => {
  const artRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!artRef.current) {
      return;
    }

    const art = new ArtPlayer({
      url: 'https://artplayer.org/assets/sample/video.mp4',
      // url: require('@/assets/video.mp4'),
      poster: require('@/assets/poster.jpg'),
      container: artRef.current,
      volume: 0.5, // 初始音量
      isLive: false, // 是否直播
      muted: false, // 是否静音
      autoplay: false, // 是否自动播放
      pip: true, // 是否开启画中画
      autoSize: true, // 是否自适应大小
      autoMini: true, // 是否自动迷你模式
      screenshot: true, // 是否开启截图
      setting: true, // 是否开启设置
      loop: true, // 是否循环播放
      flip: true, // 是否开启翻转
      playbackRate: true, // 是否开启播放速度
      aspectRatio: true, // 是否开启画面比例
      fullscreen: true, // 是否开启全屏
      fullscreenWeb: true, // 是否开启全屏Web
      subtitleOffset: true, // 是否开启字幕偏移
      miniProgressBar: true, // 是否开启迷你进度条
      mutex: true, // 是否互斥
      backdrop: true, // 是否开启背景
      playsInline: true, // 是否在页面内播放
      autoPlayback: true, // 是否自动播放
      airplay: true, // 是否开启投屏
      theme: '#23ade5', // 主题色
      lang: navigator.language.toLowerCase(), // 语言
      moreVideoAttr: {
        // 更多 video 标签属性
        crossOrigin: 'anonymous', // 跨域属性
      },
    });

    return () => {
      if (art && art.destroy) {
        art.destroy(false);
      }
    };
  }, []);

  return (
    <>
      <ProCard title="ArtPlayer" className="h-96">
        <div ref={artRef} style={{ width: '100%', height: '400px' }}></div>
      </ProCard>
    </>
  );
};

export default VideoArtPlayer;
