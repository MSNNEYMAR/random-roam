import { useState, useEffect, useMemo, memo, useCallback } from 'react'
import {
  ArrowLeft,
  MapPin,
  Clock,
  Route,
  Footprints,
  Coffee,
  TreePine,
  Building2,
  CookingPot,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Info,
  Image,
  Car,
  Bike,
  TrainFront,
  Zap,
  CalendarDays,
  Heart,
  Eye,
  Wallet,
  MoveRight,
} from 'lucide-react'
import CityNavigation from './illustrations/CityNavigation'

// ==================== 类别元数据 ====================
const categoryMeta = {
  culture: {
    icon: Building2,
    color: '#eab308',
    bg: 'rgba(234, 179, 8, 0.12)',
    border: 'rgba(234, 179, 8, 0.35)',
    label: '文化 / 艺术',
  },
  cafe: {
    icon: Coffee,
    color: '#f43f5e',
    bg: 'rgba(244, 63, 94, 0.12)',
    border: 'rgba(244, 63, 94, 0.35)',
    label: '咖啡 / 小店',
  },
  park: {
    icon: TreePine,
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.35)',
    label: '公园 / 散步',
  },
  food: {
    icon: CookingPot,
    color: '#f97316',
    bg: 'rgba(249, 115, 22, 0.12)',
    border: 'rgba(249, 115, 22, 0.35)',
    label: '美食 / 餐厅',
  },
}

const TRANSPORT_META = {
  walk:   { icon: Footprints, label: '步行', statLabel: '步行距离', betweenLabel: '步行约 ' },
  cycle:  { icon: Bike,       label: '骑行', statLabel: '骑行距离', betweenLabel: '骑行约 ' },
  subway: { icon: TrainFront, label: '地铁', statLabel: '总距离',   betweenLabel: '搭乘地铁约 ' },
  drive:  { icon: Car,        label: '打车', statLabel: '总距离',   betweenLabel: '打车约 ' },
}

const STYLE_META = {
  relax:    { icon: Coffee,    label: '摸鱼模式', colorCode: '#10b981', bgCode: 'rgba(16,185,129,0.1)' },
  artsy:    { icon: Eye,       label: '文艺出片', colorCode: '#8b5cf6', bgCode: 'rgba(139,92,246,0.1)' },
  commando: { icon: Zap,       label: '特种兵',   colorCode: '#f97316', bgCode: 'rgba(249,115,22,0.1)' },
  couple:   { icon: Heart,     label: '情侣模式', colorCode: '#ec4899', bgCode: 'rgba(236,72,153,0.1)' },
  quiet:    { icon: Eye,       label: '社恐模式', colorCode: '#0ea5e9', bgCode: 'rgba(14,165,233,0.1)' },
  budget:   { icon: Wallet,    label: '穷游模式', colorCode: '#eab308', bgCode: 'rgba(234,179,8,0.1)' },
}

