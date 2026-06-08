/**
 * 路线评分模型 — Phase 5
 *
 * 路线级评分维度:
 *  1. Diversity          — 路线丰富度
 *  2. LandmarkPresence   — 是否包含城市代表性地点
 *  3. Walkability        — 路线顺畅程度
 *  4. Novelty            — 探索感 (是否有惊喜)
 *  5. ExperienceQuality  — 整体体验质量
 *
 * 可扩展架构:
 *  当前: RuleBasedModel
 *  未来: MLRankModel / LLMPlanModel
 */

import { getLandmarkTier, calculatePOIScore } from './poiScorer.js'
import { getExplorationValue } from './routeSkeleton.js'
import { calculateRouteSimilarity } from './diversityEngine.js'
import { evaluateRouteDistance } from './distanceFit.js'

// ==================== 抽象基类 ====================

export class RouteScoreModel {
  get name() { return 'base' }
  get version() { return '0.0.0' }

  /** 路线级评分 */
  async scoreRoute(route, context) {
    throw new Error('Must implement scoreRoute()')
  }

  /** POI 批量评分 */
  async scorePOIs(pois, context) {
    throw new Error('Must implement scorePOIs()')
  }

  /** 多路线排名 */
  async rankRoutes(routes, context) {
    throw new Error('Must implement rankRoutes()')
  }
}

// ==================== 规则模型 ====================

export class RuleBasedModel extends RouteScoreModel {
  get name() { return 'rule-based' }
  get version() { return '2.0.0-skeleton' }

  /**
   * 五维路线评分
   *
   * @param {Array}  route     路线 POI 列表
   * @param {object} context   { transport, time, style, weather, skeleton }
   * @returns {Promise<{ score, breakdown, verdict }>}
   */
  async scoreRoute(route, context = {}) {
    const pois = route.map((s) => s.landmark || s)

    const diversity         = this._scoreDiversity(pois)
    const landmarkPresence  = this._scoreLandmarkPresence(pois)
    const walkability       = this._scoreWalkability(route, context)
    const novelty           = this._scoreNovelty(pois)
    const experienceQuality = this._scoreExperienceQuality(pois, context)

    // 加权: LandmarkPresence 最高，体验质量次之
    const score = Math.round(
      0.15 * diversity +
      0.30 * landmarkPresence +
      0.15 * walkability +
      0.20 * novelty +
      0.20 * experienceQuality
    )

    const verdict = this._generateVerdict(score, pois)

    return {
      score,
      breakdown: {
        diversity:         { score: diversity,         weight: 0.15 },
        landmarkPresence:  { score: landmarkPresence,  weight: 0.30 },
        walkability:       { score: walkability,       weight: 0.15 },
        novelty:           { score: novelty,           weight: 0.20 },
        experienceQuality: { score: experienceQuality, weight: 0.20 },
      },
      verdict,
    }
  }

  async scorePOIs(pois, context = {}) {
    // 注意: 这是类别内评分，不能跨类别比较
    return pois.map((poi) => ({
      poi,
      score: calculatePOIScore(poi),
      tier: (poi._landmarkTier || getLandmarkTier(poi)).tier,
    }))
  }

  async rankRoutes(routes, context = {}) {
    const scored = await Promise.all(
      routes.map(async (route, i) => {
        const result = await this.scoreRoute(route, context)
        return { route, score: result.score, rank: 0, index: i, verdict: result.verdict }
      })
    )
    scored.sort((a, b) => b.score - a.score)
    scored.forEach((item, i) => { item.rank = i + 1 })
    return scored
  }

  // ── 维度1: Diversity (路线丰富度) ──

  _scoreDiversity(pois) {
    const categories = pois.map((p) => p.category)
    const uniqueCats = new Set(categories)
    const catRatio = uniqueCats.size / categories.length

    // 理想: 每 2 个 POI 换一次类别
    if (catRatio >= 0.75) return 100
    if (catRatio >= 0.5)  return 80
    if (catRatio >= 0.35) return 55
    return 25
  }

  // ── 维度2: LandmarkPresence (城市名片) ──

  _scoreLandmarkPresence(pois) {
    let score = 0

    for (const poi of pois) {
      const tier = poi._landmarkTier || getLandmarkTier(poi)
      if (tier.tier === 'S') score += 40
      else if (tier.tier === 'A') score += 25
      else if (tier.tier === 'B') score += 10
      // C 不加分
    }

    return Math.min(100, score)
  }

