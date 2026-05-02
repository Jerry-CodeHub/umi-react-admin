import * as turf from '@turf/turf';
import * as Cesium from 'cesium';

export type Point = {
  longitude: number;
  latitude: number;
};

type DirectionDistancePoint = {
  direction: number;
  distance: number;
};

type AzimuthDistancePoint = {
  azimuth: number;
  distancekm: number;
};

type TurfCoordinate = [number, number];

/**
 * 获取矩形区域内的实体
 * @param viewer viewer 对象
 * @param rectangle 矩形区域
 * @returns 实体数组
 */
export function getEntitiesInRectangle(viewer: Cesium.Viewer, rectangle: Cesium.Rectangle) {
  const entitiesInRectangle: Cesium.Entity[] = []; // 矩形内的实体
  const entities = viewer.entities.values; // 获取所有实体

  // 遍历所有实体
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i]; // 实体

    // 判断实体是否有位置信息
    if (entity.position) {
      // 获取实体的位置
      const position = entity.position.getValue(Cesium.JulianDate.now());

      // 判断位置是否在矩形内
      if (position) {
        // 获取位置的经纬度坐标
        const cartographic = Cesium.Cartographic.fromCartesian(position);
        // 判断坐标是否在矩形内
        if (Cesium.Rectangle.contains(rectangle, cartographic)) {
          // 添加到矩形内的实体数组
          entitiesInRectangle.push(entity);
        }
      }
    }
  }

  return entitiesInRectangle;
}

/**
 * 计算 polygon 的路径
 * @param data 包含经纬度的数据
 * @returns polygon 的路径
 */
export const handlerPolygonPath = (data: Point[]) => {
  // let endpoint = [] as any[];

  let endpoint = data.map((item) => {
    let cartesian = Cesium.Cartesian3.fromDegrees(item.longitude, item.latitude); // 经纬度转笛卡尔坐标
    // endpoint.push(cartesian);
    return cartesian;
  });

  endpoint.push(endpoint[0]); // 添加第一个点, 形成闭合路径

  // return endpoint;
  return new Cesium.PolygonHierarchy(endpoint); // 创建 polygon 的路径
};

/**
 * 根据原点和方向距离计算 polygon 的路径
 * @param startLongitude 经度
 * @param startLatitude 纬度
 * @param startHeight 高度
 * @param data 包含方向和距离的数据
 * @returns polygon 的路径
 */
export function handlerDirectionDistance(
  startLongitude: number,
  startLatitude: number,
  startHeight: number,
  data: DirectionDistancePoint[],
) {
  let earthRadius = Cesium.Ellipsoid.WGS84.maximumRadius; // 地球半径

  let fixedPositions = Cesium.Cartographic.fromDegrees(startLongitude, startLatitude, startHeight); // 起点
  let fixedCartesian = Cesium.Cartographic.toCartesian(fixedPositions); // 起点的笛卡尔坐标

  let endPointCartesians: Cesium.Cartesian3[] = [];
  // let currentCartesian = fixedCartesian;

  data.forEach((item) => {
    let direction = Cesium.Math.toRadians(item.direction); // 方向角度
    let distance = item.distance * 1000; // 距离

    // 计算终点的笛卡尔坐标
    let endpointCartesian = Cesium.Cartesian3.fromRadians(
      Cesium.Cartographic.fromCartesian(fixedCartesian).longitude + (distance / earthRadius) * Math.cos(direction),
      Cesium.Cartographic.fromCartesian(fixedCartesian).latitude + (distance / earthRadius) * Math.sin(direction),
      Cesium.Cartographic.fromCartesian(fixedCartesian).height,
    );
    endPointCartesians.push(endpointCartesian);
  });

  endPointCartesians.push(endPointCartesians[0]);

  return new Cesium.PolygonHierarchy(endPointCartesians);
}

/**
 * 根据原点和方向距离计算 polygon 的路径
 * @param startLongitude 经度
 * @param startLatitude 纬度
 * @param startHeight 高度
 * @param data 包含方向和距离的数据
 * @returns polygon 的路径
 */
