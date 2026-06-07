/**
 * Vercel Serverless 函数 — 高德 API 代理
 *
 * 处理所有 /api/amap/* 请求，在服务端注入 API Key，
 * 确保 Key 不会暴露到前端 JS bundle 中。
 *
 * 环境变量 (Vercel Dashboard 设置):
 *   AMAP_API_KEY — 高德 Web服务 API Key
 *
 * 本地开发:
 *   在 .env.local 中设置 AMAP_API_KEY
 *   Vite proxy (vite.config.js) 同样会在服务端注入 Key
 */

export default async function handler(req, res) {
  const apiKey = process.env.AMAP_API_KEY

  if (!apiKey) {
    return res.status(500).json({
      status: '0',
      info: 'AMAP_API_KEY not configured on server',
    })
  }

  // [...path] 捕获通配符，如 /api/amap/v3/place/around → path = ['v3','place','around']
  const segments = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean)
  const amapPath = segments.join('/')

  if (!amapPath) {
    return res.status(400).json({ status: '0', info: 'Missing API path' })
  }

  // 构建目标 URL
  const url = new URL(`https://restapi.amap.com/${amapPath}`)

  // 复制客户端发来的参数（排除 path 自身）
  for (const [key, value] of Object.entries(req.query)) {
    if (key !== 'path') {
      url.searchParams.set(key, String(value))
    }
  }

  // 服务端注入 Key
  url.searchParams.set('key', apiKey)

  // 转发 Content-Type 头（高德需要）
  const headers = {}
  if (req.headers['content-type']) {
    headers['Content-Type'] = req.headers['content-type']
  }

  try {
    const upstream = await fetch(url.toString(), {
      headers,
      redirect: 'follow',
    })

    const body = await upstream.json()

    // 透传上游的状态码（Vercel Node runtime 可用 res.status）
    if (typeof res.status === 'function') {
      res.status(upstream.status).json(body)
    } else {
      // Edge runtime fallback
      res.json(body)
    }
  } catch (err) {
    console.error('[amap-proxy] upstream error:', err.message)
    res.status(502).json({
      status: '0',
      info: `Proxy error: ${err.message}`,
    })
  }
}
