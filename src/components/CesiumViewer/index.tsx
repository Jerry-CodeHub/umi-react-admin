import { useIntl } from '@umijs/max';
import { Result, Spin } from 'antd';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import './cesium.css';

/** 演示页通用的 Viewer 控件配置：关闭动画、时间轴、信息框、帮助等，保留 2D/3D 切换 */
const DEMO_VIEWER_OPTIONS: Cesium.Viewer.ConstructorOptions = {
  animation: false,
  infoBox: false,
  sceneModePicker: true,
  selectionIndicator: false,
  timeline: false,
  navigationHelpButton: false,
  navigationInstructionsInitiallyVisible: false,
  shouldAnimate: true,
  skyAtmosphere: false,
  skyBox: false,
  vrButton: false,
  baseLayerPicker: false,
};

let configured = false;
/** 全局一次：挂 window.Cesium（部分插件依赖）并设置 ion token */
const configureCesium = () => {
  if (configured) return;
  configured = true;
  if (typeof window !== 'undefined' && !window.Cesium) window.Cesium = Cesium;
  if (typeof CESIUM_ION_TOKEN !== 'undefined' && CESIUM_ION_TOKEN) Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN;
};

/**
 * 创建演示页 Viewer。WebGL 不可用等初始化失败时返回 null，调用方渲染错误态而不是整块空白。
 * 注意：不要隐藏 cesiumWidget.creditContainer——Cesium ion 与影像/地形数据提供方的条款要求显示署名。
 */
export const createDemoViewer = (container: string | Element, options: Cesium.Viewer.ConstructorOptions = {}) => {
  configureCesium();
  try {
    return new Cesium.Viewer(container, { ...DEMO_VIEWER_OPTIONS, ...options });
  } catch (error) {
    console.error('Cesium Viewer init failed:', error);
    return null;
  }
};

export const CesiumInitError = () => {
  const intl = useIntl();
  return (
    <Result
      status="warning"
      title={intl.formatMessage({ id: 'error.webgl.title' })}
      subTitle={intl.formatMessage({ id: 'error.webgl.subTitle' })}
    />
  );
};

type UseCesiumViewerOptions = {
  /** 初始视角 [经度, 纬度, 高度(米)] */
  home?: [number, number, number];
  viewerOptions?: Cesium.Viewer.ConstructorOptions;
  /** Viewer 创建后执行一次（添加图层、事件等）；返回的函数在销毁前调用 */
  onReady?: (viewer: Cesium.Viewer) => void | (() => void);
};

/**
 * 六个 Cesium 页共用的生命周期：创建、初始视角、错误态、卸载时销毁（含 onReady 注册的清理）。
 * 此前每页各写一份 useEffect，清理逻辑参差（外部 ScreenSpaceEventHandler 漏销毁、卸载竞态等）。
 */
export const useCesiumViewer = ({
  home = [108, 35, 7_000_000],
  viewerOptions,
  onReady,
}: UseCesiumViewerOptions = {}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<Cesium.Viewer | null>(null);
  const [error, setError] = useState(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const instance = createDemoViewer(containerRef.current, viewerOptions);
    if (!instance) {
      setError(true);
      return undefined;
    }
    instance.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(...home) });
    // 影像瓦片请求失败（离线、被 CSP 拦截、服务限流）时 Cesium 内部以 RequestErrorEvent 未处理拒绝；
    // 缺几块瓦片不影响场景可用，这里吞掉这一类，避免刷屏 Uncaught (in promise)
    const onRejection = (event: PromiseRejectionEvent) => {
      if (event.reason instanceof Cesium.RequestErrorEvent) event.preventDefault();
    };
    window.addEventListener('unhandledrejection', onRejection);
    const cleanup = onReadyRef.current?.(instance);
    setViewer(instance);
    return () => {
      window.removeEventListener('unhandledrejection', onRejection);
      cleanup?.();
      if (!instance.isDestroyed()) instance.destroy();
    };
    // 只在挂载时创建一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { containerRef, viewer, error };
};

/** 场景容器：错误态、加载态与可选的浮层（图例、提示）统一在这里 */
export const CesiumStage = ({
  containerRef,
  viewer,
  error,
  overlay,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  viewer: Cesium.Viewer | null;
  error: boolean;
  overlay?: ReactNode;
}) =>
  error ? (
    <CesiumInitError />
  ) : (
    <div className="cesium-stage">
      <div ref={containerRef} className="absolute inset-0" />
      {!viewer && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spin size="large" />
        </div>
      )}
      {overlay && <div className="pointer-events-none absolute top-3 left-3 z-10">{overlay}</div>}
    </div>
  );

/** 与全站语义色一致的 Cesium 颜色 */
export const cesiumColor = (css: string, alpha = 1) => Cesium.Color.fromCssColorString(css).withAlpha(alpha);
