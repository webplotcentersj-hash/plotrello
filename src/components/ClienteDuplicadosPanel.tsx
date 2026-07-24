import { useEffect, useMemo, useState } from 'react'
import type { ClienteRecord } from '../types/api'
import apiService from '../services/api'
import { nombreCompletoCliente } from '../utils/buscarClienteMatch'
import {
  CAMPOS_FUSION_CLIENTE,
  componerDatosFusion,
  opcionesCampoFusion,
  type CampoFusionCliente,
  type DatosFusionCliente,
  type OrigenCampoFusion
} from '../utils/clienteFusion'
import {
  analizarParDuplicado,
  detectarGruposDuplicados,
  etiquetaRazonDuplicado,
  type GrupoDuplicadoClientes,
  type RazonDuplicado
} from '../utils/clienteDuplicados'
import './ClienteDuplicadosPanel.css'

type Props = {
  /** Cliente de referencia (detalle) o null si solo hay resultados de búsqueda */
  clienteReferencia?: ClienteRecord | null
  candidatos: ClienteRecord[]
  onFusionCompleta: (principal: ClienteRecord, idsFusionados: number[]) => void
  onVerCliente?: (c: ClienteRecord) => void
  /** Si una ficha se editó fuera del flujo de fusión */
  onClienteActualizado?: (c: ClienteRecord) => void
}

type EditDraft = {
  nombre: string
  apellido: string
  empresa: string
  dni_cuit: string
  telefono: string
  email: string
  direccion: string
}

function draftFromCliente(c: ClienteRecord): EditDraft {
  return {
    nombre: c.nombre || '',
    apellido: c.apellido || '',
    empresa: c.empresa || '',
    dni_cuit: c.dni_cuit || '',
    telefono: c.telefono || '',
    email: c.email || '',
    direccion: c.direccion || ''
  }
}

function razonesEntreGrupo(
  grupo: ClienteRecord[],
  referencia?: ClienteRecord | null
): RazonDuplicado[] {
  const set = new Set<RazonDuplicado>()
  const ref = referencia ?? grupo[0]
  for (const c of grupo) {
    if (c.id === ref.id) continue
    analizarParDuplicado(ref, c).razones.forEach((r) => set.add(r))
  }
  if (set.size === 0) {
    for (let i = 0; i < grupo.length; i++) {
      for (let j = i + 1; j < grupo.length; j++) {
        analizarParDuplicado(grupo[i], grupo[j]).razones.forEach((r) => set.add(r))
      }
    }
  }
  return [...set]
}

