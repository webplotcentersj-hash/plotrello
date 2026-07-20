/** Utilidades de explicación de sesiones Plot Lab (admin actividad). */

export type GeoInfo = {
  city?: string | null
  region?: string | null
  country?: string | null
  isp?: string | null
  org?: string | null
  lat?: number | null
  lon?: number | null
  query?: string | null
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
  return null
}

export function argentinaYmd(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d)
}

/** Inicio/fin del día civil en Argentina → ISO UTC para filtrar en DB. */
export function argentinaDayBounds(ymd: string): { desdeIso: string; hastaIso: string } {
  // ymd = YYYY-MM-DD en calendario AR
  const desdeIso = new Date(`${ymd}T00:00:00-03:00`).toISOString()
  const hastaIso = new Date(`${ymd}T23:59:59.999-03:00`).toISOString()
  return { desdeIso, hastaIso }
}

export function argentinaRangeBounds(desdeYmd: string, hastaYmd: string): {
  desdeIso: string
  hastaIso: string
} {
  return {
    desdeIso: new Date(`${desdeYmd}T00:00:00-03:00`).toISOString(),
    hastaIso: new Date(`${hastaYmd}T23:59:59.999-03:00`).toISOString()
  }
}

export function fmtDateTimeAr(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Buenos_Aires',
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function fmtDurationEs(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h} h ${m} min`
  if (m > 0) return `${m} min ${s} s`
  return `${s} s`
}

function detectBrowser(ua: string | null | undefined): string {
  if (!ua) return 'navegador desconocido'
  if (/Edg\//i.test(ua)) return 'Microsoft Edge'
  if (/OPR\/|Opera/i.test(ua)) return 'Opera'
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return 'Google Chrome'
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Safari'
  if (/Firefox\//i.test(ua)) return 'Mozilla Firefox'
  return 'navegador'
}

function detectOs(platform: unknown, ua: string | null | undefined): string {
  const p = String(platform || '')
  const u = ua || ''
  if (/Android/i.test(u)) return 'Android (celular o tablet)'
  if (/iPhone|iPad|iPod/i.test(u)) return 'iPhone/iPad (iOS)'
  if (/Win/i.test(p) || /Windows/i.test(u)) return 'PC con Windows'
  if (/Mac/i.test(p) || /Macintosh/i.test(u)) return 'Mac'
  if (/Linux/i.test(p) || /Linux/i.test(u)) return 'Linux'
  if (p) return `dispositivo ${p}`
  return 'dispositivo'
}

function netLabel(conn: Record<string, unknown> | null): string | null {
  if (!conn) return null
  const t = String(conn.effectiveType || '')
  const map: Record<string, string> = {
    '4g': 'conexión rápida (4G/Wi‑Fi)',
    '3g': 'conexión media (3G)',
    '2g': 'conexión lenta (2G)',
    'slow-2g': 'conexión muy lenta'
  }
  return map[t] || (t ? `red ${t}` : null)
}

export function extractGeo(deviceInfo: Record<string, unknown> | null | undefined): GeoInfo | null {
  const g = asRecord(deviceInfo?.geo)
  if (!g) return null
  return {
    city: (g.city as string) || null,
    region: (g.region as string) || (g.regionName as string) || null,
    country: (g.country as string) || null,
    isp: (g.isp as string) || null,
    org: (g.org as string) || null,
    lat: typeof g.lat === 'number' ? g.lat : null,
    lon: typeof g.lon === 'number' ? g.lon : null,
    query: (g.query as string) || null
  }
}

export function explainLocation(geo: GeoInfo | null, ip: string | null | undefined): string {
  if (geo && (geo.city || geo.region || geo.country)) {
    const place = [geo.city, geo.region, geo.country].filter(Boolean).join(', ')
    const isp = geo.isp || geo.org
    return (
      `Entró aproximadamente desde ${place}` +
      (isp ? ` (proveedor de internet: ${isp})` : '') +
      (ip ? `. IP pública: ${ip}` : '.')
    )
  }
  if (ip) {
    return `IP pública detectada: ${ip}. La ubicación exacta no está disponible aún (se completa al abrir sesión con el servidor).`
  }
  return 'No se pudo determinar la IP ni la ubicación de esta sesión.'
}

export function explainDevice(
  deviceInfo: Record<string, unknown> | null | undefined,
  userAgent: string | null | undefined
): string {
  const info = deviceInfo || {}
  const ua = userAgent || (typeof info.userAgent === 'string' ? info.userAgent : null)
  const os = detectOs(info.platform, ua)
  const browser = detectBrowser(ua)
  const touch = Boolean(info.touch)
  const tipo = touch && /Android|iPhone|iPad/i.test(ua || '')
    ? 'celular/tablet'
    : touch
      ? 'pantalla táctil'
      : 'escritorio'
  const screen =
    info.screenWidth && info.screenHeight
      ? `pantalla ${info.screenWidth}×${info.screenHeight}`
      : null
  const net = netLabel(asRecord(info.connection))
  const tz = info.timezone ? String(info.timezone) : null
  const lang = info.language ? String(info.language) : null

  const bits = [
    `Dispositivo: ${os} (${tipo})`,
    `Navegador: ${browser}`,
    screen,
    net,
    tz ? `zona horaria del equipo: ${tz.replace('America/Buenos_Aires', 'Argentina (Buenos Aires)')}` : null,
    lang ? `idioma: ${lang}` : null
  ].filter(Boolean)

  return bits.join('. ') + '.'
}

export function explainSessionNatural(params: {
  nombre: string
  startedAt: string
  endedAt: string | null
  lastSeenAt: string
  durationSec: number
  ip: string | null
  userAgent: string | null
  deviceInfo: Record<string, unknown> | null
  entryPath: string | null
  pageViews: number
}): string {
  const geo = extractGeo(params.deviceInfo)
  const ingreso = fmtDateTimeAr(params.startedAt)
  const ultima = fmtDateTimeAr(params.lastSeenAt)
  const estado = params.endedAt
    ? `Sesión cerrada (última actividad ${fmtDateTimeAr(params.endedAt)}).`
    : 'Sesión todavía abierta o reciente.'

  return [
    `${params.nombre} abrió Plot Lab el ${ingreso} (hora Argentina).`,
    explainLocation(geo, params.ip),
    explainDevice(params.deviceInfo, params.userAgent),
    `Estuvo activo unos ${fmtDurationEs(params.durationSec)}. Última actividad: ${ultima}.`,
    estado,
    params.entryPath ? `Primera pantalla: ${params.entryPath}.` : null,
    `Recorrió ${params.pageViews} pantalla${params.pageViews === 1 ? '' : 's'} en esta pestaña.`
  ]
    .filter(Boolean)
    .join(' ')
}
