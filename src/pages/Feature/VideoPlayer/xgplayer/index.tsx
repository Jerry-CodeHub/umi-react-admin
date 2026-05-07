import { ProCard } from '@ant-design/pro-components';
import { useEffect } from 'react';
import Player from 'xgplayer';

import 'xgplayer/dist/index.min.css';

export default function VideoPlayer() {
  useEffect(() => {
    const player = new Player({
      id: 'mse',
      url: '//sf1-cdn-tos.huoshanstatic.com/obj/media-fe/xgplayer_doc_video/mp4/xgplayer-demo-360p.mp4',
      poster: '//lf9-cdn-tos.bytecdntp.com/cdn/expire-1-M/byted-player-videos/1.0.0/poster.jpg',
      height: '70vh',
      width: '100vh',
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
