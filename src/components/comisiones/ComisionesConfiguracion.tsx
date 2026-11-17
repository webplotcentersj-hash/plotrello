import { useEffect, useMemo, useState } from 'react'
import { MOMENTOS, type MomentoComision } from '../../features/comisiones/calculoComisiones'
import { estimarComisionMes, porcentajeEfectivo, ventaNecesaria } from '../../features/comisiones/analisisComisiones'
import type { ComisionConfig, ComisionMes, ComisionVendedor, ComisionVenta } from '../../services/comisionesApi'
import './ComisionesConfiguracion.css'

type Resultado = { success: boolean; error?: string }

type Props = {
  config: ComisionConfig
  vendedores: ComisionVendedor[]
  mes: string
  porMes: ComisionMes[]
  ventas: ComisionVenta[]
  trabajando: boolean
  onGuardarConfig: (cambios: Partial<ComisionConfig>) => Promise<unknown>
  onGuardarVendedor: (idUsuario: number, porcentaje: number | null, activo: boolean, nombre: string) => Promise<unknown>
}

const pesos = (n: unknown) => (Number(n) || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const nombreMes = (ym: string) => MESES[Number(ym.slice(5, 7)) - 1] ?? ym

const ICONO_MOMENTO: Record<MomentoComision, string> = { cobro: '💵', venta: '🧾', factura: '🏛️' }
const DETALLE_MOMENTO: Record<MomentoComision, string> = {
  cobro: 'La más segura: solo se paga comisión por plata que ya entró. Una venta cobrada en partes devenga en partes.',
  venta: 'La más simple: apenas se registra la venta. Si después no se cobra, la comisión ya figura como ganada.',
  factura: 'Cuando la factura queda autorizada en ARCA. Las notas de crédito la descuentan.'
}

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

type EdicionVendedor = { usaGeneral: boolean; porcentaje: string; activo: boolean }

export default function ComisionesConfiguracion(p: Props) {
  const general = Number(p.config.porcentaje_default) || 0

  // ---- Regla (con borrador hasta guardar) ----
  const [momento, setMomento] = useState<MomentoComision>(p.config.momento)
  const [pctGeneral, setPctGeneral] = useState(String(general))
  useEffect(() => {
    setMomento(p.config.momento)
    setPctGeneral(String(Number(p.config.porcentaje_default) || 0))
  }, [p.config.momento, p.config.porcentaje_default])

  const pctGeneralNum = Number(pctGeneral.replace(',', '.'))
  const pctGeneralValido = Number.isFinite(pctGeneralNum) && pctGeneralNum >= 0 && pctGeneralNum <= 100
  const reglaCambiada = momento !== p.config.momento || (pctGeneralValido && pctGeneralNum !== general)

  // ---- Vendedores (cada fila con su borrador) ----
  const [ediciones, setEdiciones] = useState<Record<number, EdicionVendedor>>({})
  const [busqueda, setBusqueda] = useState('')
  useEffect(() => setEdiciones({}), [p.vendedores])

  const distingueGeneral = p.vendedores.some((v) => v.usa_general !== undefined)

  const edicionDe = (v: ComisionVendedor): EdicionVendedor =>
    ediciones[v.id_usuario] ?? {
      usaGeneral: distingueGeneral ? !!v.usa_general : v.porcentaje === null,
      porcentaje: v.porcentaje === null ? '' : String(v.porcentaje),
      activo: v.activo
    }

  const pctEdicion = (e: EdicionVendedor): number | null => {
    if (e.usaGeneral) return null
    const n = Number(e.porcentaje.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }

  const ventasMes = useMemo(() => p.ventas.filter((v) => String(v.fecha_venta || '').slice(0, 7) === p.mes), [p.ventas, p.mes])
  const resumenMes = useMemo(() => p.porMes.find((x) => x.mes === p.mes)?.vendedores ?? [], [p.porMes, p.mes])

  /** % que se aplicaría a cada vendedor con lo que está en pantalla (guardado o no). */
  const pctPantalla = (id: number | null, generalPantalla: number) => {
    const v = p.vendedores.find((x) => x.id_usuario === id)
    if (!v) return generalPantalla
    const e = edicionDe(v)
    return porcentajeEfectivo({ porcentaje: pctEdicion(e), activo: e.activo }, generalPantalla)
  }

  const devengadoReal = Number(p.porMes.find((x) => x.mes === p.mes)?.devengado) || 0
  const hayCambiosVendedores = Object.keys(ediciones).length > 0
  // Se compara estimación contra estimación (mismo método), así la diferencia es solo el efecto del cambio.
  const estimacionGuardada = estimarComisionMes(ventasMes, p.config.momento, (id) => {
    const v = p.vendedores.find((x) => x.id_usuario === id)
    return v ? porcentajeEfectivo({ porcentaje: v.usa_general ? null : v.porcentaje, activo: v.activo }, general) : general
  })
  const estimacionNueva = estimarComisionMes(ventasMes, momento, (id) => pctPantalla(id, pctGeneralValido ? pctGeneralNum : general))
  const diferencia = estimacionNueva !== null && estimacionGuardada !== null ? estimacionNueva - estimacionGuardada : null
  const hayCambios = reglaCambiada || hayCambiosVendedores

  const guardarRegla = async () => {
    if (!pctGeneralValido) return
    const cambios: Partial<ComisionConfig> = {}
    if (momento !== p.config.momento) cambios.momento = momento
    if (pctGeneralNum !== general) cambios.porcentaje_default = pctGeneralNum
    await p.onGuardarConfig(cambios)
  }

  const vendedoresVisibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const ventasDe = (id: number) => resumenMes.find((r) => r.id_vendedor === id)
    return p.vendedores
      .filter((v) => !q || v.nombre.toLowerCase().includes(q) || String(v.rol || '').toLowerCase().includes(q))
      .map((v) => ({ v, mesInfo: ventasDe(v.id_usuario) }))
      .sort((a, b) => (Number(b.mesInfo?.base_monto) || 0) - (Number(a.mesInfo?.base_monto) || 0) || a.v.nombre.localeCompare(b.v.nombre))
  }, [p.vendedores, busqueda, resumenMes])

  const conPropio = p.vendedores.filter((v) => !edicionDe(v).usaGeneral).length
  const sinComision = p.vendedores.filter((v) => !edicionDe(v).activo).length

  // ---- Simulador ----
  const [simMonto, setSimMonto] = useState(100000)
  const [simPct, setSimPct] = useState(general || 3)
  const [objetivo, setObjetivo] = useState(50000)
  const necesaria = ventaNecesaria(objetivo, simPct)

  return (
    <div className="cc">
      {/* ---------- Regla ---------- */}
      <section className="cc-card">
        <header className="cc-card__head">
          <div>
            <h2>Regla de cálculo</h2>
            <p>Define cuándo se gana la comisión y el porcentaje que se aplica a quien no tiene uno propio.</p>
          </div>
          {reglaCambiada ? <span className="cc-chip cc-chip--warn">Cambios sin guardar</span> : <span className="cc-chip">Guardada</span>}
        </header>

        <p className="cc-label">¿Cuándo se gana la comisión?</p>
        <div className="cc-momentos" role="radiogroup" aria-label="Cuándo se gana la comisión">
          {MOMENTOS.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={momento === m.value}
              className={`cc-momento${momento === m.value ? ' is-on' : ''}`}
              onClick={() => setMomento(m.value)}
              disabled={p.trabajando}
            >
              <span className="cc-momento__icono" aria-hidden>
                {ICONO_MOMENTO[m.value]}
              </span>
              <strong>
                {m.label}
                {m.value === 'cobro' ? <em>Recomendada</em> : null}
              </strong>
              <span>{DETALLE_MOMENTO[m.value]}</span>
            </button>
          ))}
        </div>

        <div className="cc-general">
          <div className="cc-general__control">
            <p className="cc-label">% general</p>
            <div className="cc-slider">
              <input
                type="range"
                min="0"
                max="15"
                step="0.5"
                value={pctGeneralValido ? Math.min(pctGeneralNum, 15) : 0}
                onChange={(e) => setPctGeneral(e.target.value)}
                disabled={p.trabajando}
                aria-label="Porcentaje general"
              />
              <label className="cc-pct-input">
                <input
                  type="text"
                  inputMode="decimal"
                  value={pctGeneral}
                  onChange={(e) => setPctGeneral(e.target.value)}
                  disabled={p.trabajando}
                  aria-label="Porcentaje general (número)"
                />
                <span>%</span>
              </label>
            </div>
            {!pctGeneralValido ? <p className="cc-error">Tiene que ser un número entre 0 y 100.</p> : null}
            <p className="cc-ayuda">
              Se aplica a {p.vendedores.length - conPropio} de {p.vendedores.length} vendedores (los que no tienen % propio).
            </p>
          </div>

          <div className="cc-preview">
            <p className="cc-label">Comisión de {nombreMes(p.mes)}</p>
            {!hayCambios ? (
              <>
                <p className="cc-preview__valor">{pesos(devengadoReal)}</p>
                <p className="cc-preview__comparacion">Devengado con la configuración actual.</p>
              </>
            ) : diferencia === null ? (
              <p className="cc-preview__valor cc-preview__valor--chico">
                Con "al facturar" el efecto se ve al guardar (depende de las facturas autorizadas).
              </p>
            ) : (
              <>
                <p className="cc-preview__valor">{pesos(Math.max(devengadoReal + diferencia, 0))}</p>
                <p className="cc-preview__comparacion">
                  Hoy {pesos(devengadoReal)}
                  {Math.abs(diferencia) >= 1 ? (
                    <b className={diferencia > 0 ? 'is-sube' : 'is-baja'}>
                      {diferencia > 0 ? ' ▲ ' : ' ▼ '}
                      {pesos(Math.abs(diferencia))}
                    </b>
                  ) : (
                    ' · sin cambio'
                  )}
                </p>
              </>
            )}
            <p className="cc-ayuda">
              {hayCambios
                ? 'Estimado con las ventas del mes y lo que cambiaste (sin guardar). El monto exacto sale al recalcular.'
                : 'Probá cambiar la regla o los % de abajo y acá ves el efecto antes de guardar.'}
            </p>
          </div>
        </div>

        <div className="cc-acciones">
          <button
            type="button"
            className="btn-secondary"
            disabled={!reglaCambiada || p.trabajando}
            onClick={() => {
              setMomento(p.config.momento)
              setPctGeneral(String(general))
            }}
          >
            Descartar
          </button>
          <button type="button" className="btn-primary" disabled={!reglaCambiada || !pctGeneralValido || p.trabajando} onClick={() => void guardarRegla()}>
            {p.trabajando ? 'Guardando…' : 'Guardar y recalcular'}
          </button>
        </div>
      </section>

      {/* ---------- Vendedores ---------- */}
      <section className="cc-card">
        <header className="cc-card__head">
          <div>
            <h2>Porcentaje por vendedor</h2>
            <p>
              {conPropio} con % propio · {p.vendedores.length - conPropio} usan el general ({general}%)
              {sinComision ? ` · ${sinComision} sin comisión` : ''}
            </p>
          </div>
          <input
            type="search"
            className="cc-buscar"
            placeholder="Buscar vendedor…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar vendedor"
          />
        </header>

        {!distingueGeneral && p.vendedores.length > 0 ? (
          <p className="cc-aviso">
            Para poder elegir "usa el general" hay que ejecutar <code>2026-11-17_comisiones_porcentaje_general.sql</code> en Supabase.
            Hasta entonces, guardar un vendedor deja su % propio.
          </p>
        ) : null}

        {vendedoresVisibles.length === 0 ? (
          <p className="cc-vacio">{p.vendedores.length === 0 ? 'No hay usuarios con ventas registradas.' : 'Ningún vendedor coincide.'}</p>
        ) : (
          <div className="cc-vendedores">
            {vendedoresVisibles.map(({ v, mesInfo }) => {
              const e = edicionDe(v)
              const pctProp = pctEdicion(e)
              const propioInvalido = !e.usaGeneral && (pctProp === null || pctProp < 0 || pctProp > 100 || e.porcentaje.trim() === '')
              const efectivo = porcentajeEfectivo({ porcentaje: e.usaGeneral ? null : pctProp ?? 0, activo: e.activo }, general)
              const original: EdicionVendedor = {
                usaGeneral: distingueGeneral ? !!v.usa_general : v.porcentaje === null,
                porcentaje: v.porcentaje === null ? '' : String(v.porcentaje),
                activo: v.activo
              }
              const cambiado =
                e.usaGeneral !== original.usaGeneral ||
                e.activo !== original.activo ||
                (!e.usaGeneral && Number(e.porcentaje.replace(',', '.')) !== Number(original.porcentaje || NaN))
              const vendidoMes = Number(mesInfo?.base_monto) || 0
              const estimado = estimarComisionMes(
                ventasMes.filter((x) => x.id_vendedor === v.id_usuario),
                p.config.momento,
                () => efectivo
              )
              const setE = (cambio: Partial<EdicionVendedor>) => setEdiciones((prev) => ({ ...prev, [v.id_usuario]: { ...e, ...cambio } }))

              return (
                <div key={v.id_usuario} className={`cc-vendedor${!e.activo ? ' is-off' : ''}${cambiado ? ' is-dirty' : ''}`}>
                  <span className="cc-avatar" aria-hidden>
                    {iniciales(v.nombre)}
                  </span>
                  <div className="cc-vendedor__info">
                    <strong>{v.nombre}</strong>
                    <span>
                      {v.rol || 'Sin rol'} · {v.ventas} ventas en total
                      {vendidoMes > 0 ? ` · ${pesos(vendidoMes)} en ${nombreMes(p.mes)}` : ''}
                    </span>
                  </div>

                  <div className="cc-vendedor__pct">
                    <div className="cc-seg" role="radiogroup" aria-label={`Porcentaje de ${v.nombre}`}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={e.usaGeneral}
                        className={e.usaGeneral ? 'is-on' : undefined}
                        onClick={() => setE({ usaGeneral: true })}
                        disabled={p.trabajando || !e.activo || !distingueGeneral}
                        title={!distingueGeneral ? 'Requiere el patch SQL de comisiones' : undefined}
                      >
                        General {general}%
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={!e.usaGeneral}
                        className={!e.usaGeneral ? 'is-on' : undefined}
                        onClick={() => setE({ usaGeneral: false, porcentaje: e.porcentaje || String(general) })}
                        disabled={p.trabajando || !e.activo}
                      >
                        Propio
                      </button>
                    </div>
                    {!e.usaGeneral ? (
                      <label className={`cc-pct-input cc-pct-input--chico${propioInvalido ? ' is-error' : ''}`}>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={e.porcentaje}
                          onChange={(ev) => setE({ porcentaje: ev.target.value })}
                          disabled={p.trabajando || !e.activo}
                          aria-label={`Porcentaje propio de ${v.nombre}`}
                        />
                        <span>%</span>
                      </label>
                    ) : null}
                  </div>

                  <label className="cc-switch" title={e.activo ? 'Comisiona' : 'No comisiona'}>
                    <input type="checkbox" checked={e.activo} onChange={(ev) => setE({ activo: ev.target.checked })} disabled={p.trabajando} />
                    <span className="cc-switch__pista" aria-hidden />
                    <span className="cc-switch__texto">{e.activo ? 'Comisiona' : 'No comisiona'}</span>
                  </label>

                  <div className="cc-vendedor__estimado">
                    <strong>{estimado === null ? '—' : pesos(estimado)}</strong>
                    <span>{e.activo ? `${efectivo}% · ${nombreMes(p.mes)}` : 'sin comisión'}</span>
                  </div>

                  <div className="cc-vendedor__guardar">
                    {cambiado ? (
                      <>
                        <button
                          type="button"
                          className="cc-btn-chico"
                          onClick={() => setEdiciones((prev) => {
                            const n = { ...prev }
                            delete n[v.id_usuario]
                            return n
                          })}
                          disabled={p.trabajando}
                        >
                          Deshacer
                        </button>
                        <button
                          type="button"
                          className="cc-btn-chico cc-btn-chico--primario"
                          disabled={p.trabajando || propioInvalido}
                          onClick={() => void p.onGuardarVendedor(v.id_usuario, e.usaGeneral ? null : pctProp, e.activo, v.nombre)}
                        >
                          Guardar
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ---------- Simulador ---------- */}
      <section className="cc-card">
        <header className="cc-card__head">
          <div>
            <h2>Simulador</h2>
            <p>Para responder rápido "¿cuánto gano si vendo…?" y "¿cuánto tengo que vender para…?". No guarda nada.</p>
          </div>
        </header>
        <div className="cc-sim">
          <div className="cc-sim__bloque">
            <p className="cc-label">Si vendo</p>
            <label className="cc-monto">
              <span>$</span>
              <input
                type="text"
                inputMode="numeric"
                value={simMonto.toLocaleString('es-AR')}
                onChange={(e) => setSimMonto(Number(e.target.value.replace(/\D/g, '')) || 0)}
                aria-label="Monto vendido"
              />
            </label>
            <div className="cc-slider">
              <input type="range" min="0" max="15" step="0.5" value={simPct} onChange={(e) => setSimPct(Number(e.target.value))} aria-label="Porcentaje" />
              <span className="cc-slider__valor">{simPct}%</span>
            </div>
            <p className="cc-sim__resultado">
              gano <strong>{pesos((simMonto * simPct) / 100)}</strong>
            </p>
          </div>
          <div className="cc-sim__bloque">
            <p className="cc-label">Para ganar</p>
            <label className="cc-monto">
              <span>$</span>
              <input
                type="text"
                inputMode="numeric"
                value={objetivo.toLocaleString('es-AR')}
                onChange={(e) => setObjetivo(Number(e.target.value.replace(/\D/g, '')) || 0)}
                aria-label="Comisión objetivo"
              />
            </label>
            <p className="cc-ayuda">con {simPct}% de comisión</p>
            <p className="cc-sim__resultado">
              hay que vender <strong>{necesaria === null ? '—' : pesos(necesaria)}</strong>
            </p>
          </div>
        </div>
        <p className="cc-ayuda">
          {MOMENTOS.find((m) => m.value === p.config.momento)?.ayuda}.
        </p>
      </section>
    </div>
  )
}

export type { Resultado }
