import { SceneStage, useCesiumViewer } from '@/components/CesiumViewer';
import { TimeDeck } from '@/components/CesiumViewer/TimeDeck';
import { glowMaterial, tagLabel, targetIcon } from '@/components/CesiumViewer/effects';
import { ACCENT_CSS, QUALITY_CSS } from '@/components/CesiumViewer/palette';
import { pickLngLat } from '@/components/CesiumViewer/stations';
import DemoPage from '@/components/DemoPage';
import { destination } from '@/utils/MapCompute/geodesy';
import {
  CheckOutlined,
  DownloadOutlined,
  NodeIndexOutlined,
  RedoOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { App, Button, Slider, Typography } from 'antd';
import * as Cesium from 'cesium';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BASE_STATIONS,
  buildPatrolRoute,
  cumulativeKm,
  missionStats,
  qualityColor,
  sampleRoute,
  SAMPLES_PER_SECOND,
  type PatrolSample,
} from './patrolModel';

/** 巡检机 glTF（Cesium_Air，Apache-2.0 样例资产）：不可达时降级 canvas 剪影 billboard */
const AIRCRAFT_MODEL_URL = `${typeof PUBLIC_PATH === 'string' ? PUBLIC_PATH : '/'}assets/models/aircraft.glb`;
const modelAvailability: Promise<boolean> =
  typeof fetch === 'function'
    ? fetch(AIRCRAFT_MODEL_URL, { method: 'HEAD' })
        .then((res) => res.ok)
        .catch(() => false)
    : Promise.resolve(false);

