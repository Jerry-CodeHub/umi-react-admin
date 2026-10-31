import { SceneStage, useCesiumViewer } from '@/components/CesiumViewer';
import { TimeDeck } from '@/components/CesiumViewer/TimeDeck';
import { glowMaterial, tagLabel } from '@/components/CesiumViewer/effects';
import { ACCENT_CSS, rampGradientCss } from '@/components/CesiumViewer/palette';
import DemoPage from '@/components/DemoPage';
import { circle, distanceKm } from '@/utils/MapCompute/geodesy';
import { useIntl } from '@umijs/max';
import { Segmented, Slider, Typography } from 'antd';
import * as Cesium from 'cesium';
import { useEffect, useMemo, useRef, useState } from 'react';
import { coverageRadiusKm, FIELD_MAX, FIELD_MIN, fieldStrength, REGION, transmitters } from './fieldModel';
import { renderHeatField } from './heatRender';

type Mode = 'heat' | 'shells' | 'both';

/** Worker 请求节流：计算在 Worker，渲染换材质在主线程，250ms 一帧足够「呼吸」 */
const FRAME_MS = 250;
const GRID = { cols: 256, rows: 168 };
const FALLBACK_GRID = { cols: 110, rows: 72 };
const SHELL_THRESHOLDS = [60, 45] as const;

interface ProbeReadout {
  lng: number;
  lat: number;
  strength: number;
  distances: { id: string; km: number }[];
}

/**
 * 频谱场强态势页：同一套传播模型（fieldModel.ts）驱动——
 * 热力（Web Worker 算 256×168 场 → ImageData 色带 + 等值线标注，双线性连续）
 * 与覆盖圈（60/45 dB 等场强发光圈，半径由模型反解）。发射机功率可调，
 * 点击地图任意点读出该点场强与到各台距离。数据全部程序生成。
 */
