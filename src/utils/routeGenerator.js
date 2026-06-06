/**
 * 路线生成器 — 核心随机筛选逻辑 + 用户偏好支持 + 跨代去重
 *
 * 流程:
 *  1. 获取用户位置
 *  2. 根据出行方式确定搜索半径
 *  3. 计算所有地标到用户的直线距离 (Haversine公式)
 *  4. 筛选范围内地标
 *  5. 根据风格模式确定目标类别和数量
 *  6. 按类别分组后随机抽取（优先排除近期已使用的地标）
 *  7. 用贪心算法排列顺序以最小化步行距离
 *  8. 返回路线 (含总距离、预估时间)
 *
 * 偏好参数:
 *  - transport: 'walk' | 'subway' | 'taxi'  → 搜索半径
 *  - time:      '1h'|'2h'|'3h'|'5h'|'1d'|'2d' → 地标数量
 *  - style:     'relax'|'artsy'|'commando'|'couple'|'quiet'|'budget' → 类别组合
 *  - excludeIds: string[] — 跨代去重：近期已使用的 landmark ID 列表
 */

// ==================== Haversine 距离计算 ====================
function toRad(deg) {
  return (deg * Math.PI) / 180
}

/**
 * 计算两点间的球面距离
 * @returns {number} 距离 (公里)
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371 // 地球半径 (km)
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// ==================== 偏好配置 ====================

/**
 * 出行方式 → 搜索半径
 */
const TRANSPORT_RADIUS = {
  walk:   { min: 2.0, max: 5.5 },
  subway: { min: 3.0, max: 12.0 },
  taxi:   { min: 5.0, max: 25.0 },
  train:  { min: 8.0, max: 80.0 },   // 高铁/火车：跨城范围
}

/**
 * 时间预算 → 目标地标数量 + 餐饮最低数量
 */
const TIME_TO_COUNT = {
  '1h': 2,
  '2h': 3,
  '3h': 4,
  '5h': 5,
  '1d': 6,
  '2d': 8,
}

const TIME_FOOD_MIN = {
  '1h': 0,
  '2h': 1,
  '3h': 1,
  '5h': 1,
  '1d': 2,
  '2d': 3,
}

/**
 * 风格模式 → 目标类别组合 (按优先级排序)
 * food 在 2h+ 路线中自动追加，不受风格限制
 */
const STYLE_CATEGORIES = {
  relax:    ['park', 'cafe'],
  artsy:    ['culture', 'park', 'cafe'],
  commando: ['culture', 'park', 'cafe'],
  couple:   ['park', 'culture', 'cafe'],
  quiet:    ['park', 'culture'],
  budget:   ['culture', 'park', 'cafe'],
}

/**
 * 咖啡馆硬上限：各类模式下最多选几间咖啡馆
 */
const CAFE_MAX = {
  relax:    1,
  artsy:    1,
  commando: 2,
  couple:   1,
  quiet:    0,    // 社恐模式不要咖啡馆
  budget:   1,
}

/**
 * 风格模式 → 额外停留时间调整系数
 */
const STYLE_STAY_MULTIPLIER = {
  relax:    1.3,
  artsy:    1.2,
  commando: 0.7,
  couple:   1.4,
  quiet:    1.1,
  budget:   0.9,
}

// ==================== 范围筛选 ====================

export function filterByRadius(userLat, userLng, landmarks, minKm = 2.5, maxKm = 5.5) {
  return landmarks
    .map((lm) => ({
      landmark: lm,
      distance: haversineDistance(userLat, userLng, lm.lat, lm.lng),
    }))
    .filter((item) => item.distance >= minKm && item.distance <= maxKm)
    .sort((a, b) => a.distance - b.distance)
}

// ==================== Fisher-Yates 洗牌 ====================
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

// ==================== 跨代去重选择器 ====================

/**
 * 从候选池中抽取 count 个 landmark，优先排除 excludeIds 中的 ID。
 * 若新鲜选项不足，则从不含 excludeIds 的优先 + 含 excludeIds 的候补混合。
 *
 * @param {Array}  pool       候选 [{landmark, distance, ...}]
 * @param {Array}  excludeIds 近期已使用的 landmark ID 列表
 * @param {number} count      需要抽取的数量
 * @returns {Array} 选中的项
 */
