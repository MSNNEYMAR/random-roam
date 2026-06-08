/**
 * 路线 DNA 系统 — Layer 5
 *
 * 每个风格模式维护多个 DNA 模板，确保：
 *  1. 同一模式下多次生成的路线有实质差异
 *  2. 每条模板都有明确的"气质"——不只是类别列表，而是叙事弧线
 *  3. 重新生成时优先切换模板
 *
 * 模板字段:
 *  - id:          唯一标识
 *  - name:        模板名称 (调试用)
 *  - categories:  类别序列 ['culture', 'park', 'cafe', 'park']
 *  - vibe:        模板气质描述 (用于 LLM 扩展)
 *  - weight:      模板权重 (越高越常被选中)
 */

// ==================== 类别枚举 ====================
// culture: 文化/艺术 (博物馆、美术馆、展馆、古迹)
// park:    公园/自然 (公园、植物园、动物园、山水)
// cafe:    咖啡/小店 (咖啡馆、茶馆、书店、文创)
// food:    美食/餐厅 (餐厅、小吃、老字号)

// ==================== DNA 模板定义 ====================

export const STYLE_DNA_TEMPLATES = {

  // ─────────── 文艺出片 artsy ───────────
  artsy: [
    {
      id: 'artsy-a',
      name: '书店·展馆·老街',
      categories: ['cafe', 'culture', 'park', 'culture'],
      vibe: '从独立书店开始，逛美术馆/博物馆，在老街散步拍照，最后以隐藏的艺术空间收尾',
      weight: 3,
    },
    {
      id: 'artsy-b',
      name: '美术馆·唱片店·河岸',
      categories: ['culture', 'cafe', 'park', 'cafe'],
      vibe: '美术馆开场，逛独立唱片店/买手店，沿河岸散步，找一家安静咖啡店坐下',
      weight: 3,
    },
    {
      id: 'artsy-c',
      name: '校园·旧书·艺术区',
      categories: ['culture', 'park', 'cafe', 'culture'],
      vibe: '大学校园漫步，逛旧书市场/二手店，去艺术区看展，在特色餐厅结束',
      weight: 2,
    },
    {
      id: 'artsy-d',
      name: '胡同·茶室·画廊',
      categories: ['culture', 'cafe', 'culture', 'food'],
      vibe: '胡同/老街区探索，茶馆歇脚，独立画廊看展，地道小馆晚餐',
      weight: 2,
    },
  ],

  // ─────────── 摸鱼模式 relax ───────────
  relax: [
    {
      id: 'relax-a',
      name: '咖啡馆·公园·甜品',
      categories: ['cafe', 'park', 'cafe'],
      vibe: '咖啡馆窝一会儿，公园散步，甜品店收尾',
      weight: 3,
    },
    {
      id: 'relax-b',
      name: '湖边·书店·安静街区',
      categories: ['park', 'cafe', 'park'],
      vibe: '湖边/河边发呆，逛书店，安静的街区散步',
      weight: 3,
    },
    {
      id: 'relax-c',
      name: '植物园·茶馆·草坪',
      categories: ['park', 'cafe', 'park'],
      vibe: '植物园漫步，茶馆品茶，在大草坪上躺平',
      weight: 2,
    },
    {
      id: 'relax-d',
      name: '旧街·咖啡馆·江边',
      categories: ['cafe', 'culture', 'park'],
      vibe: '老城区咖啡馆，逛旧街巷，江边/河边看日落',
      weight: 2,
    },
  ],

  // ─────────── 特种兵模式 commando ───────────
  commando: [
    {
      id: 'commando-a',
      name: '地标·博物馆·商圈·景区',
      categories: ['culture', 'culture', 'food', 'park'],
      vibe: '城市地标打卡，博物馆速览，商圈吃饭，景区收尾',
      weight: 3,
    },
    {
      id: 'commando-b',
      name: '古迹·观景·博物馆·夜景',
      categories: ['culture', 'park', 'culture', 'food'],
      vibe: '古迹探访，登高观景，第二个博物馆/展馆，夜景美食',
      weight: 3,
    },
    {
      id: 'commando-c',
      name: '三联文化冲刺',
      categories: ['culture', 'culture', 'food', 'culture'],
      vibe: '三个文化地标连续打卡，中间穿插美食补给',
      weight: 2,
    },
    {
      id: 'commando-d',
      name: '山·水·城·食',
      categories: ['park', 'culture', 'park', 'food'],
      vibe: '爬山/远足，文化景点，城市公园，地道美食大餐',
      weight: 2,
    },
  ],

  // ─────────── 情侣模式 couple ───────────
  couple: [
    {
      id: 'couple-a',
      name: '公园·咖啡·展馆·晚餐',
      categories: ['park', 'cafe', 'culture', 'food'],
      vibe: '公园漫步，咖啡店小坐，美术馆/展馆，浪漫晚餐',
      weight: 3,
    },
    {
      id: 'couple-b',
      name: '江边·书店·老街·甜品',
      categories: ['park', 'cafe', 'culture', 'cafe'],
      vibe: '江边/湖边散步，独立书店，逛老街，甜品店约会',
      weight: 3,
    },
    {
      id: 'couple-c',
      name: '日落·天台·夜市·酒吧',
      categories: ['park', 'food', 'culture', 'cafe'],
      vibe: '看日落的地点，天台餐厅，创意街区，小酒吧/清吧',
      weight: 2,
    },
    {
      id: 'couple-d',
      name: '植物园·野餐·影院·日料',
      categories: ['park', 'cafe', 'culture', 'food'],
      vibe: '植物园/花园，野餐/下午茶，小众电影院，日料晚餐',
      weight: 2,
    },
  ],

  // ─────────── 社恐模式 quiet ───────────
  quiet: [
    {
      id: 'quiet-a',
      name: '冷门公园·小书店·安静角落',
      categories: ['park', 'cafe', 'park'],
      vibe: '冷门/人少的公园，小书店/图书馆，安静的咖啡馆角落',
      weight: 3,
    },
    {
      id: 'quiet-b',
      name: '早场展馆·街巷·独处',
      categories: ['culture', 'park', 'cafe'],
      vibe: '开馆就去博物馆（人少），冷门街巷漫步，安静的茶室/咖啡馆',
      weight: 3,
    },
    {
      id: 'quiet-c',
      name: '城郊自然·寺庙·禅意',
      categories: ['park', 'culture', 'park'],
      vibe: '城郊山林/湿地，寺庙/道观（非景区的那种），自然中独处',
      weight: 2,
    },
  ],

  // ─────────── 穷游模式 budget ───────────
  budget: [
    {
      id: 'budget-a',
      name: '免费展馆·大学·路边摊',
      categories: ['culture', 'park', 'food'],
      vibe: '免费博物馆/美术馆，大学校园散步，路边摊/平价小吃',
      weight: 3,
    },
    {
      id: 'budget-b',
      name: '老街·公园·菜市场',
      categories: ['culture', 'park', 'food'],
      vibe: '老街区闲逛，免费公园散步，菜市场/集市吃地道美食',
      weight: 3,
    },
    {
      id: 'budget-c',
      name: '图书馆·滨江步道·社区食堂',
      categories: ['cafe', 'park', 'food'],
      vibe: '公共图书馆，滨江步道/绿道，社区食堂/平价小馆',
      weight: 2,
    },
  ],
}

