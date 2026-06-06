import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Footprints,
  Bike,
  TrainFront,
  Car,
  Sparkles,
  ChevronLeft,
  Zap,
} from 'lucide-react'

// ==================== 选项配置 ====================

const CATEGORIES = [
  {
    key: 'transport',
    label: '出行方式',
    color: '#38bdf8',
    glowColor: 'rgba(56,189,248,0.4)',
    bgSelected: 'rgba(56,189,248,0.15)',
    borderSelected: 'rgba(56,189,248,0.5)',
    radius: 0.14,
    options: [
      { value: 'walk',    label: '步行', icon: Footprints },
      { value: 'cycle',  label: '骑行', icon: Bike },
      { value: 'subway', label: '地铁', icon: TrainFront },
      { value: 'drive',  label: '打车', icon: Car },
    ],
  },
  {
    key: 'time',
    label: '预计时间',
    color: '#fbbf24',
    glowColor: 'rgba(251,191,36,0.4)',
    bgSelected: 'rgba(251,191,36,0.15)',
    borderSelected: 'rgba(251,191,36,0.5)',
    radius: 0.26,
    options: [
      { value: '1h',  label: '1 小时' },
      { value: '2h',  label: '2 小时' },
      { value: '3h',  label: '3 小时' },
      { value: '5h',  label: '5 小时' },
      { value: '1d',  label: '1 天' },
      { value: '2d',  label: '2 天' },
    ],
  },
  {
    key: 'style',
    label: '风格模式',
    color: '#f472b6',
    glowColor: 'rgba(244,114,182,0.4)',
    bgSelected: 'rgba(244,114,182,0.15)',
    borderSelected: 'rgba(244,114,182,0.5)',
    radius: 0.37,
    options: [
      { value: 'relax',     label: '摸鱼模式',   sub: '咖啡馆 · 公园' },
      { value: 'artsy',     label: '文艺出片',   sub: '书店 · 美术馆 · 老街' },
      { value: 'commando',  label: '特种兵模式', sub: '更多地点 · 高效打卡' },
      { value: 'couple',    label: '情侣模式',   sub: '约会路线 · 浪漫角落' },
      { value: 'quiet',     label: '社恐模式',   sub: '人少安静 · 独处时光' },
      { value: 'budget',    label: '穷游模式',   sub: '预算 100 元以内' },
    ],
  },
]

const DEFAULT_SELECTIONS = {
  transport: 'walk',
  time: '2h',
  style: 'relax',
}

// ==================== 辅助函数 ====================

function polarToCartesian(cx, cy, radius, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  }
}

function assignAngles(categories, containerWidth) {
  const result = []
  const angleOffsets = {
    transport: -90,
    time: 15,
    style: -15,
  }

  for (const cat of categories) {
    const count = cat.options.length
    const startAngle = angleOffsets[cat.key] || 0
    const radius = cat.radius * containerWidth

    for (let i = 0; i < count; i++) {
      const angle = startAngle + (360 / count) * i
      result.push({
        ...cat.options[i],
        categoryKey: cat.key,
        categoryLabel: cat.label,
        categoryColor: cat.color,
        categoryGlowColor: cat.glowColor,
        categoryBgSelected: cat.bgSelected,
        categoryBorderSelected: cat.borderSelected,
        radius,
        angle,
      })
    }
  }

  return result
}

// ==================== 组件 ====================

