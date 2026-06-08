/**
 * 距离匹配引擎 — Layer 4
 *
 * 根据用户选择的时间预算，评估 POI 距离是否合适。
 *
 * 核心原则:
 *  - 1小时 → 优先 1~5km (步行/骑行可达)
 *  - 半天   → 优先 5~15km
 *  - 一天   → 优先 15~40km
 *
 * 避免:
 *  - 1小时路线包含 40km 外的景点
 *  - 全天路线全是 500m 内的社区公园
 */

import { TRANSPORT_CONFIG, haversineDistance } from '../utils/routeGenerator.js'

// ==================== 理想距离范围 ====================

/**
 * 时间预算 → 理想距离范围 (km)
 *
 * 考虑到不同出行方式的速度差异，这里的"距离"是直线距离
 * 实际移动距离由高德路径规划 API 补充
 */
const IDEAL_DISTANCE_RANGES = {
  '1h': {
    walk:   { min: 0.5, max: 3.0, optimal: 1.5 },
    cycle:  { min: 1.0, max: 8.0, optimal: 4.0 },
    subway: { min: 2.0, max: 15.0, optimal: 8.0 },
    drive:  { min: 2.0, max: 12.0, optimal: 6.0 },
  },
  '2h': {
    walk:   { min: 0.5, max: 5.0, optimal: 2.5 },
    cycle:  { min: 1.0, max: 12.0, optimal: 6.0 },
    subway: { min: 2.0, max: 25.0, optimal: 12.0 },
    drive:  { min: 2.0, max: 20.0, optimal: 10.0 },
  },
  '3h': {
    walk:   { min: 1.0, max: 7.0, optimal: 3.5 },
    cycle:  { min: 2.0, max: 15.0, optimal: 8.0 },
    subway: { min: 3.0, max: 30.0, optimal: 15.0 },
    drive:  { min: 3.0, max: 25.0, optimal: 12.0 },
  },
  '5h': {
    walk:   { min: 1.0, max: 10.0, optimal: 5.0 },
    cycle:  { min: 3.0, max: 20.0, optimal: 12.0 },
    subway: { min: 3.0, max: 40.0, optimal: 20.0 },
    drive:  { min: 3.0, max: 35.0, optimal: 18.0 },
  },
  '1d': {
    walk:   { min: 1.0, max: 15.0, optimal: 8.0 },
    cycle:  { min: 3.0, max: 30.0, optimal: 15.0 },
    subway: { min: 3.0, max: 50.0, optimal: 25.0 },
    drive:  { min: 5.0, max: 60.0, optimal: 30.0 },
  },
  '2d': {
    walk:   { min: 1.0, max: 20.0, optimal: 10.0 },
    cycle:  { min: 3.0, max: 40.0, optimal: 20.0 },
    subway: { min: 3.0, max: 60.0, optimal: 30.0 },
    drive:  { min: 5.0, max: 80.0, optimal: 40.0 },
  },
}

// ==================== 单 POI 距离评分 ====================

/**
 * 计算单个 POI 距离用户位置的匹配度
 *
 * @param {number} poiLat       POI 纬度
 * @param {number} poiLng       POI 经度
 * @param {number} userLat      用户纬度
 * @param {number} userLng      用户经度
 * @param {string} transport    出行方式 (walk|cycle|subway|drive)
 * @param {string} time         时间预算 (1h|2h|3h|5h|1d|2d)
 * @returns {number} 0~100 分数
 */
export function calculateDistanceFit(poiLat, poiLng, userLat, userLng, transport = 'walk', time = '2h') {
  if (poiLat == null || poiLng == null || userLat == null || userLng == null) {
    return 50 // 无位置信息，给中性分
  }

  const distKm = haversineDistance(userLat, userLng, poiLat, poiLng)

  // 获取该时间+出行方式的理想范围
  const timeRanges = IDEAL_DISTANCE_RANGES[time] || IDEAL_DISTANCE_RANGES['2h']
  const range = timeRanges[transport] || timeRanges.walk

  return scoreByRange(distKm, range)
}

