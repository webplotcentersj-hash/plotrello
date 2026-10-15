import { memo } from 'react'
import {
  etiquetaPeriodoLibro,
  fechaCortaEs,
  formatArs2,
  formatCuil,
  round2,
  type ReciboLinea,
  type ReciboLiquidado
} from '../utils/rrhhLibroSueldos'
import './ReciboSueldoLct.css'

function money(n: number | null | undefined) {
  if (n == null || n === 0) return ''
  return formatArs2(n)
}

function moneyKeep(n: number | null | undefined) {
  if (n == null) return ''
  return formatArs2(n)
}


const YELLOW_EMP = new Set([
  'SIPA – Ley 24.241',
  'Ley 19.032 – INSSJP',
  'Obra Social',
  'Asignaciones Familiares',
  'Fondo Nacional de Empleo'
])

type Slice = { label: string; value: number; color: string }

const PieExcel = memo(function PieExcel({ slices, total }: { slices: Slice[]; total: number }) {
  const cx = 110
  const cy = 110
  const r = 96
  let angle = -Math.PI / 2
  const paths: Array<{ d: string; color: string; key: string }> = []
  const labels: Array<{ x: number; y: number; text: string; fill: string }> = []

  for (const s of slices) {
    const frac = total > 0 ? s.value / total : 0
    if (frac <= 0) continue
    const sweep = Math.min(frac, 1) * 2 * Math.PI
    const a1 = angle
    const a2 = angle + sweep
    const large = sweep > Math.PI ? 1 : 0
    const x1 = cx + r * Math.cos(a1)
    const y1 = cy + r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2)
    const y2 = cy + r * Math.sin(a2)
    paths.push({
      key: s.label,
      color: s.color,
      d: `M ${cx} ${cy} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`
    })
    if (frac >= 0.02) {
      const mid = a1 + sweep / 2
      const lr = r * 0.62
      labels.push({
        x: cx + lr * Math.cos(mid),
        y: cy + lr * Math.sin(mid),
        text: `${(frac * 100).toFixed(1).replace('.', ',')}%`,
        fill: frac > 0.12 ? '#fff' : '#111'
      })
    }
    angle = a2
  }

  return (
    <svg className="recibo-lct-pie" viewBox="0 0 220 220" width="220" height="220" aria-label="Costo total empleador">
      {paths.map((p) => (
        <path key={p.key} d={p.d} fill={p.color} stroke="#fff" strokeWidth="1.2" />
      ))}
      {labels.map((l) => (
        <text
          key={l.text + l.x}
          x={l.x}
          y={l.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="12"
          fontFamily="Calibri, Arial, sans-serif"
          fontWeight="700"
          fill={l.fill}
        >
          {l.text}
        </text>
      ))}
    </svg>
  )
})

type Props = { liq: ReciboLiquidado }

