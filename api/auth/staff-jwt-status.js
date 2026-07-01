module.exports = (req, res) => {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'GET') {
    res.setHeader('Content-Type', 'application/json')
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }
  const enabled = Boolean((process.env.PLOT_LAB_STAFF_JWT_SECRET || '').trim())
  res.setHeader('Content-Type', 'application/json')
  res.statusCode = 200
  res.end(JSON.stringify({ enabled }))
}
