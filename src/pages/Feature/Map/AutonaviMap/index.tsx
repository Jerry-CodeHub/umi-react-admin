/**
 * 参考于:
 * https://juejin.cn/post/6951328185539624967
 * https://github.com/pansyjs/react-amap
 * 说明: 未使用高德 Key/安全密钥
 */
import { ProCard } from '@ant-design/pro-components';
import { Map, Marker } from '@pansy/react-amap';
import type { MapProps } from '@pansy/react-amap/es/map';
import { message } from 'antd';
import { useState } from 'react';

import { AutonaviMapStyle } from './AutonaviMapStyle';

export default function AutonaviMap() {
  const [position, setPosition] = useState<ReactAMap.Position>();

  const mapEvents: MapProps['events'] = {
    click: (event: any) => {
      const position: [number, number] = [event.lnglat.getLng(), event.lnglat.getLat()];
      message.success(`获取的坐标点位置为${position}`);
      setPosition(position);
    },
  };

  return (
    <AutonaviMapStyle>
      <ProCard>
        <div style={{ height: 500 }}>
          <Map events={mapEvents}>{position && <Marker position={position} />}</Map>
        </div>
      </ProCard>
    </AutonaviMapStyle>
  );
}
