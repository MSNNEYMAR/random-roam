import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import HomePage from './components/HomePage'
import { generateRoute, computeSummary, TRANSPORT_CONFIG } from './utils/routeGenerator'
import { fetchLandmarksByPosition, addToHistory, getHistoryPoiIds } from './api/placesApi'
import { reverseGeocode, fetchWalkingRoute, geocodeCity } from './api/amapAdapter'
import { saveRoute, loadSavedRoute, addToRouteHistory, loadRouteHistory } from './utils/storage'
import { fetchCurrentWeather } from './api/weatherApi'
import LocationSearch from './components/illustrations/LocationSearch'

// 懒加载 — RouteCard 仅在查看路线时渲染，不在首屏 bundle 中
const RouteCard = lazy(() => import('./components/RouteCard'))

/** 错误页 — 路线生成失败时显示，包含返回首页 + 重试按钮 */
function ErrorPage({ message, onBack, onRetry }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 select-none">
      <LocationSearch size={220} className="opacity-70 mb-6" />
      <h2 className="text-white/60 text-lg font-semibold tracking-wider mb-2">暂时无法生成路线</h2>
      <p className="text-slate-400 text-sm text-center max-w-xs leading-relaxed mb-6 whitespace-pre-line">
        {message}
      </p>
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-full border border-white/[0.08] text-white/40 text-sm font-medium
                     hover:text-white/60 hover:border-white/[0.14] active:scale-95 transition-all duration-300"
        >
          返回首页
        </button>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-8 py-2.5 rounded-full bg-indigo-400/10 border border-indigo-400/20 text-indigo-300/80 text-sm font-medium
                       hover:bg-indigo-400/15 active:scale-95 transition-all duration-300"
          >
            再试一次
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * 应用主组件 — 全国通用，基于用户实时位置 + 出行方式动态搜索半径
 *
 * 路线持久化：
 *  - 每次生成路线后自动保存到 localStorage
 *  - 首页可恢复上次路线
 *  - URL hash #continue 自动恢复
 */
export default function App() {
  const [page, setPage] = useState('home')
  const [userCoords, setUserCoords] = useState(null)
  const [locationInfo, setLocationInfo] = useState('正在获取位置...')
  const [routeData, setRouteData] = useState(null)
  const [preferences, setPreferences] = useState(null)
  const [weather, setWeather] = useState(null)
  const [hasSavedRoute, setHasSavedRoute] = useState(false)
  const [routeHistory, setRouteHistory] = useState([])
  // 保存最后一次使用的 prefs 用于重试
  const lastPrefsRef = useRef(null)
  const lastCoordsRef = useRef(null)

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
        lastCoordsRef.current = coords

        try {
          const address = await reverseGeocode(coords.lat, coords.lng)
          setLocationInfo(address || `${coords.lat.toFixed(2)}°, ${coords.lng.toFixed(2)}°`)
        } catch {
          setLocationInfo(`${coords.lat.toFixed(2)}°, ${coords.lng.toFixed(2)}°`)
        }

        // 非阻塞获取天气
        fetchCurrentWeather(coords.lat, coords.lng).then(setWeather).catch(() => {})
      },
      () => {
        setLocationInfo('定位失败 · 请在设置中允许定位权限')
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    )
  }, [])

  // ==================== 检查保存的路线 + URL hash + 历史 ====================
  useEffect(() => {
    // 加载历史列表
    setRouteHistory(loadRouteHistory())

    const saved = loadSavedRoute()
    if (saved) {
      setHasSavedRoute(true)

      // URL hash 为 #continue 时自动恢复
      if (window.location.hash === '#continue') {
        // 清除 hash（避免刷新后再次自动恢复）
        window.history.replaceState(null, '', window.location.pathname)

        // 恢复保存的坐标和位置
        if (saved.userCoords) {
          setUserCoords(saved.userCoords)
          lastCoordsRef.current = saved.userCoords
        }
        if (saved.locationInfo) {
          setLocationInfo(saved.locationInfo)
        }

        if (saved.preferences) {
          setPreferences(saved.preferences)
          lastPrefsRef.current = saved.preferences
        }

        setRouteData({
          orderedRoute: saved.orderedRoute,
          summary: saved.summary,
          days: saved.days,
        })
        setPage('route')
      }
    }
  }, [])

  // ==================== 步行 API 丰富 ====================
  const enrichWithWalking = async (orderedRoute, userLat, userLng) => {
    const legs = []
    if (orderedRoute.length > 0) legs.push({ fromLat: userLat, fromLng: userLng, toIdx: 0 })
    for (let i = 1; i < orderedRoute.length; i++) legs.push({ fromIdx: i - 1, toIdx: i })

    const results = await Promise.all(legs.map(async (leg) => {
      const fromLat = leg.fromLat ?? (orderedRoute[leg.fromIdx].landmark || orderedRoute[leg.fromIdx]).lat
      const fromLng = leg.fromLng ?? (orderedRoute[leg.fromIdx].landmark || orderedRoute[leg.fromIdx]).lng
      const to = orderedRoute[leg.toIdx].landmark || orderedRoute[leg.toIdx]
      const walking = await fetchWalkingRoute(fromLat, fromLng, to.lat, to.lng)
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
    lastPrefsRef.current = prefs
    lastCoordsRef.current = coords

    try {
      // 根据出行方式动态决定 API 搜索半径
      const transport = prefs?.transport || 'walk'
      const tConfig = TRANSPORT_CONFIG[transport] || TRANSPORT_CONFIG.walk
      const landmarks = await fetchLandmarksByPosition(coords.lat, coords.lng, tConfig.searchRadius)
      const result = generateRoute(coords.lat, coords.lng, landmarks, prefs, excludeIds)

      if (!result.success) {
        setPage('error')
        setRouteData({ error: result.error || '生成路线失败，请再试一次' })
        return
      }

      // 仅步行模式下用真实步行 API 丰富路径（骑行/打车用 haversine + 速度系数）
      const isWalkMode = prefs?.transport === 'walk'
      if (isWalkMode) {
        result.orderedRoute = await enrichWithWalking(result.orderedRoute, coords.lat, coords.lng)
        result.summary = computeSummary(result.orderedRoute, prefs)

        // 多天路线：每天也重算
        if (result.days) {
          for (const day of result.days) {
            day.orderedRoute = await enrichWithWalking(day.orderedRoute, coords.lat, coords.lng)
            day.summary = computeSummary(day.orderedRoute, prefs)
          }
        }
      }

      recordUsedIds(result.orderedRoute)

      const newRouteData = {
        orderedRoute: result.orderedRoute,
        summary: result.summary,
        days: result.days || null,
      }
      setRouteData(newRouteData)
      setPage('route')

      // 持久化保存
      saveRoute({
        orderedRoute: result.orderedRoute,
        summary: result.summary,
        days: result.days || null,
        preferences: prefs,
        userCoords: coords,
        locationInfo,
      })

      // 历史记录
      addToRouteHistory({
        summary: result.summary,
        preferences: prefs,
        userCoords: coords,
        locationInfo,
        transport: prefs?.transport || 'walk',
        style: prefs?.style || 'relax',
      })
      setRouteHistory(loadRouteHistory())
      setHasSavedRoute(true)

      // 写入 URL hash（轻量标记）
      window.history.replaceState(null, '', '#route')
    } catch (err) {
      console.error('路线生成异常:', err)
      setPage('error')
      setRouteData({ error: '出了点问题，请检查网络后重试\n\n' + (err?.message || err) })
    }
  }, [recordUsedIds, locationInfo])

  // ==================== 城市搜索降级 ====================
  const handleCitySearch = useCallback(async (cityName) => {
    const result = await geocodeCity(cityName)
    if (!result) {
      throw new Error(`找不到城市"${cityName}"，请换个名称试试`)
    }
    const coords = { lat: result.lat, lng: result.lng }
    setUserCoords(coords)
    lastCoordsRef.current = coords
    setLocationInfo(result.address || cityName)
  }, [])

  // ==================== 按钮回调 ====================
  const handleStartRoam = useCallback((prefs) => {
    if (!userCoords) return
    setPreferences(prefs)
    doGenerateRoute(userCoords, prefs, getHistoryPoiIds())
  }, [userCoords, doGenerateRoute])

  const handleRegenerate = useCallback(() => {
    const coords = userCoords || lastCoordsRef.current
    if (!coords) return
    doGenerateRoute(coords, preferences, getHistoryPoiIds())
  }, [userCoords, preferences, doGenerateRoute])

  const handleContinueRoute = useCallback(() => {
    const saved = loadSavedRoute()
    if (!saved) return

    if (saved.userCoords) {
      setUserCoords(saved.userCoords)
      lastCoordsRef.current = saved.userCoords
    }
    if (saved.locationInfo) {
      setLocationInfo(saved.locationInfo)
    }
    if (saved.preferences) {
      setPreferences(saved.preferences)
      lastPrefsRef.current = saved.preferences
    }

    setRouteData({
      orderedRoute: saved.orderedRoute,
      summary: saved.summary,
      days: saved.days,
    })
    setPage('route')

    window.history.replaceState(null, '', '#route')
  }, [])

  const handleBack = useCallback(() => {
    setPage('home')
    setRouteData(null)
    setPreferences(null)
    // 刷新历史列表
    setRouteHistory(loadRouteHistory())
    // 清除 URL hash
    if (window.location.hash === '#route') {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  // 从历史记录重新发起
  const handleLoadFromHistory = useCallback((historyEntry) => {
    const coords = historyEntry.userCoords
    if (!coords) return
    setUserCoords(coords)
    lastCoordsRef.current = coords
    setLocationInfo(historyEntry.locationInfo || '')
    const prefs = { transport: historyEntry.transport, style: historyEntry.style, time: historyEntry.preferences?.time || '2h' }
    setPreferences(prefs)
    doGenerateRoute(coords, prefs, getHistoryPoiIds())
  }, [doGenerateRoute])

  const handleRetry = useCallback(() => {
    const coords = userCoords || lastCoordsRef.current
    const prefs = preferences || lastPrefsRef.current
    if (coords && prefs) {
      doGenerateRoute(coords, prefs, getHistoryPoiIds())
    } else {
      setPage('home')
      setRouteData(null)
    }
  }, [userCoords, preferences, doGenerateRoute])

  // ==================== 渲染 ====================
  return (
    <div className="relative h-full w-full max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto overflow-hidden">
      <div className="hidden md:block absolute inset-y-0 -left-32 w-32 bg-gradient-to-r from-indigo-400/[0.03] to-transparent pointer-events-none" />
      <div className="hidden md:block absolute inset-y-0 -right-32 w-32 bg-gradient-to-l from-violet-400/[0.03] to-transparent pointer-events-none" />
      <div className="ambient-bg" />
      <div className="ambient-bg-orb" style={{ left: "55%", top: "30%", background: "radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.18), rgba(139, 92, 246, 0.06) 35%, transparent 70%)" }} />

      <div className="relative z-10 h-full">
        {(page === 'home' || page === 'loading') && (
          <HomePage
            onStartRoam={handleStartRoam}
            isLoading={page === 'loading'}
            locationInfo={locationInfo}
            userCoords={userCoords}
            onCitySearch={handleCitySearch}
            hasSavedRoute={hasSavedRoute}
            onContinueRoute={handleContinueRoute}
            weather={weather}
            routeHistory={routeHistory}
            onLoadFromHistory={handleLoadFromHistory}
          />
        )}
        {page === 'error' && routeData?.error && (
          <ErrorPage message={routeData.error} onBack={handleBack} onRetry={handleRetry} />
        )}
        {page === 'route' && routeData && !routeData.error && (
          <Suspense fallback={
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-indigo-400/20 border-t-indigo-400/60 rounded-full animate-spin" />
            </div>
          }>
            <RouteCard routeData={routeData} preferences={preferences} onBack={handleBack} onRegenerate={handleRegenerate} weather={weather} />
          </Suspense>
        )}
      </div>
    </div>
  )
}
