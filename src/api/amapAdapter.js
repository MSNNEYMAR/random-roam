/**
 * 高德地图 Web服务 API 适配器
 *
 * 文档: https://lbs.amap.com/api/webservice/guide/api/search
 *
 * 注意: 高德 Web服务 API 不支持浏览器直接跨域调用。
 * 解决方案: 通过 Vite 开发代理转发请求。
 *
 * 代理配置见 vite.config.js:
 *   server.proxy: { '/api/amap': { target: 'https://restapi.amap.com', ... } }
 *
 * 生产环境需要你自己的后端代理或 Cloudflare Worker。
 */

const AMAP_BASE = '/api/amap'  // 由 Vite proxy 转发到 restapi.amap.com

// ==================== 营业时间智能过滤 ====================

/**
 * 营业时间过滤 — 根据高德 open_time 判断当前是否在营业
 *
 * @param {object}  poi  高德原始 POI 对象
 * @returns {boolean} true = 已关门，应过滤掉
 */
function isCurrentlyClosed(poi) {
  // 高德 API 可能返回数组或字符串，统一转字符串
  const bizExt = poi.biz_ext || {}
  const rawOpenTime = bizExt.open_time || bizExt.opentime2 || ''
  const rawTime = Array.isArray(rawOpenTime) ? '' : String(rawOpenTime)
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const currentHour = now.getHours()

  // 1) 有明确营业时间 → 解析并检查
  if (rawTime && rawTime.trim()) {
    return !isOpenNow(rawTime.trim(), currentMinutes)
  }

  // 2) 无营业时间 + 深夜 (22:00-06:00) → 只保留餐饮/夜间场所
  if (currentHour >= 22 || currentHour < 6) {
    const name = (poi.name || '').toLowerCase()
    const rawType = (poi.type || '').toLowerCase()
    const isNightOk =
      /餐厅|火锅|烧烤|小吃|美食|大排档|面馆|饭店|酒楼|食堂/.test(rawType) ||
      /酒吧|夜店|KTV|影院|电影院|LiveHouse|清吧|便利店/.test(rawType) ||
      /酒吧|夜店|KTV|电影院|便利店/.test(name)
    return !isNightOk
  }

  // 3) 白天 + 无营业时间 → 不过滤
  return false
}

/**
 * 解析高德营业时间字符串，检查 currentMinutes 是否在任一时段内
 */
function isOpenNow(timeStr, currentMinutes) {
  const segments = timeStr.split(/[,;，；\s]+/).filter(Boolean)

  for (const seg of segments) {
    const clean = seg.replace(/^[^0-9]*/, '').trim()
    const match = clean.match(/(\d{1,2}):(\d{2})\s*[-～~—]+\s*(\d{1,2}):(\d{2})/)
    if (!match) continue

    const openH = parseInt(match[1], 10)
    const openM = parseInt(match[2], 10)
    const closeH = parseInt(match[3], 10)
    const closeM = parseInt(match[4], 10)

    const openMinutes = openH * 60 + openM
    let closeMinutes = closeH * 60 + closeM

    // 跨午夜："22:00-02:00"
    if (closeMinutes <= openMinutes) closeMinutes += 24 * 60

    const cur = currentMinutes
    const curAlt = cur + 24 * 60  // 凌晨时段

    if ((cur >= openMinutes && cur <= closeMinutes) ||
        (curAlt >= openMinutes && curAlt <= closeMinutes)) {
      return true
    }
  }

  return false
}

// ==================== 无关设施过滤 ====================

/**
 * 判断一个 POI 是否为无关设施（停车场、出入口、充电站等）
 */
function isIrrelevantPOI(poi) {
  const name = poi.name || ''
  const type = poi.type || ''
  const combined = `${name} ${type}`

  // 停车场
  if (/停车场|停车库|停车楼|P\+R|泊车/.test(combined)) return true
  // 充电站/加油站
  if (/充电站|充电桩|换电站|加油站|加气站/.test(combined)) return true
  // 厕所
  if (/公共厕所|卫生间|公厕/.test(name)) return true
  // 纯出入口（"XX入口"、"XX出口"、"XX东/南/西/北门"）
  if (/^.{1,6}(入口|出口|东门|南门|西门|北门|侧门|后门)$/.test(name)) return true
  // 售票处
  if (/售票处|售票厅|票务中心/.test(name)) return true
  // 公交/地铁站（只匹配纯站名，不误杀景点名）
  if (/^(公交|地铁|轨道交通|客运)/.test(name)) return true
  if (/车站$/.test(name) && name.length <= 5) return true // "XX站"
  // ATM/银行服务点
  if (/^(ATM|银行|储蓄所)/.test(name)) return true

  return false
}

