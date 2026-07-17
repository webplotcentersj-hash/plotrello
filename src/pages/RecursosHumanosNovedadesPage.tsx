import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { plotLabFetch } from '../utils/plotLabApiOrigin'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth
} from 'date-fns'
import { es } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import { downloadRrhhNovedadesListadoPdf } from '../utils/rrhhNovedadesExportPdf'
import apiService from '../services/api'
import { useAuth } from '../hooks/useAuth'
import type {
  RrhhNovedad,
  RrhhNovedadAdjunto,
  RrhhNovedadGrupo,
  SolicitudPermiso,
  UsuarioRecord
} from '../types/api'
import RrhhNovedadDetailModal from '../components/RrhhNovedadDetailModal'
import {
  RRHH_NOVEDAD_CODIGOS_POR_GRUPO as CODIGOS_POR_GRUPO,
  RRHH_NOVEDAD_GRUPOS as GRUPOS,
  etiquetaCodigoRrhhNovedad as etiquetaCodigo
} from '../utils/rrhhNovedadCatalog'
import { nombreSinDominioCorreo } from '../utils/userDisplayName'
import { dispatchMensajeriaDmUnreadRefresh } from '../hooks/useDmMensajeriaUnread'
import { calcularIndicadoresNovedadesOrganizacion } from '../utils/rrhhNovedadesSectorStats'
import type { LegajoSectorBasico } from '../utils/rrhhNovedadesSectorStats'
import { parseFechaFiltro } from '../utils/rrhhNovedadesLegajoStats'
import {
  etiquetaCortaChipCalendario,
  novedadVisibleEnCalendarioDia,
  ordenarNovedadesCalendario
} from '../utils/rrhhNovedadDates'
import { filtrarUsuariosRrhhOperarios, idsUsuariosGenericosRrhh } from '../utils/rrhhUsuariosExcluidos'
import './RecursosHumanosNovedadesPage.css'

type GrupoCounts = Partial<Record<RrhhNovedadGrupo, number>>

function contarPorGrupo(list: RrhhNovedad[]): GrupoCounts {
  const counts: GrupoCounts = {}
  for (const n of list) {
    counts[n.grupo] = (counts[n.grupo] ?? 0) + 1
  }
  return counts
}

/** Primer nombre o apodo corto para el calendario (sin dominio si era email). */
function nombreParaChipCalendario(nombreCompleto: string | undefined, maxLen = 11): string {
  const s = nombreSinDominioCorreo(nombreCompleto)
  if (!s) return '—'
  const first = s.split(/\s+/)[0] ?? s
  if (first.length <= maxLen) return first
  return `${first.slice(0, Math.max(1, maxLen - 1))}…`
}

/** Último día del mes calendario de `fechaDesde` (YYYY-MM-DD). */
function fechaHastaFinMesDesde(fechaDesdeYmd: string): string {
  try {
    const d = parseISO(fechaDesdeYmd)
    if (Number.isNaN(d.getTime())) return fechaDesdeYmd
    return format(endOfMonth(d), 'yyyy-MM-dd')
  } catch {
    return fechaDesdeYmd
  }
}

