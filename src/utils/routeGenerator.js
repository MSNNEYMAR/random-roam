/**
 * 路线生成器 v3 — 骨架驱动架构
 *
 * 流程:
 *  RouteSkeleton (体验蓝图)
 *    ↓
 *  Category Allocation (类别槽位)
 *    ↓
 *  Category-Internal POI Selection (类别内 POI 选择)
 *    ↓
 *  Greedy Nearest-Neighbor Ordering (最近邻排序)
 *    ↓
 *  Route-Level Scoring (路线整体评分)
 *
 * 核心约束: 不允许跨类别 POI 排序。不允许全局 Top-N 选点。
 */

import {
  executeSkeletonPipeline,
  validateRouteStructure,
} from '../engine/routeOptimizer.js'

import {
  calculatePOIScore,
  getLandmarkTier,
  rankWithinCategory,
} from '../engine/poiScorer.js'

import {
  selectSkeleton,
  fitSkeletonToTime,
  getLastUsedSkeletonId,
  recordUsedSkeleton,
  TIME_TO_COUNT,
  EXPLORATION_VALUE,
  getExplorationValue,
  getFoodLimits,
} from '../engine/routeSkeleton.js'

import {
  calculateRouteSimilarity,
  isTooSimilar,
} from '../engine/diversityEngine.js'

import { evaluateRouteDistance } from '../engine/distanceFit.js'

import { defaultScoreModel, RuleBasedModel } from '../engine/routeScoreModel.js'

// ==================== 出行方式配置表 ====================
export const TRANSPORT_CONFIG = {
  walk: {
    searchRadius: 2500, maxDailyDistance: 7000, speed: 1.2,
    label: '步行', filterMinKm: 0.2, filterMaxKm: 2.5,
    fallbackTiers: [1.0, 1.5, 2.0],
  },
  cycle: {
    searchRadius: 6000, maxDailyDistance: 15000, speed: 4.0,
    label: '骑行', filterMinKm: 0.5, filterMaxKm: 6.0,
    fallbackTiers: [2.0, 3.5, 5.0],
  },
  subway: {
    searchRadius: 20000, maxDailyDistance: 35000, speed: 8.0,
    label: '地铁', filterMinKm: 2.0, filterMaxKm: 20.0,
    fallbackTiers: [3.0, 5.0, 8.0, 15.0, 20.0],
  },
  drive: {
    searchRadius: 15000, maxDailyDistance: 40000, speed: 10.0,
    label: '打车', filterMinKm: 0.5, filterMaxKm: 15.0,
    fallbackTiers: [3.0, 6.0, 10.0, 15.0],
  },
}

// ==================== Haversine ====================
function toRad(deg) { return (deg * Math.PI) / 180 }

export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ==================== 辅助 ====================

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

function getLM(item) {
  return item.landmark || item
}

const STYLE_STAY_MULTIPLIER = {
  relax: 1.3, artsy: 1.2, commando: 0.7, couple: 1.4, quiet: 1.1, budget: 0.9,
}

// ==================== 加权随机选 ====================

export function weightedRandomPick(pool, boost = 2.0, diversityCtx = null) {
  if (pool.length === 0) return null
  if (pool.length === 1) return pool[0]

  const weights = pool.map((item) => {
    const lm = getLM(item)

    // 优先使用 _score
    if (lm._score != null) {
      const scoreW = Math.pow(lm._score / 100, 1.5) * boost + 0.3
      let divPenalty = 1.0
      if (diversityCtx?.usedPoiIds?.includes(lm.id)) divPenalty = 0.1
      return scoreW * divPenalty
    }

    // 回退
    const rating = (lm.rating != null && lm.rating > 0) ? Number(lm.rating) : 3.5
    const ratingBase = Math.max(0.3, rating / 5)
    const ratingW = Math.pow(ratingBase, 1.5) * boost + 0.3
    const tier = lm._landmarkTier || getLandmarkTier(lm)
    const TIER_WEIGHT = { S: 5.0, A: 1.8, B: 0.5, C: 0.2 }
    const tierW = TIER_WEIGHT[tier.tier] || 1.0
    return ratingW * tierW
  })

  const totalWeight = weights.reduce((s, w) => s + w, 0)
  if (totalWeight <= 0) return pool[Math.floor(Math.random() * pool.length)]

  let random = Math.random() * totalWeight
  for (let i = 0; i < pool.length; i++) {
    random -= weights[i]
    if (random <= 0) return pool[i]
  }
  return pool[pool.length - 1]
}