/**
 * 调用高德 "周边搜索" API (v3/place/around)
 *
 * @param {number} lat      中心点纬度
 * @param {number} lng      中心点经度
 * @param {string} keywords 搜索关键词 (用 | 分隔多个类型)
 * @param {number} radius   搜索半径 (米)
 * @param {string} apiKey   高德 Web服务 API Key
 * @returns {Promise<Array<{name, lat, lng, address, description}>>}
 */
export async function fetchFromAmap(lat, lng, keywords, radius) {
  // place/around 周边搜索：location 圆心 + radius 半径天然限定范围，无需 citylimit
  // API Key 由 Vercel Serverless Function 或 Vite dev proxy 在服务端注入
  const location = `${lng},${lat}`

  const params = new URLSearchParams({
    location,
    radius: String(radius),    // 严格 N 米内的结果
    keywords,
    offset: '30',
    page: '1',
    extensions: 'all',
  })

  const url = `${AMAP_BASE}/v3/place/around?${params.toString()}`

  let response
  try {
    response = await fetch(url)
  } catch (netErr) {
    console.error(`[Amap] fetch failed (${keywords.slice(0, 30)}):`, netErr)
    throw new Error(`网络请求失败: ${netErr.message || netErr}`)
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    console.error(`[Amap] HTTP ${response.status} (${keywords.slice(0, 30)}):`, errorText)
    throw new Error(`Amap API HTTP ${response.status}: ${errorText.slice(0, 200)}`)
  }

  const data = await response.json()

  // 高德 API 响应格式: { status: "1", pois: [...], count: "..." }
  if (data.status !== '1') {
    console.warn(`[Amap] 搜索 "${keywords}" 失败:`, data.info)
    return []
  }

  // 过滤无关设施（停车场、出入口、厕所等）
  const relevant = (data.pois || [])
    .filter(poi => !isIrrelevantPOI(poi))

  // 营业时间智能过滤
  const openNow = relevant.filter(poi => !isCurrentlyClosed(poi))

  if (openNow.length < relevant.length) {
    console.log(`[Amap] 营业时间过滤: ${relevant.length} → ${openNow.length} (剔除 ${relevant.length - openNow.length} 个已关门)`)
  }

  return openNow.map(poi => {
    // 高德返回的 location 是 "lng,lat" 字符串
    const [poiLng, poiLat] = (poi.location || '0,0').split(',').map(Number)

    // 提取实景照片 URL（取前3张）
    const photos = (poi.photos || []).map(p => p.url).filter(Boolean).slice(0, 3)
    const bizExt = poi.biz_ext || {}

    return {
      name: poi.name,
      lat: poiLat,
      lng: poiLng,
      address: poi.address || '',
      description: buildDescription(poi),
      photos,
      rating: (bizExt.rating != null && !Array.isArray(bizExt.rating)) ? bizExt.rating : null,
      cost: (bizExt.cost != null && !Array.isArray(bizExt.cost)) ? bizExt.cost : null,
      openTime: ((typeof bizExt.open_time === 'string' && bizExt.open_time) || bizExt.opentime2) || null,
    }
  })
}

/**
 * 步行路径规划 — 获取两点之间的真实步行距离和时间
 *
 * 文档: https://lbs.amap.com/api/webservice/guide/api/direction
 * 接口: v3/direction/walking
 *
 * @param {number} originLat   起点纬度
 * @param {number} originLng   起点经度
 * @param {number} destLat     终点纬度
 * @param {number} destLng     终点经度
 * @param {string} apiKey      高德 Web服务 API Key
 * @returns {Promise<{distance: number, duration: number, steps: Array} | null>}
 *          distance — 步行距离 (米)
 *          duration — 步行时长 (秒)
 */
