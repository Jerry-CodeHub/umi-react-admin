export type ThermalPoint = {
  longitude: number;
  latitude: number;
  fieldStrength: number;
};

export type ThermalData = {
  diagramPngStream: string;
  coverageData: {
    arrayResult: ThermalPoint[][];
  };
};

const thermalMapDataUrl = `${CESIUM_BASE_URL.replace(/\/Cesium\/?$/, '')}/data/ThermalMapData.json`;

export const loadThermalMapData = async (): Promise<ThermalData> => {
  const response = await fetch(thermalMapDataUrl);

  if (!response.ok) {
    throw new Error(`热力图数据加载失败: ${response.status}`);
  }

  return (await response.json()) as ThermalData;
};
