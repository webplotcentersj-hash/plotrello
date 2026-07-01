/** Ping mínimo en CommonJS puro (sin TypeScript ni imports). */
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.statusCode = 200
  res.end(JSON.stringify({ ok: true, service: 'ping', ts: new Date().toISOString() }))
}
