import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import {
  USO_SISTEMA,
  aplanar,
  claveDe,
  construirArbol,
  controlesPlan,
  ecuacionPatrimonial,
  filtrarArbol,
  necesitaReestructurar,
  saldoNatural,
  type CuentaPC,
  type MovimientoPC,
  type NodoPC,
  type TipoCuenta
} from '../features/plan-cuentas/planCuentas'
import { descargarCsv } from '../utils/erpUi'
import './ErpSectionPage.css'
import './ErpPlanCuentasPage.css'

const TIPOS: Array<{ tipo: TipoCuenta; label: string; clase: string }> = [
  { tipo: 'Activo', label: 'Activo', clase: 'activo' },
  { tipo: 'Pasivo', label: 'Pasivo', clase: 'pasivo' },
  { tipo: 'Patrimonio', label: 'Patrimonio neto', clase: 'patrimonio' },
  { tipo: 'Ingreso', label: 'Ingresos', clase: 'ingreso' },
  { tipo: 'Costo', label: 'Costos', clase: 'costo' },
  { tipo: 'Gasto', label: 'Gastos', clase: 'gasto' },
  { tipo: 'Cuenta de Orden', label: 'De orden', clase: 'orden' }
]
const claseTipo = (t: string) => TIPOS.find((x) => x.tipo === t)?.clase ?? 'orden'

const pesos = (v: number) => v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const hoyAr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