export default function Heatmap() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const [mode, setMode] = useState<Mode>('both');
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [powers, setPowers] = useState<number[]>(() => transmitters().map((tx) => tx.power));
  // 点击探测的 handler 只在 onReady 建一次：经 ref 读当前功率，否则拖动滑块后读数仍按初始功率计算
  const powersRef = useRef(powers);
  powersRef.current = powers;
  const [probe, setProbe] = useState<ProbeReadout>();
  const [fieldSpan, setFieldSpan] = useState<{ min: number; max: number }>();
  const heatRef = useRef<Cesium.Entity>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<Cesium.CustomDataSource>(null);
  const workerRef = useRef<Worker | null>(null);
  const probeMarkRef = useRef<Cesium.Entity | null>(null);
  const epoch = useRef(Cesium.JulianDate.now()).current;

  const txList = useMemo(() => transmitters() as { id: string; lng: number; lat: number; power: number }[], []);
  const shellsRef = useRef<Cesium.CustomDataSource>(null);

  /** 覆盖圈绘制：60/45 dB 等场强发光圈（半径 = 模型反解），功率变化时整层重画 */
  const drawShells = (layer: Cesium.CustomDataSource) => {
    layer.entities.removeAll();
    txList.forEach((tx, i) => {
      SHELL_THRESHOLDS.forEach((threshold) => {
        const radiusKm = coverageRadiusKm(powers[i] ?? tx.power, threshold);
        const ring = circle(tx.lng, tx.lat, radiusKm, 5);
        layer.entities.add({
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray([...ring, ring[0]].flat()),
            width: threshold === 60 ? 3.2 : 2.2,
            material: glowMaterial(threshold === 60 ? '#f5222d' : '#fa8c16', 0.85),
          },
        });
        const labelAt = ring[Math.round(ring.length * 0.42)] ?? ring[0];
        layer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(labelAt[0], labelAt[1]),
          label: {
            ...tagLabel({ font: '11px ui-monospace, Menlo, monospace', fillCss: '#ffb08a', offset: [0, 0] }),
            text: `${threshold} dB`,
          },
        });
      });
    });
  };

  const { containerRef, viewer, error, basemapFailed, retry } = useCesiumViewer({
    home: [106.64, 29.67, 78_000],
    entry: { pitch: Cesium.Math.toRadians(-30) },
    onReady: (instance) => {
      Object.assign(instance.clock, {
        startTime: epoch.clone(),
        stopTime: Cesium.JulianDate.addSeconds(epoch, 12 * 3600, new Cesium.JulianDate()),
        currentTime: epoch.clone(),
        clockRange: Cesium.ClockRange.LOOP_STOP,
        shouldAnimate: true,
        multiplier: 1,
      });

      const layer = new Cesium.CustomDataSource('field');
      instance.dataSources.add(layer);
      layerRef.current = layer;

      // 热力贴图层：一个覆盖全区域的矩形，材质按 Worker 回包换新画的 canvas
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 336;
      canvasRef.current = canvas;
      heatRef.current = instance.entities.add({
        rectangle: {
          coordinates: Cesium.Rectangle.fromDegrees(REGION.west, REGION.south, REGION.east, REGION.north),
          material: new Cesium.ImageMaterialProperty({ image: canvas, transparent: true }),
        },
      });

      // 发射机：标记 + 覆盖圈层（drawShells 随功率重画）
      const shells = new Cesium.CustomDataSource('shells');
      instance.dataSources.add(shells);
      shellsRef.current = shells;
      txList.forEach((tx) => {
        layer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(tx.lng, tx.lat),
          point: {
            pixelSize: 9,
            color: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.fromCssColorString(ACCENT_CSS.zone),
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: { ...tagLabel({ offset: [0, -16] }), text: tx.id, disableDepthTestDistance: Number.POSITIVE_INFINITY },
        });
      });

      // 点位读数：点击地图任意位置
      const handler = new Cesium.ScreenSpaceEventHandler(instance.scene.canvas);
      handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
        const cartesian = instance.camera.pickEllipsoid(click.position, instance.scene.globe.ellipsoid);
        if (!cartesian) return;
        const carto = Cesium.Cartographic.fromCartesian(cartesian);
        const lng = Cesium.Math.toDegrees(carto.longitude);
        const lat = Cesium.Math.toDegrees(carto.latitude);
        const seconds = Cesium.JulianDate.secondsDifference(instance.clock.currentTime, epoch);
        const distances = txList
          .map((tx) => ({ id: tx.id, km: distanceKm([lng, lat], [tx.lng, tx.lat]) }))
          .sort((a, b) => a.km - b.km);
        setProbe({ lng, lat, strength: fieldStrength(lng, lat, seconds, powersRef.current), distances });
        if (probeMarkRef.current) instance.entities.remove(probeMarkRef.current);
        probeMarkRef.current = instance.entities.add({
          position: cartesian,
          point: {
            pixelSize: 8,
            color: Cesium.Color.fromCssColorString(ACCENT_CSS.selection),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
          },
        });
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      return () => {
        handler.destroy();
        if (!instance.isDestroyed()) {
          instance.dataSources.remove(layer, true);
          instance.dataSources.remove(shells, true);
        }
        probeMarkRef.current = null;
      };
    },
  });

  // 覆盖圈随功率重画（初始一次 + 每次 slider 变化）；首次落成后按其包围球自动取景
  const framedRef = useRef(false);
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !shellsRef.current) return;
    drawShells(shellsRef.current);
    if (!framedRef.current) {
      framedRef.current = true;
      // 主体取景：REGION 外接球（半对角 ~65km），pitch -35 斜视 + 显式 range
      // （zoomTo 自动定距实测不生效，改用 flyToBoundingSphere）；功率变化不重框
      const centerLng = (REGION.west + REGION.east) / 2;
      const centerLat = (REGION.south + REGION.north) / 2;
      const radius = (Math.hypot(REGION.east - REGION.west, REGION.north - REGION.south) / 2) * 111_000;
      void viewer.camera.flyToBoundingSphere(
        new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(centerLng, centerLat), radius),
        {
          offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-35), 210_000),
          duration: 2.2,
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, powers]);

  // 功率变化时已有的探测读数按新功率重算（探测点不动），与热力/覆盖圈保持一致
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    const seconds = Cesium.JulianDate.secondsDifference(viewer.clock.currentTime, epoch);
    setProbe((prev) => (prev ? { ...prev, strength: fieldStrength(prev.lng, prev.lat, seconds, powers) } : prev));
  }, [viewer, powers, epoch]);

  /* 场强心跳：Worker 算场（不可用时主线程低分辨率降级）→ 渲染 canvas → 换材质 */
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !canvasRef.current || !heatRef.current?.rectangle) return undefined;
    const canvas = canvasRef.current;
    const rectangle = heatRef.current.rectangle;
    let disposed = false;

    const draw = (grid: { cols: number; rows: number; values: Float32Array }) => {
      renderHeatField(canvas, grid);
      rectangle.material = new Cesium.ImageMaterialProperty({ image: canvas, transparent: true });
      let min = Infinity;
      let max = -Infinity;
      for (const v of grid.values) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
      setFieldSpan({ min, max });
    };

    let worker: Worker | null = null;
    if (typeof Worker !== 'undefined') {
      try {
        worker = new Worker(new URL('./heatWorker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<{ cols: number; rows: number; values: Float32Array }>) => {
          if (!disposed) draw(event.data);
        };
        // 脚本加载失败（chunk 404、不支持 module worker 的旧浏览器）不会让构造函数抛异常，只触发 error 事件：
        // 置空后下一拍走主线程降级，否则热力层永久空白、KPI 恒为「—」
        worker.onerror = (event) => {
          event.preventDefault();
          worker?.terminate();
          worker = null;
          workerRef.current = null;
        };
      } catch {
        worker = null;
      }
      workerRef.current = worker;
    }

    const timer = window.setInterval(() => {
      if (disposed) return;
      const seconds = Cesium.JulianDate.secondsDifference(viewer.clock.currentTime, epoch);
      // powers 走 ref（与组件顶部 powersRef 同一来源）：放进依赖会让 slider 每一拍都
      // terminate + 重建 Worker（模块级 Worker 重新加载 chunk），而 Worker 本就按请求接收新 powers
      const currentPowers = powersRef.current;
      if (worker) {
        worker.postMessage({ ...GRID, seconds, powers: currentPowers });
      } else {
        // 降级：主线程低分辨率（import 环形依赖规避：fieldModel 就在同目录）
        import('./fieldModel').then(({ gridValues }) => {
          if (disposed) return;
          const values = gridValues(FALLBACK_GRID.cols, FALLBACK_GRID.rows, seconds, currentPowers);
          draw({ ...FALLBACK_GRID, values });
        });
      }
    }, FRAME_MS);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      worker?.terminate();
      workerRef.current = null;
    };
  }, [viewer, epoch]);

  useEffect(() => {
    if (viewer) viewer.clock.multiplier = speed;
  }, [viewer, speed]);

  useEffect(() => {
    if (viewer) viewer.clock.shouldAnimate = playing;
  }, [viewer, playing]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    if (heatRef.current) heatRef.current.show = mode !== 'shells';
    if (shellsRef.current) shellsRef.current.entities.show = mode !== 'heat';
  }, [viewer, mode]);

  const legend = (
    <div className="scene-panel">
      <div className="scene-panel-title">{t('cesium.heatmap.legend')}</div>
      <div className="h-2.5 w-44 rounded-sm" style={{ background: rampGradientCss() }} />
      <div className="mt-0.5 flex justify-between font-mono text-[10px] opacity-70">
        <span>{FIELD_MIN}</span>
        <span>{Math.round((FIELD_MIN + FIELD_MAX) / 2)}</span>
        <span>{FIELD_MAX}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-[11px]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4" style={{ background: '#f5222d' }} />
          60 dB
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4" style={{ background: '#fa8c16' }} />
          45 dB
        </span>
      </div>
    </div>
  );

  const txPanel = (
    <div className="scene-panel">
      <div className="scene-panel-title">{t('cesium.heatmap.txPanel')}</div>
      <div className="flex flex-col gap-2.5">
        {txList.map((tx, i) => (
          <div key={tx.id}>
            <div className="mb-0.5 flex items-center justify-between text-xs">
              <span className="font-mono">{tx.id}</span>
              <span className="font-mono opacity-70">
                {Math.round(powers[i] * 100)}% · {coverageRadiusKm(powers[i], 60).toFixed(0)} km
              </span>
            </div>
            <Slider
              min={0.2}
              max={1}
              step={0.05}
              value={powers[i]}
              onChange={(next) =>
                setPowers((prev) => {
                  const copy = [...prev];
                  copy[i] = next;
                  return copy;
                })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );

  const probePanel = probe ? (
    <div className="scene-panel">
      <div className="scene-panel-title">{t('cesium.heatmap.probe')}</div>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <Typography.Text type="secondary">dBμV/m</Typography.Text>
        <span className="font-mono text-base font-bold">{probe.strength.toFixed(1)}</span>
        <Typography.Text type="secondary">DD</Typography.Text>
        <span className="font-mono">
          {probe.lat.toFixed(4)}, {probe.lng.toFixed(4)}
        </span>
        {probe.distances.map((d) => (
          <div key={d.id} className="col-span-2 flex items-center justify-between">
            <Typography.Text type="secondary">→ {d.id}</Typography.Text>
            <span className="font-mono">{d.km.toFixed(1)} km</span>
          </div>
        ))}
      </div>
    </div>
  ) : (
    <div className="scene-panel">
      <Typography.Text type="secondary" className="text-xs">
        {t('cesium.heatmap.probeHint')}
      </Typography.Text>
    </div>
  );

  return (
    <DemoPage descriptionId="page.cesium.heatmap.desc" source="src/pages/Map/Cesium/fieldModel.ts">
      <SceneStage
        containerRef={containerRef}
        viewer={viewer}
        error={error}
        basemapFailed={basemapFailed}
        onRetryBasemap={retry}
        title={t('cesium.heatmap.title')}
        kpis={[
          { label: 'TX', value: txList.length },
          {
            label: t('cesium.heatmap.kpi.span'),
            value: fieldSpan ? `${fieldSpan.min.toFixed(0)}–${fieldSpan.max.toFixed(0)} dB` : '—',
          },
          {
            label: t('cesium.heatmap.kpi.cover60'),
            value: `${Math.max(...txList.map((_, i) => coverageRadiusKm(powers[i], 60))).toFixed(0)} km`,
          },
        ]}
        actions={
          <Segmented
            size="small"
            value={mode}
            onChange={(value) => setMode(value as Mode)}
            options={[
              { value: 'heat', label: t('cesium.heatmap.modeHeat') },
              { value: 'shells', label: t('cesium.heatmap.modeShells') },
              { value: 'both', label: t('cesium.heatmap.modeBoth') },
            ]}
          />
        }
        panels={txPanel}
        rightPanels={probePanel}
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
