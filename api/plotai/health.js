/** PlotAI health en CommonJS puro (compatible con api/package.json). */
module.exports = (req, res) => {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'GET') {
    res.setHeader('Content-Type', 'application/json')
    res.statusCode = 405
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }))
    return
  }
  const gemini = Boolean(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY)
  res.setHeader('Content-Type', 'application/json')
  res.statusCode = 200
  res.end(
    JSON.stringify({
      ok: true,
      service: 'plotai',
      gemini_configured: gemini,
      ts: new Date().toISOString()
    })
  )
}
