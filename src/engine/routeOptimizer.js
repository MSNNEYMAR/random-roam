/**
 * Route Skeleton Executor — Phase 1+2+3
 *
 * 核心架构约束:
 *
 *   RouteSkeleton (体验蓝图)
 *     ↓
 *   Category Allocation (类别槽位分配)
 *     ↓
 *   Category-Internal POI Selection (类别内评分选择)
 *     ↓
 *   Route Assembly (组装路线)
 *     ↓
 *   Route Scoring (路线整体评分)
 *
 * 禁止:
 *  - 跨类别 POI 排序
 *  - 全局 Top-N 选点
 *  - 无骨架的自由组合
 *
 * 目标:
 *  - 让用户看到路线后产生 "这条路线我真想去走走" 的冲动
 */

import { getLandmarkTier as _getLandmarkTier, calculatePOIScore } from './poiScorer.js'
import {
  selectSkeleton,
  fitSkeletonToTime,
  getLastUsedSkeletonId,
  recordUsedSkeleton,
  getExplorationValue,
  TIME_TO_COUNT,
} from './routeSkeleton.js'
import { weightedRandomPick } from '../utils/routeGenerator.js'

// ==================== 主入口 ====================

/**
 * 执行完整的骨架驱动路线生成
 *
 * @param {Array}  allPOIs        全部可用 POI (已过滤)
 * @param {object} preferences    { transport, time, style }
 * @param {Array}  excludeIds     历史去重 ID
 * @param {object} diversityCtx   多样性上下文 (换线时传入)
 * @returns {{ skeleton, picked: Array, skeletonId: string }}
 */
export function executeSkeletonPipeline(allPOIs, preferences, excludeIds = [], diversityCtx = null) {
  const style = preferences?.style || 'relax'
  const time = preferences?.time || '2h'
  const targetCount = TIME_TO_COUNT[time] || 4

  // ── 预计算每个 POI 的元数据 ──
  for (const poi of allPOIs) {
    if (!poi._landmarkTier) {
      poi._landmarkTier = _getLandmarkTier(poi)
    }
    if (!poi._explorationValue) {
      poi._explorationValue = getExplorationValue(poi)
    }
  }

  // ── Phase 1: 选择骨架 ──
  const lastId = getLastUsedSkeletonId(style)
  const skeleton = selectSkeleton(style, lastId)
  const slots = fitSkeletonToTime(skeleton, time, targetCount)

  // ── 按类别分组 ──
  const poolByCat = groupByCategory(allPOIs)
  const excludeSet = new Set(excludeIds || [])

  // ── Phase 2+3: 逐槽位类别内选择 ──
  const picked = []
  const usedIds = new Set()

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]
    const cat = slot.category

    // 只在该类别的池中选择 — 这是核心约束
    let pool = (poolByCat[cat] || []).filter(
      (p) => !usedIds.has(p.id) && !excludeSet.has(p.id)
    )

    // 如果该类池为空，尝试 fallback
    if (pool.length === 0) {
      pool = fallbackPool(poolByCat, cat, usedIds, excludeSet)
    }

    if (pool.length === 0) {
      // 最终回退：从所有未使用的 POI 中选
      pool = allPOIs.filter(
        (p) => !usedIds.has(p.id) && !excludeSet.has(p.id)
      )
    }

    if (pool.length === 0) break

    // 类别内评分
    pool = pool.map((p) => {
      if (!p._score) {
        p._score = calculatePOIScore(p)
      }
      return p
    })

    // 按评分排序 (类别内)
    pool.sort((a, b) => (b._score || 0) - (a._score || 0))

    // 加权随机选择 (取 Top-N，保持随机性)
    const candidatePool = pool.slice(0, Math.min(12, pool.length))
    const chosen = weightedRandomPick(candidatePool, 2.5, diversityCtx)

    if (chosen) {
      picked.push(chosen)
      usedIds.add(chosen.id)
    }
  }

  // ── 记录 ──
  recordUsedSkeleton(style, skeleton.id)

  return {
    skeleton,
    skeletonId: skeleton.id,
    slots,
    picked,
    usedSlots: slots.slice(0, picked.length),
  }
}

