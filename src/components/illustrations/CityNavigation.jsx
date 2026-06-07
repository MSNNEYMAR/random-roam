/**
 * 导航插画 — 人物站在城市中看地图路线
 * 风格匹配：Storyset Pana — 温暖色调 + 城市天际线
 * 用途：路线概览卡片装饰 / 空照片位
 */
export default function CityNavigation({ className = '', size = 240 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size * 0.7}
      viewBox="0 0 360 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 城市天际线背景 */}
      <rect x="10" y="90" width="36" height="100" rx="5" fill="#1e1b4b" opacity="0.5" />
      <rect x="50" y="110" width="28" height="80" rx="5" fill="#1e1b4b" opacity="0.4" />
      <rect x="82" y="70" width="32" height="120" rx="5" fill="#1e1b4b" opacity="0.55" />
      <rect x="118" y="100" width="24" height="90" rx="5" fill="#1e1b4b" opacity="0.4" />
      <rect x="146" y="85" width="30" height="105" rx="5" fill="#1e1b4b" opacity="0.5" />
      <rect x="200" y="95" width="28" height="95" rx="5" fill="#1e1b4b" opacity="0.45" />
      <rect x="232" y="75" width="34" height="115" rx="5" fill="#1e1b4b" opacity="0.55" />
      <rect x="270" y="105" width="25" height="85" rx="5" fill="#1e1b4b" opacity="0.4" />
      <rect x="299" y="90" width="30" height="100" rx="5" fill="#1e1b4b" opacity="0.5" />
      <rect x="333" y="110" width="20" height="80" rx="5" fill="#1e1b4b" opacity="0.35" />

      {/* 窗户灯光 */}
      <rect x="88" y="80" width="5" height="5" rx="1" fill="#eab308" opacity="0.15" />
      <rect x="98" y="90" width="5" height="5" rx="1" fill="#eab308" opacity="0.12" />
      <rect x="152" y="95" width="5" height="5" rx="1" fill="#eab308" opacity="0.15" />
      <rect x="238" y="85" width="5" height="5" rx="1" fill="#eab308" opacity="0.12" />
      <rect x="305" y="100" width="5" height="5" rx="1" fill="#eab308" opacity="0.15" />
      <rect x="16" y="100" width="5" height="5" rx="1" fill="#eab308" opacity="0.1" />

      {/* 地图纸 */}
      <rect x="120" y="125" width="90" height="65" rx="4" fill="#312e81" stroke="#6366f1" strokeWidth="1.5" opacity="0.7"
        transform="rotate(-5, 165, 157)" />

      {/* 地图上的路线 */}
      <path
        d="M135,135 L150,130 L160,140 L175,135 L190,145"
        stroke="#eab308"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.6"
        transform="rotate(-5, 165, 157)"
      />

      {/* 地图 pin */}
      <circle cx="175" cy="133" r="4" fill="#f43f5e" opacity="0.7" transform="rotate(-5, 165, 157)" />

      {/* 人物 — 站在左侧 */}
      <line x1="85" y1="170" x2="85" y2="190" stroke="#a5b4fc" strokeWidth="6" strokeLinecap="round" opacity="0.4" />
      <rect x="75" y="150" width="20" height="25" rx="10" fill="#6366f1" opacity="0.4" />
      <circle cx="85" cy="135" r="13" fill="#a5b4fc" opacity="0.5" />
      {/* 手臂指地图 */}
      <line x1="95" y1="152" x2="125" y2="145" stroke="#a5b4fc" strokeWidth="5" strokeLinecap="round" opacity="0.45" />

      {/* 右上角装饰 pin */}
      <path
        d="M305,40 C305,30 315,30 315,40 C315,48 310,55 310,55 C310,55 305,48 305,40Z"
        fill="#f43f5e"
        opacity="0.25"
      />
      <circle cx="310" cy="38" r="3" fill="#1e1b4b" opacity="0.4" />
    </svg>
  )
}
