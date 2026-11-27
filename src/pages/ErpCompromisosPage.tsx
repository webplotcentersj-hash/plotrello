import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ErpPageHeader from '../components/erp/ErpPageHeader'
import { listClientesBasicos, listProveedoresBasicos, nombreCliente, type ClienteBasico } from '../services/erpContableApi'
import {
  TIPOS_COMPROMISO,
  actualizarCompromiso,
  cambiarEstadoVencimiento,
  crearCompromiso,
  eliminarCompromiso,
  type CompromisoConVencimientos,
  type EstadoVencimiento,
  type NuevoCompromiso,
  type SentidoCompromiso,
  type VencimientoEditable
} from '../services/erpCompromisosApi'
import {
  armarFilas,
  calcularInsights,
  cargarAgenda,
  nombreProveedor,
  proyeccionSemanal,
  type AgendaCargada,
  type FilaAgenda,
  type Insight
} from '../features/compromisos/agenda'
import {
  EVENTO_CAMBIO,
  avisoDePrueba,
  guardarConfigAvisos,
  leerConfigAvisos,
  navegadorSoportaAvisos,
  reiniciarAvisados,
  type ConfigAvisos
} from '../features/compromisos/avisosNavegador'
import { URGENCIA_INFO, textoDias, urgenciaDe, type Urgencia } from '../utils/compromisosUrgencia'
import { getArgentinaDateString } from '../utils/dateUtils'
import { descargarCsv, fmtFecha, fmtMoney } from '../utils/erpUi'
import './ErpSectionPage.css'
import './ErpContableAvanzado.css'
import './ErpCompromisosPage.css'

type Proveedor = { id: number; nombre: string | null; razon_social: string | null; cuit: string | null }
type VencForm = VencimientoEditable & { key: string; estado?: EstadoVencimiento }

const ORDEN_URGENCIA: Urgencia[] = ['vencido', 'hoy', 'urgente', 'proximo', 'tranquilo', 'cumplido']
const DIAS_LINEA = 30
const DIAS_SEMANA = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

let seq = 0
const nuevaKey = () => `v${++seq}`

const formVacio = (sentido: SentidoCompromiso): NuevoCompromiso => ({
  sentido,
  tipo: 'Cheque',
  descripcion: null,
  numero: null,
  banco: null,
  contraparte_tipo: sentido === 'cobrar' ? 'cliente' : 'proveedor',
  id_cliente: null,
  id_proveedor: null,
  contraparte_nombre: null,
  dias_aviso: 7,
  observaciones: null
})

function sumarDias(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

function sumarIntervalo(fecha: string, i: number, intervalo: 'mensual' | 'quincenal' | 'semanal'): string {
  if (intervalo !== 'mensual') return sumarDias(fecha, (intervalo === 'quincenal' ? 15 : 7) * i)
  const [y, m, d] = fecha.split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1 + i, 1))
  const ultimo = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate()
  base.setUTCDate(Math.min(d, ultimo))
  return base.toISOString().slice(0, 10)
}

