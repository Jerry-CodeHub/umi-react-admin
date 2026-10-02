/**
 * 高德地图：全部监测站按状态着色，点击查看详情。
 * Key 经 AMAP_KEY / AMAP_SECURITY_CODE 环境变量注入（见 config/config.ts define）；未配置时回落
 * @pansy/amap-api-loader 自带的公共 key——配额与可用性不受本项目控制，正式部署请申请自己的 Web 端 Key。
 * 直接调用 JS API 2.0（不经 @pansy/react-amap：其 Marker 依赖 React 19 已删除的 unmountComponentAtNode）。
 */
import DemoPage from '@/components/DemoPage';
import { DEVICE_STATUS_CSS } from '@/constants/semantic';
import { useApi } from '@/hooks/useApi';
import { useChartTheme } from '@/hooks/useChartTheme';
import { listAllDevices } from '@/services/ops';
import type { Device } from '@/services/types';
import { AimOutlined } from '@ant-design/icons';
import { load } from '@pansy/amap-api-loader';
import { getIntl, RawIntlProvider, useIntl } from '@umijs/max';
import { Alert, Button, Card } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StationCard, StatusFilterBar, StatusLegend, type StatusFilter } from '../components/stationUi';

// AMap JS API 2.0 的安全密钥必须在脚本加载前挂到 window（官方约定）
if (typeof window !== 'undefined' && AMAP_SECURITY_CODE && !window._AMapSecurityConfig) {
  window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_CODE };
}

const CHINA_CENTER: [number, number] = [108.5, 34.5];
const CHINA_ZOOM = 4.6;

export default function Amap() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string>) => intl.formatMessage({ id }, values);
  const { dark } = useChartTheme();
  const { data: devices } = useApi(listAllDevices);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<AMap.Map>(undefined);
  const markersRef = useRef<{ device: Device; marker: AMap.CircleMarker }[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    if (!devices || !containerRef.current) return undefined;
    let disposed = false;
    let popupRoot: Root | undefined;
    load({ key: AMAP_KEY || undefined, version: '2.0' })
      .then((AMapApi) => {
        if (disposed || !containerRef.current) return;
        const map = new AMapApi.Map(containerRef.current, {
          center: CHINA_CENTER,
          zoom: CHINA_ZOOM,
          mapStyle: dark ? 'amap://styles/dark' : 'amap://styles/normal',
        } as AMap.Map.Options);
        mapRef.current = map;
        // 弹窗内容用 React 渲染（与 OpenLayers 页共用 StationCard）
        const popupElement = document.createElement('div');
        popupRoot = createRoot(popupElement);
        const infoWindow = new AMapApi.InfoWindow({ content: popupElement, offset: new AMapApi.Pixel(0, -8) });
        markersRef.current = devices.map((device) => {
          const marker = new AMapApi.CircleMarker({
            center: new AMapApi.LngLat(device.lng, device.lat),
            radius: 5,
            fillColor: DEVICE_STATUS_CSS[device.status],
            fillOpacity: 0.9,
            strokeColor: '#ffffff',
            strokeWeight: 1,
            cursor: 'pointer',
          });
          marker.on('click', () => {
            popupRoot!.render(
              <RawIntlProvider value={getIntl()}>
                <StationCard device={device} />
              </RawIntlProvider>,
            );
            infoWindow.open(map, [device.lng, device.lat]);
          });
          map.add(marker);
          return { device, marker };
        });
      })
      .catch((error: unknown) => !disposed && setLoadError(error instanceof Error ? error.message : String(error)));
    return () => {
      disposed = true;
      markersRef.current = [];
      mapRef.current?.destroy();
      mapRef.current = undefined;
      setTimeout(() => popupRoot?.unmount());
    };
  }, [devices, dark]);

  useEffect(() => {
    markersRef.current.forEach(({ device, marker }) =>
      filter === 'all' || device.status === filter ? marker.show() : marker.hide(),
    );
  }, [filter, devices]);

  return (
    <DemoPage
      descriptionId="page.amap.desc"
      source="src/pages/Map/Amap/index.tsx"
      extra={
        <>
          {devices && <StatusFilterBar devices={devices} value={filter} onChange={setFilter} />}
          <Button icon={<AimOutlined />} onClick={() => mapRef.current?.setZoomAndCenter(CHINA_ZOOM, CHINA_CENTER)}>
            {t('map.reset')}
          </Button>
        </>
      }
    >
      {loadError && (
        <Alert type="error" showIcon className="mb-4" message={t('map.loadFailed', { reason: loadError })} />
      )}
      <Card styles={{ body: { padding: 0 } }}>
        <div className="relative h-[calc(100vh-280px)] min-h-[480px] overflow-hidden rounded-lg">
          <div ref={containerRef} className="absolute inset-0" />
          <div className="absolute top-3 right-3 z-10">
            <StatusLegend />
          </div>
        </div>
      </Card>
    </DemoPage>
  );
}
