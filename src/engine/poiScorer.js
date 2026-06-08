/**
 * POI 评分引擎 — Phase 3
 *
 * 关键约束: 评分函数只能在同类别池中排序。
 *
 * FinalScore = 0.4 × PopularityScore
 *            + 0.2 × RatingScore
 *            + 0.2 × ReviewScore
 *            + 0.2 × ExplorationValue
 */

import { haversineDistance } from '../utils/routeGenerator.js'
import { getExplorationValue } from './routeSkeleton.js'

// ==================== 权重配置 ====================

/**
 * 类别内评分权重:
 *   popularity: 0.40 — 热度最重要 (是其他维度的 2 倍)
 *   rating:     0.20 — 用户评价
 *   review:     0.20 — 评论规模 (可信度)
 *   exploration: 0.20 — 探索价值
 */
const WEIGHTS = {
  popularity:  0.40,
  rating:      0.20,
  review:      0.20,
  exploration: 0.20,
}

// ==================== PopularityScore ====================

export function computePopularityScore(poi) {
  const reviewCount = poi._reviewCount || poi.reviewCount || 0

  if (reviewCount > 0) {
    const logScore = Math.log(reviewCount + 1) / Math.log(10001) * 100
    return Math.round(Math.min(100, logScore))
  }

  const nameScore = Math.min(30, (poi.name || '').length * 3)
  const addressScore = (poi.address || '').length > 10 ? 15 : 5
  const ratingHint = (poi.rating || 0) > 4.0 ? 10 : 0
  return Math.min(50, nameScore + addressScore + ratingHint)
}

// ==================== RatingScore ====================

export function computeRatingScore(poi) {
  const rating = Number(poi.rating)
  if (!rating || rating <= 0 || isNaN(rating)) return 50
  if (rating >= 4.9) return 100
  if (rating >= 4.8) return 95
  if (rating >= 4.7) return 92
  if (rating >= 4.6) return 89
  if (rating >= 4.5) return 85
  if (rating >= 4.4) return 82
  if (rating >= 4.3) return 79
  if (rating >= 4.2) return 76
  if (rating >= 4.1) return 73
  if (rating >= 4.0) return 70
  if (rating >= 3.8) return 63
  if (rating >= 3.5) return 53
  if (rating >= 3.0) return 40
  if (rating >= 2.5) return 30
  if (rating >= 2.0) return 20
  return 10
}

// ==================== ReviewScore ====================

export function computeReviewScore(poi) {
  const count = poi._reviewCount || poi.reviewCount || 0
  if (count > 0) {
    if (count >= 500) return 100
    if (count >= 100) return 80
    if (count >= 30)  return 65
    if (count >= 10)  return 45
    if (count >= 4)   return 25
    return 10
  }
  const name = poi.name || ''
  const address = poi.address || ''
  if (name.length >= 4 && address.length > 15) return 40
  if (name.length >= 3 && address.length > 5)  return 30
  return 20
}

// ==================== ExplorationValue Score ====================

/**
 * 探索价值分数 — 归一化到 0~100
 */
export function computeExplorationScore(poi) {
  const val = poi._explorationValue || getExplorationValue(poi)
  return val // 已经是 0~100 范围
}

// ==================== 地标等级 (保留用于结构优化) ====================

const S_TIER_PATTERNS = [
  /^(故宫|天坛|颐和园|圆明园|八达岭|明十三陵|雍和宫|恭王府|天安门|国家博物馆|首都博物馆|中国美术馆|国家大剧院|鸟巢|水立方|798|南锣鼓巷|什刹海|王府井)/,
  /^(外滩|东方明珠|上海博物馆|上海科技馆|上海自然博物馆|豫园|城隍庙|武康大楼|新天地|田子坊)/,
  /^(广州塔|白云山|中山纪念堂|陈家祠|沙面|长隆|广州大剧院|广东省博物馆)/,
  /^(世界之窗|欢乐谷|深圳湾|大梅沙|华侨城|平安金融中心)/,
  /^(宽窄巷子|锦里|大熊猫|都江堰|青城山|武侯祠|杜甫草堂|金沙遗址)/,
  /^(西湖|灵隐寺|雷峰塔|六和塔|西溪湿地|宋城|良渚)/,
  /^(中山陵|明孝陵|总统府|夫子庙|南京博物院|鸡鸣寺|玄武湖)/,
  /^(兵马俑|大雁塔|城墙|华清池|陕西历史博物馆|钟楼|鼓楼|大唐不夜城)/,
  /^(洪崖洞|磁器口|解放碑|长江索道|南山|武隆)/,
  /^(黄鹤楼|东湖|湖北省博物馆|武汉大学|江汉路|户部巷)/,
  /^(拙政园|留园|狮子林|虎丘|寒山寺|平江路|山塘街)/,
  /^(岳麓山|橘子洲|湖南省博物馆|太平街)/,
  /^(鼓浪屿|南普陀寺|厦门大学|曾厝垵|环岛路)/,
  /^(栈桥|崂山|八大关|五四广场|青岛啤酒博物馆)/,
  /^(国家|中国|中华|全国|首都)/,
  /(?:博物馆|美术馆|科学中心|天文馆|自然博物馆|科技馆)$/,
]

