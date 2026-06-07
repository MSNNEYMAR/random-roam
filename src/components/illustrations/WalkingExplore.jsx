/**
 * 探索插画 — 人拿着指南针行走
 * 风格匹配：Storyset Cuate — 现代扁平 + 动态姿态
 * 用途：路线加载中 / 正在生成路线
 */
export default function WalkingExplore({ className = '', size = 200 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 400 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 地面 */}
      <ellipse cx="200" cy="270" rx="140" ry="16" fill="#818cf8" opacity="0.08" />

      {/* 背景建筑群 — 左边 */}
      <rect x="40" y="180" width="28" height="75" rx="4" fill="#1e1b4b" opacity="0.5" />
      <rect x="72" y="200" width="20" height="55" rx="4" fill="#1e1b4b" opacity="0.4" />
      <rect x="95" y="170" width="24" height="85" rx="4" fill="#1e1b4b" opacity="0.55" />

      {/* 背景建筑群 — 右边 */}
      <rect x="280" y="185" width="25" height="70" rx="4" fill="#1e1b4b" opacity="0.45" />
      <rect x="310" y="195" width="20" height="60" rx="4" fill="#1e1b4b" opacity="0.35" />
      <rect x="340" y="175" width="26" height="80" rx="4" fill="#1e1b4b" opacity="0.5" />

      {/* 太阳/月亮 */}
      <circle cx="320" cy="80" r="25" fill="#eab308" opacity="0.12" />

      {/* 指南针 */}
      <circle cx="240" cy="105" r="30" stroke="#a5b4fc" strokeWidth="2.5" fill="#1e1b4b" opacity="0.6" />
      {/* 指南针指针 */}
      <polygon points="240,80 234,105 240,100 246,105" fill="#f43f5e" opacity="0.7" />
      <polygon points="240,130 234,105 240,110 246,105" fill="#6366f1" opacity="0.5" />
      <circle cx="240" cy="105" r="3" fill="#a5b4fc" opacity="0.8" />

      {/* 人物 — 腿部（行走姿态） */}
      <line x1="170" y1="145" x2="155" y2="175" stroke="#a5b4fc" strokeWidth="7" strokeLinecap="round" opacity="0.55" />
      <line x1="175" y1="145" x2="185" y2="175" stroke="#a5b4fc" strokeWidth="7" strokeLinecap="round" opacity="0.45" />

      {/* 人物 — 身体 */}
      <rect x="158" y="108" width="26" height="40" rx="13" fill="#6366f1" opacity="0.45" />

      {/* 人物 — 头 */}
      <circle cx="171" cy="90" r="16" fill="#a5b4fc" opacity="0.55" />

      {/* 人物 — 手臂（拿指南针） */}
      <path d="M185 115 L215 108 L240 105" stroke="#a5b4fc" strokeWidth="6" strokeLinecap="round" opacity="0.5" />

      {/* 足迹装饰 */}
      <circle cx="120" cy="260" r="4" fill="#6366f1" opacity="0.15" />
      <circle cx="140" cy="255" r="3.5" fill="#6366f1" opacity="0.12" />
      <circle cx="158" cy="258" r="4" fill="#6366f1" opacity="0.15" />
      <circle cx="210" cy="262" r="3" fill="#6366f1" opacity="0.1" />
      <circle cx="225" cy="259" r="3.5" fill="#6366f1" opacity="0.12" />
    </svg>
  )
}
