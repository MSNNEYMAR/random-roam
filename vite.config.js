import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // 加载 .env.local 中的 AMAP_API_KEY（不暴露到前端 bundle）
  const env = loadEnv(mode, process.cwd(), '')
  const amapKey = env.AMAP_API_KEY || ''

  return {
    plugins: [react()],

    // ==================== API 代理 ====================
    // 解决浏览器跨域限制，将 /api/amap/* 和 /api/google/* 转发到第三方 API
    //
    // 开发时: Vite 自动启动代理，Key 在 rewrite 中注入
    // 生产时: Vercel Serverless Function (api/amap/[...path].js) 处理
    server: {
      proxy: {
        '/api/amap': {
          target: 'https://restapi.amap.com',
          changeOrigin: true,
          // rewrite 中直接注入 API Key，比 proxyReq 事件更可靠
          rewrite: (path) => {
            let newPath = path.replace(/^\/api\/amap/, '')
            if (amapKey) {
              const sep = newPath.includes('?') ? '&' : '?'
              newPath += `${sep}key=${amapKey}`
            }
            return newPath
          },
          timeout: 10000,
        },
        '/api/google': {
          target: 'https://maps.googleapis.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/google/, ''),
        },
      },
    },
  }
})
