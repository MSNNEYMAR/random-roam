/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
        display: ['Inter', '"PingFang SC"', '"Noto Serif SC"', 'serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'fade-in': 'fadeIn 0.8s ease-out forwards',
        'slide-up': 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'breathe': 'breathe 4s ease-in-out infinite',
        'breathe-glow': 'breatheGlow 3s ease-in-out infinite',
        'stagger-up': 'staggerUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
        'color-shift': 'colorShift 6s ease-in-out infinite',
        'orb-float-1': 'orbFloat1 18s ease-in-out infinite',
        'orb-float-2': 'orbFloat2 22s ease-in-out infinite',
        'orb-float-3': 'orbFloat3 20s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.7' },
          '50%': { transform: 'scale(1.08)', opacity: '1' },
        },
        breatheGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(139, 92, 246, 0.15), 0 0 60px rgba(139, 92, 246, 0.05)' },
          '50%': { boxShadow: '0 0 40px rgba(139, 92, 246, 0.35), 0 0 100px rgba(250, 204, 21, 0.15), 0 0 140px rgba(236, 72, 153, 0.08)' },
        },
        staggerUp: {
          '0%': { opacity: '0', transform: 'translateY(40px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        colorShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        orbFloat1: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(30px, -20px) scale(1.15)' },
          '66%': { transform: 'translate(-20px, 10px) scale(0.9)' },
        },
        orbFloat2: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(-25px, 15px) scale(0.85)' },
          '66%': { transform: 'translate(20px, -25px) scale(1.1)' },
        },
        orbFloat3: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(15px, 25px) scale(1.2)' },
          '66%': { transform: 'translate(-30px, -10px) scale(0.9)' },
        },
      },
    },
  },
  plugins: [],
}
