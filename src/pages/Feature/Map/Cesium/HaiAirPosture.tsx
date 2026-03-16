import { iconData } from '@/utils/MapCompute/dataEnd';
import { ProCard } from '@ant-design/pro-components';
import { Button, message } from 'antd';
import * as Cesium from 'cesium';
import CesiumNavigation from 'cesium-navigation-es6';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useEffect, useState } from 'react';

const HaiAirPosture = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [viewer, setViewer] = useState(null as any);
  const [messageApi, contextHolder] = message.useMessage();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [data, setData] = useState([]);
  // setTimeout(() => {
  //   let CesiumNavigation = window.CesiumNavigation;
  //   console.log('CesiumNavigation:', window);

  // }, 1000);

  // NOTE 添加图标
  const handleIcon = (viewer: any) => {
    iconData.forEach((item) => {
      let entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(item.longitude, item.latitude),
        id: item.id,
        billboard: {
          image: require('@/assets/Detection.png'),
          // width: 40,
          // height: 40,
          scale: 0.3,
        },
        label: {
          text: item.label, // 文本内容
          font: '14px sans-serif', // 字体大小
          backgroundColor: Cesium.Color.fromCssColorString('#0094ff'), // 背景颜色
          showBackground: true, // 是否显示背景
          style: Cesium.LabelStyle.FILL_AND_OUTLINE, // 样式
          fillColor: Cesium.Color.WHITE, // 填充颜色
          outlineColor: Cesium.Color.BLACK, // 边框颜色
          outlineWidth: 2, // 边框宽度
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER, // 水平对齐方式
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM, // 垂直对齐方式
          pixelOffset: new Cesium.Cartesian2(0, 55), // 偏移量
          pixelOffsetScaleByDistance: new Cesium.NearFarScalar(1.5e2, 1.5, 8.0e6, 0.5), // 偏移量随距离变化
        },
      });
      // 额外参数
      entity.properties = {
        text: item.label,
      };
    });
  };

  // NOTE 添加线
  const handlePolyline = (viewer: any) => {
    let data: any = [
      {
        longitude: 117.33,
        latitude: 37.52,
      },
      {
        longitude: 129.34,
        latitude: 39.02,
      },
      {
        longitude: 126.47,
        latitude: 29.75,
      },
      {
        longitude: 116.72,
        latitude: 29.54,
      },
    ];

    data.push({ longitude: data[0].longitude, latitude: data[0].latitude });

    viewer.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray(data.flatMap((item: any) => [item.longitude, item.latitude])),
        width: 2,
        material: Cesium.Color.RED,
      },
    });
  };

  useEffect(() => {
    // 创建一个 Cesium Viewer 实例
    const viewer = new Cesium.Viewer('cesiumContainer', {
      // 去除所有的控件
      animation: false, // 是否显示动画控件
      baseLayerPicker: false, // 是否显示图层选择控件
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
      // sceneMode: Cesium.SceneMode.SCENE2D, // 2D 模式
    });

    // 初始化导航插件
    const options = {
      enableCompass: true,
      enableZoomControls: true,
      enableDistanceLegend: true,
      enableCompassOuterRing: true,
    };
    new CesiumNavigation(viewer, options);

    // 1, 去除版权信息
    (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';

    // 修改 homeButton 的位置
    let initView = {
      destination: Cesium.Cartesian3.fromDegrees(116.3974, 39.9093, 15000000),
    };
    // viewer.camera.setView(initView);
    viewer.camera.flyTo(initView);

    // 动态加载热力图数据
    import('@/utils/MapCompute/ThermalMapData.json').then((thermal) => {
      const obj = JSON.parse(JSON.stringify(thermal.default));
      const arrayResult = obj.coverageData.arrayResult;
      setData(arrayResult);
    });

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

    setViewer(viewer);

    handleIcon(viewer);
    handlePolyline(viewer);

    // 销毁
    return () => {
      if (!viewer.isDestroyed()) viewer.destroy();
    };
  }, []);

  const handleLonLat = () => {
    function convertDMSToDD(dmsStr: string) {
      try {
        // 移除空格,保留数字、正负号和度分秒符号
        const cleanStr = dmsStr.trim();

        // 获取正负号
        const sign = cleanStr.startsWith('-') ? -1 : 1;

        // 提取数字部分
        const matches = cleanStr.match(/([+-]?\d+)˚(\d+)'(\d+)''/);
        if (!matches) {
          console.error('Invalid DMS format:', dmsStr);
          return null;
        }

        // 解析度分秒
        const degrees = parseFloat(matches[1]);
        const minutes = parseFloat(matches[2]);
        const seconds = parseFloat(matches[3]);

        // 转换为十进制度数
        const decimal = sign * (Math.abs(degrees) + minutes / 60 + seconds / 3600);

        return decimal;
      } catch (error) {
        console.error('Conversion error:', error);
        return null;
      }
    }

    let longitude = "+115˚12'266''";
    let latitude = "-29˚33'123''";

    const lonDD = convertDMSToDD(longitude);
    const latDD = convertDMSToDD(latitude);

    // 确保坐标有效再创建位置
    if (lonDD !== null && latDD !== null && !isNaN(lonDD) && !isNaN(latDD)) {
      const position = Cesium.Cartesian3.fromDegrees(lonDD, latDD);

      viewer.entities.add({
        position: position,
        billboard: {
          image: require('@/assets/Detection.png'),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          scale: 0.6,
        },
      });
    } else {
      console.error('Invalid coordinates calculated');
    }
  };

  return (
    <>
      <ProCard>
        {contextHolder}
        <Button className="mb-2" onClick={() => handleLonLat()}>
          经纬度
        </Button>
        <div id="cesiumContainer" />
      </ProCard>
    </>
  );
};

export default HaiAirPosture;