function pickFreshFirst(pool, excludeIds, count) {
  const excludeSet = new Set(excludeIds || [])

  // 分为"未使用过"和"已使用过"两组
  const fresh = []
  const used = []
  for (const item of pool) {
    if (excludeSet.has(item.landmark.id)) {
      used.push(item)
    } else {
      fresh.push(item)
    }
  }

  // 各自打乱
  shuffle(fresh)
  shuffle(used)

  // 优先从未使用过的中取
  const result = fresh.slice(0, count)

  // 不够的话从已使用的候补
  if (result.length < count) {
    const needed = count - result.length
    result.push(...used.slice(0, needed))
  }

  return result
}

// ==================== 分类随机选择 (默认模式) ====================

/**
 * 默认模式：三类各选一个，优先排除 excludeIds
 * 修复：不再是任一类别为空就返回 null，而是尽力返回可用类别
 */
export function pickOnePerCategory(filtered, excludeIds = []) {
  const groups = { culture: [], cafe: [], park: [] }
  const excludeSet = new Set(excludeIds)

  for (const item of filtered) {
    const cat = item.landmark.category
    if (groups[cat]) groups[cat].push(item)
  }

  const result = {}
  // 随机化类别处理顺序
  const entries = Object.entries(groups)
  shuffle(entries)

  for (const [key, list] of entries) {
    if (list.length === 0) continue

    // 优先从未使用过的中选
    const fresh = list.filter((item) => !excludeSet.has(item.landmark.id))
    const pool = fresh.length > 0 ? fresh : list
    // 随机打乱后取第一个，避免每次选同一个
    const shuffledPool = [...pool]
    shuffle(shuffledPool)
    result[key] = shuffledPool[0]
  }

  // 至少要有 2 个类别有结果才算成功
  const picked = Object.values(result)
  if (picked.length < 2) return null

  return result
}

// ==================== 按风格偏好抽取 ====================

/**
 * 按风格偏好抽取指定数量的地标
 *
 * @param {Array}   filtered         已按距离筛选的地标列表
 * @param {Array}   targetCategories 目标类别 (按优先级)
 * @param {number}  targetCount      目标数量
 * @param {string}  style            风格模式
 * @param {Array}   excludeIds       近期已使用的 landmark ID 列表
 * @param {string}  timeBudget       时间预算 (用于餐饮最低数)
 * @param {string}  transport        出行方式 (用于跨城判断)
 * @returns {Array} 选中的 landmark 条目 [{landmark, distance, ...}]
 */
