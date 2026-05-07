// src/MapComponent.js
import { ProCard } from '@ant-design/pro-card';
// import { Map, View } from 'ol';
// import TileLayer from 'ol/layer/Tile';
import 'ol/ol.css';
// import OSM from 'ol/source/OSM';
import { Button, message } from 'antd';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import { fromLonLat, toLonLat } from 'ol/proj';
import OSM from 'ol/source/OSM';
import { useEffect, useState } from 'react';

const InfoMap = () => {
  const [map, setMap] = useState(null as Map | null);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    const map = new Map({
      target: 'map', // 指定 DOM 元素
      // 设置图层
      layers: [
        new TileLayer({
          source: new OSM(), // // 使用 OpenStreetMap 图层
        }),
      ],
      // 设置视图和中心点/缩放级别
      view: new View({
        center: fromLonLat([0, 0]), // // 地图中心
        zoom: 2, // // 缩放级别
        projection: 'EPSG:3857', // 默认投影
      }),
    });

    // 点击事件
    map.on('click', (e) => {
      const lonLat = toLonLat(e.coordinate);
      messageApi.info(`经度：${lonLat[0]}，纬度：${lonLat[1]}`);
    });

    setMap(map);

    return () => map.setTarget(undefined); // 清理 map 对象
  }, []);

  const handleClick = () => {
    map?.getView().animate({
      center: fromLonLat([0, 0]),
      zoom: 2,
    });
  };

  return (
    <>
      <ProCard>
        {contextHolder}
        <Button className="mb-2" onClick={() => handleClick()}>
          click
        </Button>
        <div id="map" style={{ width: '100%', height: '100vh' }} />
      </ProCard>
    </>
  );
};

export default InfoMap;