// ==================== 半径筛选 ====================

export function filterByRadius(userLat, userLng, landmarks, minKm = 0.2, maxKm = 5.0) {
  return landmarks
    .map((lm) => ({ landmark: lm, distance: haversineDistance(userLat, userLng, lm.lat, lm.lng) }))
    .filter((item) => item.distance >= minKm && item.distance <= maxKm)
    .sort((a, b) => a.distance - b.distance)
}

// ==================== 最近邻排序 ====================

export function orderByGreedy(picked, userLat, userLng, speed = 1.2) {
  const points = [...picked]
  if (points.length === 0) return []
  if (points.length === 1) {
    const lm = getLM(points[0])
    const dist = haversineDistance(userLat, userLng, lm.lat, lm.lng)
    return [{ ...points[0], walkingDist: dist, walkingTime: (dist * 1000) / speed / 60 }]
  }

  let nearestIdx = 0, nearestDist = Infinity
  points.forEach((p, i) => {
    const d = haversineDistance(userLat, userLng, getLM(p).lat, getLM(p).lng)
    if (d < nearestDist) { nearestDist = d; nearestIdx = i }
  })

  const first = points.splice(nearestIdx, 1)[0]
  const ordered = [{ ...first, walkingDist: nearestDist, walkingTime: (nearestDist * 1000) / speed / 60 }]

  while (points.length > 0) {
    const lastLM = getLM(ordered[ordered.length - 1])
    let nextIdx = 0, nextDist = Infinity
    points.forEach((p, i) => {
      const d = haversineDistance(lastLM.lat, lastLM.lng, getLM(p).lat, getLM(p).lng)
      if (d < nextDist) { nextDist = d; nextIdx = i }
    })
    const next = points.splice(nextIdx, 1)[0]
    ordered.push({ ...next, walkingDist: nextDist, walkingTime: (nextDist * 1000) / speed / 60 })
  }

  return ordered
}

// ==================== 路线总览 ====================

export function computeSummary(orderedRoute, preferences = null) {
  const transport = preferences?.transport || 'walk'
  const tConfig = TRANSPORT_CONFIG[transport] || TRANSPORT_CONFIG.walk
  const speed = tConfig.speed
  const travelLabel = tConfig.label

  const stayMultiplier = preferences ? (STYLE_STAY_MULTIPLIER[preferences.style] || 1.0) : 1.0
  const totalWalkingDist = orderedRoute.reduce((sum, s) => sum + (s.walkingDist || 0), 0)
  const totalStayTime = orderedRoute.reduce((sum, s) => sum + Math.round(((getLM(s).suggestedStay || 30) * stayMultiplier)), 0)
  const travelTime = totalWalkingDist * 1000 / speed / 60
  const totalTime = Math.round((travelTime + totalStayTime) * 1.2)

  const routeSummary = orderedRoute.map((s, idx) => {
    const lm = getLM(s)
    const tier = lm._landmarkTier || getLandmarkTier(lm)
    return {
      order: idx + 1, name: lm.name, category: lm.category,
      description: lm.description, tip: lm.tip,
      stayMinutes: Math.round((lm.suggestedStay || 30) * stayMultiplier),
      photoUrl: lm.photos?.[0] || null, photos: lm.photos || [],
      address: lm.address || '', rating: lm.rating || null, cost: lm.cost || null,
      tier: tier.tier,
      walkingFromPrev: s.walkingDist
        ? `${(s.walkingDist * 1000).toFixed(0)}m (约${Math.round(s.walkingTime)}分钟${travelLabel})`
        : '出发点',
    }
  })

  return { totalWalkingDist: Math.round(totalWalkingDist * 1000), totalStayTime, totalTime, totalStops: orderedRoute.length, routeSummary }
}

// ==================== 总里程校验 ====================

function calcTotalDistance(orderedRoute) {
  return orderedRoute.reduce((sum, s) => sum + (s.walkingDist || 0), 0)
}

function routeWithinLimit(orderedRoute, tConfig) {
  return (calcTotalDistance(orderedRoute) * 1000) <= tConfig.maxDailyDistance
}

