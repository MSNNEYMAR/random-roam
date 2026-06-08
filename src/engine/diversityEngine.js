/**
 * 多样性引擎 — Layers 3 + 6
 *
 * Layer 3: calculateDiversityScore(poi, currentRoute)
 *   — 评估将某个 POI 加入当前路线后的多样性贡献
 *
 * Layer 6: calculateRouteSimilarity(routeA, routeB)
 *   — 评估两条路线之间的相似度，用于判断是否需要重新生成
 */

import { haversineDistance } from '../utils/routeGenerator.js'

// ==================== 相似度权重 ====================

const SIMILARITY_WEIGHTS = {
  poiOverlap: 0.4,
  categoryOverlap: 0.3,
  areaOverlap: 0.2,
  lengthOverlap: 0.1,
}

const SIMILARITY_THRESHOLD = 0.4 // 超过此值视为"太相似"

// ==================== Layer 3: 多样性评分 ====================

/**
 * 计算将 poi 加入 currentRoute 后的多样性贡献
 *
 * 核心原则:
 *  - 类别重复越少 → 分数越高
 *  - 鼓励类别交替 (公园→书店→展馆，而非公园→公园→公园)
 *  - 地理分散度 — POI 之间保持适当距离
 *
 * @param {object} poi            候选 POI
 * @param {Array}  currentRoute   当前已选路线 (ordered list)
 * @param {object} diversityCtx   多样性上下文 (历史路线信息)
 * @returns {number} 0~100 (越高越多样)
 */
export function calculateDiversityScore(poi, currentRoute, diversityCtx = null) {
  if (!currentRoute || currentRoute.length === 0) return 80

  const poiCat = poi.category
  let score = 100

  // ── 类别重复惩罚 ──
  const catCounts = {}
  for (const item of currentRoute) {
    const cat = (item.landmark || item).category
    catCounts[cat] = (catCounts[cat] || 0) + 1
  }

  const sameCatCount = catCounts[poiCat] || 0

  // 类别已出现 3 次以上 → 严重惩罚
  if (sameCatCount >= 3) score -= 60
  else if (sameCatCount >= 2) score -= 35
  else if (sameCatCount >= 1) score -= 15

  // ── 类别比例健康度 ──
  const totalItems = currentRoute.length + 1
  const maxPerCategory = Math.ceil(totalItems / 3) // 每类最多占 1/3
  if (sameCatCount + 1 > maxPerCategory) {
    score -= 20
  }

  // ── 地理分散度 ──
  const poiLat = poi.lat
  const poiLng = poi.lng
  if (poiLat != null && poiLng != null) {
    let tooClose = false
    for (const item of currentRoute) {
      const lm = item.landmark || item
      if (lm.lat != null && lm.lng != null) {
        const d = haversineDistance(poiLat, poiLng, lm.lat, lm.lng)
        // 距离 < 500m 视为太近
        if (d < 0.5) { tooClose = true; break }
        // 距离 < 1km 轻微惩罚
        if (d < 1.0) score -= 8
      }
    }
    if (tooClose) score -= 25
  }

  // ── 主题标签多样性 ──
  if (diversityCtx?.usedTagIds?.length > 0 && poi._tags) {
    const overlap = poi._tags.filter((t) => diversityCtx.usedTagIds.includes(t))
    if (overlap.length >= 3) score -= 35
    else if (overlap.length >= 2) score -= 20
    else if (overlap.length >= 1) score -= 8
  }

  // ── 历史 POI 去重 ──
  if (diversityCtx?.usedPoiIds?.includes(poi.id)) {
    score -= 40
  }

  return Math.max(0, Math.min(100, score))
}

// ==================== Layer 6: 路线相似度 ====================

/**
 * 计算两条路线之间的相似度
 *
 * Similarity = 0.4 * POIOverlap
 *            + 0.3 * CategoryOverlap
 *            + 0.2 * AreaOverlap
 *            + 0.1 * LengthOverlap
 *
 * 当 similarity > SIMILARITY_THRESHOLD (0.4) 时，应重新生成
 *
 * @param {Array} routeA  路线 A 的 POI 列表
 * @param {Array} routeB  路线 B 的 POI 列表
 * @returns {number} 0~1 相似度
 */
