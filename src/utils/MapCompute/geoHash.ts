/**
 * @description: 根据 geohash 获取经纬度范围
 * @param {string} hash: geohash
 * @return {object} { latitude, longitude, latitudeMin, latitudeMax, longitudeMin, longitudeMax }，latitude/longitude 为格子中心
 * @example:
 * geohashBounds("wx4g0bm6") => { latitude: 39.90415, longitude: 116.40753, latitudeMin: 39.90406, latitudeMax: 39.90423, longitudeMin: 116.40736, longitudeMax: 116.4077 }（约值）
 */
export function geohashBounds(hash: string) {
  if (hash.length === 0) {
    return null;
  }

  const BITS = [16, 8, 4, 2, 1];
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let isEven = true;
  let latMin = -90,
    latMax = 90;
  let lonMin = -180,
    lonMax = 180;
  let latMid = 0,
    lonMid = 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let bit = 0;
  let ch = 0;

  for (let i = 0; i < hash.length; i++) {
    ch = BASE32.indexOf(hash[i]);
    for (let j = 0; j < 5; j++) {
      const mask = BITS[j];
      if (isEven) {
        lonMid = (lonMin + lonMax) / 2;
        if (ch & mask) {
          lonMin = lonMid;
        } else {
          lonMax = lonMid;
        }
      } else {
        latMid = (latMin + latMax) / 2;
        if (ch & mask) {
          latMin = latMid;
        } else {
          latMax = latMid;
        }
      }
      isEven = !isEven;
    }
  }

  // 中心取格子两端的中点（此前返回最后一轮的二分点，恰好落在格子边上）
  return {
    latitude: (latMin + latMax) / 2,
    longitude: (lonMin + lonMax) / 2,
    latitudeMin: latMin,
    latitudeMax: latMax,
    longitudeMin: lonMin,
    longitudeMax: lonMax,
  };
}

/**
 * @description: 生成 geohash
 * @param {number} lat: 纬度
 * @param {number} lon: 经度
 * @param {number} precision: 精度
 * @return {string} geohash
 * @example:
 * centerGeoHash(39.9042, 116.4074, 8) => "wx4g0bm6"
 * centerGeoHash(39.9042, 116.4074, 12) => "wx4g0bm6c408"
 * （与标准 geohash 算法一致，已用独立参考实现核对）
 */
export function centerGeoHash(lat: number, lon: number, precision: number): string {
  const BITS = [16, 8, 4, 2, 1];
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let isEven = true;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let i = 0;
  let latMin = -90,
    latMax = 90;
  let lonMin = -180,
    lonMax = 180;
  let bit = 0;
  let ch = 0;
  let geohash = '';

  while (geohash.length < precision) {
    if (isEven) {
      const lonMid = (lonMin + lonMax) / 2;
      if (lon > lonMid) {
        ch |= BITS[bit];
        lonMin = lonMid;
      } else {
        lonMax = lonMid;
      }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (lat > latMid) {
        ch |= BITS[bit];
        latMin = latMid;
      } else {
        latMax = latMid;
      }
    }

    isEven = !isEven;
    if (bit < 4) {
      bit++;
    } else {
      geohash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return geohash;
}