/** 航线总航向（度，正北顺时针，0..360）：进场镜头的相机朝向与后撤方向都由它决定 */
const bearingDeg = (from: { lng: number; lat: number }, to: { lng: number; lat: number }) => {
  const rad = Math.PI / 180;
  const y = Math.sin((to.lng - from.lng) * rad) * Math.cos(to.lat * rad);
  const x =
    Math.cos(from.lat * rad) * Math.sin(to.lat * rad) -
    Math.sin(from.lat * rad) * Math.cos(to.lat * rad) * Math.cos((to.lng - from.lng) * rad);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

/**
 * 任务规划与回放页：可拖拽编辑的航路点（点击加点、拖动改线）→ Catmull-Rom 平滑
 * → glTF 巡检机沿线回放（姿态随速度矢量），身后生长覆盖走廊（宽度可调）+ 质量采样点；
 * 高度剖面图与回放进度双向联动（拖图跳转时刻），支持镜头跟随与 CZML 导出。
 * 数据层见 patrolModel.ts（程序生成，不依赖静态 JSON）。
 */
export default function Trajectory() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const { message } = App.useApp();
  const [drawing, setDrawing] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(2);
  const [corridorWidthLive, setCorridorWidthLive] = useState(2600);
  // 去抖提交：走廊宽度每变一步都会触发几何重三角化，拖动期间只跟手显示，停拖才落定
  const [corridorWidth, setCorridorWidth] = useState(2600);
  useEffect(() => {
    const timer = window.setTimeout(
      () => setCorridorWidth((committed) => (committed === corridorWidthLive ? committed : corridorWidthLive)),
      120,
    );
    return () => window.clearTimeout(timer);
  }, [corridorWidthLive]);
  const [hasPlayback, setHasPlayback] = useState(false);
  const [follow, setFollow] = useState(false);
  const [progress, setProgress] = useState(0);
  const [useModel, setUseModel] = useState(false);

  const drawingRef = useRef(false);
  const dragIndexRef = useRef<number | null>(null);
  const waypointsRef = useRef<{ longitude: number; latitude: number }[]>([]);
  const waypointEntitiesRef = useRef<Cesium.Entity[]>([]);
  const layerRef = useRef<Cesium.CustomDataSource>(null);
  const samplesRef = useRef<PatrolSample[]>([]);
  /** 整条航线的笛卡尔坐标；positionsRef 是其中「当前时刻之前」的前缀（覆盖走廊直读） */
  const routePositionsRef = useRef<Cesium.Cartesian3[]>([]);
  const positionsRef = useRef<Cesium.Cartesian3[]>([]);
  const dotsRef = useRef<Cesium.PointPrimitiveCollection>(null);
  const dotsDoneRef = useRef(0);
  const startRef = useRef<Cesium.JulianDate>(null);
  const planeRef = useRef<Cesium.Entity>(null);
  const corridorEntityRef = useRef<Cesium.Entity>(null);
  // 统计在渲染时直读采样数组：progress 每次变化都会触发重渲染，无需 memo/ref 依赖
  const stats = samplesRef.current.length ? missionStats(samplesRef.current) : undefined;

  useEffect(() => {
    void modelAvailability.then(setUseModel);
  }, []);

  const { containerRef, viewer, error, basemapFailed, retry } = useCesiumViewer({
    home: [116.65, 30.5, 260_000],
    entry: { pitch: Cesium.Math.toRadians(-38) },
    onReady: (instance) => {
      const layer = new Cesium.CustomDataSource('patrol');
      instance.dataSources.add(layer);
      layerRef.current = layer;

      // 沿线地面基站（覆盖质量的参考源）：小标记
      BASE_STATIONS.forEach(([lng, lat], i) => {
        layer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lng, lat),
          point: {
            pixelSize: 7,
            color: Cesium.Color.fromCssColorString(ACCENT_CSS.zone),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1,
          },
          label: { ...tagLabel({ offset: [0, -14] }), text: `BS-${i + 1}` },
        });
      });

      const handler = new Cesium.ScreenSpaceEventHandler(instance.scene.canvas);
      // 画线模式：点击加点 / 按住航路点拖动改线
      handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
        if (!drawingRef.current || dragIndexRef.current !== null) return;
        const lngLat = pickLngLat(instance, click.position);
        if (!lngLat) return;
        waypointsRef.current.push({ longitude: lngLat[0], latitude: lngLat[1] });
        const entity = layer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(...lngLat),
          point: {
            pixelSize: 9,
            color: Cesium.Color.fromCssColorString(ACCENT_CSS.route),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1,
          },
        });
        waypointEntitiesRef.current.push(entity);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      handler.setInputAction((movement: { endPosition: Cesium.Cartesian2 }) => {
        if (dragIndexRef.current === null) {
          // 悬停航路点可拖（改光标提示）。注意 MOUSE_MOVE 回调给的是 endPosition：
          // 误用 position 会把 undefined 传进 scene.pick → DeveloperError: windowPosition is required
          const picked = instance.scene.pick(movement.endPosition);
          if (picked?.id && waypointEntitiesRef.current.includes(picked.id)) {
            (instance.container as HTMLElement).style.cursor = 'move';
          } else if (drawingRef.current) {
            (instance.container as HTMLElement).style.cursor = 'crosshair';
          } else {
            (instance.container as HTMLElement).style.cursor = '';
          }
          return;
        }
        // 拖拽中的航路点跟随光标（同样注意 MOUSE_MOVE 给的是 endPosition）
        const lngLat = pickLngLat(instance, movement.endPosition);
        if (!lngLat) return;
        const index = dragIndexRef.current;
        waypointsRef.current[index] = { longitude: lngLat[0], latitude: lngLat[1] };
        waypointEntitiesRef.current[index].position = new Cesium.ConstantPositionProperty(
          Cesium.Cartesian3.fromDegrees(...lngLat),
        );
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
      handler.setInputAction((down: { position: Cesium.Cartesian2 }) => {
        const picked = instance.scene.pick(down.position);
        if (picked?.id && waypointEntitiesRef.current.includes(picked.id)) {
          dragIndexRef.current = waypointEntitiesRef.current.indexOf(picked.id);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
      handler.setInputAction(() => {
        dragIndexRef.current = null;
      }, Cesium.ScreenSpaceEventType.LEFT_UP);
      return () => handler.destroy();
    },
  });

  /* 回放推进：覆盖走廊 positions 只取当前时刻之前的采样（生长效果），沿途铺质量采样点 */
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return undefined;
    const onTick = () => {
      const start = startRef.current;
      const route = routePositionsRef.current;
      if (!start || !route.length) return;
      // 时钟时间已含倍速（clock.multiplier = speed），采样 i 落在 start + i/SAMPLES_PER_SECOND：
      // 这里再乘 speed 会让走廊跑在飞机前面
      const elapsed = Cesium.JulianDate.secondsDifference(viewer.clock.currentTime, start);
      const prog = Math.min(route.length, Math.max(2, Math.floor(elapsed * SAMPLES_PER_SECOND)));
      if (prog === positionsRef.current.length) return;
      // 每次都从整条航线取前缀：在上一帧的前缀上再截只会越截越短，走廊永远长不出来
      positionsRef.current = route.slice(0, prog);
      setProgress(prog);
      const dots = dotsRef.current;
      if (dots) {
        // 时间倒流（LOOP_STOP 回绕、剖面图/TimeDeck 往回拖）：采样点随走廊一起回退重铺
        if (dotsDoneRef.current > prog) {
          dots.removeAll();
          dotsDoneRef.current = 0;
        }
        while (dotsDoneRef.current < prog) {
          const sample = samplesRef.current[dotsDoneRef.current];
          if (dotsDoneRef.current % 5 === 0) {
            dots.add({
              position: Cesium.Cartesian3.fromDegrees(sample.lng, sample.lat),
              pixelSize: 5,
              color: Cesium.Color.fromCssColorString(qualityColor(sample.quality)).withAlpha(0.9),
            });
          }
          dotsDoneRef.current += 1;
        }
      }
    };
    viewer.clock.onTick.addEventListener(onTick);
    return () => {
      if (!viewer.isDestroyed()) viewer.clock.onTick.removeEventListener(onTick);
    };
  }, [viewer]);

  useEffect(() => {
    if (viewer) viewer.clock.shouldAnimate = playing;
  }, [viewer, playing]);

  useEffect(() => {
    if (viewer) viewer.clock.multiplier = speed;
  }, [viewer, speed]);

  useEffect(() => {
    if (corridorEntityRef.current?.corridor)
      corridorEntityRef.current.corridor.width = new Cesium.ConstantProperty(corridorWidth);
  }, [corridorWidth]);

  /** 搭建一段回放：时钟 + 巡检机（glTF 优先）+ 生长走廊 + 质量采样点容器 */
  const playRoute = useCallback(
    (samples: PatrolSample[]) => {
      const instance = viewer!;
      samplesRef.current = samples;
      routePositionsRef.current = samples.map((p) => Cesium.Cartesian3.fromDegrees(p.lng, p.lat));
      positionsRef.current = routePositionsRef.current.slice(0, 2);
      dotsDoneRef.current = 0;
      setProgress(0);
      if (dotsRef.current) instance.scene.primitives.remove(dotsRef.current);
      dotsRef.current = instance.scene.primitives.add(new Cesium.PointPrimitiveCollection());
      const start = Cesium.JulianDate.now();
      startRef.current = start.clone();
      const total = samples.length / SAMPLES_PER_SECOND;
      Object.assign(instance.clock, {
        startTime: start.clone(),
        stopTime: Cesium.JulianDate.addSeconds(start, total, new Cesium.JulianDate()),
        currentTime: start.clone(),
        clockRange: Cesium.ClockRange.LOOP_STOP,
        shouldAnimate: playing,
        multiplier: speed,
      });
      const position = new Cesium.SampledPositionProperty();
      position.setInterpolationOptions({
        interpolationDegree: 2,
        interpolationAlgorithm: Cesium.LagrangePolynomialApproximation,
      });
      samples.forEach((p, i) =>
        position.addSample(
          Cesium.JulianDate.addSeconds(start, i / SAMPLES_PER_SECOND, new Cesium.JulianDate()),
          Cesium.Cartesian3.fromDegrees(p.lng, p.lat, p.alt),
        ),
      );
      // 同一 viewer 上重建（模型探测晚到后的重放）时保持跟随：removeAll 会让 Viewer 自动摘掉 trackedEntity
      const wasFollowing = !!planeRef.current && instance.trackedEntity === planeRef.current;
      instance.entities.removeAll();
      planeRef.current = instance.entities.add({
        position,
        ...(useModel
          ? {
              model: {
                uri: AIRCRAFT_MODEL_URL,
                scale: 2.4,
                minimumPixelSize: 42,
                silhouetteColor: Cesium.Color.fromCssColorString(ACCENT_CSS.route),
              },
              orientation: new Cesium.VelocityOrientationProperty(position),
            }
          : {
              billboard: {
                image: targetIcon('aircraft', ACCENT_CSS.route),
                width: 30,
                height: 30,
                alignedAxis: Cesium.Cartesian3.UNIT_Z,
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
              },
            }),
        path: { leadTime: 0, trailTime: 25, width: 3, material: glowMaterial(ACCENT_CSS.route, 0.9) },
      });
      // 覆盖走廊：positions 只取当前进度以内的采样（onTick 里截断 positionsRef）
      corridorEntityRef.current = instance.entities.add({
        corridor: {
          positions: new Cesium.CallbackProperty(() => positionsRef.current, false),
          width: corridorWidth,
          cornerType: Cesium.CornerType.ROUNDED,
          material: glowMaterial(ACCENT_CSS.corridor, 0.55),
        },
      });
      setHasPlayback(true);
      if (wasFollowing) {
        instance.trackedEntity = planeRef.current ?? undefined;
        return;
      }
      // 「进场镜头」：相机落在航线起点的后方延长线上，朝总航向看过去——
      // 整条走廊在画面里向远处展开，比正对区域中心更有任务简报感
      const first = samples[0];
      const last = samples[samples.length - 1];
      const bearing = bearingDeg(first, last);
      const [camLng, camLat] = destination(first.lng, first.lat, (bearing + 180) % 360, 42);
      instance.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(camLng, camLat, 150_000),
        orientation: { heading: Cesium.Math.toRadians(bearing), pitch: Cesium.Math.toRadians(-24), roll: 0 },
        duration: 2.4,
        easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
      });
    },
    [viewer, playing, speed, useModel, corridorWidth],
  );

  /* 自动回放（程序生成的内置巡检任务，确定性）。按「viewer 实例 + 模型可用性」记账，而不是一次性开关：
   * - 底图重试会换一个新 viewer：在新实例上重建当前回放（以前新 viewer 永远空场）；画线中不打断
   * - glb 的 HEAD 探测晚于 viewer 就绪时，首场只能用剪影 billboard：探测返回可用后重放一次换上模型，
   *   用户已开始画自定义航线则不打断
   * 注意 playing / speed / 走廊宽度变化也会换出新的 playRoute，记账保证它们不会触发重放 */
  const autoPlayRef = useRef<{ viewer: Cesium.Viewer | null; useModel: boolean }>({ viewer: null, useModel: false });
  const customRouteRef = useRef(false);
  useEffect(() => {
    if (!viewer) return;
    const last = autoPlayRef.current;
    autoPlayRef.current = { viewer, useModel };
    if (drawingRef.current) return;
    if (last.viewer !== viewer) {
      if (samplesRef.current.length) playRoute(samplesRef.current);
      else if (!customRouteRef.current) playRoute(buildPatrolRoute());
    } else if (useModel && !last.useModel && !customRouteRef.current) {
      playRoute(buildPatrolRoute());
    }
  }, [playRoute, viewer, useModel]);

  /* 跟随模式：trackedEntity 挂/摘。放在自动回放之后：换 viewer 时先建好新巡检机再挂跟随 */
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    viewer.trackedEntity = follow ? (planeRef.current ?? undefined) : undefined;
  }, [viewer, follow, hasPlayback]);

  const clearPlayback = useCallback(() => {
    if (viewer && !viewer.isDestroyed()) {
      viewer.entities.removeAll();
      if (dotsRef.current) viewer.scene.primitives.remove(dotsRef.current);
    }
    dotsRef.current = null;
    planeRef.current = null;
    corridorEntityRef.current = null;
    layerRef.current?.entities.removeAll();
    waypointEntitiesRef.current = [];
    samplesRef.current = [];
    routePositionsRef.current = [];
    positionsRef.current = [];
    startRef.current = null;
    setHasPlayback(false);
    setProgress(0);
  }, [viewer]);

  const startDrawing = () => {
    clearPlayback();
    customRouteRef.current = true;
    drawingRef.current = true;
    setDrawing(true);
    (viewer!.container as HTMLElement).style.cursor = 'crosshair';
    layerRef.current!.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(
          () => Cesium.Cartesian3.fromDegreesArray(waypointsRef.current.flatMap((p) => [p.longitude, p.latitude])),
          false,
        ),
        width: 3,
        material: glowMaterial(ACCENT_CSS.route, 0.9),
        clampToGround: true,
      },
    });
  };

  const finishDrawing = () => {
    drawingRef.current = false;
    setDrawing(false);
    (viewer!.container as HTMLElement).style.cursor = '';
    const waypoints = [...waypointsRef.current];
    waypointsRef.current = [];
    waypointEntitiesRef.current = [];
    if (waypoints.length < 2) {
      message.warning(t('cesium.route.tooShort'));
      return;
    }
    layerRef.current?.entities.removeAll();
    playRoute(sampleRoute(waypoints));
  };

  const replay = () => {
    if (viewer && startRef.current) {
      positionsRef.current = [];
      dotsDoneRef.current = 0;
      setProgress(0);
      if (dotsRef.current) dotsRef.current.removeAll();
      viewer.clock.currentTime = startRef.current.clone();
    }
  };

  /** CZML 导出：把当前回放（document clock + 巡检机轨迹）打包成标准 CZML 下载 */
  const exportCzml = () => {
    const samples = samplesRef.current;
    const start = startRef.current;
    if (!samples.length || !start) return;
    const startIso = Cesium.JulianDate.toIso8601(start);
    const stopIso = Cesium.JulianDate.toIso8601(
      Cesium.JulianDate.addSeconds(start, samples.length / SAMPLES_PER_SECOND, new Cesium.JulianDate()),
    );
    const cartesian: number[] = [];
    samples.forEach((p, i) => {
      const c = Cesium.Cartesian3.fromDegrees(p.lng, p.lat, p.alt);
      cartesian.push(i / SAMPLES_PER_SECOND, c.x, c.y, c.z);
    });
    const czml = [
      {
        id: 'document',
        name: 'patrol-mission',
        version: '1.0',
        clock: { interval: `${startIso}/${stopIso}`, currentTime: startIso, multiplier: speed, range: 'LOOP_STOP' },
      },
      {
        id: 'patrol-aircraft',
        name: 'PATROL-01',
        availability: `${startIso}/${stopIso}`,
        ...(useModel
          ? { model: { gltf: AIRCRAFT_MODEL_URL, scale: 2.4 } }
          : { billboard: { image: targetIcon('aircraft', ACCENT_CSS.route), scale: 0.45 } }),
        position: { interpolationAlgorithm: 'LAGRANGE', interpolationDegree: 2, epoch: startIso, cartesian },
        path: {
          material: { solidColor: { color: { rgba: [250, 219, 20, 220] } } },
          width: 3,
          leadTime: 0,
          trailTime: 25,
        },
      },
    ];
    const blob = new Blob([JSON.stringify(czml, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'patrol-mission.czml';
    link.click();
    URL.revokeObjectURL(url);
    message.success(t('cesium.route.czmlDone'));
  };

  /* 高度剖面图：SVG（距离-高度曲线 + 三档质量着色 + 播放头），点击/拖动跳时刻 */
  const profile = useMemo(() => {
    const samples = samplesRef.current;
    if (samples.length < 2) return undefined;
    const cum = cumulativeKm(samples);
    const totalKm = cum[cum.length - 1] || 1;
    const altMin = Math.min(...samples.map((s) => s.alt));
    const altMax = Math.max(...samples.map((s) => s.alt));
    const W = 260;
    const H = 86;
    const x = (km: number) => (km / totalKm) * W;
    const y = (alt: number) => H - 8 - ((alt - altMin) / Math.max(1, altMax - altMin)) * (H - 20);
    const pathD = samples
      .map((s, i) => `${i === 0 ? 'M' : 'L'}${x(cum[i]).toFixed(1)},${y(s.alt).toFixed(1)}`)
      .join(' ');
    const px = progress > 0 ? x(cum[Math.min(progress - 1, cum.length - 1)]) : 0;
    const seek = (clientX: number, element: SVGSVGElement) => {
      const rect = element.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      if (viewer && startRef.current) {
        viewer.clock.currentTime = Cesium.JulianDate.addSeconds(
          startRef.current,
          (ratio * samples.length) / SAMPLES_PER_SECOND,
          new Cesium.JulianDate(),
        );
      }
    };
    return { pathD, px, W, H, totalKm, altMin, altMax, seek };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- samplesRef/startRef 等均为 ref;真实依赖 progress/hasPlayback/viewer 已列出,t/intl 整页重载稳定
  }, [progress, hasPlayback, viewer]);

  const statsPanel = stats ? (
    <div className="scene-panel">
      <div className="scene-panel-title">{t('cesium.route.mission')}</div>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <Typography.Text type="secondary">{t('cesium.route.length')}</Typography.Text>
        <span className="font-mono">{stats.lengthKm.toFixed(1)} km</span>
        <Typography.Text type="secondary">{t('cesium.route.duration')}</Typography.Text>
        <span className="font-mono">{stats.durationMin.toFixed(1)} min</span>
        <Typography.Text type="secondary">{t('cesium.route.quality')}</Typography.Text>
        <span className="flex gap-2 font-mono">
          <span style={{ color: QUALITY_CSS.good }}>{stats.good}</span>
          <span style={{ color: '#fadb14' }}>{stats.fair}</span>
          <span style={{ color: QUALITY_CSS.poor }}>{stats.poor}</span>
        </span>
        <Typography.Text type="secondary">{t('cesium.route.avgQuality')}</Typography.Text>
        <span className="font-mono">{(stats.avgQuality * 100).toFixed(0)}%</span>
      </div>
      <div className="mt-2">
        <Typography.Text type="secondary" className="text-[11px]">
          {t('cesium.route.corridorWidth')}
        </Typography.Text>
        <Slider
          min={800}
          max={6000}
          step={200}
          value={corridorWidthLive}
          onChange={setCorridorWidthLive}
          tooltip={{ formatter: (v) => `${((v ?? 0) / 1000).toFixed(1)} km` }}
        />
      </div>
    </div>
  ) : undefined;

  const profilePanel =
    profile && statsPanel ? (
      <div className="scene-panel">
        <div className="scene-panel-title">{t('cesium.route.profile')}</div>
        <svg
          viewBox={`0 0 ${profile.W} ${profile.H}`}
          className="w-full cursor-pointer touch-none"
          role="slider"
          aria-label={t('cesium.route.profile')}
          tabIndex={0}
          /* SVG 不是 draggable 元素，原生 onDrag 永远不触发（拖拽寻址此前是死交互）：
             改 pointer 捕获实现按住拖动 scrub */
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            profile.seek(e.clientX, e.currentTarget);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) profile.seek(e.clientX, e.currentTarget);
          }}
        >
          <path d={profile.pathD} fill="none" stroke={ACCENT_CSS.corridor} strokeWidth={1.6} />
          <line x1={profile.px} y1={2} x2={profile.px} y2={profile.H - 4} stroke="#faad14" strokeWidth={1.4} />
          <circle cx={profile.px} cy={6} r={3} fill="#faad14" />
        </svg>
        <div className="flex justify-between font-mono text-[10px] opacity-60">
          <span>0 km</span>
          <span>{profile.totalKm.toFixed(0)} km</span>
        </div>
      </div>
    ) : undefined;

  const legend = (
    <div className="scene-panel">
      <div className="flex flex-col gap-1 text-xs">
        {[
          [QUALITY_CSS.good, 'cesium.route.good'],
          ['#fadb14', 'cesium.route.fair'],
          [QUALITY_CSS.poor, 'cesium.route.poor'],
          [ACCENT_CSS.corridor, 'cesium.route.corridor'],
        ].map(([color, key]) => (
          <span key={key} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            {t(key)}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <DemoPage descriptionId="page.cesium.trajectory.desc" source="src/pages/Map/Cesium/patrolModel.ts">
      <SceneStage
        containerRef={containerRef}
        viewer={viewer}
        error={error}
        basemapFailed={basemapFailed}
        onRetryBasemap={retry}
        title={t('cesium.route.title')}
        kpis={[
          { label: t('cesium.route.kpi.samples'), value: samplesRef.current.length },
          ...(stats
            ? ([
                { label: t('cesium.route.length'), value: `${stats.lengthKm.toFixed(0)} km` },
                { label: t('cesium.route.kpi.good'), value: stats.good, tone: 'success' },
                { label: t('cesium.route.avgQuality'), value: `${(stats.avgQuality * 100).toFixed(0)}%` },
              ] as const)
            : []),
        ]}
        actions={
          <>
            {drawing ? (
              <Button size="small" type="primary" icon={<CheckOutlined />} onClick={finishDrawing}>
                {t('cesium.route.finish')}
              </Button>
            ) : (
              <Button size="small" icon={<NodeIndexOutlined />} disabled={!viewer} onClick={startDrawing}>
                {t('cesium.route.draw')}
              </Button>
            )}
            <Button size="small" icon={<RedoOutlined />} disabled={drawing || !hasPlayback} onClick={replay}>
              {t('cesium.route.replay')}
            </Button>
            <Button
              size="small"
              type={follow ? 'primary' : 'default'}
              icon={<VideoCameraOutlined />}
              disabled={drawing || !hasPlayback}
              onClick={() => setFollow((v) => !v)}
            >
              {t('cesium.route.follow')}
            </Button>
            <Button size="small" icon={<DownloadOutlined />} disabled={drawing || !hasPlayback} onClick={exportCzml}>
              CZML
            </Button>
          </>
        }
        panels={statsPanel}
        rightPanels={profilePanel}
        legend={legend}
        timeDeck={
          <TimeDeck
            viewer={viewer}
            playing={playing}
            onPlayingChange={setPlaying}
            speed={speed}
            onSpeedChange={setSpeed}
            speeds={[1, 2, 4, 8]}
          />
        }
      >
        {drawing && (
          <div className="absolute inset-x-0 top-3 z-20 mx-auto w-fit">
            <div className="scene-panel">{t('cesium.route.drawing')}</div>
          </div>
        )}
      </SceneStage>
    </DemoPage>
  );
}
