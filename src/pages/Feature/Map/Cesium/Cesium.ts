import { setupCesium } from '@/utils/MapCompute/setupCesium';
import * as Cesium from 'cesium';

setupCesium(Cesium);

class CesiumMap {
  private viewer: Cesium.Viewer;
  private cesiumContainer: string;

  constructor(cesiumContainer: string) {
    this.cesiumContainer = cesiumContainer;
    this.viewer = this.initViewer();
  }

  private initViewer() {
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
