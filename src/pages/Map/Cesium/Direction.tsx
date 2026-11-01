import { cesiumColor, SceneStage, useCesiumViewer } from '@/components/CesiumViewer';
import { TimeDeck } from '@/components/CesiumViewer/TimeDeck';
import { addScanRing, headingRotation, tagLabel } from '@/components/CesiumViewer/effects';
import { CAPABILITY_CSS } from '@/components/CesiumViewer/palette';
import { militarySymbol } from '@/components/CesiumViewer/symbols';
import DemoPage from '@/components/DemoPage';
import { useChartTheme } from '@/hooks/useChartTheme';
import { Radar } from '@ant-design/plots';
import { useIntl } from '@umijs/max';
import { Badge, Button, Empty, Segmented, Space, Typography } from 'antd';
import * as Cesium from 'cesium';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CAPABILITIES,
  capabilityStats,
  envelopeRing,
  interceptMarginKm,
  isIntercepted,
  polarPattern,
  STATION,
  sweepAngle,
  targetPosition,
  TARGETS,
  type Capability,
  type SimTarget,
} from './capabilityModel';

type Mode = 'bands' | 'sweep' | 'both';

/** 覆盖带（ITU 风格）：标称包络按系数向内收缩出的同心「能力等距带」，
 *  外圈满能力、内圈核心能力。挤出多边形在该引擎版本有 worker 崩溃前科（见旧实现注释），
 *  贴地带稳定且观感更专业——立体感由 GeoHash 的挤出矩形承担。 */
const BAND_RATIOS = [1, 0.8, 0.6, 0.4, 0.2];

const shrinkToward = (center: { lng: number; lat: number }, point: [number, number], k: number): [number, number] => [
  center.lng + (point[0] - center.lng) * k,
  center.lat + (point[1] - center.lat) * k,
];

/** 带状多边形层级：外环正向 + 内环作为 hole（避免单环拼接的裂缝） */
const bandHierarchy = (capability: Capability, outer: number, inner: number) => {
  const ringAt = (k: number) =>
    Cesium.Cartesian3.fromDegreesArray(
      envelopeRing(capability, 0)
        .map((p) => shrinkToward(STATION, [p.longitude, p.latitude], k))
        .flat(),
    );
  return new Cesium.PolygonHierarchy(ringAt(outer), [new Cesium.PolygonHierarchy(ringAt(inner))]);
};

/**
 * 测向覆盖态势页：天线方向图模型（capabilityModel.ts）驱动——
 * 截获/定位/解调三种能力按 0.8/0.6/0.4/0.2 收缩成同心覆盖带（ITU 等距带风格），
 * 测向波束持续旋转（静态圆+旋转纹理，实证稳定），绕站目标实时判定截获与裕量。
 * 左侧目标面板逐秒刷新「截获裕量 km」，右下极坐标图与地图同一数据源。
 */
