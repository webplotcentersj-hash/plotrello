/**
 * Avisos del navegador para compromisos financieros.
 *
 * Corre en segundo plano mientras Plot Lab esté abierto (cualquier pantalla) en los navegadores
 * donde alguien los activó desde /erp/compromisos. Es "inteligente":
 * - avisa una sola vez por cada etapa de un vencimiento (entra en aviso → mañana → hoy → vencido);
 * - si hay muchos a la vez, manda un único resumen en lugar de una lluvia de notificaciones;
 * - recuerda los vencidos una vez por día;
 * - respeta un horario de silencio;
 * - evita duplicados entre pestañas.
 */
import { useEffect } from 'react'
import { getArgentinaDateString } from '../../utils/dateUtils'
import { armarFilas, cargarAgenda, type FilaAgenda } from './agenda'

export type Etapa = 'aviso' | 'manana' | 'hoy' | 'vencido'
const RANGO: Record<Etapa, number> = { aviso: 1, manana: 2, hoy: 3, vencido: 4 }

export type ConfigAvisos = {
  activo: boolean
  /** Hora (0-23, Argentina) desde la que no se avisa. */
  silencioDesde: number
  /** Hora (0-23) en la que se vuelve a avisar. */
  silencioHasta: number
}

const K_CONFIG = 'erp_compromisos_avisos_cfg'
const K_ETAPAS = 'erp_compromisos_avisos_etapas'
const K_RECORDATORIO = 'erp_compromisos_avisos_recordatorio'
const K_ULTIMO = 'erp_compromisos_avisos_ultimo'
export const EVENTO_CAMBIO = 'erp-compromisos-cambio'

const CADA_MS = 30 * 60 * 1000
const MIN_ENTRE_CHEQUEOS_MS = 5 * 60 * 1000
const MAX_INDIVIDUALES = 3
const ICONO = '/favicon.png'

const CONFIG_DEFECTO: ConfigAvisos = { activo: false, silencioDesde: 21, silencioHasta: 8 }

export function leerConfigAvisos(): ConfigAvisos {
  try {
    return { ...CONFIG_DEFECTO, ...(JSON.parse(localStorage.getItem(K_CONFIG) || '{}') as Partial<ConfigAvisos>) }
  } catch {
    return CONFIG_DEFECTO
  }
}

export function guardarConfigAvisos(c: ConfigAvisos) {
  localStorage.setItem(K_CONFIG, JSON.stringify(c))
  localStorage.removeItem(K_ULTIMO)
  window.dispatchEvent(new Event(EVENTO_CAMBIO))
}

export const navegadorSoportaAvisos = () => typeof window !== 'undefined' && 'Notification' in window

export function etapaDe(f: FilaAgenda): Etapa | null {
  if (!f.pendiente) return null
  if (f.dias < 0) return 'vencido'
  if (f.dias === 0) return 'hoy'
  if (f.dias === 1) return 'manana'
  if (f.dias <= f.diasAviso) return 'aviso'
  return null
}

const money = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

function horaArgentina(): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Argentina/Buenos_Aires', hour: 'numeric', hour12: false }).format(new Date())) % 24
}

function enSilencio(c: ConfigAvisos): boolean {
  const h = horaArgentina()
  const { silencioDesde: d, silencioHasta: a } = c
  if (d === a) return false
  return d > a ? h >= d || h < a : h >= d && h < a
}

type Mostrar = { titulo: string; cuerpo: string; tag: string; insistente?: boolean; url: string }

async function mostrar(n: Mostrar, abrir: (url: string) => void) {
  const opciones: NotificationOptions & { renotify?: boolean } = {
    body: n.cuerpo,
    tag: n.tag,
    icon: ICONO,
    badge: ICONO,
    requireInteraction: Boolean(n.insistente),
    renotify: true
  }
  try {
    const notif = new Notification(n.titulo, opciones)
    notif.onclick = () => {
      window.focus()
      abrir(n.url)
      notif.close()
    }
  } catch {
    // Android / algunos navegadores sólo permiten notificar a través del service worker.
    try {
      const reg = await navigator.serviceWorker?.ready
      await reg?.showNotification(n.titulo, { ...opciones, data: { url: n.url } })
    } catch {
      /* sin soporte */
    }
  }
}

