import { cesiumColor, SceneStage, useCesiumViewer } from '@/components/CesiumViewer';
import { tagLabel } from '@/components/CesiumViewer/effects';
import { rampColor, rampGradientCss } from '@/components/CesiumViewer/palette';
import { pickLngLat } from '@/components/CesiumViewer/stations';
import DemoPage from '@/components/DemoPage';
import { useApi } from '@/hooks/useApi';
import { listAllDevices } from '@/services/ops';
import { centerGeoHash, geohashBounds } from '@/utils/MapCompute/geoHash';
import { AimOutlined, ClearOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Button, Listy, Segmented, Tag, Typography } from 'antd';
import * as Cesium from 'cesium';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildStationFleet } from './stationFleet';

type Cell = { hash: string; count: number; ratio: number; center: [number, number] };
type Source = 'live' | 'fleet';

/** 计数 → 挤出高度（数据长在 3D 上）：满格 ~330km，配合侧视定妆镜头 */
const cellHeight = (ratio: number) => 12_000 + ratio * 320_000;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * 站网密度立方页：真实站网（服务端 243 站，含 3 台演示场景站）或合成站网（8000 站，省级簇高斯散布）
 * 按当前 GeoHash 精度聚合计数，色带染色 + 挤出立方。切换精度/数据源时
 * 立方从 0 补间生长（CallbackProperty 动画，1.8s 后冻结成常量避免持续重镶嵌）。
 * hover 高亮格子，右侧分布直方图与 Top 列表联动。
 */