export default function PreferenceSelector({ onConfirm, onBack }) {
  const containerRef = useRef(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [selections, setSelections] = useState({ ...DEFAULT_SELECTIONS })
  const [animReady, setAnimReady] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [hoveredOption, setHoveredOption] = useState(null)

  // ==================== 测量容器 ====================
  const measure = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setDimensions({ width: rect.width, height: rect.height })
    }
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    const t1 = setTimeout(() => setAnimReady(true), 80)
    const t2 = setTimeout(() => setShowConfirm(true), 900)
    return () => {
      window.removeEventListener('resize', measure)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [measure])

  // ==================== 响应式尺寸 ====================
  // 气泡大小随容器宽度缩放：手机上紧凑，桌面端更大
  const containerWidth = dimensions.width
  const smallBubbleSize = Math.max(48, Math.min(containerWidth * 0.11, 64))   // 48~64px
  const largeBubbleSize = Math.max(64, Math.min(containerWidth * 0.14, 88))   // 64~88px
  const centerNodeSize = animReady
    ? Math.max(48, Math.min(containerWidth * 0.10, 72))
    : Math.max(140, Math.min(containerWidth * 0.38, 200))
  const iconSize = Math.max(11, Math.min(containerWidth * 0.025, 16))
  const subWidth = Math.max(56, Math.min(containerWidth * 0.12, 80))

  // ==================== 计算位置 ====================
  const centerX = dimensions.width / 2
  const centerY = dimensions.height * 0.43

  const positionedOptions = dimensions.width > 0
    ? assignAngles(CATEGORIES, dimensions.width)
    : []

  const optionsWithCoords = positionedOptions.map((opt) => {
    const { x, y } = polarToCartesian(centerX, centerY, opt.radius, opt.angle)
    return { ...opt, x, y }
  })

  const handleSelect = (categoryKey, value) => {
    setSelections((prev) => ({ ...prev, [categoryKey]: value }))
  }

  const handleConfirm = () => onConfirm(selections)

  const getOptionIcon = (option) => {
    if (!option.icon) return null
    const Icon = option.icon
    return <Icon size={iconSize} />
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full select-none overflow-hidden"
    >
      {/* --- 顶部返回 --- */}
      <div className="absolute top-6 left-5 md:left-8 z-30">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors"
        >
          <ChevronLeft size={18} className="md:!w-5 md:!h-5" />
          <span className="text-xs md:text-sm">返回</span>
        </button>
      </div>

      {/* --- 类别标签指示 --- */}
      <div className="absolute top-6 right-5 md:right-8 z-30 flex items-center gap-3 md:gap-4">
        {CATEGORIES.map((cat) => (
          <div key={cat.key} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full"
              style={{ background: cat.color, boxShadow: `0 0 6px ${cat.glowColor}` }}
            />
            <span className="text-white/20 text-[10px] md:text-xs tracking-wider">{cat.label}</span>
          </div>
        ))}
      </div>

      {/* --- SVG 放射线条层 --- */}
      <svg
        className="absolute inset-0 w-full h-full z-10 pointer-events-none"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      >
        {optionsWithCoords.map((opt, i) => {
          const isSelected = selections[opt.categoryKey] === opt.value
          const isHovered = hoveredOption?.categoryKey === opt.categoryKey &&
                            hoveredOption?.value === opt.value
          const isHighlighted = isSelected || isHovered
          const lineLength = opt.radius

          return (
            <g key={`${opt.categoryKey}-${opt.value}`}>
              <line
                x1={centerX} y1={centerY} x2={opt.x} y2={opt.y}
                stroke={opt.categoryColor}
                strokeWidth={isHighlighted ? 3 : 1}
                strokeLinecap="round"
                opacity={isHighlighted ? 0.35 : 0.08}
                className="transition-all duration-500"
                style={{ filter: isHighlighted ? 'blur(2px)' : 'none' }}
              />
              <line
                x1={centerX} y1={centerY} x2={opt.x} y2={opt.y}
                stroke={opt.categoryColor}
                strokeWidth={isHighlighted ? 1.5 : 0.5}
                strokeLinecap="round"
                opacity={isHighlighted ? 0.7 : 0.2}
                strokeDasharray={lineLength}
                strokeDashoffset={animReady ? 0 : lineLength}
                className="transition-all duration-500"
                style={{
                  transitionDuration: `${500 + i * 30}ms`,
                  transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              />
            </g>
          )
        })}
      </svg>

      {/* --- 中心节点 --- */}
      <div
        className="absolute z-20 rounded-full flex items-center justify-center
                   transition-all duration-700 ease-out"
        style={{
          left: centerX,
          top: centerY,
          width: centerNodeSize,
          height: centerNodeSize,
          transform: 'translate(-50%, -50%)',
          background: animReady
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: animReady
            ? '0 0 40px rgba(99,102,241,0.08)'
            : '0 0 60px rgba(99,102,241,0.04)',
        }}
      >
        <div
          className="absolute inset-0 rounded-full border border-indigo-400/15 animate-ping"
          style={{ animationDuration: '3s' }}
        />
        <div
          className="absolute rounded-full border border-indigo-400/10 animate-ping"
          style={{
            inset: '-6px',
            animationDuration: '3s',
            animationDelay: '0.5s',
          }}
        />

        {animReady ? (
          <Sparkles size={Math.round(iconSize * 1.3)} className="text-indigo-300/70" />
        ) : (
          <>
            <Footprints size={28} className="text-indigo-300/70" />
            <span className="text-white/70 text-lg md:text-xl font-medium tracking-widest ml-1">
              开始漫游
            </span>
          </>
        )}
      </div>

      {/* --- 选项气泡 --- */}
      {optionsWithCoords.map((opt, i) => {
        const isSelected = selections[opt.categoryKey] === opt.value
        const isHovered = hoveredOption?.categoryKey === opt.categoryKey &&
                          hoveredOption?.value === opt.value
        const isHighlighted = isSelected || isHovered
        const isStyle = opt.categoryKey === 'style'
        const bubbleSize = isStyle ? largeBubbleSize : smallBubbleSize

        return (
          <button
            key={`${opt.categoryKey}-${opt.value}`}
            onClick={() => handleSelect(opt.categoryKey, opt.value)}
            onPointerEnter={() => setHoveredOption({ categoryKey: opt.categoryKey, value: opt.value })}
            onPointerLeave={() => setHoveredOption(null)}
            className={`
              absolute z-20 flex flex-col items-center justify-center
              rounded-full transition-all duration-300
              ${animReady ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}
              ${isHighlighted ? 'shadow-lg' : 'hover:scale-110'}
            `}
            style={{
              left: opt.x,
              top: opt.y,
              width: bubbleSize,
              height: bubbleSize,
              transform: `translate(-50%, -50%) ${animReady ? 'scale(1)' : 'scale(0)'}`,
              background: isHighlighted
                ? opt.categoryBgSelected
                : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isHighlighted ? opt.categoryBorderSelected : 'rgba(255,255,255,0.06)'}`,
              boxShadow: isHighlighted
                ? `0 0 24px ${opt.categoryGlowColor}`
                : 'none',
              transitionDelay: `${100 + i * 40}ms, 0ms`,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            {opt.icon && (
              <span
                className="mb-0.5 transition-colors duration-300"
                style={{ color: isHighlighted ? opt.categoryColor : 'rgba(255,255,255,0.35)' }}
              >
                {getOptionIcon(opt)}
              </span>
            )}

            <span
              className={`
                transition-colors duration-300 tracking-wider leading-tight
                ${isStyle ? 'text-[11px] md:text-xs font-medium' : 'text-[10px] md:text-xs'}
              `}
              style={{
                color: isHighlighted ? opt.categoryColor : 'rgba(255,255,255,0.5)',
              }}
            >
              {opt.label}
            </span>

            {opt.sub && (
              <span
                className="text-[8px] md:text-[10px] mt-0.5 text-center leading-tight transition-colors duration-300"
                style={{
                  color: isHighlighted ? opt.categoryColor : 'rgba(255,255,255,0.15)',
                  opacity: isHighlighted ? 0.8 : 0.6,
                  maxWidth: `${subWidth}px`,
                }}
              >
                {opt.sub}
              </span>
            )}
          </button>
        )
      })}

      {/* --- 底部确认按钮 --- */}
      <div
        className={`
          absolute bottom-6 md:bottom-10 left-0 right-0 z-30 flex justify-center
          transition-all duration-500 ease-out
          ${showConfirm ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}
        `}
      >
        <button
          onClick={handleConfirm}
          className="
            flex items-center gap-2 px-8 md:px-12 py-3 md:py-3.5 rounded-full
            bg-white/[0.06] border border-white/[0.08]
            hover:bg-white/[0.10] hover:border-white/[0.15]
            active:scale-95
            transition-all duration-300
          "
        >
          <Zap size={16} className="text-indigo-400 md:!w-5 md:!h-5" />
          <span className="text-white/80 text-sm md:text-base tracking-widest font-medium">
            生成路线
          </span>
          <span className="text-white/15 text-[10px] md:text-xs tracking-wide hidden sm:inline">
            {CATEGORIES.map((cat) => {
              const sel = selections[cat.key]
              const opt = cat.options.find((o) => o.value === sel)
              return opt ? opt.label : ''
            }).join(' · ')}
          </span>
        </button>
      </div>
    </div>
  )
}
