import { ProCard } from '@ant-design/pro-components';
import { useEffect } from 'react';
import Player from 'xgplayer';

import 'xgplayer/dist/index.min.css';

export default function VideoPlayer() {
  useEffect(() => {
    const player = new Player({
      id: 'mse',
      url: 'https://sf1-cdn-tos.huoshanstatic.com/obj/media-fe/xgplayer_doc_video/mp4/xgplayer-demo-360p.mp4',
      // 封面自制并随站点托管（此前热链的第三方图片被 CSP img-src 拦截，播放器区为白底）
      poster: `${PUBLIC_PATH}media/video-poster.svg`,
      height: '70vh',
      width: '100%',
    });

    return () => {
      player.destroy();
    };
  }, []);

  return (
    <ProCard className="shadow-2xl">
      <h1>VideoPlayer</h1>
      <div className="mt-8 mb-8 shadow-2xl" id="mse"></div>
    </ProCard>
  );
}
