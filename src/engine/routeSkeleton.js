/**
 * 路线 DNA / Route Skeleton 系统 — Phase 1
 *
 * 核心原则: 先生成体验结构，再选具体地点。禁止反过来。
 *
 * RouteSkeleton = 路线骨架，定义一条路线的"叙事弧线"
 *  - 每个 slot 指定类别 (不是具体 POI)
 *  - 每个 slot 有 explorationValue 权重
 *  - 按时间预算自动分配合适的骨架长度
 *
 * Category 映射:
 *   scenic     → culture, park   (景观/自然)
 *   cultural   → culture         (文化/艺术)
 *   leisure    → cafe            (休闲/咖啡/书店)
 *   food       → food            (美食/餐厅)
 */

// ==================== 探索价值权重 ====================

/**
 * 类别级探索价值 — "这个类型的地点本身有多值得逛"
 *
 * 评分时不看具体数据，只看类别属性。
 * 地标 > 历史景点 > 博物馆 > 自然风光 > 书店/画廊 > 公园 > 咖啡馆 > 商场 > 餐厅 > 快餐
 */
export const EXPLORATION_VALUE = {
  landmark:      100,  // 城市级地标
  historicalSite: 95,  // 历史遗迹
  museum:         95,  // 博物馆/美术馆
  scenicArea:     90,  // 风景区
  bookstore:      85,  // 独立书店
  artGallery:     85,  // 画廊/艺术空间
  park:           80,  // 公园/绿地
  riverside:      80,  // 滨江/滨湖
  cafe:           65,  // 咖啡馆/茶馆
  shoppingMall:   50,  // 商圈/购物中心
  restaurant:     40,  // 餐厅
  fastFood:       10,  // 快餐/连锁
}

/**
 * 根据 POI category + name 推导 explorationValue
 */
export function getExplorationValue(poi) {
  const name = poi.name || ''
  const category = poi.category || ''

  // 地标判定
  if (/故宫|天坛|颐和园|圆明园|兵马俑|外滩|西湖|黄鹤楼|大雁塔|中山陵|东方明珠|广州塔/.test(name))
    return EXPLORATION_VALUE.landmark

  // 历史遗址
  if (/遗址|故居|古城|古迹|陵|长城|城墙|烽火/.test(name))
    return EXPLORATION_VALUE.historicalSite

  // 博物馆/美术馆
  if (category === 'culture')
    return EXPLORATION_VALUE.museum

  // 风景区
  if (/景区|名胜|风景|地质|国家公园|森林公园/.test(name))
    return EXPLORATION_VALUE.scenicArea

  // 书店
  if (/书店|书屋|书房|书吧|图书馆/.test(name))
    return EXPLORATION_VALUE.bookstore

  // 画廊/艺术空间
  if (/画廊|艺术|美术馆|文创|创意/.test(name))
    return EXPLORATION_VALUE.artGallery

  // 公园
  if (category === 'park')
    return EXPLORATION_VALUE.park

  // 滨水
  if (/滨江|滨湖|江边|湖边|河岸|海岸|外滩|步道|绿道/.test(name))
    return EXPLORATION_VALUE.riverside

  // 咖啡馆
  if (category === 'cafe')
    return EXPLORATION_VALUE.cafe

  // 商场
  if (/广场|商圈|购物|百货|商场|MALL|万象|大悦城|恒隆/.test(name))
    return EXPLORATION_VALUE.shoppingMall

  // 餐厅
  if (category === 'food')
    return /快餐|汉堡|炸鸡|奶茶|咖啡/.test(name)
      ? EXPLORATION_VALUE.fastFood
      : EXPLORATION_VALUE.restaurant

  return EXPLORATION_VALUE.park // 默认
}

// ==================== 路线骨架定义 ====================

/**
 * RouteSkeleton — 路线的体验蓝图
 * @typedef {Object} RouteSkeleton
 * @property {string} mode    — 风格模式
 * @property {Array<{category: string, label: string}>} slots — 类别槽位序列
 * @property {string} narrative — 这条骨架讲的故事
 */

