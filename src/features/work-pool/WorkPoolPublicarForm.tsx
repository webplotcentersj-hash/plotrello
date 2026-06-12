import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WorkPoolJob, WorkPoolOrdenSugerida, WorkPoolProduct, WorkPoolSector } from '../../types/workPool'
import { WORK_POOL_ESTADO_LABELS, WORK_POOL_SECTOR_LABELS } from '../../types/workPool'
import { apiService } from '../../services/api'
import type { UsuarioRecord } from '../../types/api'
import {
  defaultSectorForProduct,
  rolForWorkPoolSector,
  sectorsForProduct,
  WORK_POOL_PRODUCT_CONFIG
} from './workPoolConfig'
import {
  crearWorkPoolJob,
  findWorkPoolJobForOp,
  listPricingRules,
  listWorkPoolJobs,
  searchOrdenesWorkPool
} from './workPoolRepository'
import { parseWorkPoolOpQuery } from './workPoolOpSearch'
import WorkPoolOperarioRecommender from './WorkPoolOperarioRecommender'
import './WorkPoolModule.css'

function resumenDescripcion(text: string | null | undefined, max = 72): string {
  if (!text?.trim()) return ''
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length <= max ? one : `${one.slice(0, max)}…`
}

export type WorkPoolPublicarFormProps = {
  product: WorkPoolProduct
  idUsuarioCreador: number
  numeroOp?: string
  descripcionInicial?: string
  sectorInicial?: WorkPoolSector
  onSuccess?: () => void
  onError?: (msg: string) => void
  compact?: boolean
}

