import { CesiumStage, useCesiumViewer } from '@/components/CesiumViewer';
import DemoPage from '@/components/DemoPage';
import { distanceKm } from '@/utils/MapCompute/geodesy';
import { useIntl } from '@umijs/max';
import { Alert, Card, Segmented, Space, Switch, Typography } from 'antd';
import * as Cesium from 'cesium';
import CesiumNavigation from 'cesium-navigation-es6';
import { useEffect, useRef, useState } from 'react';

type Kind = 'ship' | 'aircraft';
type Target = { id: string; kind: Kind; knots: number; altitude: number; route: [number, number][] };

/** 关注海域（黄海南部—东海北部），目标与航线均为模拟数据 */
const AREA: [number, number][] = [
  [122.1, 36.6],
  [126.2, 36.3],
  [126.6, 30.4],
  [122.5, 29.9],
];

const TARGETS: Target[] = [
  {
    id: 'V-01',
    kind: 'ship',
    knots: 14,
    altitude: 0,
    route: [
      [122.6, 35.8],
      [123.8, 34.9],
      [124.6, 33.6],
      [125.2, 32.4],
    ],
  },
  {
    id: 'V-02',
    kind: 'ship',
    knots: 18,
    altitude: 0,
    route: [
      [125.8, 31.0],
      [124.9, 31.8],
      [123.6, 32.3],
      [122.8, 33.1],
    ],
  },
  {
    id: 'V-03',
    kind: 'ship',
    knots: 11,
    altitude: 0,
    route: [
      [123.2, 30.6],
      [123.9, 31.4],
      [124.3, 32.6],
      [124.1, 33.9],
    ],
  },
  {
    id: 'V-04',
    kind: 'ship',
    knots: 16,
    altitude: 0,
    route: [
      [125.6, 35.6],
      [124.8, 34.6],
      [124.9, 33.2],
      [125.7, 32.1],
    ],
  },
  {
    id: 'A-01',
    kind: 'aircraft',
    knots: 450,
    altitude: 9800,
    route: [
      [121.2, 31.2],
      [124.0, 33.0],
      [127.5, 35.2],
      [129.8, 37.0],
    ],
  },
  {
    id: 'A-02',
    kind: 'aircraft',
    knots: 420,
    altitude: 8900,
    route: [
      [128.5, 30.2],
      [125.5, 31.4],
      [122.6, 32.8],
      [120.4, 34.0],
    ],
  },
  {
    id: 'A-03',
    kind: 'aircraft',
    knots: 380,
    altitude: 7600,
    route: [
      [122.2, 37.4],
      [123.6, 35.2],
      [124.8, 32.9],
      [125.6, 30.1],
    ],
  },
];

const KNOT_KMH = 1.852;
const KIND_COLOR: Record<Kind, Cesium.Color> = {
  ship: Cesium.Color.fromCssColorString('#13c2c2'),
  aircraft: Cesium.Color.fromCssColorString('#fa8c16'),
};

/** 按航速把航线点换成时间样本：往返运动，时长覆盖整个演示时段 */
const buildPosition = (target: Target, start: Cesium.JulianDate, totalSeconds: number) => {
  const property = new Cesium.SampledPositionProperty();
  const loop = [...target.route, ...target.route.slice(0, -1).reverse()];
  let elapsed = 0;
  let index = 0;
  while (elapsed <= totalSeconds) {
    const point = loop[index % loop.length];
    property.addSample(
      Cesium.JulianDate.addSeconds(start, elapsed, new Cesium.JulianDate()),
      Cesium.Cartesian3.fromDegrees(point[0], point[1], target.altitude),
    );
    const next = loop[(index + 1) % loop.length];
    elapsed += (distanceKm(point, next) / (target.knots * KNOT_KMH)) * 3600;
    index += 1;
  }
  return property;
};

const DURATION_SECONDS = 12 * 3600;

