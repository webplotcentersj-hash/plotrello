import {
  etiquetaPeriodoLibro,
  fechaCortaEs,
  formatArs2,
  formatCuil,
  type ReciboLiquidado
} from '../utils/rrhhLibroSueldos'
import './ReciboSueldoLct.css'

function money(n: number | null | undefined) {
  if (n == null || n === 0) return ''
  return formatArs2(n)
}

function money0(n: number | null | undefined) {
  if (n == null) return ''
  return formatArs2(n)
}

type Slice = { label: string; value: number; color: string }

function pieBackground(slices: Slice[], total: number): string {
  if (!(total > 0)) return '#e5e7eb'
  let acc = 0
  const parts: string[] = []
  for (const s of slices) {
    if (!(s.value > 0)) continue
    const from = (acc / total) * 100
    acc += s.value
    const to = (acc / total) * 100
    parts.push(`${s.color} ${from.toFixed(2)}% ${to.toFixed(2)}%`)
  }
  return `conic-gradient(${parts.join(', ')})`
}

type Props = {
  liq: ReciboLiquidado
}

const ReciboSueldoLct = ({ liq }: Props) => {
  const { item, empresa, composicion: c } = liq
  const costo = liq.costoEmpleador || 1
  const slices: Slice[] = [
    { label: 'Sueldo Neto', value: liq.neto, color: '#2f5597' },
    { label: 'Costo Sindical', value: c.sindicalEmpleador + c.sindicalTrabajador, color: '#ed7d31' },
    { label: 'Seguridad Social', value: c.ssEmpleador + c.ssTrabajador, color: '#ffc000' },
    { label: 'Obra Social', value: c.osEmpleador + c.osTrabajador, color: '#70ad47' },
    { label: 'Costo INSSJP', value: c.inssjpEmpleador + c.inssjpTrabajador, color: '#c00000' },
    { label: 'Costo SCVO', value: c.scvo, color: '#833c0c' }
  ]
  const pct = (v: number) => `${((v / costo) * 100).toFixed(1).replace('.', ',')}%`

  return (
    <div className="recibo-lct">
      <table>
        <tbody>
          <tr>
            <td colSpan={3} className="emp-name">
              {empresa.nombre}
            </td>
            <td colSpan={5} />
          </tr>
          <tr>
            <td colSpan={3} className="emp-addr">
              {empresa.domicilio}
            </td>
            <td colSpan={5} />
          </tr>
          <tr>
            <td className="emp-cuit">C.U.I.T.</td>
            <td colSpan={2}>{formatCuil(empresa.cuit)}</td>
            <td colSpan={5} />
          </tr>
          <tr>
            <td colSpan={8} className="title">
              RECIBO DE SUELDO – LCT – MENSUAL
            </td>
          </tr>
          <tr className="hd">
            <td>Periodo</td>
            <td colSpan={2}>Apellido y Nombre</td>
            <td>N.º Legajo</td>
            <td colSpan={2}>Sueldo Bruto</td>
            <td colSpan={2}>Antigüedad Reconocida</td>
          </tr>
          <tr>
            <td className="center">{etiquetaPeriodoLibro(empresa.periodo)}</td>
            <td colSpan={2} className="center">
              {item.apellido_nombre}
            </td>
            <td className="center">{item.n_legajo || ''}</td>
            <td colSpan={2} className="num">
              {formatArs2(liq.bruto)}
            </td>
            <td colSpan={2} className="center">
              {item.antiguedad_reconocida || ''}
            </td>
          </tr>
          <tr>
            <td className="hd">Fecha de Ingreso</td>
            <td className="hd">Categoria Laboral</td>
            <td className="hd">C.U.I.L.</td>
            <td colSpan={2} className="hd-sub">
              Cargas Sociales
            </td>
            <td className="hd">Banco</td>
            <td className="hd">Periodo</td>
            <td className="hd">Fecha Pago</td>
          </tr>
          <tr>
            <td className="center">{fechaCortaEs(item.fecha_ingreso)}</td>
            <td className="center">{item.categoria || ''}</td>
            <td className="center">{formatCuil(item.cuil)}</td>
            <td colSpan={2} />
            <td className="center">{empresa.banco}</td>
            <td className="center">{etiquetaPeriodoLibro(empresa.periodo)}</td>
            <td className="center">{fechaCortaEs(empresa.fechaPago)}</td>
          </tr>
          <tr>
            <td colSpan={6} className="bar-yellow">
              COSTO TOTAL EMPLEADOR
            </td>
            <td colSpan={2} className="bar-yellow num">
              {formatArs2(liq.costoEmpleador)}
            </td>
          </tr>
          <tr className="hd">
            <td colSpan={3}>CONCEPTO</td>
            <td>UNIDAD</td>
            <td colSpan={2}>BASE</td>
            <td colSpan={2}>MONTO</td>
          </tr>
          {liq.lineasEmpleador.map((l) => (
            <tr key={`e-${l.concepto}`}>
              <td colSpan={3}>{l.concepto}</td>
              <td className={l.pct != null ? 'pct' : 'center'}>{l.unidad}</td>
              <td colSpan={2} className="num">
                {money(l.base)}
              </td>
              <td colSpan={2} className="num">
                {money0(l.montoEmpleador)}
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={6} className="bar-blue">
              SUBTOTAL CONTRIBUCIONES EMPLEADOR
            </td>
            <td colSpan={2} className="bar-blue num">
              {formatArs2(liq.contribuciones)}
            </td>
          </tr>
          <tr>
            <td colSpan={6} className="bar-yellow">
              SUELDO BRUTO
            </td>
            <td colSpan={2} className="bar-yellow num">
              {formatArs2(liq.bruto)}
            </td>
          </tr>
          <tr className="hd">
            <td colSpan={2}>CONCEPTO</td>
            <td>UNIDAD</td>
            <td>BASE</td>
            <td>REMUNERATIVO</td>
            <td>NO REMUNERATIVO</td>
            <td colSpan={2}>DESCUENTOS</td>
          </tr>
          {liq.lineasTrabajador.map((l) => (
            <tr key={`t-${l.concepto}`}>
              <td colSpan={2}>{l.concepto}</td>
              <td className={l.pct != null ? 'pct' : 'center'}>{l.unidad}</td>
              <td className="num">{money(l.base)}</td>
              <td className="num">{money(l.remunerativo)}</td>
              <td className="num">{money(l.noRemunerativo)}</td>
              <td colSpan={2} className="num">
                {money(l.descuento)}
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={2} className="center">
              COMPOSICIÓN SALARIAL »
            </td>
            <td colSpan={2} className="hd">
              Remunerativo:
            </td>
            <td className="num">{formatArs2(liq.bruto)}</td>
            <td className="hd">No remunerativo:</td>
            <td className="hd">Descuentos:</td>
            <td className="num">{formatArs2(liq.descuentos)}</td>
          </tr>
          <tr>
            <td className="neto">SUELDO NETO</td>
            <td colSpan={5} className="neto">
              {liq.netoEnLetras}
            </td>
            <td colSpan={2} className="neto num">
              {formatArs2(liq.neto)}
            </td>
          </tr>
          <tr>
            <td colSpan={8} className="obs">
              Observaciones: Recibí conforme copia del original del presente recibo.
            </td>
          </tr>
        </tbody>
      </table>

      <table>
        <tbody>
          <tr>
            <td colSpan={4} className="hd">
              Detalle de la composición salarial
            </td>
            <td colSpan={4} className="hd">
              Costo Total Empleador
            </td>
          </tr>
          <tr className="hd">
            <td />
            <td>Empleador</td>
            <td>Trabajador</td>
            <td>Total</td>
            <td colSpan={4} rowSpan={8} style={{ background: '#fff', color: '#111' }}>
              <div className="pie" style={{ background: pieBackground(slices, costo) }} />
              <div className="legend">
                {slices.map((s) => (
                  <div key={s.label}>
                    <span className="dot" style={{ background: s.color }} />
                    {s.label} {pct(s.value)}
                  </div>
                ))}
              </div>
            </td>
          </tr>
          <tr>
            <td>Costo Sindical</td>
            <td className="num">{formatArs2(c.sindicalEmpleador)}</td>
            <td className="num">{formatArs2(c.sindicalTrabajador)}</td>
            <td className="num">{formatArs2(c.sindicalEmpleador + c.sindicalTrabajador)}</td>
          </tr>
          <tr>
            <td>Seguridad Social</td>
            <td className="num">{formatArs2(c.ssEmpleador)}</td>
            <td className="num">{formatArs2(c.ssTrabajador)}</td>
            <td className="num">{formatArs2(c.ssEmpleador + c.ssTrabajador)}</td>
          </tr>
          <tr>
            <td>Obra Social</td>
            <td className="num">{formatArs2(c.osEmpleador)}</td>
            <td className="num">{formatArs2(c.osTrabajador)}</td>
            <td className="num">{formatArs2(c.osEmpleador + c.osTrabajador)}</td>
          </tr>
          <tr>
            <td>Costo INSSJP</td>
            <td className="num">{formatArs2(c.inssjpEmpleador)}</td>
            <td className="num">{formatArs2(c.inssjpTrabajador)}</td>
            <td className="num">{formatArs2(c.inssjpEmpleador + c.inssjpTrabajador)}</td>
          </tr>
          <tr>
            <td>Costo SCVO</td>
            <td className="num">{formatArs2(c.scvo)}</td>
            <td className="num">$ 0,00</td>
            <td className="num">{formatArs2(c.scvo)}</td>
          </tr>
          <tr>
            <td>
              <strong>Totales</strong>
            </td>
            <td className="num">
              <strong>{formatArs2(liq.contribuciones)}</strong>
            </td>
            <td className="num">
              <strong>{formatArs2(liq.descuentos)}</strong>
            </td>
            <td className="num">
              <strong>{formatArs2(round2sum(liq.contribuciones, liq.descuentos))}</strong>
            </td>
          </tr>
          <tr>
            <td colSpan={4} className="obs">
              Nota: Seguridad social del Empleador incluye SIPA, Fondo Nacional de Empleo y Asignaciones
              Familiares
            </td>
          </tr>
          <tr>
            <td colSpan={8} className="firma">
              Firma Empleador / Empleado
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function round2sum(a: number, b: number) {
  return Math.round((a + b) * 100) / 100
}

export default ReciboSueldoLct
