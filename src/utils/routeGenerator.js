/**
 * 路线生成器 — 100% 依赖高德周边搜索 API，同城/周边 10km 以内
 *
 * 流程:
 *  1. 高德 place/around: radius=10000m → 获取周边 POI
 *  2. 根据出行方式做二次距离精筛
 *  3. 根据风格模式确定目标类别和数量
 *  4. Fisher-Yates 洗牌 + 类别多样性抽选
 *  5. 最近邻排序：用户位置 → 最近 → 次近 → ...
 *  6. 1天/2天路线: 多抽点，按天分组，每天独立最近邻排序
 *
 * 偏好参数:
 *  - transport: 'walk' | 'subway' | 'taxi'
 *  - time:      '1h'|'2h'|'3h'|'5h'|'1d'|'2d'
 *  - style:     'relax'|'artsy'|'commando'|'couple'|'quiet'|'budget'
 *  - excludeIds: string[] — 跨代去重
 */

// ==================== Haversine ====================
function toRad(deg) { return (deg * Math.PI) / 180 }

export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ==================== 偏好配置 ====================

/** 出行方式 → 二次精筛半径 (km)，上限硬封 10km */
const TRANSPORT_RADIUS = {
  walk:   { min: 0.3, max: 4.0 },
  subway: { min: 1.0, max: 8.0 },
  taxi:   { min: 2.0, max: 10.0 },
}

/** 逐级兜底 (km)，最远不超 10 */
const FALLBACK_TIERS = [3, 6, 10]

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

export function filterByRadius(userLat, userLng, landmarks, minKm = 0.3, maxKm = 5.0) {
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

export function orderByGreedy(picked, userLat, userLng) {
  const points = [...picked]
  if (points.length === 0) return []
  if (points.length === 1) {
    const lm = getLM(points[0])
    const dist = haversineDistance(userLat, userLng, lm.lat, lm.lng)
    return [{ ...points[0], walkingDist: dist, walkingTime: dist * 15 }]
  }

  let nearestIdx = 0, nearestDist = Infinity
  points.forEach((p, i) => {
    const d = haversineDistance(userLat, userLng, getLM(p).lat, getLM(p).lng)
    if (d < nearestDist) { nearestDist = d; nearestIdx = i }
  })

  const first = points.splice(nearestIdx, 1)[0]
  const ordered = [{ ...first, walkingDist: nearestDist, walkingTime: nearestDist * 15 }]

  while (points.length > 0) {
    const lastLM = getLM(ordered[ordered.length - 1])
    let nextIdx = 0, nextDist = Infinity
    points.forEach((p, i) => {
      const d = haversineDistance(lastLM.lat, lastLM.lng, getLM(p).lat, getLM(p).lng)
      if (d < nextDist) { nextDist = d; nextIdx = i }
    })
    const next = points.splice(nextIdx, 1)[0]
    ordered.push({ ...next, walkingDist: nextDist, walkingTime: nextDist * 15 })
  }

  return ordered
}

// ==================== 路线总览 ====================

export function computeSummary(orderedRoute, preferences = null) {
  const stayMultiplier = preferences ? (STYLE_STAY_MULTIPLIER[preferences.style] || 1.0) : 1.0
  const totalWalkingDist = orderedRoute.reduce((sum, s) => sum + (s.walkingDist || 0), 0)
  const totalStayTime = orderedRoute.reduce((sum, s) => sum + Math.round(((getLM(s).suggestedStay || 30) * stayMultiplier)), 0)
  const walkingTime = totalWalkingDist * 15
  const totalTime = Math.round((walkingTime + totalStayTime) * 1.2)

  const routeSummary = orderedRoute.map((s, idx) => {
    const lm = getLM(s)
    return {
      order: idx + 1, name: lm.name, category: lm.category,
      description: lm.description, tip: lm.tip,
      stayMinutes: Math.round((lm.suggestedStay || 30) * stayMultiplier),
      photoUrl: lm.photos?.[0] || null, photos: lm.photos || [],
      address: lm.address || '', rating: lm.rating || null, cost: lm.cost || null,
      walkingFromPrev: s.walkingDist
        ? `${(s.walkingDist * 1000).toFixed(0)}m (约${Math.round(s.walkingTime)}分钟步行)`
        : '出发点',
    }
  })

  return { totalWalkingDist: Math.round(totalWalkingDist * 1000), totalStayTime, totalTime, totalStops: orderedRoute.length, routeSummary }
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
  let radiusConfig = { min: 0.3, max: 5.0 }
  let targetCount = 3, targetCategories = ['culture', 'cafe', 'park'], style = null, timeBudget = '2h', transport = 'walk'

  if (preferences) {
    radiusConfig = TRANSPORT_RADIUS[preferences.transport] || radiusConfig
    targetCount = TIME_TO_COUNT[preferences.time] || targetCount
    timeBudget = preferences.time || '2h'
    transport = preferences.transport || 'walk'
    targetCategories = [...(STYLE_CATEGORIES[preferences.style] || ['culture', 'cafe', 'park'])]
    shuffle(targetCategories)
    style = preferences.style
  }

  // Step 1: 半径筛选 → 逐级兜底
  let filtered = filterByRadius(userLat, userLng, landmarks, radiusConfig.min, radiusConfig.max)
  if (filtered.length < targetCount) {
    for (const tierKm of FALLBACK_TIERS) {
      filtered = filterByRadius(userLat, userLng, landmarks, 0.3, tierKm)
      if (filtered.length >= targetCount) break
    }
  }

  if (filtered.length < 2) {
    return { success: false, error: '附近 10km 内找不到足够地标，换个位置试试吧~' }
  }

  // Step 2: 多天路线 → 分天处理
  const isMultiDay = timeBudget === '1d' || timeBudget === '2d'
  if (isMultiDay) {
    return buildMultiDayRoute(filtered, targetCategories, targetCount, style, preferences, excludeIds, timeBudget, userLat, userLng)
  }

  // Step 3: 单天路线
  return buildSingleRoute(filtered, targetCategories, targetCount, style, preferences, excludeIds, timeBudget, userLat, userLng)
}

function buildSingleRoute(filtered, targetCategories, targetCount, style, preferences, excludeIds, timeBudget, userLat, userLng) {
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

  const ordered = orderByGreedy(picked, userLat, userLng)
  return {
    success: true,
    route: ordered.map((s) => getLM(s)),
    orderedRoute: ordered,
    summary: computeSummary(ordered, preferences),
  }
}

/** 多天路线：一次性抽取全部地点 → 按天分组 → 每天独立最近邻排序 */
function buildMultiDayRoute(filtered, targetCategories, targetCount, style, preferences, excludeIds, timeBudget, userLat, userLng) {
  const split = DAY_SPLITS[timeBudget] || [4, 4]
  const dayLabels = ['Day 1', 'Day 2']

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
  const day1Ordered = orderByGreedy(day1Pool, userLat, userLng)
  const day2Ordered = orderByGreedy(day2Pool, userLat, userLng)

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