function GrupoDuplicadoCard({
  grupo,
  referencia,
  onFusionCompleta,
  onVerCliente,
  onClienteActualizado
}: {
  grupo: GrupoDuplicadoClientes | { clientes: ClienteRecord[]; confianza?: number }
  referencia?: ClienteRecord | null
  onFusionCompleta: (principal: ClienteRecord, idsFusionados: number[]) => void
  onVerCliente?: (c: ClienteRecord) => void
  onClienteActualizado?: (c: ClienteRecord) => void
}) {
  const [clientes, setClientes] = useState(grupo.clientes)
  const defaultPrincipal =
    referencia && clientes.some((c) => c.id === referencia.id)
      ? referencia.id
      : clientes[0]?.id ?? 0

  const [idPrincipal, setIdPrincipal] = useState(defaultPrincipal)
  const [incluidos, setIncluidos] = useState<Set<number>>(
    () => new Set(grupo.clientes.map((c) => c.id))
  )
  const [editId, setEditId] = useState<number | null>(null)
  const [draft, setDraft] = useState<EditDraft | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [fusionando, setFusionando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [origenes, setOrigenes] = useState<OrigenCampoFusion>({})
  const [datosFinales, setDatosFinales] = useState<DatosFusionCliente | null>(null)

  useEffect(() => {
    setClientes(grupo.clientes)
    setIncluidos(new Set(grupo.clientes.map((c) => c.id)))
    const nextPrincipal =
      referencia && grupo.clientes.some((c) => c.id === referencia.id)
        ? referencia.id
        : grupo.clientes[0]?.id ?? 0
    setIdPrincipal(nextPrincipal)
    setOrigenes({})
  }, [grupo, referencia])

  const incluidosList = useMemo(
    () => clientes.filter((c) => incluidos.has(c.id)),
    [clientes, incluidos]
  )

  useEffect(() => {
    if (incluidosList.length === 0 || !idPrincipal) {
      setDatosFinales(null)
      return
    }
    setDatosFinales(componerDatosFusion(incluidosList, idPrincipal, origenes))
    // Solo al cambiar el grupo / principal: los edits manuales y selects tocan datosFinales directo.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- origenes se aplica en setOrigenCampo / recomponerAuto
  }, [incluidosList, idPrincipal])

  const razones =
    'razones' in grupo && grupo.razones.length > 0
      ? grupo.razones
      : razonesEntreGrupo(clientes, referencia)

  const confianza = 'confianza' in grupo ? grupo.confianza : 70
  const secundarios = clientes.filter(
    (c) => incluidos.has(c.id) && c.id !== idPrincipal
  )
  const radioName = `principal-${clientes.map((x) => x.id).join('-')}`

  const setOrigenCampo = (key: CampoFusionCliente, idFuente: number) => {
    setOrigenes((prev) => ({ ...prev, [key]: idFuente }))
    const src = incluidosList.find((c) => c.id === idFuente)
    const valor = src ? String(src[key] ?? '').trim() : ''
    setDatosFinales((prev) => (prev ? { ...prev, [key]: valor } : prev))
  }

  const recomponerAuto = () => {
    setOrigenes({})
    if (incluidosList.length && idPrincipal) {
      setDatosFinales(componerDatosFusion(incluidosList, idPrincipal, {}))
    }
  }

  const toggleIncluido = (id: number) => {
    setIncluidos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        if (id === idPrincipal) return prev
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const abrirEdicion = (c: ClienteRecord) => {
    setEditId(c.id)
    setDraft(draftFromCliente(c))
    setError(null)
    setOkMsg(null)
  }

  const cancelarEdicion = () => {
    setEditId(null)
    setDraft(null)
  }

  const guardarEdicion = async () => {
    if (editId == null || !draft) return
    setGuardando(true)
    setError(null)
    setOkMsg(null)
    try {
      const res = await apiService.actualizarClienteDatos(editId, {
        nombre: draft.nombre.trim(),
        apellido: draft.apellido.trim() || undefined,
        empresa: draft.empresa.trim() || undefined,
        dni_cuit: draft.dni_cuit.trim() || undefined,
        telefono: draft.telefono.trim() || undefined,
        email: draft.email.trim() || undefined,
        direccion: draft.direccion.trim() || undefined
      })
      if (!res.success || !res.data) {
        setError(res.error || 'No se pudo guardar')
        return
      }
      const actualizado = res.data
      setClientes((prev) => prev.map((c) => (c.id === actualizado.id ? actualizado : c)))
      onClienteActualizado?.(actualizado)
      setOkMsg(`Ficha #${actualizado.id} actualizada`)
      cancelarEdicion()
    } finally {
      setGuardando(false)
    }
  }

  const fusionarTodos = async () => {
    if (!idPrincipal || secundarios.length === 0 || !datosFinales) return
    if (!incluidos.has(idPrincipal)) {
      setError('El cliente principal debe estar incluido en la unificación')
      return
    }
    if (!datosFinales.nombre.trim()) {
      setError('El nombre resultante no puede quedar vacío')
      return
    }
    const ok = window.confirm(
      `¿Dejar una sola ficha (#${idPrincipal}) y desactivar ${secundarios.length} repetida${secundarios.length === 1 ? '' : 's'}?\n\n` +
        `Quedará: ${datosFinales.nombre}${datosFinales.apellido ? ` ${datosFinales.apellido}` : ''}` +
        `${datosFinales.dni_cuit ? ` · ${datosFinales.dni_cuit}` : ''}\n` +
        `Todo el historial (ventas, pedidos, OPs, CC) pasa a esa ficha.`
    )
    if (!ok) return

    setFusionando(true)
    setError(null)
    setOkMsg(null)
    try {
      const res = await apiService.fusionarGrupoClientes(
        idPrincipal,
        secundarios.map((s) => s.id),
        datosFinales
      )
      if (!res.success || !res.data) {
        setError(res.error || 'No se pudo unificar')
        return
      }
      setOkMsg('Quedó una sola ficha activa')
      setClientes([res.data.principal])
      setIncluidos(new Set([res.data.principal.id]))
      onFusionCompleta(res.data.principal, res.data.idsFusionados)
    } finally {
      setFusionando(false)
    }
  }

  return (
    <div className="cd-panel__grupo">
      <div className="cd-panel__grupo-head">
        <span className="cd-panel__ia-badge">Detección inteligente</span>
        <span className="cd-panel__confianza">{confianza}% coincidencia</span>
      </div>
      <p className="cd-panel__razones">
        Coinciden por:{' '}
        {razones.map((r) => etiquetaRazonDuplicado(r)).join(' · ') || 'datos similares'}
      </p>
      <p className="cd-panel__hint">
        Elegí la ficha principal, desmarcá las que no van y armá abajo los datos finales. Al unificar,
        todo el historial pasa a esa ficha.
      </p>

      <ul className="cd-panel__lista">
        {clientes.map((c) => {
          const incluido = incluidos.has(c.id)
          const editando = editId === c.id
          return (
            <li key={c.id} className={`cd-panel__fila${editando ? ' cd-panel__fila--edit' : ''}`}>
              <div className="cd-panel__fila-main">
                <label className={`cd-panel__incluir${incluido ? '' : ' cd-panel__incluir--off'}`}>
                  <input
                    type="checkbox"
                    checked={incluido}
                    disabled={c.id === idPrincipal}
                    onChange={() => toggleIncluido(c.id)}
                    title={
                      c.id === idPrincipal
                        ? 'El principal siempre se incluye'
                        : 'Incluir en la unificación'
                    }
                  />
                  <span className="cd-panel__sr">Incluir</span>
                </label>
                <label className={`cd-panel__radio${incluido ? '' : ' cd-panel__radio--muted'}`}>
                  <input
                    type="radio"
                    name={radioName}
                    checked={idPrincipal === c.id}
                    disabled={!incluido}
                    onChange={() => {
                      setIdPrincipal(c.id)
                      setIncluidos((prev) => new Set(prev).add(c.id))
                    }}
                  />
                  <span className="cd-panel__fila-body">
                    <strong>
                      {nombreCompletoCliente(c)}
                      {idPrincipal === c.id ? (
                        <span className="cd-panel__tag">Principal</span>
                      ) : null}
                    </strong>
                    {c.empresa && <span className="cd-panel__empresa">{c.empresa}</span>}
                    <span className="cd-panel__meta">
                      <span>#{c.id}</span>
                      {c.dni_cuit && <span>{c.dni_cuit}</span>}
                      {c.telefono && <span>{c.telefono}</span>}
                      {c.email && <span>{c.email}</span>}
                    </span>
                  </span>
                </label>
                <div className="cd-panel__fila-actions">
                  <button
                    type="button"
                    className="cd-panel__ver"
                    onClick={() => (editando ? cancelarEdicion() : abrirEdicion(c))}
                  >
                    {editando ? 'Cerrar' : 'Editar'}
                  </button>
                  {onVerCliente && c.id !== referencia?.id && (
                    <button type="button" className="cd-panel__ver" onClick={() => onVerCliente(c)}>
                      Ver
                    </button>
                  )}
                </div>
              </div>

              {editando && draft && (
                <div className="cd-panel__edit">
                  <div className="cd-panel__edit-grid">
                    <label>
                      Nombre
                      <input
                        value={draft.nombre}
                        onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
                      />
                    </label>
                    <label>
                      Apellido
                      <input
                        value={draft.apellido}
                        onChange={(e) => setDraft({ ...draft, apellido: e.target.value })}
                      />
                    </label>
                    <label>
                      Empresa
                      <input
                        value={draft.empresa}
                        onChange={(e) => setDraft({ ...draft, empresa: e.target.value })}
                      />
                    </label>
                    <label>
                      DNI / CUIT
                      <input
                        value={draft.dni_cuit}
                        onChange={(e) => setDraft({ ...draft, dni_cuit: e.target.value })}
                      />
                    </label>
                    <label>
                      Teléfono
                      <input
                        value={draft.telefono}
                        onChange={(e) => setDraft({ ...draft, telefono: e.target.value })}
                      />
                    </label>
                    <label>
                      Email
                      <input
                        type="email"
                        value={draft.email}
                        onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                      />
                    </label>
                    <label className="cd-panel__edit-wide">
                      Dirección
                      <input
                        value={draft.direccion}
                        onChange={(e) => setDraft({ ...draft, direccion: e.target.value })}
                      />
                    </label>
                  </div>
                  <div className="cd-panel__edit-actions">
                    <button
                      type="button"
                      className="cd-panel__guardar"
                      disabled={guardando || !draft.nombre.trim()}
                      onClick={() => void guardarEdicion()}
                    >
                      {guardando ? 'Guardando…' : 'Guardar cambios'}
                    </button>
                    <button type="button" className="cd-panel__ver" onClick={cancelarEdicion}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {secundarios.length > 0 && datosFinales && (
        <div className="cd-panel__resultado">
          <div className="cd-panel__resultado-head">
            <h4>Datos de la ficha unificada</h4>
            <button type="button" className="cd-panel__ver" onClick={recomponerAuto}>
              Autocompletar mejor dato
            </button>
          </div>
          <p className="cd-panel__hint">
            Por cada campo elegí de qué ficha tomarlo, o editá el valor final a mano.
          </p>
          <div className="cd-panel__resultado-grid">
            {CAMPOS_FUSION_CLIENTE.map(({ key, label }) => {
              const opts = opcionesCampoFusion(incluidosList, key)
              return (
                <label key={key} className={key === 'direccion' ? 'cd-panel__edit-wide' : undefined}>
                  {label}
                  {opts.length > 1 ? (
                    <select
                      value={origenes[key] ?? ''}
                      onChange={(e) => {
                        const id = Number(e.target.value)
                        if (id) setOrigenCampo(key, id)
                      }}
                    >
                      <option value="">Mejor automático</option>
                      {opts.map((o) => (
                        <option key={`${key}-${o.id}-${o.valor}`} value={o.id}>
                          {o.valor} ({o.label})
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <input
                    value={datosFinales[key]}
                    onChange={(e) =>
                      setDatosFinales((prev) =>
                        prev ? { ...prev, [key]: e.target.value } : prev
                      )
                    }
                    placeholder={opts.length === 0 ? 'Sin dato en el grupo' : undefined}
                  />
                </label>
              )
            })}
          </div>
        </div>
      )}

      {error && <p className="cd-panel__error">{error}</p>}
      {okMsg && <p className="cd-panel__ok">{okMsg}</p>}

      <button
        type="button"
        className="cd-panel__fusionar"
        disabled={fusionando || secundarios.length === 0 || editId != null || !datosFinales}
        onClick={() => void fusionarTodos()}
      >
        {fusionando
          ? 'Unificando…'
          : secundarios.length === 0
            ? 'Marcá al menos otra ficha para unificar'
            : `Dejar una sola ficha (#${idPrincipal})`}
      </button>
    </div>
  )
}

export default function ClienteDuplicadosPanel({
  clienteReferencia,
  candidatos,
  onFusionCompleta,
  onVerCliente,
  onClienteActualizado
}: Props) {
  const todos = clienteReferencia
    ? [clienteReferencia, ...candidatos.filter((c) => c.id !== clienteReferencia.id)]
    : candidatos

  const grupos = detectarGruposDuplicados(todos.filter((c) => c.activo !== false))

  if (grupos.length === 0 && candidatos.length === 0) return null

  if (grupos.length === 0 && clienteReferencia && candidatos.length > 0) {
    const activos = [clienteReferencia, ...candidatos].filter((c) => c.activo !== false)
    if (activos.length < 2) return null
    const pseudo: GrupoDuplicadoClientes = {
      ids: activos.map((c) => c.id),
      clientes: activos,
      razones: razonesEntreGrupo(activos, clienteReferencia),
      confianza: Math.max(
        ...candidatos.map((c) => analizarParDuplicado(clienteReferencia, c).confianza),
        0
      )
    }
    return (
      <section className="cd-panel" aria-label="Posibles clientes duplicados">
        <h3 className="cd-panel__title">Posibles duplicados</h3>
        <p className="cd-panel__intro">
          Detectamos fichas que podrían ser la misma persona. Unificá para dejar
          <strong> una sola ficha activa</strong> con todo el historial.
        </p>
        <GrupoDuplicadoCard
          grupo={pseudo}
          referencia={clienteReferencia}
          onFusionCompleta={onFusionCompleta}
          onVerCliente={onVerCliente}
          onClienteActualizado={onClienteActualizado}
        />
      </section>
    )
  }

  if (grupos.length === 0) return null

  return (
    <section className="cd-panel" aria-label="Posibles clientes duplicados">
      <h3 className="cd-panel__title">Posibles duplicados</h3>
      <p className="cd-panel__intro">
        {grupos.length === 1
          ? 'Hay varias fichas del mismo cliente.'
          : `Hay ${grupos.length} grupos de fichas repetidas.`}{' '}
        Unificá cada grupo en <strong>una sola ficha</strong>.
      </p>
      {grupos.map((g) => (
        <GrupoDuplicadoCard
          key={g.ids.join('-')}
          grupo={g}
          referencia={clienteReferencia}
          onFusionCompleta={onFusionCompleta}
          onVerCliente={onVerCliente}
          onClienteActualizado={onClienteActualizado}
        />
      ))}
    </section>
  )
}
