import { useState, useEffect, useCallback } from 'react'
import HomePage from './components/HomePage'
import RouteCard from './components/RouteCard'
import { generateRoute, computeSummary } from './utils/routeGenerator'
import { fetchLandmarksByPosition, addToHistory, getHistoryPoiIds } from './api/placesApi'
import { reverseGeocode, fetchWalkingRoute } from './api/amapAdapter'
import { PROVIDER_CONFIG, CURRENT_PROVIDER } from './api/providers'
import LANDMARKS from './data/landmarks'

/**
 * 应用主组件 — 状态管理 + 流程编排 + 跨代去重
 *
 * 数据流:
 *   Geolocation API
 *     ├─→ reverseGeocode() → 首页城市名
 *     └─→ fetchLandmarksByPosition() → generateRoute(excludeIds) → fetchWalkingRoute() → UI
 *
 * 用户偏好:
 *   首页 → PreferenceSelector → transport / time / style → 路线生成
 *
 * 去重:
 *   每次生成路线后记录使用的 landmark ID，下次生成时排除这些 ID
 *   保留最近 20 个 ID（约 3-5 次生成的路线）
 */
export default function App() {
  const [page, setPage] = useState('home')
  const [userCoords, setUserCoords] = useState(null)
  const [locationInfo, setLocationInfo] = useState('正在获取位置...')
  const [routeData, setRouteData] = useState(null)
  const [preferences, setPreferences] = useState(null)
  // localStorage 持久化跨代去重队列 — 路径: randomroam_history_pois, 最多 20 个

  // ==================== 获取用户位置 ====================
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationInfo('定位不可用 · 使用默认位置')
      setUserCoords({ lat: 31.2304, lng: 121.4737 })
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }
        setUserCoords(coords)

        try {
          const apiKey = PROVIDER_CONFIG[CURRENT_PROVIDER]?.apiKey
          if (apiKey && apiKey !== 'YOUR_AMAP_WEB_SERVICE_KEY') {
            const address = await reverseGeocode(coords.lat, coords.lng, apiKey)
            if (address) setLocationInfo(address)
            else setLocationInfo(`${coords.lat.toFixed(2)}°, ${coords.lng.toFixed(2)}°`)
          } else {
            setLocationInfo(`${coords.lat.toFixed(2)}°, ${coords.lng.toFixed(2)}°`)
          }
        } catch {
          setLocationInfo(`${coords.lat.toFixed(2)}°, ${coords.lng.toFixed(2)}°`)
        }
      },
      (err) => {
        console.warn('Geolocation error:', err.message)
        setLocationInfo('定位失败 · 使用默认位置')
        setUserCoords({ lat: 31.2304, lng: 121.4737 })
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    )
  }, [])

  // ==================== 用真实步行 API 丰富路线数据 ====================
  const enrichWithWalking = async (orderedRoute, userLat, userLng, apiKey) => {
    const legs = []
    if (orderedRoute.length > 0) {
      legs.push({ fromLat: userLat, fromLng: userLng, toIdx: 0 })
    }
    for (let i = 1; i < orderedRoute.length; i++) {
      legs.push({ fromIdx: i - 1, toIdx: i })
    }

    const results = await Promise.all(
      legs.map(async (leg) => {
        const fromLat = leg.fromLat ?? (orderedRoute[leg.fromIdx].landmark || orderedRoute[leg.fromIdx]).lat
        const fromLng = leg.fromLng ?? (orderedRoute[leg.fromIdx].landmark || orderedRoute[leg.fromIdx]).lng
        const to = orderedRoute[leg.toIdx].landmark || orderedRoute[leg.toIdx]

        const walking = await fetchWalkingRoute(fromLat, fromLng, to.lat, to.lng, apiKey)
        return { toIdx: leg.toIdx, walking }
      })
    )

    for (const { toIdx, walking } of results) {
      if (walking && walking.distance > 0) {
        orderedRoute[toIdx] = {
          ...orderedRoute[toIdx],
          walkingDist: walking.distance / 1000,
          walkingTime: walking.duration / 60,
          walkingSteps: walking.steps,
        }
      }
    }

    return orderedRoute
  }

  /**
   * 记录本次路线使用的地标 ID，持久化到 localStorage
   * 保留最近 20 个，自动去重
   */
  const recordUsedIds = useCallback((orderedRoute) => {
    const newIds = orderedRoute.map((s) => (s.landmark || s).id).filter(Boolean)
    addToHistory(newIds)
  }, [])

  // ==================== 核心：异步生成路线 ====================
  const doGenerateRoute = useCallback(async (coords, prefs, excludeIds) => {
    setPage('loading')

    try {
      const landmarks = await fetchLandmarksByPosition(coords.lat, coords.lng)

      const result = generateRoute(coords.lat, coords.lng, landmarks, prefs, excludeIds)

      if (result.success) {
        const isWalkMode = !prefs || prefs.transport === 'walk'
        const apiKey = PROVIDER_CONFIG[CURRENT_PROVIDER]?.apiKey
        if (isWalkMode && apiKey && apiKey !== 'YOUR_AMAP_WEB_SERVICE_KEY') {
          result.orderedRoute = await enrichWithWalking(
            result.orderedRoute, coords.lat, coords.lng, apiKey
          )
          result.summary = computeSummary(result.orderedRoute, prefs)
        }

        recordUsedIds(result.orderedRoute)
        setRouteData({
          orderedRoute: result.orderedRoute,
          summary: result.summary,
        })
        setPage('route')
      } else {
        // 第一层兜底：用静态数据 + 去重
        const fb = generateRoute(coords.lat, coords.lng, LANDMARKS, prefs, excludeIds)
        if (fb.success) {
          recordUsedIds(fb.orderedRoute)
          setRouteData({ orderedRoute: fb.orderedRoute, summary: fb.summary })
          setPage('route')
        } else {
          // 第二层兜底：不用偏好，不用去重
          const fb2 = generateRoute(coords.lat, coords.lng, LANDMARKS)
          if (fb2.success) {
            recordUsedIds(fb2.orderedRoute)
            setRouteData({ orderedRoute: fb2.orderedRoute, summary: fb2.summary })
            setPage('route')
          } else {
            alert(fb2.error || '生成路线失败，请再试一次')
            setPage('home')
          }
        }
      }
    } catch (err) {
      console.error('路线生成异常:', err)
      const fb = generateRoute(coords.lat, coords.lng, LANDMARKS, prefs, excludeIds)
      if (fb.success) {
        recordUsedIds(fb.orderedRoute)
        setRouteData({ orderedRoute: fb.orderedRoute, summary: fb.summary })
        setPage('route')
      } else {
        alert('出了点问题，请再试一次')
        setPage('home')
      }
    }
  }, [recordUsedIds])

  // ==================== 按钮回调 ====================
  const handleStartRoam = useCallback((prefs) => {
    if (!userCoords) return
    setPreferences(prefs)
    // 首次漫游：读取 localStorage 中的历史记录作为排除列表
    const history = getHistoryPoiIds()
    doGenerateRoute(userCoords, prefs, history)
  }, [userCoords, doGenerateRoute])

  const handleRegenerate = useCallback(() => {
    if (!userCoords) return
    const history = getHistoryPoiIds()
    doGenerateRoute(userCoords, preferences, history)
  }, [userCoords, preferences, doGenerateRoute])

  const handleBack = useCallback(() => {
    setPage('home')
    setRouteData(null)
    setPreferences(null)
  }, [])

  // ==================== 渲染 ====================
  return (
    <div className="relative h-full w-full max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto overflow-hidden">
      {/* 桌面端侧边氛围光 */}
      <div className="hidden md:block absolute inset-y-0 -left-32 w-32 bg-gradient-to-r from-amber-400/[0.02] to-transparent pointer-events-none" />
      <div className="hidden md:block absolute inset-y-0 -right-32 w-32 bg-gradient-to-l from-violet-400/[0.02] to-transparent pointer-events-none" />

      <div className="ambient-bg" />

      <div className="relative z-10 h-full">
        {(page === 'home' || page === 'loading') && (
          <HomePage
            onStartRoam={handleStartRoam}
            isLoading={page === 'loading'}
            locationInfo={locationInfo}
          />
        )}

        {page === 'route' && routeData && (
          <RouteCard
            routeData={routeData}
            preferences={preferences}
            onBack={handleBack}
            onRegenerate={handleRegenerate}
          />
        )}
      </div>
    </div>
  )
}
