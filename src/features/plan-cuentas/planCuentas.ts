/**
 * Plan de cuentas como árbol: jerarquía por código (1 › 1.1 › 1.1.1 › 1.1.1.01), saldos que suben
 * a los rubros, ecuación patrimonial y controles de coherencia (tipo de cada cuenta igual al de su
 * rubro, sin huérfanas, nivel según el código, saldos contrarios a la naturaleza…).
 */

export type TipoCuenta = 'Activo' | 'Pasivo' | 'Patrimonio' | 'Ingreso' | 'Costo' | 'Gasto' | 'Cuenta de Orden'
export type Naturaleza = 'Deudora' | 'Acreedora'

export type CuentaPC = {
  id: number
  codigo: string
  nombre: string
  tipo: TipoCuenta
  nivel: number
  naturaleza: Naturaleza
  activa: boolean
  clave_sistema?: string | null
  descripcion?: string | null
}

/** Movimientos acumulados de una cuenta (de obtener_balance_general). */
export type MovimientoPC = { debe: number; haber: number }

export type NodoPC = CuentaPC & {
  hijos: NodoPC[]
  imputable: boolean
  /** Debe − haber de la cuenta y todas sus subcuentas. */
  saldoDH: number
  movimientos: number
  regularizadora: boolean
}

export const NATURALEZA_DEL_TIPO: Record<TipoCuenta, Naturaleza> = {
  Activo: 'Deudora',
  Pasivo: 'Acreedora',
  Patrimonio: 'Acreedora',
  Ingreso: 'Acreedora',
  Costo: 'Deudora',
  Gasto: 'Deudora',
  'Cuenta de Orden': 'Deudora'
}

/** Qué proceso automático usa cada cuenta del sistema. */
export const USO_SISTEMA: Record<string, { label: string; path: string }> = {
  caja: { label: 'Caja (cobros en efectivo)', path: '/erp/tesoreria' },
  bancos: { label: 'Bancos (transferencias)', path: '/erp/tesoreria' },
  deudores_ventas: { label: 'Facturas y cobros de clientes', path: '/erp/cuentas-por-cobrar' },
  iva_debito: { label: 'IVA de las facturas emitidas', path: '/erp/impuestos' },
  iva_credito: { label: 'IVA de las compras', path: '/erp/impuestos' },
  proveedores: { label: 'Compras y pagos a proveedores', path: '/erp/cuentas-por-pagar' },
  ventas: { label: 'Facturación', path: '/erp/facturas' }
}

/** Códigos de las cuentas del sistema según la estructura nueva (si la base no trae clave_sistema). */
export const CODIGOS_SISTEMA: Record<string, string> = {
  caja: '1.1.1.01',
  bancos: '1.1.1.02',
  deudores_ventas: '1.1.3.01',
  iva_debito: '2.1.3.01',
  iva_credito: '1.1.4.01',
  proveedores: '2.1.1.01',
  ventas: '4.1.1.01'
}

const n = (v: unknown) => Number(v) || 0
const r2 = (v: number) => Math.round(v * 100) / 100

export function codigoPadre(codigo: string): string | null {
  const i = codigo.lastIndexOf('.')
  return i < 0 ? null : codigo.slice(0, i)
}

export function segmentos(codigo: string): number {
  return codigo.split('.').length
}

/** Orden natural de códigos: 1.1.10 va después de 1.1.9. */
export function compararCodigos(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? -1
    const y = pb[i] ?? -1
    if (x !== y) return x - y
  }
  return 0
}

export function claveDe(c: Pick<CuentaPC, 'clave_sistema' | 'codigo'>): string | null {
  if (c.clave_sistema) return c.clave_sistema
  const encontrada = Object.entries(CODIGOS_SISTEMA).find(([, codigo]) => codigo === c.codigo)
  return encontrada ? encontrada[0] : null
}

