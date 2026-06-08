/**
 * POI 过滤器 — Layer 1
 *
 * 职责: 在 POI 进入候选池之前，剔除低质量、无意义的地点。
 *
 * 过滤规则:
 *  1. 类别黑名单 — 公交站/地铁站/停车场/收费站/加油站等纯交通设施
 *  2. 名称关键词黑名单 — 包含"东门/西门/售票处/管理处"等非景点实体
 *  3. 附属设施过滤 — 景区入口、游客中心、物业办公区等
 */

// ==================== 类别黑名单 ====================

const BLOCKED_CATEGORIES = new Set([
  'bus_station',
  'subway_station',
  'parking',
  'toll_gate',
  'gas_station',
  'charging_station',
  'service_area',
  'logistics',
  'warehouse',
  'office_area',
  'property_management',
])

// ==================== 名称关键词黑名单 ====================

const BLOCKED_NAME_PATTERNS = [
  /东门/,
  /西门/,
  /南门/,
  /北门/,
  /停车场/,
  /公交站/,
  /地铁站/,
  /游客中心/,
  /服务中心/,
  /售票处/,
  /检票口/,
  /管理处/,
  /办公区/,
  /物业/,
  /收费站/,
  /加油站/,
  /充电站/,
  /出入口/,
  /公共厕所/,
  /卫生间/,
  /ATM/,
  /自助银行/,
  /储蓄所/,
  /物流园/,
  /仓库/,
  /服务区/,
  /客运站/,
  /长途/,
  /轻轨/,
  /BRT/,
  /机场大巴/,
]

// ==================== 高德 type 字段黑名单 ====================

const BLOCKED_AMAP_TYPES = [
  /停车场/,
  /停车库/,
  /充电站/,
  /加油站/,
  /公共厕所/,
  /售票处/,
  /出入口/,
  /交通设施/,
  /道路附属/,
  /收费站/,
  /服务区/,
  /物流/,
  /仓库/,
  /办公/,
  /物业/,
]

// ==================== 低质量 POI 名称模式 ====================

const LOW_QUALITY_NAME_PATTERNS = [
  // 社区级别公园
  /社区公园/,
  /街心公园/,
  /口袋公园/,
  /迷你公园/,
  /小微公园/,
  /街边公园/,
  /体育公园/,
  /运动公园/,
  // 绿化带/绿地 (非独立景点)
  /绿化带/,
  /街头绿地/,
  /道路绿化/,
  // 小区附属
  /小区/,
  /家属院/,
  /街坊/,
  // 非景点类的"广场" — 商业广场前空地、交通广场
  /站前广场/,
]

// ==================== 主过滤函数 ====================

/**
 * 判断一个 POI 是否值得进入候选池
 *
 * @param {object} poi — 标准化后的 POI 对象 { name, category, type, address, ... }
 * @returns {boolean} true = 有效 POI, false = 应被过滤
 */
export function isValidPOI(poi) {
  if (!poi || !poi.name) return false

  const name = poi.name || ''
  const type = poi.type || ''
  const category = poi.category || ''
  const rawType = poi._rawType || ''

  // ── 规则 1: 类别黑名单 ──
  if (BLOCKED_CATEGORIES.has(category)) return false

  // ── 规则 2: 名称关键词黑名单 ──
  for (const pattern of BLOCKED_NAME_PATTERNS) {
    if (pattern.test(name)) return false
  }

  // ── 规则 3: 高德 type 字段黑名单 ──
  for (const pattern of BLOCKED_AMAP_TYPES) {
    if (pattern.test(rawType)) return false
  }

  // ── 规则 4: 出入口/大门检测 ──
  if (isGateOrEntrance(name, type)) return false

  // ── 规则 5: 低质量名称过滤 ──
  for (const pattern of LOW_QUALITY_NAME_PATTERNS) {
    if (pattern.test(name)) return false
  }

  // ── 规则 6: 名称过短且无意义 ──
  if (name.length <= 2 && !/[园馆湖山寺庙塔宫院阁楼堂厅]/.test(name)) return false

  // ── 规则 7: 纯数字编号类 ──
  if (/^\d+号?(出入口|门|岗|亭)?$/.test(name)) return false

  return true
}

// ==================== 出入口识别 ====================