// ==================== 多样性上下文 ====================

export function buildDiversityCtx(poiList) {
  const THEME_TAGS = {
    imperial_garden:   { re: /颐和园|圆明园|北海|景山|故宫|天坛|地坛|日坛|月坛|中山公园|香山|八大处|恭王府|雍和宫|避暑山庄|拙政园|留园|狮子林|皇家|御苑|行宫/ },
    modern_sport:      { re: /体育|运动|健身|球场|跑道|游泳|滑雪|攀岩|骑行|马拉松|户外|越野|滑板|轮滑|卡丁车/ },
    nature_forest:     { re: /山|湖|河|海|湿地|森林|植物|动物|花|鸟|鱼|岛|滩|湾|峡|瀑布|温泉|草原|氧吧/ },
    history_relic:     { re: /遗址|故居|纪念馆|陵|碑|城墙|古镇|古街|老街|古迹|石窟|石刻|壁画|长城|烽火|箭楼|城楼|钟楼|鼓楼|胡同|四合院/ },
    art_lifestyle:     { re: /创意|艺术|画廊|书店|文创|手作|设计|美学|咖啡|茶|陶艺|插花|画室|买手店|生活方式|生活馆/ },
    food_explore:      { re: /餐厅|美食|火锅|烧烤|小吃|面馆|酒楼|饭店|食堂|大排档|老字号|本帮|粤菜|川菜|湘菜|日料|西餐|牛排|海鲜|甜品|烘焙|早茶|点心|私房/ },
    modern_entertain:  { re: /影城|电影|KTV|酒吧|夜店|LiveHouse|密室|剧本杀|桌游|电玩|VR|游乐场|主题乐园|摩天轮|水族馆|海洋馆/ },
  }

  function classifyTags(poi) {
    const name = poi.name || ''
    const type = poi.type || ''
    const combined = `${name} ${type}`
    const tags = []
    for (const [key, def] of Object.entries(THEME_TAGS)) {
      if (def.re.test(combined)) tags.push(key)
    }
    if (tags.length === 0) {
      if (poi.category === 'culture') tags.push('history_relic')
      else if (poi.category === 'park') tags.push('nature_forest')
      else if (poi.category === 'cafe') tags.push('art_lifestyle')
      else if (poi.category === 'food') tags.push('food_explore')
    }
    return tags
  }

  const usedGeo = poiList.map((p) => ({ lat: p.lat, lng: p.lng }))
  const usedPoiIds = poiList.map((p) => p.id).filter(Boolean)
  const tagCounts = {}
  for (const p of poiList) {
    for (const t of classifyTags(p)) {
      tagCounts[t] = (tagCounts[t] || 0) + 1
    }
  }
  const usedTagIds = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t)

  return { usedGeo, usedPoiIds, usedTagIds }
}

// ==================== 主导出 (骨架驱动版) ====================

const MAX_RETRIES = 20

/**
 * @param {number}  userLat / userLng
 * @param {Array}   landmarks  高德 API 返回的全部 POI (已过滤)
 * @param {object}  preferences {transport, time, style}
 * @param {Array}   excludeIds 历史去重 ID
 * @param {object|null} diversityCtx 多样性上下文 (换线时传入)
 * @returns {{ success, orderedRoute?, summary?, days?, diversityCtx?, error?, quality?, routeScore? }}
 */