const A_TIER_PATTERNS = [
  /省博物馆|省博物院/,
  /太古里|蓝色港湾|芳草地|国贸|SKP|恒隆|IFS|万象城|大悦城|来福士|K11/,
  /(?:创意|艺术|文创).{0,4}(?:园|区|街|小镇|街区)/,
  /(?:文化|历史|特色).{0,4}(?:园|区|街|小镇|街区)/,
  /(?:书院|教堂|清真寺|道观|寺庙|故居|纪念馆)/,
  /(?:步行街|老街|古街|古镇|胡同|里弄)/,
  /^(大董|全聚德|便宜坊|东来顺|海底捞|鼎泰丰|利苑|新荣记|四季民福|烤鸭店|老字号)/,
  /^(紫竹院|陶然亭|龙潭|朝阳公园|地坛|日坛|月坛|白塔寺|大观园)/,
  /^(北京大学|清华大学|复旦大学|上海交大|浙江大学|南京大学|武汉大学|中山大学)/,
]

const C_TIER_PATTERNS = [
  /^(社区|街心|口袋|迷你|小微)/,
  /(?:体育公园|运动公园|街边公园|小区|家属院|街坊)/,
  /绿化带|街头绿地|道路绿化|站前广场/,
]

export function getLandmarkTier(poi) {
  const name = poi.name || ''
  for (const p of S_TIER_PATTERNS) {
    if (p.test(name)) return { tier: 'S', score: 100 }
  }
  if (name.length >= 6 && /(?:博物院|大剧院|体育场|体育馆|音乐厅|图书馆|规划馆|展览馆|美术馆|海洋馆|水族馆|植物园|动物园|森林公园|地质公园|风景名胜|国家公园)/.test(name)) {
    return { tier: 'S', score: 100 }
  }
  for (const p of A_TIER_PATTERNS) {
    if (p.test(name)) return { tier: 'A', score: 80 }
  }
  if (name.length >= 4 && /(?:公园|景区|名胜|古迹|寺庙|教堂|古镇|老街|步行街|文化街|艺术区|创意园|文创园|博物馆|纪念馆|故居|书院|画廊)/.test(name)) {
    return { tier: 'A', score: 80 }
  }
  for (const p of C_TIER_PATTERNS) {
    if (p.test(name)) return { tier: 'C', score: 20 }
  }
  if (/[东西南北中]?(?:宫)?门$/.test(name)) return { tier: 'C', score: 20 }
  if (name.length <= 3 && !/[园馆湖山寺庙塔宫院阁楼堂厅博]/.test(name)) {
    return { tier: 'C', score: 20 }
  }
  return { tier: 'B', score: 50 }
}

export function computeLandmarkScore(poi) {
  const tier = poi._landmarkTier || getLandmarkTier(poi)
  return tier.score
}

// ==================== 类别内评分 (核心约束) ====================

/**
 * 类别内综合评分
 *
 * 这是 Phase 3 的核心函数。
 * 约定: 只在同类别 POI 池中调用此函数。
 *
 * @param {object} poi  POI 对象
 * @returns {number} 0~100
 */
export function calculatePOIScore(poi) {
  if (!poi._landmarkTier) {
    poi._landmarkTier = getLandmarkTier(poi)
  }
  if (!poi._explorationValue) {
    poi._explorationValue = getExplorationValue(poi)
  }

  const popularity   = computePopularityScore(poi)
  const rating       = computeRatingScore(poi)
  const review       = computeReviewScore(poi)
  const exploration  = computeExplorationScore(poi)

  const score =
    WEIGHTS.popularity  * popularity +
    WEIGHTS.rating      * rating +
    WEIGHTS.review      * review +
    WEIGHTS.exploration * exploration

  return Math.round(score)
}

// ==================== 类别内排序 ====================

/**
 * 类别内排序 — 只在同类别池中评分并降序排列
 *
 * @param {Array}  pois  同类别 POI 列表
 * @returns {Array} 附 _score 的排序后列表 (不改动输入)
 */
export function rankWithinCategory(pois) {
  const scored = pois.map((poi) => ({
    ...poi,
    _score: calculatePOIScore(poi),
  }))
  scored.sort((a, b) => b._score - a._score)
  return scored
}

// ==================== 全局评分 (仅调试/日志用) ====================

/**
 * 全局排序 — 仅供调试或日志输出。
 * 生产路线生成流程不得依赖此函数的结果。
 *
 * @deprecated 使用 rankWithinCategory 替代
 */
export function rankPOIs(pois) {
  return rankWithinCategory(pois)
}

export { WEIGHTS }