  // ── 维度3: Walkability (路线顺畅度) ──

  _scoreWalkability(route, context) {
    // 检查相邻 POI 之间的距离梯度
    // 理想: 距离逐渐增大 (从近到远探索)，没有极端跳跃
    const distances = []
    for (const step of route) {
      if (step.walkingDist != null) distances.push(step.walkingDist)
    }

    if (distances.length < 2) return 75

    // 检测极端距离跳跃 (相邻站距离差 > 5倍)
    let jumps = 0
    for (let i = 1; i < distances.length; i++) {
      if (distances[i] > 0 && distances[i - 1] > 0) {
        const ratio = Math.max(distances[i], distances[i - 1]) /
                      Math.min(distances[i], distances[i - 1])
        if (ratio > 5) jumps++
      }
    }

    if (jumps === 0) return 95
    if (jumps === 1) return 70
    return 40
  }

  // ── 维度4: Novelty (探索感) ──

  _scoreNovelty(pois) {
    // 评分依据:
    //   - 探索价值高的 POI 多 → 高分
    //   - 有 B 级或以下的有趣地点 → 加分 (不是所有都是大牌)
    //   - 避免全是 S 级 (太"游客")

    let totalExploration = 0
    let hasBOrLower = false
    let allS = true

    for (const poi of pois) {
      const ev = poi._explorationValue || getExplorationValue(poi)
      totalExploration += ev

      const tier = poi._landmarkTier || getLandmarkTier(poi)
      if (tier.tier === 'B' || tier.tier === 'C') hasBOrLower = true
      if (tier.tier !== 'S') allS = false
    }

    const avgEV = pois.length > 0 ? totalExploration / pois.length : 50

    // 全是 S 级 → 扣分 (像旅游团行程)
    if (allS && pois.length >= 3) return 45

    // 有 B 级隐藏宝藏 → 加分
    const noveltyBonus = hasBOrLower ? 20 : 0

    return Math.min(100, Math.round(avgEV * 0.8 + noveltyBonus))
  }

  // ── 维度5: ExperienceQuality (整体体验质量) ──

  _scoreExperienceQuality(pois, context) {
    // 综合评估:
    //   - POI 平均评分
    //   - 是否构成一个好故事 (骨架叙事)
    //   - 是否有明显的节奏 (大开→高潮→收尾)

    const avgScore = pois.reduce((s, p) => s + (p._score || 50), 0) / (pois.length || 1)

    // 节奏检查: 前 1/3 应该是高能开场，中间是核心，末尾是收尾
    let rhythmBonus = 0
    if (pois.length >= 3) {
      const firstThird = pois.slice(0, Math.ceil(pois.length / 3))
      const lastThird = pois.slice(-Math.ceil(pois.length / 3))
      const firstMax = Math.max(...firstThird.map((p) => p._score || 0))
      if (firstMax >= 70) rhythmBonus += 15 // 开场有力
      const lastMin = Math.min(...lastThird.map((p) => p._score || 100))
      if (lastMin >= 50) rhythmBonus += 10 // 收尾不垮
    }

    return Math.min(100, Math.round(avgScore * 0.7 + rhythmBonus))
  }

  // ── 判词生成 ──

  _generateVerdict(score, pois) {
    const names = pois.map((p) => p.name).join(' → ')
    if (score >= 90) return `✨ 精品路线: ${names}`
    if (score >= 75) return `👍 值得出发: ${names}`
    if (score >= 55) return `🚶 可以逛逛: ${names}`
    return `🤔 建议换一条: ${names}`
  }
}

// ==================== 模型注册表 ====================

const MODEL_REGISTRY = { 'rule-based': RuleBasedModel }

export function getScoreModel(name = 'rule-based') {
  const ModelClass = MODEL_REGISTRY[name]
  if (!ModelClass) {
    console.warn(`[RouteScoreModel] 未知模型 "${name}"，回退到 rule-based`)
    return new RuleBasedModel()
  }
  return new ModelClass()
}

export function registerScoreModel(name, ModelClass) {
  MODEL_REGISTRY[name] = ModelClass
}

export const defaultScoreModel = new RuleBasedModel()