export default function ErpPlanCuentasPage() {
  const navigate = useNavigate()
  const [cuentas, setCuentas] = useState<CuentaPC[]>([])
  const [movimientos, setMovimientos] = useState<Map<string, MovimientoPC>>(new Map())
  const [saldosOk, setSaldosOk] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fechaCorte, setFechaCorte] = useState(hoyAr())

  const [busqueda, setBusqueda] = useState('')
  const [tipo, setTipo] = useState<TipoCuenta | ''>('')
  const [soloConSaldo, setSoloConSaldo] = useState(false)
  const [verBajas, setVerBajas] = useState(false)
  const [abiertos, setAbiertos] = useState<Set<string> | null>(null)
  const [controlAbierto, setControlAbierto] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [cRes, bRes] = await Promise.all([apiService.getPlanCuentas(), apiService.getBalanceGeneral(fechaCorte)])
    if (cRes.success && cRes.data) setCuentas(cRes.data as unknown as CuentaPC[])
    else setError(cRes.error || 'No se pudo cargar el plan de cuentas.')
    const m = new Map<string, MovimientoPC>()
    if (bRes.success && bRes.data) {
      for (const b of bRes.data) m.set(String(b.codigo_cuenta), { debe: Number(b.saldo_deudor) || 0, haber: Number(b.saldo_acreedor) || 0 })
      setSaldosOk(true)
    } else setSaldosOk(false)
    setMovimientos(m)
    setLoading(false)
  }, [fechaCorte])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const visiblesBase = useMemo(() => cuentas.filter((c) => verBajas || c.activa), [cuentas, verBajas])
  const arbol = useMemo(() => construirArbol(visiblesBase, movimientos), [visiblesBase, movimientos])
  const todos = useMemo(() => aplanar(arbol), [arbol])
  const ecuacion = useMemo(() => ecuacionPatrimonial(cuentas, movimientos), [cuentas, movimientos])
  const controles = useMemo(() => controlesPlan(cuentas, movimientos), [cuentas, movimientos])
  const reestructurar = useMemo(() => necesitaReestructurar(cuentas), [cuentas])

  // Por defecto: abiertos los niveles 1 y 2 (se ven los rubros); el resto se despliega a pedido.
  const abiertosEfectivos = useMemo(
    () => abiertos ?? new Set(todos.filter((n) => n.codigo.split('.').length <= 2).map((n) => n.codigo)),
    [abiertos, todos]
  )

  const filtrando = Boolean(busqueda.trim() || soloConSaldo)
  const arbolVisible = useMemo(() => {
    let base = tipo ? arbol.filter((r) => r.tipo === tipo) : arbol
    const q = busqueda.trim().toLowerCase()
    if (q || soloConSaldo) {
      base = filtrarArbol(base, (n) => {
        if (soloConSaldo && !(n.imputable && Math.abs(n.saldoDH) > 0.009)) return false
        if (!q) return true
        return `${n.codigo} ${n.nombre} ${n.descripcion ?? ''}`.toLowerCase().includes(q)
      })
    }
    return base
  }, [arbol, tipo, busqueda, soloConSaldo])

  const alternar = (codigo: string) =>
    setAbiertos(() => {
      const n = new Set(abiertosEfectivos)
      if (n.has(codigo)) n.delete(codigo)
      else n.add(codigo)
      return n
    })

  const stats = useMemo(() => {
    const imputables = todos.filter((n) => n.imputable).length
    return {
      total: todos.length,
      imputables,
      rubros: todos.length - imputables,
      conMovimiento: todos.filter((n) => n.imputable && Math.abs(n.saldoDH) > 0.009).length,
      sistema: todos.filter((n) => claveDe(n)).length
    }
  }, [todos])

  const exportar = () =>
    descargarCsv(
      `Plan_de_cuentas_${fechaCorte}.csv`,
      ['Código', 'Cuenta', 'Tipo', 'Naturaleza', 'Imputable', 'Activa', 'Uso en el sistema', 'Saldo al corte'],
      todos.map((n) => [
        n.codigo,
        n.nombre,
        n.tipo,
        n.naturaleza,
        n.imputable ? 'Sí' : 'No',
        n.activa ? 'Sí' : 'No',
        claveDe(n) ? USO_SISTEMA[claveDe(n)!]?.label ?? '' : '',
        saldoNatural(n).toFixed(2).replace('.', ',')
      ])
    )

  const renderNodo = (n: NodoPC, profundidad: number): ReactElement[] => {
    const abierto = filtrando || abiertosEfectivos.has(n.codigo)
    const clave = claveDe(n)
    const uso = clave ? USO_SISTEMA[clave] : null
    const saldo = saldoNatural(n)
    const contrario = n.imputable && saldo < -0.009
    const filas: ReactElement[] = [
      <div
        key={n.codigo}
        className={`pc-fila pc-fila--n${Math.min(profundidad, 4)}${n.imputable ? ' is-hoja' : ' is-rubro'}${!n.activa ? ' is-baja' : ''}`}
        style={{ paddingLeft: 12 + profundidad * 20 }}
      >
        <span className="pc-fila__caret">
          {!n.imputable ? (
            <button type="button" onClick={() => alternar(n.codigo)} aria-label={abierto ? 'Contraer' : 'Desplegar'} aria-expanded={abierto}>
              {abierto ? '▾' : '▸'}
            </button>
          ) : null}
        </span>
        <code className="pc-fila__codigo">{n.codigo}</code>
        <span className="pc-fila__nombre">
          <span>{n.nombre}</span>
          {n.descripcion ? <small>{n.descripcion}</small> : null}
        </span>
        <span className="pc-fila__badges">
          {uso ? (
            <button type="button" className="pc-badge pc-badge--sistema" title={`Usada por: ${uso.label}`} onClick={() => navigate(uso.path)}>
              ⚙ {uso.label}
            </button>
          ) : null}
          {n.regularizadora ? <span className="pc-badge pc-badge--reg" title="Saldo de signo contrario a su rubro">Regularizadora</span> : null}
          {!n.activa ? <span className="pc-badge pc-badge--baja">Dada de baja</span> : null}
        </span>
        <span className={`pc-fila__saldo${contrario ? ' is-contrario' : ''}${Math.abs(n.saldoDH) < 0.01 ? ' is-cero' : ''}`}>
          {Math.abs(n.saldoDH) < 0.01 ? '—' : `$ ${pesos(Math.abs(n.saldoDH))}`}
          {Math.abs(n.saldoDH) >= 0.01 ? <em>{n.saldoDH > 0 ? 'D' : 'A'}</em> : null}
        </span>
      </div>
    ]
    if (abierto) for (const h of n.hijos) filas.push(...renderNodo(h, profundidad + 1))
    return filas
  }

  const errores = controles.filter((c) => c.nivel === 'error').length

  return (
    <div className="erp-section plan-cuentas-page">
      <header className="erp-section-header">
        <div className="erp-section-header__brand">
          <div className="erp-section-header__icon" aria-hidden>
            🗂️
          </div>
          <div>
            <p className="erp-section-header__eyebrow">Contable</p>
            <h1>Plan de cuentas</h1>
            <p className="erp-section-sub">Estructura por rubros (RT 9 FACPCE) con saldos al corte y las cuentas que usa cada proceso</p>
          </div>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Contable
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/asientos')}>
            Libro Diario
          </button>
          <button type="button" className="btn-secondary" onClick={exportar} disabled={loading}>
            Exportar CSV
          </button>
          <button type="button" className="btn-primary" onClick={() => navigate('/erp/contabilidad')}>
            Reportes
          </button>
        </div>
      </header>

      {error ? <div className="pc-aviso pc-aviso--error">{error}</div> : null}

      {reestructurar ? (
        <div className="pc-aviso pc-aviso--warn">
          <strong>El plan tiene cuentas fuera de su rubro.</strong> IVA Débito Fiscal figura dentro del Activo, IVA Crédito Fiscal dentro del Pasivo
          y Clientes dentro de Caja y bancos. Ejecutá <code>supabase/patches/2026-11-17_plan_cuentas_estructura.sql</code>: las mueve a su lugar
          (sin tocar los asientos ya registrados), actualiza los asientos automáticos y completa la estructura.
        </div>
      ) : null}
      {!saldosOk ? (
        <div className="pc-aviso pc-aviso--warn">Los saldos no están disponibles (falta la función obtener_balance_general). El plan se muestra igual.</div>
      ) : null}

      {/* Ecuación patrimonial + resumen */}
      <section className="pc-resumen">
        <div className={`pc-ecuacion ${Math.abs(ecuacion.diferencia) < 0.01 ? 'is-ok' : 'is-error'}`}>
          <p className="pc-label">
            Ecuación patrimonial al{' '}
            <input type="date" value={fechaCorte} onChange={(e) => e.target.value && setFechaCorte(e.target.value)} aria-label="Fecha de corte" />
          </p>
          <div className="pc-ecuacion__fila">
            <div className="pc-ecuacion__termino pc-t--activo">
              <span>Activo</span>
              <strong>{pesos(ecuacion.activo)}</strong>
            </div>
            <b className="pc-ecuacion__op">=</b>
            <div className="pc-ecuacion__termino pc-t--pasivo">
              <span>Pasivo</span>
              <strong>{pesos(ecuacion.pasivo)}</strong>
            </div>
            <b className="pc-ecuacion__op">+</b>
            <div className="pc-ecuacion__termino pc-t--patrimonio">
              <span>Patrimonio neto</span>
              <strong>{pesos(ecuacion.patrimonio)}</strong>
            </div>
            <b className="pc-ecuacion__op">+</b>
            <div className={`pc-ecuacion__termino ${ecuacion.resultado >= 0 ? 'pc-t--ingreso' : 'pc-t--gasto'}`}>
              <span>Resultado del ejercicio</span>
              <strong>{pesos(ecuacion.resultado)}</strong>
            </div>
          </div>
          <p className="pc-ecuacion__estado">
            {Math.abs(ecuacion.diferencia) < 0.01
              ? '✓ Balancea: la contabilidad cumple la partida doble.'
              : `✗ Diferencia de $ ${pesos(Math.abs(ecuacion.diferencia))}: hay asientos desbalanceados.`}
          </p>
        </div>
        <div className="pc-stats">
          <div>
            <strong>{stats.imputables}</strong>
            <span>cuentas imputables</span>
          </div>
          <div>
            <strong>{stats.rubros}</strong>
            <span>rubros</span>
          </div>
          <div>
            <strong>{stats.conMovimiento}</strong>
            <span>con saldo</span>
          </div>
          <div>
            <strong>{stats.sistema}</strong>
            <span>usadas por el sistema</span>
          </div>
        </div>
      </section>

      {/* Coherencia */}
      {!loading && controles.length ? (
        <section className={`pc-controles${errores ? ' has-error' : ''}`}>
          <h2>
            Coherencia del plan{' '}
            <small>{errores ? `${errores} problema(s) a corregir` : 'sin errores de estructura'}</small>
          </h2>
          <ul>
            {controles.map((c) => (
              <li key={c.codigo} className={`is-${c.nivel}`}>
                <button type="button" onClick={() => setControlAbierto((x) => (x === c.codigo ? null : c.codigo))} aria-expanded={controlAbierto === c.codigo}>
                  <span>{c.texto}</span>
                  <em>
                    {c.cuentas.length} {controlAbierto === c.codigo ? '▾' : '▸'}
                  </em>
                </button>
                {controlAbierto === c.codigo ? (
                  <ul className="pc-controles__lista">
                    {c.cuentas.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Filtros */}
      <div className="pc-filtros">
        <input
          type="search"
          className="pc-buscar"
          placeholder="Buscar código, cuenta o descripción…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <div className="pc-tipos" role="tablist" aria-label="Tipo de cuenta">
          <button type="button" role="tab" aria-selected={tipo === ''} className={tipo === '' ? 'is-on' : undefined} onClick={() => setTipo('')}>
            Todas
          </button>
          {TIPOS.filter((t) => arbol.some((r) => r.tipo === t.tipo)).map((t) => (
            <button
              key={t.tipo}
              type="button"
              role="tab"
              aria-selected={tipo === t.tipo}
              className={`pc-tipo--${t.clase}${tipo === t.tipo ? ' is-on' : ''}`}
              onClick={() => setTipo(t.tipo)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="pc-check">
          <input type="checkbox" checked={soloConSaldo} onChange={(e) => setSoloConSaldo(e.target.checked)} />
          Solo con saldo
        </label>
        <label className="pc-check">
          <input type="checkbox" checked={verBajas} onChange={(e) => setVerBajas(e.target.checked)} />
          Ver dadas de baja
        </label>
        <div className="pc-expandir">
          <button type="button" onClick={() => setAbiertos(new Set(todos.filter((n) => !n.imputable).map((n) => n.codigo)))}>
            Desplegar todo
          </button>
          <button type="button" onClick={() => setAbiertos(new Set(todos.filter((n) => n.codigo.split('.').length === 1).map((n) => n.codigo)))}>
            Solo rubros principales
          </button>
        </div>
      </div>

      {/* Árbol */}
      {loading ? (
        <p className="pc-vacio">Cargando plan de cuentas…</p>
      ) : arbolVisible.length === 0 ? (
        <p className="pc-vacio">No hay cuentas que coincidan.</p>
      ) : (
        <div className="pc-arbol">
          {arbolVisible.map((raiz) => {
            const saldo = saldoNatural(raiz)
            const abierta = filtrando || abiertosEfectivos.has(raiz.codigo)
            const cantidad = aplanar([raiz]).filter((n) => n.imputable).length
            return (
              <section key={raiz.codigo} className={`pc-raiz pc-raiz--${claseTipo(raiz.tipo)}`}>
                <button type="button" className="pc-raiz__head" onClick={() => alternar(raiz.codigo)} aria-expanded={abierta}>
                  <span className="pc-raiz__codigo">{raiz.codigo}</span>
                  <span className="pc-raiz__nombre">
                    {raiz.nombre}
                    <small>
                      {cantidad} cuentas imputables · naturaleza {raiz.naturaleza.toLowerCase()}
                    </small>
                  </span>
                  <span className="pc-raiz__saldo">
                    {Math.abs(saldo) < 0.01 ? 'Sin saldo' : `$ ${pesos(saldo)}`}
                  </span>
                  <span className="pc-raiz__caret" aria-hidden>
                    {abierta ? '▾' : '▸'}
                  </span>
                </button>
                {abierta ? (
                  <div className="pc-raiz__cuerpo">
                    <div className="pc-cabecera">
                      <span />
                      <span>Código</span>
                      <span>Cuenta</span>
                      <span />
                      <span className="pc-cabecera__saldo">Saldo al {fechaCorte.split('-').reverse().join('/')}</span>
                    </div>
                    {raiz.hijos.flatMap((h) => renderNodo(h, 0))}
                  </div>
                ) : null}
              </section>
            )
          })}
        </div>
      )}
      <p className="pc-pie">
        D = saldo deudor · A = saldo acreedor. En rojo, cuentas con saldo contrario a su naturaleza. Las regularizadoras (amortizaciones,
        previsiones, descuentos) tienen naturaleza opuesta a su rubro a propósito.
      </p>
    </div>
  )
}