function pickByStyle(filtered, targetCategories, targetCount, style, excludeIds = [], timeBudget = '2h', transport = 'walk') {
  // === 跨城模式：1天/2天 + 高铁（有防递归保护）===
  const isCrossCity = (timeBudget === '1d' || timeBudget === '2d') && transport === 'train'
  if (isCrossCity && !_crossCityGuard) {
    const result = pickCrossCity(filtered, targetCategories, targetCount, style, excludeIds, timeBudget)
    if (result && result.length >= 2) return result
    // 跨城失败 → 退化为普通模式继续
    _crossCityGuard = false
  }
  _crossCityGuard = false

  // 按类别分组
  const groups = {}
  for (const item of filtered) {
    const cat = item.landmark.category
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(item)
  }

  // 预算模式: 排序
  if (style === 'budget') {
    for (const cat of Object.keys(groups)) {
      groups[cat].sort((a, b) => {
        const costA = a.landmark.cost, costB = b.landmark.cost
        return (costA != null ? costA : 50) - (costB != null ? costB : 50)
      })
    }
  }

  // 社恐模式: 过滤高分
  if (style === 'quiet') {
    for (const cat of Object.keys(groups)) {
      const quieter = groups[cat].filter(item => {
        const r = item.landmark.rating
        return r === null || r === undefined || r <= 4.5
      })
      if (quieter.length >= 2) groups[cat] = quieter
    }
  }

  // 决定可用类别：food 只在 food pool 非空时加入
  const foodMin = TIME_FOOD_MIN[timeBudget] || 0
  const hasFood = groups['food']?.length > 0
  const allCats = [...targetCategories]
  if (hasFood && foodMin > 0 && !allCats.includes('food')) {
    allCats.push('food')
  }

  const availableCats = allCats.filter((cat) => groups[cat]?.length > 0)
  if (availableCats.length === 0) return []

  // 预处理
  const freshPools = {}
  for (const cat of availableCats) {
    freshPools[cat] = pickFreshFirst(groups[cat], excludeIds, groups[cat].length)
  }

  const maxPerCat = Math.max(1, Math.ceil(targetCount / availableCats.length))
  const catCounts = {}
  for (const cat of availableCats) catCounts[cat] = 0

  const picked = []
  const usedInThisRoute = new Set()
  let lastCat = null
  const cafeMax = CAFE_MAX[style] ?? 2

  // === 第一轮: 每类别至少1个 ===
  const shuffledCats = [...availableCats]
  shuffle(shuffledCats)

  for (const cat of shuffledCats) {
    if (picked.length >= targetCount) break
    if (cat === 'cafe' && cafeMax === 0) continue
    const pool = freshPools[cat].filter((item) => !usedInThisRoute.has(item.landmark.id))
    if (pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length)
      picked.push(pool[idx])
      usedInThisRoute.add(pool[idx].landmark.id)
      catCounts[cat]++
      lastCat = cat
    }
  }

  // === 第二轮: 填满 ===
  let safety = 0
  while (picked.length < targetCount && safety < targetCount * 5) {
    safety++

    const eligible = availableCats.filter((cat) => {
      if (catCounts[cat] >= maxPerCat) return false
      if (cat === 'cafe' && catCounts[cat] >= cafeMax) return false
      const pool = freshPools[cat].filter((item) => !usedInThisRoute.has(item.landmark.id))
      return pool.length > 0
    })

    if (eligible.length === 0) break

    const weighted = []
    for (const cat of eligible) {
      let weight = 1 + (maxPerCat - catCounts[cat]) * 3
      if (cat !== lastCat) weight *= 2
      for (let i = 0; i < weight; i++) weighted.push(cat)
    }

    const chosenCat = weighted[Math.floor(Math.random() * weighted.length)]
    const pool = freshPools[chosenCat].filter((item) => !usedInThisRoute.has(item.landmark.id))

    if (pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length)
      picked.push(pool[idx])
      usedInThisRoute.add(pool[idx].landmark.id)
      catCounts[chosenCat]++
      lastCat = chosenCat
    }
  }

  // === 第三轮: 餐饮最低数强制补足 ===
  const foodCount = catCounts['food'] || 0
  if (hasFood && foodCount < foodMin) {
    const deficit = foodMin - foodCount
    // 尝试替换掉多余的 cafe（优先），其次替换 maxPerCat 超标类别
    const replaceTargets = picked
      .map((item, i) => ({ item, i, cat: item.landmark.category }))
      .filter(x => x.cat === 'cafe')  // 优先替换咖啡馆
      .slice(0, deficit)

    const foodPool = freshPools['food']?.filter((item) => !usedInThisRoute.has(item.landmark.id)) || []

    for (let j = 0; j < Math.min(deficit, replaceTargets.length); j++) {
      if (foodPool.length > j) {
        const { i } = replaceTargets[j]
        const foodItem = foodPool[j]
        usedInThisRoute.add(foodItem.landmark.id)
        picked[i] = foodItem
        catCounts['food'] = (catCounts['food'] || 0) + 1
      }
    }

    // 如果替换不够，直接 insert 到 route 中间
    const stillNeed = foodMin - (catCounts['food'] || 0)
    if (stillNeed > 0 && foodPool.length > (catCounts['food'] || 0)) {
      const insertPos = Math.floor(picked.length / 2)
      for (let k = 0; k < stillNeed && k < foodPool.length; k++) {
        if (!usedInThisRoute.has(foodPool[k].landmark.id)) {
          usedInThisRoute.add(foodPool[k].landmark.id)
          picked.splice(insertPos + k, 0, foodPool[k])
        }
      }
    }
  }

  return picked
}

// ==================== 跨城路线 ====================

/**
 * 安全获取 landmark 对象（兼容两种数据格式）：
 *   格式A (filterByRadius 包装):  { landmark: {...}, distance: number }
 *   格式B (API 原始数据):         { id, name, lat, lng, category, ... }
 */
function getLM(item) {
  return item.landmark || item
}

/**
 * 交叉防递归开关 — 防止跨城→fallback→跨城 无限循环
 */
