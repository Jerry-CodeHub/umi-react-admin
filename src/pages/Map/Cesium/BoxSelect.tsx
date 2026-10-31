import { cesiumColor, SceneStage, useCesiumViewer } from '@/components/CesiumViewer';
import { pulseRing, tagLabel } from '@/components/CesiumViewer/effects';
import { ACCENT_CSS } from '@/components/CesiumViewer/palette';
import { addStationPoints, pickLngLat, STATUS_CSS } from '@/components/CesiumViewer/stations';
import DemoPage from '@/components/DemoPage';
import { DEVICE_STATUS_KEYS } from '@/constants/enums';
import { useApi } from '@/hooks/useApi';
import { useEnums } from '@/hooks/useEnums';
import { listAllDevices } from '@/services/ops';
import type { Device } from '@/services/types';
import { distanceKm, circle as geodesyCircle } from '@/utils/MapCompute/geodesy';
import {
  AimOutlined,
  ClearOutlined,
  ColumnWidthOutlined,
  GatewayOutlined,
  RadiusSettingOutlined,
} from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Badge, Button, Listy, Segmented, Space, Typography } from 'antd';
import * as Cesium from 'cesium';
import { useEffect, useRef, useState } from 'react';

type Tool = 'box' | 'polygon' | 'circle' | 'measure';

const NMI_PER_KM = 1 / 1.852;

/** 多边形内判定（射线法，经纬平面；演示尺度足够） */
const pointInPolygon = (p: [number, number], polygon: [number, number][]) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/**
 * 空间查询与量测页：四种工具——按住拖拽的矩形框选、点击加点双击收口的多边形套索、
 * 两击定圆的圆形选择（半径实时预览）、多段连续量测（逐段标注 + 累计里程，km/nmi 切换）。
 * 选中站点在右列面板汇总（状态分布 + 列表），hover 列表项在地图上脉冲高亮该站。
 */