// ==================== 单张地点卡片 ====================
const StepCard = memo(function StepCard({ idx, step, meta, isExpanded, isLast, photoUrl, hasPhoto, loadedPhotos, setLoadedPhotos, setExpandedIndex }) {
  const Icon = meta.icon
  const staggerClass = `stagger-${Math.min(idx + 1, 6)}`

  return (
    <div className={`relative pl-10 md:pl-12 ${isLast ? '' : 'pb-2'} animate-stagger-up ${staggerClass}`}>
      {/* --- 时间线徽章 — Lucide Icon --- */}
      <div
        className="timeline-badge"
        style={{
          background: meta.bg,
          borderColor: meta.border,
          boxShadow: `0 0 12px ${meta.border}`,
        }}
      >
        <Icon size={10} style={{ color: meta.color }} />
      </div>

      {/* --- 毛玻璃卡片 --- */}
      <div
        onClick={setExpandedIndex}
        className={`
          glass-card rounded-2xl overflow-hidden cursor-pointer
          transition-all duration-300 hover:bg-white/[0.06] hover:border-white/[0.12]
          ${isExpanded ? 'bg-white/[0.06] border-white/[0.12]' : ''}
        `}
      >
        {/* 实景照片 */}
        {hasPhoto && (
          <div className="relative w-full h-40 md:h-52 overflow-hidden border-b border-white/[0.06]">
            {loadedPhotos[photoUrl] !== true && (
              <div className="absolute inset-0 bg-white/[0.03] flex items-center justify-center">
                <Image size={24} className="text-white/15 animate-pulse md:!w-7 md:!h-7" />
              </div>
            )}
            <img
              src={photoUrl}
              alt={step.name}
              className={`w-full h-full object-cover transition-all duration-700 ${loadedPhotos[photoUrl] === true ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}
              onLoad={() => setLoadedPhotos(prev => ({ ...prev, [photoUrl]: true }))}
              onError={() => setLoadedPhotos(prev => ({ ...prev, [photoUrl]: 'error' }))}
              loading="lazy"
            />
            <div
              className="absolute inset-x-0 bottom-0 h-24 pointer-events-none"
              style={{
                background: `linear-gradient(to top, ${meta.bg.replace('0.12', '0.5')}, transparent)`,
              }}
            />
          </div>
        )}

        {/* 卡片内容 */}
        <div className="p-4 md:p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {/* 类别图标块 */}
              <div
                className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: meta.bg }}
              >
                <Icon size={17} style={{ color: meta.color }} />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white/15 text-xs font-mono">#{idx + 1}</span>
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: meta.bg, color: meta.color }}
                  >
                    {meta.label}
                  </span>
                  {step.rating && (
                    <span className="text-[10px] text-white/30 font-medium">
                      ⭐ {step.rating}
                    </span>
                  )}
                  {step.cost != null && step.cost > 0 && (
                    <span className="text-[10px] text-white/25">¥{step.cost}</span>
                  )}
                  {step.cost === 0 && (
                    <span className="text-[10px] text-emerald-400/70 font-medium">免费</span>
                  )}
                </div>
                <h3 className="text-white text-base md:text-lg font-extrabold mt-1 truncate tracking-tight">
                  {step.name}
                </h3>
                {step.address && (
                  <p className="text-slate-500 text-[11px] mt-0.5 truncate font-normal">{step.address}</p>
                )}
              </div>
            </div>

            <ChevronRight
              size={16}
              className={`
                text-white/25 mt-2 shrink-0 transition-transform duration-300
                ${isExpanded ? 'rotate-90' : ''}
              `}
            />
          </div>

          {/* 距离与停留 */}
          <div className="flex items-center gap-3 mt-3 ml-[46px] md:ml-[52px]">
            <div className="flex items-center gap-1 text-slate-400 text-xs font-normal">
              <MapPin size={11} />
              <span>{step.walkingFromPrev}</span>
            </div>
            <div className="flex items-center gap-1 text-slate-400 text-xs font-normal">
              <Clock size={11} />
              <span>建议停留 {step.stayMinutes} 分钟</span>
            </div>
          </div>
        </div>

        {/* 展开区域 */}
        <div className={`
          overflow-hidden transition-all duration-300
          ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}
        `}>
          <div className="px-4 md:px-5 pb-4 md:pb-5 ml-[46px] md:ml-[52px] border-t border-white/[0.04] pt-3">
            <p className="text-slate-400 text-sm leading-relaxed font-normal">{step.description}</p>
            <div
              className="flex items-start gap-2 mt-3 rounded-xl p-3"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <Info size={13} className="text-amber-400/40 mt-0.5 shrink-0" />
              <p className="text-slate-500 text-xs leading-relaxed font-normal">{step.tip}</p>
            </div>
            {step.photos && step.photos.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                {step.photos.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`${step.name} ${i + 1}`}
                    className="w-20 h-14 md:w-28 md:h-18 rounded-lg object-cover shrink-0 opacity-50 hover:opacity-90 transition-all duration-300 border border-white/[0.04]"
                    loading="lazy"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- 步骤间运输指示器 --- */}
      {!isLast && (
        <div className="relative flex items-center justify-center my-1 ml-10 md:ml-12">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.05] backdrop-blur-md">
            <MoveRight size={10} className="text-white/20" />
            <span className="text-white/15 text-[10px]">
              {step.walkingFromPrev?.replace(/\s*\(.*/, '') || '下一站'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
})
StepCard.displayName = 'StepCard'

// ==================== 路线展示主组件 ====================
const RouteCard = memo(function RouteCard({ routeData, preferences, onBack, onRegenerate, weather }) {
  const [expandedIndex, setExpandedIndex] = useState(null)
  const [isVisible, setIsVisible] = useState(false)
  const [loadedPhotos, setLoadedPhotos] = useState({})

  const { orderedRoute, summary } = routeData
  const transportMeta = TRANSPORT_META[preferences?.transport] || TRANSPORT_META.walk
  const styleMeta = STYLE_META[preferences?.style] || null
  const TransportIcon = transportMeta.icon
  const StyleIcon = styleMeta?.icon

  // "大数字、小单位" — useMemo 避免每次渲染重算
  const distVal = useMemo(() => summary.totalWalkingDist >= 1000
    ? { value: (summary.totalWalkingDist / 1000).toFixed(1), unit: 'km' }
    : { value: String(summary.totalWalkingDist), unit: 'm' },
    [summary.totalWalkingDist])

  const timeVal = useMemo(() => summary.totalTime < 60
    ? { value: String(summary.totalTime), unit: '分钟' }
    : { value: String(Math.floor(summary.totalTime / 60)), unit: `${summary.totalTime % 60 > 0 ? 'h ' + (summary.totalTime % 60) + 'm' : '小时'}` },
    [summary.totalTime])

  useEffect(() => {
    const t = requestAnimationFrame(() => setIsVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const handleBack = useCallback(() => {
    setIsVisible(false)
    setTimeout(onBack, 350)
  }, [onBack])

  const formatTotalTime = useCallback((mins) => {
    if (mins < 60) return `${mins} 分钟`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`
  }, [])

  return (
    <div
      className={`
        absolute inset-0 z-20 flex flex-col
        transition-all duration-500 ease-out
        ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}
      `}
    >
      {/* ==================== 顶部导航栏 ==================== */}
      <header className="flex items-center justify-between px-5 md:px-8 py-4 z-10">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors duration-300"
        >
          <ArrowLeft size={19} />
          <span className="text-sm tracking-wider">返回</span>
        </button>

        <div className="flex items-center gap-2 text-white/30">
          <Sparkles size={13} className="text-amber-400/50" />
          <span className="text-xs tracking-[0.2em] font-light">今日漫游</span>
        </div>

        <button
          onClick={onRegenerate}
          className="group flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors duration-300"
        >
          <RefreshCw size={17} className="group-hover:rotate-180 transition-transform duration-500" />
          <span className="text-sm tracking-wider">换一条</span>
        </button>
      </header>

      {/* ==================== 滚动内容区 ==================== */}
      <div className="flex-1 overflow-y-auto px-5 md:px-8 pb-10">
        {/* --- 概览卡片 (毛玻璃) --- */}
        <div className="glass-card-strong rounded-3xl p-5 md:p-7 mb-6 animate-stagger-up stagger-1">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-white/90 text-lg md:text-xl font-semibold tracking-[0.08em]">
                你的漫游路线
              </h2>
              <p className="text-slate-400 text-xs mt-1 tracking-wider font-normal">
                {summary.totalStops || 3} 个地点 · {transportMeta.label}出行
                {styleMeta && ` · ${styleMeta.label}`}
              </p>
            </div>
            <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center border border-white/[0.06]">
              <Route size={21} className="text-indigo-400/60" />
            </div>
          </div>

          {/* 标签 */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <span
              className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border border-white/[0.08] text-white/35"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <TransportIcon size={12} />
              {transportMeta.label}
            </span>
            {styleMeta && (
              <span
                className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border font-medium"
                style={{
                  background: styleMeta.bgCode,
                  borderColor: `${styleMeta.colorCode}30`,
                  color: styleMeta.colorCode,
                }}
              >
                <StyleIcon size={12} />
                {styleMeta.label}
              </span>
            )}
            {weather && (
              <span
                className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border font-medium backdrop-blur-sm
                  ${weather.score >= 4 ? 'text-emerald-400/80 border-emerald-400/20' : ''}
                  ${weather.score >= 2 && weather.score < 4 ? 'text-amber-400/80 border-amber-400/20' : ''}
                  ${weather.score < 2 ? 'text-rose-400/80 border-rose-400/20' : ''}
                `}
                style={{ background: 'rgba(255,255,255,0.03)' }}
                title={weather.tip}
              >
                <span className="text-xs">{weather.emoji}</span>
                {weather.label}
                <span className="text-white/25">{weather.temp}{weather.tempUnit}</span>
              </span>
            )}
          </div>

          {/* 天气提示 */}
          {weather && (
            <div
              className={`mt-3 px-3 py-2 rounded-xl text-xs flex items-center gap-2 backdrop-blur-sm
                ${weather.score >= 4 ? 'text-emerald-400/70 bg-emerald-400/[0.04] border border-emerald-400/[0.08]'
                  : weather.score >= 2 ? 'text-amber-400/70 bg-amber-400/[0.04] border border-amber-400/[0.08]'
                  : 'text-rose-400/70 bg-rose-400/[0.04] border border-rose-400/[0.08]'
                }`}
            >
              <span>{weather.emoji}</span>
              <span className="font-light">{weather.tip}</span>
            </div>
          )}

          {/* 三项统计 */}
          <div className="grid grid-cols-3 gap-3">
            <div
              className="rounded-2xl p-3 md:p-4 text-center border border-white/[0.04]"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <TransportIcon size={15} className="text-indigo-400/50 mx-auto mb-1.5" />
              <div className="text-2xl md:text-[1.75rem] font-extrabold text-white leading-none tracking-tight">
                {distVal.value}<span className="text-xs md:text-sm font-normal text-slate-400 ml-0.5 align-baseline">{distVal.unit}</span>
              </div>
              <div className="text-[10px] md:text-[11px] text-slate-500 font-normal mt-1 tracking-wider uppercase">{transportMeta.statLabel}</div>
            </div>
            <div
              className="rounded-2xl p-3 md:p-4 text-center border border-white/[0.04]"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <Clock size={15} className="text-sky-400/50 mx-auto mb-1.5" />
              <div className="text-2xl md:text-[1.75rem] font-extrabold text-white leading-none tracking-tight">
                {timeVal.value}<span className="text-xs md:text-sm font-normal text-slate-400 ml-0.5 align-baseline">{timeVal.unit}</span>
              </div>
              <div className="text-[10px] md:text-[11px] text-slate-500 font-normal mt-1 tracking-wider uppercase">预计总时长</div>
            </div>
            <div
              className="rounded-2xl p-3 md:p-4 text-center border border-white/[0.04]"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <MapPin size={15} className="text-rose-400/50 mx-auto mb-1.5" />
              <div className="text-2xl md:text-[1.75rem] font-extrabold text-white leading-none tracking-tight">
                {summary.totalStops || 3}<span className="text-xs md:text-sm font-normal text-slate-400 ml-0.5 align-baseline">站</span>
              </div>
              <div className="text-[10px] md:text-[11px] text-slate-500 font-normal mt-1 tracking-wider uppercase">途经地点</div>
            </div>
          </div>
        </div>

        {/* ==================== 时间线 (Timeline) ==================== */}
        {/* 多天模式 */}
        {routeData.days ? (
          routeData.days.map((day, di) => (
            <div key={di} className="mb-6">
              <div className="flex items-center gap-2 mb-4 px-1 animate-stagger-up stagger-1">
                <CalendarDays size={15} className="text-indigo-400/50" />
                <span className="text-white/50 text-sm font-semibold tracking-wider">{day.label}</span>
                <span className="text-slate-500 text-xs font-normal">
                  {day.summary.totalStops} 个地点 · {formatTotalTime(day.summary.totalTime)}
                </span>
              </div>

              <div className="relative">
                {/* 垂直虚线连接器 */}
                <div className="timeline-connector" />

                {day.summary.routeSummary.map((step, idx) => {
                  const meta = categoryMeta[step.category] || categoryMeta.culture
                  const isExpanded = expandedIndex === `${di}-${idx}`
                  const isLast = idx === day.summary.routeSummary.length - 1
                  const photoUrl = step.photoUrl
                  const hasPhoto = !!photoUrl
                  const combinedIdx = idx // stagger per day

                  return (
                    <div key={`${di}-${idx}`} className="relative">
                      <StepCard
                        idx={combinedIdx}
                        step={step}
                        meta={meta}
                        isExpanded={isExpanded}
                        isLast={isLast}
                        photoUrl={photoUrl}
                        hasPhoto={hasPhoto}
                        loadedPhotos={loadedPhotos}
                        setLoadedPhotos={setLoadedPhotos}
                        setExpandedIndex={() => setExpandedIndex(isExpanded ? null : `${di}-${idx}`)}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        ) : (
          /* 单天模式 */
          <div className="relative">
            <div className="timeline-connector" />

            {summary.routeSummary.map((step, idx) => {
              const meta = categoryMeta[step.category] || categoryMeta.culture
              const isExpanded = expandedIndex === idx
              const isLast = idx === summary.routeSummary.length - 1
              const photoUrl = step.photoUrl
              const hasPhoto = !!photoUrl

              return (
                <StepCard
                  key={idx}
                  idx={idx}
                  step={step}
                  meta={meta}
                  isExpanded={isExpanded}
                  isLast={isLast}
                  photoUrl={photoUrl}
                  hasPhoto={hasPhoto}
                  loadedPhotos={loadedPhotos}
                  setLoadedPhotos={setLoadedPhotos}
                  setExpandedIndex={() => setExpandedIndex(isExpanded ? null : idx)}
                />
              )
            })}
          </div>
        )}

        {/* --- 底部 --- */}
        <div className="text-center mt-10 mb-4 animate-stagger-up stagger-4">
          <div className="inline-flex items-center gap-3 text-white/10 text-xs tracking-wider">
            <Sparkles size={12} className="text-indigo-400/25" />
            <span>Enjoy your roam · 享受漫无目的的快乐</span>
            <Sparkles size={12} className="text-indigo-400/25" />
          </div>
        </div>
      </div>
    </div>
  )
})
RouteCard.displayName = 'RouteCard'

export default RouteCard
