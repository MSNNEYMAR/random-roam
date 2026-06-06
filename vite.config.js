import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // ==================== API 代理 ====================
  // 解决浏览器跨域限制，将 /api/amap/* 和 /api/google/* 转发到第三方 API
  //
  // 开发时: Vite 自动启动代理 (无需额外配置)
  // 生产时: 需要自己的后端代理，或用 Vercel/Netlify 的 redirects 功能
  server: {
    proxy: {
      '/api/amap': {
        target: 'https://restapi.amap.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/amap/, ''),
        // 高德 API 有时较慢，调大超时
        timeout: 10000,
      },
      '/api/google': {
        target: 'https://maps.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/google/, ''),
      },
    },
  },
})