// ==================== 辅助函数 ====================

function groupByCategory(pois) {
  const groups = { culture: [], park: [], cafe: [], food: [] }
  for (const poi of pois) {
    const cat = poi.category || 'culture'
    if (groups[cat]) groups[cat].push(poi)
    else {
      // 未知类别归入 culture
      groups.culture.push(poi)
    }
  }
  return groups
}

function fallbackPool(poolByCat, targetCat, usedIds, excludeSet) {
  const FALLBACK_ORDER = {
    culture: ['park', 'cafe', 'food'],
    park:    ['culture', 'cafe'],
    cafe:    ['culture', 'park', 'food'],
    food:    ['cafe', 'culture', 'park'],
  }

  const order = FALLBACK_ORDER[targetCat] || ['culture', 'park', 'cafe', 'food']
  for (const fbCat of order) {
    const candidates = (poolByCat[fbCat] || []).filter(
      (p) => !usedIds.has(p.id) && !excludeSet.has(p.id)
    )
    if (candidates.length > 0) return candidates
  }
  return []
}

// ==================== 路线验证 ====================

/**
 * 验证最终路线质量
 */
export function validateRouteStructure(route) {
  const issues = []
  const pois = route.map((r) => r.landmark || r)
  const categories = pois.map((p) => p.category)
  const uniqueCats = new Set(categories)

  // 类别单一
  if (uniqueCats.size <= 1 && pois.length >= 3) {
    issues.push('路线类别过于单一')
  }

  // 餐饮泛滥
  const foodCount = categories.filter((c) => c === 'food').length
  const total = pois.length
  if (foodCount > 1 && foodCount / total > 0.5) {
    issues.push(`餐厅占比过高 (${foodCount}/${total})`)
  }

  // 缺少城市名片
  const hasLandmark = pois.some((p) => {
    const tier = p._landmarkTier || _getLandmarkTier(p)
    return tier.tier === 'S' || tier.tier === 'A'
  })
  if (!hasLandmark && pois.length >= 3) {
    issues.push('缺少城市名片级地点')
  }

  // C级 POI 检查
  const tierCPOIs = pois.filter((p) => {
    const tier = p._landmarkTier || _getLandmarkTier(p)
    return tier.tier === 'C'
  })
  if (tierCPOIs.length > 0) {
    issues.push(`包含 ${tierCPOIs.length} 个低价值地点`)
  }

  let quality = 100
  if (issues.length >= 3) quality = 20
  else if (issues.length >= 2) quality = 40
  else if (issues.length >= 1) quality = 65

  return { valid: issues.length === 0, issues, quality }
}

// ==================== 向后兼容 ====================

/** @deprecated — 使用 executeSkeletonPipeline */
export function classifyByRole(pois) {
  const landmark = [], popular = [], explore = []
  for (const poi of pois) {
    const tier = poi._landmarkTier || _getLandmarkTier(poi)
    if (tier.tier === 'S') { landmark.push(poi); continue }
    if (tier.tier === 'A') { popular.push(poi); continue }
    if (tier.tier === 'B') { explore.push(poi); continue }
    if (explore.length === 0) explore.push(poi)
  }
  return { landmark, popular, explore }
}

/** @deprecated — 使用 executeSkeletonPipeline */
export function buildStructuredRoute(pois, targetCount, dnaCategories, diversityCtx = null) {
  // 直接走骨架管线
  return executeSkeletonPipeline(pois, {}, [], diversityCtx).picked.slice(0, targetCount)
}

/** @deprecated — 使用 executeSkeletonPipeline */
export const STRUCTURE_TEMPLATES = {}