export default function Situation() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const [speed, setSpeed] = useState(120);
  const [trails, setTrails] = useState(true);
  const [picked, setPicked] = useState<Target>();
  const entitiesRef = useRef<Cesium.Entity[]>([]);

  const { containerRef, viewer, error } = useCesiumViewer({
    home: [124.4, 29.2, 1_300_000],
    onReady: (instance) => {
      new CesiumNavigation(instance, { enableCompass: true, enableZoomControls: true, enableDistanceLegend: true });
      instance.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(124.4, 26.8, 900_000),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
      });
      const start = Cesium.JulianDate.now();
      const stop = Cesium.JulianDate.addSeconds(start, DURATION_SECONDS, new Cesium.JulianDate());
      Object.assign(instance.clock, {
        startTime: start.clone(),
        stopTime: stop,
        currentTime: start.clone(),
        clockRange: Cesium.ClockRange.LOOP_STOP,
        shouldAnimate: true,
      });

      instance.entities.add({
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray(AREA.flat()),
          material: Cesium.Color.DODGERBLUE.withAlpha(0.08),
          outline: true,
          outlineColor: Cesium.Color.DODGERBLUE,
        },
      });

      entitiesRef.current = TARGETS.map((target) =>
        instance.entities.add({
          id: target.id,
          position: buildPosition(target, start, DURATION_SECONDS),
          point: {
            pixelSize: target.kind === 'aircraft' ? 11 : 9,
            color: KIND_COLOR[target.kind],
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
          },
          label: {
            text: target.id,
            font: '12px sans-serif',
            pixelOffset: new Cesium.Cartesian2(0, -18),
            fillColor: Cesium.Color.WHITE,
            showBackground: true,
            backgroundColor: Cesium.Color.BLACK.withAlpha(0.55),
          },
          path: {
            leadTime: 0,
            trailTime: target.kind === 'aircraft' ? 1800 : 5400,
            width: 2,
            material: KIND_COLOR[target.kind].withAlpha(0.7),
          },
        }),
      );

      const handler = new Cesium.ScreenSpaceEventHandler(instance.scene.canvas);
      handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
        const entity = instance.scene.pick(click.position)?.id as Cesium.Entity | undefined;
        setPicked(TARGETS.find((target) => target.id === entity?.id));
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      return () => handler.destroy();
    },
  });

  useEffect(() => {
    if (viewer) viewer.clock.multiplier = speed;
  }, [viewer, speed]);

  useEffect(() => {
    entitiesRef.current.forEach((entity) => {
      if (entity.path) entity.path.show = new Cesium.ConstantProperty(trails);
    });
  }, [trails, viewer]);

  const kindLabel = (kind: Kind) => t(`cesium.situation.${kind}`);

  const legend = (
    <Card size="small" className="opacity-95">
      <Space direction="vertical" size={2} className="text-xs">
        {(['ship', 'aircraft'] as Kind[]).map((kind) => (
          <span key={kind} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: KIND_COLOR[kind].toCssColorString() }}
            />
            {kindLabel(kind)}
          </span>
        ))}
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 border border-solid" style={{ borderColor: '#1e90ff' }} />
          {t('cesium.situation.area')}
        </span>
      </Space>
    </Card>
  );

  return (
    <DemoPage
      descriptionId="page.cesium.situation.desc"
      source="src/pages/Map/Cesium/Situation.tsx"
      extra={
        <>
          <Space>
            <Typography.Text type="secondary">{t('cesium.situation.speed')}</Typography.Text>
            <Segmented
              value={speed}
              onChange={(value) => setSpeed(value as number)}
              options={[1, 60, 120, 600].map((value) => ({ value, label: `×${value}` }))}
            />
          </Space>
          <Space>
            <Switch size="small" checked={trails} onChange={setTrails} />
            {t('cesium.situation.trails')}
          </Space>
        </>
      }
    >
      <Alert
        type={picked ? 'success' : 'info'}
        showIcon
        className="mb-4"
        message={
          picked
            ? t('cesium.situation.target', { name: picked.id, kind: kindLabel(picked.kind), speed: picked.knots })
            : t('cesium.situation.hint')
        }
      />
      <Card styles={{ body: { padding: 0 } }}>
        <CesiumStage containerRef={containerRef} viewer={viewer} error={error} overlay={legend} />
      </Card>
    </DemoPage>
  );
}