export async function fetchWalkingRoute(originLat, originLng, destLat, destLng) {
  const origin = `${originLng},${originLat}`
  const destination = `${destLng},${destLat}`

  const params = new URLSearchParams({
    origin,
    destination,
  })

  const url = `${AMAP_BASE}/v3/direction/walking?${params.toString()}`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`[Amap] 步行路径 HTTP ${response.status}`)
      return null
    }

    const data = await response.json()

    if (data.status !== '1' || !data.route?.paths?.length) {
      console.warn('[Amap] 步行路径规划失败:', data.info)
      return null
    }

    const path = data.route.paths[0]

    return {
      distance: Number(path.distance) || 0,   // 米
      duration: Number(path.duration) || 0,    // 秒
      steps: (path.steps || []).map(step => ({
        instruction: step.instruction,
        road: step.road,
        distance: Number(step.distance),
        duration: Number(step.duration),
      })),
    }
  } catch (err) {
    console.warn('[Amap] 步行路径请求异常:', err.message)
    return null
  }
}

/**
 * 逆地理编码 — 坐标 → 人类可读地址
 *
 * 文档: https://lbs.amap.com/api/webservice/guide/api/georegeo
 *
 * @param {number} lat    纬度
 * @param {number} lng    经度
 * @param {string} apiKey 高德 Web服务 API Key
 * @returns {Promise<string>} 如 "广州市天河区体育西路"
 */
export async function reverseGeocode(lat, lng) {
  const location = `${lng},${lat}`

  const params = new URLSearchParams({
    location,
    radius: '1000',
    extensions: 'base',
  })

  const url = `${AMAP_BASE}/v3/geocode/regeo?${params.toString()}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Reverse geocode HTTP ${response.status}`)
  }

  const data = await response.json()

  if (data.status !== '1') {
    console.warn('[Amap] 逆地理编码失败:', data.info)
    return null
  }

  const regeocode = data.regeocode
  if (!regeocode) return null

  // 组装：城市 + 区 + 街道 (取最精炼的描述)
  const ac = regeocode.addressComponent
  const parts = []

  if (ac.city && ac.city !== '[]') {
    // 直辖市 city 可能为空，province 才是城市名
    parts.push(ac.city)
  }
  if (ac.district && ac.district !== '[]') {
    parts.push(ac.district)
  }
  if (ac.township && ac.township !== '[]') {
    parts.push(ac.township)
  }

  // 如果上述都为空(如直辖市)，用 province
  if (parts.length === 0 && ac.province && ac.province !== '[]') {
    parts.push(ac.province)
    if (ac.district && ac.district !== '[]') parts.push(ac.district)
  }

  const address = parts.join(' ') || regeocode.formatted_address || '未知地点'

  return address
}

function buildDescription(poi) {
  const parts = []

  if (poi.type) {
    // 去掉分类中的分号，取更可读的
    const typeClean = poi.type.split(';').slice(0, 2).join(' · ')
    parts.push(typeClean)
  }

  if (poi.biz_ext?.rating != null && !Array.isArray(poi.biz_ext.rating) && poi.biz_ext.rating) {
    parts.push(`⭐ ${poi.biz_ext.rating}`)
  }

  if (poi.biz_ext?.cost != null && !Array.isArray(poi.biz_ext.cost) && poi.biz_ext.cost) {
    parts.push(`人均 ¥${poi.biz_ext.cost}`)
  }

  if (poi.address && !parts.some(p => p.includes(poi.address))) {
    parts.push(poi.address)
  }

  return parts.join(' | ') || poi.name
}

/**
 * 地理编码 — 城市名 → 坐标
 *
 * 文档: https://lbs.amap.com/api/webservice/guide/api/georegeo
 * 接口: v3/geocode/geo
 *
 * @param {string} cityName  城市名，如 "广州"、"成都"、"南京"
 * @param {string} apiKey    高德 Web服务 API Key
 * @returns {Promise<{lat: number, lng: number, address: string} | null>}
 */
export async function geocodeCity(cityName) {
  const params = new URLSearchParams({
    address: cityName,
    city: cityName,
  })

  const url = `${AMAP_BASE}/v3/geocode/geo?${params.toString()}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Geocode HTTP ${response.status}`)
  }

  const data = await response.json()

  if (data.status !== '1' || !data.geocodes?.length) {
    console.warn('[Amap] 地理编码失败:', data.info)
    return null
  }

  const geo = data.geocodes[0]
  const [lngStr, latStr] = (geo.location || '0,0').split(',')
  const lat = parseFloat(latStr)
  const lng = parseFloat(lngStr)

  return {
    lat,
    lng,
    address: geo.formatted_address || cityName,
  }
}