function textoFila(f: FilaAgenda): string {
  const verbo = f.sentido === 'cobrar' ? 'Cobrar a' : 'Pagar a'
  return `${verbo} ${f.contraparte} · ${f.tipo}${f.numero ? ` N° ${f.numero}` : ''}${f.cuota ? ` (cuota ${f.cuota})` : ''} · ${money(f.importe)}`
}

function individual(f: FilaAgenda, etapa: Etapa): Mostrar {
  const titulos: Record<Etapa, string> = {
    vencido: `🔴 Vencido hace ${-f.dias} día${f.dias === -1 ? '' : 's'}`,
    hoy: f.sentido === 'cobrar' ? '🟠 Hoy vence un cobro' : '🟠 Hoy vence un pago',
    manana: f.sentido === 'cobrar' ? '🟡 Mañana vence un cobro' : '🟡 Mañana vence un pago',
    aviso: `🟡 Vence en ${f.dias} días`
  }
  return {
    titulo: titulos[etapa],
    cuerpo: textoFila(f),
    tag: `erp-compromiso-${f.key}`,
    insistente: etapa === 'hoy' || etapa === 'vencido',
    url: `/erp/compromisos?foco=${f.key}`
  }
}

function resumen(lista: Array<{ f: FilaAgenda; etapa: Etapa }>, titulo?: string): Mostrar {
  const cuenta = (e: Etapa) => lista.filter((x) => x.etapa === e)
  const partes = [
    cuenta('vencido').length ? `${cuenta('vencido').length} vencidos` : '',
    cuenta('hoy').length ? `${cuenta('hoy').length} vencen hoy` : '',
    cuenta('manana').length ? `${cuenta('manana').length} mañana` : '',
    cuenta('aviso').length ? `${cuenta('aviso').length} próximos` : ''
  ].filter(Boolean)
  const cobrar = lista.filter((x) => x.f.sentido === 'cobrar').reduce((s, x) => s + x.f.importe, 0)
  const pagar = lista.filter((x) => x.f.sentido === 'pagar').reduce((s, x) => s + x.f.importe, 0)
  const grave = lista.some((x) => x.etapa === 'vencido' || x.etapa === 'hoy')
  return {
    titulo: titulo ?? `${grave ? '🔴' : '🟡'} Compromisos: ${partes.join(' · ')}`,
    cuerpo: [cobrar ? `A cobrar ${money(cobrar)}` : '', pagar ? `A pagar ${money(pagar)}` : ''].filter(Boolean).join(' · ') + '\nTocá para ver el detalle.',
    tag: 'erp-compromisos-resumen',
    insistente: grave,
    url: '/erp/compromisos'
  }
}

