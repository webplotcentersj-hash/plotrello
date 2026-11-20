import { nombreFeriado } from './feriadosArgentina'
import { cuilDigitos, type RrhhLibroSueldosItem } from './rrhhLibroSueldos'

/** Lo que el libro toma del legajo del empleado. */
export type LegajoParaLibro = {
  cuil?: string | null
  n_legajo?: number | null
  banco?: string | null
  cbu?: string | null
  codigo_os?: string | null
  obra_social?: string | null
  categoria?: string | null
  puesto?: string | null
  fecha_ingreso?: string | null
  conyuge?: boolean | null
  hijos?: number | null
}

type ItemHidratable = Pick<
  RrhhLibroSueldosItem,
  | 'cuil'
  | 'n_legajo'
  | 'banco'
  | 'cbu'
  | 'codigo_os'
  | 'categoria'
  | 'fecha_ingreso'
  | 'conyuge'
  | 'hijos'
  | 'forma_pago'
>

const vacio = (s: string | null | undefined) => !String(s ?? '').trim()

/**
 * Completa el ítem con los datos del legajo: lo vacío se llena, y la familia (cónyuge / hijos,
 * que van al F.931) se toma siempre del legajo, que es donde se carga.
 */
export function completarItemDesdeLegajo<T extends ItemHidratable>(it: T, leg: LegajoParaLibro | null | undefined): T {
  if (!leg) return it
  const cbu = vacio(it.cbu) ? leg.cbu ?? null : it.cbu
  const cbuOk = String(cbu || '').replace(/\D/g, '').length === 22
  return {
    ...it,
    cuil: cuilDigitos(it.cuil).length === 11 ? it.cuil : leg.cuil || it.cuil || '',
    n_legajo: it.n_legajo || leg.n_legajo || it.n_legajo,
    banco: vacio(it.banco) ? leg.banco ?? null : it.banco,
    cbu,
    codigo_os: vacio(it.codigo_os) ? leg.codigo_os ?? null : it.codigo_os,
    categoria: vacio(it.categoria) ? leg.categoria || leg.puesto || it.categoria : it.categoria,
    fecha_ingreso: it.fecha_ingreso || leg.fecha_ingreso || null,
    conyuge: leg.conyuge != null ? leg.conyuge === true : it.conyuge,
    hijos: leg.hijos != null ? Math.max(0, Math.floor(Number(leg.hijos) || 0)) : it.hijos,
    // Con CBU válido y sin forma elegida (efectivo por defecto): acreditación (art. 124 LCT).
    forma_pago: cbuOk && (it.forma_pago || '1') === '1' ? '3' : it.forma_pago
  }
}

function esHabil(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return dow !== 0 && dow !== 6 && !nombreFeriado(iso)
}

/**
 * Fecha límite de pago del sueldo mensual: 4.º día hábil del mes siguiente (art. 128 LCT).
 */
export function fechaPagoLegal(periodo: string): string {
  const [y, m] = periodo.split('-').map(Number)
  const d = new Date(y, m, 1)
  let habiles = 0
  for (let i = 0; i < 31; i++) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (esHabil(iso)) {
      habiles += 1
      if (habiles === 4) return iso
    }
    d.setDate(d.getDate() + 1)
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export type FaltanteLibro = 'CUIL' | 'CBU' | 'Categoría' | 'Ingreso' | 'Obra social' | 'Básico'

/** Datos que faltan para un recibo / TXT ARCA completo. */
export function faltantesItem(
  it: Pick<RrhhLibroSueldosItem, 'cuil' | 'cbu' | 'categoria' | 'fecha_ingreso' | 'codigo_os' | 'sueldo_basico' | 'forma_pago'>
): FaltanteLibro[] {
  const out: FaltanteLibro[] = []
  if (cuilDigitos(it.cuil).length !== 11) out.push('CUIL')
  if (String(it.cbu || '').replace(/\D/g, '').length !== 22) out.push('CBU')
  if (vacio(it.categoria)) out.push('Categoría')
  if (!it.fecha_ingreso) out.push('Ingreso')
  if (String(it.codigo_os || '').replace(/\D/g, '').replace(/^0+/, '') === '') out.push('Obra social')
  if (!(Number(it.sueldo_basico) > 0)) out.push('Básico')
  return out
}
