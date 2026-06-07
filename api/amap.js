/**
 * Vercel Serverless 函数 — 高德 API 代理
 *
 * 处理 /api/amap/* 请求，服务端注入 API Key。
 * 路径通过 Vercel rewrite 捕获 (/api/amap/:path* → /api/amap)
 * 原始路径从 req.headers 中提取，query params 原样保留。
 */

export default async function handler(req, res) {
  const apiKey = process.env.AMAP_API_KEY

  if (!apiKey) {
    return res.status(500).json({ status: '0', info: 'AMAP_API_KEY not configured' })
  }

  // 恢复上游 API 路径 — 多来源回退
  let amapPath = ''

  // 1) 优先: Vercel rewrite 自动注入的 query param
  if (req.query.path) {
    const segments = Array.isArray(req.query.path)
      ? req.query.path
      : String(req.query.path).split('/').filter(Boolean)
    amapPath = segments.join('/')
  }

  // 2) 回退: Vercel 转发的原始路径头
  if (!amapPath) {
    const rawUrl =
      req.headers['x-forwarded-path'] ||
      req.headers['x-forwarded-uri'] ||
      req.headers['x-vercel-forwarded-url'] ||
      req.headers['x-original-url'] ||
      ''
    if (rawUrl) {
      const u = new URL(rawUrl, `http://${req.headers.host || 'localhost'}`)
      amapPath = u.pathname.replace(/^\/api\/amap\/?/, '')
    }
  }

  // 3) 最后回退: 直接从 req.url 路径中提取
  if (!amapPath) {
    const u = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`)
    amapPath = u.pathname.replace(/^\/api\/amap\/?/, '')
  }

  if (!amapPath) {
    return res.status(400).json({ status: '0', info: 'Missing API path' })
  }

  // 构建目标 URL，保留原始 query params（排除内部 routing params）
  const url = new URL(`https://restapi.amap.com/${amapPath}`)

  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path' || key === 'amapPath' || key.startsWith('__')) continue
    url.searchParams.set(key, String(value))
  }

  // 服务端注入 Key
  url.searchParams.set('key', apiKey)

  // 转发 Content-Type 头
  const headers = {}
  if (req.headers['content-type']) {
    headers['Content-Type'] = req.headers['content-type']
  }

  try {
    const upstream = await fetch(url.toString(), { headers, redirect: 'follow' })
    const body = await upstream.json()
    if (typeof res.status === 'function') {
      res.status(upstream.status).json(body)
    } else {
      res.json(body)
    }
  } catch (err) {
    console.error('[amap-proxy] upstream error:', err.message)
    res.status(502).json({ status: '0', info: `Proxy error: ${err.message}` })
  }
}
