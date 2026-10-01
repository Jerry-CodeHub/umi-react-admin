import DemoPage from '@/components/DemoPage';
import { useIntl } from '@umijs/max';
import { Card, Typography } from 'antd';
import { useEffect, useRef } from 'react';
import Player from 'xgplayer';

import 'xgplayer/dist/index.min.css';

export default function Video() {
  const intl = useIntl();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const player = new Player({
      el: containerRef.current,
      url: 'https://sf1-cdn-tos.huoshanstatic.com/obj/media-fe/xgplayer_doc_video/mp4/xgplayer-demo-360p.mp4',
      // 封面自制并随站点托管（此前热链的第三方图片被 CSP img-src 拦截，播放器区为白底）
      poster: `${PUBLIC_PATH}media/video-poster.svg`,
      lang: intl.locale === 'en-US' ? 'en' : 'zh-cn',
      fluid: true,
    });
    return () => player.destroy();
  }, [intl.locale]);

  return (
    <DemoPage descriptionId="page.video.desc" source="src/pages/Media/Video/index.tsx">
      <Card>
        <div className="mx-auto max-w-5xl overflow-hidden rounded-lg">
          <div ref={containerRef} />
        </div>
        <Typography.Paragraph type="secondary" className="mx-auto mt-4 max-w-5xl text-xs">
          {intl.formatMessage({ id: 'video.source' })}
        </Typography.Paragraph>
      </Card>
    </DemoPage>
  );
}