export default function BoxSelect() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const enums = useEnums();
  const { data: devices } = useApi(listAllDevices);
  const [tool, setTool] = useState<Tool>();
  const [selected, setSelected] = useState<Device[]>();
  const [measureTotal, setMeasureTotal] = useState<number>();
  const [units, setUnits] = useState<'km' | 'nmi'>('km');
  const [hoverDevice, setHoverDevice] = useState<Device>();

  const toolRef = useRef<Tool>(undefined);
  const devicesRef = useRef<Device[]>([]);
  const layerRef = useRef<Cesium.CustomDataSource>(null);
  const highlightRef = useRef<Cesium.Entity>(null);
  // 各工具的进行时状态（不进 React state，避免每帧渲染）
  const boxDragRef = useRef<{ start?: [number, number]; current?: [number, number] }>({});
  const polygonRef = useRef<[number, number][]>([]);
  const circleRef = useRef<{ center?: [number, number]; edge?: [number, number] }>({});
  const measureRef = useRef<[number, number][]>([]);
  devicesRef.current = devices ?? [];
  toolRef.current = tool;
  // fmtLen 被 onReady 里的 CallbackProperty/标签闭包长期持有，直接读 state 会冻结在首次渲染的
  // 单位上（切 km→nmi 后侧板变了、圆半径与量测标签不变）：走 ref 取当前值
  const unitsRef = useRef(units);
  unitsRef.current = units;

  const fmtLen = (km: number) =>
    unitsRef.current === 'km' ? `${km.toFixed(1)} km` : `${(km * NMI_PER_KM).toFixed(1)} nmi`;

  const { containerRef, viewer, error, basemapFailed, retry } = useCesiumViewer({
    home: [108, 35, 4_600_000],
    entry: { pitch: Cesium.Math.toRadians(-90) },
    onReady: (instance) => {
      const layer = new Cesium.CustomDataSource('select');
      instance.dataSources.add(layer);
      layerRef.current = layer;

      const cursor = (next?: Tool) => {
        (instance.container as HTMLElement).style.cursor = next ? 'crosshair' : '';
      };

      /* 矩形：按住拖拽（LEFT_DOWN 起点、MOUSE_MOVE 橡皮筋、LEFT_UP 定选） */
      const rubberBand = layer.entities.add({
        rectangle: {
          coordinates: new Cesium.CallbackProperty(() => {
            const { start, current } = boxDragRef.current;
            if (!start || !current) return new Cesium.Rectangle(0, 0, 0, 0);
            return Cesium.Rectangle.fromDegrees(
              Math.min(start[0], current[0]),
              Math.min(start[1], current[1]),
              Math.max(start[0], current[0]),
              Math.max(start[1], current[1]),
            );
          }, false),
          material: cesiumColor(ACCENT_CSS.selection, 0.15),
          outline: true,
          outlineColor: cesiumColor(ACCENT_CSS.selection),
        },
      });
      rubberBand.show = false;

      /* 多边形：点击加点 + 指向光标的预览边；双击收口（光标点存闭包变量，每帧变不值 setState） */
      let polygonCursor: [number, number] | undefined;
      const previewLine = layer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            const points = polygonRef.current;
            if (points.length === 0) return [];
            const seq = points.flatMap((p) => [p[0], p[1]]);
            if (polygonCursor) seq.push(polygonCursor[0], polygonCursor[1]);
            if (points.length >= 2) seq.push(points[0][0], points[0][1]);
            return Cesium.Cartesian3.fromDegreesArray(seq);
          }, false),
          width: 2,
          material: cesiumColor(ACCENT_CSS.selection, 0.9),
          clampToGround: true,
        },
      });
      previewLine.show = false;

      /* 圆形：两击定圆（中心 → 边缘），半径实时预览 */
      const circleRadiusKm = () => {
        const { center, edge } = circleRef.current;
        return center && edge ? distanceKm(center, edge) : 0;
      };
      const circlePreview = layer.entities.add({
        ellipse: {
          semiMajorAxis: new Cesium.CallbackProperty(() => circleRadiusKm() * 1000, false),
          semiMinorAxis: new Cesium.CallbackProperty(() => circleRadiusKm() * 1000, false),
          material: cesiumColor(ACCENT_CSS.selection, 0.14),
          outline: true,
          outlineColor: cesiumColor(ACCENT_CSS.selection),
        },
        position: new Cesium.CallbackPositionProperty(() => {
          const c = circleRef.current.center;
          return c ? Cesium.Cartesian3.fromDegrees(c[0], c[1]) : undefined;
        }, false),
        label: {
          ...tagLabel({ font: '11px ui-monospace, Menlo, monospace' }),
          text: new Cesium.CallbackProperty(() => {
            const r = circleRadiusKm();
            return r > 0 ? fmtLen(r) : '';
          }, false) as unknown as string,
          eyeOffset: new Cesium.Cartesian3(0, 0, -10),
        },
      });
      circlePreview.show = false;

      /* 量测：多段折线 + 逐段标注 + 累计 */
      const measureLine = layer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            const seq = measureRef.current.flatMap((p) => [p[0], p[1]]);
            return seq.length >= 4 ? Cesium.Cartesian3.fromDegreesArray(seq) : [];
          }, false),
          width: 2.4,
          material: cesiumColor('#fadb14', 0.95),
          clampToGround: true,
        },
      });
      measureLine.show = false;

      const finishMeasure = () => {
        const points = measureRef.current;
        let total = 0;
        for (let i = 1; i < points.length; i++) total += distanceKm(points[i - 1], points[i]);
        if (points.length >= 2) setMeasureTotal(total);
        measureRef.current = [];
      };

      const handler = new Cesium.ScreenSpaceEventHandler(instance.scene.canvas);
      handler.setInputAction((down: { position: Cesium.Cartesian2 }) => {
        if (toolRef.current !== 'box') return;
        const lngLat = pickLngLat(instance, down.position);
        if (!lngLat) return;
        boxDragRef.current = { start: lngLat, current: lngLat };
        rubberBand.show = true;
      }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
      handler.setInputAction((move: { endPosition: Cesium.Cartesian2 }) => {
        const active = toolRef.current;
        const lngLat = pickLngLat(instance, move.endPosition);
        if (!lngLat || !active) {
          if (!active) polygonCursor = undefined;
          return;
        }
        if (active === 'box' && boxDragRef.current.start) {
          boxDragRef.current.current = lngLat;
        } else if (active === 'polygon') {
          polygonCursor = lngLat;
        } else if (active === 'circle' && circleRef.current.center) {
          circleRef.current.edge = lngLat;
        }
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
      handler.setInputAction((_up: { position: Cesium.Cartesian2 }) => {
        if (toolRef.current !== 'box') return;
        const { start, current } = boxDragRef.current;
        boxDragRef.current = {};
        rubberBand.show = false;
        if (!start || !current) return;
        const rect = Cesium.Rectangle.fromDegrees(
          Math.min(start[0], current[0]),
          Math.min(start[1], current[1]),
          Math.max(start[0], current[0]),
          Math.max(start[1], current[1]),
        );
        layer.entities.add({
          rectangle: {
            coordinates: rect,
            material: cesiumColor(ACCENT_CSS.selection, 0.1),
            outline: true,
            outlineColor: cesiumColor(ACCENT_CSS.selection, 0.9),
          },
        });
        setSelected(
          devicesRef.current.filter((d) =>
            Cesium.Rectangle.contains(rect, Cesium.Cartographic.fromDegrees(d.lng, d.lat)),
          ),
        );
        setTool(undefined);
        cursor(undefined);
      }, Cesium.ScreenSpaceEventType.LEFT_UP);
      handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
        const active = toolRef.current;
        const lngLat = pickLngLat(instance, click.position);
        if (!active || !lngLat) return;
        if (active === 'polygon') {
          polygonRef.current.push(lngLat);
          layer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(...lngLat),
            point: {
              pixelSize: 7,
              color: cesiumColor(ACCENT_CSS.selection),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 1,
            },
          });
          previewLine.show = true;
        } else if (active === 'circle') {
          if (!circleRef.current.center) {
            circleRef.current = { center: lngLat };
            circlePreview.show = true;
          } else {
            circleRef.current.edge = lngLat;
            const { center, edge } = circleRef.current;
            const radius = distanceKm(center, edge);
            const ring = geodesyCircle(center[0], center[1], radius, 6);
            layer.entities.add({
              polygon: {
                hierarchy: Cesium.Cartesian3.fromDegreesArray([...ring, ring[0]].flat()),
                material: cesiumColor(ACCENT_CSS.selection, 0.1),
                outline: true,
                outlineColor: cesiumColor(ACCENT_CSS.selection, 0.9),
              },
            });
            setSelected(devicesRef.current.filter((d) => distanceKm([d.lng, d.lat], center) <= radius));
            circleRef.current = {};
            circlePreview.show = false;
            setTool(undefined);
            cursor(undefined);
          }
        } else if (active === 'measure') {
          const points = measureRef.current;
          const prev = points[points.length - 1];
          measureRef.current.push(lngLat);
          measureLine.show = true;
          layer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(...lngLat),
            point: { pixelSize: 7, color: cesiumColor('#fadb14'), outlineColor: Cesium.Color.BLACK, outlineWidth: 1 },
          });
          if (prev) {
            let cum = 0;
            for (let i = 1; i < measureRef.current.length - 1; i++)
              cum += distanceKm(measureRef.current[i - 1], measureRef.current[i]);
            const seg = distanceKm(prev, lngLat);
            layer.entities.add({
              position: Cesium.Cartesian3.fromDegrees((prev[0] + lngLat[0]) / 2, (prev[1] + lngLat[1]) / 2),
              label: {
                ...tagLabel({ font: '11px ui-monospace, Menlo, monospace', fillCss: '#ffe58f' }),
                text: fmtLen(seg),
                eyeOffset: new Cesium.Cartesian3(0, 0, -10),
              },
            });
            setMeasureTotal(cum + seg);
          }
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      handler.setInputAction(() => {
        const active = toolRef.current;
        if (active === 'polygon' && polygonRef.current.length >= 3) {
          const polygon = [...polygonRef.current];
          layer.entities.add({
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray([...polygon, polygon[0]].flat()),
              material: cesiumColor(ACCENT_CSS.selection, 0.1),
              outline: true,
              outlineColor: cesiumColor(ACCENT_CSS.selection, 0.9),
            },
          });
          setSelected(devicesRef.current.filter((d) => pointInPolygon([d.lng, d.lat], polygon)));
          polygonRef.current = [];
          previewLine.show = false;
          setTool(undefined);
          cursor(undefined);
        } else if (active === 'measure') {
          finishMeasure();
          setTool(undefined);
          cursor(undefined);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

      return () => {
        handler.destroy();
        polygonCursor = undefined;
        if (!instance.isDestroyed()) instance.dataSources.remove(layer, true);
      };
    },
  });

  useEffect(() => {
    if (!viewer || !devices) return undefined;
    const points = addStationPoints(viewer, devices);
    return () => {
      if (!viewer.isDestroyed()) viewer.scene.primitives.remove(points);
    };
  }, [viewer, devices]);

  /* 列表 hover → 地图脉冲高亮 */
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    if (highlightRef.current) {
      viewer.entities.remove(highlightRef.current);
      highlightRef.current = null;
    }
    if (!hoverDevice) return;
    highlightRef.current = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(hoverDevice.lng, hoverDevice.lat, 1000),
      ellipse: pulseRing(ACCENT_CSS.selection, 26_000, 1.4),
    });
  }, [viewer, hoverDevice]);

  const start = (next: Tool) => {
    layerRef.current?.entities.removeAll();
    boxDragRef.current = {};
    polygonRef.current = [];
    circleRef.current = {};
    measureRef.current = [];
    setSelected(undefined);
    setMeasureTotal(undefined);
    setTool(next);
    // viewer 未就绪（首帧、底图重试换实例的空窗）时只切工具状态，不碰光标
    if (viewer) (viewer.container as HTMLElement).style.cursor = 'crosshair';
  };

  const clear = () => {
    layerRef.current?.entities.removeAll();
    boxDragRef.current = {};
    polygonRef.current = [];
    circleRef.current = {};
    measureRef.current = [];
    setSelected(undefined);
    setMeasureTotal(undefined);
    setTool(undefined);
    if (viewer) (viewer.container as HTMLElement).style.cursor = '';
  };

  const legend = (
    <div className="scene-panel">
      <Space direction="vertical" size={2}>
        {DEVICE_STATUS_KEYS.map((status) => (
          <Badge
            key={status}
            color={STATUS_CSS[status]}
            text={enums.label('deviceStatus', status)}
            className="text-xs"
          />
        ))}
      </Space>
    </div>
  );

  const resultPanel =
    selected && selected.length > 0 ? (
      <div className="scene-panel">
        <div className="scene-panel-title">
          {t('cesium.select.result', {
            count: selected.length,
            online: selected.filter((d) => d.status === 'online').length,
          })}
        </div>
        <Listy
          items={selected}
          rowKey="id"
          styles={{ item: { paddingBlock: 6, paddingInline: 0 } }}
          itemRender={(device: Device) => (
            <div
              className="flex cursor-pointer items-center justify-between gap-2 rounded px-1"
              onMouseEnter={() => setHoverDevice(device)}
              onMouseLeave={() => setHoverDevice(undefined)}
            >
              <Badge color={STATUS_CSS[device.status]} text={device.name} className="text-xs" />
              <Typography.Text type="secondary" className="font-mono text-[11px]">
                {device.uptime30d}%
              </Typography.Text>
            </div>
          )}
        />
      </div>
    ) : measureTotal !== undefined ? (
      <div className="scene-panel">
        <div className="scene-panel-title">{t('cesium.select.measureResult')}</div>
        <Typography.Text strong className="font-mono text-lg">
          {fmtLen(measureTotal)}
        </Typography.Text>
      </div>
    ) : undefined;

  return (
    <DemoPage descriptionId="page.cesium.select.desc" source="src/pages/Map/Cesium/BoxSelect.tsx">
      <SceneStage
        containerRef={containerRef}
        viewer={viewer}
        error={error}
        basemapFailed={basemapFailed}
        onRetryBasemap={retry}
        title={t('cesium.select.title')}
        kpis={[
          { label: t('cesium.select.kpi.stations'), value: devices?.length ?? 0 },
          ...(selected
            ? [{ label: t('cesium.select.kpi.selected'), value: selected.length, tone: 'warning' as const }]
            : []),
          ...(measureTotal !== undefined
            ? [{ label: t('cesium.select.kpi.length'), value: fmtLen(measureTotal) }]
            : []),
        ]}
        actions={
          <>
            <Segmented
              size="small"
              value={tool}
              onChange={(value) => start(value as Tool)}
              options={[
                { value: 'box', icon: <GatewayOutlined />, label: t('cesium.select.box') },
                { value: 'polygon', icon: <AimOutlined />, label: t('cesium.select.polygon') },
                { value: 'circle', icon: <RadiusSettingOutlined />, label: t('cesium.select.circle') },
                { value: 'measure', icon: <ColumnWidthOutlined />, label: t('cesium.select.measure') },
              ]}
            />
            <Segmented
              size="small"
              value={units}
              onChange={(value) => setUnits(value as 'km' | 'nmi')}
              options={[
                { value: 'km', label: 'km' },
                { value: 'nmi', label: 'nmi' },
              ]}
            />
            <Button size="small" icon={<ClearOutlined />} onClick={clear}>
              {t('map.clear')}
            </Button>
          </>
        }
        panels={resultPanel}
        legend={legend}
      >
        {tool && (
          <div className="absolute inset-x-0 top-3 z-20 mx-auto w-fit">
            <div className="scene-panel">{t(`cesium.select.${tool}Hint`)}</div>
          </div>
        )}
      </SceneStage>
    </DemoPage>
  );
}
