import { ProCard } from '@ant-design/pro-components';
import { useMount } from 'ahooks';
import Player from 'xgplayer';

import 'xgplayer/dist/index.min.css';

export default function VideoPlayer() {
  // useMount 而非 useEffect，确保仅在组件首次挂载后初始化一次播放器，避免 StrictMode 下重复创建实例
  useMount(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let player = new Player({
      id: 'mse',
      url: '//sf1-cdn-tos.huoshanstatic.com/obj/media-fe/xgplayer_doc_video/mp4/xgplayer-demo-360p.mp4',
      poster: '//lf9-cdn-tos.bytecdntp.com/cdn/expire-1-M/byted-player-videos/1.0.0/poster.jpg',
      height: '70vh',
      width: '100vh',
    });
  });

  return (
    <ProCard className="shadow-2xl">
      <h1>VideoPlayer</h1>
      <div className="mt-8 mb-8 shadow-2xl" id="mse"></div>
    </ProCard>
  );
}
