/**
 * 统一 Places API — 100% 高德周边搜索，无静态兜底
 */

import { CURRENT_PROVIDER, PROVIDER_CONFIG, CATEGORY_DEFAULTS, DEFAULT_TIPS } from './providers'
import { fetchFromAmap } from './amapAdapter'
import { fetchFromGoogle } from './googleAdapter'
import { TRANSPORT_CONFIG } from '../utils/routeGenerator'
import { isValidPOI } from '../engine/poiFilter.js'

// ==================== localStorage 历史去重 ====================

const HISTORY_KEY = 'randomroam_history_pois'
const HISTORY_MAX = 20

export function getHistoryPoiIds() {
  try { const raw = localStorage.getItem(HISTORY_KEY); return raw ? JSON.parse(raw) : [] }
  catch { return [] }
}

export function addToHistory(newIds) {
  try {
    const current = getHistoryPoiIds()
    const merged = [...current, ...newIds]
    const seen = new Set(); const deduped = []
    for (let i = merged.length - 1; i >= 0 && deduped.length < HISTORY_MAX; i--) {
      if (!seen.has(merged[i])) { seen.add(merged[i]); deduped.unshift(merged[i]) }
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(deduped))
  } catch {}
}

// ==================== 分类映射 ====================

function classifyAmapType(amapType) {
  const type = amapType || ''
  if (/停车场|停车库|充电站|加油站|公共厕所|售票处|出入口/.test(type)) return null
  if (/餐厅|火锅|烧烤|小吃|酒楼|饭店|面馆|老字号|美食/.test(type)) return 'food'
  if (/博物馆|美术馆|展览馆|文化宫|名胜古迹|教堂|寺庙|名人故居|纪念馆|景区/.test(type)) return 'culture'
  if (/咖啡|茶馆|书店|购物|商场|商业街|创意|手作/.test(type)) return 'cafe'
  if (/公园|植物园|动物园|广场|风景|绿地|步道/.test(type)) return 'park'
  return null
}

function classifyGoogleType(googleTypes) {
  const typeStr = (googleTypes || []).join(' ')
  if (/museum|art_gallery|church|mosque|temple|tourist_attraction|place_of_worship/.test(typeStr)) return 'culture'
  if (/cafe|restaurant|book_store|shopping_mall|store|food/.test(typeStr)) return 'cafe'
  if (/park|zoo|natural_feature|garden/.test(typeStr)) return 'park'
  return ['culture', 'cafe', 'park'][Math.floor(Math.random() * 3)]
}

// ==================== 标准化 ====================

function normalizeLandmark(raw, category, idx) {
  const defaults = CATEGORY_DEFAULTS[category] || CATEGORY_DEFAULTS.culture
  const tips = DEFAULT_TIPS[category] || DEFAULT_TIPS.culture
  const randomTip = tips[Math.floor(Math.random() * tips.length)]

  return {
    id: `api_${idx}`,
    name: raw.name,
    category,
    lat: raw.lat,
    lng: raw.lng,
    description: raw.description || raw.address || `${defaults.icon} ${defaults.label}类地点`,
    suggestedStay: defaults.suggestedStay,
    tip: raw.tip || randomTip,
    address: raw.address || '',
    rating: raw.rating || null,
    photos: raw.photos || [],
    cost: raw.cost || null,
    openTime: raw.openTime || null,
  }
}

// ==================== 主入口 ====================

/**
 * @param {number} lat                   中心点纬度
 * @param {number} lng                   中心点经度
 * @param {number} searchRadiusOverride  出行方式决定的搜索半径 (米)，未传则用默认 10000m
 * @returns {Promise<Array>} 标准化后的地标列表
 */
export async function fetchLandmarksByPosition(lat, lng, searchRadiusOverride = null) {
  let rawResults = []

  switch (CURRENT_PROVIDER) {
    case 'amap': {
      const config = PROVIDER_CONFIG.amap

      const searchRadius = searchRadiusOverride || config.radius || 10000
      console.log(`[RandomRoam] 高德周边搜索: radius=${searchRadius}m, location=${lng},${lat}`)

      const [cultureResults, cafeResults, parkResults, foodResults] = await Promise.all([
        fetchFromAmap(lat, lng, config.typeMap.culture, searchRadius),
        fetchFromAmap(lat, lng, config.typeMap.cafe, searchRadius),
        fetchFromAmap(lat, lng, config.typeMap.park, searchRadius),
        fetchFromAmap(lat, lng, config.typeMap.food, searchRadius),
      ])

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
        throw new Error('Google API Key 未配置')
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

    default:
      throw new Error('未配置地图服务商，请在 providers.js 中设置 CURRENT_PROVIDER')
  }

  // 标准化（用 index 做 ID，消除模块级可变状态并发隐患）
  let landmarks = rawResults.map((r, idx) => normalizeLandmark(r, r._category, idx))

  // Layer 1 过滤 — 剔除低质量 POI
  const beforeFilter = landmarks.length
  landmarks = landmarks.filter(l => isValidPOI(l))
  if (beforeFilter > landmarks.length) {
    console.log(`[RandomRoam] POI过滤: ${beforeFilter} → ${landmarks.length} (剔除 ${beforeFilter - landmarks.length} 个低质量POI)`)
  }

  // localStorage 历史去重
  const historyIds = new Set(getHistoryPoiIds())
  if (historyIds.size > 0) {
    const before = landmarks.length
    landmarks = landmarks.filter(l => !historyIds.has(l.id))
    console.log(`[RandomRoam] 历史去重: ${before} → ${landmarks.length}`)
  }

  console.log(`[RandomRoam] 获取到 ${landmarks.length} 个地点`, {
    culture: landmarks.filter(l => l.category === 'culture').length,
    cafe: landmarks.filter(l => l.category === 'cafe').length,
    park: landmarks.filter(l => l.category === 'park').length,
    food: landmarks.filter(l => l.category === 'food').length,
  })

  return landmarks
}
