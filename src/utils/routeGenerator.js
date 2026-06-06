/**
 * 路线生成器 — 100% 依赖高德周边搜索 API，同城/周边
 *
 * 流程:
 *  1. 高德 place/around: radius 由出行方式动态决定
 *  2. 按出行方式做二次距离精筛
 *  3. 根据风格模式确定目标类别和数量
 *  4. Fisher-Yates 洗牌 + 类别多样性抽选
 *  5. 最近邻排序：用户位置 → 最近 → 次近 → ...
 *  6. 里程校验：超出 maxDailyDistance 则重试洗牌
 *  7. 1天/2天路线: 多抽点，按天分组，每天独立最近邻排序 + 独立校验
 *
 * 偏好参数:
 *  - transport: 'walk' | 'cycle' | 'drive'
 *  - time:      '1h'|'2h'|'3h'|'5h'|'1d'|'2d'
 *  - style:     'relax'|'artsy'|'commando'|'couple'|'quiet'|'budget'
 *  - excludeIds: string[] — 跨代去重
 */

// ==================== 出行方式配置表 ====================
export const TRANSPORT_CONFIG = {
  walk: {
    searchRadius: 2500,      // API 搜索半径 (米)
    maxDailyDistance: 7000,   // 单日最大总里程 (米) — 人类步行极限
    speed: 1.2,               // 移动速度 (米/秒) ≈ 4.3 km/h
    label: '步行',
    filterMinKm: 0.2,        // 二次筛选最小距离 (km)
    filterMaxKm: 2.5,         // 二次筛选最大距离 (km)
    fallbackTiers: [1.0, 1.5, 2.0],  // 二次筛选逐级兜底 (km)
  },
  cycle: {
    searchRadius: 6000,
    maxDailyDistance: 15000,
    speed: 4.0,               // ≈ 14.4 km/h
    label: '骑行',
    filterMinKm: 0.5,
    filterMaxKm: 6.0,
    fallbackTiers: [2.0, 3.5, 5.0],
  },
  subway: {
    searchRadius: 20000,
    maxDailyDistance: 35000,
    speed: 8.0,               // ≈ 29 km/h（含进站/换乘/步行到站）
    label: '地铁',
    filterMinKm: 2.0,         // 地铁不适合太近的点
    filterMaxKm: 20.0,
    fallbackTiers: [3.0, 5.0, 8.0, 15.0, 20.0],
  },
  drive: {
    searchRadius: 15000,
    maxDailyDistance: 40000,
    speed: 10.0,              // ≈ 36 km/h（市区车速）
    label: '打车',
    filterMinKm: 0.5,
    filterMaxKm: 15.0,
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

// ==================== 偏好配置 ====================

/** 时间 → 总地点数 */
const TIME_TO_COUNT = {
  '1h': 2, '2h': 3, '3h': 4, '5h': 5, '1d': 6, '2d': 8,
}

/** 时间 → 餐饮最低 */
const TIME_FOOD_MIN = {
  '1h': 0, '2h': 1, '3h': 1, '5h': 1, '1d': 2, '2d': 3,
}

/** 多天路线每天地点数 */
const DAY_SPLITS = {
  '1d': [3, 3],
  '2d': [4, 4],
}

/** 风格 → 目标类别 */
const STYLE_CATEGORIES = {
  relax:    ['park', 'cafe'],
  artsy:    ['culture', 'park', 'cafe'],
  commando: ['culture', 'park', 'cafe'],
  couple:   ['park', 'culture', 'cafe'],
  quiet:    ['park', 'culture'],
  budget:   ['culture', 'park', 'cafe'],
}

const CAFE_MAX = {
  relax: 1, artsy: 1, commando: 2, couple: 1, quiet: 0, budget: 1,
}

const STYLE_STAY_MULTIPLIER = {
  relax: 1.3, artsy: 1.2, commando: 0.7, couple: 1.4, quiet: 1.1, budget: 0.9,
}

// ==================== 工具函数 ====================

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

function getLM(item) {
  return item.landmark || item
}

// ==================== 半径筛选 ====================

export function filterByRadius(userLat, userLng, landmarks, minKm = 0.2, maxKm = 5.0) {
  return landmarks
    .map((lm) => ({ landmark: lm, distance: haversineDistance(userLat, userLng, lm.lat, lm.lng) }))
    .filter((item) => item.distance >= minKm && item.distance <= maxKm)
    .sort((a, b) => a.distance - b.distance)
}

// ==================== 跨代去重 ====================

function pickFreshFirst(pool, excludeIds, count) {
  const excludeSet = new Set(excludeIds || [])
  const fresh = [], used = []
  for (const item of pool) {
    if (excludeSet.has(getLM(item).id)) used.push(item)
    else fresh.push(item)
  }
  shuffle(fresh); shuffle(used)
  const result = fresh.slice(0, count)
  if (result.length < count) result.push(...used.slice(0, count - result.length))
  return result
}

// ==================== 核心抽取 ====================

export function pickOnePerCategory(filtered, excludeIds = []) {
  const groups = { culture: [], cafe: [], park: [] }
  const excludeSet = new Set(excludeIds)
  for (const item of filtered) {
    const cat = getLM(item).category
    if (groups[cat]) groups[cat].push(item)
  }

  const result = {}
  const entries = Object.entries(groups)
  shuffle(entries)

  for (const [key, list] of entries) {
    if (list.length === 0) continue
    const fresh = list.filter((item) => !excludeSet.has(getLM(item).id))
    const pool = fresh.length > 0 ? fresh : list
    const sp = [...pool]; shuffle(sp)
    result[key] = sp[0]
  }

  const picked = Object.values(result)
  return picked.length >= 2 ? result : null
}

function pickByStyle(filtered, targetCategories, targetCount, style, excludeIds = [], timeBudget = '2h') {
  const groups = {}
  for (const item of filtered) {
    const cat = getLM(item).category
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(item)
  }

  // 预算模式
  if (style === 'budget') {
    for (const cat of Object.keys(groups)) {
      groups[cat].sort((a, b) => {
        const ca = getLM(a).cost, cb = getLM(b).cost
        return (ca != null ? ca : 50) - (cb != null ? cb : 50)
      })
    }
  }

  // 社恐
  if (style === 'quiet') {
    for (const cat of Object.keys(groups)) {
      const q = groups[cat].filter(item => { const r = getLM(item).rating; return r == null || r <= 4.5 })
      if (q.length >= 2) groups[cat] = q
    }
  }

  const foodMin = TIME_FOOD_MIN[timeBudget] || 0
  const hasFood = groups['food']?.length > 0
  const allCats = [...targetCategories]
  if (hasFood && foodMin > 0 && !allCats.includes('food')) allCats.push('food')

  const availableCats = allCats.filter((cat) => groups[cat]?.length > 0)
  if (availableCats.length === 0) return []

  const freshPools = {}
  for (const cat of availableCats) freshPools[cat] = pickFreshFirst(groups[cat], excludeIds, groups[cat].length)

  const maxPerCat = Math.max(1, Math.ceil(targetCount / availableCats.length))
  const catCounts = {}; for (const cat of availableCats) catCounts[cat] = 0
  const picked = [], usedInThisRoute = new Set()
  let lastCat = null
  const cafeMax = CAFE_MAX[style] ?? 2

  // R1: 每类别 ≥1
  const shuffledCats = [...availableCats]; shuffle(shuffledCats)
  for (const cat of shuffledCats) {
    if (picked.length >= targetCount) break
    if (cat === 'cafe' && cafeMax === 0) continue
    const pool = freshPools[cat].filter((item) => !usedInThisRoute.has(getLM(item).id))
    if (pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length)
      picked.push(pool[idx]); usedInThisRoute.add(getLM(pool[idx]).id)
      catCounts[cat]++; lastCat = cat
    }
  }

  // R2: 填满
  let safety = 0
  while (picked.length < targetCount && safety < targetCount * 5) {
    safety++
    const eligible = availableCats.filter((cat) => {
      if (catCounts[cat] >= maxPerCat) return false
      if (cat === 'cafe' && catCounts[cat] >= cafeMax) return false
      return freshPools[cat].some((item) => !usedInThisRoute.has(getLM(item).id))
    })
    if (eligible.length === 0) break

    const weighted = []
    for (const cat of eligible) {
      let w = 1 + (maxPerCat - catCounts[cat]) * 3
      if (cat !== lastCat) w *= 2
      for (let i = 0; i < w; i++) weighted.push(cat)
    }

    const chosenCat = weighted[Math.floor(Math.random() * weighted.length)]
    const pool = freshPools[chosenCat].filter((item) => !usedInThisRoute.has(getLM(item).id))
    if (pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length)
      picked.push(pool[idx]); usedInThisRoute.add(getLM(pool[idx]).id)
      catCounts[chosenCat]++; lastCat = chosenCat
    }
  }

  // R3: 餐饮补足
  const fc = catCounts['food'] || 0
  if (hasFood && fc < foodMin) {
    const deficit = foodMin - fc
    const replaceTargets = picked.map((item, i) => ({ item, i, cat: getLM(item).category })).filter(x => x.cat === 'cafe').slice(0, deficit)
    const foodPool = freshPools['food']?.filter((item) => !usedInThisRoute.has(getLM(item).id)) || []
    for (let j = 0; j < Math.min(deficit, replaceTargets.length); j++) {
      if (foodPool.length > j) {
        const { i } = replaceTargets[j]
        usedInThisRoute.add(getLM(foodPool[j]).id)
        picked[i] = foodPool[j]; catCounts['food'] = (catCounts['food'] || 0) + 1
      }
    }
    const stillNeed = foodMin - (catCounts['food'] || 0)
    if (stillNeed > 0 && foodPool.length > (catCounts['food'] || 0)) {
      const insertPos = Math.floor(picked.length / 2)
      for (let k = 0; k < stillNeed && k < foodPool.length; k++) {
        if (!usedInThisRoute.has(getLM(foodPool[k]).id)) {
          usedInThisRoute.add(getLM(foodPool[k]).id)
          picked.splice(insertPos + k, 0, foodPool[k])
        }
      }
    }
  }

  return picked
}