function formatArs(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

type ModoPublicacion = 'bolsa' | 'asignado'

export default function WorkPoolPublicarForm({
  product,
  idUsuarioCreador,
  numeroOp = '',
  descripcionInicial = '',
  sectorInicial,
  onSuccess,
  onError,
  compact = false
}: WorkPoolPublicarFormProps) {
  const sectors = sectorsForProduct(product)
  const cfg = WORK_POOL_PRODUCT_CONFIG[product]

  const [sector, setSector] = useState<WorkPoolSector>(
    sectorInicial && sectors.includes(sectorInicial)
      ? sectorInicial
      : defaultSectorForProduct(product)
  )
  const [modo, setModo] = useState<ModoPublicacion>('bolsa')
  const [createOp, setCreateOp] = useState(numeroOp)
  const [createDesc, setCreateDesc] = useState(descripcionInicial)
  const [createTarifa, setCreateTarifa] = useState('')
  const [createMonto, setCreateMonto] = useState('')
  const [empleadoId, setEmpleadoId] = useState<number | ''>('')
  const [tarifas, setTarifas] = useState<Array<{ codigo: string; nombre: string; monto_base: number }>>([])
  const [empleados, setEmpleados] = useState<UsuarioRecord[]>([])
  const [creating, setCreating] = useState(false)
  const [localError, setLocalError] = useState('')

  const [opQuery, setOpQuery] = useState(numeroOp)
  const [opSugerencias, setOpSugerencias] = useState<WorkPoolOrdenSugerida[]>([])
  const [opBuscando, setOpBuscando] = useState(false)
  const [opSearchError, setOpSearchError] = useState<string | null>(null)
  const [opDropdownOpen, setOpDropdownOpen] = useState(false)
  const [opSeleccionada, setOpSeleccionada] = useState<WorkPoolOrdenSugerida | null>(null)
  const [jobExistente, setJobExistente] = useState<WorkPoolJob | null>(null)

  const [tarifaQuery, setTarifaQuery] = useState('')
  const [empleadoQuery, setEmpleadoQuery] = useState('')

  const [disponibles, setDisponibles] = useState<WorkPoolJob[]>([])
  const [loadingDisponibles, setLoadingDisponibles] = useState(false)

  const opSearchRef = useRef<HTMLDivElement>(null)

  const loadDisponibles = useCallback(async () => {
    setLoadingDisponibles(true)
    const res = await listWorkPoolJobs({ sector, soloDisponibles: true })
    if (res.success) setDisponibles(res.data ?? [])
    setLoadingDisponibles(false)
  }, [sector])

  useEffect(() => {
    setCreateOp(numeroOp)
    setOpQuery(numeroOp)
  }, [numeroOp])

  useEffect(() => {
    if (descripcionInicial) setCreateDesc(descripcionInicial)
  }, [descripcionInicial])

  useEffect(() => {
    void listPricingRules(sector).then((res) => {
      if (res.success) setTarifas(res.data ?? [])
    })
    void loadDisponibles()
  }, [sector, loadDisponibles])

  useEffect(() => {
    void apiService.getUsuarios().then((res) => {
      if (!res.success || !res.data) return
      const rol = rolForWorkPoolSector(sector)
      setEmpleados(res.data.filter((u) => u.rol === rol))
    })
  }, [sector])

  const opSearchParsed = useMemo(() => parseWorkPoolOpQuery(opQuery), [opQuery])

  useEffect(() => {
    if (compact && numeroOp) return
    if (!opSearchParsed.canSearch) {
      setOpSugerencias([])
      setOpBuscando(false)
      setOpSearchError(null)
      return
    }
    setOpBuscando(true)
    setOpSearchError(null)
    const t = window.setTimeout(() => {
      void searchOrdenesWorkPool(opQuery, 15).then((res) => {
        setOpBuscando(false)
        if (res.success) {
          setOpSugerencias(res.data ?? [])
          setOpDropdownOpen(true)
        } else {
          setOpSugerencias([])
          setOpSearchError(res.error ?? 'No se pudo buscar en la base.')
        }
      })
    }, 300)
    return () => window.clearTimeout(t)
  }, [opQuery, opSearchParsed.canSearch, compact, numeroOp])

  useEffect(() => {
    const op = createOp.trim()
    if (!op) {
      setJobExistente(null)
      return
    }
    void findWorkPoolJobForOp(op, sector).then((res) => {
      if (res.success) setJobExistente(res.data ?? null)
    })
  }, [createOp, sector])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (opSearchRef.current && !opSearchRef.current.contains(e.target as Node)) {
        setOpDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const tarifasFiltradas = useMemo(() => {
    const q = tarifaQuery.trim().toLowerCase()
    if (!q) return tarifas
    return tarifas.filter(
      (t) => t.nombre.toLowerCase().includes(q) || t.codigo.toLowerCase().includes(q)
    )
  }, [tarifas, tarifaQuery])

  const empleadosFiltrados = useMemo(() => {
    const q = empleadoQuery.trim().toLowerCase()
    if (!q) return empleados
    return empleados.filter((u) => u.nombre.toLowerCase().includes(q))
  }, [empleados, empleadoQuery])

  const montoFromTarifa = useMemo(() => {
    const t = tarifas.find((x) => x.codigo === createTarifa)
    return t?.monto_base ?? 0
  }, [tarifas, createTarifa])

  const briefParaIA = useMemo(() => {
    const parts = [
      createDesc.trim(),
      opSeleccionada?.descripcion?.trim(),
      opSeleccionada?.cliente?.trim(),
      opSeleccionada?.sector?.trim()
    ].filter(Boolean)
    return parts.join(' · ')
  }, [createDesc, opSeleccionada])

  const seleccionarOp = (orden: WorkPoolOrdenSugerida) => {
    setOpSeleccionada(orden)
    setCreateOp(orden.numero_op)
    setOpQuery(orden.numero_op)
    setOpDropdownOpen(false)
    if (!createDesc.trim() && orden.descripcion) {
      setCreateDesc(orden.descripcion)
    }
  }

  const handleSubmit = async () => {
    if (!createOp.trim()) {
      const msg = 'Indicá el número de OP'
      setLocalError(msg)
      onError?.(msg)
      return
    }
    if (modo === 'asignado' && !empleadoId) {
      const msg = 'Elegí el empleado a asignar'
      setLocalError(msg)
      onError?.(msg)
      return
    }

    setCreating(true)
    setLocalError('')
    const res = await crearWorkPoolJob({
      sector,
      numero_op: createOp.trim(),
      descripcion: createDesc.trim() || undefined,
      codigo_tarifa: createTarifa || undefined,
      monto: createMonto ? Number(createMonto) : undefined,
      id_usuario_creador: idUsuarioCreador,
      id_usuario_asignado: modo === 'asignado' ? Number(empleadoId) : undefined,
      modo
    })
    setCreating(false)

    if (!res.success) {
      const msg = res.error || 'No se pudo crear el trabajo'
      setLocalError(msg)
      onError?.(msg)
      return
    }

    setCreateOp(numeroOp)
    setOpQuery(numeroOp)
    setOpSeleccionada(null)
    setCreateDesc('')
    setCreateTarifa('')
    setCreateMonto('')
    setEmpleadoId('')
    setModo('bolsa')
    void loadDisponibles()
    onSuccess?.()
  }

  return (
    <div className={`work-pool-publicar${compact ? ' work-pool-publicar--compact' : ''}`}>
      {!compact && (
        <>
          <h3>
            {cfg.icon} Publicar en {cfg.label}
          </h3>
          <p className="work-pool-publicar__hint">
            Buscá la OP, elegí tarifario y publicá en bolsa o asigná a un empleado.
          </p>
        </>
      )}

      {sectors.length > 1 && (
        <div className="work-pool-module__tabs work-pool-publicar__sectors">
          {sectors.map((s) => (
            <button
              key={s}
              type="button"
              className={`work-pool-module__tab${sector === s ? ' is-active' : ''}`}
              onClick={() => setSector(s)}
            >
              {WORK_POOL_SECTOR_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      {/* Bolsa disponible actual */}
      <section className="work-pool-publicar__disponibles">
        <div className="work-pool-publicar__disponibles-head">
          <h4>Disponibles en bolsa ({WORK_POOL_SECTOR_LABELS[sector]})</h4>
          <span className="work-pool-publicar__pill">{disponibles.length}</span>
        </div>
        {loadingDisponibles ? (
          <p className="work-pool-publicar__muted">Cargando…</p>
        ) : disponibles.length === 0 ? (
          <p className="work-pool-publicar__muted">No hay trabajos disponibles en este sector.</p>
        ) : (
          <div className="work-pool-publicar__disponibles-grid">
            {disponibles.map((job) => (
              <article key={job.id} className="work-pool-publicar__disp-card">
                <strong>{job.titulo}</strong>
                <span>{job.numero_op ? `OP ${job.numero_op}` : 'Sin OP'}</span>
                <span>{formatArs(job.monto_presupuestado)}</span>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="work-pool-publicar__modo" role="radiogroup" aria-label="Modo de publicación">
        <button
          type="button"
          className={`work-pool-publicar__modo-btn${modo === 'bolsa' ? ' is-active' : ''}`}
          onClick={() => setModo('bolsa')}
        >
          <strong>Bolsa libre</strong>
          <span>Cualquier operario del sector puede tomarlo</span>
        </button>
        <button
          type="button"
          className={`work-pool-publicar__modo-btn${modo === 'asignado' ? ' is-active' : ''}`}
          onClick={() => setModo('asignado')}
        >
          <strong>Asignar empleado</strong>
          <span>Va directo a un integrante del equipo</span>
        </button>
      </div>

      {/* Buscador OP */}
      <div className="work-pool-publicar__search-block" ref={opSearchRef}>
        <label className="work-pool-publicar__search-label">
          Buscar OP <span className="work-pool-publicar__req">*</span>
          <input
            value={opQuery}
            onChange={(e) => {
              setOpQuery(e.target.value)
              setCreateOp(e.target.value)
              setOpSeleccionada(null)
            }}
            onFocus={() => {
              if (opSugerencias.length > 0 || opSearchParsed.canSearch) setOpDropdownOpen(true)
            }}
            placeholder="Nº OP (ej. 100660), cliente, DNI, #id…"
            readOnly={Boolean(numeroOp) && compact}
            autoComplete="off"
          />
        </label>
        {opBuscando && <span className="work-pool-publicar__search-status">Buscando en toda la base…</span>}
        {opSearchError && (
          <span className="work-pool-publicar__search-status work-pool-publicar__search-status--error" role="alert">
            {opSearchError}
          </span>
        )}
        {opDropdownOpen && opSearchParsed.canSearch && !opBuscando && opSugerencias.length === 0 && !opSearchError && (
          <p className="work-pool-publicar__search-empty">Sin coincidencias. Probá nº OP, apellido o #id de BD.</p>
        )}
        {opDropdownOpen && opSugerencias.length > 0 && (
          <ul className="work-pool-publicar__dropdown" role="listbox">
            {opSugerencias.map((orden) => (
              <li key={orden.id}>
                <button type="button" onClick={() => seleccionarOp(orden)}>
                  <strong>OP {orden.numero_op.trim()}</strong>
                  <span>{orden.cliente}</span>
                  {orden.descripcion ? (
                    <small className="work-pool-publicar__dropdown-desc">{resumenDescripcion(orden.descripcion)}</small>
                  ) : null}
                  <small>
                    #{orden.id} · {orden.estado}
                    {orden.sector ? ` · ${orden.sector}` : ''}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        )}
        {opSeleccionada && (
          <div className="work-pool-publicar__op-preview">
            <strong>OP {opSeleccionada.numero_op}</strong> — {opSeleccionada.cliente}
            <span>{opSeleccionada.estado}</span>
          </div>
        )}
        {jobExistente && (
          <div className="work-pool-module__alert work-pool-module__alert--info">
            Esta OP ya tiene un trabajo en {WORK_POOL_SECTOR_LABELS[sector]} (
            {WORK_POOL_ESTADO_LABELS[jobExistente.estado]}).
          </div>
        )}
      </div>

      {/* Tarifario con buscador */}
      <div className="work-pool-publicar__search-block">
        <label className="work-pool-publicar__search-label">
          Tarifario disponible
          <input
            value={tarifaQuery}
            onChange={(e) => setTarifaQuery(e.target.value)}
            placeholder="Buscar tarifa…"
          />
        </label>
        {tarifasFiltradas.length === 0 ? (
          <p className="work-pool-publicar__muted">Sin tarifas para este sector.</p>
        ) : (
          <div className="work-pool-publicar__tarifa-grid">
            {tarifasFiltradas.map((t) => (
              <button
                key={t.codigo}
                type="button"
                className={`work-pool-publicar__tarifa-card${createTarifa === t.codigo ? ' is-active' : ''}`}
                onClick={() => setCreateTarifa(createTarifa === t.codigo ? '' : t.codigo)}
              >
                <strong>{t.nombre}</strong>
                <span>{formatArs(t.monto_base)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="work-pool-module__form-row">
        <label>
          Monto manual (opcional)
          <input
            type="number"
            min="0"
            value={createMonto}
            onChange={(e) => setCreateMonto(e.target.value)}
            placeholder={createTarifa ? String(montoFromTarifa) : '0'}
          />
        </label>
      </div>

      {modo === 'asignado' && (
        <div className="work-pool-publicar__search-block">
          <WorkPoolOperarioRecommender
            sector={sector}
            candidatos={empleados}
            descripcion={briefParaIA}
            codigoTarifa={createTarifa}
            empleadoQuery={empleadoQuery}
            selectedId={empleadoId}
            onSelect={(id) => setEmpleadoId(id)}
          />
          <label className="work-pool-publicar__search-label">
            Buscar empleado ({WORK_POOL_SECTOR_LABELS[sector]})
            <input
              value={empleadoQuery}
              onChange={(e) => setEmpleadoQuery(e.target.value)}
              placeholder="Nombre del operario…"
            />
          </label>
          <div className="work-pool-publicar__empleado-grid">
            {empleadosFiltrados.length === 0 ? (
              <p className="work-pool-publicar__muted">No hay empleados para este sector.</p>
            ) : (
              empleadosFiltrados.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className={`work-pool-publicar__empleado-card${empleadoId === u.id ? ' is-active' : ''}`}
                  onClick={() => setEmpleadoId(empleadoId === u.id ? '' : u.id)}
                >
                  {u.nombre}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <div className="work-pool-module__form-row">
        <label style={{ gridColumn: '1 / -1' }}>
          Descripción / brief
          <textarea
            value={createDesc}
            onChange={(e) => setCreateDesc(e.target.value)}
            placeholder="Qué debe hacer el operario…"
          />
        </label>
      </div>

      {localError && <div className="work-pool-module__alert work-pool-module__alert--error">{localError}</div>}

      <button
        type="button"
        className="work-pool-module__btn work-pool-module__btn--primary"
        disabled={creating}
        onClick={() => void handleSubmit()}
      >
        {creating
          ? 'Publicando…'
          : modo === 'bolsa'
            ? `Publicar en bolsa ${cfg.shortLabel}`
            : 'Asignar a empleado'}
      </button>
    </div>
  )
}
