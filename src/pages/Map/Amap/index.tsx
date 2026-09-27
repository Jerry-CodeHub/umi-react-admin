/**
 * 参考于:
 * https://juejin.cn/post/6951328185539624967
 * 说明: Key 经 AMAP_KEY / AMAP_SECURITY_CODE 环境变量注入（见 config/config.ts define）；
 * 未配置时回落 @pansy/amap-api-loader 自带的公共 key——其配额与可用性不受本项目控制，
 * 正式部署请申请自己的 Web 端（JS API）Key 并配套安全密钥（审计 2026-09-22 M-6）。
 *
 * 直接调用 JS API 2.0，不再经 @pansy/react-amap：其 Marker 依赖的 @pansy/use-portal 调用了
 * React 19 已删除的 unmountComponentAtNode，且该库 2024-06 后无更新。加载器仍用 @pansy/amap-api-loader（不依赖 React）。
 */
import { getMessage } from '@/utils/antdMessage';
import { ProCard } from '@ant-design/pro-components';
import { load } from '@pansy/amap-api-loader';
import { useEffect, useRef } from 'react';

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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let map: AMap.Map | undefined;
    let marker: AMap.Marker | undefined;

    load({ key: AMAP_KEY || undefined, version: '2.0' })
      .then((AMapApi) => {
        if (disposed || !containerRef.current) return;
        map = new AMapApi.Map(containerRef.current, { WebGLParams: {} } as AMap.Map.Options);
        map.on('click', (event: AMapClickEvent) => {
          const position: [number, number] = [event.lnglat.getLng(), event.lnglat.getLat()];
          getMessage().success(`获取的坐标点位置为${position}`);
          if (marker) {
            marker.setPosition(position);
          } else {
            marker = new AMapApi.Marker({ position });
            map?.add(marker);
          }
        });
      })
      .catch((error: unknown) => {
        if (!disposed)
          getMessage().error(`高德地图加载失败：${error instanceof Error ? error.message : String(error)}`);
      });

    return () => {
      disposed = true;
      map?.destroy();
    };
  }, []);

  return (
    <AutonaviMapStyle>
      <ProCard>
        <div ref={containerRef} style={{ height: 500 }} />
      </ProCard>
    </AutonaviMapStyle>
  );
}