/** Arma el árbol y suma los saldos de las hojas hacia los rubros. */
export function construirArbol(cuentas: CuentaPC[], movimientos: Map<string, MovimientoPC> = new Map()): NodoPC[] {
  const porCodigo = new Map<string, NodoPC>()
  const ordenadas = [...cuentas].sort((a, b) => compararCodigos(a.codigo, b.codigo))
  for (const c of ordenadas) {
    const m = movimientos.get(c.codigo)
    porCodigo.set(c.codigo, {
      ...c,
      hijos: [],
      imputable: true,
      saldoDH: m ? r2(n(m.debe) - n(m.haber)) : 0,
      movimientos: m ? (n(m.debe) || n(m.haber) ? 1 : 0) : 0,
      regularizadora: c.naturaleza !== NATURALEZA_DEL_TIPO[c.tipo]
    })
  }
  const raices: NodoPC[] = []
  for (const nodo of porCodigo.values()) {
    // El padre es el código más cercano que exista (1.1.3.01 → 1.1.3 → 1.1 → 1).
    let padre: NodoPC | undefined
    for (let p = codigoPadre(nodo.codigo); p && !padre; p = codigoPadre(p)) padre = porCodigo.get(p)
    if (padre) {
      padre.hijos.push(nodo)
      padre.imputable = false
    } else raices.push(nodo)
  }
  const sumar = (nodo: NodoPC): { saldo: number; movs: number } => {
    let saldo = nodo.saldoDH
    let movs = nodo.movimientos
    for (const h of nodo.hijos) {
      const s = sumar(h)
      saldo += s.saldo
      movs += s.movs
    }
    nodo.saldoDH = r2(saldo)
    nodo.movimientos = movs
    return { saldo: nodo.saldoDH, movs }
  }
  raices.forEach(sumar)
  return raices
}

export function aplanar(nodos: NodoPC[]): NodoPC[] {
  return nodos.flatMap((nd) => [nd, ...aplanar(nd.hijos)])
}

/** Saldo expresado según la naturaleza de la cuenta: positivo = saldo normal. */
export function saldoNatural(nodo: Pick<NodoPC, 'saldoDH' | 'naturaleza'>): number {
  return nodo.naturaleza === 'Deudora' ? nodo.saldoDH : -nodo.saldoDH
}

export type Ecuacion = {
  activo: number
  pasivo: number
  patrimonio: number
  resultado: number
  /** Activo − (Pasivo + PN + Resultado). Con partida doble tiene que dar 0. */
  diferencia: number
}

/** Activo = Pasivo + Patrimonio Neto + Resultado del ejercicio (ingresos − costos − gastos). */
export function ecuacionPatrimonial(cuentas: CuentaPC[], movimientos: Map<string, MovimientoPC>): Ecuacion {
  let activo = 0
  let pasivo = 0
  let patrimonio = 0
  let resultado = 0
  for (const c of cuentas) {
    const m = movimientos.get(c.codigo)
    if (!m) continue
    const dh = n(m.debe) - n(m.haber)
    if (c.tipo === 'Activo') activo += dh
    else if (c.tipo === 'Pasivo') pasivo -= dh
    else if (c.tipo === 'Patrimonio') patrimonio -= dh
    else if (c.tipo === 'Ingreso' || c.tipo === 'Costo' || c.tipo === 'Gasto') resultado -= dh
  }
  return {
    activo: r2(activo),
    pasivo: r2(pasivo),
    patrimonio: r2(patrimonio),
    resultado: r2(resultado),
    diferencia: r2(activo - pasivo - patrimonio - resultado)
  }
}

export type ControlPC = { codigo: string; nivel: 'error' | 'aviso' | 'info'; texto: string; cuentas: string[] }