/**
 * 根据距离和理想范围计算分数
 */
function scoreByRange(distKm, range) {
  const { min, max, optimal } = range

  // ── 太近 ──
  // 距离 < 最小值的 50% → 分数急降
  if (distKm < min * 0.3) return 10
  if (distKm < min * 0.5) return 20
  if (distKm < min * 0.75) return 35
  if (distKm < min) {
    // 介于 min*0.75 到 min → 线性插值
    return Math.round(35 + ((distKm - min * 0.75) / (min * 0.25)) * 25)
  }

  // ── 理想范围内 ──
  if (distKm >= min && distKm <= max) {
    const deviation = Math.abs(distKm - optimal) / optimal
    return Math.round(Math.max(65, 100 - deviation * 35))
  }

  // ── 太远 ──
  const farLimit = max * 2.0
  if (distKm > farLimit) return 5
  if (distKm > max * 1.5) return 15
  if (distKm > max * 1.2) return 25
  if (distKm > max) {
    // 介于 max 到 max*1.5 → 线性衰减
    return Math.round(60 - ((distKm - max) / (max * 0.5)) * 45)
  }

  return 50
}

// ==================== 路线整体距离评估 ====================

/**
 * 评估整条路线的总距离是否在合理范围内
 *
 * @param {Array}  orderedRoute  排序后的路线
 * @param {string} transport     出行方式
 * @param {string} time          时间预算
 * @returns {{ score: number, verdict: string, details: object }}
 */
export function evaluateRouteDistance(orderedRoute, transport = 'walk', time = '2h') {
  const tConfig = TRANSPORT_CONFIG[transport] || TRANSPORT_CONFIG.walk
  const maxDailyMeters = tConfig.maxDailyDistance

  // 计算路线总 haversine 距离
  const totalKm = orderedRoute.reduce((sum, s) => sum + (s.walkingDist || 0), 0)
  const totalMeters = totalKm * 1000

  // 理想距离
  const timeRanges = IDEAL_DISTANCE_RANGES[time] || IDEAL_DISTANCE_RANGES['2h']
  const range = timeRanges[transport] || timeRanges.walk

  // 总距离 vs 最大限制
  const ratio = totalMeters / maxDailyMeters

  let score, verdict
  if (ratio <= 0.3) {
    score = 30
    verdict = '路线偏短，可以增加更多地点'
  } else if (ratio <= 0.6) {
    score = 70
    verdict = '距离适中，轻松完成'
  } else if (ratio <= 0.85) {
    score = 90
    verdict = '距离合理，节奏舒适'
  } else if (ratio <= 1.0) {
    score = 80
    verdict = '距离稍长但可行'
  } else {
    // 超出最大限制，触发重试
    score = 20
    verdict = `超出${tConfig.label}单日限制 (${(maxDailyMeters / 1000).toFixed(1)}km)`
  }

  return {
    score,
    verdict,
    details: {
      totalKm: Math.round(totalKm * 100) / 100,
      totalMeters: Math.round(totalMeters),
      maxDailyMeters,
      ratio: Math.round(ratio * 100) / 100,
      transport: tConfig.label,
    },
  }
}

// ==================== 多 POI 距离批量评分 ====================

/**
 * 对 POI 列表按距离匹配度批量打分
 *
 * @param {Array}  pois         POI 列表
 * @param {number} userLat
 * @param {number} userLng
 * @param {string} transport
 * @param {string} time
 * @returns {Array}  附带 _distanceScore 的 POI 列表
 */
export function rankByDistanceFit(pois, userLat, userLng, transport = 'walk', time = '2h') {
  return pois.map((poi) => ({
    ...poi,
    _distanceScore: calculateDistanceFit(
      poi.lat, poi.lng,
      userLat, userLng,
      transport, time
    ),
  }))
}

// ==================== 导出常量 ====================
export { IDEAL_DISTANCE_RANGES }
