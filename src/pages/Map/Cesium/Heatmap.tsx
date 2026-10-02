import { CesiumStage, useCesiumViewer } from '@/components/CesiumViewer';
import DemoPage from '@/components/DemoPage';
import { ClearOutlined, DotChartOutlined, HeatMapOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Alert, Button, Card, Spin } from 'antd';
import * as Cesium from 'cesium';
import { useRef, useState } from 'react';

type Sample = { longitude: number; latitude: number; fieldStrength: number };
type FieldStrengthData = {
  /** 服务端渲染好的热力图 PNG（base64），覆盖 coverDiagramParams 描述的经纬度范围 */
  diagramPngStream: string;
  coverageData: { arrayResult: Sample[][]; maxStrength: number; minStrength: number };
};

/** 场强分级色：与图例一致 */
const STRENGTH_STOPS: [number, string][] = [
  [25, '#2f54eb'],
  [40, '#52c41a'],
  [60, '#fadb14'],
  [75, '#fa8c16'],
  [Infinity, '#f5222d'],
];
const strengthColor = (value: number) => STRENGTH_STOPS.find(([limit]) => value <= limit)![1];

let dataPromise: Promise<FieldStrengthData> | undefined;
/** 约 1.6 MB，首次使用时才拉取并缓存（失败允许重试） */
const loadData = () => {
  dataPromise ??= fetch(`${PUBLIC_PATH}data/cesium/field-strength.json`)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<FieldStrengthData>;
    })
    .catch((error) => {
      dataPromise = undefined;
      throw error;
    });
  return dataPromise;
};

const bounds = (samples: Sample[]) => {
  const lngs = samples.map((s) => s.longitude);
  const lats = samples.map((s) => s.latitude);
  return Cesium.Rectangle.fromDegrees(Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats));
};

export default function Heatmap() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const [loading, setLoading] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; value: number }>();
  const pointsRef = useRef<Cesium.PointPrimitiveCollection>(null);
  const textureRef = useRef<Cesium.Entity>(null);

  const { containerRef, viewer, error } = useCesiumViewer({
    home: [106.64, 29.67, 60_000],
    onReady: (instance) => {
      // 悬停读取场强：点图元的 id 挂的是采样点本身
      const handler = new Cesium.ScreenSpaceEventHandler(instance.scene.canvas);
      handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
        const picked = instance.scene.pick(movement.endPosition);
        const sample = picked?.id as Sample | undefined;
        setTooltip(
          sample && typeof sample.fieldStrength === 'number'
            ? {
                x: movement.endPosition.x,
                y: movement.endPosition.y,
                value: Math.round(sample.fieldStrength * 10) / 10,
              }
            : undefined,
        );
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
      return () => handler.destroy();
    },
  });

  const withData = async (draw: (data: FieldStrengthData) => void) => {
    setLoading(true);
    try {
      const data = await loadData();
      if (viewer && !viewer.isDestroyed()) draw(data);
    } finally {
      setLoading(false);
    }
  };

  /** 热力图纹理：base64 PNG 直接作为矩形材质铺在测试区域上 */
  const drawTexture = () =>
    withData((data) => {
      if (textureRef.current) viewer!.entities.remove(textureRef.current);
      const rectangle = bounds(data.coverageData.arrayResult.flat());
      textureRef.current = viewer!.entities.add({
        rectangle: {
          coordinates: rectangle,
          material: new Cesium.ImageMaterialProperty({
            image: `data:image/png;base64,${data.diagramPngStream}`,
            transparent: true,
          }),
        },
      });
      viewer!.camera.flyTo({ destination: rectangle, duration: 1.2 });
    });

  /** 点云：PointPrimitiveCollection 批量渲染 5 千多个采样点（Entity 方式会卡住主线程） */
  const drawPoints = () =>
    withData((data) => {
      if (pointsRef.current) viewer!.scene.primitives.remove(pointsRef.current);
      const samples = data.coverageData.arrayResult.flat();
      const points = viewer!.scene.primitives.add(
        new Cesium.PointPrimitiveCollection(),
      ) as Cesium.PointPrimitiveCollection;
      samples.forEach((sample) =>
        points.add({
          id: sample,
          position: Cesium.Cartesian3.fromDegrees(sample.longitude, sample.latitude),
          pixelSize: 6,
          color: Cesium.Color.fromCssColorString(strengthColor(sample.fieldStrength)).withAlpha(0.75),
        }),
      );
      pointsRef.current = points;
      viewer!.camera.flyTo({ destination: bounds(samples), duration: 1.2 });
    });

  const clear = () => {
    if (!viewer) return;
    if (textureRef.current) viewer.entities.remove(textureRef.current);
    if (pointsRef.current) viewer.scene.primitives.remove(pointsRef.current);
    textureRef.current = null;
    pointsRef.current = null;
  };

  const legend = (
    <Card size="small" className="opacity-95">
      <div className="mb-1 text-xs">{t('cesium.heatmap.legend')}</div>
      <div className="flex gap-1 text-[11px]">
        {STRENGTH_STOPS.map(([limit, color], index) => (
          <div key={color} className="text-center">
            <div className="h-2 w-10 rounded-sm" style={{ background: color }} />
            {index === STRENGTH_STOPS.length - 1 ? `> ${STRENGTH_STOPS[index - 1][0]}` : `≤ ${limit}`}
          </div>
        ))}
      </div>
    </Card>
  );

  return (
    <DemoPage
      descriptionId="page.cesium.heatmap.desc"
      source="src/pages/Map/Cesium/Heatmap.tsx"
      extra={
        <>
          <Button type="primary" icon={<HeatMapOutlined />} disabled={!viewer} onClick={drawTexture}>
            {t('cesium.heatmap.texture')}
          </Button>
          <Button icon={<DotChartOutlined />} disabled={!viewer} onClick={drawPoints}>
            {t('cesium.heatmap.points')}
          </Button>
          <Button icon={<ClearOutlined />} onClick={clear}>
            {t('map.clear')}
          </Button>
        </>
      }
    >
      <Alert type="info" showIcon className="mb-4" message={t('cesium.heatmap.hint')} />
      <Card styles={{ body: { padding: 0 } }}>
        <Spin spinning={loading} tip={t('cesium.heatmap.loading')}>
          <div className="relative">
            <CesiumStage containerRef={containerRef} viewer={viewer} error={error} overlay={legend} />
            {tooltip && (
              <div
                className="pointer-events-none absolute z-20 rounded bg-black/75 px-2 py-1 text-xs text-white"
                style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
              >
                {t('cesium.heatmap.tooltip', { value: tooltip.value })}
              </div>
            )}
          </div>
        </Spin>
      </Card>
    </DemoPage>
  );
}