export function handlerDistanceKm(
  startLongitude: number,
  startLatitude: number,
  startHeight: number,
  data: AzimuthDistancePoint[],
) {
  let earthRadius = Cesium.Ellipsoid.WGS84.maximumRadius; // 地球半径

  let fixedPositions = Cesium.Cartographic.fromDegrees(startLongitude, startLatitude, startHeight); // 起点
  let fixedCartesian = Cesium.Cartographic.toCartesian(fixedPositions); // 起点的笛卡尔坐标

  let endPointCartesians: Cesium.Cartesian3[] = []; // 终点的笛卡尔坐标
  // let currentCartesian = fixedCartesian;

  data.forEach((item) => {
    // let direction = Cesium.Math.toRadians(item.direction); // 方向角度
    let direction = Cesium.Math.toRadians(item.azimuth); // 方向角度
    // let distance = item.distance * 1000; // 距离
    let distance = item.distancekm * 1000; // 距离

    // 计算终点的笛卡尔坐标
    let endpointCartesian = Cesium.Cartesian3.fromRadians(
      Cesium.Cartographic.fromCartesian(fixedCartesian).longitude + (distance / earthRadius) * Math.cos(direction),
      Cesium.Cartographic.fromCartesian(fixedCartesian).latitude + (distance / earthRadius) * Math.sin(direction),
      Cesium.Cartographic.fromCartesian(fixedCartesian).height,
    );
    endPointCartesians.push(endpointCartesian);
  });

  endPointCartesians.push(endPointCartesians[0]);

  return new Cesium.PolygonHierarchy(endPointCartesians);
}

/**
 * 根据每一个点的终点为下一个点的起点计算 polygon 的路径
 * @param startLongitude 经度
 * @param startLatitude 纬度
 * @param startHeight 高度
 * @param data 包含方向和距离的数据
 * @returns polygon 的路径
 */
export function handlerPointNew(
  startLongitude: number,
  startLatitude: number,
  startHeight: number,
  data: DirectionDistancePoint[],
) {
  let startPoint = Cesium.Cartesian3.fromDegrees(startLongitude, startLatitude, startHeight);

  let pathPoints: Cesium.Cartesian3[] = [startPoint]; // 路径点
  let currentPoint = startPoint; // 当前点

  data.forEach((item) => {
    let direction = Cesium.Math.toRadians(item.direction); // 方向角度
    let distance = item.distance * 1000; // 距离

    // 计算终点的笛卡尔坐标
    let newPoint = Cesium.Cartesian3.fromRadians(
      Cesium.Cartographic.fromCartesian(currentPoint).longitude +
        (distance / Cesium.Ellipsoid.WGS84.maximumRadius) * Math.cos(direction),
      Cesium.Cartographic.fromCartesian(currentPoint).latitude +
        (distance / Cesium.Ellipsoid.WGS84.maximumRadius) * Math.sin(direction),
      Cesium.Cartographic.fromCartesian(currentPoint).height,
    );
    pathPoints.push(newPoint); // 添加新点
    currentPoint = newPoint; // 更新当前点
  });

  pathPoints.push(startPoint); // 添加起始点以形成闭合路径

  return pathPoints;
}

/**
 * 计算两点之间的距离, 如果距离大于 distanceMi 设定的米,则生成一个新的点
 * @param data 位置数据(经纬度)
 * @param distanceMi 生成新点的距离
 * @returns 新的位置数据
 */
export const handlerComputePoint = (data: Point[], distanceMi: number) => {
  let dataPath: Point[] = [];
  for (let i = 0; i < data.length - 1; i++) {
    let start = data[i];
    let end = data[i + 1];
    // 计算两点之间的距离
    let distance = Cesium.Cartesian3.distance(
      Cesium.Cartesian3.fromDegrees(start.longitude, start.latitude),
      Cesium.Cartesian3.fromDegrees(end.longitude, end.latitude),
    );
    if (distance > distanceMi) {
      // 该段距离大于 1000 米, 每 1000 米生成一个新的经纬度点
      let count = Math.floor(distance / distanceMi); // 向下取整
      let step = distanceMi; // 步长
      // 生成新的点
      for (let j = 0; j < count; j++) {
        let longitude = start.longitude + ((end.longitude - start.longitude) * step) / distance; // 计算经度
        let latitude = start.latitude + ((end.latitude - start.latitude) * step) / distance; // 计算纬度
        dataPath.push({ longitude, latitude }); // 添加新的点
        step += distanceMi; // 步长递增
      }
      // 添加最后一个点
      dataPath.push(end);
    }
  }
  return dataPath;
};