/**
 * 文艺模式 — Artsy
 * 叙事: 发现城市的文化肌理
 */
const ARTSY_SKELETONS = [
  {
    mode: 'artsy',
    id: 'artsy-a',
    narrative: '书店→展馆→咖啡馆→老街',
    slots: [
      { category: 'cafe',    label: '书店' },
      { category: 'culture', label: '展馆' },
      { category: 'cafe',    label: '咖啡馆' },
      { category: 'culture', label: '老街' },
    ],
  },
  {
    mode: 'artsy',
    id: 'artsy-b',
    narrative: '大学校园→美术馆→独立书店→河岸步道',
    slots: [
      { category: 'park',    label: '大学校园' },
      { category: 'culture', label: '美术馆' },
      { category: 'cafe',    label: '独立书店' },
      { category: 'park',    label: '河岸步道' },
    ],
  },
  {
    mode: 'artsy',
    id: 'artsy-c',
    narrative: '艺术区→唱片店→咖啡馆→夜景点',
    slots: [
      { category: 'culture', label: '艺术区' },
      { category: 'cafe',    label: '唱片店' },
      { category: 'cafe',    label: '咖啡馆' },
      { category: 'park',    label: '夜景点' },
    ],
  },
]

/**
 * 情侣模式 — Couple
 * 叙事: 浪漫的城市约会
 */
const COUPLE_SKELETONS = [
  {
    mode: 'couple',
    id: 'couple-a',
    narrative: '景观→甜品店→拍照点→夜景',
    slots: [
      { category: 'park',    label: '景观' },
      { category: 'cafe',    label: '甜品店' },
      { category: 'culture', label: '拍照点' },
      { category: 'park',    label: '夜景' },
    ],
  },
  {
    mode: 'couple',
    id: 'couple-b',
    narrative: '公园→咖啡馆→观景台→餐厅',
    slots: [
      { category: 'park',    label: '公园' },
      { category: 'cafe',    label: '咖啡馆' },
      { category: 'park',    label: '观景台' },
      { category: 'food',    label: '餐厅' },
    ],
  },
]

/**
 * 摸鱼模式 — Relax
 * 叙事: 毫无压力的放空时光
 */
const RELAX_SKELETONS = [
  {
    mode: 'relax',
    id: 'relax-a',
    narrative: '咖啡馆→公园→书店',
    slots: [
      { category: 'cafe',  label: '咖啡馆' },
      { category: 'park',  label: '公园' },
      { category: 'cafe',  label: '书店' },
    ],
  },
  {
    mode: 'relax',
    id: 'relax-b',
    narrative: '湖边→步道→甜品店',
    slots: [
      { category: 'park',  label: '湖边' },
      { category: 'park',  label: '步道' },
      { category: 'cafe',  label: '甜品店' },
    ],
  },
]

/**
 * 特种兵模式 — Commando
 * 叙事: 最高效的城市征服
 */
const COMMANDO_SKELETONS = [
  {
    mode: 'commando',
    id: 'commando-a',
    narrative: '城市地标→博物馆→历史景点→观景点',
    slots: [
      { category: 'culture', label: '城市地标' },
      { category: 'culture', label: '博物馆' },
      { category: 'culture', label: '历史景点' },
      { category: 'park',    label: '观景点' },
    ],
  },
  {
    mode: 'commando',
    id: 'commando-b',
    narrative: '地标→老街→商圈→夜景',
    slots: [
      { category: 'culture', label: '地标' },
      { category: 'culture', label: '老街' },
      { category: 'cafe',    label: '商圈' },
      { category: 'park',    label: '夜景' },
    ],
  },
]

/**
 * 社恐模式 — Quiet
 */
const QUIET_SKELETONS = [
  {
    mode: 'quiet',
    id: 'quiet-a',
    narrative: '冷门公园→小书店→安静角落',
    slots: [
      { category: 'park',  label: '冷门公园' },
      { category: 'cafe',  label: '小书店' },
      { category: 'park',  label: '安静角落' },
    ],
  },
  {
    mode: 'quiet',
    id: 'quiet-b',
    narrative: '早场展馆→街巷→独处咖啡馆',
    slots: [
      { category: 'culture', label: '早场展馆' },
      { category: 'culture', label: '街巷' },
      { category: 'cafe',    label: '独处咖啡馆' },
    ],
  },
]