let _crossCityGuard = false

/**
 * 跨城模式：1天/2天 + 高铁 → 从 2-3 个城市各选 2-4 个地标
 */
function pickCrossCity(allLandmarks, targetCategories, targetCount, style, excludeIds, timeBudget) {
  // 按城市分组
  const cityGroups = {}
  for (const item of allLandmarks) {
    const lm = getLM(item)
    const city = lm.city || lm.address?.slice(0, 4) || 'other'
    if (!cityGroups[city]) cityGroups[city] = []
    cityGroups[city].push(item)
  }

  const cities = Object.keys(cityGroups)
  if (cities.length < 2) {
    // 只有一个城市/未知城市 → 退化为普通模式，不走回头路
    _crossCityGuard = true
    return null  // 让上层 fallback 用 walk 模式重试
  }

  // 确定跨城数量
  const numCities = Math.min(timeBudget === '2d' ? 3 : 2, cities.length)
  const perCity = Math.max(2, Math.floor(targetCount / numCities))
  const foodMin = TIME_FOOD_MIN[timeBudget] || 2

  const shuffledCities = [...cities]
  shuffle(shuffledCities)
  const chosenCities = shuffledCities.slice(0, numCities)

  const picked = []
  const usedInThisRoute = new Set()
  const cafeMax = CAFE_MAX[style] ?? 2
  let cafeCount = 0
  let foodCount = 0

  for (const city of chosenCities) {
    const cityLandmarks = cityGroups[city]
    const need = Math.min(perCity, targetCount - picked.length)
    if (need <= 0) break

    const groups = {}
    for (const item of cityLandmarks) {
      const cat = getLM(item).category || 'culture'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    }

    const categoryOrder = [...targetCategories]
    if (!categoryOrder.includes('food')) categoryOrder.push('food')
    categoryOrder.sort((a) => a === 'cafe' ? 1 : 0)

    let cityPicked = 0
    for (const cat of categoryOrder) {
      if (cityPicked >= need) break
      if (!groups[cat]) continue
      if (cat === 'cafe' && cafeCount >= cafeMax) continue

      const pool = groups[cat].filter((item) => !usedInThisRoute.has(getLM(item).id))
      if (pool.length === 0) continue

      const shuffled = [...pool]
      shuffle(shuffled)
      const item = shuffled[0]
      picked.push(item)
      usedInThisRoute.add(getLM(item).id)
      if (cat === 'cafe') cafeCount++
      if (cat === 'food') foodCount++
      cityPicked++
    }

    // 如果这个城市选不够，尝试从该城市其他类别补
    if (cityPicked < need) {
      const remaining = cityLandmarks.filter((item) => !usedInThisRoute.has(getLM(item).id))
      shuffle(remaining)
      for (const item of remaining) {
        if (cityPicked >= need) break
        const cat = getLM(item).category || 'other'
        if (cat === 'cafe' && cafeCount >= cafeMax) continue
        picked.push(item)
        usedInThisRoute.add(getLM(item).id)
        if (cat === 'cafe') cafeCount++
        if (cat === 'food') foodCount++
        cityPicked++
      }
    }
  }

  // 补足餐饮最低数
  if (foodCount < foodMin) {
    const deficit = foodMin - foodCount
    const allFoodPool = allLandmarks
      .filter(l => getLM(l).category === 'food' && !usedInThisRoute.has(getLM(l).id))
    shuffle(allFoodPool)
    for (let k = 0; k < Math.min(deficit, allFoodPool.length); k++) {
      picked.push(allFoodPool[k])
      usedInThisRoute.add(getLM(allFoodPool[k]).id)
    }
  }

  return picked.length >= 2 ? picked.slice(0, targetCount) : null
}

// ==================== 路径排序 (最近邻算法、不走回头路) ====================

/**
 * 最近邻排序 — 以用户位置为起点，依次找距离当前点最近的下一个
 *
 * 排序规则:
 *   起点: 用户坐标 (userLat, userLng)
 *   Step 1: 从所有候选中找出离用户最近的点 → Spot 1
 *   Step 2: 从剩余候选中找出离 Spot 1 最近的点 → Spot 2
 *   Step 3: 从剩余中找离 Spot 2 最近的 → Spot 3
 *   ...以此类推
 *
 * @param {Array}   picked   已选中的地标 [{landmark, distance}, ...]
 * @param {number}  userLat  用户纬度
 * @param {number}  userLng  用户经度
 * @returns {Array} 排序后的地标 [{..., walkingDist, walkingTime}, ...]
 */