/**
 * 判断 POI 是否为某个大景点的出入口/大门，而非独立景点
 *
 * 例如:
 *  - "颐和园新建宫门" → 是颐和园的入口 ✅ 应拦截
 *  - "颐和园" → 独立景点 ❌ 放行
 *  - "XX小区东门" → 小区入口 ✅ 应拦截
 */
function isGateOrEntrance(name, type) {
  // 长名称 (>10字) 大概率不是纯门
  if (name.length > 10) return false

  // 知名景区名 + 方向门后缀
  if (/^(颐和园|圆明园|故宫|天坛|北海|景山|香山|八大处|中山公园|雍和宫|恭王府|国子监|大观园|植物园|动物园|奥林匹克|奥森|玉渊潭|紫竹院|陶然亭|龙潭|朝阳公园|世界公园|国家博物馆|首都博物馆|军事博物馆|自然博物馆|天文馆|科技馆|美术馆|大剧院|体育场|体育馆|国博|首博)/.test(name) &&
      /[东西南北中]?(?:宫)?门|入口|出口$/.test(name)) {
    return true
  }

  // 纯方向门
  if (/^(东|南|西|北|正|后|侧|偏)门$/.test(name)) return true
  if (/^[东西南北]\d号?门$/.test(name)) return true

  // 短名 + 方向 + 门
  if (name.length <= 8) {
    if (/([东西南北中]|[东西南北]\d号?)(门|入口|出口|侧门|后门)$/.test(name)) return true
    if (/出入口$/.test(name)) return true
    if (/^(.*)(入口|出口)$/.test(name) && name.length <= 6) return true
  }

  // 含"门"且名称较短且 type 含旅游景点
  if (/[宫国城园]门/.test(name) && name.length <= 6) return true

  return false
}

// ==================== 批量过滤 ====================

/**
 * 对 POI 列表做批量过滤，返回有效 POI 列表和过滤统计
 *
 * @param {Array} pois  标准化后的 POI 列表
 * @returns {{ valid: Array, rejected: Array, stats: object }}
 */
export function filterPOIs(pois) {
  const valid = []
  const rejected = []

  for (const poi of pois) {
    if (isValidPOI(poi)) {
      valid.push(poi)
    } else {
      rejected.push(poi)
    }
  }

  return {
    valid,
    rejected,
    stats: {
      total: pois.length,
      passed: valid.length,
      rejected: rejected.length,
      passRate: pois.length > 0 ? ((valid.length / pois.length) * 100).toFixed(1) : '0',
    },
  }
}

// ==================== 对原始高德 POI 的预过滤 ====================

/**
 * 在高德 API 数据标准化之前做第一道过滤
 * 直接在高德原始 POI 上检查，尽早剔除
 *
 * @param {object} rawPoi  高德 API 返回的原始 POI 对象 { name, type, location, ... }
 * @returns {boolean} true = 应保留
 */
export function prefilterRawAmapPOI(rawPoi) {
  const name = rawPoi.name || ''
  const type = rawPoi.type || ''

  // 交通设施
  if (/^(公交|地铁|轨道交通|客运|长途|轻轨|BRT|机场大巴)/.test(name)) return false
  if (/地铁站$/.test(name) && !/体育|公园|广场|商场/.test(name)) return false
  if (/公交站$/.test(name) && !/体育|公园|广场|商场/.test(name)) return false
  if (/^(东|南|西|北|正|后|侧|偏)门$/.test(name)) return false

  // 纯交通设施 type
  if (/交通设施/.test(type) && (name + type).length < 12) return false

  // 短名+站后缀
  if (/^.{2,4}(站|总站)$/.test(name) && !/园|馆|湖|山|寺|庙/.test(name)) return false

  // 停车场/充电站/加油站/厕所
  if (/停车场|停车库|停车楼|P\+R|泊车/.test(name + type)) return false
  if (/充电站|充电桩|换电站|加油站|加气站/.test(name + type)) return false
  if (/公共厕所|卫生间|公厕/.test(name)) return false
  if (/售票处|售票厅|票务中心|游客中心|游客服务中心/.test(name)) return false
  if (/^(ATM|银行|储蓄所|自助银行)/.test(name)) return false

  // 出入口检测
  if (isGateOrEntrance(name, type)) return false

  // 低质量名称
  for (const pattern of LOW_QUALITY_NAME_PATTERNS) {
    if (pattern.test(name)) return false
  }

  // 名称关键词
  for (const pattern of BLOCKED_NAME_PATTERNS) {
    if (pattern.test(name)) return false
  }

  return true
}
