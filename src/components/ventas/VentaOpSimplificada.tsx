import { useEffect, useMemo, useState, type ClipboardEvent } from 'react'
import apiService from '../../services/api'
import type { SectorRecord, Venta } from '../../types/api'
import type { TeamMember } from '../../types/board'
import OpFichaGuiaModal from '../OpFichaGuiaModal'
import { improveOpDescriptionWithPlotAI } from '../../utils/improveOpDescriptionPlotAI'
import { normalizeHoraEstimada } from '../../utils/horaEstimada'
import { filterOperariosBySector } from '../../utils/dataMappers'
import { nombreVisibleDesdeRecord } from '../../utils/usuarioDisplayName'
import { pillColorFromString } from '../../utils/pillColorFromString'
import { opSectoresRequierenFotosLugar } from '../../utils/sectoresFotosLugar'
import { uploadAttachmentAndGetUrl } from '../../utils/storage'

const SECTORES_KANBAN = [
  'Diseño Gráfico',
  'Diseño en Proceso',
  'En Espera',
  'Imprenta (Área de Impresión)',
  'Taller de Imprenta',
  'Taller Gráfico',
  'Instalaciones',
  'Metalúrgica',
  'Entregas taller de Imprenta',
  'Entregas taller gráfico'
]

const COMPLEJIDAD = ['Baja', 'Media', 'Alta']
const PRIORIDAD = ['Normal', 'Alta', 'Media', 'Baja']

type Props = {
  venta: Venta
  creadorNombre: string
  observaciones?: string
  onCreated: (numeroOp: string, ordenId: number) => void
}

function descripcionInicial(venta: Venta, observaciones?: string): string {
  const lineas = [`Venta ${venta.numero_venta}`, `Cliente: ${venta.cliente_nombre}`]
  for (const item of venta.items ?? []) {
    const cant = item.cantidad != null ? ` × ${item.cantidad}` : ''
    lineas.push(`- ${item.descripcion}${cant}`)
  }
  const obs = (observaciones || '').trim()
  if (obs) lineas.push('', obs)
  return lineas.join('\n')
}

