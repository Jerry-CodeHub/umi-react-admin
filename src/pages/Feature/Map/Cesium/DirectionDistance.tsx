/**
 * DirectionDistance.tsx
 */
import { CesiumInitError, createDemoViewer } from '@/components/CesiumViewer';
import {
  handlerDirectionDistance,
  handlerDistanceKm,
  handlerPointNew,
  handlerPolygonPath,
} from '@/utils/MapCompute/cesiumCompute';
import { dataPath } from '@/utils/MapCompute/dataEnd';
import { demodulationResultList, interceptResultList, locationResultList } from '@/utils/MapCompute/exportJson';
import { setupCesium } from '@/utils/MapCompute/setupCesium';
import { ProCard } from '@ant-design/pro-components';
import { Alert, Button, Tooltip } from 'antd';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import React, { useEffect, useState } from 'react';

setupCesium(Cesium);

const DirectionDistance: React.FC = () => {
  const [viewer, setViewer] = useState<Cesium.Viewer | null>(null);
  const [initError, setInitError] = useState(false);

  useEffect(() => {
    // 创建一个 Cesium Viewer 实例
    // 通用控件配置与初始化失败兜底见 @/components/CesiumViewer
    const viewer = createDemoViewer('cesium-container');
    if (!viewer) {
      setInitError(true);
      return;
    }

    // 修改 homeButton 的位置
    let initView = {
      destination: Cesium.Cartesian3.fromDegrees(116.3974, 39.9093, 15000000),
    };
    // viewer.camera.setView(initView);
    viewer.camera.flyTo(initView);

    setViewer(viewer);

    // 销毁
    return () => {
      if (!viewer.isDestroyed()) viewer.destroy();
    };
  }, []);

  // NOTE 根据方向(度)和距离(km)生成路径
  const handlePolygonPath = () => {
    if (!viewer) return;

    let startLongitude = 116.3974;
    let startLatitude = 39.9093;
    let startHeight = 0;

    let startPoint = handlerDirectionDistance(startLongitude, startLatitude, startHeight, dataPath);

    let polygon = viewer.entities.add({
      polygon: {
        hierarchy: startPoint,
        material: Cesium.Color.RED.withAlpha(0.5),
      },
    });

    viewer.zoomTo(polygon);
  };

  // NOTE 每一个点的终点为下一个点的起点
  const handlePointPath = () => {
    if (!viewer) return;

    let startLongitude = 116.3974;
    let startLatitude = 39.9093;
    let startHeight = 0;

    let pathPoints = handlerPointNew(startLongitude, startLatitude, startHeight, dataPath);
    let polygon = viewer.entities.add({
      polygon: {
        hierarchy: pathPoints,
        material: Cesium.Color.RED.withAlpha(0.5),
      },
    });

    viewer.zoomTo(polygon);
  };

  // NOTE 经纬度渲染
  const handlerLatLon = () => {
    if (!viewer) return;

    let intercept = structuredClone(interceptResultList);
    let location = structuredClone(locationResultList);
    let demodulation = structuredClone(demodulationResultList);

    let interceptList = handlerPolygonPath(intercept);
    viewer.entities.add({
      polygon: {
        hierarchy: interceptList,
        // 内部填充颜色 透明度
        material: Cesium.Color.RED.withAlpha(0.5),
        // material: new Cesium.PolylineDashMaterialProperty({ // 虚线材质
        //   color: Cesium.Color.RED,
        // }),
      },
    });

    let locationList = handlerPolygonPath(location);
    viewer.entities.add({
      polygon: {
        hierarchy: locationList,
        // 内部填充颜色 透明度
        material: Cesium.Color.BLUE.withAlpha(0.5),
        // material: new Cesium.PolylineDashMaterialProperty({ // 虚线材质
        //   color: Cesium.Color.BLUE,
        // }),
      },
    });

    let demodulationList = handlerPolygonPath(demodulation);
    viewer.entities.add({
      polygon: {
        hierarchy: demodulationList,
        // 内部填充颜色 透明度
        material: Cesium.Color.GREEN.withAlpha(0.5),
        // material: new Cesium.PolylineDashMaterialProperty({ // 虚线材质
        //   color: Cesium.Color.GREEN,
        // }),
      },
    });
  };

  // NOTE 方向距离渲染
  const handlerDistance = () => {
    if (!viewer) return;

    let intercept = structuredClone(interceptResultList);
    let location = structuredClone(locationResultList);
    let demodulation = structuredClone(demodulationResultList);

    let startLongitude = 116.3974;
    let startLatitude = 39.9093;
    let startHeight = 0;

    let startPoint = handlerDistanceKm(startLongitude, startLatitude, startHeight, intercept);
    viewer.entities.add({
      polygon: {
        hierarchy: startPoint,
        material: Cesium.Color.RED.withAlpha(0.5),
      },
    });

    let endPoint = handlerDistanceKm(startLongitude, startLatitude, startHeight, location);
    viewer.entities.add({
      polygon: {
        hierarchy: endPoint,
        material: Cesium.Color.BLUE.withAlpha(0.5),
      },
    });

    let demodulationPoint = handlerDistanceKm(startLongitude, startLatitude, startHeight, demodulation);
    viewer.entities.add({
      polygon: {
        hierarchy: demodulationPoint,
        material: Cesium.Color.GREEN.withAlpha(0.5),
      },
    });
  };

  return (
    <>
      <Alert className="mb-2" message="方向距离算法" type="success" />
      <ProCard>
        {initError ? <CesiumInitError /> : <div id="cesium-container" />}
        <Tooltip title="根据方向(度)和距离(km)生成路径 (起始点为固定点路径完成连接终点)">
          <Button onClick={() => handlePolygonPath()} className="mt-2">
            以固定点为原点连接终点
          </Button>
        </Tooltip>

        <Tooltip className="ml-2" title="根据方向(度)和距离(km)生成路径 (每一个点的终点为下一个点的起点)">
          <Button onClick={() => handlePointPath()} className="mt-2">
            每一个点的终点为下一个点的起点
          </Button>
        </Tooltip>

        <Button className="mt-2 ml-2" onClick={() => handlerLatLon()}>
          经纬度渲染
        </Button>

        <Tooltip title="根据方向(度)和距离(km)生成路径 (起始点为固定点路径完成连接终点)">
          <Button className="mt-2 ml-2" onClick={() => handlerDistance()}>
            方向距离渲染
          </Button>
        </Tooltip>
      </ProCard>
    </>
  );
};

export default DirectionDistance;