/**
 * 合并多边形数组。
 * @param polygonArrays 多边形数组，每个多边形由一组点坐标表示。
 * @returns 合并后的多边形坐标数组。
 * @throws 如果输入无效或无法合并多边形，则抛出错误。
 */
export function mergePolygons(polygonArrays: Point[][]) {
  // 检查输入是否有效
  if (!Array.isArray(polygonArrays) || polygonArrays.length === 0) {
    throw new Error('输入必须是多边形坐标的非空数组。');
  }

  // 检查多边形是否有效
  function isValidPoint(p: Point | undefined): p is Point {
    return Boolean(
      p &&
        typeof p.longitude === 'number' &&
        typeof p.latitude === 'number' &&
        !isNaN(p.longitude) &&
        !isNaN(p.latitude),
    );
  }

  // 检查两个点是否相等
  function pointsEqual(p1: Point, p2: Point) {
    return p1.longitude === p2.longitude && p1.latitude === p2.latitude;
  }

  // 过滤有效的多边形
  const validPolygons = polygonArrays
    .map((polygon, index) => {
      if (!Array.isArray(polygon) || polygon.length < 3) {
        console.warn(`索引处的多边形 ${index} 无效(低于3个点)。跳过。`);
        return null;
      }

      // 过滤有效点并删除连续重复项
      const validPoints = polygon.filter((p, i, arr) => isValidPoint(p) && (i === 0 || !pointsEqual(p, arr[i - 1])));

      // 确保多边形是闭合的
      if (validPoints.length < 3) {
        console.warn(`索引处的多边形 ${index} 具有少于3个有效唯一点。跳过。`);
        return null;
      }

      // 确保多边形关闭
      if (!pointsEqual(validPoints[0], validPoints[validPoints.length - 1])) {
        validPoints.push(validPoints[0]);
      }

      return validPoints;
    })
    .filter((polygon): polygon is Point[] => Boolean(polygon));

  if (validPolygons.length === 0) {
    throw new Error('没有要合并的有效多边形。');
  }

  // 创建 turf 多边形
  const turfPolygons = validPolygons
    .map((polygon, index) => {
      try {
        const coordinates = polygon.map((p): TurfCoordinate => [p.longitude, p.latitude]);
        return turf.polygon([coordinates]);
      } catch (error) {
        console.error(`创建 turf 多边形错误 ${index}:`, error);
        return null;
      }
    })
    .filter((polygon): polygon is ReturnType<typeof turf.polygon> => Boolean(polygon));

  // 检查是否有有效的 turf 多边形
  if (turfPolygons.length === 0) {
    throw new Error('未能创建有效的 turf 多边形。');
  }

  // 如果只有一个多边形，不需要合并
  if (turfPolygons.length === 1) {
    const coordinates = turfPolygons[0].geometry.coordinates[0];
    return (coordinates as TurfCoordinate[]).map((coord) => ({
      longitude: coord[0],
      latitude: coord[1],
    }));
  }

  // 尝试合并多边形
  try {
    const featureCollection = turf.featureCollection(turfPolygons);
    const combined = turf.combine(featureCollection);

    if (!combined || !combined.features || combined.features.length === 0) {
      throw new Error('组合导致没有功能');
    }

    // 从组合中获得第一个(希望是唯一的)特性
    const mergedPolygon = combined.features[0];

    // 提取多边形坐标
    if (!mergedPolygon || !mergedPolygon.geometry || !mergedPolygon.geometry.coordinates) {
      throw new Error('无效的合并多边形结构');
    }

    // 处理潜在的 MultiPolygon 结果
    const coordinates =
      mergedPolygon.geometry.type === 'MultiPolygon'
        ? mergedPolygon.geometry.coordinates[0][0] // 取第一个多边形的外圈
        : mergedPolygon.geometry.coordinates[0];

    // 返回多边形坐标
    return (coordinates as TurfCoordinate[]).map((coord) => ({
      longitude: coord[0],
      latitude: coord[1],
    }));
  } catch (error: unknown) {
    console.error('多边形组合时出错:', error);
    throw new Error(`合并多边形失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 凸包算法：使用 Graham Scan 算法计算所有点的凸包，这将给出包含所有点的最小凸多边形。
 * 多边形简化：在计算凸包后，我们应用了一个简化步骤，移除共线或几乎共线的点，只保留形状所需的必要点。
 * 直接处理所有点：我们不再单独处理每个多边形，而是将所有点集中在一起处理，这简化了过程并确保我们得到真正的外围轮廓。
 * 错误处理：保留了对输入的验证，确保我们有足够的有效点来创建多边形。
 * 日志输出：添加了更多的日志输出，以便跟踪处理过程和结果。
 *
 * @param polygonArrays 多边形数组，包含多个多边形的坐标点 [[{ longitude: number, latitude: number}], [...], ...]
 * @returns 合并后的多边形路径，经过凸包计算和简化处理 [{ longitude: number, latitude: number }, ...]
 * @throws 如果输入不是有效的多边形数组或没有足够的有效点来创建多边形，则抛出错误
 */

export function mergePolygonsPath(polygonArrays: Point[][]) {
  if (!Array.isArray(polygonArrays) || polygonArrays.length === 0) {
    throw new Error('输入必须是多边形坐标的非空数组.');
  }

  function isValidPoint(p: Point | undefined): p is Point {
    return Boolean(
      p &&
        typeof p.longitude === 'number' &&
        typeof p.latitude === 'number' &&
        !isNaN(p.longitude) &&
        !isNaN(p.latitude),
    );
  }

  function pointsEqual(p1: Point, p2: Point) {
    return Math.abs(p1.longitude - p2.longitude) < 1e-8 && Math.abs(p1.latitude - p2.latitude) < 1e-8;
  }

  // 验证和清理输入多边形
  const allPoints = polygonArrays.flatMap((polygon, index) => {
    if (!Array.isArray(polygon) || polygon.length < 3) {
      console.warn(`在索引多边形 ${index} 无效(低于3分)。跳过.`);
      return [];
    }

    return polygon.filter(isValidPoint);
  });

  if (allPoints.length < 3) {
    throw new Error('没有足够的有效点来创建多边形。');
  }

  // 计算凸包
  function computeConvexHull(points: Point[]) {
    // 按字典顺序排序点
    points.sort((a, b) => a.longitude - b.longitude || a.latitude - b.latitude);

    const lower = [];
    for (let i = 0; i < points.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) {
        lower.pop();
      }
      lower.push(points[i]);
    }

    const upper = [];
    for (let i = points.length - 1; i >= 0; i--) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) {
        upper.pop();
      }
      upper.push(points[i]);
    }

    upper.pop();
    lower.pop();
    return lower.concat(upper);
  }

  function cross(o: Point, a: Point, b: Point) {
    return (
      (a.longitude - o.longitude) * (b.latitude - o.latitude) - (a.latitude - o.latitude) * (b.longitude - o.longitude)
    );
  }

  const convexHull = computeConvexHull(allPoints);

  // Ensure the polygon is closed
  if (!pointsEqual(convexHull[0], convexHull[convexHull.length - 1])) {
    convexHull.push(convexHull[0]);
  }

  // 简化凸包，去掉不必要的点
  function simplifyPolygon(points: Point[], epsilon = 1e-8) {
    if (points.length <= 4) return points; // Can't simplify further

    const result = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const current = points[i];
      const next = points[i + 1];

      if (Math.abs(cross(prev, current, next)) > epsilon) {
        result.push(current);
      }
    }
    result.push(points[points.length - 1]);
    return result;
  }

  const simplifiedHull = simplifyPolygon(convexHull);

  return simplifiedHull;
}
