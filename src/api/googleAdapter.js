/**
 * Google Places API 适配器
 *
 * 文档: https://developers.google.com/maps/documentation/places/web-service
 *
 * 注意: Google Places API 同样不支持纯浏览器跨域调用。
 * 两种做法:
 *   1. Vite 代理 (开发) + 后端代理 (生产) — 本文件采用此方式
 *   2. Google Maps JavaScript API 的 PlacesService (纯浏览器方案，需加载 SDK)
 *
 * 代理配置见 vite.config.js:
 *   server.proxy: { '/api/google': { target: 'https://maps.googleapis.com', ... } }
 */

const GOOGLE_BASE = '/api/google'  // 由 Vite proxy 转发到 maps.googleapis.com

/**
 * 调用 Google Places "Nearby Search" API
 *
 * @param {number} lat      中心点纬度
 * @param {number} lng      中心点经度
 * @param {string} types    搜索类型 (用 | 分隔，但 Google 一次只支持一种 type)
 * @param {number} radius   搜索半径 (米)
 * @param {string} apiKey   Google Cloud API Key
 * @returns {Promise<Array<{name, lat, lng, address, description}>>}
 */
export async function fetchFromGoogle(lat, lng, types, radius, apiKey) {
  // Google 的 type 参数不接受多个值，取第一个
  const primaryType = types.split('|')[0]

  const params = new URLSearchParams({
    key: apiKey,
    location: `${lat},${lng}`,
    radius: String(radius),
    type: primaryType,
    language: 'zh-CN',  // 返回中文结果
  })

  const url = `${GOOGLE_BASE}/maps/api/place/nearbysearch/json?${params.toString()}`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Google API HTTP ${response.status}`)
  }

  const data = await response.json()

  // Google API 的三种状态: "OK" | "ZERO_RESULTS" | 错误状态
  if (data.status === 'ZERO_RESULTS') {
    return []
  }

  if (data.status !== 'OK') {
    console.warn(`[Google] 搜索 "${primaryType}" 失败:`, data.status, data.error_message)
    return []
  }

  return (data.results || []).map(place => ({
    name: place.name,
    lat: place.geometry?.location?.lat || 0,
    lng: place.geometry?.location?.lng || 0,
    address: place.vicinity || '',
    description: buildDescription(place),
    rating: place.rating,
    photoUrl: place.photos?.[0]
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${apiKey}`
      : null,
  }))
}

/**
 * 从 Google Place 字段拼合描述文本
 */
function buildDescription(place) {
  const parts = []

  if (place.rating) {
    parts.push(`⭐ ${place.rating} (${place.user_ratings_total || 0}条评价)`)
  }

  if (place.price_level !== undefined) {
    parts.push('💰'.repeat(place.price_level + 1))
  }

  if (place.vicinity) {
    parts.push(place.vicinity)
  }

  return parts.join(' | ') || place.name
}
