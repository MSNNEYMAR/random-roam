import { useState, useEffect } from 'react'
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
  Train,
  TrainFront,
  Zap,
  Heart,
  Eye,
  Wallet,
} from 'lucide-react'

// 类别元数据
const categoryMeta = {
  culture: {
    icon: Building2,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/20',
    label: '文化 / 艺术',
    gradient: 'from-amber-400/20 to-transparent',
    photoBorder: 'border-amber-400/20',
  },
  cafe: {
    icon: Coffee,
    color: 'text-rose-400',
    bg: 'bg-rose-400/10',
    border: 'border-rose-400/20',
    label: '咖啡 / 小店',
    gradient: 'from-rose-400/20 to-transparent',
    photoBorder: 'border-rose-400/20',
  },
  park: {
    icon: TreePine,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/20',
    label: '公园 / 散步',
    gradient: 'from-emerald-400/20 to-transparent',
    photoBorder: 'border-emerald-400/20',
  },
  food: {
    icon: CookingPot,
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
    border: 'border-orange-400/20',
    label: '美食 / 餐厅',
    gradient: 'from-orange-400/20 to-transparent',
    photoBorder: 'border-orange-400/20',
  },
}

const TRANSPORT_META = {
  walk:   { icon: Footprints, label: '步行', statLabel: '步行距离', betweenLabel: '步行前往下一站' },
  subway: { icon: TrainFront,  label: '地铁', statLabel: '总距离',   betweenLabel: '搭乘地铁前往下一站' },
  taxi:   { icon: Car,        label: '打车', statLabel: '总距离',   betweenLabel: '打车前往下一站' },
  train:  { icon: Train,      label: '高铁', statLabel: '总距离',   betweenLabel: '乘高铁前往下一站' },
}