/**
 * 穷游模式 — Budget
 */
const BUDGET_SKELETONS = [
  {
    mode: 'budget',
    id: 'budget-a',
    narrative: '免费展馆→大学→路边摊',
    slots: [
      { category: 'culture', label: '免费展馆' },
      { category: 'park',    label: '大学校园' },
      { category: 'food',    label: '路边摊' },
    ],
  },
  {
    mode: 'budget',
    id: 'budget-b',
    narrative: '老街→公园→菜市场',
    slots: [
      { category: 'culture', label: '老街' },
      { category: 'park',    label: '公园' },
      { category: 'food',    label: '菜市场' },
    ],
  },
]

// ==================== 骨架注册表 ====================

/** 所有骨架 (按模式分组) */
export const SKELETON_REGISTRY = {
  artsy:     ARTSY_SKELETONS,
  couple:    COUPLE_SKELETONS,
  relax:     RELAX_SKELETONS,
  commando:  COMMANDO_SKELETONS,
  quiet:     QUIET_SKELETONS,
  budget:    BUDGET_SKELETONS,
}

// ==================== 类别配额 ====================

/**
 * 时间预算 → 目标站点数
 */
export const TIME_TO_COUNT = {
  '1h': 3,
  '2h': 4,
  '3h': 5,
  '5h': 6,
  '1d': 6,
  '2d': 8,
}

/**
 * 时间预算 → 类别配额 (百分比)
 *
 * scenic = culture + park  (景观/自然)
 * cultural = culture       (文化/艺术)
 * leisure = cafe           (休闲)
 * food = food             (美食)
 */
export const TIME_QUOTAS = {
  '1h':   { scenic: 30, cultural: 20, leisure: 40, food: 10 },
  '2h':   { scenic: 40, cultural: 20, leisure: 20, food: 20 },
  '3h':   { scenic: 40, cultural: 30, leisure: 20, food: 10 },
  '5h':   { scenic: 40, cultural: 30, leisure: 20, food: 10 },
  '1d':   { scenic: 40, cultural: 30, leisure: 20, food: 10 },
  '2d':   { scenic: 40, cultural: 30, leisure: 20, food: 10 },
}

// ==================== 硬性规则 ====================

/**
 * 餐饮限制 — 绝不允许全是餐厅
 *
 * 规则:
 *   路线 ≤4 站 → 餐厅最多 1 个, 咖啡馆最多 1 个
 *   路线 ≥6 站 → 餐厅最多 2 个, 咖啡馆最多 1 个
 */
export function getFoodLimits(totalSlots) {
  if (totalSlots <= 4) {
    return { maxRestaurants: 1, maxCafes: 1 }
  }
  return { maxRestaurants: 2, maxCafes: 1 }
}

/**
 * 根据类别配额计算每个类别应有多少个 slot
 *
 * @param {number} totalSlots 总槽位数
 * @param {string} time       时间预算
 * @returns {Object} { scenic: N, cultural: N, leisure: N, food: N }
 */
export function computeQuotaCounts(totalSlots, time) {
  const quotas = TIME_QUOTAS[time] || TIME_QUOTAS['2h']
  const raw = {}

  for (const [key, pct] of Object.entries(quotas)) {
    raw[key] = Math.round((pct / 100) * totalSlots)
  }

  // 确保总数等于 totalSlots (四舍五入调整)
  let sum = Object.values(raw).reduce((a, b) => a + b, 0)
  const keys = Object.keys(raw)
  let i = 0
  while (sum < totalSlots) {
    raw[keys[i % keys.length]]++
    sum++
    i++
  }
  while (sum > totalSlots) {
    raw[keys[i % keys.length]]--
    sum--
    i++
  }

  // 应用餐饮限制
  const limits = getFoodLimits(totalSlots)
  if (raw.food > limits.maxRestaurants) {
    const excess = raw.food - limits.maxRestaurants
    raw.scenic += Math.ceil(excess / 2)
    raw.cultural += Math.floor(excess / 2)
    raw.food = limits.maxRestaurants
  }
  if (raw.leisure > limits.maxCafes + 1) {
    const excess = raw.leisure - (limits.maxCafes + 1)
    raw.scenic += excess
    raw.leisure = limits.maxCafes + 1
  }

  return raw
}

