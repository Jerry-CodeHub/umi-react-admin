import { DEVICE_STATUS_CSS as STATUS_CSS } from '@/constants/semantic';
import type { Device } from '@/services/types';
import * as Cesium from 'cesium';

export { STATUS_CSS };

/**
 * 把监测站画成点图元（PointPrimitiveCollection 批量渲染，几百上千个点也不卡）。
 * 每个点的 id 挂设备记录本身，scene.pick 返回的 picked.id 即设备。
 */
export const addStationPoints = (viewer: Cesium.Viewer, devices: Device[], pixelSize = 7) => {
  const points = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection()) as Cesium.PointPrimitiveCollection;
  devices.forEach((device) =>
    points.add({
      id: device,
      position: Cesium.Cartesian3.fromDegrees(device.lng, device.lat),
      pixelSize,
      color: Cesium.Color.fromCssColorString(STATUS_CSS[device.status]),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 1,
    }),
  );
  return points;
};

/** 读取屏幕坐标下的设备（未命中返回 undefined） */
export const pickDevice = (viewer: Cesium.Viewer, position: Cesium.Cartesian2): Device | undefined => {
  const picked = viewer.scene.pick(position);
  const id = picked?.id as Partial<Device> | undefined;
  return id && typeof id.lng === 'number' && typeof id.status === 'string' ? (id as Device) : undefined;
};

/** 屏幕坐标 → 经纬度（没点到地球返回 undefined） */
export const pickLngLat = (viewer: Cesium.Viewer, position: Cesium.Cartesian2): [number, number] | undefined => {
  const cartesian = viewer.camera.pickEllipsoid(position, viewer.scene.globe.ellipsoid);
  if (!cartesian) return undefined;
  const c = Cesium.Cartographic.fromCartesian(cartesian);
  return [Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude)];
};