const diaSemana = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay()
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** $1,3 M · $820 k · $950 */
function corto(n: number): string {
  const v = Math.abs(n)
  if (v >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
  if (v >= 10_000) return `$${Math.round(n / 1000).toLocaleString('es-AR')} k`
  return `$${Math.round(n).toLocaleString('es-AR')}`
}

/** "Nombre (#12)" → 12 */
const idDeOpcion = (texto: string): number | null => {
  const m = /\(#(\d+)\)\s*$/.exec(texto)
  return m ? Number(m[1]) : null
}

type Grupo = { id: string; titulo: string; urgencia: Urgencia; filas: FilaAgenda[] }

function agrupar(filas: FilaAgenda[]): Grupo[] {
  const g: Grupo[] = [
    { id: 'vencidos', titulo: 'Vencidos', urgencia: 'vencido', filas: [] },
    { id: 'hoy', titulo: 'Hoy', urgencia: 'hoy', filas: [] },
    { id: 'semana', titulo: 'Próximos 7 días', urgencia: 'urgente', filas: [] },
    { id: 'mes', titulo: 'Próximos 30 días', urgencia: 'proximo', filas: [] },
    { id: 'despues', titulo: 'Más adelante', urgencia: 'tranquilo', filas: [] },
    { id: 'cerrados', titulo: 'Cumplidos y anulados', urgencia: 'cumplido', filas: [] }
  ]
  for (const f of filas) {
    const i = !f.pendiente ? 5 : f.dias < 0 ? 0 : f.dias === 0 ? 1 : f.dias <= 7 ? 2 : f.dias <= 30 ? 3 : 4
    g[i].filas.push(f)
  }
  return g.filter((x) => x.filas.length)
}

export default function ErpCompromisosPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const hoy = getArgentinaDateString()
  const [agenda, setAgenda] = useState<AgendaCargada | null>(null)
  const [clientes, setClientes] = useState<ClienteBasico[] | null>(null)
  const [proveedores, setProveedores] = useState<Proveedor[] | null>(null)
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const [sentidoFiltro, setSentidoFiltro] = useState<'' | SentidoCompromiso>('')
  const [vista, setVista] = useState<'pendientes' | 'cumplidos' | 'todos'>('pendientes')
  const [urgenciaFiltro, setUrgenciaFiltro] = useState<'' | Urgencia>('')
  const [busqueda, setBusqueda] = useState('')
  const [diaFiltro, setDiaFiltro] = useState<{ desde: string; hasta: string } | null>(null)
  const [incluirCheques, setIncluirCheques] = useState(true)
  const [foco, setFoco] = useState<string | null>(params.get('foco'))
  const [hover, setHover] = useState<string | null>(null)

  const [mostrarForm, setMostrarForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<NuevoCompromiso>(() => formVacio('cobrar'))
  const [contraparteTexto, setContraparteTexto] = useState('')
  const [vencs, setVencs] = useState<VencForm[]>([])
  const [gen, setGen] = useState({ cantidad: 1, desde: hoy, importe: 0, intervalo: 'mensual' as 'mensual' | 'quincenal' | 'semanal' })
  const [guardando, setGuardando] = useState(false)

  const [cfgAvisos, setCfgAvisos] = useState<ConfigAvisos>(leerConfigAvisos)
  const [permiso, setPermiso] = useState<NotificationPermission | 'no'>(() => (navegadorSoportaAvisos() ? Notification.permission : 'no'))
  const [verAjustesAvisos, setVerAjustesAvisos] = useState(false)
  const listaRef = useRef<HTMLDivElement>(null)

  const cargar = async () => {
    setCargando(true)
    const r = await cargarAgenda()
    if (r.ok) setAgenda(r.data)
    else setMsg({ tipo: 'error', texto: r.error })
    setCargando(false)
  }

  useEffect(() => {
    void cargar()
  }, [])

  // Al tocar una notificación se llega con ?foco=<clave>: resaltar y llevar a la vista.
  useEffect(() => {
    const f = params.get('foco')
    if (f) {
      setFoco(f)
      setVista('todos')
      setUrgenciaFiltro('')
      setDiaFiltro(null)
      setBusqueda('')
    }
  }, [params])

  useEffect(() => {
    if (!foco || cargando) return
    const el = document.getElementById(`cmp-fila-${foco}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = window.setTimeout(() => {
      setFoco(null)
      if (params.get('foco')) setParams({}, { replace: true })
    }, 4000)
    return () => window.clearTimeout(t)
  }, [foco, cargando, params, setParams])

  const filas = useMemo(
    () => (agenda ? armarFilas(agenda.compromisos, agenda.cheques, agenda.nombres, hoy, incluirCheques) : []),
    [agenda, hoy, incluirCheques]
  )

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return filas.filter((f) => {
      if (sentidoFiltro && f.sentido !== sentidoFiltro) return false
      if (vista === 'pendientes' && !f.pendiente) return false
      if (vista === 'cumplidos' && f.pendiente) return false
      if (urgenciaFiltro && f.urgencia !== urgenciaFiltro) return false
      if (diaFiltro && (f.fecha < diaFiltro.desde || f.fecha > diaFiltro.hasta)) return false
      if (q && ![f.contraparte, f.numero, f.banco, f.descripcion, f.tipo].some((x) => x?.toLowerCase().includes(q))) return false
      return true
    })
  }, [filas, sentidoFiltro, vista, urgenciaFiltro, diaFiltro, busqueda])

  const grupos = useMemo(() => agrupar(visibles), [visibles])
  const insights = useMemo(() => calcularInsights(filas, hoy), [filas, hoy])
  const semanas = useMemo(() => proyeccionSemanal(filas, hoy, 8), [filas, hoy])

  const resumen = useMemo(() => {
    const pend = filas.filter((f) => f.pendiente)
    const suma = (l: FilaAgenda[]) => l.reduce((s, f) => s + f.importe, 0)
    const en30 = pend.filter((f) => f.dias <= 30)
    const vencidos = pend.filter((f) => f.dias < 0)
    const deHoy = pend.filter((f) => f.dias === 0)
    const pronto = pend.filter((f) => f.dias > 0 && f.dias <= f.diasAviso)
    const cobrar30 = suma(en30.filter((f) => f.sentido === 'cobrar'))
    const pagar30 = suma(en30.filter((f) => f.sentido === 'pagar'))
    return { vencidos, deHoy, pronto, cobrar30, pagar30, saldo30: cobrar30 - pagar30, suma }
  }, [filas])

  // Línea de tiempo: vencidos + próximos 30 días.
  const linea = useMemo(() => {
    const pend = filas.filter((f) => f.pendiente)
    const dias = Array.from({ length: DIAS_LINEA }, (_, i) => {
      const fecha = sumarDias(hoy, i)
      const de = pend.filter((f) => f.fecha === fecha)
      return {
        fecha,
        cobrar: de.filter((f) => f.sentido === 'cobrar').reduce((s, f) => s + f.importe, 0),
        pagar: de.filter((f) => f.sentido === 'pagar').reduce((s, f) => s + f.importe, 0),
        filas: de
      }
    })
    const venc = pend.filter((f) => f.dias < 0)
    const vencidos = {
      cobrar: venc.filter((f) => f.sentido === 'cobrar').reduce((s, f) => s + f.importe, 0),
      pagar: venc.filter((f) => f.sentido === 'pagar').reduce((s, f) => s + f.importe, 0),
      filas: venc
    }
    const max = Math.max(1, vencidos.cobrar, vencidos.pagar, ...dias.flatMap((d) => [d.cobrar, d.pagar]))
    return { dias, vencidos, max }
  }, [filas, hoy])

  const maxSemana = Math.max(1, ...semanas.flatMap((s) => [s.cobrar, s.pagar]))

  // ---------------------------------------------------------------- avisos del navegador
  const activarAvisos = async () => {
    if (!navegadorSoportaAvisos()) return
    const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    setPermiso(p)
    if (p !== 'granted') {
      setMsg({ tipo: 'error', texto: 'El navegador bloqueó los avisos. Habilitalos desde el candado de la barra de direcciones.' })
      return
    }
    const c = { ...cfgAvisos, activo: true }
    reiniciarAvisados()
    guardarConfigAvisos(c)
    setCfgAvisos(c)
    await avisoDePrueba(navigate)
    setMsg({ tipo: 'ok', texto: 'Avisos activados en este navegador. Te avisamos aunque estés en otra pantalla de Plot Lab.' })
  }

  const cambiarCfg = (cambios: Partial<ConfigAvisos>) => {
    const c = { ...cfgAvisos, ...cambios }
    guardarConfigAvisos(c)
    setCfgAvisos(c)
  }

  const avisosActivos = cfgAvisos.activo && permiso === 'granted'
  const avisarCambio = () => window.dispatchEvent(new Event(EVENTO_CAMBIO))

  // ---------------------------------------------------------------- formulario
  const setF = <K extends keyof NuevoCompromiso>(k: K, v: NuevoCompromiso[K]) => setForm((f) => ({ ...f, [k]: v }))

  const asegurarListas = () => {
    if (clientes === null) void listClientesBasicos().then((r) => setClientes(r.success ? r.data : []))
    if (proveedores === null) void listProveedoresBasicos().then((r) => setProveedores(r.success ? r.data : []))
  }

  const opcionesContraparte = useMemo(() => {
    if (form.contraparte_tipo === 'cliente')
      return (clientes ?? []).map((c) => `${nombreCliente(c, c.id)}${c.dni_cuit ? ` · ${c.dni_cuit}` : ''} (#${c.id})`)
    if (form.contraparte_tipo === 'proveedor')
      return (proveedores ?? []).map((p) => `${nombreProveedor(p)}${p.cuit ? ` · ${p.cuit}` : ''} (#${p.id})`)
    return []
  }, [form.contraparte_tipo, clientes, proveedores])

  const abrirNuevo = () => {
    asegurarListas()
    const s = sentidoFiltro || 'cobrar'
    setEditId(null)
    setForm(formVacio(s))
    setContraparteTexto('')
    setVencs([{ key: nuevaKey(), fecha: hoy, importe: 0, numero_cheque: null }])
    setGen({ cantidad: 1, desde: hoy, importe: 0, intervalo: 'mensual' })
    setMostrarForm(true)
    setMsg(null)
  }

  const abrirEdicion = (c: CompromisoConVencimientos, contraparte: string) => {
    asegurarListas()
    const { id: _id, created_at: _c, vencimientos, ...resto } = c
    setEditId(c.id)
    setForm(resto)
    setContraparteTexto(
      c.contraparte_tipo === 'cliente' && c.id_cliente
        ? `${contraparte} (#${c.id_cliente})`
        : c.contraparte_tipo === 'proveedor' && c.id_proveedor
          ? `${contraparte} (#${c.id_proveedor})`
          : ''
    )
    setVencs(vencimientos.map((v) => ({ key: nuevaKey(), id: v.id, fecha: v.fecha, importe: v.importe, numero_cheque: v.numero_cheque, estado: v.estado })))
    setMostrarForm(true)
    setMsg(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cambiarContraparteTexto = (texto: string) => {
    setContraparteTexto(texto)
    const id = idDeOpcion(texto)
    if (form.contraparte_tipo === 'cliente') setF('id_cliente', id)
    else if (form.contraparte_tipo === 'proveedor') setF('id_proveedor', id)
  }

  const setVenc = (key: string, cambios: Partial<VencForm>) => setVencs((l) => l.map((v) => (v.key === key ? { ...v, ...cambios } : v)))

  const generarCuotas = () => {
    const n = Math.max(1, Math.min(120, Math.floor(gen.cantidad || 1)))
    if (!(gen.importe > 0)) return setMsg({ tipo: 'error', texto: 'Indicá el importe de cada vencimiento para generarlos.' })
    const nuevos: VencForm[] = Array.from({ length: n }, (_, i) => ({
      key: nuevaKey(),
      fecha: sumarIntervalo(gen.desde, i, gen.intervalo),
      importe: gen.importe,
      numero_cheque: null
    }))
    setVencs((l) => [...l.filter((v) => v.importe > 0), ...nuevos])
    setMsg(null)
  }

  const totalForm = vencs.reduce((s, v) => s + (v.importe || 0), 0)

  const guardar = async () => {
    setMsg(null)
    setGuardando(true)
    const lista = vencs.map(({ id, fecha, importe, numero_cheque }) => ({ id, fecha, importe, numero_cheque }))
    const r = editId ? await actualizarCompromiso(editId, form, lista) : await crearCompromiso(form, lista)
    setGuardando(false)
    if (!r.success) return setMsg({ tipo: 'error', texto: r.error })
    setMsg({ tipo: 'ok', texto: editId ? 'Compromiso actualizado.' : 'Compromiso registrado.' })
    setMostrarForm(false)
    setEditId(null)
    await cargar()
    avisarCambio()
  }

  const eliminar = async (f: FilaAgenda) => {
    const c = f.compromiso
    if (!c) return
    const n = c.vencimientos.length
    if (!window.confirm(`¿Eliminar el compromiso con ${f.contraparte} y sus ${n} vencimiento${n === 1 ? '' : 's'}? No se puede deshacer.`)) return
    const r = await eliminarCompromiso(c.id)
    if (!r.success) return setMsg({ tipo: 'error', texto: r.error })
    setMsg({ tipo: 'ok', texto: 'Compromiso eliminado.' })
    if (editId === c.id) setMostrarForm(false)
    await cargar()
    avisarCambio()
  }

  const marcar = async (f: FilaAgenda, estado: EstadoVencimiento) => {
    if (!f.venc) return
    const r = await cambiarEstadoVencimiento(f.venc.id, estado, hoy)
    if (!r.success) return setMsg({ tipo: 'error', texto: r.error })
    setMsg({
      tipo: 'ok',
      texto:
        estado === 'Cumplido'
          ? `${f.contraparte}: marcado como ${f.sentido === 'cobrar' ? 'cobrado' : 'pagado'} ✓`
          : estado === 'Anulado'
            ? 'Vencimiento anulado.'
            : 'Vuelve a pendiente.'
    })
    await cargar()
    avisarCambio()
  }

  const aplicarInsight = (i: Insight) => {
    if (!i.filtro) return
    setVista('pendientes')
    setUrgenciaFiltro('')
    if (i.filtro.texto) {
      setBusqueda(i.filtro.texto)
      setDiaFiltro(null)
    }
    if (i.filtro.dia) {
      setDiaFiltro({ desde: i.filtro.dia, hasta: i.filtro.hasta ?? i.filtro.dia })
      setBusqueda('')
    }
    listaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const filtrarDia = (desde: string, hasta = desde) => {
    setDiaFiltro((d) => (d && d.desde === desde && d.hasta === hasta ? null : { desde, hasta }))
    setVista('pendientes')
    setUrgenciaFiltro('')
  }

  const exportar = () =>
    descargarCsv(
      `compromisos_${hoy}.csv`,
      ['Vence', 'Sentido', 'Tipo', 'Número', 'Banco', 'Contraparte', 'Cuota', 'Importe', 'Estado', 'Semáforo', 'Detalle'],
      visibles.map((f) => [
        fmtFecha(f.fecha),
        f.sentido === 'cobrar' ? 'A cobrar' : 'A pagar',
        f.tipo,
        f.numero,
        f.banco,
        f.contraparte,
        f.cuota,
        f.importe,
        f.estado,
        URGENCIA_INFO[f.urgencia].label,
        f.descripcion
      ])
    )

  const estadoGeneral: Urgencia = resumen.vencidos.length
    ? 'vencido'
    : resumen.deHoy.length
      ? 'hoy'
      : resumen.pronto.length
        ? 'proximo'
        : 'tranquilo'
  const titularEstado = resumen.vencidos.length
    ? `${resumen.vencidos.length} vencido${resumen.vencidos.length > 1 ? 's' : ''}`
    : resumen.deHoy.length
      ? `${resumen.deHoy.length} vence${resumen.deHoy.length > 1 ? 'n' : ''} hoy`
      : resumen.pronto.length
        ? `${resumen.pronto.length} por vencer`
        : 'Todo al día'
  const bajadaEstado = resumen.vencidos.length
    ? `${fmtMoney(resumen.suma(resumen.vencidos))} sin resolver`
    : resumen.deHoy.length
      ? fmtMoney(resumen.suma(resumen.deHoy))
      : resumen.pronto.length
        ? `${fmtMoney(resumen.suma(resumen.pronto))} dentro del aviso`
        : 'Sin vencimientos urgentes'

  const hayFiltros = Boolean(sentidoFiltro || urgenciaFiltro || busqueda || diaFiltro || vista !== 'pendientes')

  return (
    <div className="erp-section cmp">
      <ErpPageHeader
        icon="📅"
        titulo="Compromisos financieros"
        subtitulo="Cheques, pagarés, préstamos y planes de pago con clientes y proveedores."
        volverA="/erp"
        volverTexto="ERP"
      >
        <button type="button" className="btn-secondary" onClick={exportar} disabled={visibles.length === 0}>
          Exportar CSV
        </button>
        <button type="button" className="btn-primary" onClick={() => (mostrarForm ? setMostrarForm(false) : abrirNuevo())}>
          {mostrarForm ? 'Cancelar' : '+ Nuevo compromiso'}
        </button>
      </ErpPageHeader>

      {msg && <p className={`erpx-msg erpx-msg--${msg.tipo}`}>{msg.texto}</p>}

      {/* ------------------------------------------------------------ hero */}
      <section className="cmp-hero">
        <button
          type="button"
          className={`cmp-hero__estado cmp-u--${estadoGeneral}`}
          onClick={() => {
            if (estadoGeneral === 'tranquilo') return
            setVista('pendientes')
            setDiaFiltro(null)
            setUrgenciaFiltro(estadoGeneral === 'proximo' ? '' : estadoGeneral)
            listaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        >
          <span className="cmp-hero__semaforo" aria-hidden>
            <span />
          </span>
          <span>
            <span className="cmp-hero__titular">{cargando ? 'Cargando…' : titularEstado}</span>
            <span className="cmp-hero__bajada">{cargando ? '' : bajadaEstado}</span>
          </span>
        </button>

        <div className="cmp-hero__cifras">
          <div className="cmp-cifra">
            <span className="cmp-cifra__label">Entra · 30 días</span>
            <span className="cmp-cifra__valor">
              <span className="cmp-flecha cmp-flecha--cobrar" aria-hidden>
                ▲
              </span>
              {fmtMoney(resumen.cobrar30)}
            </span>
          </div>
          <div className="cmp-cifra">
            <span className="cmp-cifra__label">Sale · 30 días</span>
            <span className="cmp-cifra__valor">
              <span className="cmp-flecha cmp-flecha--pagar" aria-hidden>
                ▼
              </span>
              {fmtMoney(resumen.pagar30)}
            </span>
          </div>
          <div className="cmp-cifra cmp-cifra--saldo">
            <span className="cmp-cifra__label">Saldo proyectado</span>
            <span className={`cmp-cifra__valor ${resumen.saldo30 < 0 ? 'is-neg' : 'is-pos'}`}>{fmtMoney(resumen.saldo30)}</span>
          </div>
        </div>

        <div className={`cmp-avisos ${avisosActivos ? 'is-on' : ''}`}>
          <div className="cmp-avisos__fila">
            <span className="cmp-avisos__icono" aria-hidden>
              {avisosActivos ? '🔔' : '🔕'}
            </span>
            <div>
              <div className="cmp-avisos__titulo">{avisosActivos ? 'Avisos activos' : 'Avisos del navegador'}</div>
              <div className="cmp-avisos__texto">
                {permiso === 'no'
                  ? 'Este navegador no admite notificaciones.'
                  : permiso === 'denied'
                    ? 'Bloqueados: habilitalos desde el candado de la barra de direcciones.'
                    : avisosActivos
                      ? `Silencio de ${cfgAvisos.silencioDesde} a ${cfgAvisos.silencioHasta} h`
                      : 'Te avisamos aunque estés en otra pantalla.'}
              </div>
            </div>
          </div>
          {permiso !== 'no' && permiso !== 'denied' && (
            <div className="cmp-avisos__acciones">
              {avisosActivos ? (
                <button type="button" className="erpx-btn-sm" onClick={() => setVerAjustesAvisos((v) => !v)}>
                  {verAjustesAvisos ? 'Cerrar' : 'Ajustes'}
                </button>
              ) : (
                <button type="button" className="btn-primary cmp-avisos__activar" onClick={() => void activarAvisos()}>
                  Activar avisos
                </button>
              )}
            </div>
          )}
          {verAjustesAvisos && avisosActivos && (
            <div className="cmp-avisos__ajustes">
              <label>
                Silencio desde
                <select value={cfgAvisos.silencioDesde} onChange={(e) => cambiarCfg({ silencioDesde: Number(e.target.value) })}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {h} h
                    </option>
                  ))}
                </select>
              </label>
              <label>
                hasta
                <select value={cfgAvisos.silencioHasta} onChange={(e) => cambiarCfg({ silencioHasta: Number(e.target.value) })}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {h} h
                    </option>
                  ))}
                </select>
              </label>
              <div className="cmp-avisos__botones">
                <button type="button" className="erpx-btn-sm" onClick={() => void avisoDePrueba(navigate)}>
                  Probar
                </button>
                <button
                  type="button"
                  className="erpx-btn-sm"
                  onClick={() => {
                    reiniciarAvisados()
                    avisarCambio()
                    setMsg({ tipo: 'ok', texto: 'Listo: se vuelve a avisar de todo lo pendiente.' })
                  }}
                >
                  Avisar todo de nuevo
                </button>
                <button
                  type="button"
                  className="erpx-btn-sm"
                  onClick={() => {
                    cambiarCfg({ activo: false })
                    setVerAjustesAvisos(false)
                  }}
                >
                  Desactivar
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------ insights */}
      {!cargando && (
        <section className="cmp-insights" aria-label="Recomendaciones">
          {insights.map((i, n) => (
            <button
              key={n}
              type="button"
              className={`cmp-insight cmp-insight--${i.tono} ${i.filtro ? 'is-link' : ''}`}
              onClick={() => aplicarInsight(i)}
              disabled={!i.filtro}
            >
              <span className="cmp-insight__icono" aria-hidden>
                {i.icono}
              </span>
              <span>
                <span className="cmp-insight__titulo">{i.titulo}</span>
                <span className="cmp-insight__detalle">{i.detalle}</span>
              </span>
            </button>
          ))}
        </section>
      )}

      {/* ------------------------------------------------------------ línea de tiempo */}
      {!cargando && filas.some((f) => f.pendiente) && (
        <section className="erp-panel cmp-linea">
          <div className="cmp-linea__cabecera">
            <h2>Próximos {DIAS_LINEA} días</h2>
            <div className="cmp-leyenda-mini">
              <span>
                <i className="cmp-sw cmp-sw--cobrar" /> A cobrar
              </span>
              <span>
                <i className="cmp-sw cmp-sw--pagar" /> A pagar
              </span>
              <span className="erp-muted">Tocá un día para filtrar</span>
            </div>
          </div>
          <div className="cmp-linea__grilla" role="list">
            {(linea.vencidos.filas.length > 0 ? [{ fecha: 'vencidos', ...linea.vencidos }] : []).concat(linea.dias).map((d) => {
              const esVencidos = d.fecha === 'vencidos'
              const activo = esVencidos ? diaFiltro?.desde === '0000-01-01' : diaFiltro?.desde === d.fecha && diaFiltro.hasta === d.fecha
              const dow = esVencidos ? -1 : diaSemana(d.fecha)
              const peor = d.filas.reduce<Urgencia | null>((p, f) => (p === null || ORDEN_URGENCIA.indexOf(f.urgencia) < ORDEN_URGENCIA.indexOf(p) ? f.urgencia : p), null)
              const tip = esVencidos
                ? `Vencidos · cobrar ${fmtMoney(d.cobrar)} · pagar ${fmtMoney(d.pagar)}`
                : `${fmtFecha(d.fecha)} · ${d.filas.length ? `cobrar ${fmtMoney(d.cobrar)} · pagar ${fmtMoney(d.pagar)}` : 'sin vencimientos'}`
              return (
                <button
                  key={d.fecha}
                  type="button"
                  role="listitem"
                  className={[
                    'cmp-dia',
                    esVencidos ? 'cmp-dia--vencidos' : '',
                    d.fecha === hoy ? 'is-hoy' : '',
                    dow === 0 || dow === 6 ? 'is-finde' : '',
                    activo ? 'is-activo' : '',
                    d.filas.length ? 'has-items' : '',
                    peor ? `cmp-u--${peor}` : ''
                  ].join(' ')}
                  onClick={() => (esVencidos ? filtrarDia('0000-01-01', sumarDias(hoy, -1)) : d.filas.length && filtrarDia(d.fecha))}
                  onMouseEnter={() => setHover(d.fecha)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(d.fecha)}
                  onBlur={() => setHover(null)}
                  aria-label={tip}
                >
                  <span className="cmp-dia__barras">
                    <span className="cmp-dia__mitad cmp-dia__mitad--arriba">
                      {d.cobrar > 0 && <span className="cmp-barra cmp-barra--cobrar" style={{ height: `${Math.max(8, (d.cobrar / linea.max) * 100)}%` }} />}
                    </span>
                    <span className="cmp-dia__mitad cmp-dia__mitad--abajo">
                      {d.pagar > 0 && <span className="cmp-barra cmp-barra--pagar" style={{ height: `${Math.max(8, (d.pagar / linea.max) * 100)}%` }} />}
                    </span>
                  </span>
                  <span className="cmp-dia__pie">
                    {esVencidos ? (
                      <span className="cmp-dia__num">⚠</span>
                    ) : (
                      <>
                        <span className="cmp-dia__dow">{DIAS_SEMANA[dow]}</span>
                        <span className="cmp-dia__num">{Number(d.fecha.slice(8, 10))}</span>
                      </>
                    )}
                    {d.filas.length > 0 && <span className="cmp-dia__punto" aria-hidden />}
                  </span>
                  {hover === d.fecha && d.filas.length > 0 && (
                    <span className="cmp-tip" role="tooltip">
                      <strong>{esVencidos ? 'Vencidos' : `${fmtFecha(d.fecha)} · ${textoDias(d.fecha, hoy)}`}</strong>
                      {d.filas.slice(0, 5).map((f) => (
                        <span key={f.key} className="cmp-tip__fila">
                          <i className={`cmp-sw cmp-sw--${f.sentido}`} />
                          <span className="cmp-tip__quien">{f.contraparte}</span>
                          <span>{corto(f.importe)}</span>
                        </span>
                      ))}
                      {d.filas.length > 5 && <span className="erp-muted">y {d.filas.length - 5} más</span>}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------ proyección semanal */}
      {!cargando && semanas.some((s) => s.cobrar || s.pagar) && (
        <section className="erp-panel cmp-semanas">
          <div className="cmp-linea__cabecera">
            <h2>Flujo por semana</h2>
            <span className="erp-muted">La semana actual incluye lo vencido sin resolver.</span>
          </div>
          <div className="cmp-semanas__tabla" role="table">
            <div className="cmp-semana cmp-semana--cab" role="row">
              <span role="columnheader">Semana</span>
              <span role="columnheader">Entra / sale</span>
              <span role="columnheader" className="erpx-right">
                Neto
              </span>
              <span role="columnheader" className="erpx-right">
                Acumulado
              </span>
            </div>
            {semanas.map((s, i) => (
              <button
                key={s.desde}
                type="button"
                role="row"
                className={`cmp-semana ${s.neto < 0 ? 'is-neg' : ''} ${diaFiltro?.desde === s.desde && diaFiltro.hasta === s.hasta ? 'is-activo' : ''}`}
                onClick={() => (i === 0 ? filtrarDia('0000-01-01', s.hasta) : filtrarDia(s.desde, s.hasta))}
                title={`Cobrar ${fmtMoney(s.cobrar)} · Pagar ${fmtMoney(s.pagar)}`}
              >
                <span role="cell" className="cmp-semana__label">
                  {i === 0 ? 'Esta semana' : i === 1 ? 'Próxima' : `${ddmm(s.desde)} – ${ddmm(s.hasta)}`}
                </span>
                <span role="cell" className="cmp-semana__barras">
                  <span className="cmp-hbarra cmp-hbarra--cobrar" style={{ width: `${(s.cobrar / maxSemana) * 100}%` }}>
                    {s.cobrar > 0 && <em>{corto(s.cobrar)}</em>}
                  </span>
                  <span className="cmp-hbarra cmp-hbarra--pagar" style={{ width: `${(s.pagar / maxSemana) * 100}%` }}>
                    {s.pagar > 0 && <em>{corto(s.pagar)}</em>}
                  </span>
                </span>
                <span role="cell" className={`erpx-right cmp-semana__neto ${s.neto < 0 ? 'is-neg' : s.neto > 0 ? 'is-pos' : ''}`}>
                  {s.neto === 0 ? '—' : `${s.neto > 0 ? '+' : ''}${corto(s.neto)}`}
                </span>
                <span role="cell" className={`erpx-right cmp-semana__acum ${s.acumulado < 0 ? 'is-neg' : ''}`}>
                  {corto(s.acumulado)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------ formulario */}
      {mostrarForm && (
        <div className="erp-panel cmp-form">
          <h2>{editId ? 'Editar compromiso' : 'Nuevo compromiso'}</h2>

          <div className="cmp-sentido-switch" role="radiogroup" aria-label="Sentido">
            {(['cobrar', 'pagar'] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={form.sentido === s}
                className={`cmp-sentido-op cmp-sentido-op--${s} ${form.sentido === s ? 'is-on' : ''}`}
                onClick={() => {
                  setForm((f) => ({
                    ...f,
                    sentido: s,
                    contraparte_tipo: f.contraparte_tipo === 'otro' ? 'otro' : s === 'cobrar' ? 'cliente' : 'proveedor',
                    id_cliente: null,
                    id_proveedor: null
                  }))
                  setContraparteTexto('')
                }}
              >
                <strong>{s === 'cobrar' ? '▲ A cobrar' : '▼ A pagar'}</strong>
                <span>{s === 'cobrar' ? 'Nos lo dan (cliente, préstamo recibido…)' : 'Lo entregamos (proveedor, cuota, préstamo…)'}</span>
              </button>
            ))}
          </div>

          <div className="cmp-chips" role="radiogroup" aria-label="Tipo">
            {TIPOS_COMPROMISO.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={form.tipo === t} className={`cmp-chip ${form.tipo === t ? 'is-on' : ''}`} onClick={() => setF('tipo', t)}>
                {t}
              </button>
            ))}
          </div>

          <div className="erpx-form">
            <label className="erp-field">
              <span className="erp-field__label">Con</span>
              <select
                value={form.contraparte_tipo}
                onChange={(e) => {
                  setForm((f) => ({ ...f, contraparte_tipo: e.target.value as NuevoCompromiso['contraparte_tipo'], id_cliente: null, id_proveedor: null }))
                  setContraparteTexto('')
                }}
              >
                <option value="cliente">Cliente</option>
                <option value="proveedor">Proveedor</option>
                <option value="otro">Otro (banco, persona…)</option>
              </select>
            </label>
            {form.contraparte_tipo === 'otro' ? (
              <label className="erp-field">
                <span className="erp-field__label">Nombre</span>
                <input value={form.contraparte_nombre ?? ''} onChange={(e) => setF('contraparte_nombre', e.target.value)} placeholder="Banco Nación, Juan Pérez…" />
              </label>
            ) : (
              <label className="erp-field">
                <span className="erp-field__label">{form.contraparte_tipo === 'cliente' ? 'Cliente' : 'Proveedor'}</span>
                <input
                  list="cmp-contrapartes"
                  value={contraparteTexto}
                  onChange={(e) => cambiarContraparteTexto(e.target.value)}
                  placeholder={(form.contraparte_tipo === 'cliente' ? clientes : proveedores) === null ? 'Cargando lista…' : 'Escribí nombre o CUIT…'}
                  className={contraparteTexto && !idDeOpcion(contraparteTexto) ? 'cmp-input-invalido' : ''}
                />
                <datalist id="cmp-contrapartes">
                  {opcionesContraparte.map((o) => (
                    <option key={o} value={o} />
                  ))}
                </datalist>
              </label>
            )}
            <label className="erp-field">
              <span className="erp-field__label">Número</span>
              <input value={form.numero ?? ''} onChange={(e) => setF('numero', e.target.value)} placeholder="Cheque, pagaré, préstamo" />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Banco / entidad</span>
              <input value={form.banco ?? ''} onChange={(e) => setF('banco', e.target.value)} />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Avisar con · {form.dias_aviso} días de anticipación</span>
              <input type="range" min={1} max={30} value={form.dias_aviso} onChange={(e) => setF('dias_aviso', Number(e.target.value))} />
            </label>
            <label className="erp-field erp-field--wide">
              <span className="erp-field__label">Descripción</span>
              <input value={form.descripcion ?? ''} onChange={(e) => setF('descripcion', e.target.value)} placeholder="Ej.: pago factura A 0001-00001234, préstamo para la impresora…" />
            </label>
            <label className="erp-field erp-field--wide">
              <span className="erp-field__label">Observaciones</span>
              <input value={form.observaciones ?? ''} onChange={(e) => setF('observaciones', e.target.value)} />
            </label>
          </div>

          <h3 className="cmp-subtitulo">Vencimientos</h3>
          <div className="cmp-generador">
            <span className="erp-muted">Generar</span>
            <input type="number" min={1} max={120} value={gen.cantidad} onChange={(e) => setGen((g) => ({ ...g, cantidad: Number(e.target.value) || 1 }))} aria-label="Cantidad de vencimientos" className="cmp-gen-n" />
            <span className="erp-muted">vencimientos de</span>
            <input type="number" min={0} step="0.01" value={gen.importe || ''} onChange={(e) => setGen((g) => ({ ...g, importe: Number(e.target.value) || 0 }))} placeholder="Importe c/u" aria-label="Importe de cada vencimiento" />
            <span className="erp-muted">desde</span>
            <input type="date" value={gen.desde} onChange={(e) => setGen((g) => ({ ...g, desde: e.target.value }))} aria-label="Primer vencimiento" />
            <select value={gen.intervalo} onChange={(e) => setGen((g) => ({ ...g, intervalo: e.target.value as typeof g.intervalo }))} aria-label="Frecuencia">
              <option value="mensual">mensuales</option>
              <option value="quincenal">cada 15 días</option>
              <option value="semanal">semanales</option>
            </select>
            <button type="button" className="erpx-btn-sm" onClick={generarCuotas}>
              Generar
            </button>
          </div>

          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Fecha</th>
                  <th className="erpx-right">Importe</th>
                  <th>N° de cheque (si cada cuota es un cheque)</th>
                  <th>Semáforo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {vencs.map((v, i) => {
                  const u = urgenciaDe(v.fecha, hoy, form.dias_aviso, (v.estado ?? 'Pendiente') === 'Pendiente')
                  return (
                    <tr key={v.key} className={`cmp-row cmp-u--${u}`}>
                      <td>{i + 1}</td>
                      <td>
                        <input type="date" value={v.fecha} onChange={(e) => setVenc(v.key, { fecha: e.target.value })} />
                      </td>
                      <td className="erpx-right">
                        <input type="number" min={0} step="0.01" value={v.importe || ''} onChange={(e) => setVenc(v.key, { importe: Number(e.target.value) || 0 })} className="cmp-input-importe" />
                      </td>
                      <td>
                        <input value={v.numero_cheque ?? ''} onChange={(e) => setVenc(v.key, { numero_cheque: e.target.value })} />
                      </td>
                      <td>
                        <span className={`cmp-pill cmp-u--${u}`}>
                          {v.estado && v.estado !== 'Pendiente' ? v.estado : `${URGENCIA_INFO[u].label} · ${textoDias(v.fecha, hoy)}`}
                        </span>
                      </td>
                      <td>
                        <button type="button" className="erpx-btn-sm" onClick={() => setVencs((l) => l.filter((x) => x.key !== v.key))} disabled={vencs.length === 1}>
                          Quitar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>
                    <button
                      type="button"
                      className="erpx-btn-sm"
                      onClick={() => {
                        const ultima = vencs[vencs.length - 1]
                        setVencs((l) => [
                          ...l,
                          { key: nuevaKey(), fecha: ultima ? sumarIntervalo(ultima.fecha, 1, 'mensual') : hoy, importe: ultima?.importe ?? 0, numero_cheque: null }
                        ])
                      }}
                    >
                      + Agregar vencimiento
                    </button>
                  </td>
                  <td className="erpx-right">
                    <strong>{fmtMoney(totalForm)}</strong>
                  </td>
                  <td colSpan={3} className="erp-muted">
                    Total del compromiso
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="erpx-actions">
            <button type="button" className="btn-primary" onClick={() => void guardar()} disabled={guardando}>
              {guardando ? 'Guardando…' : editId ? 'Guardar cambios' : 'Guardar compromiso'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setMostrarForm(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ filtros */}
      <div ref={listaRef} className="cmp-filtros">
        <div className="erpx-tabs">
          {(
            [
              ['', 'Todos'],
              ['cobrar', '▲ A cobrar'],
              ['pagar', '▼ A pagar']
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" className={`erpx-tab ${sentidoFiltro === v ? 'is-active' : ''}`} onClick={() => setSentidoFiltro(v)}>
              {label}
            </button>
          ))}
        </div>
        <div className="cmp-filtros__controles">
          <input className="cmp-buscar" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="🔍 Cliente, proveedor, N°, banco…" aria-label="Buscar" />
          <select value={vista} onChange={(e) => setVista(e.target.value as typeof vista)} aria-label="Mostrar">
            <option value="pendientes">Pendientes</option>
            <option value="cumplidos">Cumplidos / anulados</option>
            <option value="todos">Todos</option>
          </select>
          <select value={urgenciaFiltro} onChange={(e) => setUrgenciaFiltro(e.target.value as '' | Urgencia)} aria-label="Semáforo">
            <option value="">Todo el semáforo</option>
            {ORDEN_URGENCIA.map((u) => (
              <option key={u} value={u}>
                {URGENCIA_INFO[u].label}
              </option>
            ))}
          </select>
          <label className="cmp-check">
            <input type="checkbox" checked={incluirCheques} onChange={(e) => setIncluirCheques(e.target.checked)} />
            Cheques de Tesorería
          </label>
        </div>
        {hayFiltros && (
          <div className="cmp-filtros__activos">
            {diaFiltro && (
              <span className="cmp-chip is-on">
                {diaFiltro.desde === '0000-01-01'
                  ? `Hasta el ${ddmm(diaFiltro.hasta)} (incluye vencidos)`
                  : diaFiltro.desde === diaFiltro.hasta
                    ? `Día ${ddmm(diaFiltro.desde)}`
                    : `${ddmm(diaFiltro.desde)} – ${ddmm(diaFiltro.hasta)}`}
              </span>
            )}
            <button
              type="button"
              className="erpx-btn-sm"
              onClick={() => {
                setSentidoFiltro('')
                setUrgenciaFiltro('')
                setBusqueda('')
                setDiaFiltro(null)
                setVista('pendientes')
              }}
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------ lista agrupada */}
      {cargando ? (
        <div className="erp-panel">
          <p className="erp-muted">Cargando…</p>
        </div>
      ) : visibles.length === 0 ? (
        <div className="erp-panel cmp-vacio">
          {filas.length === 0 ? (
            <>
              <div className="cmp-vacio__icono">📅</div>
              <h3>Todavía no hay compromisos</h3>
              <p className="erp-muted">Cargá un cheque, pagaré o préstamo con sus vencimientos y te avisamos antes de que venzan.</p>
              <button type="button" className="btn-primary" onClick={abrirNuevo}>
                + Nuevo compromiso
              </button>
            </>
          ) : (
            <p className="erp-muted">No hay vencimientos con esos filtros.</p>
          )}
        </div>
      ) : (
        grupos.map((g) => {
          const cobrar = g.filas.filter((f) => f.sentido === 'cobrar').reduce((s, f) => s + f.importe, 0)
          const pagar = g.filas.filter((f) => f.sentido === 'pagar').reduce((s, f) => s + f.importe, 0)
          return (
            <section key={g.id} className={`cmp-grupo cmp-u--${g.urgencia}`}>
              <header className="cmp-grupo__cab">
                <h3>
                  <span className="cmp-dot" aria-hidden /> {g.titulo} <span className="cmp-grupo__n">{g.filas.length}</span>
                </h3>
                <span className="cmp-grupo__totales">
                  {cobrar > 0 && <span>▲ {fmtMoney(cobrar)}</span>}
                  {pagar > 0 && <span>▼ {fmtMoney(pagar)}</span>}
                </span>
              </header>
              <div className="cmp-cards">
                {g.filas.map((f) => (
                  <article key={f.key} id={`cmp-fila-${f.key}`} className={`cmp-card cmp-u--${f.urgencia} ${foco === f.key ? 'is-foco' : ''}`}>
                    <div className="cmp-card__fecha">
                      <span className="cmp-card__dia">{f.fecha.slice(8, 10)}</span>
                      <span className="cmp-card__mes">{new Date(`${f.fecha}T12:00:00Z`).toLocaleDateString('es-AR', { month: 'short', timeZone: 'UTC' })}</span>
                      {f.pendiente && <span className="cmp-card__cuenta">{textoDias(f.fecha, hoy)}</span>}
                    </div>
                    <div className="cmp-card__cuerpo">
                      <div className="cmp-card__linea1">
                        <span className={`cmp-sentido cmp-sentido--${f.sentido}`}>{f.sentido === 'cobrar' ? '▲ Cobrar a' : '▼ Pagar a'}</span>
                        <strong className="cmp-card__quien">{f.contraparte}</strong>
                      </div>
                      <div className="cmp-card__linea2">
                        <span className="cmp-tag">{f.tipo}</span>
                        {f.numero && <span>N° {f.numero}</span>}
                        {f.banco && <span>· {f.banco}</span>}
                        {f.cuota && <span className="cmp-tag">Cuota {f.cuota}</span>}
                        {f.origen === 'cheque' && <span className="cmp-tag">Tesorería · {f.estado}</span>}
                        {!f.pendiente && f.venc?.fecha_cumplido && <span>· {f.estado.toLowerCase()} el {fmtFecha(f.venc.fecha_cumplido)}</span>}
                      </div>
                      {f.descripcion && f.origen === 'compromiso' && <div className="cmp-card__desc">{f.descripcion}</div>}
                    </div>
                    <div className="cmp-card__monto">
                      <span className="cmp-card__importe">{fmtMoney(f.importe)}</span>
                      <span className={`cmp-pill cmp-u--${f.urgencia}`}>{f.pendiente ? URGENCIA_INFO[f.urgencia].label : f.estado}</span>
                    </div>
                    <div className="cmp-card__acciones">
                      {f.origen === 'cheque' ? (
                        <button type="button" className="erpx-btn-sm" onClick={() => navigate('/erp/tesoreria/cheques')}>
                          Ver en Tesorería
                        </button>
                      ) : f.pendiente ? (
                        <>
                          <button type="button" className={`cmp-btn-ok cmp-btn-ok--${f.sentido}`} onClick={() => void marcar(f, 'Cumplido')}>
                            ✓ {f.sentido === 'cobrar' ? 'Cobrado' : 'Pagado'}
                          </button>
                          <details className="cmp-menu">
                            <summary aria-label="Más acciones">⋯</summary>
                            <div className="cmp-menu__lista">
                              <button type="button" onClick={() => f.compromiso && abrirEdicion(f.compromiso, f.contraparte)}>
                                Editar
                              </button>
                              <button type="button" onClick={() => void marcar(f, 'Anulado')}>
                                Anular vencimiento
                              </button>
                              <button type="button" className="is-peligro" onClick={() => void eliminar(f)}>
                                Eliminar compromiso
                              </button>
                            </div>
                          </details>
                        </>
                      ) : (
                        <button type="button" className="erpx-btn-sm" onClick={() => void marcar(f, 'Pendiente')}>
                          Deshacer
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