/** Coherencia del plan. Sin errores = estructura sana. */
export function controlesPlan(cuentas: CuentaPC[], movimientos: Map<string, MovimientoPC> = new Map()): ControlPC[] {
  const out: ControlPC[] = []
  const porCodigo = new Map(cuentas.map((c) => [c.codigo, c]))
  const arbol = construirArbol(cuentas, movimientos)
  const nodos = aplanar(arbol)

  // Tipo distinto al del rubro raíz (p. ej. un pasivo colgado del activo)
  const tipoCruzado = cuentas.filter((c) => {
    const raiz = porCodigo.get(c.codigo.split('.')[0])
    return raiz && raiz.tipo !== c.tipo
  })
  if (tipoCruzado.length) {
    out.push({
      codigo: 'tipo-cruzado',
      nivel: 'error',
      texto: 'Cuentas ubicadas en un rubro de otro tipo (por ejemplo, un pasivo dentro del activo).',
      cuentas: tipoCruzado.map((c) => `${c.codigo} ${c.nombre} (${c.tipo} dentro de ${porCodigo.get(c.codigo.split('.')[0])?.nombre})`)
    })
  }

  const huerfanas = cuentas.filter((c) => {
    const p = codigoPadre(c.codigo)
    return p !== null && !porCodigo.has(p)
  })
  if (huerfanas.length) {
    out.push({ codigo: 'huerfanas', nivel: 'aviso', texto: 'Cuentas sin su rubro inmediato.', cuentas: huerfanas.map((c) => `${c.codigo} ${c.nombre}`) })
  }

  const nivelMal = cuentas.filter((c) => /^\d+(\.\d+)*$/.test(c.codigo) && Number(c.nivel) !== segmentos(c.codigo))
  if (nivelMal.length) {
    out.push({ codigo: 'nivel', nivel: 'aviso', texto: 'El nivel no coincide con el código.', cuentas: nivelMal.map((c) => `${c.codigo} (nivel ${c.nivel})`) })
  }

  const repetidos = new Map<string, CuentaPC[]>()
  for (const c of cuentas.filter((x) => x.activa)) {
    const k = `${c.nombre.trim().toLowerCase()}|${codigoPadre(c.codigo)}`
    repetidos.set(k, [...(repetidos.get(k) ?? []), c])
  }
  const dup = [...repetidos.values()].filter((l) => l.length > 1).flat()
  if (dup.length) {
    out.push({ codigo: 'duplicadas', nivel: 'aviso', texto: 'Cuentas con el mismo nombre dentro del mismo rubro.', cuentas: dup.map((c) => `${c.codigo} ${c.nombre}`) })
  }

  // Rubros de último nivel sin subcuentas: no deberían recibir asientos directamente
  const rubrosHoja = nodos.filter((nd) => nd.imputable && segmentos(nd.codigo) < 4 && nd.activa)
  if (rubrosHoja.length) {
    out.push({
      codigo: 'rubro-sin-cuentas',
      nivel: 'info',
      texto: 'Rubros sin cuentas imputables debajo (conviene abrir al menos una subcuenta).',
      cuentas: rubrosHoja.map((c) => `${c.codigo} ${c.nombre}`)
    })
  }

  // Saldo contrario a la naturaleza en cuentas imputables (ej. Caja acreedora)
  const contrarias = nodos.filter((nd) => nd.imputable && saldoNatural(nd) < -0.009)
  if (contrarias.length) {
    out.push({
      codigo: 'saldo-contrario',
      nivel: 'aviso',
      texto: 'Cuentas con saldo contrario a su naturaleza (revisar imputaciones).',
      cuentas: contrarias.map((c) => `${c.codigo} ${c.nombre}`)
    })
  }

  const faltan = Object.keys(CODIGOS_SISTEMA).filter((k) => !cuentas.some((c) => claveDe(c) === k))
  if (faltan.length) {
    out.push({
      codigo: 'sistema',
      nivel: 'error',
      texto: 'Faltan cuentas que usan los asientos automáticos.',
      cuentas: faltan.map((k) => `${CODIGOS_SISTEMA[k]} · ${USO_SISTEMA[k].label}`)
    })
  }

  const inactivasConSaldo = nodos.filter((nd) => !nd.activa && nd.imputable && Math.abs(nd.saldoDH) > 0.009)
  if (inactivasConSaldo.length) {
    out.push({
      codigo: 'inactiva-saldo',
      nivel: 'aviso',
      texto: 'Cuentas dadas de baja que todavía tienen saldo.',
      cuentas: inactivasConSaldo.map((c) => `${c.codigo} ${c.nombre}`)
    })
  }

  const orden: Record<ControlPC['nivel'], number> = { error: 0, aviso: 1, info: 2 }
  return out.sort((a, b) => orden[a.nivel] - orden[b.nivel])
}

/** Hay que aplicar el patch de estructura: quedan IVA o Clientes en el lugar viejo. */
export function necesitaReestructurar(cuentas: CuentaPC[]): boolean {
  const c = (codigo: string) => cuentas.find((x) => x.codigo === codigo)
  return (
    /IVA D.bito/i.test(c('1.1.2.01')?.nombre ?? '') ||
    /IVA Cr.dito/i.test(c('2.1.2.01')?.nombre ?? '') ||
    /Clientes/i.test(c('1.1.1.03')?.nombre ?? '')
  )
}

/** Filtra el árbol conservando los rubros que tengan algún descendiente que coincida. */
export function filtrarArbol(nodos: NodoPC[], coincide: (n: NodoPC) => boolean): NodoPC[] {
  const out: NodoPC[] = []
  for (const nd of nodos) {
    const hijos = filtrarArbol(nd.hijos, coincide)
    if (coincide(nd) || hijos.length) out.push({ ...nd, hijos: coincide(nd) && !hijos.length ? nd.hijos : hijos })
  }
  return out
}