export default function VentaOpSimplificada({ venta, creadorNombre, observaciones, onCreated }: Props) {
  const [sectores, setSectores] = useState<SectorRecord[]>([])
  const [operarios, setOperarios] = useState<TeamMember[]>([])
  const [etiquetasDisp, setEtiquetasDisp] = useState<Array<{ nombre: string; color: string }>>([])
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [horaEstimada, setHoraEstimada] = useState('')
  const [sectorSearch, setSectorSearch] = useState('')
  const [sectorOpen, setSectorOpen] = useState(false)
  const [selectedSectores, setSelectedSectores] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [tagOpen, setTagOpen] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [tagColors, setTagColors] = useState<Map<string, string>>(new Map())
  const [operario, setOperario] = useState('')
  const [complejidad, setComplejidad] = useState('Media')
  const [prioridad, setPrioridad] = useState('Normal')
  const [descripcion, setDescripcion] = useState(() => descripcionInicial(venta, observaciones))
  const [metros, setMetros] = useState('')
  const [plotAi, setPlotAi] = useState(false)
  const [guiaOpen, setGuiaOpen] = useState(false)
  const [portadaPreview, setPortadaPreview] = useState('')
  const [portadaUrl, setPortadaUrl] = useState('')
  const [portadaNombre, setPortadaNombre] = useState('')
  const [subiendoPortada, setSubiendoPortada] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let cancelled = false
    void Promise.all([apiService.getSectores(), apiService.getUsuarios(), apiService.getEtiquetasDisponibles()]).then(
      ([sec, usu, etq]) => {
        if (cancelled) return
        if (sec.success && sec.data) {
          setSectores(sec.data.filter((s) => s.activo !== false && SECTORES_KANBAN.includes(s.nombre)))
        }
        if (usu.success && usu.data) {
          setOperarios(
            usu.data.map((u) => {
              const name = nombreVisibleDesdeRecord(u)
              return {
                id: String(u.id),
                name,
                role: u.rol,
                avatar: name.slice(0, 2).toUpperCase(),
                productivity: 0
              }
            })
          )
        }
        if (etq.success && etq.data) setEtiquetasDisp(etq.data)
      }
    )
    return () => {
      cancelled = true
    }
  }, [])

  const sectoresLista = useMemo(
    () =>
      sectores.length
        ? sectores
        : SECTORES_KANBAN.map((nombre, i) => ({
            id: -(i + 1),
            nombre,
            color: '#64748b',
            activo: true
          })),
    [sectores]
  )

  const sectoresFiltrados = useMemo(() => {
    const q = sectorSearch.trim().toLowerCase()
    return sectoresLista
      .filter((s) => (q ? s.nombre.toLowerCase().includes(q) : true))
      .slice(0, q ? 12 : 8)
  }, [sectoresLista, sectorSearch])

  const operariosFiltrados = useMemo(
    () => filterOperariosBySector(operarios, selectedSectores[0]),
    [operarios, selectedSectores]
  )

  const tagSuggestions = useMemo(() => {
    const q = tagInput.trim().toLowerCase()
    return etiquetasDisp
      .map((e) => e.nombre)
      .filter((n) => n && !tags.some((t) => t.toLowerCase() === n.toLowerCase()))
      .filter((n) => (q ? n.toLowerCase().includes(q) : true))
      .slice(0, 8)
  }, [etiquetasDisp, tagInput, tags])

  const toggleSector = (nombre: string) => {
    setSelectedSectores((prev) =>
      prev.includes(nombre) ? prev.filter((s) => s !== nombre) : [...prev, nombre]
    )
    setSectorSearch('')
  }

  const colorTag = (nombre: string) =>
    tagColors.get(nombre.toLowerCase()) ||
    etiquetasDisp.find((e) => e.nombre.toLowerCase() === nombre.toLowerCase())?.color ||
    pillColorFromString(nombre)

  const agregarTag = async (raw: string) => {
    const value = raw.trim()
    if (!value || tags.some((t) => t.toLowerCase() === value.toLowerCase())) return
    setTags((prev) => [...prev, value])
    setTagInput('')
    setTagOpen(false)
    const existente = etiquetasDisp.find((e) => e.nombre.toLowerCase() === value.toLowerCase())
    const color = existente?.color || pillColorFromString(value)
    setTagColors((prev) => new Map(prev).set(value.toLowerCase(), color))
    if (!existente) {
      try {
        await apiService.guardarEtiquetaDisponible(value)
      } catch {
        /* el color local alcanza para mostrar la pastilla */
      }
    }
  }

  const subirPortada = async (file: File) => {
    setSubiendoPortada(true)
    const preview = URL.createObjectURL(file)
    setPortadaPreview(preview)
    setPortadaNombre(file.name)
    try {
      const url = await uploadAttachmentAndGetUrl(file, 'capturas')
      setPortadaUrl(url)
    } catch (e) {
      setPortadaPreview('')
      setPortadaUrl('')
      alert(e instanceof Error ? e.message : 'No se pudo subir la captura.')
    } finally {
      setSubiendoPortada(false)
    }
  }

  const onPastePortada = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items?.length) return
    const imageItem = Array.from(items).find((it) => it.kind === 'file' && it.type.startsWith('image/'))
    if (!imageItem) return
    const file = imageItem.getAsFile()
    if (!file) return
    e.preventDefault()
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'img'
    void subirPortada(new File([file], `captura-${Date.now()}.${ext}`, { type: file.type }))
  }

  const mejorar = async () => {
    setPlotAi(true)
    try {
      const improved = await improveOpDescriptionWithPlotAI({
        currentDescription: descripcion,
        clientOrTitle: venta.cliente_nombre,
        opNumber: venta.numero_venta,
        sector: selectedSectores.join(', ') || undefined
      })
      if (!improved) {
        alert('PlotAI no devolvió texto. Intentá de nuevo.')
        return
      }
      setDescripcion(improved)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al mejorar con PlotAI.')
    } finally {
      setPlotAi(false)
    }
  }

  const crear = async () => {
    if (venta.numero_op) return
    if (!selectedSectores.length) {
      alert('Elegí al menos un sector.')
      return
    }
    if (!descripcion.trim()) {
      alert('La descripción del trabajo es obligatoria.')
      return
    }
    if (subiendoPortada) {
      alert('Esperá a que termine de subirse la captura.')
      return
    }
    const requiereMetros = selectedSectores.includes('Taller Gráfico')
    const metrosNum = parseFloat(metros.replace(',', '.'))
    if (requiereMetros && !(metrosNum > 0)) {
      alert('Si la OP incluye Taller Gráfico, los metros cuadrados (m²) son obligatorios.')
      return
    }
    if (opSectoresRequierenFotosLugar(selectedSectores) && !portadaUrl) {
      alert('Instalaciones / Metalúrgica piden una foto del lugar. Pegá la captura para usarla como portada.')
      return
    }

    const hora = normalizeHoraEstimada(horaEstimada)
    const primer = selectedSectores[0]
    setGuardando(true)
    try {
      const ordenResponse = await apiService.createOrden({
        numero_op: venta.numero_venta,
        cliente: venta.cliente_nombre,
        dni_cuit: venta.cliente_dni_cuit || undefined,
        telefono_cliente: venta.cliente_telefono || undefined,
        email_cliente: venta.cliente_email || undefined,
        direccion_cliente: venta.cliente_direccion || undefined,
        descripcion: descripcion.trim(),
        estado: primer,
        prioridad,
        complejidad,
        fecha_entrega: fechaEntrega || null,
        hora_estimada: hora,
        sector: primer,
        sector_inicial: primer,
        sectores: selectedSectores,
        operario_asignado: operario || null,
        nombre_creador: creadorNombre,
        etiquetas: tags.length ? tags : null,
        metros_cuadrados: metrosNum > 0 ? metrosNum : null,
        foto_url: portadaUrl || null
      })
      if (!ordenResponse.success || !ordenResponse.data) {
        throw new Error(ordenResponse.error || 'No se pudo crear la OP')
      }
      const orden = ordenResponse.data
      if (portadaUrl) {
        await apiService.guardarArchivoOrden(orden.id, portadaNombre || 'portada', portadaUrl)
      }
      if (metrosNum > 0) {
        await apiService.actualizarMetrosOrden(orden.id, metrosNum, {
          motivo: 'Carga inicial de metros cuadrados (m²) al crear la OP.'
        })
      }
      await apiService.actualizarVenta(venta.id, {
        id_op: orden.id,
        numero_op: orden.numero_op
      })
      onCreated(orden.numero_op, orden.id)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al crear la OP')
    } finally {
      setGuardando(false)
    }
  }

  if (venta.numero_op) {
    return (
      <div className="vop-ok">
        <p>
          OP creada: <strong>{venta.numero_op}</strong>
        </p>
        <p className="vop-ok-sub">Venta {venta.numero_venta} · {venta.cliente_nombre}</p>
      </div>
    )
  }

  return (
    <div className="vop" onPaste={onPastePortada}>
      <h3>Crear OP</h3>
      <p className="vop-lead">
        Venta {venta.numero_venta} guardada. Completá la ficha o cerrá si no hace falta una OP.
      </p>

      <div
        className="vop-portada"
        tabIndex={0}
        onPaste={onPastePortada}
        role="group"
        aria-label="Portada de la OP"
      >
        {portadaPreview ? (
          <img src={portadaPreview} alt="Portada de la OP" />
        ) : (
          <p>Pegá una captura acá (Ctrl+V). Esa imagen queda como portada.</p>
        )}
        <div className="vop-portada-actions">
          <label className="vop-file">
            {subiendoPortada ? 'Subiendo…' : portadaUrl ? 'Cambiar captura' : 'Elegir imagen'}
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={subiendoPortada}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void subirPortada(file)
                e.target.value = ''
              }}
            />
          </label>
          {portadaUrl && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setPortadaPreview('')
                setPortadaUrl('')
                setPortadaNombre('')
              }}
            >
              Quitar portada
            </button>
          )}
        </div>
      </div>

      <div className="vop-row">
        <label>
          Fecha entrega
          <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
        </label>
        <label>
          Hora estimada
          <input
            type="time"
            step={60}
            value={horaEstimada}
            onChange={(e) => setHoraEstimada(normalizeHoraEstimada(e.target.value) || e.target.value)}
          />
        </label>
      </div>

      <label className="vop-block">
        Sectores de la OP (múltiple selección)
        <input
          type="text"
          placeholder="Buscar sectores..."
          value={sectorSearch}
          onChange={(e) => setSectorSearch(e.target.value)}
          onFocus={() => setSectorOpen(true)}
          onBlur={() => setTimeout(() => setSectorOpen(false), 150)}
        />
      </label>
      {sectorOpen && sectoresFiltrados.length > 0 && (
        <div className="vop-dropdown">
          {sectoresFiltrados.map((s) => (
            <button key={s.nombre} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => toggleSector(s.nombre)}>
              {selectedSectores.includes(s.nombre) ? '✓ ' : ''}
              {s.nombre}
            </button>
          ))}
        </div>
      )}
      {selectedSectores.length > 0 && (
        <div className="vop-pills">
          {selectedSectores.map((s) => (
            <span key={s}>
              {s}
              <button type="button" onClick={() => toggleSector(s)} aria-label={`Quitar ${s}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <label className="vop-block">
        Etiquetas (colores automáticos)
        <div className="vop-tag-row">
          <input
            type="text"
            placeholder="Ej: Urgente, Cliente VIP..."
            value={tagInput}
            onChange={(e) => {
              setTagInput(e.target.value)
              setTagOpen(true)
            }}
            onFocus={() => setTagOpen(true)}
            onBlur={() => setTimeout(() => setTagOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void agregarTag(tagSuggestions[0] || tagInput)
              }
            }}
          />
          <button type="button" className="btn-secondary" onClick={() => void agregarTag(tagInput)}>
            + Agregar
          </button>
        </div>
      </label>
      {tagOpen && tagSuggestions.length > 0 && (
        <div className="vop-dropdown">
          {tagSuggestions.map((n) => (
            <button key={n} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => void agregarTag(n)}>
              <i style={{ background: colorTag(n) }} />
              {n}
            </button>
          ))}
        </div>
      )}
      {tags.length > 0 && (
        <div className="vop-pills">
          {tags.map((t) => (
            <span key={t} style={{ background: colorTag(t), color: '#fff', borderColor: colorTag(t) }}>
              {t}
              <button type="button" onClick={() => setTags((prev) => prev.filter((x) => x !== t))} aria-label={`Quitar ${t}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="vop-row vop-row-3">
        <label>
          Operario
          <select value={operario} onChange={(e) => setOperario(e.target.value)}>
            <option value="">Seleccionar...</option>
            {operariosFiltrados.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Complejidad
          <select value={complejidad} onChange={(e) => setComplejidad(e.target.value)}>
            {COMPLEJIDAD.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prioridad
          <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
            {PRIORIDAD.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="vop-desc-head">
        <span>Descripción del trabajo *</span>
        <div>
          <button type="button" className="btn-secondary" onClick={() => setGuiaOpen(true)}>
            Cómo llenar la ficha
          </button>
          <button type="button" className="btn-secondary vop-plotai" onClick={() => void mejorar()} disabled={plotAi}>
            {plotAi ? 'Mejorando…' : '✨ Mejorar con PlotAI'}
          </button>
        </div>
      </div>
      <textarea
        rows={5}
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        placeholder="Qué se produce, cantidades, medidas, materiales, plazos, instalación o entrega..."
      />

      <label className="vop-block">
        Metros cuadrados (m²)
        <input
          type="text"
          inputMode="decimal"
          value={metros}
          onChange={(e) => setMetros(e.target.value)}
          placeholder="Obligatorio si incluye Taller Gráfico"
        />
      </label>

      <button type="button" className="btn-primary vop-crear" onClick={() => void crear()} disabled={guardando || subiendoPortada}>
        {guardando ? 'Creando OP…' : 'Crear OP'}
      </button>

      {guiaOpen && <OpFichaGuiaModal open onClose={() => setGuiaOpen(false)} />}
    </div>
  )
}
