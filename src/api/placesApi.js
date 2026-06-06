/**
 * 统一 Places API — 根据 CURRENT_PROVIDER 自动选择适配器
 *
 * 用法:
 *   import { fetchLandmarksByPosition } from './api/placesApi'
 *   const landmarks = await fetchLandmarksByPosition(lat, lng)
 *   // landmarks 格式与现有 LANDMARKS 数组完全一致
 */

import { CURRENT_PROVIDER, PROVIDER_CONFIG, CATEGORY_DEFAULTS, DEFAULT_TIPS } from './providers'
import { fetchFromAmap } from './amapAdapter'
import { fetchFromGoogle } from './googleAdapter'
import LANDMARKS from '../data/landmarks'

// ==================== localStorage 历史去重 ====================

const HISTORY_KEY = 'randomroam_history_pois'
const HISTORY_MAX = 20

export function getHistoryPoiIds() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addToHistory(newIds) {
  try {
    const current = getHistoryPoiIds()
    const merged = [...current, ...newIds]
    // 去重 + 只保留最近 20 个
    const seen = new Set()
    const deduped = []
    for (let i = merged.length - 1; i >= 0; i--) {
      if (!seen.has(merged[i]) && deduped.length < HISTORY_MAX) {
        seen.add(merged[i])
        deduped.unshift(merged[i])
      }
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(deduped))
  } catch { /* localStorage 不可用时静默失败 */ }
}

/**
 * 静态地标兜底：只在 API 失败时使用，且必须按用户位置过滤
 */
