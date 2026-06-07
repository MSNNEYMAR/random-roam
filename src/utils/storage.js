/**
 * 路线持久化 — localStorage + URL hash
 *
 * - 自动保存最近一条路线到 localStorage
 * - 首页显示"继续上次路线"入口
 * - URL hash #continue 可自动恢复
 * - 路线历史列表 (最多10条)
 */

const STORAGE_KEY = 'randomroam_last_route'
const HISTORY_KEY = 'randomroam_history'
const HISTORY_MAX = 10

/**
 * 保存路线到 localStorage
 * @param {object} data  { orderedRoute, summary, days, preferences, userCoords, locationInfo }
 */
export function saveRoute(data) {
  try {
    const payload = {
      orderedRoute: data.orderedRoute,
      summary: data.summary,
      days: data.days || null,
      preferences: data.preferences || null,
      userCoords: data.userCoords || null,
      locationInfo: data.locationInfo || '',
      savedAt: Date.now(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // localStorage 不可用或已满，静默失败
  }
}

/**
 * 从 localStorage 读取最近一条路线
 * @returns {object|null}
 */
export function loadSavedRoute() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data.orderedRoute || !data.summary) return null
    return data
  } catch {
    return null
  }
}

/**
 * 清除保存的路线
 */
export function clearSavedRoute() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * 检查是否有保存的路线
 */
export function hasSavedRoute() {
  return !!loadSavedRoute()
}

// ==================== 路线历史 ====================

/**
 * 添加路线到历史列表
 * 只存摘要（不存完整路线详情），节省 localStorage 空间
 *
 * @param {object} entry  { summary, preferences, userCoords, locationInfo, transport, style }
 */
export function addToRouteHistory(entry) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    let history = raw ? JSON.parse(raw) : []

    // 去重 — 5分钟内相同的坐标和偏好算重复
    const now = Date.now()
    history = history.filter((h) => {
      if (now - h.savedAt < 300000) {
        const sameCoords = h.lat === entry.userCoords?.lat && h.lng === entry.userCoords?.lng
        const samePrefs = h.transport === entry.transport && h.style === entry.style
        if (sameCoords && samePrefs) return false
      }
      return true
    })

    history.unshift({
      summary: {
        totalStops: entry.summary?.totalStops || 0,
        totalTime: entry.summary?.totalTime || 0,
        totalWalkingDist: entry.summary?.totalWalkingDist || 0,
      },
      preferences: entry.preferences || {},
      transport: entry.transport || 'walk',
      style: entry.style || 'relax',
      userCoords: entry.userCoords || null,
      locationInfo: entry.locationInfo || '',
      lat: entry.userCoords?.lat,
      lng: entry.userCoords?.lng,
      savedAt: now,
    })

    if (history.length > HISTORY_MAX) history = history.slice(0, HISTORY_MAX)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  } catch {
    // ignore
  }
}

/**
 * 读取路线历史列表
 * @returns {Array}
 */
export function loadRouteHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * 清空历史
 */
export function clearRouteHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY)
  } catch {
    // ignore
  }
}