export function calculateRouteSimilarity(routeA, routeB) {
  if (!routeA || !routeB || routeA.length === 0 || routeB.length === 0) return 0

  const poisA = routeA.map((s) => s.landmark || s)
  const poisB = routeB.map((s) => s.landmark || s)

  // ── POI 重叠率 ──
  const idsA = new Set(poisA.map((p) => p.id).filter(Boolean))
  const idsB = new Set(poisB.map((p) => p.id).filter(Boolean))
  const intersection = [...idsA].filter((id) => idsB.has(id))
  const union = new Set([...idsA, ...idsB])
  const poiOverlap = union.size > 0 ? intersection.length / union.size : 0

  // ── 类别重叠率 ──
  const catsA = poisA.map((p) => p.category).filter(Boolean)
  const catsB = poisB.map((p) => p.category).filter(Boolean)
  const catOverlap = computeJaccardSimilarity(catsA, catsB)

  // ── 区域重叠率 ──
  const areaOverlap = computeAreaOverlap(poisA, poisB)

  // ── 路线长度差异 ──
  const lenA = routeA.length
  const lenB = routeB.length
  const lengthDiff = Math.abs(lenA - lenB) / Math.max(lenA, lenB)
  const lengthOverlap = 1 - lengthDiff

  const similarity =
    SIMILARITY_WEIGHTS.poiOverlap * poiOverlap +
    SIMILARITY_WEIGHTS.categoryOverlap * catOverlap +
    SIMILARITY_WEIGHTS.areaOverlap * areaOverlap +
    SIMILARITY_WEIGHTS.lengthOverlap * lengthOverlap

  return Math.round(similarity * 100) / 100
}

/**
 * 判断两条路线是否过于相似，需要重新生成
 */
export function isTooSimilar(routeA, routeB) {
  return calculateRouteSimilarity(routeA, routeB) > SIMILARITY_THRESHOLD
}

// ==================== 辅助函数 ====================

/**
 * Jaccard 相似度
 */
function computeJaccardSimilarity(arrA, arrB) {
  const setA = new Set(arrA)
  const setB = new Set(arrB)
  const intersection = [...setA].filter((x) => setB.has(x)).length
  const union = new Set([...setA, ...setB]).size
  return union > 0 ? intersection / union : 0
}

/**
 * 区域重叠率 — 基于 POI 位置的几何中心距离
 *
 * 计算两条路线的"重心"，重心距离越近 → 区域重叠越高
 */
function computeAreaOverlap(poisA, poisB) {
  const centerA = computeGeographicCenter(poisA)
  const centerB = computeGeographicCenter(poisB)

  if (!centerA || !centerB) return 0

  const distance = haversineDistance(
    centerA.lat, centerA.lng,
    centerB.lat, centerB.lng
  )

  // 距离映射为重叠率
  // < 1km → 重叠率 ~0.9
  // 1~3km  → 重叠率 0.5~0.9
  // 3~8km  → 重叠率 0.2~0.5
  // > 8km  → 重叠率 < 0.2
  if (distance < 1.0) return 0.9
  if (distance < 3.0) return 0.9 - (distance - 1.0) / 5
  if (distance < 8.0) return 0.5 - (distance - 3.0) / 10

  return Math.max(0, 0.2 - (distance - 8.0) / 50)
}

/**
 * 计算 POI 列表的地理中心
 */
function computeGeographicCenter(pois) {
  if (!pois || pois.length === 0) return null

  let totalLat = 0, totalLng = 0, count = 0
  for (const p of pois) {
    if (p.lat != null && p.lng != null) {
      totalLat += p.lat
      totalLng += p.lng
      count++
    }
  }

  if (count === 0) return null
  return { lat: totalLat / count, lng: totalLng / count }
}

// ==================== 类别交替建议 ====================

/**
 * 给定当前路线，推荐下一个最优类别
 *
 * @param {Array}  currentRoute   当前已选路线
 * @param {Array}  targetCategories  目标类别列表
 * @returns {string|null} 推荐的下一个类别
 */
export function recommendNextCategory(currentRoute, targetCategories) {
  if (!currentRoute || currentRoute.length === 0) {
    // 首个 POI: 推荐 culture (最有"分量"的类别)
    return targetCategories.includes('culture') ? 'culture' : targetCategories[0]
  }

  // 统计当前各品类出现次数
  const counts = {}
  for (const item of currentRoute) {
    const cat = (item.landmark || item).category
    counts[cat] = (counts[cat] || 0) + 1
  }

  // 上一站的类别
  const lastCat = (currentRoute[currentRoute.length - 1].landmark || currentRoute[currentRoute.length - 1]).category

  // 推荐策略: 优先选出现次数最少、且不是上一站类别的
  const candidates = targetCategories
    .filter((cat) => cat !== lastCat) // 避免连续同类别
    .sort((a, b) => (counts[a] || 0) - (counts[b] || 0))

  return candidates.length > 0 ? candidates[0] : targetCategories[0]
}

// ==================== 导出常量 ====================
export { SIMILARITY_WEIGHTS, SIMILARITY_THRESHOLD }