const ReciboSueldoLct = memo(function ReciboSueldoLct({ liq }: Props) {
  const { item, empresa, composicion: c } = liq
  const costo = liq.costoEmpleador || 1
  const slices: Slice[] = [
    { label: 'Sueldo Neto', value: liq.neto, color: '#2F5597' },
    { label: 'Costo Sindical', value: round2(c.sindicalEmpleador + c.sindicalTrabajador), color: '#ED7D31' },
    { label: 'Seguridad Social', value: round2(c.ssEmpleador + c.ssTrabajador), color: '#FFC000' },
    { label: 'Obra Social', value: round2(c.osEmpleador + c.osTrabajador), color: '#70AD47' },
    { label: 'Costo INSSJP', value: round2(c.inssjpEmpleador + c.inssjpTrabajador), color: '#C00000' },
    { label: 'Costo ART', value: c.art || 0, color: '#5B9BD5' },
    { label: 'Costo SCVO', value: c.scvo, color: '#833C0C' }
  ]

  const empLineas = liq.lineasEmpleador.filter((l) => l.concepto !== 'scvo' || (l.montoEmpleador || 0) > 0)
  const scvoLinea = liq.lineasEmpleador.find((l) => l.concepto === 'scvo')
  const haberes = liq.lineasTrabajador.filter((l) => (l.remunerativo || 0) > 0 || (l.noRemunerativo || 0) > 0)
  const desc = liq.lineasTrabajador.filter((l) => (l.descuento || 0) > 0)

  return (
    <div className="recibo-lct">
      <table className="recibo-lct-sheet">
        <colgroup>
          <col style={{ width: '12%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '7%' }} />
        </colgroup>
        <tbody>
          <tr>
            <td colSpan={4} className="emp-name">
              {empresa.nombre}
            </td>
            <td colSpan={8} className="blank" />
          </tr>
          <tr>
            <td colSpan={4} className="emp-addr">
              {empresa.domicilio}
            </td>
            <td colSpan={8} className="blank" />
          </tr>
          <tr>
            <td className="emp-cuit">C.U.I.T.</td>
            <td colSpan={2} className="emp-cuit-val">
              {empresa.cuit.replace(/\D/g, '')}
            </td>
            <td colSpan={9} className="blank" />
          </tr>
          <tr>
            <td colSpan={12} className="title">
              RECIBO DE SUELDO – LCT – MENSUAL
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="hd">
              Periodo
            </td>
            <td colSpan={4} className="hd">
              Apellido y Nombre
            </td>
            <td colSpan={2} className="hd">
              N.º Legajo
            </td>
            <td colSpan={2} className="hd">
              Sueldo Bruto
            </td>
            <td colSpan={2} className="hd">
              Antigüedad Reconocida
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="center">
              {etiquetaPeriodoLibro(empresa.periodo)}
            </td>
            <td colSpan={4} className="center">
              {item.apellido_nombre}
            </td>
            <td colSpan={2} className="center">
              {item.n_legajo || ''}
            </td>
            <td colSpan={2} className="num">
              {formatArs2(liq.bruto)}
            </td>
            <td colSpan={2} className="center">
              {item.antiguedad_reconocida || ''}
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="hd">
              Fecha de Ingreso
            </td>
            <td colSpan={3} className="hd">
              Categoria Laboral
            </td>
            <td colSpan={2} className="hd">
              C.U.I.L.
            </td>
            <td colSpan={5} className="hd-sub">
              Cargas Sociales
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="center">
              {fechaCortaEs(item.fecha_ingreso)}
            </td>
            <td colSpan={3} className="center">
              {item.categoria || ''}
            </td>
            <td colSpan={2} className="center">
              {formatCuil(item.cuil)}
            </td>
            <td colSpan={2} className="hd">
              Banco
            </td>
            <td className="hd">Periodo</td>
            <td colSpan={2} className="hd">
              Fecha Pago
            </td>
          </tr>
          <tr>
            <td colSpan={7} />
            <td colSpan={2} className="center">
              {empresa.banco}
            </td>
            <td className="center">{etiquetaPeriodoLibro(empresa.periodo)}</td>
            <td colSpan={2} className="center">
              {fechaCortaEs(empresa.fechaPago)}
            </td>
          </tr>
          <tr>
            <td colSpan={10} className="bar-green">
              COSTO TOTAL EMPLEADOR
            </td>
            <td colSpan={2} className="bar-green num">
              {formatArs2(liq.costoEmpleador)}
            </td>
          </tr>
          <tr>
            <td colSpan={7} className="hd">
              CONCEPTO
            </td>
            <td className="hd">UNIDAD</td>
            <td colSpan={2} className="hd">
              BASE
            </td>
            <td colSpan={2} className="hd">
              MONTO
            </td>
          </tr>
          {empLineas
            .filter((l) => l.concepto !== 'scvo')
            .map((l) => (
              <EmpRow key={l.concepto} linea={l} yellow={YELLOW_EMP.has(l.concepto)} />
            ))}
          {scvoLinea ? (
            <tr>
              <td colSpan={7}>scvo</td>
              <td />
              <td colSpan={2} />
              <td colSpan={2} className="num">
                {moneyKeep(scvoLinea.montoEmpleador)}
              </td>
            </tr>
          ) : null}
          <tr>
            <td colSpan={12} className="blank-row" />
          </tr>
          <tr>
            <td colSpan={12} className="blank-row" />
          </tr>
          <tr>
            <td colSpan={10} className="bar-blue">
              SUBTOTAL CONTRIBUCIONES EMPLEADOR
            </td>
            <td colSpan={2} className="bar-blue num">
              {formatArs2(liq.contribuciones)}
            </td>
          </tr>
          <tr>
            <td colSpan={10} className="bar-green">
              SUELDO BRUTO
            </td>
            <td colSpan={2} className="bar-green num">
              {formatArs2(liq.bruto)}
            </td>
          </tr>
          <tr>
            <td colSpan={4} className="hd">
              CONCEPTO
            </td>
            <td className="hd">UNIDAD</td>
            <td colSpan={2} className="hd">
              BASE
            </td>
            <td colSpan={2} className="hd">
              REMUNERATIVO
            </td>
            <td colSpan={2} className="hd">
              NO REMUNERATIVO
            </td>
            <td className="hd">DESCUENTOS</td>
          </tr>
          {haberes.map((l) => (
            <tr key={`h-${l.concepto}`}>
              <td colSpan={4}>{l.concepto}</td>
              <td className="center">{l.unidad}</td>
              <td colSpan={2} className="num">
                {money(l.base)}
              </td>
              <td colSpan={2} className="num remun">
                {money(l.remunerativo)}
              </td>
              <td colSpan={2} className="num">
                {money(l.noRemunerativo)}
              </td>
              <td className="num">{money(l.descuento)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={12} className="blank-row" />
          </tr>
          {desc.map((l) => (
            <tr key={`d-${l.concepto}`}>
              <td colSpan={4}>{l.concepto}</td>
              <td className="center">{l.unidad}</td>
              <td colSpan={2} className="num">
                {moneyKeep(l.base)}
              </td>
              <td colSpan={2} />
              <td colSpan={2} />
              <td className="num">{moneyKeep(l.descuento)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={12} className="blank-row" />
          </tr>
          <tr>
            <td colSpan={6} className="hd-grey">
              COMPOSICIÓN SALARIAL »
            </td>
            <td colSpan={2} className="hd">
              Remunerativo:
            </td>
            <td colSpan={2} className="hd">
              No remunerativo:
            </td>
            <td colSpan={2} className="hd">
              Descuentos:
            </td>
          </tr>
          <tr>
            <td colSpan={6} />
            <td colSpan={2} className="num">
              {formatArs2(liq.bruto)}
            </td>
            <td colSpan={2} />
            <td colSpan={2} className="num">
              {formatArs2(liq.descuentos)}
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="neto">
              SUELDO NETO
            </td>
            <td colSpan={8} className="neto letras">
              {liq.netoEnLetras}
            </td>
            <td colSpan={2} className="neto num">
              {formatArs2(liq.neto)}
            </td>
          </tr>
          <tr>
            <td colSpan={12} className="obs-label">
              Observaciones:
            </td>
          </tr>
          <tr>
            <td colSpan={12} className="obs-text">
              Recibí conforme copia del original del presente recibo.
            </td>
          </tr>
          <tr>
            <td colSpan={8} />
            <td colSpan={4} className="firma">
              Firma Empleador / Empleado
            </td>
          </tr>
        </tbody>
      </table>

      <div className="recibo-lct-bottom">
        <div className="recibo-lct-comp">
          <div className="hd-grey comp-title">Detalle de la composición salarial</div>
          <table>
            <thead>
              <tr>
                <th />
                <th>Empleador</th>
                <th>Trabajador</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <CompRow
                label="Costo Sindical"
                a={c.sindicalEmpleador}
                b={c.sindicalTrabajador}
              />
              <CompRow label="Seguridad Social" a={c.ssEmpleador} b={c.ssTrabajador} />
              <CompRow label="Obra Social" a={c.osEmpleador} b={c.osTrabajador} />
              <CompRow label="Costo INSSJP" a={c.inssjpEmpleador} b={c.inssjpTrabajador} />
              <CompRow label="Costo ART" a={c.art} b={0} blankZero />
              <CompRow label="Costo SCVO" a={c.scvo} b={0} />
              <tr className="tot">
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
                  <strong>{formatArs2(round2(liq.contribuciones + liq.descuentos))}</strong>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="nota">
            Nota: Seguridad social del Empleador incluye SIPA, Fondo Nacional de Empleo y Asignaciones Familiares
          </p>
        </div>

        <div className="recibo-lct-pie-block">
          <div className="hd-grey comp-title">Costo Total Empleador</div>
          <div className="pie-wrap">
            <ul className="pie-legend">
              {slices.map((s) => (
                <li key={s.label}>
                  <span className="swatch" style={{ background: s.color }} />
                  {s.label}
                </li>
              ))}
            </ul>
            <div className="pie-chart">
              <PieExcel slices={slices} total={costo} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

function EmpRow({ linea, yellow }: { linea: ReciboLinea; yellow: boolean }) {
  return (
    <tr>
      <td colSpan={7}>{linea.concepto}</td>
      <td className={yellow ? 'pct' : 'center'}>{linea.unidad}</td>
      <td colSpan={2} className="num">
        {moneyKeep(linea.base)}
      </td>
      <td colSpan={2} className="num">
        {moneyKeep(linea.montoEmpleador)}
      </td>
    </tr>
  )
}

function CompRow({
  label,
  a,
  b,
  blankZero
}: {
  label: string
  a: number
  b: number
  blankZero?: boolean
}) {
  if (blankZero && !(a > 0) && !(b > 0)) {
    return (
      <tr>
        <td>{label}</td>
        <td />
        <td />
        <td />
      </tr>
    )
  }
  return (
    <tr>
      <td>{label}</td>
      <td className="num">{a ? formatArs2(a) : ''}</td>
      <td className="num">{b ? formatArs2(b) : ''}</td>
      <td className="num">{a + b ? formatArs2(round2(a + b)) : ''}</td>
    </tr>
  )
}

export default ReciboSueldoLct
