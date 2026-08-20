import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WorkPoolJob, WorkPoolOrdenSugerida, WorkPoolProduct, WorkPoolSector } from '../../types/workPool'
import { WORK_POOL_ESTADO_LABELS, WORK_POOL_SECTOR_LABELS } from '../../types/workPool'
import { apiService } from '../../services/api'
import type { UsuarioRecord } from '../../types/api'
import {
  defaultSectorForProduct,
  rolesAsignablesWorkPoolSector,
  sectorsForProduct,
  WORK_POOL_PRODUCT_CONFIG
} from './workPoolConfig'
import { isOperarioExternoRol } from './workPoolOperarioExterno'
import {
  crearWorkPoolJob,
  findWorkPoolJobForOp,
  listPricingRules,
  listWorkPoolJobs,
  searchOrdenesWorkPool
} from './workPoolRepository'
import { parseWorkPoolOpQuery } from './workPoolOpSearch'
import WorkPoolOperarioRecommender from './WorkPoolOperarioRecommender'
import WorkPoolFuentesEntrada from './WorkPoolFuentesEntrada'
import type { PedidoClienteRecord } from '../../types/api'
import { TABLERO_COLA_SHORT } from './workPoolTablero'
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
  const [pedidoPortalSeleccionado, setPedidoPortalSeleccionado] = useState<PedidoClienteRecord | null>(
    null
  )

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
      const roles = rolesAsignablesWorkPoolSector(sector)
      setEmpleados(res.data.filter((u) => roles.includes(u.rol)))
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
      void searchOrdenesWorkPool(opQuery, 15, { incluirTableroSector: sector }).then((res) => {
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
  }, [opQuery, opSearchParsed.canSearch, compact, numeroOp, sector])

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
      opSeleccionada?.objetivo_proyecto?.trim(),
      opSeleccionada?.brief_publico?.trim(),
      opSeleccionada?.descripcion?.trim(),
      opSeleccionada?.cliente?.trim(),
      opSeleccionada?.sector?.trim()
    ].filter(Boolean)
    return parts.join(' · ')
  }, [createDesc, opSeleccionada])

  const aplicarTextoBrief = (orden: WorkPoolOrdenSugerida) => {
    const parts = [orden.objetivo_proyecto, orden.brief_publico, orden.descripcion].filter(Boolean)
    if (parts.length) setCreateDesc(parts.join('\n\n'))
  }

  const seleccionarOp = (orden: WorkPoolOrdenSugerida) => {
    setOpSeleccionada(orden)
    setCreateOp(orden.numero_op)
    setOpQuery(orden.numero_op)
    setOpDropdownOpen(false)
    if (!createDesc.trim()) aplicarTextoBrief(orden)
    else if (orden.objetivo_proyecto || orden.brief_publico) aplicarTextoBrief(orden)
  }

  const aplicarBriefPendiente = (texto: string, cliente?: string) => {
    if (texto) setCreateDesc(texto)
    if (cliente && !opQuery.trim()) setOpQuery(cliente)
  }

  const aplicarPedidoPortal = (pedido: PedidoClienteRecord) => {
    setPedidoPortalSeleccionado(pedido)
    setModo('asignado')
    const texto = [pedido.brief_publico, pedido.objetivo_proyecto, pedido.observaciones_cliente]
      .filter(Boolean)
      .join('\n\n')
    if (texto) setCreateDesc(texto)
    if (pedido.numero_op) {
      setCreateOp(pedido.numero_op)
      setOpQuery(pedido.numero_op)
      setOpSeleccionada(null)
      setOpDropdownOpen(true)
    } else {
      const cliente =
        (pedido as PedidoClienteRecord & { cliente?: { nombre?: string; empresa?: string } }).cliente?.empresa ||
        (pedido as PedidoClienteRecord & { cliente?: { nombre?: string } }).cliente?.nombre
      if (cliente) setOpQuery(cliente)
      else if (pedido.numero_pedido) setOpQuery(pedido.numero_pedido)
    }
  }

  const empleadoSeleccionado = empleados.find((u) => u.id === empleadoId)
  const asignadoEsExterno = isOperarioExternoRol(empleadoSeleccionado?.rol)
  const modoEfectivo = asignadoEsExterno ? 'asignado' : modo

  type PublishStep = 1 | 2 | 3 | 4
  const [step, setStep] = useState<PublishStep>(1)

  const stepsMeta = useMemo(
    () => [
      { id: 1 as const, label: 'Origen', hint: 'OP o pedido' },
      { id: 2 as const, label: 'Destino', hint: 'Bolsa o persona' },
      { id: 3 as const, label: 'Precio', hint: 'Tarifa / monto' },
      { id: 4 as const, label: 'Publicar', hint: 'Brief y listo' }
    ],
    []
  )

  const canGoNext = (from: PublishStep): boolean => {
    if (from === 1) return Boolean(createOp.trim() || pedidoPortalSeleccionado)
    if (from === 2) {
      if (pedidoPortalSeleccionado && !empleadoId) return false
      if (modo === 'asignado' && !empleadoId) return false
      return true
    }
    return true
  }

  const goNext = () => {
    setLocalError('')
    if (!canGoNext(step)) {
      if (step === 1) {
        setLocalError('Elegí una OP o un pedido del portal para seguir')
        return
      }
      if (step === 2) {
        setLocalError(
          pedidoPortalSeleccionado
            ? 'Los pedidos del portal requieren asignar un operario'
            : 'Elegí a quién asignar el trabajo'
        )
        return
      }
    }
    setStep((s) => Math.min(4, s + 1) as PublishStep)
  }

  const goBack = () => {
    setLocalError('')
    setStep((s) => Math.max(1, s - 1) as PublishStep)
  }

  const montoResumen = createMonto
    ? Number(createMonto)
    : createTarifa
      ? montoFromTarifa
      : 0

  const handleSubmit = async () => {
    if (!createOp.trim() && !pedidoPortalSeleccionado) {
      const msg = 'Indicá el número de OP o elegí un pedido del portal'
      setLocalError(msg)
      onError?.(msg)
      return
    }
    if (pedidoPortalSeleccionado && !empleadoId) {
      const msg = 'Los pedidos del portal se envían asignando un operario (no van solos a la bolsa)'
      setLocalError(msg)
      onError?.(msg)
      return
    }
    if (modoEfectivo === 'asignado' && !empleadoId) {
      const msg = 'Elegí el empleado u operario externo a asignar'
      setLocalError(msg)
      onError?.(msg)
      return
    }

    setCreating(true)
    setLocalError('')
    const res = await crearWorkPoolJob({
      sector,
      numero_op: createOp.trim() || undefined,
      titulo: pedidoPortalSeleccionado
        ? `Pedido ${pedidoPortalSeleccionado.numero_pedido}`
        : undefined,
      descripcion: createDesc.trim() || undefined,
      codigo_tarifa: createTarifa || undefined,
      monto: createMonto ? Number(createMonto) : undefined,
      id_usuario_creador: idUsuarioCreador,
      id_usuario_asignado: modoEfectivo === 'asignado' ? Number(empleadoId) : undefined,
      modo: modoEfectivo,
      id_pedido_cliente: pedidoPortalSeleccionado?.id,
      numero_pedido: pedidoPortalSeleccionado?.numero_pedido
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
    setPedidoPortalSeleccionado(null)
    setCreateDesc('')
    setCreateTarifa('')
    setCreateMonto('')
    setEmpleadoId('')
    setModo('bolsa')
    setStep(1)
    void loadDisponibles()
    onSuccess?.()
  }

  const sectorPicker =
    sectors.length > 1 ? (
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
    ) : null

  const opBlock = (
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
                <strong>
                  OP {orden.numero_op.trim()}
                  {orden.en_tablero || orden.en_tablero_diseno
                    ? ` · Tablero ${TABLERO_COLA_SHORT[sector]}`
                    : ''}
                </strong>
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
  )

  const destinoBlock = (
    <>
      <div className="work-pool-publicar__modo" role="radiogroup" aria-label="Modo de publicación">
        <button
          type="button"
          className={`work-pool-publicar__modo-btn${modo === 'bolsa' ? ' is-active' : ''}`}
          onClick={() => setModo('bolsa')}
          disabled={Boolean(pedidoPortalSeleccionado)}
        >
          <strong>Bolsa libre</strong>
          <span>Cualquier operario del sector puede tomarlo</span>
        </button>
        <button
          type="button"
          className={`work-pool-publicar__modo-btn${modo === 'asignado' || pedidoPortalSeleccionado ? ' is-active' : ''}`}
          onClick={() => setModo('asignado')}
        >
          <strong>Asignar persona</strong>
          <span>Va directo a un integrante o freelancer</span>
        </button>
      </div>

      {(modo === 'asignado' || pedidoPortalSeleccionado) && (
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
            Buscar ({WORK_POOL_SECTOR_LABELS[sector]})
            <input
              value={empleadoQuery}
              onChange={(e) => setEmpleadoQuery(e.target.value)}
              placeholder="Nombre…"
            />
          </label>
          <div className="work-pool-publicar__empleado-grid">
            {empleadosFiltrados.length === 0 ? (
              <p className="work-pool-publicar__muted">No hay personas para este sector.</p>
            ) : (
              empleadosFiltrados.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className={`work-pool-publicar__empleado-card${empleadoId === u.id ? ' is-active' : ''}`}
                  onClick={() => {
                    const next = empleadoId === u.id ? '' : u.id
                    setEmpleadoId(next)
                    if (next && isOperarioExternoRol(u.rol)) setModo('asignado')
                  }}
                >
                  {u.nombre}
                  {isOperarioExternoRol(u.rol) ? ' · externo' : ''}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </>
  )

  const precioBlock = (
    <>
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
    </>
  )

  const briefBlock = (
    <div className="work-pool-module__form-row">
      <label style={{ gridColumn: '1 / -1' }}>
        Descripción / brief
        <textarea
          value={createDesc}
          onChange={(e) => setCreateDesc(e.target.value)}
          placeholder="Qué debe hacer el operario…"
          rows={5}
        />
      </label>
    </div>
  )

  // Compact: flujo plano (p. ej. desde ficha OP)
  if (compact) {
    return (
      <div className="work-pool-publicar work-pool-publicar--compact">
        {sectorPicker}
        {pedidoPortalSeleccionado && (
          <div className="work-pool-module__alert work-pool-module__alert--info">
            Pedido portal <strong>{pedidoPortalSeleccionado.numero_pedido}</strong> listo para asignar.
          </div>
        )}
        {destinoBlock}
        {opBlock}
        {precioBlock}
        {briefBlock}
        {localError && <div className="work-pool-module__alert work-pool-module__alert--error">{localError}</div>}
        <button
          type="button"
          className="work-pool-module__btn work-pool-module__btn--primary"
          disabled={creating}
          onClick={() => void handleSubmit()}
        >
          {creating
            ? 'Publicando…'
            : modoEfectivo === 'bolsa'
              ? `Publicar en bolsa ${cfg.shortLabel}`
              : 'Asignar a empleado'}
        </button>
      </div>
    )
  }

  return (
    <div className={`work-pool-publicar work-pool-publicar--wizard work-pool-publicar--${product}`}>
      <header className="work-pool-publicar__hero">
        <span className="work-pool-publicar__hero-mark" aria-hidden>
          {cfg.icon}
        </span>
        <div>
          <p className="work-pool-publicar__hero-eyebrow">Publicar trabajo</p>
          <h3>Nueva pieza en {cfg.label}</h3>
          <p className="work-pool-publicar__hint">
            Cuatro pasos: origen → destino → precio → brief. Claro y listo para bolsa o asignación.
          </p>
        </div>
      </header>

      {sectorPicker}

      <nav className="work-pool-publicar__steps" aria-label="Etapas de publicación">
        {stepsMeta.map((s) => {
          const done = step > s.id
          const current = step === s.id
          return (
            <button
              key={s.id}
              type="button"
              className={`work-pool-publicar__step${done ? ' is-done' : ''}${current ? ' is-current' : ''}`}
              onClick={() => {
                if (done || current) setStep(s.id)
              }}
              disabled={!done && !current}
            >
              <span className="work-pool-publicar__step-num" aria-hidden>
                {done ? '✓' : s.id}
              </span>
              <span className="work-pool-publicar__step-copy">
                <strong>{s.label}</strong>
                <em>{s.hint}</em>
              </span>
            </button>
          )
        })}
      </nav>

      <div className="work-pool-publicar__stage" key={step}>
        {step === 1 && (
          <>
            <div className="work-pool-publicar__stage-head">
              <h4>1 · Origen del trabajo</h4>
              <p>Buscá la OP del tablero o tomá una entrada (brief / pedido portal).</p>
            </div>

            <section className="work-pool-publicar__disponibles work-pool-publicar__disponibles--compact">
              <div className="work-pool-publicar__disponibles-head">
                <h4>Ya en bolsa ({WORK_POOL_SECTOR_LABELS[sector]})</h4>
                <span className="work-pool-publicar__pill">{disponibles.length}</span>
              </div>
              {loadingDisponibles ? (
                <p className="work-pool-publicar__muted">Cargando…</p>
              ) : disponibles.length === 0 ? (
                <p className="work-pool-publicar__muted">Ninguno disponible ahora — podés publicar el primero.</p>
              ) : (
                <div className="work-pool-publicar__disponibles-grid">
                  {disponibles.slice(0, 4).map((job) => (
                    <article key={job.id} className="work-pool-publicar__disp-card">
                      <strong>{job.titulo}</strong>
                      <span>{job.numero_op ? `OP ${job.numero_op}` : 'Sin OP'}</span>
                      <span>{formatArs(job.monto_presupuestado)}</span>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {pedidoPortalSeleccionado && (
              <div className="work-pool-module__alert work-pool-module__alert--info">
                Pedido portal <strong>{pedidoPortalSeleccionado.numero_pedido}</strong> seleccionado.
              </div>
            )}

            <WorkPoolFuentesEntrada
              product={product}
              sector={sector}
              idUsuarioCreador={idUsuarioCreador}
              onSeleccionarOp={seleccionarOp}
              onAplicarBrief={aplicarBriefPendiente}
              onAplicarPedido={aplicarPedidoPortal}
            />
            {opBlock}
          </>
        )}

        {step === 2 && (
          <>
            <div className="work-pool-publicar__stage-head">
              <h4>2 · Destino</h4>
              <p>
                {createOp.trim()
                  ? `OP ${createOp.trim()} · ¿bolsa libre o asignación directa?`
                  : '¿Bolsa libre o asignación directa?'}
              </p>
            </div>
            {destinoBlock}
          </>
        )}

        {step === 3 && (
          <>
            <div className="work-pool-publicar__stage-head">
              <h4>3 · Precio</h4>
              <p>Elegí una tarifa del listado o cargá un monto manual.</p>
            </div>
            {precioBlock}
          </>
        )}

        {step === 4 && (
          <>
            <div className="work-pool-publicar__stage-head">
              <h4>4 · Brief y confirmar</h4>
              <p>Último vistazo antes de publicar.</p>
            </div>

            <div className="work-pool-publicar__resumen" aria-label="Resumen">
              <div>
                <small>Origen</small>
                <strong>
                  {pedidoPortalSeleccionado
                    ? `Pedido ${pedidoPortalSeleccionado.numero_pedido}`
                    : createOp.trim()
                      ? `OP ${createOp.trim()}`
                      : '—'}
                </strong>
              </div>
              <div>
                <small>Destino</small>
                <strong>
                  {modoEfectivo === 'bolsa'
                    ? 'Bolsa libre'
                    : empleadoSeleccionado?.nombre ?? 'Asignado'}
                </strong>
              </div>
              <div>
                <small>Monto</small>
                <strong>{montoResumen > 0 ? formatArs(montoResumen) : 'Sin definir'}</strong>
              </div>
              <div>
                <small>Sector</small>
                <strong>{WORK_POOL_SECTOR_LABELS[sector]}</strong>
              </div>
            </div>

            {briefBlock}
          </>
        )}
      </div>

      {localError && <div className="work-pool-module__alert work-pool-module__alert--error">{localError}</div>}

      <div className="work-pool-publicar__nav">
        {step > 1 ? (
          <button type="button" className="work-pool-module__btn work-pool-module__btn--ghost" onClick={goBack}>
            ← Atrás
          </button>
        ) : (
          <span />
        )}
        {step < 4 ? (
          <button type="button" className="work-pool-module__btn work-pool-module__btn--primary" onClick={goNext}>
            Siguiente →
          </button>
        ) : (
          <button
            type="button"
            className="work-pool-module__btn work-pool-module__btn--primary"
            disabled={creating}
            onClick={() => void handleSubmit()}
          >
            {creating
              ? 'Publicando…'
              : modoEfectivo === 'bolsa'
                ? `Publicar en bolsa ${cfg.shortLabel}`
                : 'Asignar y publicar'}
          </button>
        )}
      </div>
    </div>
  )
}
