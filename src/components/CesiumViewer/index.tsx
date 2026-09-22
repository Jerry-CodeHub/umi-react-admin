import { Result } from 'antd';
import * as Cesium from 'cesium';

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
};

/**
 * 创建演示页 Viewer（6 个 Cesium 页共用）。WebGL 不可用等初始化失败时返回 null，
 * 调用方渲染 <CesiumInitError /> 兜底，而不是整块空白或 Spin 永转。
 * 注意：不要隐藏 cesiumWidget.creditContainer——Cesium ion 与影像/地形数据提供方的条款要求显示署名。
 */
export const createDemoViewer = (container: string | Element, options: Cesium.Viewer.ConstructorOptions = {}) => {
  try {
    return new Cesium.Viewer(container, { ...DEMO_VIEWER_OPTIONS, ...options });
  } catch (error) {
    console.error('Cesium Viewer 初始化失败:', error);
    return null;
  }
};

export const CesiumInitError = () => (
  <Result status="warning" title="地图初始化失败" subTitle="WebGL 不可用或当前浏览器不支持 Cesium 渲染" />
);
