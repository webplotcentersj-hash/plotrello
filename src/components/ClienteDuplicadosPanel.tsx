import { useState } from 'react'
import type { ClienteRecord } from '../types/api'
import apiService from '../services/api'
import { nombreCompletoCliente } from '../utils/buscarClienteMatch'
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
  onFusionCompleta: (principal: ClienteRecord) => void
  onVerCliente?: (c: ClienteRecord) => void
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
  onVerCliente
}: {
  grupo: GrupoDuplicadoClientes | { clientes: ClienteRecord[]; confianza?: number }
  referencia?: ClienteRecord | null
  onFusionCompleta: (principal: ClienteRecord) => void
  onVerCliente?: (c: ClienteRecord) => void
}) {
  const clientes = grupo.clientes
  const defaultPrincipal =
    referencia && clientes.some((c) => c.id === referencia.id)
      ? referencia.id
      : clientes[0]?.id ?? 0

  const [idPrincipal, setIdPrincipal] = useState(defaultPrincipal)
  const [fusionando, setFusionando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const razones =
    'razones' in grupo && grupo.razones.length > 0
      ? grupo.razones
      : razonesEntreGrupo(clientes, referencia)

  const confianza = 'confianza' in grupo ? grupo.confianza : 70
  const secundarios = clientes.filter((c) => c.id !== idPrincipal)

  const fusionarTodos = async () => {
    if (!idPrincipal || secundarios.length === 0) return
    const ok = window.confirm(
      `¿Unificar ${secundarios.length} ficha${secundarios.length === 1 ? '' : 's'} en el cliente principal?\n\n` +
        `Se conservará la ficha #${idPrincipal} y las demás se desactivarán (pedidos y ventas pasan al principal).`
    )
    if (!ok) return

    setFusionando(true)
    setError(null)
    try {
      let ultimo: ClienteRecord | null = null
      for (const sec of secundarios) {
        const res = await apiService.fusionarClientes(idPrincipal, sec.id)
        if (!res.success) {
          setError(res.error || 'No se pudo unificar')
          return
        }
        ultimo = res.data ?? null
      }
      if (ultimo) onFusionCompleta(ultimo)
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

      <ul className="cd-panel__lista">
        {clientes.map((c) => (
          <li key={c.id} className="cd-panel__fila">
            <label className="cd-panel__radio">
              <input
                type="radio"
                name={`principal-${clientes.map((x) => x.id).join('-')}`}
                checked={idPrincipal === c.id}
                onChange={() => setIdPrincipal(c.id)}
              />
              <span className="cd-panel__fila-body">
                <strong>{nombreCompletoCliente(c)}</strong>
                {c.empresa && <span className="cd-panel__empresa">{c.empresa}</span>}
                <span className="cd-panel__meta">
                  {c.dni_cuit && <span>{c.dni_cuit}</span>}
                  {c.telefono && <span>{c.telefono}</span>}
                  {c.email && <span>{c.email}</span>}
                </span>
              </span>
            </label>
            {onVerCliente && c.id !== referencia?.id && (
              <button type="button" className="cd-panel__ver" onClick={() => onVerCliente(c)}>
                Ver
              </button>
            )}
          </li>
        ))}
      </ul>

      {error && <p className="cd-panel__error">{error}</p>}

      <button
        type="button"
        className="cd-panel__fusionar"
        disabled={fusionando || secundarios.length === 0}
        onClick={() => void fusionarTodos()}
      >
        {fusionando ? 'Unificando…' : `Unificar en cliente #${idPrincipal}`}
      </button>
    </div>
  )
}

export default function ClienteDuplicadosPanel({
  clienteReferencia,
  candidatos,
  onFusionCompleta,
  onVerCliente
}: Props) {
  const todos = clienteReferencia
    ? [clienteReferencia, ...candidatos.filter((c) => c.id !== clienteReferencia.id)]
    : candidatos

  const grupos = detectarGruposDuplicados(todos)

  if (grupos.length === 0 && candidatos.length === 0) return null

  if (grupos.length === 0 && clienteReferencia && candidatos.length > 0) {
    const pseudo: GrupoDuplicadoClientes = {
      ids: [clienteReferencia.id, ...candidatos.map((c) => c.id)],
      clientes: [clienteReferencia, ...candidatos],
      razones: razonesEntreGrupo([clienteReferencia, ...candidatos], clienteReferencia),
      confianza: Math.max(
        ...candidatos.map((c) => analizarParDuplicado(clienteReferencia, c).confianza),
        0
      )
    }
    return (
      <section className="cd-panel" aria-label="Posibles clientes duplicados">
        <h3 className="cd-panel__title">Posibles duplicados</h3>
        <p className="cd-panel__intro">
          Detectamos fichas que podrían ser la misma persona (nombre, CUIT, teléfono o email). Elegí cuál
          conservar y unificá el resto.
        </p>
        <GrupoDuplicadoCard
          grupo={pseudo}
          referencia={clienteReferencia}
          onFusionCompleta={onFusionCompleta}
          onVerCliente={onVerCliente}
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
          ? 'Hay varias fichas que parecen ser el mismo cliente.'
          : `Hay ${grupos.length} grupos de fichas que podrían repetirse.`}{' '}
        Elegí la ficha principal y unificá.
      </p>
      {grupos.map((g) => (
        <GrupoDuplicadoCard
          key={g.ids.join('-')}
          grupo={g}
          referencia={clienteReferencia}
          onFusionCompleta={onFusionCompleta}
          onVerCliente={onVerCliente}
        />
      ))}
    </section>
  )
}
