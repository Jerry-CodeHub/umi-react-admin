import { featureCollection, polygon } from '@turf/helpers';
import { union } from '@turf/union';
import * as Cesium from 'cesium';

export type Point = {
  longitude: number;
  latitude: number;
};

type TurfCoordinate = [number, number];

/**
 * 计算两点之间的距离, 如果距离大于 distanceMi 设定的米,则生成一个新的点
 * @param data 位置数据(经纬度)
 * @param distanceMi 生成新点的距离
 * @returns 新的位置数据
 */
export const handlerComputePoint = (data: Point[], distanceMi: number) => {
  let dataPath: Point[] = [];
  // 起点先入列，保证补点结果从用户绘制轨迹的起点开始
  if (data.length > 0) {
    dataPath.push(data[0]);
  }
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
    }
    // 每段终点无条件入列：短段只补终点，长段补插值点后再补终点，
    // 避免短线段在补点结果中丢失
    dataPath.push(end);
  }
  return dataPath;
};

/**
 * 合并多边形数组（turf.union 求并集）。
 * @param polygonArrays 多边形数组，每个多边形由一组点坐标表示。
 * @returns 合并结果的外环数组：相交多边形合并为一个环；不相交的多边形返回多个环。
 * @throws 如果输入无效或无法合并多边形，则抛出错误。
 */
export function mergePolygons(polygonArrays: Point[][]) {
  // 检查输入是否有效
  if (!Array.isArray(polygonArrays) || polygonArrays.length === 0) {
    throw new Error('Input must be a non-empty array of polygon coordinates.');
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
        console.warn(`Polygon at index ${index} has fewer than 3 points. Skipped.`);
        return null;
      }

      // 过滤有效点并删除连续重复项
      const validPoints = polygon.filter((p, i, arr) => isValidPoint(p) && (i === 0 || !pointsEqual(p, arr[i - 1])));

      // 确保多边形是闭合的
      if (validPoints.length < 3) {
        console.warn(`Polygon at index ${index} has fewer than 3 valid unique points. Skipped.`);
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
    throw new Error('No valid polygons to merge.');
  }

  // 创建 turf 多边形
  const turfPolygons = validPolygons
    .map((pointSet, index) => {
      try {
        const coordinates = pointSet.map((p): TurfCoordinate => [p.longitude, p.latitude]);
        return polygon([coordinates]);
      } catch (error) {
        console.error(`Failed to create turf polygon ${index}:`, error);
        return null;
      }
    })
    .filter((poly): poly is ReturnType<typeof polygon> => Boolean(poly));

  // 检查是否有有效的 turf 多边形
  if (turfPolygons.length === 0) {
    throw new Error('Could not create any valid turf polygon.');
  }

  // 如果只有一个多边形，不需要合并
  if (turfPolygons.length === 1) {
    const coordinates = turfPolygons[0].geometry.coordinates[0];
    return [
      (coordinates as TurfCoordinate[]).map((coord) => ({
        longitude: coord[0],
        latitude: coord[1],
      })),
    ];
  }

  // 尝试合并多边形
  try {
    // turf.union 对 featureCollection 求并集：相交多边形合并为单个 Polygon（外环），
    // 不相交多边形返回 MultiPolygon（每个多边形一个外环）。
    // 此前误用 turf.combine（仅做几何打包不做合并），多边形合并功能实际未生效。
    const merged = union(featureCollection(turfPolygons));

    if (!merged || !merged.geometry || !merged.geometry.coordinates) {
      throw new Error('The merge result is empty');
    }

    // 规整为外环数组：Polygon 取唯一外环，MultiPolygon 逐个取外环
    const ringList: TurfCoordinate[][] =
      merged.geometry.type === 'MultiPolygon'
        ? (merged.geometry.coordinates as TurfCoordinate[][][]).map((poly) => poly[0])
        : [merged.geometry.coordinates[0] as TurfCoordinate[]];

    return ringList.map((ring) =>
      ring.map((coord) => ({
        longitude: coord[0],
        latitude: coord[1],
      })),
    );
  } catch (error: unknown) {
    console.error('Polygon merge failed:', error);
    throw new Error(`Polygon merge failed: ${error instanceof Error ? error.message : String(error)}`);
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
    throw new Error('Input must be a non-empty array of polygon coordinates.');
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
      console.warn(`Polygon at index ${index} has fewer than 3 points. Skipped.`);
      return [];
    }

    return polygon.filter(isValidPoint);
  });

  if (allPoints.length < 3) {
    throw new Error('Not enough valid points to build a polygon.');
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
