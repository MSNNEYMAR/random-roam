/**
 * 调试端点 — 查看 rewrite 后函数收到的完整请求信息
 */
export default function handler(req, res) {
  res.status(200).json({
    url: req.url,
    method: req.method,
    query: req.query,
    headers: {
      'x-forwarded-path': req.headers['x-forwarded-path'] || null,
      'x-forwarded-uri': req.headers['x-forwarded-uri'] || null,
      'x-forwarded-host': req.headers['x-forwarded-host'] || null,
      'x-forwarded-proto': req.headers['x-forwarded-proto'] || null,
      'x-vercel-forwarded-url': req.headers['x-vercel-forwarded-url'] || null,
      'x-original-url': req.headers['x-original-url'] || null,
      'x-now-route': req.headers['x-now-route'] || null,
      'x-matched-path': req.headers['x-matched-path'] || null,
      'host': req.headers.host || null,
    },
    allHeaderKeys: Object.keys(req.headers).filter(k =>
      k.startsWith('x-') || k.startsWith('forward')
    ),
  })
}
