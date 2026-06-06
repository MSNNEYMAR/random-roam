import { useState, useEffect, useRef } from 'react'
import {
  MapPin,
  Navigation,
  Compass,
  Loader2,
  Sparkles,
  Footprints,
} from 'lucide-react'
import PreferenceSelector from './PreferenceSelector'

/**
 * 首页 — 极简设计，中心"开始漫游"按钮 + 动态氛围背景
 *
 * 状态机: idle → preferences → loading → (App 切换到 route)
 * 响应式: 移动端 (default) → 平板 (md:) → 桌面 (lg:)
 */
export default function HomePage({ onStartRoam, isLoading, locationInfo }) {
  const [particles, setParticles] = useState([])
  const [displayText, setDisplayText] = useState('')
  const [phase, setPhase] = useState('idle')
  const fullTitle = '漫无目的'
  const btnRef = useRef(null)

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

  const handleStartClick = () => setPhase('preferences')
  const handlePreferencesConfirm = (preferences) => onStartRoam(preferences)
  const handleBackFromPreferences = () => setPhase('idle')

  // ==================== 偏好选择阶段 ====================
  if (phase === 'preferences') {
    return (
      <div className="relative h-full w-full">
        <PreferenceSelector
          onConfirm={handlePreferencesConfirm}
          onBack={handleBackFromPreferences}
        />
      </div>
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

        <div className="flex flex-col items-center gap-6 md:gap-8 animate-fade-in">
          <div className="relative">
            <div className="absolute inset-0 bg-amber-400/20 rounded-full blur-3xl animate-breathe" />
            <Compass
              size={80}
              className="text-amber-300/60 relative z-10 animate-[spin_8s_linear_infinite] md:!w-24 md:!h-24"
              strokeWidth={1}
            />
          </div>
          <div className="flex items-center gap-3">
            <Loader2 size={28} className="text-amber-400 animate-spin md:!w-8 md:!h-8" />
            <span className="text-white/50 text-lg md:text-xl tracking-wider">正在生成路线</span>
          </div>
          <p className="text-white/20 text-xs md:text-sm tracking-wider">根据你的偏好定制中...</p>
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
      <div className="absolute top-10 flex items-center gap-2 text-white/40 text-sm md:text-base animate-fade-in">
        <MapPin size={16} className="md:!w-5 md:!h-5" />
        <span>{locationInfo || '正在获取位置...'}</span>
      </div>

      {/* --- 主视觉区域 --- */}
      <div className="flex flex-col items-center gap-8 md:gap-10 animate-fade-in">
        {/* 图标 */}
        <div className="relative">
          <div className="absolute inset-0 bg-amber-400/20 rounded-full blur-3xl animate-breathe" />
          <Compass
            size={72}
            className="text-amber-300/80 relative z-10 md:!w-24 md:!h-24"
            strokeWidth={1}
          />
        </div>

        {/* 标题 */}
        <h1 className="text-5xl md:text-7xl font-display font-bold tracking-widest text-white/90">
          {displayText}
          <span className="inline-block w-[2px] h-10 md:h-14 bg-amber-400/60 ml-1 align-middle animate-pulse" />
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
            transition-all duration-500
            bg-white/[0.03] hover:bg-white/[0.06] active:scale-95
            border border-white/[0.06] hover:border-white/[0.12]
          `}
        >
          <div className="absolute inset-0 rounded-full border border-amber-400/10 animate-ping [animation-duration:3s]" />
          <div className="absolute -inset-3 rounded-full border border-amber-400/5 animate-ping [animation-duration:3s] [animation-delay:0.5s]" />

          <Footprints size={28} className="text-amber-300/70 group-hover:text-amber-300 transition-colors duration-500 md:!w-8 md:!h-8" />
          <span className="text-white/70 text-lg md:text-xl font-medium tracking-widest mt-1 group-hover:text-white/90 transition-colors duration-500">
            开始漫游
          </span>
          <Sparkles size={12} className="text-amber-400/40 absolute top-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <Navigation size={12} className="text-amber-400/40 absolute bottom-8 left-8 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </button>

        {/* 底部提示 */}
        <p className="text-white/15 text-[11px] md:text-xs tracking-wider">
          基于你的位置 · 随机生成 · 即刻出发
        </p>
      </div>

      {/* --- 底部安全区 --- */}
      <div className="absolute bottom-8 text-white/10 text-[10px] md:text-xs">
        RandomRoam v0.2
      </div>
    </div>
  )
}