const RecursosHumanosNovedadesPage = () => {
  const navigate = useNavigate()
  const { usuario, canManageRecursosHumanos, loading: authLoading } = useAuth()
  const canAccess =
    !!usuario && (canManageRecursosHumanos || usuario.rol === 'gerencia')

  const [usuarios, setUsuarios] = useState<UsuarioRecord[]>([])
  const [novedades, setNovedades] = useState<RrhhNovedad[]>([])
  const [legajos, setLegajos] = useState<Record<number, LegajoSectorBasico>>({})
  const [solicitudes, setSolicitudes] = useState<SolicitudPermiso[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroUsuario, setFiltroUsuario] = useState<number | ''>('')
  const [filtroGrupo, setFiltroGrupo] = useState<RrhhNovedadGrupo | ''>('')
  const [filtroDesde, setFiltroDesde] = useState(
    () => format(addMonths(new Date(), -2), 'yyyy-MM-dd')
  )
  const [filtroHasta, setFiltroHasta] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  const [calendarMonth, setCalendarMonth] = useState(() => new Date())

  const [listadoExpandido, setListadoExpandido] = useState(false)
  const [busquedaListado, setBusquedaListado] = useState('')
  const [filtroListadoEmpleado, setFiltroListadoEmpleado] = useState<number | ''>('')
  const [filtroListadoGrupo, setFiltroListadoGrupo] = useState<RrhhNovedadGrupo | ''>('')
  const [filtroListadoCodigo, setFiltroListadoCodigo] = useState('')
  const [filtroListadoFirma, setFiltroListadoFirma] = useState<'' | 'si' | 'no'>('')

  const [modalOpen, setModalOpen] = useState(false)
  const [calendarDayOpen, setCalendarDayOpen] = useState<string | null>(null)
  const [detailNovedad, setDetailNovedad] = useState<RrhhNovedad | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [iaLoading, setIaLoading] = useState(false)

  const [form, setForm] = useState({
    id_usuario: 0,
    id_solicitud_permiso: '' as number | '',
    grupo: 'falta' as RrhhNovedadGrupo,
    codigo: 'falta_justificada_enfermedad',
    fecha_desde: format(new Date(), 'yyyy-MM-dd'),
    fecha_hasta: format(new Date(), 'yyyy-MM-dd'),
    duracion_minutos: '' as string | number,
    horas_extra_cantidad: '' as string | number,
    observaciones: ''
  })
  const [adjuntos, setAdjuntos] = useState<RrhhNovedadAdjunto[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [u, n, s, legajosRes] = await Promise.all([
        apiService.getUsuarios(),
        apiService.rrhhNovedadesListar({
          idUsuario: filtroUsuario || undefined,
          grupo: filtroGrupo || undefined,
          fechaDesde: filtroDesde,
          fechaHasta: filtroHasta
        }),
        apiService.obtenerSolicitudesPermisos(null, null, null, null, null),
        apiService.obtenerLegajosBasico()
      ])
      if (u.success && u.data) {
        setUsuarios(filtrarUsuariosRrhhOperarios(u.data))
        if (n.success && n.data) {
          const excluidos = idsUsuariosGenericosRrhh(u.data)
          const activos = new Set(filtrarUsuariosRrhhOperarios(u.data).map((x) => x.id))
          setNovedades(
            n.data.filter((nov) => !excluidos.has(nov.id_usuario) && activos.has(nov.id_usuario))
          )
        }
      } else if (n.success && n.data) {
        setNovedades(n.data)
      }
      if (s.success && s.data) setSolicitudes(s.data)
      if (legajosRes.success && legajosRes.data) {
        const map: Record<number, LegajoSectorBasico> = {}
        for (const [id, row] of Object.entries(legajosRes.data)) {
          map[Number(id)] = { sector: row.sector }
        }
        setLegajos(map)
      }
    } finally {
      setLoading(false)
    }
  }, [filtroUsuario, filtroGrupo, filtroDesde, filtroHasta])

  useEffect(() => {
    if (authLoading) return
    if (!canAccess) {
      navigate('/')
      return
    }
    void load()
  }, [authLoading, canAccess, navigate, load])

  const nombreUsuario = useMemo(() => {
    const m = new Map<number, string>()
    usuarios.forEach((u) => m.set(u.id, u.nombre))
    return m
  }, [usuarios])

  /** Nombre para mostrar: sin dominio si el dato es un email. */
  const empleadoMostrar = useCallback(
    (idUsuario: number, sinNombre: 'id' | 'usuario-hash' = 'id') => {
      const raw = nombreUsuario.get(idUsuario)
      if (raw == null || String(raw).trim() === '') {
        return sinNombre === 'usuario-hash' ? `Usuario #${idUsuario}` : String(idUsuario)
      }
      const v = nombreSinDominioCorreo(raw)
      return v || (sinNombre === 'usuario-hash' ? `Usuario #${idUsuario}` : String(idUsuario))
    },
    [nombreUsuario]
  )

  const usuariosScope = useMemo(() => {
    if (filtroUsuario !== '') {
      const u = usuarios.find((x) => x.id === filtroUsuario)
      return u ? [u] : []
    }
    return usuarios
  }, [filtroUsuario, usuarios])

  const filtroContexto = useMemo(() => {
    const partes: string[] = []
    if (filtroUsuario !== '') {
      partes.push(empleadoMostrar(filtroUsuario, 'usuario-hash'))
    } else {
      partes.push('Todos los empleados')
    }
    if (filtroGrupo !== '') {
      partes.push(GRUPOS.find((g) => g.value === filtroGrupo)?.label ?? filtroGrupo)
    } else {
      partes.push('Todos los grupos')
    }
    partes.push(`${filtroDesde} → ${filtroHasta}`)
    return partes.join(' · ')
  }, [filtroUsuario, filtroGrupo, filtroDesde, filtroHasta, empleadoMostrar])

  const indicadoresOrg = useMemo(
    () =>
      calcularIndicadoresNovedadesOrganizacion(novedades, legajos, usuarios, {
        usuariosScope,
        periodoDesde: parseFechaFiltro(filtroDesde, addMonths(new Date(), -2)),
        periodoHasta: parseFechaFiltro(filtroHasta, new Date())
      }),
    [novedades, legajos, usuarios, usuariosScope, filtroDesde, filtroHasta]
  )

  const chartSector = useMemo(
    () =>
      indicadoresOrg.porSector
        .filter((s) => s.diasAusenciaMes > 0 || s.tardanzasMes > 0 || s.disciplinariasMes > 0)
        .slice(0, 10)
        .map((s) => ({
          sector: s.sector.length > 16 ? `${s.sector.slice(0, 14)}…` : s.sector,
          indice: s.indiceAusentismo,
          dias: s.diasAusenciaMes
        })),
    [indicadoresOrg.porSector]
  )

  const chartEvolucion = useMemo(
    () =>
      indicadoresOrg.evolucionMensual.map((e) => ({
        mes: e.mesLabel,
        ausentismo: e.ausentismoDias,
        tardanzas: e.tardanzas,
        disciplinarias: e.disciplinarias,
        total: e.totalEventos
      })),
    [indicadoresOrg.evolucionMensual]
  )

  const novedadesDiaCalendario = useMemo(() => {
    if (!calendarDayOpen) return []
    return ordenarNovedadesCalendario(
      novedades.filter((n) => novedadVisibleEnCalendarioDia(n, calendarDayOpen))
    )
  }, [calendarDayOpen, novedades])

  const solicitudesEmpleado = useMemo(() => {
    if (!form.id_usuario) return []
    return solicitudes.filter((s) => s.id_usuario === form.id_usuario)
  }, [solicitudes, form.id_usuario])

  const openNew = () => {
    setDetailNovedad(null)
    setEditId(null)
    setAdjuntos([])
    setForm({
      id_usuario: usuarios[0]?.id ?? 0,
      id_solicitud_permiso: '',
      grupo: 'falta',
      codigo: 'falta_justificada_enfermedad',
      fecha_desde: format(new Date(), 'yyyy-MM-dd'),
      fecha_hasta: format(new Date(), 'yyyy-MM-dd'),
      duracion_minutos: '',
      horas_extra_cantidad: '',
      observaciones: ''
    })
    setModalOpen(true)
  }

  const openEdit = (row: RrhhNovedad) => {
    setDetailNovedad(null)
    setEditId(row.id)
    setAdjuntos(row.adjuntos ?? [])
    setForm({
      id_usuario: row.id_usuario,
      id_solicitud_permiso: row.id_solicitud_permiso ?? '',
      grupo: row.grupo as RrhhNovedadGrupo,
      codigo: row.codigo,
      fecha_desde: row.fecha_desde,
      fecha_hasta:
        row.grupo === 'beneficio_comida'
          ? fechaHastaFinMesDesde(row.fecha_desde)
          : row.fecha_hasta,
      duracion_minutos: row.duracion_minutos ?? '',
      horas_extra_cantidad: row.horas_extra_cantidad ?? '',
      observaciones: row.observaciones ?? ''
    })
    setModalOpen(true)
  }

  const guardar = async () => {
    if (!usuario) return
    if (!form.id_usuario) {
      alert('Elegí un empleado.')
      return
    }
    const dm =
      form.duracion_minutos === '' ? null : Math.max(0, Number(form.duracion_minutos))
    const he =
      form.horas_extra_cantidad === '' ? null : Math.max(0, Number(form.horas_extra_cantidad))
    if ((form.grupo === 'tardanza_retiro') && (dm == null || Number.isNaN(dm))) {
      alert('Indicá la duración en minutos para tardanza o retiro anticipado.')
      return
    }
    if (form.grupo === 'horas_extra' && (he == null || Number.isNaN(he))) {
      alert('Indicá la cantidad de horas extra.')
      return
    }
    setSaving(true)
    try {
      const fechaHastaGuardada =
        form.grupo === 'beneficio_comida'
          ? fechaHastaFinMesDesde(form.fecha_desde)
          : form.fecha_hasta
      const common = {
        id_usuario: form.id_usuario,
        id_solicitud_permiso:
          form.id_solicitud_permiso === '' ? null : Number(form.id_solicitud_permiso),
        grupo: form.grupo,
        codigo: form.codigo,
        fecha_desde: form.fecha_desde,
        fecha_hasta: fechaHastaGuardada,
        duracion_minutos:
          form.grupo === 'tardanza_retiro' ? dm : null,
        horas_extra_cantidad: form.grupo === 'horas_extra' ? he : null,
        observaciones: form.observaciones.trim() || null,
        adjuntos
      }
      let res
      if (editId != null) {
        res = await apiService.rrhhNovedadActualizar(editId, common)
      } else {
        res = await apiService.rrhhNovedadCrear({
          ...common,
          registrado_por: usuario.id
        })
      }
      if (res.success) {
        if (
          editId == null &&
          form.grupo === 'beneficio_comida' &&
          form.codigo === 'perdida_beneficio_comida'
        ) {
          const n = await apiService.createNotification({
            user_id: form.id_usuario,
            title: 'Pérdida del beneficio de comida',
            description: `Se registró la pérdida de tu beneficio de comida desde el ${form.fecha_desde} hasta el ${fechaHastaGuardada}. Si tenés dudas, consultá con RRHH.`,
            type: 'warning'
          })
          if (!n.success) {
            console.warn('No se pudo enviar la notificación al empleado:', n.error)
          }

          if (usuario.id !== form.id_usuario) {
            const roomRes = await apiService.obtenerOCrearRoomDm(usuario.id, form.id_usuario)
            if (roomRes.success && roomRes.data) {
              const textoDm =
                `📋 RRHH — Pérdida del beneficio de comida\n` +
                `Período registrado: desde ${form.fecha_desde} hasta ${fechaHastaGuardada}.\n` +
                `Podés ver el detalle en RRHH o responder por este chat si tenés consultas.`
              const dmRes = await apiService.enviarMensajeDm({
                roomId: roomRes.data.roomId,
                contenido: textoDm,
                usuarioId: usuario.id
              })
              if (!dmRes.success) {
                console.warn('No se pudo enviar el mensaje a mensajería:', dmRes.error)
              } else {
                dispatchMensajeriaDmUnreadRefresh()
              }
            } else {
              console.warn('No se pudo abrir sala DM para mensajería:', roomRes.error)
            }
          }
        }
        setModalOpen(false)
        await load()
      } else alert(res.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar esta novedad?')) return
    const r = await apiService.rrhhNovedadEliminar(id)
    if (r.success) await load()
    else alert(r.error || 'Error')
  }

  const subirArchivo = async (file: File) => {
    if (!form.id_usuario) {
      alert('Elegí primero el empleado.')
      return
    }
    const r = await apiService.rrhhNovedadSubirAdjunto(file, form.id_usuario)
    if (r.success && r.data) setAdjuntos((a) => [...a, r.data!])
    else alert(r.error || 'No se pudo subir')
  }

  const extraerConIa = async (file: File) => {
    if (!form.id_usuario) {
      alert('Elegí primero el empleado para asociar el comprobante.')
      return
    }
    setIaLoading(true)
    try {
      const reader = new FileReader()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
        reader.onload = () => resolve(String(reader.result))
        reader.readAsDataURL(file)
      })
      const res = await plotLabFetch('/api/rrhh/extract-certificado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl })
      })
      const json = (await res.json()) as {
        success?: boolean
        data?: Record<string, unknown>
        error?: string
      }
      if (!json.success || !json.data) {
        alert(json.error || 'No se pudo procesar con IA (¿desplegado en Vercel con GEMINI_API_KEY?)')
        return
      }
      const d = json.data
      const fi = d.fecha_inicio != null ? String(d.fecha_inicio).slice(0, 10) : null
      const ff = d.fecha_fin != null ? String(d.fecha_fin).slice(0, 10) : null
      const dias = d.dias_reposo_sugeridos != null ? Number(d.dias_reposo_sugeridos) : null
      setForm((f) => {
        let hasta = f.fecha_hasta
        if (ff) hasta = ff
        else if (fi && dias != null && !Number.isNaN(dias) && dias > 0) {
          try {
            hasta = format(addDays(parseISO(fi), Math.max(0, dias - 1)), 'yyyy-MM-dd')
          } catch {
            /* ignore */
          }
        }
        return {
          ...f,
          fecha_desde: fi || f.fecha_desde,
          fecha_hasta: hasta,
          observaciones:
            f.observaciones ||
            (d.notas != null ? String(d.notas) : '') ||
            (d.titulo_detectado != null ? String(d.titulo_detectado) : '')
        }
      })
      await subirArchivo(file)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error IA')
    } finally {
      setIaLoading(false)
    }
  }

  const exportXlsx = () => {
    const rows = novedades.map((n) => ({
      id: n.id,
      empleado: empleadoMostrar(n.id_usuario),
      grupo: n.grupo,
      categoria: etiquetaCodigo(n.codigo),
      desde: n.fecha_desde,
      hasta: n.fecha_hasta,
      minutos: n.duracion_minutos ?? '',
      horas_extra: n.horas_extra_cantidad ?? '',
      permiso_id: n.id_solicitud_permiso ?? '',
      observaciones: n.observaciones ?? ''
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Novedades')
    XLSX.writeFile(wb, `rrhh-novedades-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
  }

  const exportPdf = () => {
    downloadRrhhNovedadesListadoPdf({
      novedades,
      empleadoLabel: (id) => empleadoMostrar(id),
      fechaDesde: filtroDesde,
      fechaHasta: filtroHasta
    })
  }

  const monthDays = useMemo(() => {
    const start = startOfMonth(calendarMonth)
    const end = endOfMonth(calendarMonth)
    return eachDayOfInterval({ start, end })
  }, [calendarMonth])

  const padStartWeekday = useMemo(() => {
    const first = startOfMonth(calendarMonth)
    const dow = first.getDay()
    return dow === 0 ? 6 : dow - 1
  }, [calendarMonth])

  const resumenMesCalendario = useMemo(() => {
    const monthStart = format(startOfMonth(calendarMonth), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(calendarMonth), 'yyyy-MM-dd')
    const enMes = novedades.filter(
      (n) => n.fecha_desde <= monthEnd && n.fecha_hasta >= monthStart
    )
    const porGrupo = contarPorGrupo(enMes)
    const total = enMes.length
    return { porGrupo, total }
  }, [calendarMonth, novedades])

  const codigosListado = useMemo(() => {
    if (!filtroListadoGrupo) {
      return Object.values(CODIGOS_POR_GRUPO).flat()
    }
    return CODIGOS_POR_GRUPO[filtroListadoGrupo] ?? []
  }, [filtroListadoGrupo])

  const hayFiltrosListado =
    busquedaListado.trim() !== '' ||
    filtroListadoEmpleado !== '' ||
    filtroListadoGrupo !== '' ||
    filtroListadoCodigo !== '' ||
    filtroListadoFirma !== ''

  const limpiarFiltrosListado = () => {
    setBusquedaListado('')
    setFiltroListadoEmpleado('')
    setFiltroListadoGrupo('')
    setFiltroListadoCodigo('')
    setFiltroListadoFirma('')
  }

  const novedadesListado = useMemo(() => {
    const q = busquedaListado.trim().toLowerCase()
    return novedades.filter((n) => {
      if (filtroListadoEmpleado !== '' && n.id_usuario !== filtroListadoEmpleado) return false
      if (filtroListadoGrupo !== '' && n.grupo !== filtroListadoGrupo) return false
      if (filtroListadoCodigo !== '' && n.codigo !== filtroListadoCodigo) return false
      if (filtroListadoFirma === 'si' && !n.firma_data_url) return false
      if (filtroListadoFirma === 'no' && n.firma_data_url) return false
      if (!q) return true
      const haystack = [
        empleadoMostrar(n.id_usuario),
        GRUPOS.find((g) => g.value === n.grupo)?.label,
        etiquetaCodigo(n.codigo),
        n.observaciones,
        n.fecha_desde,
        n.fecha_hasta,
        String(n.id)
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [
    novedades,
    busquedaListado,
    filtroListadoEmpleado,
    filtroListadoGrupo,
    filtroListadoCodigo,
    filtroListadoFirma,
    empleadoMostrar
  ])

  if (authLoading) {
    return (
      <div className="rrhh-novedades-page">
        <p className="rrhh-novedades-loading">Cargando…</p>
      </div>
    )
  }

  if (!canAccess) return null

  return (
    <div className="rrhh-novedades-page">
      <header className="rrhh-novedades-header">
        <div>
          <h1>Novedades laborales</h1>
          <p className="rrhh-novedades-sub">
            Clasificación, indicadores por sector, evolución histórica y alertas para la gestión del
            comportamiento laboral.
          </p>
        </div>
        <button type="button" className="btn-back-rrhh" onClick={() => navigate('/rrhh/dashboard')}>
          ← RRHH
        </button>
      </header>

      <section className="rrhh-novedades-toolbar">
        <div className="rrhh-novedades-filters">
          <label>
            Empleado
            <select
              value={filtroUsuario === '' ? '' : filtroUsuario}
              onChange={(e) =>
                setFiltroUsuario(e.target.value === '' ? '' : Number(e.target.value))
              }
            >
              <option value="">Todos</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Grupo
            <select
              value={filtroGrupo}
              onChange={(e) => setFiltroGrupo((e.target.value || '') as RrhhNovedadGrupo | '')}
            >
              <option value="">Todos</option>
              {GRUPOS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Desde
            <input
              type="date"
              value={filtroDesde}
              onChange={(e) => setFiltroDesde(e.target.value)}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={filtroHasta}
              onChange={(e) => setFiltroHasta(e.target.value)}
            />
          </label>
          <button type="button" className="btn-primary" onClick={() => void load()}>
            Aplicar
          </button>
        </div>
        <div className="rrhh-novedades-actions">
          <button type="button" className="btn-primary" onClick={openNew}>
            + Nueva novedad
          </button>
          <button type="button" className="btn-secondary" onClick={exportXlsx} disabled={!novedades.length}>
            Excel
          </button>
          <button type="button" className="btn-secondary" onClick={exportPdf} disabled={!novedades.length}>
            PDF
          </button>
        </div>
      </section>

      <section className="rrhh-novedades-gestion" aria-label="Indicadores de gestión de personas">
        <div className="rrhh-novedades-gestion-head">
          <div>
            <h2>Indicadores de gestión</h2>
            <p className="rrhh-novedades-gestion-sub">
              Seguimiento del comportamiento laboral según los filtros aplicados.
            </p>
            <p className="rrhh-novedades-gestion-filtro">{filtroContexto}</p>
          </div>
        </div>

        {loading ? (
          <p className="rrhh-novedades-gestion-loading">Actualizando indicadores…</p>
        ) : novedades.length === 0 ? (
          <p className="rrhh-novedades-gestion-empty">
            No hay novedades para el filtro seleccionado. Ajustá empleado, grupo o fechas y pulsá Aplicar.
          </p>
        ) : (
          <>
            <div className="rrhh-novedades-gestion-kpis">
              <article className="rrhh-nov-gestion-kpi">
                <span className="rrhh-nov-gestion-kpi-value">{indicadoresOrg.indiceEmpresaMes}%</span>
                <span className="rrhh-nov-gestion-kpi-label">Índice ausentismo</span>
                <span className="rrhh-nov-gestion-kpi-hint">
                  Promedio mensual · {indicadoresOrg.mesesPeriodo} mes
                  {indicadoresOrg.mesesPeriodo === 1 ? '' : 'es'} · base 22 días laborables
                </span>
              </article>
              <article className="rrhh-nov-gestion-kpi">
                <span className="rrhh-nov-gestion-kpi-value">{indicadoresOrg.totalNovedadesMes}</span>
                <span className="rrhh-nov-gestion-kpi-label">Novedades en el período</span>
              </article>
              <article className="rrhh-nov-gestion-kpi">
                <span className="rrhh-nov-gestion-kpi-value">{indicadoresOrg.tardanzasMes}</span>
                <span className="rrhh-nov-gestion-kpi-label">Llegadas tarde</span>
              </article>
              <article className="rrhh-nov-gestion-kpi">
                <span className="rrhh-nov-gestion-kpi-value">{indicadoresOrg.disciplinariasMes}</span>
                <span className="rrhh-nov-gestion-kpi-label">Disciplinarias</span>
              </article>
              {indicadoresOrg.sectorMasAusentismo && filtroUsuario === '' ? (
                <article className="rrhh-nov-gestion-kpi rrhh-nov-gestion-kpi--alert">
                  <span className="rrhh-nov-gestion-kpi-value rrhh-nov-gestion-kpi-value--text">
                    {indicadoresOrg.sectorMasAusentismo}
                  </span>
                  <span className="rrhh-nov-gestion-kpi-label">Sector con mayor ausentismo</span>
                </article>
              ) : null}
            </div>

            <div className="rrhh-novedades-gestion-charts">
              {chartSector.length > 0 ? (
                <div className="rrhh-nov-gestion-chart">
                  <h3>Índice de ausentismo por sector</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartSector} margin={{ left: 4, right: 8, bottom: 48 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        dataKey="sector"
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        angle={-30}
                        textAnchor="end"
                        height={56}
                      />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} unit="%" />
                      <Tooltip
                        contentStyle={{
                          background: '#1e293b',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: 8
                        }}
                        formatter={(v: number, name: string) =>
                          name === 'indice' ? [`${v}%`, 'Índice ausentismo'] : [v, 'Días ausencia']
                        }
                      />
                      <Bar dataKey="indice" name="indice" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : null}

              {chartEvolucion.length > 0 ? (
                <div className="rrhh-nov-gestion-chart">
                  <h3>Evolución histórica de novedades</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={chartEvolucion}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="mes" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          background: '#1e293b',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: 8
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line
                        type="monotone"
                        dataKey="ausentismo"
                        name="Días ausencia"
                        stroke="#f87171"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="tardanzas"
                        name="Tardanzas"
                        stroke="#fbbf24"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="disciplinarias"
                        name="Disciplinarias"
                        stroke="#fb923c"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
            </div>
          </>
        )}
      </section>

      <section className="rrhh-novedades-calendar-wrap">
        <div className="rrhh-novedades-calendar-head">
          <button type="button" onClick={() => setCalendarMonth((d) => addMonths(d, -1))}>
            ←
          </button>
          <h2>{format(calendarMonth, 'MMMM yyyy', { locale: es })}</h2>
          <button type="button" onClick={() => setCalendarMonth((d) => addMonths(d, 1))}>
            →
          </button>
        </div>

        <div className="rrhh-novedades-calendar-weekdays">
          {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map((d) => (
            <div key={d} className="rrhh-novedades-cal-wd">
              {d}
            </div>
          ))}
        </div>
        <div className="rrhh-novedades-calendar-grid">
          {Array.from({ length: padStartWeekday }).map((_, i) => (
            <div key={`pad-${i}`} className="rrhh-novedades-cal-cell rrhh-novedades-cal-cell--empty" />
          ))}
          {monthDays.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const list = ordenarNovedadesCalendario(
              novedades.filter((n) => novedadVisibleEnCalendarioDia(n, key))
            )
            const tardanzasDia = list.filter((n) => n.codigo === 'tardanza').length
            const maxVisible = list.length > 4 ? 3 : 4
            const hidden = list.length - maxVisible
            return (
              <div
                key={key}
                className={`rrhh-novedades-cal-cell${list.length ? ' rrhh-novedades-cal-cell--has' : ''}`}
                role={list.length ? 'button' : undefined}
                tabIndex={list.length ? 0 : undefined}
                onClick={() => list.length && setCalendarDayOpen(key)}
                onKeyDown={(e) => {
                  if (list.length && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    setCalendarDayOpen(key)
                  }
                }}
              >
                <div className="rrhh-novedades-cal-daynum-row">
                  <span className="rrhh-novedades-cal-daynum">{format(day, 'd')}</span>
                  {tardanzasDia > 0 ? (
                    <span className="rrhh-novedades-cal-day-badge" title={`${tardanzasDia} tardanza${tardanzasDia === 1 ? '' : 's'}`}>
                      {tardanzasDia}T
                    </span>
                  ) : null}
                </div>
                <div className="rrhh-novedades-cal-chips">
                  {list.slice(0, maxVisible).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      className={`rrhh-novedades-cal-chip rrhh-novedades-cal-chip--${n.grupo}`}
                      title={[
                        empleadoMostrar(n.id_usuario, 'usuario-hash'),
                        etiquetaCodigo(n.codigo),
                        n.grupo === 'tardanza_retiro' && n.duracion_minutos != null
                          ? `${n.duracion_minutos} min`
                          : null,
                        n.observaciones
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      onClick={(e) => {
                        e.stopPropagation()
                        setDetailNovedad(n)
                      }}
                    >
                      <span
                        className={`rrhh-novedades-cal-chip-dot rrhh-novedades-cal-chip-dot--${n.grupo}`}
                        aria-hidden
                      />
                      <span className="rrhh-novedades-cal-chip-tag">{etiquetaCortaChipCalendario(n)}</span>
                      <span className="rrhh-novedades-cal-chip-name">
                        {nombreParaChipCalendario(nombreUsuario.get(n.id_usuario))}
                      </span>
                    </button>
                  ))}
                  {hidden > 0 ? (
                    <button
                      type="button"
                      className="rrhh-novedades-cal-more"
                      title={`Ver las ${list.length} novedades de este día`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setCalendarDayOpen(key)
                      }}
                    >
                      +{hidden} más
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>

        <div className="rrhh-novedades-cal-stats" aria-label="Resumen mensual por grupo">
          <div className="rrhh-novedades-cal-stats-head">
            <h3 className="rrhh-novedades-cal-stats-title">
              Resumen de {format(calendarMonth, 'MMMM yyyy', { locale: es })}
            </h3>
            <span className="rrhh-novedades-cal-stats-total">
              {resumenMesCalendario.total} novedad{resumenMesCalendario.total === 1 ? '' : 'es'}
            </span>
          </div>
          <div className="rrhh-novedades-cal-stats-grid">
            {GRUPOS.map((g) => {
              const n = resumenMesCalendario.porGrupo[g.value] ?? 0
              return (
                <div
                  key={g.value}
                  className={`rrhh-novedades-cal-stat-card rrhh-novedades-cal-stat-card--${g.value}${n === 0 ? ' rrhh-novedades-cal-stat-card--zero' : ''}`}
                >
                  <span className="rrhh-novedades-cal-stat-num">{n}</span>
                  <span className="rrhh-novedades-cal-stat-label">{g.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section
        className={`rrhh-novedades-table-section${listadoExpandido ? ' rrhh-novedades-table-section--open' : ''}`}
      >
        <button
          type="button"
          className="rrhh-novedades-table-toggle"
          aria-expanded={listadoExpandido}
          onClick={() => setListadoExpandido((v) => !v)}
        >
          <span className="rrhh-novedades-table-toggle-main">
            <span className="rrhh-novedades-table-toggle-title">Listado de novedades</span>
            <span className="rrhh-novedades-table-toggle-meta">
              {loading
                ? 'Cargando…'
                : `${novedadesListado.length}${hayFiltrosListado ? ` de ${novedades.length}` : ''} registro${novedadesListado.length === 1 ? '' : 's'}`}
            </span>
          </span>
          <span className="rrhh-novedades-table-toggle-chevron" aria-hidden>
            {listadoExpandido ? '▾' : '▸'}
          </span>
        </button>

        {listadoExpandido ? (
          <div className="rrhh-novedades-table-panel">
            <div className="rrhh-novedades-table-toolbar">
              <label className="rrhh-novedades-table-search">
                <span className="sr-only">Buscar en el listado</span>
                <input
                  type="search"
                  value={busquedaListado}
                  onChange={(e) => setBusquedaListado(e.target.value)}
                  placeholder="Buscar empleado, categoría, observación…"
                />
              </label>
              <label>
                Empleado
                <select
                  value={filtroListadoEmpleado === '' ? '' : filtroListadoEmpleado}
                  onChange={(e) =>
                    setFiltroListadoEmpleado(e.target.value === '' ? '' : Number(e.target.value))
                  }
                >
                  <option value="">Todos</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Grupo
                <select
                  value={filtroListadoGrupo}
                  onChange={(e) => {
                    const g = (e.target.value || '') as RrhhNovedadGrupo | ''
                    setFiltroListadoGrupo(g)
                    setFiltroListadoCodigo('')
                  }}
                >
                  <option value="">Todos</option>
                  {GRUPOS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Categoría
                <select
                  value={filtroListadoCodigo}
                  onChange={(e) => setFiltroListadoCodigo(e.target.value)}
                >
                  <option value="">Todas</option>
                  {codigosListado.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Firma
                <select
                  value={filtroListadoFirma}
                  onChange={(e) => setFiltroListadoFirma((e.target.value || '') as '' | 'si' | 'no')}
                >
                  <option value="">Todas</option>
                  <option value="si">Con firma</option>
                  <option value="no">Sin firma</option>
                </select>
              </label>
              {hayFiltrosListado ? (
                <button type="button" className="btn-secondary rrhh-novedades-table-clear" onClick={limpiarFiltrosListado}>
                  Limpiar
                </button>
              ) : null}
            </div>

            {loading ? (
              <p className="rrhh-novedades-table-empty">Cargando…</p>
            ) : novedadesListado.length === 0 ? (
              <p className="rrhh-novedades-table-empty">
                {hayFiltrosListado
                  ? 'No hay novedades que coincidan con la búsqueda o los filtros.'
                  : 'No hay novedades en el período seleccionado.'}
              </p>
            ) : (
              <div className="rrhh-novedades-table-wrap">
                <table className="rrhh-novedades-table">
                  <thead>
                    <tr>
                      <th>Fechas</th>
                      <th>Empleado</th>
                      <th>Grupo</th>
                      <th>Categoría</th>
                      <th>Detalle</th>
                      <th>Adj.</th>
                      <th>Firma</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {novedadesListado.map((n) => (
                      <tr
                        key={n.id}
                        className="rrhh-novedades-table-row"
                        onClick={() => setDetailNovedad(n)}
                      >
                        <td>
                          {n.fecha_desde}
                          {n.fecha_hasta !== n.fecha_desde ? ` → ${n.fecha_hasta}` : ''}
                        </td>
                        <td>{empleadoMostrar(n.id_usuario)}</td>
                        <td>{GRUPOS.find((g) => g.value === n.grupo)?.label ?? n.grupo}</td>
                        <td>{etiquetaCodigo(n.codigo)}</td>
                        <td className="rrhh-novedades-obs">
                          {n.grupo === 'tardanza_retiro' && n.duracion_minutos != null
                            ? `${n.duracion_minutos} min · `
                            : ''}
                          {n.grupo === 'horas_extra' && n.horas_extra_cantidad != null
                            ? `${n.horas_extra_cantidad} h · `
                            : ''}
                          {n.observaciones ?? '—'}
                        </td>
                        <td>{(n.adjuntos?.length ?? 0) || '—'}</td>
                        <td>{n.firma_data_url ? '✓' : '—'}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="linklike" onClick={() => openEdit(n)}>
                            Editar
                          </button>{' '}
                          <button type="button" className="linklike danger" onClick={() => void eliminar(n.id)}>
                            Borrar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </section>

      {calendarDayOpen ? (
        <div
          className="rrhh-novedades-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rrhh-cal-day-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCalendarDayOpen(null)
          }}
        >
          <div className="rrhh-novedades-cal-day-panel" onClick={(e) => e.stopPropagation()}>
            <header className="rrhh-novedades-cal-day-head">
              <div>
                <h3 id="rrhh-cal-day-title">
                  {format(parseISO(calendarDayOpen), "EEEE d 'de' MMMM", { locale: es })}
                </h3>
                <p className="rrhh-novedades-cal-day-sub">
                  {novedadesDiaCalendario.length} novedad
                  {novedadesDiaCalendario.length === 1 ? '' : 'es'}
                </p>
              </div>
              <button
                type="button"
                className="rrhh-novedades-modal-close"
                aria-label="Cerrar"
                onClick={() => setCalendarDayOpen(null)}
              >
                ×
              </button>
            </header>
            <ul className="rrhh-novedades-cal-day-list">
              {novedadesDiaCalendario.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`rrhh-novedades-cal-day-item rrhh-novedades-cal-day-item--${n.grupo}`}
                    onClick={() => {
                      setCalendarDayOpen(null)
                      setDetailNovedad(n)
                    }}
                  >
                    <span
                      className={`rrhh-novedades-cal-chip-dot rrhh-novedades-cal-chip-dot--${n.grupo}`}
                      aria-hidden
                    />
                    <span className="rrhh-novedades-cal-day-item-main">
                      <span className="rrhh-novedades-cal-day-item-name">
                        {empleadoMostrar(n.id_usuario, 'usuario-hash')}
                      </span>
                      <span className="rrhh-novedades-cal-day-item-code">
                        {etiquetaCortaChipCalendario(n)}
                        {n.grupo === 'tardanza_retiro' && n.duracion_minutos != null
                          ? ` · ${n.duracion_minutos} min`
                          : ''}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {detailNovedad && (
        <RrhhNovedadDetailModal
          novedad={detailNovedad}
          empleadoNombre={empleadoMostrar(detailNovedad.id_usuario, 'usuario-hash')}
          onClose={() => setDetailNovedad(null)}
          onNovedadUpdated={(actualizada) => {
            setDetailNovedad(actualizada)
            setNovedades((prev) => prev.map((n) => (n.id === actualizada.id ? actualizada : n)))
          }}
          onEdit={() => {
            const row = detailNovedad
            setDetailNovedad(null)
            openEdit(row)
          }}
        />
      )}

      {modalOpen && (
        <div
          className="rrhh-novedades-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false)
          }}
        >
          <div className="rrhh-novedades-modal rrhh-novedades-modal--form" onClick={(e) => e.stopPropagation()}>
            <header className="rrhh-novedades-modal-top">
              <div>
                <h3>{editId != null ? 'Editar novedad' : 'Nueva novedad'}</h3>
                <p className="rrhh-novedades-modal-lead">
                  {editId != null ? 'Actualizá los datos y guardá los cambios.' : 'Completá los campos y adjuntá comprobantes si aplica.'}
                </p>
              </div>
              <button
                type="button"
                className="rrhh-novedades-modal-close"
                aria-label="Cerrar"
                onClick={() => setModalOpen(false)}
              >
                ×
              </button>
            </header>

            <label>
              Empleado *
              <select
                value={form.id_usuario || ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, id_usuario: Number(e.target.value), id_solicitud_permiso: '' }))
                }
              >
                <option value={0}>Elegir…</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Grupo *
              <select
                value={form.grupo}
                onChange={(e) => {
                  const g = e.target.value as RrhhNovedadGrupo
                  const first = CODIGOS_POR_GRUPO[g][0]?.value ?? ''
                  setForm((f) => {
                    if (g === 'beneficio_comida') {
                      return {
                        ...f,
                        grupo: g,
                        codigo: first,
                        fecha_hasta: fechaHastaFinMesDesde(f.fecha_desde)
                      }
                    }
                    return { ...f, grupo: g, codigo: first }
                  })
                }}
              >
                {GRUPOS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Categoría *
              <select
                value={form.codigo}
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
              >
                {CODIGOS_POR_GRUPO[form.grupo].map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="rrhh-novedades-modal-row">
              <label>
                Desde *
                <input
                  type="date"
                  value={form.fecha_desde}
                  onChange={(e) => {
                    const v = e.target.value
                    setForm((f) => {
                      if (f.grupo === 'beneficio_comida') {
                        return { ...f, fecha_desde: v, fecha_hasta: fechaHastaFinMesDesde(v) }
                      }
                      return { ...f, fecha_desde: v }
                    })
                  }}
                />
              </label>
              <label>
                Hasta *
                <input
                  type="date"
                  value={form.fecha_hasta}
                  disabled={form.grupo === 'beneficio_comida'}
                  onChange={(e) => setForm((f) => ({ ...f, fecha_hasta: e.target.value }))}
                />
              </label>
            </div>
            {form.grupo === 'beneficio_comida' ? (
              <p className="rrhh-novedades-beneficio-hint">
                El período va desde la fecha inicial hasta el <strong>último día de ese mes</strong>. Al guardar una{' '}
                <strong>nueva</strong> novedad, el colaborador recibe notificación en la app y un mensaje en{' '}
                <strong>/mensajeria</strong> (conversación contigo).
              </p>
            ) : null}

            {form.grupo === 'tardanza_retiro' && (
              <label>
                Duración (minutos) *
                <input
                  type="number"
                  min={1}
                  value={form.duracion_minutos}
                  onChange={(e) => setForm((f) => ({ ...f, duracion_minutos: e.target.value }))}
                />
              </label>
            )}

            {form.grupo === 'horas_extra' && (
              <label>
                Cantidad de horas *
                <input
                  type="number"
                  step="0.25"
                  min={0.25}
                  value={form.horas_extra_cantidad}
                  onChange={(e) => setForm((f) => ({ ...f, horas_extra_cantidad: e.target.value }))}
                />
              </label>
            )}

            <label>
              Vincular permiso existente (opcional)
              <select
                value={form.id_solicitud_permiso === '' ? '' : form.id_solicitud_permiso}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    id_solicitud_permiso: e.target.value === '' ? '' : Number(e.target.value)
                  }))
                }
              >
                <option value="">Ninguno</option>
                {solicitudesEmpleado.map((s) => (
                  <option key={s.id} value={s.id}>
                    #{s.id} {s.titulo} ({s.estado})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Observaciones
              <textarea
                rows={3}
                value={form.observaciones}
                onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
              />
            </label>

            <div className="rrhh-novedades-upload">
              <p className="rrhh-novedades-section-title">Comprobantes</p>
              <p className="rrhh-novedades-upload-hint">
                Fotos o PDF (certificado médico, constancia alumno, etc.)
              </p>
              <input
                type="file"
                accept="image/*,.pdf,application/pdf"
                multiple
                onChange={(e) => {
                  const files = e.target.files
                  if (!files?.length) return
                  void Promise.all(Array.from(files).map((f) => subirArchivo(f)))
                  e.target.value = ''
                }}
              />
              <label className="rrhh-novedades-ia-row">
                <span>O procesar con IA (Gemini) + adjuntar:</span>
                <input
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  disabled={iaLoading}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (f) void extraerConIa(f)
                  }}
                />
                {iaLoading ? <span className="rrhh-novedades-ia-loading">Procesando…</span> : null}
              </label>
              <ul className="rrhh-novedades-adj-list">
                {adjuntos.map((a, i) => (
                  <li key={a.url + i}>
                    <a href={a.url} target="_blank" rel="noreferrer">
                      {a.nombre}
                    </a>{' '}
                    <button
                      type="button"
                      className="linklike danger"
                      onClick={() => setAdjuntos((x) => x.filter((_, j) => j !== i))}
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rrhh-novedades-modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" disabled={saving} onClick={() => void guardar()}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RecursosHumanosNovedadesPage