export function orderByGreedy(picked, userLat, userLng) {
  const points = [...picked]
  if (points.length === 0) return []

  // 只有 1 个点：直接计算从用户出发的距离
  if (points.length === 1) {
    const onlyLM = getLM(points[0])
    const dist = haversineDistance(userLat, userLng, onlyLM.lat, onlyLM.lng)
    return [{ ...points[0], walkingDist: dist, walkingTime: dist * 15 }]
  }

  // ===== Step 1: 从用户位置出发，找最近的点作为 Spot 1 =====
  let nearestIdx = 0
  let nearestDist = Infinity

  points.forEach((p, i) => {
    const lm = getLM(p)
    const d = haversineDistance(userLat, userLng, lm.lat, lm.lng)
    if (d < nearestDist) { nearestDist = d; nearestIdx = i }
  })

  const first = points.splice(nearestIdx, 1)[0]
  const ordered = [{ ...first, walkingDist: nearestDist, walkingTime: nearestDist * 15 }]

  // ===== Step 2–N: 贪心最近邻串联剩余点 =====
  while (points.length > 0) {
    const lastLM = getLM(ordered[ordered.length - 1])
    let nextIdx = 0
    let nextDist = Infinity

    points.forEach((p, i) => {
      const lm = getLM(p)
      const d = haversineDistance(lastLM.lat, lastLM.lng, lm.lat, lm.lng)
      if (d < nextDist) { nextDist = d; nextIdx = i }
    })

    const next = points.splice(nextIdx, 1)[0]
    ordered.push({ ...next, walkingDist: nextDist, walkingTime: nextDist * 15 })
  }

  return ordered
}

// ==================== 路线总览计算 ====================

export function computeSummary(orderedRoute, preferences = null) {
  const stayMultiplier = preferences
    ? (STYLE_STAY_MULTIPLIER[preferences.style] || 1.0)
    : 1.0

  const totalWalkingDist = orderedRoute.reduce((sum, s) => sum + (s.walkingDist || 0), 0)
  const totalStayTime = orderedRoute.reduce(
    (sum, s) => sum + Math.round(((getLM(s).suggestedStay || 30) * stayMultiplier)),
    0
  )
  const walkingTime = totalWalkingDist * 15
  const totalTime = Math.round((walkingTime + totalStayTime) * 1.2)

  const routeSummary = orderedRoute.map((s, idx) => {
    const lm = getLM(s)
    return {
      order: idx + 1,
      name: lm.name,
      category: lm.category,
      description: lm.description,
      tip: lm.tip,
      stayMinutes: Math.round((lm.suggestedStay || 30) * stayMultiplier),
      photoUrl: lm.photos?.[0] || null,
      photos: lm.photos || [],
      address: lm.address || '',
      rating: lm.rating || null,
      cost: lm.cost || null,
      walkingFromPrev: s.walkingDist
        ? `${(s.walkingDist * 1000).toFixed(0)}m (约${Math.round(s.walkingTime)}分钟步行)`
        : '出发点',
    }
  })

  return {
    totalWalkingDist: Math.round(totalWalkingDist * 1000),
    totalStayTime,
    totalTime,
    totalStops: orderedRoute.length,
    routeSummary,
  }
}

// ==================== 主导出函数 ====================

/**
 * 生成一条随机漫游路线
 *
 * @param {number}  userLat     用户纬度
 * @param {number}  userLng     用户经度
 * @param {Array}   landmarks   全部地标数据
 * @param {object}  preferences 用户偏好 {transport, time, style} (可选)
 * @param {Array}   excludeIds  近期已使用的 landmark ID 列表 (可选)
 * @returns {{ success: boolean, orderedRoute?: Array, summary?: object, error?: string }}
 */