export default function Direction() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const [mode, setMode] = useState<Mode>('both');
  const [playing, setPlaying] = useState(true);
  const chart = useChartTheme();
  const [speed, setSpeed] = useState(1);
  const [margins, setMargins] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<SimTarget>();
  const layerRef = useRef<Cesium.CustomDataSource>(null);
  const bandsRef = useRef<Cesium.Entity[]>([]);
  const sweepRef = useRef<Cesium.Entity>(null);
  const targetsRef = useRef<Map<string, Cesium.Entity>>(new Map());
  const epoch = useRef(Cesium.JulianDate.now()).current;

  // 测向波束：静态圆 + canvas 余辉纹理（社区雷达扫描的经典做法）：
  // 逐帧重建 polygon hierarchy 的动态多边形会产生空批次包围球（NaN），渲染循环停摆
  const sweepCanvas = useRef<HTMLCanvasElement>(null);
  const renderSweep = (angle: number) => {
    const canvas = sweepCanvas.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);
    const center = size / 2;
    const radius = center - 2;
    const wedges = 40;
    for (let i = 0; i < wedges; i++) {
      const start = angle - (i + 1) * (100 / wedges);
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, ((start - 90) * Math.PI) / 180, ((start + 100 / wedges - 90) * Math.PI) / 180);
      ctx.closePath();
      ctx.fillStyle = `rgba(64, 140, 255, ${(0.34 * (1 - i / wedges) ** 1.6).toFixed(3)})`;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(
      center + radius * Math.cos(((angle - 90) * Math.PI) / 180),
      center + radius * Math.sin(((angle - 90) * Math.PI) / 180),
    );
    ctx.strokeStyle = 'rgba(120, 180, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const { containerRef, viewer, error, basemapFailed, retry } = useCesiumViewer({
    home: [STATION.lng, STATION.lat, 780_000],
    entry: { pitch: Cesium.Math.toRadians(-62) },
    onReady: (instance) => {
      Object.assign(instance.clock, {
        startTime: epoch.clone(),
        stopTime: Cesium.JulianDate.addSeconds(epoch, 12 * 3600, new Cesium.JulianDate()),
        currentTime: epoch.clone(),
        clockRange: Cesium.ClockRange.LOOP_STOP,
        shouldAnimate: true,
        multiplier: 1,
      });

      const layer = new Cesium.CustomDataSource('capability');
      instance.dataSources.add(layer);
      layerRef.current = layer;

      // 监测站：军标（友方地面传感器）+ 心跳扫描
      const stationSymbol = militarySymbol('ground', 'friend', { size: 30, label: 'MON-01' });
      instance.entities.add({
        position: Cesium.Cartesian3.fromDegrees(STATION.lng, STATION.lat),
        billboard: {
          image: stationSymbol.dataUrl,
          width: stationSymbol.width,
          height: stationSymbol.height,
          // 带番号文本时画框不在图片中心：按锚点偏移，让画框（而非整张图）压在站址上
          pixelOffset: new Cesium.Cartesian2(stationSymbol.offset.x, stationSymbol.offset.y),
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: { ...tagLabel({ offset: [0, -28] }), text: t('cesium.direction.station') },
      });
      addScanRing(instance, { lon: STATION.lng, lat: STATION.lat, color: '#fa8c16', maxRadius: 280_000, duration: 4 });

      // 覆盖带：外缘发光描边 + 半透明填充（每能力 5 档，内环挖孔成带）
      bandsRef.current = CAPABILITIES.flatMap((capability) => {
        const css = CAPABILITY_CSS[capability];
        return BAND_RATIOS.slice(0, -1).map((outer, i) => {
          const inner = BAND_RATIOS[i + 1];
          return layer.entities.add({
            polygon: {
              hierarchy: bandHierarchy(capability, outer, inner),
              material: cesiumColor(css, 0.05 + 0.03 * (BAND_RATIOS.length - 2 - i)),
              outline: i === 0,
              outlineColor: cesiumColor(css, 0.8),
            },
          });
        });
      });

      // 测向波束：静态圆 + 余辉纹理
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      sweepCanvas.current = canvas;
      renderSweep(0);
      sweepRef.current = layer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(STATION.lng, STATION.lat),
        ellipse: {
          semiMajorAxis: 240_000,
          semiMinorAxis: 240_000,
          material: new Cesium.ImageMaterialProperty({ image: canvas, transparent: true }),
        },
      });

      // 绕站目标：军标符号 + 航向旋转 + 截获状态标签。位置按解析式逐帧求值（与裕量面板同一函数），
      // 覆盖整个 12h 时钟窗口——曾只在 0..1200s 采样，超出末样本后 getValue 返回 undefined，目标全部消失
      TARGETS.forEach((target) => {
        const position = new Cesium.CallbackPositionProperty((time, result) => {
          const p = targetPosition(
            target,
            Cesium.JulianDate.secondsDifference(time ?? instance.clock.currentTime, epoch),
          );
          return Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, p.altitude, undefined, result);
        }, false);
        const symbol = militarySymbol(target.kind === 'aircraft' ? 'air' : 'sea', 'neutral', {
          size: target.kind === 'aircraft' ? 24 : 22,
        });
        const entity = layer.entities.add({
          id: target.id,
          position,
          billboard: {
            image: symbol.dataUrl,
            width: symbol.width,
            height: symbol.height,
            alignedAxis: Cesium.Cartesian3.UNIT_Z,
            rotation: headingRotation(instance, position, 120),
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            ...tagLabel({ offset: [0, -20] }),
            text: target.id,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        targetsRef.current.set(target.id, entity);
      });

      const handler = new Cesium.ScreenSpaceEventHandler(instance.scene.canvas);
      handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
        const entity = instance.scene.pick(click.position)?.id as Cesium.Entity | undefined;
        setPicked(TARGETS.find((target) => target.id === entity?.id));
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      // 主体取景：以监测站为球心、最远截获距离为半径的包围球，pitch -50 斜视、
      // 显式 range（zoomTo 的自动定距在含时变属性的场景实测不生效，改用同级 flyToBoundingSphere）
      void instance.camera.flyToBoundingSphere(
        new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(STATION.lng, STATION.lat), 260_000),
        {
          offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-50), 760_000),
          duration: 2.6,
        },
      );
      return () => {
        handler.destroy();
        if (!instance.isDestroyed()) instance.dataSources.remove(layer, true);
      };
    },
  });

  /* 波束旋转：相位取自 Cesium 时钟（暂停即冻结、倍速即加速），100ms 重绘纹理 */
  useEffect(() => {
    if (!viewer || !sweepCanvas.current || !sweepRef.current?.ellipse) return undefined;
    const canvas = sweepCanvas.current;
    const ellipse = sweepRef.current.ellipse;
    const timer = window.setInterval(() => {
      const seconds = Cesium.JulianDate.secondsDifference(viewer.clock.currentTime, epoch);
      renderSweep(((sweepAngle(seconds) * 180) / Math.PI) % 360);
      ellipse.material = new Cesium.ImageMaterialProperty({ image: canvas, transparent: true });
    }, 100);
    return () => window.clearInterval(timer);
  }, [viewer, epoch]);

  /* 心跳（1Hz）：目标截获状态 + 裕量面板。位置随 Cesium 时钟，判定用同一时间源 */
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return undefined;
    let last = -1;
    const onTick = () => {
      const seconds = Cesium.JulianDate.secondsDifference(viewer.clock.currentTime, epoch);
      if (seconds < 0 || Math.floor(seconds) === last) return;
      last = Math.floor(seconds);
      const next: Record<string, number> = {};
      TARGETS.forEach((target) => {
        next[target.id] = interceptMarginKm(target, seconds);
        const entity = targetsRef.current.get(target.id);
        if (!entity?.label) return;
        const detected = isIntercepted(target, seconds);
        entity.label.text = new Cesium.ConstantProperty(
          detected ? `${target.id} · ${t('cesium.direction.detected')}` : target.id,
        );
        entity.label.fillColor = new Cesium.ConstantProperty(
          detected ? cesiumColor('#95de64') : Cesium.Color.WHITE.withAlpha(0.75),
        );
      });
      setMargins(next);
    };
    viewer.clock.onTick.addEventListener(onTick);
    return () => {
      if (!viewer.isDestroyed()) viewer.clock.onTick.removeEventListener(onTick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- epoch 挂载时冻结进 ref、TARGETS 为模块常量;省略的只有 t(整页重载稳定)
  }, [viewer]);

  // 模式切换：覆盖带与波束各自显隐
  useEffect(() => {
    bandsRef.current.forEach((entity) => {
      entity.show = mode !== 'sweep';
    });
    if (sweepRef.current) sweepRef.current.show = mode !== 'bands';
  }, [mode, viewer]);

  // TimeDeck 播放/暂停与倍速必须同步到 viewer.clock（与 Heatmap/Trajectory/Situation 同一模式）；
  // 此前只在 onReady 里设过一次，导致播放控制与 ×1/×4/×16 按钮完全失效
  useEffect(() => {
    if (viewer && !viewer.isDestroyed()) viewer.clock.shouldAnimate = playing;
  }, [viewer, playing]);

  useEffect(() => {
    if (viewer && !viewer.isDestroyed()) viewer.clock.multiplier = speed;
  }, [viewer, speed]);

  const stats = useMemo(() => CAPABILITIES.map((capability) => ({ capability, ...capabilityStats(capability) })), []);
  const interceptStats = stats.find((row) => row.capability === 'intercept');
  const radarData = useMemo(
    () =>
      CAPABILITIES.flatMap((capability) =>
        // 图表行的 azimuth 键沿用原名（G2 用字段名作轴标题），值是度
        polarPattern(capability, 36).map((p) => ({
          capability: t(`cesium.direction.${capability}`),
          azimuth: p.azimuthDeg,
          rangeKm: p.rangeKm,
        })),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- polarPattern/CAPABILITIES 为纯模块函数;唯一捕获 t,切语言整页重载
    [],
  );

  const legend = (
    <div className="scene-panel">
      <div className="scene-panel-title">{t('cesium.direction.legend')}</div>
      <Space direction="vertical" size={2}>
        {stats.map((row) => (
          <Badge
            key={row.capability}
            color={CAPABILITY_CSS[row.capability]}
            text={t('cesium.direction.stats', {
              name: t(`cesium.direction.${row.capability}`),
              max: row.max.toFixed(0),
              min: row.min.toFixed(0),
              avg: row.avg.toFixed(0),
            })}
            className="text-xs"
          />
        ))}
      </Space>
    </div>
  );

  const targetPanel = (
    <div className="scene-panel">
      <div className="scene-panel-title">{t('cesium.direction.targets')}</div>
      <div className="flex flex-col gap-1">
        {TARGETS.map((target) => {
          const margin = margins[target.id];
          const detected = margin !== undefined && margin >= 0;
          return (
            <Button
              key={target.id}
              size="small"
              type={picked?.id === target.id ? 'primary' : 'text'}
              className="flex h-auto items-center justify-between py-1"
              onClick={() => {
                setPicked(target);
                const entity = targetsRef.current.get(target.id);
                if (viewer && entity) viewer.flyTo(entity, { duration: 1.2 });
              }}
            >
              <span className="font-mono text-[11px]">{target.id}</span>
              <span className={`font-mono text-[11px] ${detected ? 'text-[#52c41a]' : 'opacity-60'}`}>
                {margin === undefined ? '—' : `${margin > 0 ? '+' : ''}${margin.toFixed(0)} km`}
              </span>
            </Button>
          );
        })}
      </div>
      <Typography.Paragraph type="secondary" className="mt-2 mb-0 text-[11px]">
        {t('cesium.direction.marginHint')}
      </Typography.Paragraph>
    </div>
  );

  const polarPanel = (
    <div className="scene-panel">
      <div className="scene-panel-title">{t('cesium.direction.polar')}</div>
      <Radar
        data={radarData}
        xField="azimuth"
        yField="rangeKm"
        colorField="capability"
        shapeField="smooth"
        height={210}
        theme={chart.g2Theme}
      />
    </div>
  );

  const detail = picked ? (
    <div className="scene-panel">
      <div className="scene-panel-title">{picked.id}</div>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <Typography.Text type="secondary">{t('cesium.direction.kind')}</Typography.Text>
        <span>{t(`cesium.direction.${picked.kind}`)}</span>
        <Typography.Text type="secondary">{t('cesium.direction.radius')}</Typography.Text>
        <span className="font-mono">{picked.radiusKm} km</span>
        <Typography.Text type="secondary">{t('cesium.direction.groundSpeed')}</Typography.Text>
        <span className="font-mono">{(Math.abs(picked.angularSpeed) * picked.radiusKm * 36).toFixed(0)} km/h</span>
        <Typography.Text type="secondary">{t('cesium.direction.margin')}</Typography.Text>
        <span className="font-mono">
          {margins[picked.id] === undefined ? '—' : `${margins[picked.id].toFixed(1)} km`}
        </span>
      </div>
    </div>
  ) : (
    <div className="scene-panel">
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t('cesium.direction.pickHint')}
        styles={{ image: { height: 36 } }}
        className="my-1"
      />
    </div>
  );

  return (
    <DemoPage descriptionId="page.cesium.direction.desc" source="src/pages/Map/Cesium/capabilityModel.ts">
      <SceneStage
        containerRef={containerRef}
        viewer={viewer}
        error={error}
        basemapFailed={basemapFailed}
        onRetryBasemap={retry}
        title={t('cesium.direction.title')}
        kpis={[
          { label: t('cesium.direction.kpi.station'), value: 1 },
          { label: t('cesium.direction.kpi.targets'), value: TARGETS.length },
          {
            label: t('cesium.direction.kpi.intercepted'),
            value: TARGETS.filter((tg) => margins[tg.id] !== undefined && margins[tg.id] >= 0).length,
            tone: 'success',
          },
          {
            label: t('cesium.direction.kpi.maxRange'),
            value: interceptStats ? `${interceptStats.max.toFixed(0)} km` : '—',
          },
        ]}
        actions={
          <Segmented
            size="small"
            value={mode}
            onChange={(value) => setMode(value as Mode)}
            options={[
              { value: 'bands', label: t('cesium.direction.modeBands') },
              { value: 'sweep', label: t('cesium.direction.modeSweep') },
              { value: 'both', label: t('cesium.direction.modeBoth') },
            ]}
          />
        }
        panels={targetPanel}
        rightPanels={
          <>
            {detail}
            {polarPanel}
          </>
        }
        legend={legend}
        timeDeck={
          <TimeDeck
            viewer={viewer}
            playing={playing}
            onPlayingChange={setPlaying}
            speed={speed}
            onSpeedChange={setSpeed}
            speeds={[1, 4, 16]}
          />
        }
      />
    </DemoPage>
  );
}