const STYLE_META = {
  relax:    { icon: Coffee,    label: '摸鱼模式', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  artsy:    { icon: Eye,       label: '文艺出片', color: 'text-violet-400',  bg: 'bg-violet-400/10' },
  commando: { icon: Zap,       label: '特种兵',   color: 'text-orange-400',  bg: 'bg-orange-400/10' },
  couple:   { icon: Heart,     label: '情侣模式', color: 'text-pink-400',    bg: 'bg-pink-400/10' },
  quiet:    { icon: Eye,       label: '社恐模式', color: 'text-sky-400',     bg: 'bg-sky-400/10' },
  budget:   { icon: Wallet,    label: '穷游模式', color: 'text-amber-400',   bg: 'bg-amber-400/10' },
}

/**
 * 路线展示页 — 实景照片 + 真实步行数据 + 偏好展示 + 响应式
 */
export default function RouteCard({ routeData, preferences, onBack, onRegenerate }) {
  const [expandedIndex, setExpandedIndex] = useState(null)
  const [isVisible, setIsVisible] = useState(false)
  const [loadedPhotos, setLoadedPhotos] = useState({})

  const { orderedRoute, summary } = routeData
  const transportMeta = TRANSPORT_META[preferences?.transport] || TRANSPORT_META.walk
  const styleMeta = STYLE_META[preferences?.style] || null
  const TransportIcon = transportMeta.icon
  const StyleIcon = styleMeta?.icon

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true))
  }, [])

  const handleBack = () => {
    setIsVisible(false)
    setTimeout(onBack, 300)
  }

  const formatTotalTime = (mins) => {
    if (mins < 60) return `${mins} 分钟`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`
  }

  return (
    <div
      className={`
        absolute inset-0 z-20 flex flex-col
        transition-all duration-500 ease-out
        ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
      `}
    >
      {/* --- 顶部导航栏 --- */}
      <header className="flex items-center justify-between px-5 md:px-8 py-4 md:py-5 z-10">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-white/50 hover:text-white/80 transition-colors"
        >
          <ArrowLeft size={20} className="md:!w-6 md:!h-6" />
          <span className="text-sm md:text-base">返回</span>
        </button>

        <div className="flex items-center gap-2 text-white/40">
          <Sparkles size={14} className="text-amber-400/60 md:!w-4 md:!h-4" />
          <span className="text-xs md:text-sm tracking-wider">今日漫游</span>
        </div>

        <button
          onClick={onRegenerate}
          className="flex items-center gap-1.5 text-white/50 hover:text-white/80 transition-colors"
        >
          <RefreshCw size={16} className="md:!w-5 md:!h-5" />
          <span className="text-sm md:text-base">换一条</span>
        </button>
      </header>

      {/* --- 滚动内容区 --- */}
      <div className="flex-1 overflow-y-auto px-5 md:px-8 pb-8 md:pb-10">
        {/* 路线概览卡片 */}
        <div className="glass-card-strong rounded-3xl p-5 md:p-7 mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white/80 text-lg md:text-xl font-medium tracking-wide">
                你的漫游路线
              </h2>
              <p className="text-white/30 text-xs md:text-sm mt-1">
                {summary.totalStops || 3} 个地点 · {transportMeta.label}出行
                {styleMeta && ` · ${styleMeta.label}`}
              </p>
            </div>
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/5 flex items-center justify-center">
              <Route size={22} className="text-amber-400/60 md:!w-7 md:!h-7" />
            </div>
          </div>

          {/* 偏好标签 */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="flex items-center gap-1 text-[10px] md:text-xs px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/40">
              <TransportIcon size={12} />
              {transportMeta.label}
            </span>
            {styleMeta && (
              <span className={`flex items-center gap-1 text-[10px] md:text-xs px-2.5 py-1 rounded-full border ${styleMeta.bg} ${styleMeta.color}`}>
                <StyleIcon size={12} />
                {styleMeta.label}
              </span>
            )}
          </div>

          {/* 概览统计 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/[0.02] rounded-2xl p-3 md:p-4 text-center">
              <TransportIcon size={18} className="text-amber-400/60 mx-auto mb-1 md:!w-5 md:!h-5" />
              <div className="text-white/70 text-sm md:text-base font-medium">
                {summary.totalWalkingDist >= 1000
                  ? `${(summary.totalWalkingDist / 1000).toFixed(1)} km`
                  : `${summary.totalWalkingDist} m`}
              </div>
              <div className="text-white/25 text-[10px] md:text-xs">{transportMeta.statLabel}</div>
            </div>
            <div className="bg-white/[0.02] rounded-2xl p-3 md:p-4 text-center">
              <Clock size={18} className="text-sky-400/60 mx-auto mb-1 md:!w-5 md:!h-5" />
              <div className="text-white/70 text-sm md:text-base font-medium">
                {formatTotalTime(summary.totalTime)}
              </div>
              <div className="text-white/25 text-[10px] md:text-xs">预计总时长</div>
            </div>
            <div className="bg-white/[0.02] rounded-2xl p-3 md:p-4 text-center">
              <MapPin size={18} className="text-rose-400/60 mx-auto mb-1 md:!w-5 md:!h-5" />
              <div className="text-white/70 text-sm md:text-base font-medium">{summary.totalStops || 3}</div>
              <div className="text-white/25 text-[10px] md:text-xs">途经地点</div>
            </div>
          </div>
        </div>

        {/* 路线步骤 */}
        <div className="route-line relative">
          {summary.routeSummary.map((step, idx) => {
            const meta = categoryMeta[step.category]
            const Icon = meta?.icon || Building2
            const metaBg = meta?.bg || 'bg-white/5'
            const metaBorder = meta?.border || 'border-white/10'
            const metaGradient = meta?.gradient || 'from-white/10 to-transparent'
            const metaPhotoBorder = meta?.photoBorder || 'border-white/10'
            const metaColor = meta?.color || 'text-white/40'
            const metaLabel = meta?.label || '其他'
            const isExpanded = expandedIndex === idx
            const isLast = idx === summary.routeSummary.length - 1
            const photoUrl = step.photoUrl
            const hasPhoto = !!photoUrl

            return (
              <div
                key={idx}
                className={`relative pl-10 md:pl-12 ${isLast ? '' : 'mb-5 md:mb-6'} animate-fade-in`}
                style={{ animationDelay: `${0.2 + idx * 0.15}s` }}
              >
                {/* 连接线圆点 */}
                <div
                  className={`
                    absolute left-[7px] w-[18px] h-[18px] md:w-5 md:h-5 rounded-full border-2 z-10
                    ${metaBorder} ${metaBg}
                  `}
                  style={{ top: '4px' }}
                >
                  <div className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${metaColor.replace('text', 'bg')} m-auto mt-[2px] md:mt-[3px]`} />
                </div>

                {/* 地点卡片 */}
                <div
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                  className={`
                    glass-card rounded-2xl overflow-hidden cursor-pointer
                    transition-all duration-300
                    hover:bg-white/[0.06]
                    ${isExpanded ? 'bg-white/[0.06]' : ''}
                  `}
                >
                  {/* --- 实景照片 --- */}
                  {hasPhoto && (
                    <div className={`relative w-full h-40 md:h-52 overflow-hidden border-b ${metaPhotoBorder}`}>
                      {!loadedPhotos[photoUrl] && (
                        <div className="absolute inset-0 bg-white/[0.02] flex items-center justify-center">
                          <Image size={28} className="text-white/20 animate-pulse md:!w-8 md:!h-8" />
                        </div>
                      )}
                      <img
                        src={photoUrl}
                        alt={step.name}
                        className={`w-full h-full object-cover transition-opacity duration-500 ${
                          loadedPhotos[photoUrl] ? 'opacity-100' : 'opacity-0'
                        }`}
                        onLoad={() => setLoadedPhotos(prev => ({ ...prev, [photoUrl]: true }))}
                        onError={(e) => {
                          e.target.style.display = 'none'
                          setLoadedPhotos(prev => ({ ...prev, [photoUrl]: 'error' }))
                        }}
                      />
                      <div className={`absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t ${metaGradient}`} />
                    </div>
                  )}

                  {/* 卡片主体 */}
                  <div className="p-4 md:p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl ${metaBg} flex items-center justify-center shrink-0`}>
                          <Icon size={18} className={`${metaColor} md:!w-5 md:!h-5`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white/20 text-xs md:text-sm font-mono">
                              #{idx + 1}
                            </span>
                            <span className={`text-[10px] md:text-xs px-2 py-0.5 rounded-full ${metaBg} ${metaColor}`}>
                              {metaLabel}
                            </span>
                            {step.rating && (
                              <span className="text-[10px] md:text-xs text-white/30">
                                ⭐ {step.rating}
                              </span>
                            )}
                            {step.cost != null && step.cost > 0 && (
                              <span className="text-[10px] md:text-xs text-white/25">
                                ¥{step.cost}
                              </span>
                            )}
                            {step.cost === 0 && (
                              <span className="text-[10px] md:text-xs text-emerald-400/60">免费</span>
                            )}
                          </div>
                          <h3 className="text-white/85 text-base md:text-lg font-medium mt-1 truncate">
                            {step.name}
                          </h3>
                          {step.address && (
                            <p className="text-white/20 text-[11px] md:text-sm mt-0.5 truncate">
                              {step.address}
                            </p>
                          )}
                        </div>
                      </div>
                      <ChevronRight
                        size={16}
                        className={`text-white/30 mt-2 shrink-0 transition-transform duration-300 md:!w-5 md:!h-5 ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                      />
                    </div>

                    {/* 交通 / 停留信息 */}
                    <div className="flex items-center gap-4 mt-3 ml-[52px] md:ml-[60px]">
                      <div className="flex items-center gap-1 text-white/30 text-xs md:text-sm">
                        <TransportIcon size={12} className="md:!w-3.5 md:!h-3.5" />
                        <span>{step.walkingFromPrev}</span>
                      </div>
                      <div className="flex items-center gap-1 text-white/30 text-xs md:text-sm">
                        <Clock size={12} className="md:!w-3.5 md:!h-3.5" />
                        <span>建议停留 {step.stayMinutes} 分钟</span>
                      </div>
                    </div>
                  </div>

                  {/* 展开详情 */}
                  <div
                    className={`
                      overflow-hidden transition-all duration-300
                      ${isExpanded ? 'max-h-80 md:max-h-96 opacity-100' : 'max-h-0 opacity-0'}
                    `}
                  >
                    <div className="px-4 md:px-5 pb-4 md:pb-5 ml-[52px] md:ml-[60px] border-t border-white/[0.04] pt-3">
                      <p className="text-white/45 text-sm md:text-base leading-relaxed">
                        {step.description}
                      </p>
                      <div className="flex items-start gap-1.5 mt-3 bg-white/[0.02] rounded-xl p-3 md:p-4">
                        <Info size={14} className="text-amber-400/50 mt-0.5 shrink-0 md:!w-4 md:!h-4" />
                        <p className="text-white/35 text-xs md:text-sm leading-relaxed">
                          {step.tip}
                        </p>
                      </div>

                      {step.photos && step.photos.length > 1 && (
                        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                          {step.photos.map((url, i) => (
                            <img
                              key={i}
                              src={url}
                              alt={`${step.name} ${i + 1}`}
                              className="w-24 h-16 md:w-32 md:h-20 rounded-lg object-cover shrink-0 opacity-60 hover:opacity-100 transition-opacity border border-white/[0.04]"
                              loading="lazy"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 地点间交通提示 */}
                {!isLast && (
                  <div className="flex items-center gap-2 ml-10 md:ml-12 my-2 text-white/15 text-[11px] md:text-xs">
                    <TransportIcon size={11} />
                    <span>{transportMeta.betweenLabel}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 底部 */}
        <div
          className="text-center mt-8 md:mt-10 mb-4 animate-fade-in"
          style={{ animationDelay: '0.8s' }}
        >
          <div className="inline-flex items-center gap-2 text-white/15 text-xs md:text-sm">
            <Sparkles size={14} className="text-amber-400/30" />
            <span>Enjoy your roam · 享受漫无目的的快乐</span>
            <Sparkles size={14} className="text-amber-400/30" />
          </div>
        </div>
      </div>
    </div>
  )
}