export default function GeoHashPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const { data: devices } = useApi(listAllDevices);
  const [source, setSource] = useState<Source>('live');
  const [precision, setPrecision] = useState(3);
  const [cells, setCells] = useState<Cell[]>([]);
  const [hovered, setHovered] = useState<Cell>();
  const [tilted, setTilted] = useState(false);
  const layerRef = useRef<Cesium.CustomDataSource>(null);
  const pointsRef = useRef<Cesium.PointPrimitiveCollection>(null);
  const freezeTimerRef = useRef<number | undefined>(undefined);
  const fleet = useMemo(() => buildStationFleet(8000), []);

  const stations = useMemo(() => {
    if (source === 'fleet') return fleet;
    return (devices ?? []).map((d) => ({ lng: d.lng, lat: d.lat, region: d.region ?? '' }));
  }, [source, devices, fleet]);

  const { containerRef, viewer, error, basemapFailed, retry } = useCesiumViewer({
    home: [104, 36, 5_600_000],
    entry: { pitch: Cesium.Math.toRadians(-78) },
    onReady: (instance) => {
      const layer = new Cesium.CustomDataSource('geohash');
      instance.dataSources.add(layer);
      layerRef.current = layer;
      // hover：高亮格柱 + 状态芯片；点击：飞入。
      // handler 只在 onReady 建一次，必须用回调参数 instance：闭包里的 state viewer 首帧是 null，
      // 底图重试后则是已销毁的旧实例
      const handler = new Cesium.ScreenSpaceEventHandler(instance.scene.canvas);
      handler.setInputAction((movement: { endPosition: Cesium.Cartesian2 }) => {
        const picked = instance.scene.pick(movement.endPosition);
        const cell = picked?.id?.properties?.cell?.getValue(Cesium.JulianDate.now());
        setHovered(cell ?? undefined);
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
      handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
        const picked = instance.scene.pick(click.position);
        const cell = picked?.id?.properties?.cell?.getValue(Cesium.JulianDate.now());
        if (cell && !instance.isDestroyed()) {
          const b = geohashBounds(cell.hash);
          if (b)
            instance.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(
                (b.longitudeMin + b.longitudeMax) / 2,
                (b.latitudeMin + b.latitudeMax) / 2,
                900_000,
              ),
              duration: 1.2,
            });
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      return () => handler.destroy();
    },
  });

  /* 站点点位：换数据源时重画（合成 8000 点走 PointPrimitiveCollection 批量渲染） */
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || stations.length === 0) return undefined;
    if (pointsRef.current) viewer.scene.primitives.remove(pointsRef.current);
    const points = viewer.scene.primitives.add(
      new Cesium.PointPrimitiveCollection(),
    ) as Cesium.PointPrimitiveCollection;
    stations.forEach((s) =>
      points.add({
        position: Cesium.Cartesian3.fromDegrees(s.lng, s.lat),
        pixelSize: 4,
        color: cesiumColor('#8fd3ff', 0.75),
        outlineColor: Cesium.Color.WHITE.withAlpha(0.3),
        outlineWidth: 1,
      }),
    );
    pointsRef.current = points;
    return () => {
      if (!viewer.isDestroyed() && pointsRef.current) viewer.scene.primitives.remove(pointsRef.current);
    };
  }, [viewer, stations]);

  /* 聚合：按精度编码 → 计数 → 色带格柱（带生长动画，动画结束后冻结为常量高度） */
  useEffect(() => {
    const layer = layerRef.current;
    if (!viewer || !layer || stations.length === 0) return;
    layer.entities.removeAll();
    window.clearTimeout(freezeTimerRef.current);
    const counts = new Map<string, number>();
    stations.forEach((s) => {
      const hash = centerGeoHash(s.lat, s.lng, precision);
      counts.set(hash, (counts.get(hash) ?? 0) + 1);
    });
    const list: Cell[] = [...counts.entries()]
      .map(([hash, count]) => {
        const b = geohashBounds(hash);
        return {
          hash,
          count,
          ratio: 0,
          center: (b ? [(b.longitudeMin + b.longitudeMax) / 2, (b.latitudeMin + b.latitudeMax) / 2] : [0, 0]) as [
            number,
            number,
          ],
        };
      })
      .sort((a, b) => b.count - a.count);
    const max = list[0]?.count ?? 1;
    list.forEach((cell) => {
      cell.ratio = cell.count / max;
    });

    const growStart = performance.now();
    const entityHeights: [Cesium.Entity, number][] = [];
    list.forEach((cell, i) => {
      const b = geohashBounds(cell.hash);
      if (!b) return;
      const target = cellHeight(cell.ratio);
      const stagger = Math.min(700, i * 6);
      const entity = layer.entities.add({
        rectangle: {
          coordinates: Cesium.Rectangle.fromDegrees(b.longitudeMin, b.latitudeMin, b.longitudeMax, b.latitudeMax),
          material: cesiumColor(rampColor(cell.ratio), 0.42 + 0.4 * cell.ratio),
          height: 0,
          extrudedHeight: new Cesium.CallbackProperty(() => {
            const p = Math.min(1, Math.max(0, (performance.now() - growStart - stagger) / 650));
            return target * easeOutCubic(p);
          }, false),
          outline: true,
          outlineColor: Cesium.Color.WHITE.withAlpha(0.5),
        },
        position: Cesium.Cartesian3.fromDegrees(cell.center[0], cell.center[1], target),
        label: {
          ...tagLabel({ font: '11px ui-monospace, Menlo, monospace' }),
          text: `${cell.count}`,
          showBackground: cell.ratio > 0.5,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: { cell },
      });
      entityHeights.push([entity, target]);
    });
    // 冻结：动态几何每帧重镶嵌，几百格长跑会掉帧；补间完成即钉死成常量
    freezeTimerRef.current = window.setTimeout(() => {
      entityHeights.forEach(([entity, height]) => {
        if (entity.rectangle) entity.rectangle.extrudedHeight = new Cesium.ConstantProperty(height);
      });
    }, 1900);
    setCells(list);
  }, [viewer, stations, precision]);

  /** 俯视 ↔ 侧视：侧视才能看出挤出高度的数据差异，这是这页的「定妆镜头」 */
  const flyView = (next: boolean) => {
    setTilted(next);
    if (!viewer) return;
    viewer.camera.flyTo({
      destination: next
        ? Cesium.Cartesian3.fromDegrees(104, 24.5, 3_400_000)
        : Cesium.Cartesian3.fromDegrees(104, 36, 5_600_000),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(next ? -36 : -90), roll: 0 },
      duration: 1.8,
    });
  };

  const locateCenter = () => {
    if (!viewer || !layerRef.current) return;
    const lngLat = pickLngLat(
      viewer,
      new Cesium.Cartesian2(viewer.scene.canvas.clientWidth / 2, viewer.scene.canvas.clientHeight / 2),
    );
    const rect = viewer.camera.computeViewRectangle();
    if (!rect) return;
    const c = Cesium.Rectangle.center(rect);
    const lng = lngLat ? lngLat[0] : Cesium.Math.toDegrees(c.longitude);
    const lat = lngLat ? lngLat[1] : Cesium.Math.toDegrees(c.latitude);
    const hash = centerGeoHash(lat, lng, precision);
    const b = geohashBounds(hash);
    if (b) {
      layerRef.current.entities.add({
        rectangle: {
          coordinates: Cesium.Rectangle.fromDegrees(b.longitudeMin, b.latitudeMin, b.longitudeMax, b.latitudeMax),
          material: cesiumColor('#fa8c16', 0.5),
          outline: true,
          outlineColor: Cesium.Color.ORANGE,
        },
      });
    }
    setHovered({ hash, count: 0, ratio: 0, center: [lng, lat] });
  };

  const clear = () => {
    layerRef.current?.entities.removeAll();
    setCells([]);
    setHovered(undefined);
  };

  /* 分布直方图（纯 SVG：count 分 10 档，hover 的格子所在档位高亮） */
  const histogram = useMemo(() => {
    if (cells.length === 0) return undefined;
    const max = cells[0].count;
    // max === 1（所有格子 count=1）时分母 log10(1)=0 → NaN 档位：全部落第 0 档
    const binOf = (count: number) =>
      max <= 1 ? 0 : Math.min(9, Math.floor((Math.log10(count) / Math.log10(max)) * 10));
    const bins = new Array(10).fill(0) as number[];
    cells.forEach((cell) => {
      bins[binOf(cell.count)] += 1;
    });
    const hoveredBin = hovered && hovered.count > 0 ? binOf(hovered.count) : -1;
    const W = 250;
    const H = 84;
    const bw = W / bins.length;
    const maxBin = Math.max(...bins, 1);
    return (
      <div className="scene-panel">
        <div className="scene-panel-title">{t('cesium.geohash.distribution')}</div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {bins.map((n, i) => {
            const h = (n / maxBin) * (H - 18);
            return (
              <rect
                key={i}
                x={i * bw + 1.5}
                y={H - 14 - h}
                width={bw - 3}
                height={h}
                rx={1.5}
                fill={i === hoveredBin ? '#faad14' : rampColor(i / 9)}
                opacity={i === hoveredBin ? 1 : 0.8}
              />
            );
          })}
          <line x1={0} y1={H - 13} x2={W} y2={H - 13} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
        </svg>
        <div className="flex justify-between font-mono text-[10px] opacity-60">
          <span>1</span>
          <span>{max}</span>
        </div>
      </div>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, hovered]);

  const topList = (
    <div className="scene-panel">
      <div className="scene-panel-title">{t('cesium.geohash.topCells')}</div>
      <Listy
        items={cells.slice(0, 10)}
        rowKey="hash"
        styles={{ item: { paddingBlock: 6, paddingInline: 0 } }}
        itemRender={(cell: Cell) => (
          <div
            className={`flex cursor-pointer items-center justify-between gap-2 rounded px-1 ${hovered?.hash === cell.hash ? 'bg-white/10' : ''}`}
            onMouseEnter={() => setHovered(cell)}
          >
            <Typography.Text code className="text-xs">
              {cell.hash}
            </Typography.Text>
            <Tag className="mr-0 font-mono" color={rampColor(cell.ratio)}>
              {cell.count}
            </Tag>
          </div>
        )}
      />
    </div>
  );

  const legend = (
    <div className="scene-panel">
      <div className="scene-panel-title">{t('cesium.geohash.legend')}</div>
      <div className="h-2.5 w-40 rounded-sm" style={{ background: rampGradientCss() }} />
      <div className="mt-0.5 flex justify-between font-mono text-[10px] opacity-70">
        <span>1</span>
        <span>{cells[0]?.count ?? '—'}</span>
      </div>
    </div>
  );

  return (
    <DemoPage descriptionId="page.cesium.geohash.desc" source="src/pages/Map/Cesium/GeoHash.tsx">
      <SceneStage
        containerRef={containerRef}
        viewer={viewer}
        error={error}
        basemapFailed={basemapFailed}
        onRetryBasemap={retry}
        title={t('cesium.geohash.title')}
        kpis={[
          { label: t('cesium.geohash.kpi.stations'), value: stations.length },
          { label: t('cesium.geohash.kpi.cells'), value: cells.length },
          { label: t('cesium.geohash.kpi.max'), value: cells[0]?.count ?? '—' },
          ...(hovered
            ? [
                {
                  label: t('cesium.geohash.kpi.hover'),
                  value: `${hovered.hash} · ${hovered.count}`,
                  tone: 'warning' as const,
                },
              ]
            : []),
        ]}
        actions={
          <>
            <Segmented
              size="small"
              value={source}
              onChange={(value) => setSource(value as Source)}
              options={[
                { value: 'live', label: t('cesium.geohash.sourceLive') },
                { value: 'fleet', label: t('cesium.geohash.sourceFleet') },
              ]}
            />
            <Segmented
              size="small"
              value={precision}
              onChange={(value) => setPrecision(value as number)}
              options={[2, 3, 4, 5].map((p) => ({ value: p, label: `${t('cesium.geohash.precision')} ${p}` }))}
            />
            <Segmented
              size="small"
              value={tilted ? 'tilt' : 'top'}
              onChange={(value) => flyView(value === 'tilt')}
              options={[
                { value: 'top', label: t('cesium.geohash.viewTop') },
                { value: 'tilt', label: t('cesium.geohash.viewTilt') },
              ]}
            />
            <Button size="small" icon={<AimOutlined />} disabled={!viewer} onClick={locateCenter}>
              {t('cesium.geohash.center')}
            </Button>
            <Button size="small" icon={<ClearOutlined />} onClick={clear}>
              {t('map.clear')}
            </Button>
          </>
        }
        panels={topList}
        rightPanels={histogram}
        legend={legend}
      />
    </DemoPage>
  );
}
