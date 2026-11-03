const CLAVE = 'lector-afip:historial'
const MAXIMO = 30

export type Registro = { codigo: string; ts: number; valido: boolean }

export function cargarHistorial(): Registro[] {
  try {
    const lista: unknown = JSON.parse(localStorage.getItem(CLAVE) ?? '[]')
    if (!Array.isArray(lista)) return []
    return lista.filter(
      (r): r is Registro => typeof r?.codigo === 'string' && typeof r?.ts === 'number' && typeof r?.valido === 'boolean'
    )
  } catch {
    return []
  }
}

/** Agrega al principio (sin repetidos) y devuelve la lista resultante. */
export function guardarEnHistorial(codigo: string, valido: boolean): Registro[] {
  const lista = [{ codigo, ts: Date.now(), valido }, ...cargarHistorial().filter((r) => r.codigo !== codigo)].slice(
    0,
    MAXIMO
  )
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista))
  } catch {
    // sin almacenamiento (modo privado): el historial queda solo en memoria de esta sesión
  }
  return lista
}

export function borrarHistorial(): void {
  try {
    localStorage.removeItem(CLAVE)
  } catch {
    // nada que borrar
  }
}
