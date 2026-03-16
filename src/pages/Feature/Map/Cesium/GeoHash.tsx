/**
 * InfoIndex.tsx
 */
import { centerGeoHash, geohashBounds } from '@/utils/MapCompute/geoHash';
import { ProCard } from '@ant-design/pro-components';
import type { InputNumberProps } from 'antd';
import { Alert, Button, InputNumber, Spin, message } from 'antd';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useEffect, useState } from 'react';

const InfoGeoHash: React.FC = () => {
  const [viewer, setViewer] = useState<Cesium.Viewer | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

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

    // 2, 添加一个点击事件来显示位置坐标：
    viewer.screenSpaceEventHandler.setInputAction(function onLeftClick(movement: { position: Cesium.Cartesian2 }) {
      const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
      if (cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const longitudeString = Cesium.Math.toDegrees(cartographic.longitude).toFixed(2);
        const latitudeString = Cesium.Math.toDegrees(cartographic.latitude).toFixed(2);
        messageApi.info(`Longitude: ${longitudeString}, Latitude: ${latitudeString}`);
        // alert(`Longitude: ${longitudeString}, Latitude: ${latitudeString}`);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // 监听相机高度变化
    viewer.camera.moveEnd.addEventListener(() => {
      const cameraHeight = viewer.camera.positionCartographic.height;
      // messageApi.success(`相机高度变化: ${cameraHeight}`);
    });

    setViewer(viewer);

    // 销毁
    return () => {
      if (!viewer.isDestroyed()) viewer.destroy();
    };
  }, []);

  // NOTE 获取中心点
  const [centerPosition, setCenterPosition] = useState('');
  const getCenterPosition = () => {
    if (viewer === null) {
      return;
    }
    const center = viewer.camera.position;
    const cartographic = Cesium.Cartographic.fromCartesian(center);
    const longitude = Cesium.Math.toDegrees(cartographic.longitude);
    const latitude = Cesium.Math.toDegrees(cartographic.latitude);
    messageApi.success(`中心点坐标: ${longitude}, ${latitude}`);
    setCenterPosition(`${longitude}, ${latitude}`);
  };

  // NOTE 根据中心点坐标生成 GeoHash
  const [precisions, setPrecisions] = useState<number>(5);
  const inputNumberChange: InputNumberProps['onChange'] = (value) => {
    if (value !== null) setPrecisions(Number(value));
  };
  const [centerHash, setCenterHash] = useState('');
  const handleCenterGeoHash = () => {
    if (viewer === null) {
      return;
    }
    const cartesian = viewer.camera.position; // 获取相机位置
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian); // 获取笛卡尔坐标
    const longitude = Cesium.Math.toDegrees(cartographic.longitude); // 转换为经度
    const latitude = Cesium.Math.toDegrees(cartographic.latitude); // 转换为纬度
    // const precision = 5; // 精度
    const precision = precisions; // 精度
    const geohash = centerGeoHash(latitude, longitude, precision);

    messageApi.success(`生成的GeoHash: ${geohash}`);
    setCenterHash(geohash);

    setTimeout(() => {
      // 如何根据 geohash 字符串手动实现显示范围 画出范围
      viewer.entities.removeAll(); // 移除所有实体

      const bounds: any = geohashBounds(geohash);
      const rectangles = Cesium.Rectangle.fromDegrees(
        bounds.longitudeMin,
        bounds.latitudeMin,
        bounds.longitudeMax,
        bounds.latitudeMax,
      );
      let rectangle = viewer.entities.add({
        rectangle: {
          coordinates: rectangles,
          fill: true,
          material: Cesium.Color.RED.withAlpha(0.5),
          outline: true,
          outlineColor: Cesium.Color.BLACK,
        },
      });

      viewer.zoomTo(rectangle, new Cesium.HeadingPitchRange(0, -0.5, 0));
    }, 100);
  };

  // NOTE 根据当前视图获取四个方位角的每个点的经纬度
  const [extent, setExtent] = useState('');
  const getRectangle = () => {
    if (viewer === null) return;
    //获取四角经纬度
    // 获取当前视图范围
    let extent = viewer.camera.computeViewRectangle();
    if (!extent) return;

    // 提取四个角的经纬度
    let southwest = Cesium.Rectangle.southwest(extent);
    let southeast = Cesium.Rectangle.southeast(extent);
    let northeast = Cesium.Rectangle.northeast(extent);
    let northwest = Cesium.Rectangle.northwest(extent);

    setExtent(`
      西北角/左上角: ${Cesium.Math.toDegrees(northwest.longitude)}, ${Cesium.Math.toDegrees(northwest.latitude)}
      东北角/右上角: ${Cesium.Math.toDegrees(northeast.longitude)}, ${Cesium.Math.toDegrees(northeast.latitude)}
      东南角/右下角: ${Cesium.Math.toDegrees(southeast.longitude)}, ${Cesium.Math.toDegrees(southeast.latitude)}
      西南角/左下角: ${Cesium.Math.toDegrees(southwest.longitude)}, ${Cesium.Math.toDegrees(southwest.latitude)}
    `);

    // 根据当前视图四个方位每个角的经纬度, 如何获取这四个经纬度范围内的 geohash

    // 打印经纬度信息
    // console.log(
    //   '西南角/左下角:' +
    //     Cesium.Math.toDegrees(southwest.longitude) +
    //     ', ' +
    //     Cesium.Math.toDegrees(southwest.latitude),
    // );
    // console.log(
    //   '东南角/右下角:' +
    //     Cesium.Math.toDegrees(southeast.longitude) +
    //     ', ' +
    //     Cesium.Math.toDegrees(southeast.latitude),
    // );
    // console.log(
    //   '东北角/右上角:' +
    //     Cesium.Math.toDegrees(northeast.longitude) +
    //     ', ' +
    //     Cesium.Math.toDegrees(northeast.latitude),
    // );
    // console.log(
    //   '西北角:/左上角' +
    //     Cesium.Math.toDegrees(northwest.longitude) +
    //     ', ' +
    //     Cesium.Math.toDegrees(northwest.latitude),
    // );
  };

  // 获取当前地图的显示范围
  function getMapViewRectangle() {
    if (viewer === null) return null;
    const rectangle = viewer.camera.computeViewRectangle();
    if (rectangle) {
      return {
        west: Cesium.Math.toDegrees(rectangle.west),
        south: Cesium.Math.toDegrees(rectangle.south),
        east: Cesium.Math.toDegrees(rectangle.east),
        north: Cesium.Math.toDegrees(rectangle.north),
      };
    }
    return null;
  }

  // 将范围分成6个子区域，并计算每个子区域的 GeoHash
  function splitAndComputeGeohashes(rect: any, precision: number) {
    const { west, south, east, north } = rect;
    const lonStep = (east - west) / 3;
    const latStep = (north - south) / 2;

    const geohashes = [];

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        const subWest = west + i * lonStep;
        const subEast = subWest + lonStep;
        const subSouth = south + j * latStep;
        const subNorth = subSouth + latStep;

        const centerLat = (subSouth + subNorth) / 2;
        const centerLon = (subWest + subEast) / 2;

        // const geohash = ngeohash.encode(centerLat, centerLon, precision);
        const geohash = centerGeoHash(centerLat, centerLon, precision);
        geohashes.push({
          geohash,
          bounds: { subWest, subSouth, subEast, subNorth },
        });

        // 在 Cesium 中绘制子区域
        viewer?.entities.add({
          rectangle: {
            coordinates: Cesium.Rectangle.fromDegrees(subWest, subSouth, subEast, subNorth),
            material: Cesium.Color.RED.withAlpha(0.3),
            outline: true,
            outlineColor: Cesium.Color.BLACK,
          },
        });
      }
    }

    return geohashes;
  }

  const [subAreas, setSubAreas] = useState([] as any[]);
  const handleRange = () => {
    const viewRect = getMapViewRectangle();
    if (viewRect) {
      // 计算每个子区域的 GeoHash
      const geohashes = splitAndComputeGeohashes(viewRect, 5); // 精度可以根据需要调整
      setSubAreas(geohashes);
    }
  };

  // NOTE 清除所有实体
  const handleRemoveAll = () => {
    viewer?.entities.removeAll();
  };

  return (
    <>
      <Alert className="mb-2" message="空间点索引算法-GeoHash" type="success" />
      <ProCard>
        {contextHolder}
        {viewer === null && <Spin spinning={true} />}
        <div id="cesiumContainer" />
        <Button className="mt-2" onClick={() => handleRemoveAll()}>
          清除所有
        </Button>
        <div className="mt-2">
          <Button onClick={() => handleRange()}>视图范围内 geohash</Button>
          {subAreas.map((area, index) => (
            <span className="ml-2 text-red-600" key={index}>
              {area.geohash}
            </span>
          ))}
        </div>
        <div className="mt-2">
          <Button onClick={() => getRectangle()}>获取视图范围</Button>
          <div className="ml-4 text-red-600 text-success">{extent}</div>
        </div>
        <div className="mt-2">
          <InputNumber
            addonBefore={'精度'}
            className="mr-2 w-[120px]"
            min={1}
            max={10}
            value={precisions}
            defaultValue={precisions}
            onChange={inputNumberChange}
          />
          <Button onClick={() => handleCenterGeoHash()}>生成 GeoHash</Button>
          <span className="ml-4 text-red-600 text-success">{centerHash}</span>
        </div>
        <div className="mt-2">
          <Button onClick={() => getCenterPosition()}>获取中心点坐标</Button>
          <span className="ml-4 text-red-600 text-success">{centerPosition}</span>
        </div>
      </ProCard>
    </>
  );
};

export default InfoGeoHash;
