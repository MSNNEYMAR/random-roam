/**
 * RandomRoam 路线推荐引擎 — 统一导出
 *
 * 架构分层 (骨架驱动):
 *   Layer 1:   poiFilter.js        — POI 过滤器
 *   Layer 2:   poiScorer.js        — 类别内 POI 评分 (禁止跨类别)
 *   Layer 3+6: diversityEngine.js  — 多样性 + 路线相似度
 *   Layer 4:   distanceFit.js      — 距离匹配评分
 *   Phase 1:   routeSkeleton.js    — 路线骨架 + 类别配额
 *   Phase 1-3: routeOptimizer.js   — 骨架执行器 (核心管线)
 *   Phase 5:   routeScoreModel.js  — 路线级五维评分
 */

// Layer 1: POI Filter
export { isValidPOI, filterPOIs, prefilterRawAmapPOI } from './poiFilter.js'

// Layer 2: POI Scorer (类别内评分)
export {
  calculatePOIScore,
  computePopularityScore,
  computeRatingScore,
  computeReviewScore,
  computeExplorationScore,
  getLandmarkTier,
  computeLandmarkScore,
  rankWithinCategory,
  rankPOIs, // deprecated
  WEIGHTS as SCORER_WEIGHTS,
} from './poiScorer.js'

// Phase 1: Route Skeleton
export {
  EXPLORATION_VALUE,
  getExplorationValue,
  SKELETON_REGISTRY,
  TIME_TO_COUNT,
  TIME_QUOTAS,
  getFoodLimits,
  computeQuotaCounts,
  selectSkeleton,
  fitSkeletonToTime,
  recordUsedSkeleton,
  getLastUsedSkeletonId,
} from './routeSkeleton.js'

// Phase 1-3: Route Skeleton Executor
export {
  executeSkeletonPipeline,
  validateRouteStructure,
  classifyByRole,       // deprecated
  buildStructuredRoute, // deprecated
} from './routeOptimizer.js'

// Layers 3+6: Diversity
export {
  calculateDiversityScore,
  calculateRouteSimilarity,
  isTooSimilar,
  recommendNextCategory,
  SIMILARITY_WEIGHTS,
  SIMILARITY_THRESHOLD,
} from './diversityEngine.js'

// Layer 4: Distance Fit
export {
  calculateDistanceFit,
  evaluateRouteDistance,
  rankByDistanceFit,
  IDEAL_DISTANCE_RANGES,
} from './distanceFit.js'

// Phase 5: Route Score Model (路线级五维评分)
export {
  RouteScoreModel,
  RuleBasedModel,
  getScoreModel,
  registerScoreModel,
  defaultScoreModel,
} from './routeScoreModel.js'

// 向后兼容 — routeDna 重新导出
export {
  STYLE_DNA_TEMPLATES,
  DEFAULT_DNA_TEMPLATES,
  selectDnaTemplate,
  resolveDnaCategories,
  recordUsedDna,
  getLastUsedDnaId,
} from './routeDna.js'
