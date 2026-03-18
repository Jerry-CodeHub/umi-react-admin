import * as Cesium from 'cesium';

class CesiumMap {
  private viewer: Cesium.Viewer;
  private cesiumContainer: string;

  constructor(cesiumContainer: string) {
    this.cesiumContainer = cesiumContainer;
    this.viewer = this.initViewer();
  }

  private initViewer() {
    // 每个 Viewer 实例需独立设置 token，确保在 app.tsx 全局初始化之外也能正常鉴权
    Cesium.Ion.defaultAccessToken = process.env.CESIUM_ION_TOKEN as string;
    return new Cesium.Viewer(this.cesiumContainer, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
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
    });
  }

  public getViewer() {
    return this.viewer;
  }

  public destroy() {
    this.viewer.destroy();
  }
}

export default CesiumMap;
