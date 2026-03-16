import { handlerComputePoint, mergePolygons, mergePolygonsPath } from '@/utils/MapCompute/cesiumCompute';
import { iconData } from '@/utils/MapCompute/dataEnd';
import { demodulationResultList, interceptResultList, locationResultList } from '@/utils/MapCompute/exportJson';
import { ProCard } from '@ant-design/pro-components';
// import * as turf from '@turf/turf';
// import turf from '/public/js/turf.min.js';
import { pathPointData } from '@/utils/MapCompute/ngeohash/pathPointData';
import { Alert, Button, message } from 'antd';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
// import RBush from 'rbush';
import React, { useEffect, useState } from 'react';

const Trajectory: React.FC = () => {
  const [messageApi, contextHolder] = message.useMessage();
  const [viewer, setViewer] = useState(null as any);
  // let turf = window.turf;
  // console.log(turf);

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

    setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      handlerIcon(viewer);
    }, 100);

    // 销毁
    return () => {
      if (!viewer.isDestroyed()) viewer.destroy();
    };
  }, []);

  // NOTE 添加图标
  const handlerIcon = (viewer: any) => {
    // 添加图标
    let item = iconData[0];
    let entity = viewer.entities.add({
      id: item.id,
      position: Cesium.Cartesian3.fromDegrees(item.longitude, item.latitude),
      billboard: {
        image: require('@/assets/Detection.png'),
        scale: 0.3,
      },
    });
    entity.properties = {
      text: item.label,
    };
  };

  // NOTE 绘制开始
  const [drawing, setDrawing] = useState(false);
  const drawingRef = React.useRef(false);
  const positionsArrRef = React.useRef([] as any[]);
  const positionsGeoRef = React.useRef([] as any[]);
  const handlerRef = React.useRef(null as any);
  const handlerDraw = () => {
    // 1, 点击按钮开始绘制
    drawingRef.current = true;
    setDrawing(true);
    viewer.cesiumWidget._element.style.cursor = 'crosshair'; // 鼠标样式为十字

    // 获取所有实体
    let entities = viewer.entities.values;
    let entity = entities.find((item: any) => item.properties.text._value === 'A');
    // 计算entity的经纬度
    let cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(entity.position._value);
    let lng = Cesium.Math.toDegrees(cartographic.longitude);
    let lat = Cesium.Math.toDegrees(cartographic.latitude);

    // 计算entity笛卡尔坐标系 xy 坐标
    let position = Cesium.Cartesian3.fromDegrees(lng, lat);
    positionsArrRef.current = [position];
    positionsGeoRef.current = [{ longitude: lng, latitude: lat }];

    // 2, 点击地图后, 在点击处绘制圆形的形状, 并且在地图上显示坐标
    handlerRef.current = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas); // 鼠标事件处理器

    handlerRef.current.setInputAction((movement: any) => {
      // 获取鼠标位置的笛卡尔坐标
      let cartesian = viewer.camera.pickEllipsoid(
        movement.position, // 鼠标位置
        viewer.scene.globe.ellipsoid, // 椭球体
      );

      if (cartesian && drawingRef.current) {
        let cartographic = Cesium.Cartographic.fromCartesian(cartesian); // 笛卡尔坐标转经纬度
        let longitudeString = Cesium.Math.toDegrees(cartographic.longitude); // 经度
        let latitudeString = Cesium.Math.toDegrees(cartographic.latitude); // 纬度
        let heightString = cartographic.height.toFixed(2); // 高度

        // 绘制圆形
        viewer.entities.add({
          position: cartesian,
          ellipse: {
            semiMinorAxis: 30.0,
            semiMajorAxis: 30.0,
            material: new Cesium.Color(1.0, 1.0, 1.0, 0.5),
          },
        });

        // 连接上一个点和当前点
        if (positionsArrRef.current.length >= 1) {
          let lastCartesian = positionsArrRef.current[positionsArrRef.current.length - 1]; // 上一个点
          // 绘制实线
          viewer.entities.add({
            polyline: {
              // positions: [lastCartesian, cartesian],
              positions: new Cesium.CallbackProperty(() => {
                // 实时更新
                return [lastCartesian, cartesian]; // 返回两个点
              }, false), // false 表示不更新
              width: 2, // 线宽
              // material: new Cesium.PolylineDashMaterialProperty({ // 虚线材质
              //   color: Cesium.Color.YELLOW,
              // }),
              material: Cesium.Color.YELLOW, // 实线材质
            },
          });
        }

        // 5, 存储点的数组
        positionsArrRef.current = [...positionsArrRef.current, cartesian];
        positionsGeoRef.current = [
          ...positionsGeoRef.current,
          { longitude: longitudeString, latitude: latitudeString },
        ];
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  };

  // NOTE 绘制完成回调
  const handlerDrawOk = () => {
    setDrawing(false);
    drawingRef.current = false;
    viewer.cesiumWidget._element.style.cursor = 'default'; // 鼠标样式为默认

    handlerRef.current.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);

    let dataPath = handlerComputePoint(positionsGeoRef.current, 1000);

    if (dataPath.length > 1000) {
      messageApi.open({
        type: 'warning',
        content: '绘制点过多, 请缩小范围!',
      });
      return;
    } else {
      // 连接 dataPath 中的点, 成为一条路径
      dataPath.forEach((item) => {
        viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(item.longitude, item.latitude),
          billboard: {
            image: require('@/assets/Detection.png'),
            scale: 0.3,
          },
        });
      });
    }

    dataPath = [];

    positionsArrRef.current = [];
    positionsGeoRef.current = [];
  };

  // NOTE 相交合并/包含去重, 组成新的路径渲染
  const handlerLatLon = () => {
    let intercept = structuredClone(interceptResultList);
    let location = structuredClone(locationResultList);
    let demodulation = structuredClone(demodulationResultList);

    // 使用示例
    // const polygonArrays = [
    //   [{longitude: -75.0, latitude: 40.0}, {longitude: -74.0, latitude: 41.0}, {longitude: -73.0, latitude: 40.0}],
    //   [{longitude: -74.5, latitude: 40.5}, {longitude: -73.5, latitude: 41.5}, {longitude: -72.5, latitude: 40.5}]
    // ];

    // 数组1
    let interceptPath = [] as any[];
    intercept.forEach((item: any) => {
      interceptPath.push({ longitude: item.longitude, latitude: item.latitude });
    });
    interceptPath.push({ longitude: intercept[0].longitude, latitude: intercept[0].latitude });

    // 数组2
    let locationPath = [] as any[];
    location.forEach((item: any) => {
      locationPath.push({ longitude: item.longitude, latitude: item.latitude });
    });
    locationPath.push({ longitude: location[0].longitude, latitude: location[0].latitude });

    // 数组3
    let demodulationPath = [] as any[];
    demodulation.forEach((item: any) => {
      demodulationPath.push({ longitude: item.longitude, latitude: item.latitude });
    });
    demodulationPath.push({ longitude: demodulationPath[0].longitude, latitude: demodulationPath[0].latitude }); // 添加第一个点, 形成闭合路径

    let polygonArrays = [interceptPath, locationPath, demodulationPath]; // 三个路径组成的多边形数组

    // 全部渲染不做合并测试
    polygonArrays.forEach((item) => {
      viewer.entities.add({
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray(item.flatMap((p: any) => [p.longitude, p.latitude])), // 传入的是一个数组
          material: Cesium.Color.RED.withAlpha(0.3),
        },
      });
    });

    // 合并多边形
    try {
      const mergedPolygon = mergePolygons(polygonArrays);

      // 在 Cesium 中显示合并后的多边形
      viewer.entities.add({
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray(mergedPolygon.flatMap((p: any) => [p.longitude, p.latitude])), // 传入的是一个数组
          // material: Cesium.Color.RED.withAlpha(0.5),
          material: Cesium.Color.YELLOW.withAlpha(0.3),
          height: 50000,
        },
      });
    } catch (error) {
      console.error('合并多边形错误:', error);
    }
  };

  // NOTE 相交合并/包含去重, 组成新的路径渲染 200+ (214)
  const handlerMergeNum = () => {
    let polygonArrays = pathPointData;
    try {
      const mergedPolygon = mergePolygonsPath(polygonArrays);

      // 在 Cesium 中显示合并后的多边形
      viewer.entities.add({
        polygon: {
          // hierarchy: Cesium.Cartesian3.fromDegreesArray(mergedPolygon.flatMap((p) => [p.longitude, p.latitude])),
          hierarchy: Cesium.Cartesian3.fromDegreesArray(mergedPolygon.flatMap((p: any) => [p.longitude, p.latitude])),
          material: Cesium.Color.RED.withAlpha(0.5),
        },
      });
    } catch (error) {
      console.error('合并多边形错误:', error);
    }
  };

  // NOTE 不合并渲染 200+ (214)
  const handlerFalseMerge = () => {
    // 全部渲染不做合并
    pathPointData.forEach((item, index) => {
      viewer.entities.add({
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray(item.flatMap((p: any) => [p.longitude, p.latitude])), // 传入的是一个数组
          material: Cesium.Color.RED.withAlpha(0.3),
          height: index * 1000,
        },
      });
    });
  };

  return (
    <>
      {contextHolder}
      <Alert className="mb-2" message="轨迹" type="success" />
      <ProCard>
        <div id="cesiumContainer" className="static" />
        <div className="absolute top-8 left-8">
          {drawing ? (
            <Button id="startDrawing" className="text-cyan-50 hover:text-gray-900" onClick={() => handlerDrawOk()}>
              绘制完成
            </Button>
          ) : (
            <Button id="startDrawing" className="text-cyan-50 hover:text-gray-900" onClick={() => handlerDraw()}>
              开始绘制
            </Button>
          )}
        </div>
        <Button className="mt-2" onClick={() => handlerLatLon()}>
          多边形合并渲染(turf 计算)
        </Button>
        <Button className="mt-2 ml-2" onClick={() => handlerMergeNum()}>
          多边形合并渲染 200+ (凸包算法)
        </Button>
        {/* <Button className="mt-2 ml-2" onClick={() => handlerAlphaMerge()}>
          相交合并渲染 200+ (算法)
        </Button> */}
        <Button className="mt-2 ml-2" onClick={() => handlerFalseMerge()}>
          多边形不合并渲染 200+
        </Button>
      </ProCard>
    </>
  );
};

export default Trajectory;
