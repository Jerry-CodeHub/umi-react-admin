type CesiumModule = typeof import('cesium');

export const setupCesium = (Cesium: CesiumModule) => {
  if (typeof window !== 'undefined' && !window.Cesium) {
    window.Cesium = Cesium;
  }

  if (typeof CESIUM_ION_TOKEN !== 'undefined' && CESIUM_ION_TOKEN) {
    Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN;
  }
};
