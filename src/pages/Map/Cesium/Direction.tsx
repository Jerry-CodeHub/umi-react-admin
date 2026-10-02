import { CesiumStage, useCesiumViewer } from '@/components/CesiumViewer';
import DemoPage from '@/components/DemoPage';
import { useApi } from '@/hooks/useApi';
import { circle, destination } from '@/utils/MapCompute/geodesy';
import { AimOutlined, CalculatorOutlined, ClearOutlined, RadarChartOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Alert, Badge, Button, Card, Space } from 'antd';
import * as Cesium from 'cesium';
import { useEffect, useMemo, useRef } from 'react';

type EnvelopePoint = { azimuth: number; distanceKm: number; longitude: number; latitude: number };
type Envelopes = { origin: [number, number] } & Record<Capability, EnvelopePoint[]>;
type Capability = 'intercept' | 'location' | 'demodulation';

const CAPABILITIES: Capability[] = ['location', 'intercept', 'demodulation'];
const COLOR: Record<Capability, string> = { intercept: '#ff4d4f', location: '#1677ff', demodulation: '#52c41a' };

const loadEnvelopes = async (): Promise<Envelopes> => {
  const response = await fetch(`${PUBLIC_PATH}data/cesium/envelopes.json`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as Envelopes;
};

const hierarchy = (points: [number, number][]) =>
  new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(points.flat()));

export default function Direction() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const { data } = useApi(loadEnvelopes);
  const layerRef = useRef<Cesium.CustomDataSource>(null);
  const { containerRef, viewer, error } = useCesiumViewer({ home: [116.52, 30.39, 1_200_000] });

  useEffect(() => {
    if (!viewer || !data) return undefined;
    const layer = new Cesium.CustomDataSource('direction');
    viewer.dataSources.add(layer);
    layerRef.current = layer;
    // 监测点标记
    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(...data.origin),
      point: { pixelSize: 10, color: Cesium.Color.ORANGE, outlineColor: Cesium.Color.WHITE, outlineWidth: 2 },
    });
    return () => {
      if (!viewer.isDestroyed()) viewer.dataSources.remove(layer, true);
    };
  }, [viewer, data]);

  const stats = useMemo(
    () =>
      data
        ? CAPABILITIES.map((key) => {
            const distances = data[key].map((p) => p.distanceKm);
            return {
              key,
              max: Math.max(...distances).toFixed(0),
              min: Math.min(...distances).toFixed(0),
              avg: (distances.reduce((s, d) => s + d, 0) / distances.length).toFixed(0),
            };
          })
        : [],
    [data],
  );

  const flyToLayer = () => {
    if (viewer && layerRef.current) viewer.flyTo(layerRef.current, { duration: 1.2 });
  };

  /** 实测包络：直接用数据里的经纬度连成多边形 */
  const drawMeasured = () => {
    if (!data || !layerRef.current) return;
    CAPABILITIES.forEach((key) =>
      layerRef.current!.entities.add({
        polygon: {
          hierarchy: hierarchy(data[key].map((p) => [p.longitude, p.latitude])),
          material: Cesium.Color.fromCssColorString(COLOR[key]).withAlpha(0.25),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString(COLOR[key]),
        },
      }),
    );
    flyToLayer();
  };

  /** 计算包络：只用「方位 + 距离」经大圆公式求终点，画成虚线，应与实测包络重合 */
  const drawComputed = () => {
    if (!data || !layerRef.current) return;
    CAPABILITIES.forEach((key) => {
      const points = data[key].map((p) => destination(...data.origin, p.azimuth, p.distanceKm));
      layerRef.current!.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray([...points, points[0]].flat()),
          width: 2,
          material: new Cesium.PolylineDashMaterialProperty({ color: Cesium.Color.fromCssColorString(COLOR[key]) }),
          clampToGround: true,
        },
      });
    });
    flyToLayer();
  };

  const drawCircle = () => {
    if (!data || !layerRef.current) return;
    layerRef.current.entities.add({
      polygon: {
        hierarchy: hierarchy(circle(...data.origin, 100)),
        material: Cesium.Color.WHITE.withAlpha(0.08),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
      },
    });
    flyToLayer();
  };

  const legend = (
    <Card size="small" className="pointer-events-auto opacity-95">
      <Space direction="vertical" size={2}>
        {stats.map((row) => (
          <Badge
            key={row.key}
            color={COLOR[row.key]}
            text={t('cesium.direction.stats', {
              name: t(`cesium.direction.${row.key}`),
              max: row.max,
              min: row.min,
              avg: row.avg,
            })}
          />
        ))}
      </Space>
    </Card>
  );

  return (
    <DemoPage
      descriptionId="page.cesium.direction.desc"
      source="src/utils/MapCompute/geodesy.ts"
      extra={
        <>
          <Button type="primary" icon={<RadarChartOutlined />} disabled={!data || !viewer} onClick={drawMeasured}>
            {t('cesium.direction.measured')}
          </Button>
          <Button icon={<CalculatorOutlined />} disabled={!data || !viewer} onClick={drawComputed}>
            {t('cesium.direction.computed')}
          </Button>
          <Button icon={<AimOutlined />} disabled={!data || !viewer} onClick={drawCircle}>
            {t('cesium.direction.circle')}
          </Button>
          <Button icon={<ClearOutlined />} onClick={() => layerRef.current?.entities.removeAll()}>
            {t('map.clear')}
          </Button>
        </>
      }
    >
      <Alert type="info" showIcon className="mb-4" message={t('cesium.direction.hint')} />
      <Card styles={{ body: { padding: 0 } }}>
        <CesiumStage containerRef={containerRef} viewer={viewer} error={error} overlay={data && legend} />
      </Card>
    </DemoPage>
  );
}
