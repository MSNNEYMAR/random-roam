import { useState, useEffect, useRef, memo, lazy, Suspense } from 'react'
import {
  MapPin,
  Navigation,
  Compass,
  Loader2,
  Sparkles,
  Footprints,
  Search,
  AlertTriangle,
  History,
} from 'lucide-react'
import WalkingExplore from './illustrations/WalkingExplore'

// 懒加载 PreferenceSelector — 仅在用户点击"开始漫游"后加载
const PreferenceSelector = lazy(() => import('./PreferenceSelector'))

/**
 * 首页 — 极简设计，中心"开始漫游"按钮 + 动态氛围背景
 *
 * 状态机: idle → preferences → loading → (App 切换到 route)
 *          idle → citySearch (定位被拒时的降级)
 * 响应式: 移动端 (default) → 平板 (md:) → 桌面 (lg:)
 */
const HomePage = memo(function HomePage({ onStartRoam, isLoading, locationInfo, userCoords, onCitySearch, hasSavedRoute, onContinueRoute, weather, routeHistory, onLoadFromHistory }) {
  const [particles, setParticles] = useState([])
  const [displayText, setDisplayText] = useState('')
  const [phase, setPhase] = useState('idle')
  const [cityInput, setCityInput] = useState('')
  const [cityError, setCityError] = useState('')
  const fullTitle = '漫无目的'
  const btnRef = useRef(null)

  // 定位是否被拒绝 (10秒内没拿到 coords 且无正在获取中的状态)
  const locationDenied = !userCoords && locationInfo && locationInfo.includes('定位失败')

  useEffect(() => {
    const arr = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      size: Math.random() * 4 + 2,
      left: Math.random() * 100,
      delay: Math.random() * 20,
      duration: Math.random() * 15 + 15,
    }))
    setParticles(arr)
  }, [])

  useEffect(() => {
    if (displayText.length < fullTitle.length) {
      const timer = setTimeout(() => {
        setDisplayText(fullTitle.slice(0, displayText.length + 1))
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [displayText])

  useEffect(() => {
    if (isLoading) setPhase('loading')
  }, [isLoading])

  const handleStartClick = () => {
    if (locationDenied) {
      // 定位被拒，提示用户输入城市
      setPhase('citySearch')
      return
    }
    setPhase('preferences')
  }

  const handleCitySubmit = async (e) => {
    e?.preventDefault()
    const trimmed = cityInput.trim()
    if (!trimmed) {
      setCityError('请输入城市名')
      return
    }
    setCityError('')
    try {
      await onCitySearch(trimmed)
    } catch (err) {
      setCityError(err?.message || '搜索失败，请换个城市名试试')
    }
  }

  const handlePreferencesConfirm = (preferences) => onStartRoam(preferences)
  const handleBackFromPreferences = () => setPhase('idle')
  const handleBackFromCitySearch = () => setPhase('idle')

  // ==================== 城市搜索阶段 ====================
  if (phase === 'citySearch') {
    return (
      <div className="relative h-full flex flex-col items-center justify-center px-6 select-none">
        {particles.map((p) => (
          <div
            key={p.id}
            className="particle"
            style={{
              width: p.size, height: p.size, left: `${p.left}%`,
              bottom: '-20px', animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`,
            }}
          />
        ))}

        <div className="flex flex-col items-center gap-6 md:gap-8 animate-fade-in w-full max-w-sm">
          {/* 图标 */}
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-400/20 rounded-full blur-3xl animate-breathe" />
            <Search size={48} className="text-indigo-300/60 relative z-10 md:!w-14 md:!h-14" strokeWidth={1} />
          </div>

          <div className="text-center">
            <h2 className="text-white/70 text-lg md:text-xl font-medium tracking-wider mb-2">
              手动输入城市
            </h2>
            <p className="text-white/30 text-xs md:text-sm tracking-wider">
              定位权限被拒绝后，你可以输入城市名来搜索
            </p>
          </div>

          <form onSubmit={handleCitySubmit} className="w-full flex flex-col gap-3">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none"
              />
              <input
                type="text"
                value={cityInput}
                onChange={(e) => { setCityInput(e.target.value); setCityError('') }}
                placeholder="例如：广州、成都、南京、杭州…"
                autoFocus
                className="
                  w-full pl-10 pr-4 py-3 rounded-xl
                  bg-white/[0.04] border border-white/[0.08]
                  text-white/80 text-sm md:text-base
                  placeholder:text-white/15
                  focus:outline-none focus:border-indigo-400/30 focus:bg-white/[0.06]
                  transition-all duration-300
                "
              />
            </div>

            {cityError && (
              <div className="flex items-center gap-2 text-rose-400/80 text-xs">
                <AlertTriangle size={14} />
                <span>{cityError}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleBackFromCitySearch}
                className="
                  flex-1 py-2.5 rounded-xl text-white/30 text-sm
                  border border-white/[0.06] hover:text-white/50
                  transition-all duration-300
                "
              >
                返回
              </button>
              <button
                type="submit"
                className="
                  flex-1 py-2.5 rounded-xl
                  bg-indigo-400/10 border border-indigo-400/20
                  text-indigo-300/80 text-sm font-medium
                  hover:bg-indigo-400/15 hover:text-indigo-300
                  active:scale-[0.98] transition-all duration-300
                "
              >
                搜索
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ==================== 偏好选择阶段 ====================
  if (phase === 'preferences') {
    return (
      <Suspense fallback={
        <div className="relative h-full flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-indigo-400/20 border-t-indigo-400/60 rounded-full animate-spin" />
        </div>
      }>
        <div className="relative h-full w-full">
          <PreferenceSelector
            onConfirm={handlePreferencesConfirm}
            onBack={handleBackFromPreferences}
          />
        </div>
      </Suspense>
    )
  }

  // ==================== 加载阶段 ====================
  if (phase === 'loading') {
    return (
      <div className="relative h-full flex flex-col items-center justify-center px-6 select-none">
        {particles.map((p) => (
          <div
            key={p.id}
            className="particle"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.left}%`,
              bottom: '-20px',
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}

        <div className="flex flex-col items-center gap-5 md:gap-7 animate-fade-in">
          <WalkingExplore size={200} className="opacity-80 md:scale-110" />
          <div className="flex items-center gap-3 -mt-4">
            <Loader2 size={22} className="text-indigo-400 animate-spin" />
            <span className="text-white/45 text-base md:text-lg tracking-wider">正在生成路线</span>
          </div>
          <p className="text-white/18 text-xs md:text-sm tracking-wider -mt-2">根据你的偏好定制中...</p>
        </div>
      </div>
    )
  }

  // ==================== 初始阶段 ====================
  return (
    <div className="relative h-full flex flex-col items-center justify-center px-6 select-none">
      {/* --- 浮动粒子 --- */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.left}%`,
            bottom: '-20px',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}

      {/* --- 顶部城市信息 --- */}
      <div className="absolute top-4 md:top-6 left-0 right-0 flex items-center justify-center gap-2 text-white/40 text-xs md:text-sm animate-fade-in px-12">
        <MapPin size={14} className="md:!w-4 md:!h-4 shrink-0" />
        <span className="truncate max-w-[160px] md:max-w-[260px]">{locationInfo || '正在获取位置...'}</span>

        {/* 天气信息 */}
        {weather && (
          <span
            className={`shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] md:text-xs border backdrop-blur-sm
              ${weather.score >= 4 ? 'text-emerald-400/70 border-emerald-400/20 bg-emerald-400/5'
                : weather.score >= 2 ? 'text-amber-400/70 border-amber-400/20 bg-amber-400/5'
                : 'text-rose-400/70 border-rose-400/20 bg-rose-400/5'
              }`}
            title={weather.tip}
          >
            <span className="leading-none">{weather.emoji}</span>
            <span>{weather.temp}{weather.tempUnit}</span>
          </span>
        )}

        {locationDenied && (
          <button
            onClick={() => setPhase('citySearch')}
            className="ml-1 text-indigo-400/50 hover:text-indigo-400/80 text-xs underline underline-offset-2 transition-colors"
          >
            手动输入
          </button>
        )}
      </div>

      {/* --- 主视觉区域 --- */}
      <div className="flex flex-col items-center gap-8 md:gap-10 animate-fade-in">
        {/* 图标 */}
        <div className="relative">
          <div className="absolute inset-0 bg-indigo-400/20 rounded-full blur-3xl animate-breathe" />
          <Compass
            size={72}
            className="text-indigo-300/80 relative z-10 md:!w-24 md:!h-24"
            strokeWidth={1}
          />
        </div>

        {/* 标题 */}
        <h1 className="text-5xl md:text-7xl font-display font-bold tracking-widest text-white/90">
          {displayText}
          <span className="inline-block w-[2px] h-10 md:h-14 bg-indigo-400/60 ml-1 align-middle animate-pulse" />
        </h1>
        <p className="text-white/30 text-sm md:text-base -mt-4 tracking-wider font-light">
          RandomRoam
        </p>

        {/* 描述 */}
        <p className="text-white/25 text-xs md:text-sm tracking-widest max-w-[240px] md:max-w-[320px] text-center leading-relaxed">
          不知道去哪的时候
          <br />
          让城市为你做一次选择
        </p>

        {/* --- 主按钮 --- */}
        <button
          ref={btnRef}
          onClick={handleStartClick}
          className={`
            btn-glow group relative mt-4 md:mt-6
            flex flex-col items-center justify-center
            w-44 h-44 md:w-52 md:h-52 rounded-full
            transition-all duration-500 ease-out
            bg-white/[0.04] hover:bg-white/[0.08] active:scale-95
            border border-white/[0.08] hover:border-white/[0.14]
          `}
          style={{
            boxShadow: '0 0 30px rgba(139, 92, 246, 0.08), 0 0 80px rgba(99, 102, 241, 0.04)',
          }}
        >
          {/* 呼吸光晕环 */}
          <div
            className="absolute inset-[-2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"
            style={{
              background: 'conic-gradient(from 0deg, rgba(139,92,246,0.15), rgba(250,204,21,0.1), rgba(236,72,153,0.15), rgba(99,102,241,0.1), rgba(139,92,246,0.15))',
              filter: 'blur(8px)',
            }}
          />
          <div className="btn-breathe-ring absolute inset-0 rounded-full border border-indigo-400/10" />
          <div className="absolute inset-[-10px] rounded-full border border-indigo-400/5 animate-ping [animation-duration:3.5s]" />

          <Footprints
            size={28}
            className="text-indigo-300/80 group-hover:text-indigo-300 transition-all duration-500 group-hover:scale-110 md:!w-8 md:!h-8 relative z-10"
          />
          <span className="text-white/65 text-lg md:text-xl font-medium tracking-widest mt-1 group-hover:text-white/85 transition-colors duration-500 relative z-10">
            开始漫游
          </span>
          <Sparkles
            size={12}
            className="text-indigo-400/30 absolute top-8 right-8 opacity-0 group-hover:opacity-80 transition-all duration-500 group-hover:scale-125"
          />
          <Navigation
            size={12}
            className="text-indigo-400/30 absolute bottom-8 left-8 opacity-0 group-hover:opacity-80 transition-all duration-500 group-hover:scale-125"
          />
        </button>

        {/* 底部提示 */}
        <p className="text-white/15 text-[11px] md:text-xs tracking-wider">
          基于你的位置 · 随机生成 · 即刻出发
        </p>

        {/* 继续上次路线 */}
        {hasSavedRoute && onContinueRoute && (
          <button
            onClick={onContinueRoute}
            className="flex items-center gap-2 text-white/25 hover:text-indigo-400/60 text-xs tracking-wider transition-colors duration-300"
          >
            <History size={13} />
            <span>继续上次路线</span>
          </button>
        )}
      </div>

      {/* --- 历史记录 --- */}
      {routeHistory && routeHistory.length > 0 && onLoadFromHistory && (
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-3 max-h-[28vh] overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <History size={12} className="text-white/15" />
            <span className="text-white/15 text-[10px] tracking-wider">历史路线</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {routeHistory.map((entry, i) => {
              const date = new Date(entry.savedAt)
              const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
              return (
                <button
                  key={i}
                  onClick={() => onLoadFromHistory(entry)}
                  className="flex-shrink-0 w-[130px] p-2.5 rounded-xl glass-card hover:bg-white/[0.06] transition-all duration-300 text-left"
                >
                  <div className="flex items-center gap-1.5 text-white/35 text-[10px] mb-1.5">
                    <MapPin size={10} />
                    <span className="truncate">{entry.locationInfo || '未知地点'}</span>
                  </div>
                  <div className="flex items-center gap-1 text-white/50 text-xs font-medium mb-1">
                    <Footprints size={11} className="text-white/25" />
                    <span>{entry.summary.totalStops}站</span>
                    <span className="text-white/15">·</span>
                    <span>{entry.summary.totalTime}分钟</span>
                  </div>
                  <div className="text-white/15 text-[9px]">{dateStr}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* --- 底部安全区 --- */}
      <div className="absolute bottom-8 text-white/10 text-[10px] md:text-xs">
        RandomRoam v0.5
      </div>
    </div>
  )
})
HomePage.displayName = 'HomePage'

export default HomePage
