import { jsPDF } from 'jspdf'
import type { LiquidacionEmpleado } from './liquidacionMensual'
import { totalesLiquidacion } from './liquidacionMensual'
import { cargarLogoPlotLabDataUrl } from './relojTabletTarjetaPdf'

type Rgb = [number, number, number]

function pesos(n: number): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const ars = (n: number): string => `$ ${pesos(n)}`

function fechaCorta(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function diaSemana(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const dia = new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long' })
  return dia.charAt(0).toUpperCase() + dia.slice(1)
}

const plural = (n: number, uno: string, varios: string): string => `${n} ${n === 1 ? uno : varios}`

const C = {
  ink: [15, 23, 42] as Rgb,
  muted: [71, 85, 105] as Rgb,
  soft: [148, 163, 184] as Rgb,
  line: [226, 232, 240] as Rgb,
  brand: [235, 103, 27] as Rgb,
  blue: [37, 99, 235] as Rgb,
  green: [22, 163, 74] as Rgb,
  teal: [13, 148, 136] as Rgb,
  violet: [124, 58, 237] as Rgb,
  rose: [225, 29, 72] as Rgb,
  amber: [217, 119, 6] as Rgb,
  slateBg: [248, 250, 252] as Rgb,
  zebra: [244, 247, 251] as Rgb,
  headSoft: [236, 241, 247] as Rgb,
  white: [255, 255, 255] as Rgb,
  onDark: [203, 213, 225] as Rgb,
  greenBg: [236, 253, 245] as Rgb,
  greenLine: [167, 243, 208] as Rgb,
  orangeBg: [255, 247, 237] as Rgb,
  orangeLine: [253, 186, 116] as Rgb,
  roseBg: [255, 241, 242] as Rgb,
  roseLine: [254, 205, 211] as Rgb,
  amberBg: [255, 251, 235] as Rgb,
  amberLine: [253, 230, 138] as Rgb,
  violetBg: [245, 243, 255] as Rgb,
  violetLine: [221, 214, 254] as Rgb,
  blueBg: [239, 246, 255] as Rgb,
  blueLine: [191, 219, 254] as Rgb
}

type Celda = string | { t: string; sub?: string; subColor?: Rgb; color?: Rgb; bold?: boolean }
type Columna = { h: string; w: number; align?: 'left' | 'right' | 'center' }
type OpcionesTabla = {
  cols: Columna[]
  filas: Celda[][]
  total?: Celda[]
  x?: number
  w?: number
  /** Encabezado oscuro (resúmenes) en lugar del gris suave (detalle). */
  oscura?: boolean
  fs?: number
  /** false: el llamador ya reservó el alto y la tabla no salta de página. */
  paginar?: boolean
  /** Espacio que queda debajo de la tabla. */
  gap?: number
}
type Tarjeta = { label: string; value: string; sub?: string; color: Rgb }

export async function exportarLiquidacionMensualPdf(opts: {
  filas: LiquidacionEmpleado[]
  fechaDesde: string
  fechaHasta: string
  periodoLabel: string
}): Promise<void> {
  const { filas, fechaDesde, fechaHasta, periodoLabel } = opts
  const logo = await cargarLogoPlotLabDataUrl()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const tot = totalesLiquidacion(filas)
  const pageW = 210
  const margen = 14
  const ancho = pageW - margen * 2
  const limite = 284
  const topInterno = 22
  const periodo = periodoLabel.charAt(0).toUpperCase() + periodoLabel.slice(1)
  const mismoMes = fechaDesde.slice(0, 7) === fechaHasta.slice(0, 7)
  const rangoTxt = `del ${fechaCorta(fechaDesde)} al ${fechaCorta(fechaHasta)}`
  const emitido = new Date().toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  let y = 0
  let etiquetaActual = 'Resumen general'
  const etiquetas = new Map<number, string>()

  const rgb = (c: Rgb) => doc.setTextColor(c[0], c[1], c[2])
  const fill = (c: Rgb) => doc.setFillColor(c[0], c[1], c[2])
  const stroke = (c: Rgb) => doc.setDrawColor(c[0], c[1], c[2])

  const texto = (
    t: string,
    x: number,
    yy: number,
    o: { size: number; color: Rgb; bold?: boolean; italic?: boolean; align?: 'left' | 'right' | 'center' }
  ) => {
    doc.setFont('helvetica', o.bold ? 'bold' : o.italic ? 'italic' : 'normal')
    doc.setFontSize(o.size)
    rgb(o.color)
    doc.text(t, x, yy, o.align ? { align: o.align } : undefined)
  }

  const recortar = (t: string, maxW: number): string => {
    if (doc.getTextWidth(t) <= maxW) return t
    let r = t
    while (r.length > 1 && doc.getTextWidth(`${r}…`) > maxW) r = r.slice(0, -1)
    return `${r}…`
  }

  const nuevaPagina = (etiqueta = etiquetaActual) => {
    doc.addPage()
    etiquetaActual = etiqueta
    etiquetas.set(doc.getNumberOfPages(), etiqueta)
    y = topInterno
  }

  const ensure = (alto: number) => {
    if (y + alto > limite) nuevaPagina()
  }

  const dibujarLogo = (x: number, yy: number, alto: number): number => {
    if (!logo?.dataUrl) {
      const size = alto > 15 ? 18 : 10
      texto('PLOT LAB', x, yy + alto * 0.7, { size, bold: true, color: C.white })
      return doc.getTextWidth('PLOT LAB')
    }
    const w = alto * (logo.aspect || 347 / 203)
    doc.addImage(logo.dataUrl, 'PNG', x, yy, w, alto, 'plot-lab-logo')
    return w
  }

  const encabezadoPortada = () => {
    fill(C.ink)
    doc.rect(0, 0, pageW, 42, 'F')
    fill(C.brand)
    doc.rect(0, 42, pageW, 2.2, 'F')
    const lw = dibujarLogo(margen, 8, 26)
    const tx = margen + lw + 8
    texto('PLOT LAB · RECURSOS HUMANOS', tx, 15, { size: 7.5, bold: true, color: C.brand })
    texto('Liquidación mensual', tx, 25.5, { size: 21, bold: true, color: C.white })
    texto(mismoMes ? `${periodo} · ${rangoTxt}` : `Período ${rangoTxt}`, tx, 33.5, { size: 9.5, color: C.onDark })
    texto('EMITIDO', pageW - margen, 15, { size: 7, bold: true, color: C.soft, align: 'right' })
    texto(emitido, pageW - margen, 20.5, { size: 9, color: C.white, align: 'right' })
    y = 52
  }

  const encabezadoInterno = (p: number) => {
    fill(C.ink)
    doc.rect(0, 0, pageW, 14, 'F')
    fill(C.brand)
    doc.rect(0, 14, pageW, 1.2, 'F')
    const lw = dibujarLogo(margen, 2.2, 9.6)
    texto('Liquidación mensual', margen + lw + 5, 7, { size: 9, bold: true, color: C.white })
    texto(periodo, margen + lw + 5, 11.2, { size: 7.5, color: C.onDark })
    texto(etiquetas.get(p) ?? '', pageW - margen, 9, { size: 10, bold: true, color: C.white, align: 'right' })
  }

  const seccion = (titulo: string, color: Rgb, reservar = 28) => {
    ensure(reservar)
    y += 3
    fill(color)
    doc.roundedRect(margen, y - 4.2, 2, 6.4, 0.6, 0.6, 'F')
    texto(titulo, margen + 5, y, { size: 11, bold: true, color: C.ink })
    y += 4.5
  }

  const tarjetas = (items: Tarjeta[], alto: number, sizeValor: number) => {
    ensure(alto + 5)
    const gap = 3.5
    const w = (ancho - gap * (items.length - 1)) / items.length
    items.forEach((item, i) => {
      const x = margen + i * (w + gap)
      fill(C.slateBg)
      stroke(C.line)
      doc.setLineWidth(0.3)
      doc.roundedRect(x, y, w, alto, 2, 2, 'FD')
      fill(item.color)
      doc.roundedRect(x, y, w, 2.2, 1.5, 1.5, 'F')
      doc.rect(x, y + 1.1, w, 1.1, 'F')
      texto(item.label.toUpperCase(), x + 3.5, y + 8, { size: 7, bold: true, color: C.soft })
      let size = sizeValor
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(size)
      while (size > 7 && doc.getTextWidth(item.value) > w - 7) {
        size -= 0.5
        doc.setFontSize(size)
      }
      texto(item.value, x + 3.5, y + 15, { size, bold: true, color: C.ink })
      if (item.sub) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        texto(recortar(item.sub, w - 7), x + 3.5, y + alto - 3.5, { size: 7, color: C.muted })
      }
    })
    y += alto + 5
  }

  const padX = 2.2
  const padY = 1.4
  const altoHead = 6.2

  const prepararTabla = (o: OpcionesTabla) => {
    const wTotal = o.w ?? ancho
    const k = wTotal / o.cols.reduce((a, c) => a + c.w, 0)
    const ws = o.cols.map((c) => c.w * k)
    const fs = o.fs ?? 7.8
    const emMm = fs * 0.3528
    const lineH = emMm * 1.25
    const subFs = fs - 1.5
    const subH = subFs * 0.3528 * 1.25
    const todas = o.total ? [...o.filas, o.total] : o.filas
    const grilla = todas.map((fila, idx) => {
      const esTotal = o.total != null && idx === todas.length - 1
      const cs = fila.map((raw, i) => {
        const c = typeof raw === 'string' ? { t: raw } : raw
        doc.setFont('helvetica', c.bold || esTotal ? 'bold' : 'normal')
        doc.setFontSize(fs)
        const lineas = doc.splitTextToSize(c.t, ws[i] - padX * 2) as string[]
        let sub: string[] = []
        if (c.sub) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(subFs)
          sub = doc.splitTextToSize(c.sub, ws[i] - padX * 2) as string[]
        }
        return { c, lineas, sub, bloque: lineas.length * lineH + sub.length * subH }
      })
      const h = Math.max(5.6, padY * 2 + Math.max(...cs.map((x) => x.bloque)))
      return { cs, h, esTotal }
    })
    return { ws, wTotal, fs, emMm, lineH, subFs, subH, grilla, altoTotal: altoHead + grilla.reduce((a, f) => a + f.h, 0) }
  }

  const tabla = (o: OpcionesTabla) => {
    const x0 = o.x ?? margen
    const p = prepararTabla(o)
    const paginar = o.paginar ?? true

    const dibujarHead = () => {
      fill(o.oscura ? C.ink : C.headSoft)
      doc.rect(x0, y, p.wTotal, altoHead, 'F')
      let cx = x0
      o.cols.forEach((col, i) => {
        const tx = col.align === 'right' ? cx + p.ws[i] - padX : col.align === 'center' ? cx + p.ws[i] / 2 : cx + padX
        texto(col.h.toUpperCase(), tx, y + 4.2, {
          size: 6.8,
          bold: true,
          color: o.oscura ? C.white : C.muted,
          align: col.align
        })
        cx += p.ws[i]
      })
      y += altoHead
    }

    if (paginar) ensure(altoHead + (p.grilla[0]?.h ?? 0))
    dibujarHead()
    p.grilla.forEach((fila, idx) => {
      if (paginar && y + fila.h > limite) {
        nuevaPagina()
        dibujarHead()
      }
      if (fila.esTotal) {
        fill(C.headSoft)
        doc.rect(x0, y, p.wTotal, fila.h, 'F')
        stroke(C.ink)
        doc.setLineWidth(0.35)
        doc.line(x0, y, x0 + p.wTotal, y)
      } else if (idx % 2 === 1) {
        fill(C.zebra)
        doc.rect(x0, y, p.wTotal, fila.h, 'F')
      }
      let cx = x0
      fila.cs.forEach((cc, i) => {
        const align = o.cols[i]?.align
        const tx = align === 'right' ? cx + p.ws[i] - padX : align === 'center' ? cx + p.ws[i] / 2 : cx + padX
        let by = y + (fila.h - cc.bloque) / 2 + (p.lineH - p.emMm) / 2 + p.emMm * 0.8
        for (const ln of cc.lineas) {
          texto(ln, tx, by, { size: p.fs, bold: Boolean(cc.c.bold) || fila.esTotal, color: cc.c.color ?? C.ink, align })
          by += p.lineH
        }
        for (const ln of cc.sub) {
          texto(ln, tx, by, { size: p.subFs, color: cc.c.subColor ?? C.soft, align })
          by += p.subH
        }
        cx += p.ws[i]
      })
      stroke(C.line)
      doc.setLineWidth(0.15)
      doc.line(x0, y + fila.h, x0 + p.wTotal, y + fila.h)
      y += fila.h
    })
    y += o.gap ?? 5
  }

  /**
   * Dos columnas de tablas apiladas bajo un título. Reserva el alto de la más alta (con el título)
   * para que el bloque no se parta entre hojas, y dibuja ambas columnas desde el mismo punto.
   */
  const bloque = (titulo: string, color: Rgb, izq: OpcionesTabla[], der: OpcionesTabla[]) => {
    const sep = 6
    const sepV = 4
    const wCol = (ancho - sep) / 2
    const armar = (col: OpcionesTabla[], x: number): OpcionesTabla[] =>
      col.map((t) => ({ ...t, x, w: wCol, paginar: false, gap: 0 }))
    const a = armar(izq, margen)
    const b = armar(der, margen + wCol + sep)
    const alto = (col: OpcionesTabla[]) =>
      col.reduce((s, t) => s + prepararTabla(t).altoTotal, 0) + sepV * (col.length - 1)
    ensure(Math.max(alto(a), alto(b)) + 8)
    seccion(titulo, color, 0)
    const y0 = y
    const dibujar = (col: OpcionesTabla[]): number => {
      y = y0
      col.forEach((t, i) => {
        if (i > 0) y += sepV
        tabla(t)
      })
      return y
    }
    const yA = dibujar(a)
    const yB = dibujar(b)
    y = Math.max(yA, yB) + 5
  }

  const vacio = (mensaje: string) => {
    ensure(14)
    fill(C.slateBg)
    stroke(C.line)
    doc.setLineWidth(0.2)
    doc.roundedRect(margen, y, ancho, 9, 1.5, 1.5, 'FD')
    texto(mensaje, margen + 4, y + 5.8, { size: 8.5, italic: true, color: C.soft })
    y += 14
  }

  const pastilla = (x: number, yy: number, t: string, fg: Rgb, bg: Rgb, borde: Rgb): number => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    const w = doc.getTextWidth(t) + 5
    fill(bg)
    stroke(borde)
    doc.setLineWidth(0.25)
    doc.roundedRect(x, yy, w, 5, 2.5, 2.5, 'FD')
    texto(t, x + 2.5, yy + 3.5, { size: 7, bold: true, color: fg })
    return w
  }

  type Ranking = { titulo: string; data: Array<{ nombre: string; valor: number }>; color: Rgb }

  /** Dibuja un ranking de barras en una columna desde el y actual y devuelve dónde termina, sin mover y. */
  const rankingColumna = (x: number, w: number, r: Ranking): number => {
    const top = [...r.data].sort((a, b) => b.valor - a.valor).filter((d) => d.valor > 0).slice(0, 5)
    let yy = y + 3
    fill(r.color)
    doc.roundedRect(x, yy - 4.2, 2, 6.4, 0.6, 0.6, 'F')
    texto(r.titulo, x + 5, yy, { size: 11, bold: true, color: C.ink })
    yy += 6
    if (!top.length) {
      texto('Sin datos en el período', x, yy + 3.5, { size: 8, italic: true, color: C.soft })
      return yy + 8
    }
    const max = Math.max(...top.map((d) => d.valor), 1)
    const nombreW = 34
    const montoW = 24
    const barX = x + nombreW + 2
    const barMaxW = w - nombreW - montoW - 4
    for (const d of top) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      texto(recortar(d.nombre, nombreW), x, yy + 3.8, { size: 8, color: C.ink })
      fill(C.zebra)
      doc.roundedRect(barX, yy, barMaxW, 5.5, 1.2, 1.2, 'F')
      fill(r.color)
      doc.roundedRect(barX, yy, Math.max(3, (d.valor / max) * barMaxW), 5.5, 1.2, 1.2, 'F')
      texto(ars(d.valor), x + w, yy + 3.9, { size: 7.5, bold: true, color: C.muted, align: 'right' })
      yy += 8
    }
    return yy
  }

  const rankings = (izq: Ranking, der: Ranking) => {
    ensure(56)
    const sep = 6
    const w = (ancho - sep) / 2
    const yA = rankingColumna(margen, w, izq)
    const yB = rankingColumna(margen + w + sep, w, der)
    y = Math.max(yA, yB) + 4
  }

  const cuenta = (n: number, color: Rgb): Celda => (n > 0 ? { t: String(n), color, bold: true } : { t: '0', color: C.soft })
  const horas = (n: number, color: Rgb): Celda => (n > 0 ? { t: n.toFixed(1), color, bold: true } : { t: '—', color: C.soft })
  const importe = (n: number, color: Rgb = C.ink): Celda => (n > 0 ? { t: ars(n), color } : { t: ars(0), color: C.soft })

  /* ───────────── Portada y resumen general ───────────── */

  encabezadoPortada()

  const minutosTarde = filas.reduce((a, f) => a + f.minutosTarde, 0)
  tarjetas(
    [
      { label: 'Empleados', value: String(tot.empleados), sub: 'En el período', color: C.blue },
      { label: 'Haberes', value: ars(tot.haberes), sub: 'Antes de descuentos', color: C.teal },
      { label: 'Neto a pagar', value: ars(tot.neto), sub: 'Después de aportes', color: C.green },
      { label: 'Costo empresa', value: ars(tot.costoEmpresa), sub: 'Incluye contribuciones', color: C.brand }
    ],
    24,
    13
  )
  tarjetas(
    [
      {
        label: 'Puntualidad',
        value: tot.puntualidadPromedio ? `${tot.puntualidadPromedio}%` : '—',
        sub: `${tot.diasConEntrada} / ${tot.diasExigibles} c/ marca`,
        color: C.blue
      },
      { label: 'Tardanzas', value: String(tot.tardanzas), sub: `${minutosTarde} min en total`, color: C.amber },
      { label: 'Ausencias', value: String(tot.ausencias), sub: `${tot.justificados} justificados`, color: C.rose },
      { label: 'Sin marca', value: String(tot.sinMarca), sub: `${tot.faltas} faltas liq.`, color: C.violet },
      {
        label: 'Horas / Extra',
        value: `${tot.totalHoras.toFixed(1)} hs`,
        sub: `Extra ${tot.totalHorasExtra.toFixed(1)} · HE ${tot.extra50.toFixed(1)}/${tot.extra100.toFixed(1)}`,
        color: C.teal
      }
    ],
    22,
    12
  )

  seccion('Asistencia por empleado', C.blue, 40)
  tabla({
    oscura: true,
    fs: 6.8,
    cols: [
      { h: 'Empleado', w: 34 },
      { h: 'Marca/exig.', w: 18, align: 'center' },
      { h: 'Punt.%', w: 14, align: 'center' },
      { h: 'Tarde', w: 12, align: 'center' },
      { h: 'Aus.', w: 12, align: 'center' },
      { h: 'Just.', w: 12, align: 'center' },
      { h: 'S/marca', w: 14, align: 'center' },
      { h: 'Horas', w: 14, align: 'center' },
      { h: 'Extra', w: 14, align: 'center' },
      { h: 'HE50', w: 13, align: 'center' },
      { h: 'HE100', w: 13, align: 'center' }
    ],
    filas: filas.map((f) => [
      { t: f.nombre, bold: true },
      f.diasConEntrada ? `${f.diasConEntrada}/${f.diasExigibles}` : '—',
      f.diasConEntrada
        ? {
            t: `${f.puntualidadPct}%`,
            color: f.puntualidadPct >= 90 ? C.green : f.puntualidadPct >= 70 ? C.amber : C.rose,
            bold: true
          }
        : '—',
      cuenta(f.tardanzas, C.amber),
      cuenta(f.ausencias, C.rose),
      cuenta(f.diasJustificados, C.violet),
      cuenta(f.sinMarca, C.muted),
      f.totalHoras ? f.totalHoras.toFixed(1) : '—',
      f.totalHorasExtra > 0 ? f.totalHorasExtra.toFixed(1) : '—',
      horas(f.extra50, C.teal),
      horas(f.extra100, C.blue)
    ]),
    total: [
      'Total',
      `${tot.diasConEntrada}/${tot.diasExigibles}`,
      tot.puntualidadPromedio ? `${tot.puntualidadPromedio}%` : '—',
      String(tot.tardanzas),
      String(tot.ausencias),
      String(tot.justificados),
      String(tot.sinMarca),
      tot.totalHoras.toFixed(1),
      tot.totalHorasExtra.toFixed(1),
      tot.extra50.toFixed(1),
      tot.extra100.toFixed(1)
    ]
  })

  seccion('Importes por empleado', C.green, 40)
  tabla({
    oscura: true,
    fs: 7.5,
    cols: [
      { h: 'Empleado', w: 44 },
      { h: 'Haberes', w: 28, align: 'right' },
      { h: 'Descuentos', w: 27, align: 'right' },
      { h: 'Aportes', w: 27, align: 'right' },
      { h: 'Neto a pagar', w: 28, align: 'right' },
      { h: 'Costo empresa', w: 28, align: 'right' }
    ],
    filas: filas.map((f) => [
      { t: f.nombre, bold: true },
      importe(f.haberes),
      importe(f.descuentoFaltas + f.descuentoTardanzas, C.rose),
      importe(f.totalAportes),
      importe(f.neto, C.green),
      importe(f.costoEmpresa, C.brand)
    ]),
    total: [
      'Total',
      ars(tot.haberes),
      ars(filas.reduce((a, f) => a + f.descuentoFaltas + f.descuentoTardanzas, 0)),
      ars(tot.aportes),
      ars(tot.neto),
      ars(tot.costoEmpresa)
    ]
  })

  rankings(
    { titulo: 'Top facturado', data: filas.map((f) => ({ nombre: f.nombre, valor: f.plataVendida })), color: C.brand },
    { titulo: 'Top neto a pagar', data: filas.map((f) => ({ nombre: f.nombre, valor: f.neto })), color: C.green }
  )

  const criterios = [
    'Los aportes y las contribuciones se calculan sobre el sueldo base.',
    'Un domingo o un feriado se paga al doble solo si el empleado vino; si no vino, no es falta.',
    'Las horas de domingo y feriado están incluidas en las horas extra al 100%.',
    'Cada falta se descuenta como remuneración / 30. El sábado libre y el día que no le toca no se descuentan.'
  ]
  const altoCriterios = 10 + criterios.length * 4.8
  ensure(altoCriterios + 4)
  fill(C.blueBg)
  stroke(C.blueLine)
  doc.setLineWidth(0.25)
  doc.roundedRect(margen, y, ancho, altoCriterios, 2, 2, 'FD')
  texto('CRITERIOS DE CÁLCULO', margen + 4, y + 6, { size: 7, bold: true, color: C.blue })
  criterios.forEach((c, i) => {
    texto(`·  ${c}`, margen + 4, y + 11.5 + i * 4.8, { size: 8, color: C.muted })
  })
  y += altoCriterios + 4

  /* ───────────── Una hoja por empleado ───────────── */

  const tarjetaEmpleado = (f: LiquidacionEmpleado) => {
    const alto = 30
    fill(C.slateBg)
    stroke(C.line)
    doc.setLineWidth(0.3)
    doc.roundedRect(margen, y, ancho, alto, 2.5, 2.5, 'FD')
    fill(C.brand)
    doc.roundedRect(margen, y, 3, alto, 1, 1, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    texto(recortar(f.nombre, 100), margen + 8, y + 10, { size: 15, bold: true, color: C.ink })
    const prop =
      f.factorProporcional < 1 && f.diasLaborablesPeriodo > 0
        ? ` · Prop. ${f.diasDebia}/${f.diasLaborablesPeriodo} días`
        : ''
    const antig = f.fechaIngreso
      ? `Ingreso ${fechaCorta(f.fechaIngreso)} · Antigüedad ${f.antiguedadLabel} · Legal ${f.pctAntiguedadLegal}%/año${prop}`
      : `Sin fecha de ingreso en el legajo${prop}`
    texto(antig, margen + 8, y + 16, { size: 8.5, color: C.muted })

    let px = margen + 8
    const py = y + 20.5
    if (f.faltas > 0) px += pastilla(px, py, plural(f.faltas, 'falta', 'faltas'), C.rose, C.roseBg, C.roseLine) + 2
    if (f.tardanzas > 0) px += pastilla(px, py, plural(f.tardanzas, 'tardanza', 'tardanzas'), C.amber, C.amberBg, C.amberLine) + 2
    if (f.permisos.length > 0) {
      px += pastilla(px, py, plural(f.permisos.length, 'permiso', 'permisos'), C.violet, C.violetBg, C.violetLine) + 2
    }
    if (px === margen + 8) pastilla(px, py, 'Sin incidencias', C.green, C.greenBg, C.greenLine)

    const pct = f.diasDebia > 0 ? Math.round((f.diasVino / f.diasDebia) * 100) : null
    const colorPct = pct == null ? C.soft : pct >= 90 ? C.green : pct >= 75 ? C.amber : C.rose
    const bx = margen + ancho - 64
    texto('ASISTENCIA', bx, y + 8, { size: 7, bold: true, color: C.soft })
    texto(pct == null ? '—' : `${pct}%`, bx + 56, y + 10, { size: 16, bold: true, color: colorPct, align: 'right' })
    fill(C.line)
    doc.roundedRect(bx, y + 14, 56, 3, 1.5, 1.5, 'F')
    if (pct != null && pct > 0) {
      fill(colorPct)
      doc.roundedRect(bx, y + 14, Math.max(3, (Math.min(pct, 100) / 100) * 56), 3, 1.5, 1.5, 'F')
    }
    texto(f.diasDebia > 0 ? `${f.diasVino} de ${f.diasDebia} días` : 'Sin días a cumplir', bx, y + 22, {
      size: 7.5,
      color: C.muted
    })
    y += alto + 5
  }

  const columnasLiquidacion =(f: LiquidacionEmpleado): [OpcionesTabla[], OpcionesTabla[]] => {
    const haberes: Celda[][] = [
      [
        {
          t: 'Sueldo base',
          sub:
            f.factorProporcional < 1
              ? `Proporcional ${f.diasDebia}/${f.diasLaborablesPeriodo} días`
              : undefined
        },
        importe(f.sueldoBase)
      ],
      ['Sueldo sin declarar', importe(f.sueldoSinDeclarar)],
      [
        {
          t: 'Antigüedad legal',
          sub: `${f.antiguedadAnios} años × ${f.pctAntiguedadLegal}%${
            f.factorProporcional < 1 ? ` · prop. ${Math.round(f.factorProporcional * 100)}%` : ''
          }`
        },
        importe(f.adicionalAntiguedad)
      ],
      [{ t: 'Horas extra 50%', sub: `${f.extra50.toFixed(1)} hs × ${ars(f.precioHora)} × 1,5` }, importe(f.importeExtra50)],
      [{ t: 'Horas extra 100%', sub: `${f.extra100.toFixed(1)} hs × ${ars(f.precioHora)} × 2` }, importe(f.importeExtra100)]
    ]
    if (f.domingosVino > 0) {
      haberes.push([
        { t: 'Incluye domingo al doble', sub: `${f.horasDomingo.toFixed(1)} hs`, color: C.muted },
        { t: ars(f.importeDomingo), color: C.muted }
      ])
    }
    if (f.feriadosVino > 0) {
      haberes.push([
        { t: 'Incluye feriado al doble', sub: `${f.horasFeriado.toFixed(1)} hs`, color: C.muted },
        { t: ars(f.importeFeriado), color: C.muted }
      ])
    }
    const colsImporte = (titulo: string): Columna[] => [
      { h: titulo, w: 62 },
      { h: 'Importe', w: 26, align: 'right' }
    ]
    const colsCarga = (titulo: string): Columna[] => [
      { h: titulo, w: 46 },
      { h: '%', w: 14, align: 'right' },
      { h: 'Importe', w: 28, align: 'right' }
    ]
    return [
      [
        {
          cols: colsImporte('Haberes'),
          filas: haberes,
          total: ['Total haberes', { t: ars(f.haberes), color: C.teal }]
        },
        {
          cols: colsImporte('Descuentos'),
          filas: [
            [{ t: 'Faltas', sub: `${plural(f.faltas, 'día', 'días')} · remuneración / 30` }, importe(f.descuentoFaltas, C.rose)],
            [{ t: 'Tardanzas', sub: `${f.minutosTarde} min` }, importe(f.descuentoTardanzas, C.rose)]
          ],
          total: ['Total descuentos', { t: ars(f.descuentoFaltas + f.descuentoTardanzas), color: C.rose }]
        }
      ],
      [
        {
          cols: colsCarga('Aportes del trabajador'),
          filas: f.aportes.map((c) => [c.nombre, `${c.porcentaje}%`, importe(c.importe)]),
          total: ['Total aportes', '', ars(f.totalAportes)]
        },
        {
          cols: colsCarga('Contribuciones patronales'),
          filas: f.contribuciones.map((c) => [c.nombre, `${c.porcentaje}%`, importe(c.importe)]),
          total: ['Total contribuciones', '', ars(f.totalContribuciones)]
        }
      ]
    ]
  }

  const columnasAsistencia = (f: LiquidacionEmpleado): [OpcionesTabla[], OpcionesTabla[]] => {
    const dobles = (n: number, hs: number, monto: number): string =>
      n > 0 ? `${hs.toFixed(1)} hs al doble · ${ars(monto)}` : 'No vino · no es falta'
    return [
      [
        {
          cols: [
            { h: 'Asistencia', w: 46 },
            { h: 'Corresponde', w: 21, align: 'center' },
            { h: 'Vino', w: 21, align: 'center' }
          ],
          filas: [
            [
              {
                t: 'Días laborables',
                bold: true,
                sub: f.faltas > 0 ? `${plural(f.faltas, 'falta', 'faltas')} sin justificar` : 'Sin faltas',
                subColor: f.faltas > 0 ? C.rose : C.soft
              },
              String(f.diasDebia),
              String(f.diasVino)
            ],
            [
              { t: 'Domingos', bold: true, sub: dobles(f.domingosVino, f.horasDomingo, f.importeDomingo) },
              String(f.domingos),
              String(f.domingosVino)
            ],
            [
              { t: 'Feriados', bold: true, sub: dobles(f.feriadosVino, f.horasFeriado, f.importeFeriado) },
              String(f.feriados),
              String(f.feriadosVino)
            ],
            [
              { t: 'Días que no trabaja', bold: true, sub: f.noTrabajaVino > 0 ? 'Vino un día libre' : 'No se descuenta' },
              String(f.diasNoTrabaja),
              String(f.noTrabajaVino)
            ]
          ]
        }
      ],
      [
        {
          cols: [
            { h: 'Actividad en el sistema', w: 58 },
            { h: 'Valor', w: 30, align: 'right' }
          ],
          filas: [
            ['Ventas', { t: String(f.ventas), bold: true }],
            ['Facturado', { t: ars(f.plataVendida), bold: true, color: C.brand }],
            ['OPs que movió', { t: String(f.opsMovidas), bold: true }],
            ['Trabajos en el tablero', { t: String(f.trabajos), bold: true }]
          ]
        }
      ]
    ]
  }

  for (const f of filas) {
    nuevaPagina(f.nombre)
    tarjetaEmpleado(f)
    tarjetas(
      [
        { label: 'Neto a pagar', value: ars(f.neto), sub: 'Haberes - descuentos - aportes', color: C.green },
        { label: 'Costo empresa', value: ars(f.costoEmpresa), sub: 'Con contribuciones patronales', color: C.brand },
        { label: 'Días trabajados', value: `${f.diasVino} / ${f.diasDebia}`, sub: 'Vino / debía venir', color: C.blue },
        {
          label: 'Horas extra',
          value: `${(f.extra50 + f.extra100).toFixed(1)} hs`,
          sub: `${f.extra50.toFixed(1)} al 50% · ${f.extra100.toFixed(1)} al 100%`,
          color: C.teal
        }
      ],
      23,
      12
    )

    const [liqIzq, liqDer] = columnasLiquidacion(f)
    bloque('Liquidación', C.teal, liqIzq, liqDer)
    const [asiIzq, asiDer] = columnasAsistencia(f)
    bloque('Asistencia y actividad', C.blue, asiIzq, asiDer)

    seccion(`Novedades (${f.novedades.length})`, C.amber, 30)
    if (!f.novedades.length) {
      vacio('Sin novedades en el período.')
    } else {
      tabla({
        fs: 7.5,
        cols: [
          { h: 'Fecha', w: 26 },
          { h: 'Grupo', w: 40 },
          { h: 'Novedad', w: 30 },
          { h: 'Detalle', w: 86 }
        ],
        filas: f.novedades.map((n) => {
          const etiqueta = n.etiqueta.toLowerCase()
          const color = etiqueta.includes('falta') ? C.rose : etiqueta.includes('tardanza') ? C.amber : C.ink
          return [
            n.desde === n.hasta ? fechaCorta(n.desde) : { t: fechaCorta(n.desde), sub: `al ${fechaCorta(n.hasta)}` },
            n.grupo,
            { t: n.etiqueta, color, bold: true },
            n.detalle || '—'
          ]
        })
      })
    }

    if (f.fechasFaltas.length) {
      const porFalta = f.descuentoFaltas / f.fechasFaltas.length
      seccion(`Faltas (${f.fechasFaltas.length})`, C.rose, 30)
      tabla({
        fs: 7.5,
        cols: [
          { h: 'Fecha', w: 30 },
          { h: 'Día', w: 40 },
          { h: 'Detalle', w: 62 },
          { h: 'Descuento', w: 50, align: 'right' }
        ],
        filas: f.fechasFaltas.map((fecha) => [
          fechaCorta(fecha),
          diaSemana(fecha),
          'No asistió',
          importe(porFalta, C.rose)
        ]),
        total: ['Total faltas', '', '', ars(f.descuentoFaltas)]
      })
    }

    if (f.permisos.length) {
      seccion(`Permisos aprobados (${f.permisos.length})`, C.violet, 30)
      tabla({
        fs: 7.5,
        cols: [
          { h: 'Desde', w: 24 },
          { h: 'Hasta', w: 24 },
          { h: 'Tipo', w: 24 },
          { h: 'Detalle', w: 86 },
          { h: 'Días', w: 24, align: 'center' }
        ],
        filas: f.permisos.map((p) => [
          fechaCorta(p.desde),
          fechaCorta(p.hasta),
          p.tipo.charAt(0).toUpperCase() + p.tipo.slice(1),
          [p.titulo, p.detalle].filter(Boolean).join(' · '),
          p.dias != null ? String(p.dias) : '—'
        ])
      })
    }
  }

  /* ───────────── Encabezados y pie en todas las hojas ───────────── */

  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    if (p > 1) encabezadoInterno(p)
    stroke(C.line)
    doc.setLineWidth(0.2)
    doc.line(margen, 288, pageW - margen, 288)
    texto(`Plot Lab · Liquidación ${periodo}`, margen, 292.5, { size: 7.5, color: C.soft })
    texto('Documento interno · confidencial', pageW / 2, 292.5, { size: 7.5, color: C.soft, align: 'center' })
    texto(`Página ${p} de ${pages}`, pageW - margen, 292.5, { size: 7.5, color: C.soft, align: 'right' })
  }

  doc.save(`liquidacion-${fechaDesde}_${fechaHasta}.pdf`)
}