/** Revisa la agenda y muestra lo que corresponda. Devuelve cuántas notificaciones mostró. */
export async function revisarYAvisar(abrir: (url: string) => void, opts: { forzar?: boolean } = {}): Promise<number> {
  const cfg = leerConfigAvisos()
  if (!cfg.activo || !navegadorSoportaAvisos() || Notification.permission !== 'granted') return 0
  if (!opts.forzar && enSilencio(cfg)) return 0

  // Una sola pestaña revisa cada pocos minutos.
  const ahora = Date.now()
  if (!opts.forzar && ahora - Number(localStorage.getItem(K_ULTIMO) || 0) < MIN_ENTRE_CHEQUEOS_MS) return 0
  localStorage.setItem(K_ULTIMO, String(ahora))

  const r = await cargarAgenda()
  if (!r.ok) return 0
  const hoy = getArgentinaDateString()
  const filas = armarFilas(r.data.compromisos, r.data.cheques, r.data.nombres, hoy)

  let etapas: Record<string, Etapa> = {}
  try {
    etapas = JSON.parse(localStorage.getItem(K_ETAPAS) || '{}')
  } catch {
    etapas = {}
  }

  const activas: Array<{ f: FilaAgenda; etapa: Etapa }> = []
  const nuevas: Array<{ f: FilaAgenda; etapa: Etapa }> = []
  const siguiente: Record<string, Etapa> = {}
  for (const f of filas) {
    const etapa = etapaDe(f)
    if (!etapa) continue
    activas.push({ f, etapa })
    siguiente[f.key] = etapa
    const previa = etapas[f.key]
    if (!previa || RANGO[etapa] > RANGO[previa]) nuevas.push({ f, etapa })
  }
  // Sólo se guardan los que siguen activos: lo cumplido se olvida solo.
  localStorage.setItem(K_ETAPAS, JSON.stringify(siguiente))

  let mostradas = 0
  if (nuevas.length > 0 && nuevas.length <= MAX_INDIVIDUALES) {
    // Lo más grave primero.
    nuevas.sort((a, b) => RANGO[b.etapa] - RANGO[a.etapa] || b.f.importe - a.f.importe)
    for (const n of nuevas) {
      await mostrar(individual(n.f, n.etapa), abrir)
      mostradas++
    }
  } else if (nuevas.length > MAX_INDIVIDUALES) {
    await mostrar(resumen(nuevas), abrir)
    mostradas++
  }

  // Recordatorio diario de lo vencido que sigue pendiente (si hoy no se avisó ya por otra vía).
  const vencidos = activas.filter((x) => x.etapa === 'vencido')
  if (vencidos.length && localStorage.getItem(K_RECORDATORIO) !== hoy) {
    localStorage.setItem(K_RECORDATORIO, hoy)
    const yaAvisados = nuevas.some((x) => x.etapa === 'vencido')
    if (!yaAvisados) {
      const total = vencidos.reduce((s, x) => s + x.f.importe, 0)
      await mostrar(
        {
          ...resumen(vencidos),
          titulo: `🔴 Seguís con ${vencidos.length} vencimiento${vencidos.length > 1 ? 's' : ''} sin resolver`,
          cuerpo: `${money(total)} en total. Marcalos como cobrados/pagados o regularizalos.\nTocá para ver el detalle.`,
          tag: 'erp-compromisos-recordatorio'
        },
        abrir
      )
      mostradas++
    }
  }
  return mostradas
}

export async function avisoDePrueba(abrir: (url: string) => void) {
  await mostrar(
    {
      titulo: '🔔 Avisos de compromisos activados',
      cuerpo: 'Así te vamos a avisar cuando un cheque o pago esté por vencer.',
      tag: 'erp-compromisos-prueba',
      url: '/erp/compromisos'
    },
    abrir
  )
}

/** Olvida lo ya avisado para que la próxima revisión vuelva a avisar todo lo pendiente. */
export function reiniciarAvisados() {
  localStorage.removeItem(K_ETAPAS)
  localStorage.removeItem(K_RECORDATORIO)
  localStorage.removeItem(K_ULTIMO)
}

/** Vigilante global: montar una vez en la app del staff. */
export function useAvisosCompromisos(usuarioId: number | null | undefined, abrir: (url: string) => void) {
  useEffect(() => {
    if (!usuarioId || !navegadorSoportaAvisos()) return
    let vivo = true
    const correr = (forzar = false) => {
      if (vivo) void revisarYAvisar(abrir, { forzar }).catch(() => undefined)
    }
    const inicial = window.setTimeout(() => correr(), 8000)
    const intervalo = window.setInterval(() => correr(), CADA_MS)
    const alVolver = () => {
      if (!document.hidden) correr()
    }
    const alCambiar = () => correr(true)
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener(EVENTO_CAMBIO, alCambiar)
    return () => {
      vivo = false
      window.clearTimeout(inicial)
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener(EVENTO_CAMBIO, alCambiar)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId])
}