// ==================== 最近邻排序 ====================

/**
 * @param {Array}  picked  被选中的地点列表
 * @param {number} userLat / userLng
 * @param {number} speed   出行方式速度 (m/s)，用于算 time
 * @returns {Array} ordered route with walkingDist(km) + walkingTime(min)
 */
export function orderByGreedy(picked, userLat, userLng, speed = 1.2) {
  const points = [...picked]
  if (points.length === 0) return []
  if (points.length === 1) {
    const lm = getLM(points[0])
    const dist = haversineDistance(userLat, userLng, lm.lat, lm.lng)
    // walkingDist=km, walkingTime=min
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

/**
 * @param {Array}  orderedRoute
 * @param {object} preferences  { transport, style, time }
 * @returns {{ totalWalkingDist, totalStayTime, totalTime, totalStops, routeSummary }}
 */
export function computeSummary(orderedRoute, preferences = null) {
  const transport = preferences?.transport || 'walk'
  const tConfig = TRANSPORT_CONFIG[transport] || TRANSPORT_CONFIG.walk
  const speed = tConfig.speed
  const travelLabel = tConfig.label

  const stayMultiplier = preferences ? (STYLE_STAY_MULTIPLIER[preferences.style] || 1.0) : 1.0
  const totalWalkingDist = orderedRoute.reduce((sum, s) => sum + (s.walkingDist || 0), 0)
  const totalStayTime = orderedRoute.reduce((sum, s) => sum + Math.round(((getLM(s).suggestedStay || 30) * stayMultiplier)), 0)
  // walkingTime = dist(km) * 1000 / speed(m/s) / 60 → 分钟
  const travelTime = totalWalkingDist * 1000 / speed / 60
  const totalTime = Math.round((travelTime + totalStayTime) * 1.2)

  const routeSummary = orderedRoute.map((s, idx) => {
    const lm = getLM(s)
    return {
      order: idx + 1, name: lm.name, category: lm.category,
      description: lm.description, tip: lm.tip,
      stayMinutes: Math.round((lm.suggestedStay || 30) * stayMultiplier),
      photoUrl: lm.photos?.[0] || null, photos: lm.photos || [],
      address: lm.address || '', rating: lm.rating || null, cost: lm.cost || null,
      walkingFromPrev: s.walkingDist
        ? `${(s.walkingDist * 1000).toFixed(0)}m (约${Math.round(s.walkingTime)}分钟${travelLabel})`
        : '出发点',
    }
  })

  return { totalWalkingDist: Math.round(totalWalkingDist * 1000), totalStayTime, totalTime, totalStops: orderedRoute.length, routeSummary }
}

// ==================== 总里程校验 ====================

/**
 * 计算排序后路线的总 haversine 距离 (km)
 */
function calcTotalDistance(orderedRoute) {
  return orderedRoute.reduce((sum, s) => sum + (s.walkingDist || 0), 0)
}

/**
 * 校验路线是否在出行方式的单日里程限制内
 * @returns {boolean}
 */
function routeWithinLimit(orderedRoute, tConfig) {
  const totalKm = calcTotalDistance(orderedRoute)
  const totalMeters = totalKm * 1000
  return totalMeters <= tConfig.maxDailyDistance
}

// ==================== 主导出 ====================

/**
 * @param {number}  userLat / userLng
 * @param {Array}   landmarks   高德 API 返回的全部 POI
 * @param {object}  preferences {transport, time, style}
 * @param {Array}   excludeIds  历史去重 ID 列表
 * @returns {{ success, orderedRoute?, summary?, days?, error? }}
 */
export function generateRoute(userLat, userLng, landmarks, preferences = null, excludeIds = []) {
  const transport = preferences?.transport || 'walk'
  const tConfig = TRANSPORT_CONFIG[transport] || TRANSPORT_CONFIG.walk
  let targetCount = 3, targetCategories = ['culture', 'cafe', 'park'], style = null, timeBudget = '2h'

  if (preferences) {
    targetCount = TIME_TO_COUNT[preferences.time] || targetCount
    timeBudget = preferences.time || '2h'
    targetCategories = [...(STYLE_CATEGORIES[preferences.style] || ['culture', 'cafe', 'park'])]
    shuffle(targetCategories)
    style = preferences.style
  }

  // Step 1: 半径筛选 (使用出行方式配置的动态上下限) → 逐级兜底
  let filtered = filterByRadius(userLat, userLng, landmarks, tConfig.filterMinKm, tConfig.filterMaxKm)
  if (filtered.length < targetCount) {
    for (const tierKm of tConfig.fallbackTiers) {
      filtered = filterByRadius(userLat, userLng, landmarks, tConfig.filterMinKm, tierKm)
      if (filtered.length >= targetCount) break
    }
    // 最后一搏：不设上限
    if (filtered.length < targetCount) {
      filtered = filterByRadius(userLat, userLng, landmarks, 0, tConfig.filterMaxKm)
    }
  }

  if (filtered.length < 2) {
    return { success: false, error: `附近 ${tConfig.filterMaxKm}km 内找不到足够地标，换个位置试试吧~` }
  }

  // Step 2: 多天路线 → 分天处理
  const isMultiDay = timeBudget === '1d' || timeBudget === '2d'
  if (isMultiDay) {
    return buildMultiDayRoute(filtered, targetCategories, targetCount, style, preferences, excludeIds, timeBudget, userLat, userLng, tConfig)
  }

  // Step 3: 单天路线 (含里程校验重试)
  return buildSingleRoute(filtered, targetCategories, targetCount, style, preferences, excludeIds, timeBudget, userLat, userLng, tConfig)
}

// ==================== 单天路线 (含里程校验重试) ====================

const MAX_RETRIES = 30

function buildSingleRoute(filtered, targetCategories, targetCount, style, preferences, excludeIds, timeBudget, userLat, userLng, tConfig) {
  const speed = tConfig.speed
  const maxDailyMeters = tConfig.maxDailyDistance

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let picked

    if (preferences) {
      picked = pickByStyle(filtered, targetCategories, targetCount, style, excludeIds, timeBudget)
    } else {
      const pm = pickOnePerCategory(filtered, excludeIds)
      if (pm) { picked = Object.values(pm) }
      else {
        const fb = ['culture', 'cafe', 'park']; shuffle(fb)
        picked = pickByStyle(filtered, fb, 2, null, excludeIds, timeBudget)
      }
    }

    if (!picked || picked.length < 2) {
      picked = pickByStyle(filtered, targetCategories, Math.max(targetCount, 2), style, [], timeBudget)
      if (!picked || picked.length < 2) {
        return { success: false, error: '找不到足够多的不同地点，请换个区域试试' }
      }
    }

    const ordered = orderByGreedy(picked, userLat, userLng, speed)

    // 里程校验
    if (routeWithinLimit(ordered, tConfig)) {
      return {
        success: true,
        route: ordered.map((s) => getLM(s)),
        orderedRoute: ordered,
        summary: computeSummary(ordered, preferences),
      }
    }

    const totalMeters = Math.round(calcTotalDistance(ordered) * 1000)
    console.log(`[RouteGen] 路线 ${totalMeters}m > 限制 ${maxDailyMeters}m，重试 (${attempt + 1}/${MAX_RETRIES})`)
  }

  return { success: false, error: `无法在${tConfig.label} ${(maxDailyMeters / 1000).toFixed(1)}km 限制内生成路线，请扩容出行方式或换个区域` }
}

/** 多天路线：一次性抽取全部地点 → 按天分组 → 每天独立最近邻排序 + 独立里程校验 */
function buildMultiDayRoute(filtered, targetCategories, targetCount, style, preferences, excludeIds, timeBudget, userLat, userLng, tConfig) {
  const split = DAY_SPLITS[timeBudget] || [4, 4]
  const dayLabels = ['Day 1', 'Day 2']
  const speed = tConfig.speed

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // 一次性抽取全部 targetCount 个地点
    let picked
    if (preferences) {
      picked = pickByStyle(filtered, targetCategories, targetCount, style, excludeIds, timeBudget)
    } else {
      const fb = ['culture', 'cafe', 'park']; shuffle(fb)
      picked = pickByStyle(filtered, fb, targetCount, null, excludeIds, timeBudget)
    }

    if (!picked || picked.length < split[0] + 1) {
      picked = pickByStyle(filtered, targetCategories, targetCount, style, [], timeBudget)
      if (!picked || picked.length < split[0] + 1) {
        return { success: false, error: '附近地标不够组成多天路线，试试单天方案' }
      }
    }

    // 按用户距离分组：最近的一半归 Day1，较远的一半归 Day2
    const withDist = picked.map((p) => ({
      ...p,
      _udist: haversineDistance(userLat, userLng, getLM(p).lat, getLM(p).lng),
    }))
    withDist.sort((a, b) => a._udist - b._udist)

    const day1Pool = withDist.slice(0, split[0])
    const day2Pool = withDist.slice(split[0], split[0] + split[1])

    // 每天独立最近邻排序
    const day1Ordered = orderByGreedy(day1Pool, userLat, userLng, speed)
    const day2Ordered = orderByGreedy(day2Pool, userLat, userLng, speed)

    // 每天独立里程校验
    if (!routeWithinLimit(day1Ordered, tConfig) || !routeWithinLimit(day2Ordered, tConfig)) {
      const d1 = Math.round(calcTotalDistance(day1Ordered) * 1000)
      const d2 = Math.round(calcTotalDistance(day2Ordered) * 1000)
      console.log(`[RouteGen] 多天路线 ${d1}m / ${d2}m 超出限制，重试 (${attempt + 1}/${MAX_RETRIES})`)
      continue
    }

    const day1Summary = computeSummary(day1Ordered, preferences)
    const day2Summary = computeSummary(day2Ordered, preferences)

    const allOrdered = [...day1Ordered, ...day2Ordered]
    const totalSummary = computeSummary(allOrdered, preferences)

    return {
      success: true,
      route: allOrdered.map((s) => getLM(s)),
      orderedRoute: allOrdered,
      summary: totalSummary,
      days: [
        { label: dayLabels[0], orderedRoute: day1Ordered, summary: day1Summary },
        { label: dayLabels[1], orderedRoute: day2Ordered, summary: day2Summary },
      ],
    }
  }

  return { success: false, error: `无法在${tConfig.label}限制内生成多天路线，请扩容出行方式或选单天方案` }
}