// ==================== 骨架选择器 ====================

const SKELETON_HISTORY_KEY = 'randomroam_skeleton_history'

/**
 * 从注册表中选择一个骨架
 *
 * @param {string} style       风格模式
 * @param {string|null} avoidId 要避开的骨架 ID
 * @returns {RouteSkeleton}
 */
export function selectSkeleton(style, avoidId = null) {
  const pool = SKELETON_REGISTRY[style] || SKELETON_REGISTRY.relax

  let candidates = pool
  if (avoidId && pool.length > 1) {
    candidates = pool.filter((s) => s.id !== avoidId)
    if (candidates.length === 0) candidates = pool
  }

  const idx = Math.floor(Math.random() * candidates.length)
  return candidates[idx]
}

/**
 * 根据时间预算裁剪骨架长度
 *
 * 短时间 → 截取骨架的前 N 个 slot
 * 长时间 → 骨架 + 按配额补充
 */
export function fitSkeletonToTime(skeleton, time, targetCount) {
  const slots = [...skeleton.slots]

  // 截取: 如果骨架比目标长，取前 N 个
  if (slots.length >= targetCount) {
    return slots.slice(0, targetCount)
  }

  // 扩展: 如果骨架不够，按类别配额补充
  const quotas = computeQuotaCounts(targetCount, time)
  const currentCounts = {}
  for (const s of slots) {
    const quotaKey = slotToQuotaKey(s.category)
    currentCounts[quotaKey] = (currentCounts[quotaKey] || 0) + 1
  }

  const expanded = [...slots]
  for (let i = 0; expanded.length < targetCount; i++) {
    const triedKeys = ['scenic', 'cultural', 'leisure', 'food']
    for (const key of triedKeys) {
      if (expanded.length >= targetCount) break
      if ((currentCounts[key] || 0) < (quotas[key] || 0)) {
        expanded.push({ category: quotaKeyToCategory(key), label: key })
        currentCounts[key] = (currentCounts[key] || 0) + 1
        break
      }
    }
  }

  return expanded.slice(0, targetCount)
}

function slotToQuotaKey(category) {
  switch (category) {
    case 'culture': return 'cultural'
    case 'park':    return 'scenic'
    case 'cafe':    return 'leisure'
    case 'food':    return 'food'
    default:        return 'scenic'
  }
}

function quotaKeyToCategory(key) {
  switch (key) {
    case 'scenic':   return Math.random() > 0.5 ? 'culture' : 'park'
    case 'cultural': return 'culture'
    case 'leisure':  return 'cafe'
    case 'food':     return 'food'
    default:         return 'park'
  }
}

// ==================== 骨架历史 ====================

export function recordUsedSkeleton(style, skeletonId) {
  try {
    const key = `${SKELETON_HISTORY_KEY}_${style}`
    const raw = localStorage.getItem(key)
    const history = raw ? JSON.parse(raw) : []
    history.push({ id: skeletonId, time: Date.now() })
    localStorage.setItem(key, JSON.stringify(history.slice(-5)))
  } catch {}
}

export function getLastUsedSkeletonId(style) {
  try {
    const raw = localStorage.getItem(`${SKELETON_HISTORY_KEY}_${style}`)
    if (!raw) return null
    const history = JSON.parse(raw)
    return history.length > 0 ? history[history.length - 1].id : null
  } catch { return null }
}

// ==================== 向后兼容 ====================

// 保留旧接口以兼容 routeDna.js 的导出
export { EXPLORATION_VALUE as EXPLORATION_VALUE_MAP }