export function generateRoute(userLat, userLng, landmarks, preferences = null, excludeIds = [], diversityCtx = null) {
  const transport = preferences?.transport || 'walk'
  const tConfig = TRANSPORT_CONFIG[transport] || TRANSPORT_CONFIG.walk
  const timeBudget = preferences?.time || '2h'
  const style = preferences?.style || 'relax'
  const targetCount = TIME_TO_COUNT[timeBudget] || 4
  const speed = tConfig.speed

  // ── Step 1: 半径筛选 ──
  let filtered = filterByRadius(userLat, userLng, landmarks, tConfig.filterMinKm, tConfig.filterMaxKm)
  if (filtered.length < targetCount) {
    for (const tierKm of tConfig.fallbackTiers) {
      filtered = filterByRadius(userLat, userLng, landmarks, tConfig.filterMinKm, tierKm)
      if (filtered.length >= targetCount) break
    }
    if (filtered.length < targetCount) {
      filtered = filterByRadius(userLat, userLng, landmarks, 0, tConfig.filterMaxKm)
    }
  }

  if (filtered.length < 2) {
    return { success: false, error: `附近 ${tConfig.filterMaxKm}km 内找不到足够地标，换个位置试试吧~` }
  }

  const flatPOIs = filtered.map((item) => item.landmark || item)

  // ── 预计算 POI 元数据 ──
  for (const poi of flatPOIs) {
    if (!poi._landmarkTier) poi._landmarkTier = getLandmarkTier(poi)
    if (!poi._explorationValue) poi._explorationValue = getExplorationValue(poi)
    if (!poi._score) poi._score = calculatePOIScore(poi)
  }

  // ── Step 2: 骨架驱动选择 ──
  const isMultiDay = timeBudget === '1d' || timeBudget === '2d'

  if (isMultiDay) {
    return buildMultiDaySkeleton(flatPOIs, preferences, userLat, userLng, tConfig, excludeIds, diversityCtx)
  }

  return buildSingleDaySkeleton(flatPOIs, preferences, userLat, userLng, tConfig, excludeIds, diversityCtx)
}

// ==================== 单天路线 (骨架驱动) ====================

function buildSingleDaySkeleton(allPOIs, preferences, userLat, userLng, tConfig, excludeIds, diversityCtx) {
  const speed = tConfig.speed
  const style = preferences?.style || 'relax'

  let bestResult = null
  let bestScore = -Infinity

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // 执行骨架管线
    const pipeline = executeSkeletonPipeline(allPOIs, preferences, excludeIds, diversityCtx)

    if (!pipeline.picked || pipeline.picked.length < 2) {
      continue
    }

    const ordered = orderByGreedy(pipeline.picked, userLat, userLng, speed)

    // 距离校验
    if (!routeWithinLimit(ordered, tConfig)) {
      continue
    }

    // 相似度检查
    if (diversityCtx?._lastRoute) {
      const sim = calculateRouteSimilarity(ordered, diversityCtx._lastRoute)
      if (sim > 0.4) continue
    }

    // 结构验证
    const validation = validateRouteStructure(ordered)

    if (validation.quality > bestScore) {
      bestScore = validation.quality
      bestResult = { ordered, pipeline }
    }

    // 足够好就退出
    if (validation.quality >= 80) break
  }

  if (!bestResult) {
    // 放松限制再试
    const relaxedConfig = { ...tConfig, maxDailyDistance: tConfig.maxDailyDistance * 1.3 }
    for (let attempt = 0; attempt < 5; attempt++) {
      const pipeline = executeSkeletonPipeline(allPOIs, preferences, [], null)
      if (!pipeline.picked || pipeline.picked.length < 2) continue
      const ordered = orderByGreedy(pipeline.picked, userLat, userLng, speed)
      if (routeWithinLimit(ordered, relaxedConfig)) {
        bestResult = { ordered, pipeline }
        break
      }
    }

    if (!bestResult) {
      return { success: false, error: `无法在${tConfig.label} ${(tConfig.maxDailyDistance / 1000).toFixed(1)}km 限制内生成路线，请扩容出行方式或换个区域` }
    }
  }

  const { ordered } = bestResult
  const routePOIs = ordered.map((s) => getLM(s))
  const summary = computeSummary(ordered, preferences)
  const ctx = buildDiversityCtx(routePOIs)
  ctx._lastRoute = ordered
  ctx._skeletonId = bestResult.pipeline.skeletonId

  return {
    success: true,
    route: routePOIs,
    orderedRoute: ordered,
    summary,
    diversityCtx: ctx,
    quality: bestScore,
  }
}

// ==================== 多天路线 (骨架驱动) ====================

const DAY_SPLITS = { '1d': [3, 3], '2d': [4, 4] }

