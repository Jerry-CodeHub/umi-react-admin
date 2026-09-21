import { CesiumInitError, createDemoViewer } from '@/components/CesiumViewer';
import { iconData } from '@/utils/MapCompute/dataEnd';
import { loadThermalMapData, type ThermalData, type ThermalPoint } from '@/utils/MapCompute/loadThermalMapData';
import { setupCesium } from '@/utils/MapCompute/setupCesium';
import { ProCard } from '@ant-design/pro-components';
import { Alert, Button, message, Modal, Spin } from 'antd';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useEffect, useRef, useState } from 'react';

setupCesium(Cesium);

type ModalPosition = {
  x?: number;
  y?: number;
};

const ThermalMap = () => {
  const [viewer, setViewer] = useState<Cesium.Viewer | null>(null);
  const infoDivRef = useRef<HTMLDivElement | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const [data, setData] = useState<ThermalPoint[][]>([]);
  const [loading, setLoading] = useState(false);
  const [initError, setInitError] = useState(false);
  // 独立于 viewer 的交互处理器（销毁需手动，viewer.destroy 不代劳外部 handler）
  const interactionHandlerRef = useRef<Cesium.ScreenSpaceEventHandler | null>(null);
  // 点云 Primitive 引用（重复渲染/清除时复用）
  const pointsRef = useRef<Cesium.PointPrimitiveCollection | null>(null);
  // 数据按需加载：首次使用时才拉取（约 1MB JSON），Promise 缓存避免重复请求
  const dataPromiseRef = useRef<Promise<ThermalData> | null>(null);
  const ensureData = () => {
    if (!dataPromiseRef.current) {
      setLoading(true);
      dataPromiseRef.current = loadThermalMapData()
        .then((obj) => {
          setData(obj.coverageData.arrayResult);
          return obj;
        })
        .catch((error) => {
          dataPromiseRef.current = null; // 失败允许重试
          console.error('Failed to load thermal data:', error);
          messageApi.error('加载热力图数据失败');
          throw error;
        })
        .finally(() => {
          setLoading(false);
        });
    }
    return dataPromiseRef.current;
  };

  /**
   * 供按钮回调使用：加载失败时已在 ensureData 内提示，这里吞掉 rejection（避免 unhandled）；
   * 等待数据期间若组件已卸载、viewer 已销毁，则放弃后续绘制。
   */
  const loadDataFor = async (target: Cesium.Viewer) => {
    try {
      const loaded = await ensureData();
      return target.isDestroyed() ? null : loaded;
    } catch {
      return null;
    }
  };

  // 初始化 Cesium Viewer（立即初始化不等待数据；数据在首次使用时按需加载）
  useEffect(() => {
    // 确保 Cesium 容器元素存在
    const container = document.getElementById('cesium-container');
    if (!container) return;

    // 创建一个 Cesium Viewer 实例（WebGL 不可用等初始化失败时给出可见兜底而非整页空白）
    // 通用控件配置与初始化失败兜底见 @/components/CesiumViewer
    const newViewer = createDemoViewer('cesium-container', { baseLayerPicker: false });
    if (!newViewer) {
      setInitError(true);
      return;
    }

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

    const initTimer = window.setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      handleIcon(newViewer);
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      handleMouse(newViewer);
    }, 100);

    // 销毁
    return () => {
      window.clearTimeout(initTimer);
      if (interactionHandlerRef.current) {
        interactionHandlerRef.current.destroy();
        interactionHandlerRef.current = null;
      }
      pointsRef.current = null; // primitive 随 viewer.destroy 一并销毁
      if (newViewer && !newViewer.isDestroyed()) {
        newViewer.destroy();
      }
      if (infoDivRef.current) {
        document.body.removeChild(infoDivRef.current);
        infoDivRef.current = null;
      }
    };
  }, [messageApi]);

  // NOTE 鼠标事件
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [positionInfo, setPositionInfo] = useState<ModalPosition>({});
  const handleMouse = (viewer: Cesium.Viewer) => {
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    interactionHandlerRef.current = handler;
    // 鼠标点击事件
    handler.setInputAction((movement: { position: Cesium.Cartesian2 }) => {
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
        setPositionInfo(position);
        setIsModalOpen(true);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    let currentEntity: Cesium.Entity | null = null;
    // 监听鼠标移入事件
    handler.setInputAction(function (movement: Cesium.ScreenSpaceEventHandler.MotionEvent) {
      let pickedObject = viewer.scene.pick(movement.endPosition);
      if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.label && pickedObject.id.properties) {
        const properties = pickedObject.id.properties.getValue(Cesium.JulianDate.now()) as { text?: string };
        pickedObject.id.label.text = new Cesium.ConstantProperty(`更新后的标签${properties.text ?? ''}`);
        currentEntity = pickedObject.id;
      }

      if (!Cesium.defined(pickedObject) || !pickedObject.id) {
        if (currentEntity) {
          const properties = currentEntity.properties?.getValue(Cesium.JulianDate.now()) as
            | { text?: string }
            | undefined;
          if (currentEntity.label) {
            currentEntity.label.text = new Cesium.ConstantProperty(properties?.text ?? '');
          }
          currentEntity = null;
        }
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  };

  // NOTE 添加图标
  const handleIcon = (viewer: Cesium.Viewer) => {
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
      entity.properties = new Cesium.PropertyBag({
        text: item.label,
      });
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
  const handleClick = async () => {
    setIsModalOpen(false);
    if (!viewer) {
      messageApi.warning('地图还未初始化完成');
      return;
    }
    // 数据按需加载（首次点击时拉取，后续走缓存）
    const loaded = await loadDataFor(viewer);
    if (!loaded) return;

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
    let base64Image = 'data:image/png;base64,' + loaded.diagramPngStream; // base64 图片数据

    // 将 Base64 数据转换为 Blob 对象
    function base64ToBlob(base64: string, mime = '') {
      // eslint-disable-next-line no-param-reassign
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
      // 组件已卸载/viewer 已销毁时放弃写入（卸载竞态守卫）
      if (viewer.isDestroyed()) {
        URL.revokeObjectURL(url);
        return;
      }
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
      // 释放临时 Blob URL（此前从不 revoke，反复渲染持续占用内存）
      URL.revokeObjectURL(url);
    };
  };

  // NOTE 渲染热力图 (点云效果)
  // PointPrimitiveCollection 批量渲染：Entity API 每实体一个 ViewModel，数千点即可冻结主线程；
  // Primitive 批量路径可支撑 10 万级点（审计 perf-2）。
  // 注：原代码对 viewer.entities.cluster 的逐点赋值是无效属性写入（EntityCollection 无该属性，
  // 聚合从未生效），已整体删除；如需聚合应使用 dataSource.clustering 另行实现。
  const handleClick2 = async () => {
    if (!viewer) {
      messageApi.warning('地图还未初始化完成');
      return;
    }
    const loaded = await loadDataFor(viewer);
    if (!loaded) return;
    const dataPoints = loaded.coverageData.arrayResult.flat();

    function getColorForStrength(value: number) {
      if (value <= 25) return Cesium.Color.BLUE.withAlpha(0.5); // 蓝色
      if (value <= 40) return Cesium.Color.GREEN.withAlpha(0.5); // 绿色
      if (value <= 75) return Cesium.Color.YELLOW.withAlpha(0.5); // 黄色
      if (value <= 100) return Cesium.Color.RED.withAlpha(0.5); // 红色
      return Cesium.Color.RED.withAlpha(0.5);
    }

    // 重复渲染先清空旧点云
    if (pointsRef.current) {
      pointsRef.current.removeAll();
    }
    const points = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());
    pointsRef.current = points;
    dataPoints.forEach((point) => {
      points.add({
        position: Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude),
        pixelSize: 5, // 像素大小
        color: getColorForStrength(point.fieldStrength),
        // id 直接挂原始数据点：scene.pick 返回的 picked.id 即该点，悬停读取无需 PropertyBag
        id: point,
      });
    });
    if (!infoDivRef.current) {
      const infoDiv = document.createElement('div');
      infoDiv.style.position = 'absolute';
      infoDiv.style.background = 'white';
      infoDiv.style.padding = '5px';
      infoDiv.style.display = 'none';
      document.body.appendChild(infoDiv);
      infoDivRef.current = infoDiv;
    }
    const infoDiv = infoDivRef.current;

    // 鼠标放到点上时显示场强（Primitive pick 语义：picked.id 即我们挂载的原始数据点）
    viewer.screenSpaceEventHandler.setInputAction(function onMouseMove(
      movement: Cesium.ScreenSpaceEventHandler.MotionEvent,
    ) {
      const pickedObject = viewer.scene.pick(movement.endPosition);
      const hit =
        Cesium.defined(pickedObject) && pickedObject.id && typeof pickedObject.id.fieldStrength === 'number'
          ? pickedObject.id
          : null;
      if (hit) {
        infoDiv.style.display = 'block';
        infoDiv.style.left = movement.endPosition.x + 10 + 'px';
        infoDiv.style.top = movement.endPosition.y + 10 + 'px';
        infoDiv.textContent = `场强: ${hit.fieldStrength}`;
      } else {
        infoDiv.style.display = 'none';
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // Primitive 不走 viewer.zoomTo(entities)，按数据包围盒飞视野
    let minLon = Infinity,
      maxLon = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;
    dataPoints.forEach((p) => {
      minLon = Math.min(minLon, p.longitude);
      maxLon = Math.max(maxLon, p.longitude);
      minLat = Math.min(minLat, p.latitude);
      maxLat = Math.max(maxLat, p.latitude);
    });
    viewer.camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(minLon, minLat, maxLon, maxLat),
      duration: 1.5,
    });
  };

  // NOTE 绘制底部点
  const handlerBottomPoint = (dataPoints: ThermalPoint[][]) => {
    if (!viewer) return;

    // 第一个点和最后一个点存储
    let topPoint = [];
    let bottomPoint: Cesium.Cartesian3[] = [];
    dataPoints.forEach((item) => {
      let positions: Cesium.Cartesian3[] = [];
      // 每次
      item.forEach((point) => {
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
    if (pointsRef.current) {
      pointsRef.current.removeAll();
    }
  };

  return (
    <>
      <Alert message="热力图" type="success" showIcon className="mb-2" />
      <ProCard>
        {contextHolder}
        {initError ? (
          <CesiumInitError />
        ) : (
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
            {/* <div id="cesium-container" style={{ width: '100%', height: '100vh' }} /> */}
            {loading && (
              <div className="flex items-center justify-center p-6">
                <Spin tip="正在加载热力图数据..." size="large" />
              </div>
            )}
            <div id="cesium-container" />
            <Modal
              title=""
              open={isModalOpen}
              style={{
                top: Math.min((positionInfo.y ?? 0) + 100, window.innerHeight - 200),
                left: Math.max(Math.min((positionInfo.x ?? 0) - 300, window.innerWidth - 320), 8),
              }}
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
