/** 地球平均半径（km，IUGG） */
const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * 从起点按方位角（度，正北为 0、顺时针）与距离（km）求终点（球面大圆公式）。
 * 替代此前的平面近似：旧实现把方位 0 当作正东、且没有按纬度缩放经度，算出的包络与实测经纬度对不上。
 */
export const destination = (lng: number, lat: number, bearingDeg: number, distanceKm: number): [number, number] => {
  const φ1 = toRad(lat);
  const λ1 = toRad(lng);
  const θ = toRad(bearingDeg);
  const δ = distanceKm / EARTH_RADIUS_KM;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return [((toDeg(λ2) + 540) % 360) - 180, toDeg(φ2)];
};

/** 两点间大圆距离（km，haversine） */
export const distanceKm = (a: [number, number], b: [number, number]) => {
  const φ1 = toRad(a[1]);
  const φ2 = toRad(b[1]);
  const Δφ = φ2 - φ1;
  const Δλ = toRad(b[0] - a[0]);
  const h = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
};

/** 围绕起点每隔 step 度取一个等距点，形成近似圆 */
export const circle = (lng: number, lat: number, radiusKm: number, stepDeg = 5) =>
  Array.from({ length: Math.round(360 / stepDeg) }, (_, i) => destination(lng, lat, i * stepDeg, radiusKm));
