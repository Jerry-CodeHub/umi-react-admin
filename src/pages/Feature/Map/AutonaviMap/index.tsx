/**
 * 参考于:
 * https://juejin.cn/post/6951328185539624967
 * https://github.com/pansyjs/react-amap
 * 说明: Key 经 AMAP_KEY / AMAP_SECURITY_CODE 环境变量注入（见 config/config.ts define）；
 * 未配置时回落 @pansy/amap-api-loader 自带的公共 key——其配额与可用性不受本项目控制，
 * 正式部署请申请自己的 Web 端（JS API）Key 并配套安全密钥（审计 2026-09-22 M-6）。
 */
import { getMessage } from '@/utils/antdMessage';
import { ProCard } from '@ant-design/pro-components';
import { Map, Marker } from '@pansy/react-amap';
import type { MapProps } from '@pansy/react-amap/es/map';
import { useState } from 'react';

import { AutonaviMapStyle } from './AutonaviMap.style';

// AMap JS API 2.0 的安全密钥必须在 JS API 脚本加载前挂到 window（官方约定），loader 异步加载前来得及
if (typeof window !== 'undefined' && AMAP_SECURITY_CODE && !window._AMapSecurityConfig) {
  window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_CODE };
}

type AMapClickEvent = {
  lnglat: {
    getLng: () => number;
    getLat: () => number;
  };
};

export default function AutonaviMap() {
  const [position, setPosition] = useState<[number, number] | undefined>();

  const mapEvents: MapProps['events'] = {
    click: (event: AMapClickEvent) => {
      const position: [number, number] = [event.lnglat.getLng(), event.lnglat.getLat()];
      getMessage().success(`获取的坐标点位置为${position}`);
      setPosition(position);
    },
  };

  return (
    <AutonaviMapStyle>
      <ProCard>
        <div style={{ height: 500 }}>
          <Map WebGLParams={{}} events={mapEvents} mapKey={AMAP_KEY || undefined}>
            {position && <Marker position={position} />}
          </Map>
        </div>
      </ProCard>
    </AutonaviMapStyle>
  );
}
