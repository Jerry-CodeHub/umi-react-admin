import { iconData } from '@/utils/MapCompute/dataEnd';
import { ProCard } from '@ant-design/pro-components';
import { Alert, Button, Modal, Spin, message } from 'antd';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useEffect, useState } from 'react';

const ThermalMap = () => {
  const [viewer, setViewer] = useState(null as any);
  const [messageApi, contextHolder] = message.useMessage();
  const [data, setData] = useState([] as any);
  const [thermalData, setThermalData] = useState(null as any); // 保存完整的热力图数据
  const [loading, setLoading] = useState(true);
  Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN as string;

  // 动态加载热力图数据
  useEffect(() => {
    const loadThermalData = async () => {
      try {
        const thermal = await import('@/utils/MapCompute/ThermalMapData.json');
        const obj = structuredClone(thermal.default);
        const arrayResult = obj.coverageData.arrayResult;
        setData(arrayResult);
        setThermalData(obj); // 保存完整数据供其他功能使用
        setLoading(false);
      } catch (error) {
        console.error('Failed to load thermal data:', error);
        messageApi.error('加载热力图数据失败');
        setLoading(false);
      }
    };

    loadThermalData();
  }, [messageApi]);

  // 初始化 Cesium Viewer
  useEffect(() => {
    // 等待 loading 完成且 DOM 已渲染
    if (loading || viewer) return;

    // 确保 cesiumContainer 元素存在
    const container = document.getElementById('cesiumContainer');
    if (!container) return;

    // 创建一个 Cesium Viewer 实例
    const newViewer = new Cesium.Viewer('cesiumContainer', {
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
    (newViewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';

    // 修改 homeButton 的位置
    let initView = {
      destination: Cesium.Cartesian3.fromDegrees(116.3974, 39.9093, 15000000),
    };
    // newViewer.camera.setView(initView);
    newViewer.camera.flyTo(initView);

    // 2, 添加一个点击事件来显示位置坐标：
    newViewer.screenSpaceEventHandler.setInputAction(function onLeftClick(movement: { position: Cesium.Cartesian2 }) {
      const cartesian = newViewer.camera.pickEllipsoid(movement.position, newViewer.scene.globe.ellipsoid);
      if (cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const longitudeString = Cesium.Math.toDegrees(cartographic.longitude).toFixed(2);
        const latitudeString = Cesium.Math.toDegrees(cartographic.latitude).toFixed(2);
        messageApi.info(`Longitude: ${longitudeString}, Latitude: ${latitudeString}`);
        // alert(`Longitude: ${longitudeString}, Latitude: ${latitudeString}`);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    setViewer(newViewer);

    setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      handleIcon(newViewer);
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      handleMouse(newViewer);
    }, 100);

    // 销毁
    return () => {
      if (newViewer && !newViewer.isDestroyed()) {
        newViewer.destroy();
      }
    };
  }, [loading, messageApi]);

  // NOTE 鼠标事件
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [positionInfo, setPositionInfo] = useState({} as any);
  const handleMouse = (viewer: any) => {
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    // 鼠标点击事件
    handler.setInputAction((movement: any) => {
      // 点击图标时触发
      let pickedObject = viewer.scene.pick(movement.position);

      if (Cesium.defined(pickedObject)) {
        // 1, 显示弹窗 (显示位置)
        let position = {
          x: movement.position.x,
          y: movement.position.y,
        };
        // 获取当前图标的经纬度信息
        if (!pickedObject.id || !pickedObject.id.label) {
          return;
        }
        let pickedPosition = pickedObject.id.position;
        let cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(pickedPosition._value);
        let lng = Cesium.Math.toDegrees(cartographic.longitude);
        let lat = Cesium.Math.toDegrees(cartographic.latitude);
        setPositionInfo(position);
        setIsModalOpen(true);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    let currentEntity = null as any;
    // 监听鼠标移入事件
    handler.setInputAction(function (movement: { endPosition: any }) {
      let pickedObject = viewer.scene.pick(movement.endPosition);
      if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.label && pickedObject.id.properties) {
        pickedObject.id.label.text = '更新后的标签' + pickedObject.id.properties.text._value;
        currentEntity = pickedObject.id;
      }

      if (!Cesium.defined(pickedObject) || !pickedObject.id) {
        if (currentEntity) {
          currentEntity.label.text = currentEntity.properties.text._value;
          currentEntity = null;
        }
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  };

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

  // NOTE 两个实体距离计算
  const handlePrimary = () => {
    if (!viewer) {
      messageApi.warning('地图还未初始化完成');
      return;
    }
    let box1 = iconData[0];
    let box2 = iconData[1];

    // box1 和 box2 连线
    // 创建一条线
    viewer.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray([box1.longitude, box1.latitude, box2.longitude, box2.latitude]),
        width: 3,
        material: Cesium.Color.RED,
      },
    });

    // 计算 box1 和 box2 的距离
    let distance = Cesium.Cartesian3.distance(
      Cesium.Cartesian3.fromDegrees(box1.longitude, box1.latitude),
      Cesium.Cartesian3.fromDegrees(box2.longitude, box2.latitude),
    );

    // 创建一个文本标签
    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(box1.longitude, box1.latitude),
      label: {
        text: `距离：${distance.toFixed(2)} 米`, // 文本内容
        font: '14px sans-serif', // 字体大小
        backgroundColor: Cesium.Color.fromCssColorString('#0094ff'), // 背景颜色
        showBackground: true, // 是否显示背景
        style: Cesium.LabelStyle.FILL_AND_OUTLINE, // 样式
        fillColor: Cesium.Color.WHITE, // 填充颜色
        outlineColor: Cesium.Color.BLACK, // 边框颜色
        outlineWidth: 2, // 边框宽度
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER, // 水平对齐方式
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM, // 垂直对齐方式
        pixelOffset: new Cesium.Cartesian2(0, -55), // 偏移量
        pixelOffsetScaleByDistance: new Cesium.NearFarScalar(1.5e2, 1.5, 8.0e6, 0.5), // 偏移量随距离变化
      },
    });
  };

  // NOTE 渲染热力图 (base64 图片数据)
  const handleClick = () => {
    setIsModalOpen(false);
    // 检查数据是否加载完成
    if (!thermalData) {
      messageApi.warning('热力图数据还未加载完成');
      return;
    }
    if (!viewer) {
      messageApi.warning('地图还未初始化完成');
      return;
    }

    // let longitude = 105.658203125;
    // let latitude = 40.658203125;
    let longitude = 106.65;
    let latitude = 29.69;

    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(longitude, latitude),
      // id: 'thermal',
      billboard: {
        image: require('@/assets/Detection.png'),
        scale: 0.3,
      },
      // label: {
      //   text: '热力图', // 文本内容
      //   font: '14px sans-serif', // 字体大小
      //   backgroundColor: Cesium.Color.fromCssColorString('#0094ff'), // 背景颜色
      //   showBackground: true, // 是否显示背景
      //   style: Cesium.LabelStyle.FILL_AND_OUTLINE, // 样式
      //   fillColor: Cesium.Color.WHITE, // 填充颜色
      //   outlineColor: Cesium.Color.BLACK, // 边框颜色
      //   outlineWidth: 2, // 边框宽度
      //   horizontalOrigin: Cesium.HorizontalOrigin.CENTER, // 水平对齐方式
      //   verticalOrigin: Cesium.VerticalOrigin.BOTTOM, // 垂直对齐方式
      //   pixelOffset: new Cesium.Cartesian2(0, 55), // 偏移量
      //   pixelOffsetScaleByDistance: new Cesium.NearFarScalar(1.5e2, 1.5, 8.0e6, 0.5), // 偏移量随距离变化
      // },
    });

    // 开始处理 base64 图片数据
    let base64Image = 'data:image/png;base64,' + thermalData.diagramPngStream; // base64 图片数据

    // 将 Base64 数据转换为 Blob 对象
    function base64ToBlob(base64: any, mime: any) {
      // eslint-disable-next-line no-param-reassign
      mime = mime || ''; // 如果 mime 类型为空，默认为 image/png
      let sliceSize = 1024; // 以 1024 字节为一个单位
      let byteChars = atob(base64.split(',')[1]); // base64 数据
      let byteArrays = []; // 存储生成的 Blob 对象

      // 将 base64 数据转换为二进制数据
      for (let offset = 0; offset < byteChars.length; offset += sliceSize) {
        let slice = byteChars.slice(offset, offset + sliceSize); // 从 base64 数据中截取一部分
        let byteNumbers = new Array(slice.length); // 存储转换后的二进制数据

        // 将 base64 数据转换为二进制数据
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i); // 获取每个字符的 Unicode 编码
        }
        let byteArray = new Uint8Array(byteNumbers); // 转换为二进制数据
        byteArrays.push(byteArray); // 存储二进制数据
      }

      return new Blob(byteArrays, { type: mime }); // 生成 Blob 对象
    }

    // 创建一个 Blob URL
    let blob = base64ToBlob(base64Image, 'image/png');
    let url = URL.createObjectURL(blob); // 生成一个临时的 URL

    // 创建一个 HTMLImageElement
    let img = new Image(); // 创建一个图像对象
    img.src = url; // 设置图像的 URL

    // 图像加载完成后的回调函数
    img.onload = function () {
      // 当图像加载完成后，将其应用为纹理
      let entity = viewer.entities.add({
        name: 'Heatmap', // 实体的名称
        rectangle: {
          // coordinates: Cesium.Rectangle.fromDegrees(-100.0, 20.0, -90.0, 30.0), // 矩形的坐标
          coordinates: Cesium.Rectangle.fromDegrees(longitude - 0.1, latitude - 0.1, longitude + 0.1, latitude + 0.1),
          material: new Cesium.ImageMaterialProperty({
            image: img, // 图像对象
            transparent: true, // 是否透明
          }),
        },
      });
      // 调整视角以查看热力图
      viewer.zoomTo(entity);
    };
  };

  // NOTE 渲染热力图 (点云效果)
  const handleClick2 = () => {
    if (!viewer) {
      messageApi.warning('地图还未初始化完成');
      return;
    }
    const dataPoints = data.flat();

    function getColorForStrength(value: any) {
      if (value <= 25) return Cesium.Color.BLUE.withAlpha(0.5); // 蓝色
      if (value <= 40) return Cesium.Color.GREEN.withAlpha(0.5); // 绿色
      if (value <= 75) return Cesium.Color.YELLOW.withAlpha(0.5); // 黄色
      if (value <= 100) return Cesium.Color.RED.withAlpha(0.5); // 红色
      return Cesium.Color.RED.withAlpha(0.5);
    }

    dataPoints.forEach((point: any) => {
      // 聚合
      viewer.entities.cluster = {
        enabled: true, // 是否启用聚合
        pixelRange: 50, // 聚合像素范围
        minimumClusterSize: 10, // 最小聚合大小
        clusterBillboards: true, // 是否聚合图标
        clusterLabels: true, // 是否聚合标签
        clusterPoints: true, // 是否聚合点
      };
      let entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude),
        name: point.fieldStrength, // 实体的名称
        point: {
          pixelSize: 5, // 像素大小
          color: getColorForStrength(point.fieldStrength),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, // 高度参考
        },
      });
      entity.properties = {
        fieldStrength: point.fieldStrength,
      };
    });
    let infoDiv = document.createElement('div');
    document.body.appendChild(infoDiv);
    infoDiv.style.position = 'absolute';
    infoDiv.style.background = 'white';
    infoDiv.style.padding = '5px';
    infoDiv.style.display = 'none';

    // 鼠标放到点上时根据点的名称显示信息
    viewer.screenSpaceEventHandler.setInputAction(function onMouseMove(movement: any) {
      let pickedObject = viewer.scene.pick(movement.endPosition);
      if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id) && pickedObject.id.properties.fieldStrength) {
        let name = pickedObject.id.name;

        infoDiv.style.display = 'block';
        infoDiv.style.left = movement.endPosition.x + 10 + 'px';
        infoDiv.style.top = movement.endPosition.y + 10 + 'px';
        infoDiv.textContent = name;
      } else {
        infoDiv.style.display = 'none';
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    viewer.zoomTo(viewer.entities);
  };

  // NOTE 绘制底部点
  const handlerBottomPoint = (dataPoints: any) => {
    // 第一个点和最后一个点存储
    let topPoint = [];
    let bottomPoint = [] as any[];
    dataPoints.forEach((item: any) => {
      let positions = [] as any[];
      // 每次
      item.forEach((point: any) => {
        let cartesian = Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude); // 经纬度转笛卡尔坐标
        positions.push(cartesian);
      });
      topPoint.push(positions[0]);
      bottomPoint.push(positions[positions.length - 1]);
    });

    // 连接 bottomPoint 中的每个点
    if (bottomPoint.length > 1) {
      viewer.entities.add({
        polyline: {
          positions: bottomPoint,
          width: 2,
          material: Cesium.Color.RED,
        },
      });
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleClick3 = () => {
    // 热力图要绘制的区域的经纬度范围
    // let longitude = 106.65;
    // let latitude = 29.69;

    // let dataPoints1 = data.flat();
    handlerBottomPoint(data); // 绘制底部点
  };

  // NOTE 清楚所有地图数据
  const handleClear = () => {
    if (!viewer) {
      messageApi.warning('地图还未初始化完成');
      return;
    }
    viewer.dataSources.removeAll();
    viewer.entities.removeAll();
  };

  return (
    <>
      <Alert message="热力图" type="success" showIcon className="mb-2" />
      <ProCard>
        {contextHolder}
        {loading && (
          <div className="flex items-center justify-center p-10">
            <Spin tip="正在加载热力图数据..." size="large" />
          </div>
        )}
        {!loading && (
          <>
            <Button className="mb-2" onClick={() => handlePrimary()}>
              距离计算
            </Button>
            <Button className="mb-2 ml-2" onClick={() => handleClick()}>
              渲染热力图数据 base64
            </Button>
            <Button className="mb-2 ml-2" onClick={() => handleClick2()}>
              渲染点云效果
            </Button>
            {/* <Button className="mb-2 ml-2" onClick={() => handleClick3()}>
          渲染热力图数据2
        </Button> */}
            <Button className="mb-2 ml-2" onClick={() => handleClear()}>
              清除地图数据
            </Button>
            {/* <div id="cesiumContainer" style={{ width: '100%', height: '100vh' }} /> */}
            <div id="cesiumContainer" />
            <Modal
              title=""
              open={isModalOpen}
              style={{ top: positionInfo.y + 100, left: positionInfo.x - 300 }}
              onCancel={() => setIsModalOpen(false)}
              footer={null}
              width={300}
            >
              <Button onClick={() => handleClick()}>渲染热力图数据</Button>
            </Modal>
          </>
        )}
      </ProCard>
    </>
  );
};

export default ThermalMap;
