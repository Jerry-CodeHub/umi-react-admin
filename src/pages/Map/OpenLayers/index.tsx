import DemoPage from '@/components/DemoPage';
import { DEVICE_STATUS_CSS } from '@/constants/semantic';
import { useApi } from '@/hooks/useApi';
import { useChartTheme } from '@/hooks/useChartTheme';
import { listAllDevices } from '@/services/ops';
import type { Device } from '@/services/types';
import { AimOutlined, CloseOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Button, Card } from 'antd';
import Feature from 'ol/Feature';
import Map from 'ol/Map';
import Overlay from 'ol/Overlay';
import View from 'ol/View';
import { boundingExtent } from 'ol/extent';
import Point from 'ol/geom/Point';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import 'ol/ol.css';
import { fromLonLat } from 'ol/proj';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import { Circle, Fill, Stroke, Style } from 'ol/style';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StationCard, StatusFilterBar, StatusLegend, type StatusFilter } from '../components/stationUi';
import './openlayers.css';

/** 每种状态一个共享样式对象（OpenLayers 推荐复用 Style，避免每个要素各建一份） */
const STYLES = Object.fromEntries(
  Object.entries(DEVICE_STATUS_CSS).map(([status, color]) => [
    status,
    new Style({
      image: new Circle({ radius: 5, fill: new Fill({ color }), stroke: new Stroke({ color: '#fff', width: 1 }) }),
    }),
  ]),
);

export default function OpenLayersPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { dark } = useChartTheme();
  const { data: devices } = useApi(listAllDevices);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map>(undefined);
  const sourceRef = useRef<VectorSource>(undefined);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<Device>();

  const chinaExtent = useMemo(
    () => (devices ? boundingExtent(devices.map((d) => fromLonLat([d.lng, d.lat]))) : undefined),
    [devices],
  );

  useEffect(() => {
    if (!containerRef.current || !popupRef.current) return undefined;
    const source = new VectorSource();
    sourceRef.current = source;
    const popup = new Overlay({
      element: popupRef.current,
      positioning: 'bottom-center',
      offset: [0, -12],
      stopEvent: true,
    });
    const map = new Map({
      target: containerRef.current,
      // 暗色主题下瓦片层加 CSS 滤镜反色（见 openlayers.css），矢量点位颜色不受影响
      layers: [new TileLayer({ source: new OSM(), className: 'ol-layer osm-tiles' }), new VectorLayer({ source })],
      overlays: [popup],
      view: new View({ center: fromLonLat([108.5, 34.5]), zoom: 4.3 }),
    });
    map.on('singleclick', (event) => {
      const feature = map.forEachFeatureAtPixel(event.pixel, (f) => f);
      const device = feature?.get('device') as Device | undefined;
      setSelected(device);
      popup.setPosition(device ? fromLonLat([device.lng, device.lat]) : undefined);
    });
    map.on('pointermove', (event) => {
      (map.getTargetElement() as HTMLElement).style.cursor = map.hasFeatureAtPixel(event.pixel) ? 'pointer' : '';
    });
    mapRef.current = map;
    return () => map.setTarget(undefined);
  }, []);

  // 按状态筛选重建要素
  useEffect(() => {
    const source = sourceRef.current;
    if (!source || !devices) return;
    source.clear();
    source.addFeatures(
      devices
        .filter((device) => filter === 'all' || device.status === filter)
        .map((device) => {
          const feature = new Feature({ geometry: new Point(fromLonLat([device.lng, device.lat])), device });
          feature.setStyle(STYLES[device.status]);
          return feature;
        }),
    );
  }, [devices, filter]);

  const resetView = () => {
    if (chinaExtent) mapRef.current?.getView().fit(chinaExtent, { padding: [48, 48, 48, 48], duration: 600 });
  };

  const closePopup = () => {
    setSelected(undefined);
    mapRef.current?.getOverlays().item(0).setPosition(undefined);
  };

  return (
    <DemoPage
      descriptionId="page.openlayers.desc"
      source="src/pages/Map/OpenLayers/index.tsx"
      extra={
        <>
          {devices && <StatusFilterBar devices={devices} value={filter} onChange={setFilter} />}
          <Button icon={<AimOutlined />} onClick={resetView}>
            {t('map.reset')}
          </Button>
        </>
      }
    >
      <Card styles={{ body: { padding: 0 } }}>
        <div
          className={`relative h-[calc(100vh-280px)] min-h-[480px] overflow-hidden rounded-lg${dark ? ' ol-dark' : ''}`}
        >
          <div ref={containerRef} className="absolute inset-0" />
          <div className="absolute top-3 right-3 z-10">
            <StatusLegend />
          </div>
          <div ref={popupRef}>
            {selected && (
              <Card size="small" className="shadow-lg">
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  className="float-right -mt-1 -mr-1"
                  onClick={closePopup}
                  aria-label={intl.formatMessage({ id: 'common.close' })}
                />
                <StationCard device={selected} />
              </Card>
            )}
          </div>
        </div>
      </Card>
    </DemoPage>
  );
}
