import { useState, useEffect, useCallback } from 'react'
import HomePage from './components/HomePage'
import RouteCard from './components/RouteCard'
import { generateRoute, computeSummary, TRANSPORT_CONFIG } from './utils/routeGenerator'
import { fetchLandmarksByPosition, addToHistory, getHistoryPoiIds } from './api/placesApi'
import { reverseGeocode, fetchWalkingRoute, geocodeCity } from './api/amapAdapter'
import { PROVIDER_CONFIG, CURRENT_PROVIDER } from './api/providers'

/**
 * 应用主组件 — 100% 高德 API 驱动，全国通用，基于用户实时位置 + 出行方式动态搜索半径
 */
export default function App() {
  const [page, setPage] = useState('home')
  const [userCoords, setUserCoords] = useState(null)
  const [locationInfo, setLocationInfo] = useState('正在获取位置...')
  const [routeData, setRouteData] = useState(null)
  const [preferences, setPreferences] = useState(null)

  // ==================== 获取用户位置 ====================
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationInfo('定位失败 · 请允许定位权限')
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserCoords(coords)

        try {
          const apiKey = PROVIDER_CONFIG[CURRENT_PROVIDER]?.apiKey
          if (apiKey && apiKey !== 'YOUR_AMAP_WEB_SERVICE_KEY') {
            const address = await reverseGeocode(coords.lat, coords.lng, apiKey)
            setLocationInfo(address || `${coords.lat.toFixed(2)}°, ${coords.lng.toFixed(2)}°`)
          } else {
            setLocationInfo(`${coords.lat.toFixed(2)}°, ${coords.lng.toFixed(2)}°`)
          }
        } catch {
          setLocationInfo(`${coords.lat.toFixed(2)}°, ${coords.lng.toFixed(2)}°`)
        }
      },
      () => {
        setLocationInfo('定位失败 · 请在设置中允许定位权限')
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    )
  }, [])

  // ==================== 步行 API 丰富 ====================
  const enrichWithWalking = async (orderedRoute, userLat, userLng, apiKey) => {
    const legs = []
    if (orderedRoute.length > 0) legs.push({ fromLat: userLat, fromLng: userLng, toIdx: 0 })
    for (let i = 1; i < orderedRoute.length; i++) legs.push({ fromIdx: i - 1, toIdx: i })

    const results = await Promise.all(legs.map(async (leg) => {
      const fromLat = leg.fromLat ?? (orderedRoute[leg.fromIdx].landmark || orderedRoute[leg.fromIdx]).lat
      const fromLng = leg.fromLng ?? (orderedRoute[leg.fromIdx].landmark || orderedRoute[leg.fromIdx]).lng
      const to = orderedRoute[leg.toIdx].landmark || orderedRoute[leg.toIdx]
      const walking = await fetchWalkingRoute(fromLat, fromLng, to.lat, to.lng, apiKey)
      return { toIdx: leg.toIdx, walking }
    }))

    for (const { toIdx, walking } of results) {
      if (walking && walking.distance > 0) {
        orderedRoute[toIdx] = { ...orderedRoute[toIdx], walkingDist: walking.distance / 1000, walkingTime: walking.duration / 60, walkingSteps: walking.steps }
      }
    }
    return orderedRoute
  }

  const recordUsedIds = useCallback((orderedRoute) => {
    const newIds = orderedRoute.map((s) => (s.landmark || s).id).filter(Boolean)
    addToHistory(newIds)
  }, [])

  // ==================== 核心：生成路线 ====================
  const doGenerateRoute = useCallback(async (coords, prefs, excludeIds) => {
    setPage('loading')

    try {
      // 根据出行方式动态决定 API 搜索半径
      const transport = prefs?.transport || 'walk'
      const tConfig = TRANSPORT_CONFIG[transport] || TRANSPORT_CONFIG.walk
      const landmarks = await fetchLandmarksByPosition(coords.lat, coords.lng, tConfig.searchRadius)
      const result = generateRoute(coords.lat, coords.lng, landmarks, prefs, excludeIds)

      if (!result.success) {
        alert(result.error || '生成路线失败，请再试一次')
        setPage('home')
        return
      }

      // 仅步行模式下用真实步行 API 丰富路径（骑行/打车用 haversine + 速度系数）
      const isWalkMode = prefs?.transport === 'walk'
      const apiKey = PROVIDER_CONFIG[CURRENT_PROVIDER]?.apiKey
      if (isWalkMode && apiKey && apiKey !== 'YOUR_AMAP_WEB_SERVICE_KEY') {
        result.orderedRoute = await enrichWithWalking(result.orderedRoute, coords.lat, coords.lng, apiKey)
        result.summary = computeSummary(result.orderedRoute, prefs)

        // 多天路线：每天也重算
        if (result.days) {
          for (const day of result.days) {
            day.orderedRoute = await enrichWithWalking(day.orderedRoute, coords.lat, coords.lng, apiKey)
            day.summary = computeSummary(day.orderedRoute, prefs)
          }
        }
      }

      recordUsedIds(result.orderedRoute)
      setRouteData({
        orderedRoute: result.orderedRoute,
        summary: result.summary,
        days: result.days || null,
      })
      setPage('route')
    } catch (err) {
      console.error('路线生成异常:', err)
      alert('出了点问题，请检查网络后重试\n\n错误详情: ' + (err?.message || err))
      setPage('home')
    }
  }, [recordUsedIds])

  // ==================== 城市搜索降级 ====================
  const handleCitySearch = useCallback(async (cityName) => {
    const apiKey = PROVIDER_CONFIG[CURRENT_PROVIDER]?.apiKey
    if (!apiKey || apiKey === 'YOUR_AMAP_WEB_SERVICE_KEY') {
      throw new Error('API Key 未配置')
    }
    const result = await geocodeCity(cityName, apiKey)
    if (!result) {
      throw new Error(`找不到城市"${cityName}"，请换个名称试试`)
    }
    setUserCoords({ lat: result.lat, lng: result.lng })
    setLocationInfo(result.address || cityName)
  }, [])

  // ==================== 按钮回调 ====================
  const handleStartRoam = useCallback((prefs) => {
    if (!userCoords) return
    setPreferences(prefs)
    doGenerateRoute(userCoords, prefs, getHistoryPoiIds())
  }, [userCoords, doGenerateRoute])

  const handleRegenerate = useCallback(() => {
    if (!userCoords) return
    doGenerateRoute(userCoords, preferences, getHistoryPoiIds())
  }, [userCoords, preferences, doGenerateRoute])

  const handleBack = useCallback(() => {
    setPage('home')
    setRouteData(null)
    setPreferences(null)
  }, [])

  // ==================== 渲染 ====================
  return (
    <div className="relative h-full w-full max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto overflow-hidden">
      <div className="hidden md:block absolute inset-y-0 -left-32 w-32 bg-gradient-to-r from-indigo-400/[0.03] to-transparent pointer-events-none" />
      <div className="hidden md:block absolute inset-y-0 -right-32 w-32 bg-gradient-to-l from-violet-400/[0.03] to-transparent pointer-events-none" />
      <div className="ambient-bg" />
      <div className="ambient-bg-orb" style={{ left: "55%", top: "30%", background: "radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.18), rgba(139, 92, 246, 0.06) 35%, transparent 70%)" }} />

      <div className="relative z-10 h-full">
        {(page === 'home' || page === 'loading') && (
          <HomePage onStartRoam={handleStartRoam} isLoading={page === 'loading'} locationInfo={locationInfo} userCoords={userCoords} onCitySearch={handleCitySearch} />
        )}
        {page === 'route' && routeData && (
          <RouteCard routeData={routeData} preferences={preferences} onBack={handleBack} onRegenerate={handleRegenerate} />
        )}
      </div>
    </div>
  )
}