// ==================== 默认模板 ====================

/**
 * 无偏好时的默认 DNA
 */
export const DEFAULT_DNA_TEMPLATES = [
  {
    id: 'default-a',
    name: '经典一日',
    categories: ['culture', 'cafe', 'park'],
    vibe: '文化地标 + 咖啡小店 + 公园散步',
    weight: 3,
  },
  {
    id: 'default-b',
    name: '悠闲午后',
    categories: ['park', 'cafe', 'culture'],
    vibe: '公园漫步 + 咖啡店 + 文化景点',
    weight: 2,
  },
  {
    id: 'default-c',
    name: '城市探索',
    categories: ['culture', 'park', 'food'],
    vibe: '文化地标 + 公园 + 美食',
    weight: 2,
  },
]

// ==================== DNA 选择器 ====================

/**
 * 从模板池中选择一个 DNA 模板
 *
 * @param {string} style         风格模式 (relax|artsy|commando|couple|quiet|budget)
 * @param {string|null} avoidId  要避开的模板 ID (上次用过的)
 * @returns {object} DNA 模板 { id, name, categories, vibe, weight }
 */
export function selectDnaTemplate(style, avoidId = null) {
  const pool = STYLE_DNA_TEMPLATES[style] || DEFAULT_DNA_TEMPLATES

  // 排除上次使用的模板 (但至少保留一个)
  let candidates = pool
  if (avoidId && pool.length > 1) {
    candidates = pool.filter((t) => t.id !== avoidId)
    if (candidates.length === 0) candidates = pool
  }

  // 按权重随机选择
  const totalWeight = candidates.reduce((sum, t) => sum + t.weight, 0)
  let random = Math.random() * totalWeight

  for (const template of candidates) {
    random -= template.weight
    if (random <= 0) return template
  }

  return candidates[candidates.length - 1]
}

/**
 * 根据 DNA 模板和实际可用 POI 池，确定最终的类别序列
 *
 * 如果某个类别在池中没有足够的 POI，则用最接近的类别替代
 *
 * @param {object} dna        选中的 DNA 模板
 * @param {object} poolByCat  按类别分组的 POI 池 { culture: [...], park: [...], cafe: [...], food: [...] }
 * @returns {Array<string>}  可行的类别序列
 */
export function resolveDnaCategories(dna, poolByCat) {
  const FALLBACK_MAP = {
    culture: ['park', 'cafe', 'food'],
    park: ['culture', 'cafe'],
    cafe: ['food', 'culture', 'park'],
    food: ['cafe', 'culture', 'park'],
  }

  return dna.categories.map((cat) => {
    if (poolByCat[cat] && poolByCat[cat].length > 0) return cat

    // 尝试 fallback
    const fallbacks = FALLBACK_MAP[cat] || []
    for (const fb of fallbacks) {
      if (poolByCat[fb] && poolByCat[fb].length > 0) return fb
    }

    return cat // 无替代，保持原类别
  })
}

// ==================== DNA 历史追踪 ====================

const DNA_HISTORY_KEY = 'randomroam_dna_history'

/**
 * 记录已使用的 DNA 模板 ID (用于跨会话避免重复)
 */
export function recordUsedDna(style, dnaId) {
  try {
    const key = `${DNA_HISTORY_KEY}_${style}`
    const raw = localStorage.getItem(key)
    const history = raw ? JSON.parse(raw) : []

    history.push({ id: dnaId, time: Date.now() })

    // 只保留最近 5 条
    const trimmed = history.slice(-5)
    localStorage.setItem(key, JSON.stringify(trimmed))
  } catch {
    // localStorage 不可用时静默失败
  }
}

export function getLastUsedDnaId(style) {
  try {
    const raw = localStorage.getItem(`${DNA_HISTORY_KEY}_${style}`)
    if (!raw) return null
    const history = JSON.parse(raw)
    return history.length > 0 ? history[history.length - 1].id : null
  } catch {
    return null
  }
}