function getFilteredFallback(userLat, userLng) {
  const tierRadii = [5, 15, 50, 200]  // 逐级扩大

  for (const maxKm of tierRadii) {
    const nearby = LANDMARKS.filter(lm => {
      const d = haversineDistance(userLat, userLng, lm.lat, lm.lng)
      return d >= 0.3 && d <= maxKm
    })
    if (nearby.length >= 6) {
      console.log(`[RandomRoam] 静态兜底: ${maxKm}km 范围内找到 ${nearby.length} 个地标`)
      return nearby
    }
  }

  // 实在没有则返回前 10 个最近的
  console.warn('[RandomRoam] 200km 内无地标，返回最近 10 个')
  return [...LANDMARKS]
    .map(lm => ({ ...lm, _dist: haversineDistance(userLat, userLng, lm.lat, lm.lng) }))
    .sort((a, b) => a._dist - b._dist)
    .slice(0, 10)
    .map(({ _dist, ...lm }) => lm)
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ==================== 分类映射 ====================

/**
 * 将 API 返回的原始 POI 类型映射到我们的三个类别
 * 同时拒绝无关设施类型（停车场、交通设施等）
 */
function classifyAmapType(amapType) {
  const type = amapType || ''

  // 拒绝无关设施
  if (/停车场|停车库|充电站|加油站|公共厕所|售票处|出入口/.test(type)) return null

  // 美食/餐厅类（独立分类）
  if (/餐厅|火锅|烧烤|小吃|酒楼|饭店|面馆|老字号|美食/.test(type)) return 'food'
  // 文化类
  if (/博物馆|美术馆|展览馆|文化宫|名胜古迹|教堂|寺庙|名人故居|纪念馆|景区/.test(type)) return 'culture'
  // 咖啡/小店类
  if (/咖啡|茶馆|书店|购物|商场|商业街|创意|手作/.test(type)) return 'cafe'
  // 公园/散步类
  if (/公园|植物园|动物园|广场|风景|绿地|步道/.test(type)) return 'park'
  return null
}

function classifyGoogleType(googleTypes) {
  const types = googleTypes || []
  const typeStr = types.join(' ')
  if (/museum|art_gallery|church|mosque|temple|tourist_attraction|place_of_worship/.test(typeStr)) return 'culture'
  if (/cafe|restaurant|book_store|shopping_mall|store|food/.test(typeStr)) return 'cafe'
  if (/park|zoo|natural_feature|garden/.test(typeStr)) return 'park'
  const fallback = ['culture', 'cafe', 'park']
  return fallback[Math.floor(Math.random() * fallback.length)]
}

// ==================== 标准化 ====================

let idCounter = 0

/**
 * 将任意 API 的原始结果标准化为我们的 landmark 格式
 */
function normalizeLandmark(raw, category) {
  const defaults = CATEGORY_DEFAULTS[category] || CATEGORY_DEFAULTS.culture
  const tips = DEFAULT_TIPS[category] || DEFAULT_TIPS.culture
  const randomTip = tips[Math.floor(Math.random() * tips.length)]

  return {
    id: `api_${++idCounter}`,
    name: raw.name,
    category,
    lat: raw.lat,
    lng: raw.lng,
    description: raw.description || raw.address || `${defaults.icon} ${defaults.label}类地点`,
    suggestedStay: defaults.suggestedStay,
    imageQuery: raw.name,
    tip: raw.tip || randomTip,
    address: raw.address || '',
    rating: raw.rating || null,
    photos: raw.photos || [],           // 实景照片 URL 数组
    cost: raw.cost || null,              // 人均消费
    openTime: raw.openTime || null,      // 营业时间
  }
}

// ==================== 主入口 ====================

/**
 * 根据用户坐标获取附近的 landmarks
 *
 * @param {number} lat  纬度
 * @param {number} lng  经度
 * @returns {Promise<Array>}  标准化的 landmark 数组
 */
export async function fetchLandmarksByPosition(lat, lng) {
  // 重置 ID 计数器
  idCounter = 0

  try {
    let rawResults = []

    switch (CURRENT_PROVIDER) {
      case 'amap': {
        const config = PROVIDER_CONFIG.amap
        if (!config.apiKey || config.apiKey === 'YOUR_AMAP_WEB_SERVICE_KEY') {
          console.warn('[RandomRoam] 未配置高德 API Key，使用模拟数据')
          console.warn('[RandomRoam] API 不可用，使用静态地标（已按位置过滤）')
          return getFilteredFallback(lat, lng)
        }

        // 四个类别并行请求，固定 5000m 周边搜索
        const searchRadius = config.radius || 5000
        console.log(`[RandomRoam] 高德周边搜索: radius=${searchRadius}m, location=${lng},${lat}`)

        const [cultureResults, cafeResults, parkResults, foodResults] = await Promise.all([
          fetchFromAmap(lat, lng, config.typeMap.culture, searchRadius, config.apiKey),
          fetchFromAmap(lat, lng, config.typeMap.cafe, searchRadius, config.apiKey),
          fetchFromAmap(lat, lng, config.typeMap.park, searchRadius, config.apiKey),
          fetchFromAmap(lat, lng, config.typeMap.food, searchRadius, config.apiKey),
        ])

        // 标准化并标记类别
        rawResults = [
          ...cultureResults.map(p => ({ ...p, _category: 'culture' })),
          ...cafeResults.map(p => ({ ...p, _category: 'cafe' })),
          ...parkResults.map(p => ({ ...p, _category: 'park' })),
          ...foodResults.map(p => ({ ...p, _category: 'food' })),
        ]
        break
      }

      case 'google': {
        const config = PROVIDER_CONFIG.google
        if (!config.apiKey || config.apiKey === 'YOUR_GOOGLE_API_KEY') {
          console.warn('[RandomRoam] 未配置 Google API Key，使用模拟数据')
          console.warn('[RandomRoam] API 不可用，使用静态地标（已按位置过滤）')
          return getFilteredFallback(lat, lng)
        }

        const [cultureResults, cafeResults, parkResults] = await Promise.all([
          fetchFromGoogle(lat, lng, config.typeMap.culture, config.radius, config.apiKey),
          fetchFromGoogle(lat, lng, config.typeMap.cafe, config.radius, config.apiKey),
          fetchFromGoogle(lat, lng, config.typeMap.park, config.radius, config.apiKey),
        ])

        rawResults = [
          ...cultureResults.map(p => ({ ...p, _category: 'culture' })),
          ...cafeResults.map(p => ({ ...p, _category: 'cafe' })),
          ...parkResults.map(p => ({ ...p, _category: 'park' })),
        ]
        break
      }

      default: // 'mock' 或其他
        console.warn('[RandomRoam] API 不可用，使用静态地标（已按位置过滤）')
          return getFilteredFallback(lat, lng)
    }

    // 标准化所有结果
    let landmarks = rawResults.map(r =>
      normalizeLandmark(r, r._category)
    )

    // ===== localStorage 历史去重：过滤掉近期已出现过的地点 =====
    const historyIds = new Set(getHistoryPoiIds())
    if (historyIds.size > 0) {
      const before = landmarks.length
      landmarks = landmarks.filter(l => !historyIds.has(l.id))
      console.log(`[RandomRoam] 历史去重: ${before} → ${landmarks.length} (剔除 ${before - landmarks.length} 个)`)
    }

    // 如果过滤后某个类别为空，从模拟数据补一些
    const categories = new Set(landmarks.map(l => l.category))
    if (categories.size < 3) {
      const fallbackLandmarks = LANDMARKS.filter(l => !categories.has(l.category) && !historyIds.has(l.id))
      const added = fallbackLandmarks.slice(0, (3 - categories.size) * 3)
      landmarks.push(...added)
    }
    // 也确保 food 类别有数据
    if (!categories.has('food')) {
      const foodFallback = LANDMARKS.filter(l => l.category === 'food' && !historyIds.has(l.id))
      landmarks.push(...foodFallback.slice(0, 3))
    }

    console.log(`[RandomRoam] 从 ${CURRENT_PROVIDER} 获取到 ${landmarks.length} 个地点`, {
      culture: landmarks.filter(l => l.category === 'culture').length,
      cafe: landmarks.filter(l => l.category === 'cafe').length,
      park: landmarks.filter(l => l.category === 'park').length,
    })

    return landmarks
  } catch (err) {
    console.error('[RandomRoam] API 调用失败，降级到模拟数据:', err.message)
    console.warn('[RandomRoam] API 不可用，使用静态地标（已按位置过滤）')
          return getFilteredFallback(lat, lng)
  }
}
