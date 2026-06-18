export type ErpVencimientoEstado = 'al_dia' | 'proximo' | 'vencido' | 'sin_fecha'

export function diasHastaVencimiento(fechaVencimiento: string | null | undefined): number | null {
  if (!fechaVencimiento) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const venc = new Date(`${fechaVencimiento.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(venc.getTime())) return null
  return Math.floor((venc.getTime() - hoy.getTime()) / 86400000)
}

export function estadoVencimientoErp(
  fechaVencimiento: string | null | undefined,
  diasAviso = 7
): ErpVencimientoEstado {
  const dias = diasHastaVencimiento(fechaVencimiento)
  if (dias === null) return 'sin_fecha'
  if (dias < 0) return 'vencido'
  if (dias <= diasAviso) return 'proximo'
  return 'al_dia'
}

export function labelVencimientoErp(fechaVencimiento: string | null | undefined, diasAviso = 7): string {
  const dias = diasHastaVencimiento(fechaVencimiento)
  if (dias === null) return 'Sin vencimiento'
  if (dias < 0) return `Vencida hace ${Math.abs(dias)} d`
  if (dias === 0) return 'Vence hoy'
  if (dias <= diasAviso) return `Vence en ${dias} d`
  return 'Al día'
}
