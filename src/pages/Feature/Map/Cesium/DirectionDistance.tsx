/**
 * DirectionDistance.tsx
 */
import {
  handlerDirectionDistance,
  handlerDistanceKm,
  handlerPointNew,
  handlerPolygonPath,
} from '@/utils/MapCompute/cesiumCompute';
import { dataPath } from '@/utils/MapCompute/dataEnd';
import { demodulationResultList, interceptResultList, locationResultList } from '@/utils/MapCompute/exportJson';
import { ProCard } from '@ant-design/pro-components';
import { Alert, Button, Tooltip } from 'antd';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import React, { useEffect, useState } from 'react';

const DirectionDistance: React.FC = () => {
  const [viewer, setViewer] = useState(null as any);

  useEffect(() => {
    // 创建一个 Cesium Viewer 实例
    const viewer = new Cesium.Viewer('cesiumContainer', {
      // 去除所有的控件
      animation: false, // 是否显示动画控件
      // baseLayerPicker: false, // 是否显示图层选择控件
      // fullscreenButton: false, // 是否显示全屏按钮
      // geocoder: false, // 是否显示地名查找控件
      // homeButton: false, // 是否显示Home按钮
      infoBox: false, // 是否显示信息框
      sceneModePicker: true, // 是否显示3D/2D选择器
      selectionIndicator: false, // 是否显示选取指示器组件
      timeline: false, // 是否显示时间轴
      navigationHelpButton: false, // 是否显示帮助信息按钮
      navigationInstructionsInitiallyVisible: false, // 是否显示导航指示
      // scene3DOnly: true, // 是否只显示3D
      shouldAnimate: true, // 是否显示动画
      skyAtmosphere: false, // 是否显示大气层
      skyBox: false, // 是否显示天空盒
      vrButton: false, // 是否显示VR按钮
    });

    // 1, 去除版权信息
    (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';

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
    let intercept = structuredClone(interceptResultList);
    let location = structuredClone(locationResultList);
    let demodulation = structuredClone(demodulationResultList);

    let interceptList = handlerPolygonPath(intercept);
    viewer.entities.add({
      polygon: {
        hierarchy: interceptList,
        width: 2,
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
        width: 2,
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
        width: 2,
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
        <div id="cesiumContainer" />
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