export function generateRoute(userLat, userLng, landmarks, preferences = null, excludeIds = []) {
  // ===== Step 0: 解析偏好 =====
  let radiusConfig = { min: 2.5, max: 5.5 }
  let targetCount = 3
  let targetCategories = ['culture', 'cafe', 'park']
  let style = null

  let timeBudget = '2h'
  let transport = 'walk'

  if (preferences) {
    radiusConfig = TRANSPORT_RADIUS[preferences.transport] || radiusConfig
    targetCount = TIME_TO_COUNT[preferences.time] || targetCount
    timeBudget = preferences.time || '2h'
    transport = preferences.transport || 'walk'
    // 复制并打乱类别顺序，每次生成都有不同的类别优先级
    targetCategories = [...(STYLE_CATEGORIES[preferences.style] || ['culture', 'cafe', 'park'])]
    shuffle(targetCategories)
    style = preferences.style
  }

  // === 跨城模式：1天/2天 + 高铁，直接使用全部地标 ===
  const isCrossCity = (timeBudget === '1d' || timeBudget === '2d') && transport === 'train'
  if (isCrossCity) {
    return buildRouteWithPreferences(landmarks, targetCategories, targetCount, style, preferences, excludeIds, timeBudget, transport, userLat, userLng)
  }

  // ===== Step 1: 距离筛选 =====
  const filtered = filterByRadius(userLat, userLng, landmarks, radiusConfig.min, radiusConfig.max)

  // 如果范围内地标不够，放宽距离上限再试
  const categoriesInRange = new Set(filtered.map((f) => f.landmark.category))
  const neededCats = targetCategories.filter((c) => !categoriesInRange.has(c))

  if (neededCats.length > 0 || filtered.length < targetCount) {
    const expandedMax = Math.max(radiusConfig.max * 1.6, 15)
    const fallback = filterByRadius(userLat, userLng, landmarks, 1.0, expandedMax)
    const fallbackCats = new Set(fallback.map((f) => f.landmark.category))
    const stillMissing = targetCategories.filter((c) => !fallbackCats.has(c))

    if (stillMissing.length === targetCategories.length || fallback.length < 2) {
      // 最终兜底：放弃距离限制，使用全部地标按距离排序取最近的
      const global = landmarks
        .map((lm) => ({
          landmark: lm,
          distance: haversineDistance(userLat, userLng, lm.lat, lm.lng),
        }))
        .sort((a, b) => a.distance - b.distance)

      if (global.length < 2) {
        return { success: false, error: '附近地标数据不足，换个位置试试吧~' }
      }

      return buildRouteWithPreferences(global, targetCategories, targetCount, style, preferences, excludeIds, timeBudget, transport, userLat, userLng)
    }

    return buildRouteWithPreferences(fallback, targetCategories, targetCount, style, preferences, excludeIds, timeBudget, transport, userLat, userLng)
  }

  return buildRouteWithPreferences(filtered, targetCategories, targetCount, style, preferences, excludeIds, timeBudget, transport, userLat, userLng)
}

/**
 * 使用偏好从已筛选列表中构建路线
 */
function buildRouteWithPreferences(filtered, targetCategories, targetCount, style, preferences, excludeIds, timeBudget, transport, userLat, userLng) {
  let picked

  if (preferences) {
    picked = pickByStyle(filtered, targetCategories, targetCount, style, excludeIds, timeBudget, transport)
  } else {
    const pickedMap = pickOnePerCategory(filtered, excludeIds)
    if (!pickedMap) {
      const fallbackCats = ['culture', 'cafe', 'park']
      shuffle(fallbackCats)
      picked = pickByStyle(filtered, fallbackCats, 2, null, excludeIds, timeBudget, transport)
    } else {
      picked = Object.values(pickedMap)
    }
  }

  if (!picked || picked.length < 2) {
    // 兜底：取消跨城 + 取消去重再试一次
    const fallbackTransport = transport === 'train' ? 'walk' : transport
    picked = pickByStyle(filtered, targetCategories, Math.max(targetCount, 2), style, [], timeBudget, fallbackTransport)
    if (!picked || picked.length < 2) {
      return { success: false, error: '找不到足够多的不同地点，请换个区域试试' }
    }
  }

  // 最近邻排序：用户位置 → 最近点 → 次近点 → ...
  const ordered = orderByGreedy(picked, userLat, userLng)
  const summary = computeSummary(ordered, preferences)

  return {
    success: true,
    route: ordered.map((s) => s.landmark),
    orderedRoute: ordered,
    summary,
  }
}
