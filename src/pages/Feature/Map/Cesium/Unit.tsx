import { getEntitiesInRectangle } from '@/utils/MapCompute/cesiumCompute';
import { iconData } from '@/utils/MapCompute/dataEnd';
import { GatewayOutlined } from '@ant-design/icons';
import { ProCard } from '@ant-design/pro-components';
import { Button, message } from 'antd';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useEffect, useRef, useState } from 'react';

const Unit = () => {
  const [messageApi, contextHolder] = message.useMessage();
  const [viewer, setViewer] = useState(null as any);
  const draggingEntityRef = useRef(null); // 正在拖拽的实体

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

  // NOTE 添加鼠标事件
  const handleAddDrag = (viewer: any) => {
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    let isDragging = false; // 是否正在拖拽

    // 鼠标左键按下事件
    handler.setInputAction((movement: any) => {
      // 检查鼠标点击到的对象是否为目标实体
      const pickedObject = viewer.scene.pick(movement.position);
      if (Cesium.defined(pickedObject) && pickedObject.id) {
        isDragging = true;
        draggingEntityRef.current = pickedObject.id;
        viewer.scene.screenSpaceCameraController.enableRotate = false; // 禁止地图旋转

        // 获取当前实体的经纬度坐标
        const position = pickedObject.id.position.getValue(Cesium.JulianDate.now());
        const cartographic = Cesium.Cartographic.fromCartesian(position);
        const longitude = Cesium.Math.toDegrees(cartographic.longitude);
        const latitude = Cesium.Math.toDegrees(cartographic.latitude);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

    // 鼠标左键释放事件
    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      if (isDragging && draggingEntityRef.current) {
        // 获取鼠标的地理位置
        const cartesian = viewer.camera.pickEllipsoid(movement.endPosition, viewer.scene.globe.ellipsoid);
        if (cartesian) {
          // 将地理位置转换为经纬度
          const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
          const newLongitude = Cesium.Math.toDegrees(cartographic.longitude);
          const newLatitude = Cesium.Math.toDegrees(cartographic.latitude);

          // 更新实体位置
          (draggingEntityRef.current as any).position = new Cesium.ConstantPositionProperty(
            Cesium.Cartesian3.fromDegrees(newLongitude, newLatitude),
          );
        }
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // 鼠标左键抬起事件
    handler.setInputAction(() => {
      if (isDragging) {
        isDragging = false; // 结束拖拽
        draggingEntityRef.current = null; // 清空拖拽实体
        viewer.scene.screenSpaceCameraController.enableRotate = true; // 恢复地图旋转
      }
    }, Cesium.ScreenSpaceEventType.LEFT_UP);
  };

  // NOTE 初始化 Cesium
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
    // 1, 去除版权信息
    (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';

    // 修改 homeButton 的位置
    let initView = {
      destination: Cesium.Cartesian3.fromDegrees(116.3974, 39.9093, 15000000),
    };
    // viewer.camera.setView(initView);
    viewer.camera.flyTo(initView);

    setViewer(viewer);
    handleAddDrag(viewer);

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

    setTimeout(() => {
      handleIcon(viewer);
    }, 100);

    // 销毁 Cesium
    return () => {
      if (!viewer.isDestroyed()) viewer.destroy();
    };
  }, []);

  // NOTE 绘制矩形区域
  const handlerRef = useRef() as any;
  const FnSquareRegion = () => {
    viewer.cesiumWidget._element.style.cursor = 'crosshair'; // 光标变为十字
    let drawingMode = false;
    let firstPoint: any; // 第一个点
    let rectangleEntity: any; // 矩形实体
    handlerRef.current = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
    let lastUpdate = Date.now();
    const updateInterval = 100; // 更新间隔（毫秒）

    // 监听点击事件以绘制正方形
    handlerRef.current.setInputAction((click: any) => {
      // 获取点击位置的经纬度坐标
      const earthPosition = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
      if (!earthPosition) return;

      if (!drawingMode) {
        // 开始绘制
        drawingMode = true;
        // 记录第一个点
        firstPoint = Cesium.Cartographic.fromCartesian(earthPosition);

        // 创建矩形实体
        rectangleEntity = viewer.entities.add({
          rectangle: {
            coordinates: new Cesium.CallbackProperty(() => {
              if (firstPoint && drawingMode) {
                const rectangle = Cesium.Rectangle.fromCartographicArray([firstPoint, firstPoint]);
                return rectangle;
              }
            }, false), // 计算属性
            material: Cesium.Color.YELLOW.withAlpha(0.2), // 材质
            outline: true, // 是否显示轮廓
            outlineColor: Cesium.Color.YELLOW, // 轮廓颜色
            outlineWidth: 2, // 轮廓宽度
            height: 0, // 高度
          },
        });
      } else {
        // 结束绘制
        viewer.cesiumWidget._element.style.cursor = ''; // 光标恢复
        drawingMode = false;
        // 计算第二个点
        rectangleEntity.rectangle.coordinates = Cesium.Rectangle.fromCartographicArray([
          firstPoint,
          Cesium.Cartographic.fromCartesian(earthPosition),
        ]);
        rectangleEntity.rectangle.material = Cesium.Color.BLACK.withAlpha(0.2); // 黑色
        rectangleEntity.rectangle.outlineColor = Cesium.Color.BLACK; // 黑色

        // 获取矩形的坐标
        const rectangle = rectangleEntity.rectangle.coordinates.getValue(); // 获取矩形坐标
        const west = Cesium.Math.toDegrees(rectangle.west); // 转换为经度
        const south = Cesium.Math.toDegrees(rectangle.south); // 转换为纬度
        const east = Cesium.Math.toDegrees(rectangle.east); // 转换为经度
        const north = Cesium.Math.toDegrees(rectangle.north); // 转换为纬度
        messageApi.success(`${west},${south},${east},${north}`);
        // 获取矩形四个角的经纬度坐标
        const southwest = new Cesium.Cartographic(rectangle.west, rectangle.south); // 西南角, 左下角
        const northwest = new Cesium.Cartographic(rectangle.west, rectangle.north); // 西北角, 左上角
        const northeast = new Cesium.Cartographic(rectangle.east, rectangle.north); // 东北角, 右上角
        const southeast = new Cesium.Cartographic(rectangle.east, rectangle.south); // 东南角, 右下角
        // console.log('矩形四个角的经纬度坐标', southwest, northwest, northeast, southeast);

        const entitiesInside = getEntitiesInRectangle(viewer, rectangle);

        // 销毁事件
        handlerRef.current.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
        handlerRef.current.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // 监听鼠标移动
    handlerRef.current.setInputAction((movement: any) => {
      // 如果正在绘制并且有第一个点，并且距离上次更新时间大于间隔时间，则更新
      if (drawingMode && firstPoint && Date.now() - lastUpdate > updateInterval) {
        lastUpdate = Date.now(); // 更新时间
        const endPosition = viewer.camera.pickEllipsoid(movement.endPosition, viewer.scene.globe.ellipsoid); // 获取鼠标位置的笛卡尔坐标
        if (!endPosition) return;

        const endPoint = Cesium.Cartographic.fromCartesian(endPosition); // 转换为经纬度坐标
        rectangleEntity.rectangle.coordinates = Cesium.Rectangle.fromCartographicArray([firstPoint, endPoint]); // 更新矩形坐标
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  };

  // NOTE 获取实体数据
  const handlePull = () => {
    const entities = viewer.entities.values;
    entities.forEach((entity: any) => {
      // 获取实体经纬度坐标
      const position = entity.position.getValue(Cesium.JulianDate.now()); // 获取实体位置
      const cartographic = Cesium.Cartographic.fromCartesian(position); // 转换为经纬度坐标
      const longitude = Cesium.Math.toDegrees(cartographic.longitude); // 转换为经度
      const latitude = Cesium.Math.toDegrees(cartographic.latitude); // 转换为纬度

      // entity.properties._name._value // 获取实体添加的名称/信息
    });
  };

  return (
    <>
      {contextHolder}
      <ProCard>
        <div id="cesiumContainer" className="relative" />
        <div className="absolute z-10 flex flex-col items-center justify-center rounded-full top-16 right-8">
          <Button className="w-8 h-8 p-0" onClick={() => FnSquareRegion()}>
            <GatewayOutlined className="text-lg text-center align-middle text-sky-400 hover:text-sky-400 " />
          </Button>
        </div>
        <Button onClick={() => handlePull()} className="mt-2">
          获取实体数据
        </Button>
      </ProCard>
    </>
  );
};

export default Unit;
