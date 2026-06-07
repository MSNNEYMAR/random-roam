/**
 * 空结果插画 — 人拿着地图寻找地点
 * 风格匹配：Storyset Pana — 扁平色块 + 圆润造型
 * 用途：路线生成失败 / 附近无地标
 */
export default function LocationSearch({ className = '', size = 200 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 400 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 背景圆形 — 地面 */}
      <ellipse cx="200" cy="270" rx="160" ry="20" fill="#818cf8" opacity="0.08" />

      {/* 放大镜 */}
      <circle cx="260" cy="100" r="45" stroke="#a5b4fc" strokeWidth="3" fill="none" opacity="0.5" />
      <line x1="292" y1="132" x2="330" y2="170" stroke="#a5b4fc" strokeWidth="5" strokeLinecap="round" opacity="0.5" />

      {/* 地图 */}
      <rect x="130" y="175" width="140" height="90" rx="6" fill="#1e1b4b" stroke="#6366f1" strokeWidth="2" opacity="0.6" />
      {/* 地图上的路线 */}
      <polyline
        points="145,200 165,210 170,195 190,215 210,205 230,220 255,200"
        stroke="#eab308"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.7"
      />
      {/* 地图上的地点 pin */}
      <circle cx="165" cy="208" r="5" fill="#f43f5e" opacity="0.8" />
      <circle cx="210" cy="203" r="5" fill="#10b981" opacity="0.8" />
      <circle cx="255" cy="198" r="5" fill="#f97316" opacity="0.8" />

      {/* 人物 — 身体 */}
      <ellipse cx="170" cy="120" rx="22" ry="26" fill="#6366f1" opacity="0.4" />
      {/* 人物 — 头 */}
      <circle cx="170" cy="83" r="16" fill="#a5b4fc" opacity="0.5" />
      {/* 人物 — 手臂（指地图） */}
      <path d="M158 110 L135 135 L125 145" stroke="#a5b4fc" strokeWidth="6" strokeLinecap="round" opacity="0.5" />

      {/* 问号浮动 */}
      <text x="300" y="80" fontSize="36" fontWeight="700" fill="#6366f1" opacity="0.3" fontFamily="Inter, sans-serif">?</text>
    </svg>
  )
}
