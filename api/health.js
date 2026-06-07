/**
 * 健康检查端点 — 验证 AMAP_API_KEY 是否在 Vercel 环境变量中正确配置
 *
 * GET /api/health → { ok: true, amapConfigured: true/false }
 */
export default function handler(req, res) {
  const amapKey = process.env.AMAP_API_KEY
  res.status(200).json({
    ok: true,
    amapConfigured: !!amapKey,
    keyPrefix: amapKey ? amapKey.slice(0, 4) + '***' : 'NOT SET',
    nodeVersion: process.version,
  })
}
