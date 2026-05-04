import jsPDF from 'jspdf'
import type { RegistroSalidaVehiculo } from '../types/api'

function fmt(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('es-AR')
  } catch {
    return String(iso)
  }
}

function yn(v: boolean | null | undefined): string {
  if (v === true) return 'Sí'
  if (v === false) return 'No'
  return '—'
}

function splitLines(doc: jsPDF, text: string, maxW: number): string[] {
  return doc.splitTextToSize(text || '—', maxW)
}

/** Descarga PDF con el detalle completo del registro de salida / viaje finalizado. */
export function exportFlotaRegistroSalidaPdf(r: RegistroSalidaVehiculo): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 16
  const maxW = pageW - margin * 2
  let y = margin

  const addLine = (size: number, style: 'normal' | 'bold', line: string) => {
    doc.setFontSize(size)
    doc.setFont('helvetica', style)
    const lines = doc.splitTextToSize(line, maxW)
    const h = (size * 0.4) * lines.length
    if (y + h > doc.internal.pageSize.getHeight() - 14) {
      doc.addPage()
      y = margin
    }
    doc.text(lines, margin, y)
    y += h + 1.5
  }

  const addBlock = (label: string, value: string) => {
    addLine(9, 'bold', label)
    const body = value || '—'
    const parts = splitLines(doc, body, maxW)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    for (const p of parts) {
      if (y + 5 > doc.internal.pageSize.getHeight() - 14) {
        doc.addPage()
        y = margin
      }
      doc.text(p, margin, y)
      y += 4.2
    }
    y += 2
  }

  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.text('Plotrello — Detalle de viaje (flota)', margin, y)
  y += 8
  addLine(9, 'normal', `Generado: ${new Date().toLocaleString('es-AR')}`)
  y += 2

  const v = r.vehiculo
  const acomp = r.acompanantes
  const acompTxt =
    Array.isArray(acomp) && acomp.length > 0
      ? acomp.map((a) => `${a.nombre} (id ${a.id_usuario})`).join(', ')
      : '—'

  const bloques: [string, string][] = [
    ['ID registro', String(r.id)],
    ['Estado', r.estado],
    ['Vehículo (nombre)', v?.nombre ?? '—'],
    ['Vehículo (ID)', String(r.id_vehiculo)],
    ['Patente', v?.patente != null && v.patente !== '' ? v.patente : '—'],
    ['Vehículo activo (catálogo)', v ? (v.activo ? 'Sí' : 'No') : '—'],
    ['Estado en parque', v?.estado_parque != null ? String(v.estado_parque) : '—'],
    ['Detalle parque', v?.estado_parque_detalle?.trim() || '—'],
    ['Conductor (nombre)', r.nombre_usuario],
    ['Conductor (id usuario)', r.id_usuario != null ? String(r.id_usuario) : '—'],
    ['Sector', r.sector],
    ['Km odómetro al salir', r.km_aproximado != null ? String(r.km_aproximado) : '—'],
    ['Nº OP / trabajo', r.numero_op?.trim() || '—'],
    ['Motivo de la salida', r.motivo_salida],
    ['Hora de salida', fmt(r.hora_salida)],
    ['Llegada estimada', fmt(r.hora_estimada_llegada)],
    ['Llegada real', fmt(r.hora_llegada_real)],
    ['Combustible restante al llegar (L)', r.litros_combustible_llegada != null ? String(r.litros_combustible_llegada) : '—'],
    ['Objetivo de la salida cumplido', yn(r.objetivo_cumplido)],
    ['Observaciones del conductor (llegada)', r.observaciones_llegada?.trim() || '—'],
    ['Destino (texto)', r.ubicacion_destino?.trim() || '—'],
    [
      'Coordenadas destino',
      r.latitud != null && r.longitud != null ? `${r.latitud}, ${r.longitud}` : '—'
    ],
    [
      'Enlace mapa',
      r.latitud != null && r.longitud != null
        ? `https://www.google.com/maps?q=${r.latitud},${r.longitud}`
        : '—'
    ],
    ['Acompañantes', acompTxt],
    ['Llave entregada al salir', r.llave_entregada ? 'Sí' : 'No'],
    ['Caja — usuario que entregó llave', r.nombre_usuario_caja_entrego_llave?.trim() || '—'],
    ['Caja — id usuario', r.id_usuario_caja_entrego_llave != null ? String(r.id_usuario_caja_entrego_llave) : '—'],
    ['Observaciones (cierre / administración)', r.observaciones?.trim() || '—'],
    ['Alta en sistema', fmt(r.created_at)],
    ['Última actualización', fmt(r.updated_at)]
  ]

  for (const [lab, val] of bloques) {
    addBlock(lab + ':', val)
  }

  const safeName = `flota-viaje-${r.id}-${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(safeName)
}