function buildMultiDaySkeleton(allPOIs, preferences, userLat, userLng, tConfig, excludeIds, diversityCtx) {
  const timeBudget = preferences?.time || '2d'
  const split = DAY_SPLITS[timeBudget] || [4, 4]
  const dayLabels = ['Day 1', 'Day 2']
  const speed = tConfig.speed

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const pipeline = executeSkeletonPipeline(allPOIs, preferences, excludeIds, diversityCtx)

    if (!pipeline.picked || pipeline.picked.length < split[0] + 1) continue

    const [day1Pool, day2Pool] = clusterByProximity(pipeline.picked, userLat, userLng, split)
    const day1Ordered = orderByGreedy(day1Pool, userLat, userLng, speed)
    const day2Ordered = orderByGreedy(day2Pool, userLat, userLng, speed)

    if (!routeWithinLimit(day1Ordered, tConfig) || !routeWithinLimit(day2Ordered, tConfig)) continue

    const day1Summary = computeSummary(day1Ordered, preferences)
    const day2Summary = computeSummary(day2Ordered, preferences)
    const allOrdered = [...day1Ordered, ...day2Ordered]
    const totalSummary = computeSummary(allOrdered, preferences)
    const allPOIs = allOrdered.map((s) => getLM(s))

    const ctx = buildDiversityCtx(allPOIs)
    ctx._lastRoute = allOrdered
    ctx._skeletonId = pipeline.skeletonId

    return {
      success: true,
      route: allPOIs,
      orderedRoute: allOrdered,
      summary: totalSummary,
      diversityCtx: ctx,
      days: [
        { label: dayLabels[0], orderedRoute: day1Ordered, summary: day1Summary },
        { label: dayLabels[1], orderedRoute: day2Ordered, summary: day2Summary },
      ],
    }
  }

  return { success: false, error: `无法在${tConfig.label}限制内生成多天路线，请扩容出行方式或选单天方案` }
}

// ==================== 空间聚类 ====================

function clusterByProximity(picked, userLat, userLng, daySizes) {
  const n = picked.length
  if (n <= daySizes[0]) return [[...picked], []]

  let seed1 = 0, minD = Infinity
  for (let i = 0; i < n; i++) {
    const d = haversineDistance(userLat, userLng, getLM(picked[i]).lat, getLM(picked[i]).lng)
    if (d < minD) { minD = d; seed1 = i }
  }

  let seed2 = 0, maxD = -1
  const s1lm = getLM(picked[seed1])
  for (let i = 0; i < n; i++) {
    if (i === seed1) continue
    const d = haversineDistance(s1lm.lat, s1lm.lng, getLM(picked[i]).lat, getLM(picked[i]).lng)
    if (d > maxD) { maxD = d; seed2 = i }
  }

  const group1 = [picked[seed1]], group2 = [picked[seed2]]
  const used = new Set([seed1, seed2])
  const s2lm = getLM(picked[seed2])

  for (let i = 0; i < n; i++) {
    if (used.has(i)) continue
    const pi = getLM(picked[i])
    const d1 = haversineDistance(s1lm.lat, s1lm.lng, pi.lat, pi.lng)
    const d2 = haversineDistance(s2lm.lat, s2lm.lng, pi.lat, pi.lng)

    if (group1.length >= daySizes[0]) group2.push(picked[i])
    else if (group2.length >= daySizes[1]) group1.push(picked[i])
    else if (d1 <= d2) group1.push(picked[i])
    else group2.push(picked[i])
  }

  return [group1, group2]
}

// ==================== 路线质量日志 ====================

export function logRouteQuality(result) {
  if (!result.success) {
    console.warn('[RouteGen] 路线生成失败:', result.error)
    return
  }

  const pois = result.orderedRoute.map((s) => getLM(s))
  const tiers = pois.map((p) => p._landmarkTier || getLandmarkTier(p))
  const tierSummary = {
    S: tiers.filter((t) => t.tier === 'S').length,
    A: tiers.filter((t) => t.tier === 'A').length,
    B: tiers.filter((t) => t.tier === 'B').length,
    C: tiers.filter((t) => t.tier === 'C').length,
  }

  console.log(
    `[RouteGen] ✅ 骨架驱动路线 | ` +
    `${result.summary.totalStops}站 | ` +
    `S:${tierSummary.S} A:${tierSummary.A} B:${tierSummary.B} C:${tierSummary.C} | ` +
    `骨架:${result.diversityCtx?._skeletonId || 'N/A'}`,
    pois.map((p) => `${p.name}(${(p._landmarkTier || getLandmarkTier(p)).tier})`).join(' → ')
  )
}
