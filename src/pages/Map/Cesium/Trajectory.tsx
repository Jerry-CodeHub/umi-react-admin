import { CesiumStage, useCesiumViewer } from '@/components/CesiumViewer';
import { pickLngLat } from '@/components/CesiumViewer/stations';
import DemoPage from '@/components/DemoPage';
import { handlerComputePoint, mergePolygons, mergePolygonsPath, type Point } from '@/utils/MapCompute/cesiumCompute';
import { distanceKm } from '@/utils/MapCompute/geodesy';
import { BlockOutlined, CheckOutlined, ClearOutlined, GatewayOutlined, NodeIndexOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Alert, App, Button, Card } from 'antd';
import * as Cesium from 'cesium';
import { useRef, useState } from 'react';

const SAMPLE_METERS = 1000;
const MAX_SAMPLES = 2000;

type Envelope = { longitude: number; latitude: number }[];

const fetchJson = async <T,>(path: string) => {
  const response = await fetch(`${PUBLIC_PATH}${path}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
};

const toPositions = (points: Point[]) =>
  Cesium.Cartesian3.fromDegreesArray(points.flatMap((p) => [p.longitude, p.latitude]));

export default function Trajectory() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const { message } = App.useApp();
  const [drawing, setDrawing] = useState(false);
  const [result, setResult] = useState<string>();
  const [polygonCount, setPolygonCount] = useState(214);
  const waypointsRef = useRef<Point[]>([]);
  const drawingRef = useRef(false);
  const layerRef = useRef<Cesium.CustomDataSource>(null);
  const samplesRef = useRef<Cesium.PointPrimitiveCollection>(null);

  const { containerRef, viewer, error } = useCesiumViewer({
    home: [126.6, 46.4, 1_600_000],
    onReady: (instance) => {
      const layer = new Cesium.CustomDataSource('routes');
      instance.dataSources.add(layer);
      layerRef.current = layer;
      // 画线模式下每次点击追加一个途经点；实时线段用 CallbackProperty 跟随数组
      const handler = new Cesium.ScreenSpaceEventHandler(instance.scene.canvas);
      handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
        if (!drawingRef.current) return;
        const lngLat = pickLngLat(instance, click.position);
        if (!lngLat) return;
        waypointsRef.current.push({ longitude: lngLat[0], latitude: lngLat[1] });
        layer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(...lngLat),
          point: { pixelSize: 8, color: Cesium.Color.YELLOW, outlineColor: Cesium.Color.BLACK, outlineWidth: 1 },
        });
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      return () => handler.destroy();
    },
  });

  const clear = () => {
    layerRef.current?.entities.removeAll();
    if (viewer && samplesRef.current) viewer.scene.primitives.remove(samplesRef.current);
    samplesRef.current = null;
    waypointsRef.current = [];
    setResult(undefined);
  };

  const startDrawing = () => {
    clear();
    drawingRef.current = true;
    setDrawing(true);
    (viewer!.container as HTMLElement).style.cursor = 'crosshair';
    layerRef.current!.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() => toPositions(waypointsRef.current), false),
        width: 3,
        material: Cesium.Color.YELLOW,
        clampToGround: true,
      },
    });
  };

  /** 完成：按每公里插值生成采样点（巡检时每个点对应一次测量） */
  const finishDrawing = () => {
    drawingRef.current = false;
    setDrawing(false);
    (viewer!.container as HTMLElement).style.cursor = '';
    const waypoints = waypointsRef.current;
    if (waypoints.length < 2) return;
    const samples = handlerComputePoint(waypoints, SAMPLE_METERS);
    if (samples.length > MAX_SAMPLES) {
      message.warning(t('cesium.route.tooLong', { max: MAX_SAMPLES }));
      return;
    }
    const points = viewer!.scene.primitives.add(
      new Cesium.PointPrimitiveCollection(),
    ) as Cesium.PointPrimitiveCollection;
    samples.forEach((p) =>
      points.add({
        position: Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude),
        pixelSize: 4,
        color: Cesium.Color.CYAN,
      }),
    );
    samplesRef.current = points;
    const length = waypoints
      .slice(1)
      .reduce(
        (sum, p, i) => sum + distanceKm([waypoints[i].longitude, waypoints[i].latitude], [p.longitude, p.latitude]),
        0,
      );
    setResult(t('cesium.route.result', { length: length.toFixed(1), count: samples.length }));
  };

  /** 三种能力包络的并集（turf union） */
  const mergeEnvelopes = async () => {
    clear();
    const data =
      await fetchJson<Record<'intercept' | 'location' | 'demodulation', Envelope>>('data/cesium/envelopes.json');
    const polygons = [data.intercept, data.location, data.demodulation].map((ring) =>
      ring.map((p) => ({ longitude: p.longitude, latitude: p.latitude })),
    );
    polygons.forEach((ring) =>
      layerRef.current!.entities.add({
        polygon: {
          hierarchy: toPositions(ring),
          material: Cesium.Color.WHITE.withAlpha(0.1),
          outline: true,
          outlineColor: Cesium.Color.WHITE,
        },
      }),
    );
    mergePolygons(polygons).forEach((ring) =>
      layerRef.current!.entities.add({
        polygon: { hierarchy: toPositions(ring), material: Cesium.Color.GOLD.withAlpha(0.35), height: 20_000 },
      }),
    );
    viewer!.flyTo(layerRef.current!, { duration: 1.2 });
  };

  /** 东北区 200+ 个站点覆盖：先取凸包再合并成一个多边形，或逐个显示对比 */
  const drawCoverage = async (merge: boolean) => {
    clear();
    const polygons = await fetchJson<Point[][]>('data/cesium/coverage-polygons.json');
    setPolygonCount(polygons.length);
    if (merge) {
      layerRef.current!.entities.add({
        polygon: { hierarchy: toPositions(mergePolygonsPath(polygons)), material: Cesium.Color.RED.withAlpha(0.4) },
      });
    } else {
      polygons.forEach((ring, index) =>
        layerRef.current!.entities.add({
          polygon: { hierarchy: toPositions(ring), material: Cesium.Color.RED.withAlpha(0.15), height: index * 100 },
        }),
      );
    }
    viewer!.flyTo(layerRef.current!, { duration: 1.2 });
  };

  return (
    <DemoPage
      descriptionId="page.cesium.trajectory.desc"
      source="src/utils/MapCompute/cesiumCompute.ts"
      extra={
        <>
          {drawing ? (
            <Button type="primary" icon={<CheckOutlined />} onClick={finishDrawing}>
              {t('cesium.route.finish')}
            </Button>
          ) : (
            <Button type="primary" icon={<NodeIndexOutlined />} disabled={!viewer} onClick={startDrawing}>
              {t('cesium.route.draw')}
            </Button>
          )}
          <Button icon={<GatewayOutlined />} disabled={!viewer || drawing} onClick={mergeEnvelopes}>
            {t('cesium.route.merge')}
          </Button>
          <Button icon={<BlockOutlined />} disabled={!viewer || drawing} onClick={() => drawCoverage(true)}>
            {t('cesium.route.mergeMany', { count: polygonCount })}
          </Button>
          <Button disabled={!viewer || drawing} onClick={() => drawCoverage(false)}>
            {t('cesium.route.showMany')}
          </Button>
          <Button icon={<ClearOutlined />} disabled={drawing} onClick={clear}>
            {t('map.clear')}
          </Button>
        </>
      }
    >
      <Alert
        type={drawing ? 'warning' : 'info'}
        showIcon
        className="mb-4"
        message={drawing ? t('cesium.route.drawing') : (result ?? t('cesium.route.hint'))}
      />
      <Card styles={{ body: { padding: 0 } }}>
        <CesiumStage containerRef={containerRef} viewer={viewer} error={error} />
      </Card>
    </DemoPage>
  );
}
