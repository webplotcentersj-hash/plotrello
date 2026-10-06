/**
 * Reglas de clasificación para KPIs. Sin red ni base: se puede testear aislado.
 * La IA solo elige una categoría de una lista cerrada; nunca calcula montos.
 */

export type TipoClasificacion = 'rubro_venta_item' | 'motivo_falla_entrega'

export const TIPOS_CLASIFICACION: TipoClasificacion[] = ['rubro_venta_item', 'motivo_falla_entrega']

/** Por debajo de esto la categoría queda como "Sin clasificar (revisar)" en los KPIs. */
export const CONFIANZA_MINIMA = 0.6

export const CATEGORIA_OTRO = 'Otro'
export const CATEGORIA_SIN_COMENTARIO = 'Sin comentario'

/** Motivos de insatisfacción: clave para TypeSafe → etiqueta que se guarda y se muestra. */
export const MOTIVOS_FALLA: Record<string, { label: string; descripcion: string }> = {
  demora: { label: 'Demora en la entrega', descripcion: 'El trabajo se entregó tarde o después de lo prometido' },
  calidad_impresion: {
    label: 'Calidad de impresión / terminación',
    descripcion: 'Colores, resolución, cortes, terminaciones o materiales con defectos'
  },
  error_diseno: {
    label: 'Error de diseño o de pedido',
    descripcion: 'Texto, medidas, archivo o diseño distinto a lo que pidió el cliente'
  },
  atencion: { label: 'Atención / comunicación', descripcion: 'Trato del personal, falta de aviso o información confusa' },
  precio: { label: 'Precio / cobro', descripcion: 'Disconformidad con el precio, el presupuesto o el cobro' },
  instalacion: { label: 'Instalación / colocación', descripcion: 'Problemas al colocar o instalar el trabajo' },
  otro: { label: CATEGORIA_OTRO, descripcion: 'Otro motivo, o el comentario no explica la falla' }
}

/** Solo si el catálogo no tiene rubros cargados (importación de Flexxus pendiente). */
export const RUBROS_POR_DEFECTO: Record<string, string> = {
  'Gigantografía / lona': 'Impresión gran formato en lona, banner, frontlight, backlight',
  'Vinilo / ploteo': 'Vinilo impreso o de corte, ploteo, microperforado, vehículos',
  Cartelería: 'Carteles, letras corpóreas, estructuras, cajas de luz, señalética',
  'Imprenta / papelería': 'Tarjetas, folletos, talonarios, papelería comercial',
  'Textil / merchandising': 'Remeras, sublimación, bordado, artículos promocionales',
  Diseño: 'Servicio de diseño gráfico, armado de archivos',
  'Instalación / colocación': 'Servicio de colocación o instalación en obra',
  [CATEGORIA_OTRO]: 'Otro producto o servicio'
}

export type RubroCatalogo = { categoria: string; ejemplos?: string[] | null }

/**
 * Opciones de rubro: los mismos rubros del catálogo (Flexxus), con productos de ejemplo
 * para orientar a la IA. Así lo clasificado por IA y por código de artículo cae en las mismas categorías.
 */
export function construirOpcionesRubro(catalogo: RubroCatalogo[]): Record<string, string | null> {
  const rubros = catalogo.filter((r) => r.categoria && r.categoria.trim())
  if (rubros.length < 2) return { ...RUBROS_POR_DEFECTO }

  const opciones: Record<string, string | null> = {}
  for (const r of rubros.slice(0, 250)) {
    const ejemplos = (r.ejemplos || []).filter(Boolean).slice(0, 3)
    opciones[r.categoria.trim()] = ejemplos.length ? `Ej.: ${ejemplos.join(', ').slice(0, 160)}` : null
  }
  if (!(CATEGORIA_OTRO in opciones)) opciones[CATEGORIA_OTRO] = 'No corresponde a ningún rubro anterior'
  return opciones
}

export function opcionesMotivoFalla(): Record<string, string | null> {
  return Object.fromEntries(Object.entries(MOTIVOS_FALLA).map(([clave, m]) => [clave, m.descripcion]))
}

export type Pendiente = {
  entidad_id: number
  texto: string | null
  codigo: string | null
  rating: number | null
  contexto: string | null
  rubro_catalogo: string | null
}

export type Clasificacion = {
  entidad_id: number
  categoria: string
  confianza: number | null
  fuente: 'catalogo' | 'regla' | 'ia'
  revisar: boolean
}

/** Casos que se resuelven sin IA. Devuelve null si hace falta preguntarle a TypeSafe. */
export function clasificarPorRegla(tipo: TipoClasificacion, p: Pendiente): Clasificacion | null {
  const texto = (p.texto || '').trim()
  if (tipo === 'rubro_venta_item') {
    if (p.rubro_catalogo && p.rubro_catalogo.trim()) {
      return { entidad_id: p.entidad_id, categoria: p.rubro_catalogo.trim(), confianza: 1, fuente: 'catalogo', revisar: false }
    }
    if (!texto) return { entidad_id: p.entidad_id, categoria: CATEGORIA_OTRO, confianza: null, fuente: 'regla', revisar: true }
    return null
  }
  if (!texto) {
    return { entidad_id: p.entidad_id, categoria: CATEGORIA_SIN_COMENTARIO, confianza: 1, fuente: 'regla', revisar: false }
  }
  return null
}

/**
 * Lo que viaja a TypeSafe: solo el texto necesario para clasificar.
 * Nunca nombre del cliente, CUIT, teléfono ni montos.
 */
export function estadoParaIA(tipo: TipoClasificacion, p: Pendiente): Record<string, string> {
  if (tipo === 'rubro_venta_item') {
    const estado: Record<string, string> = { descripcion_item: (p.texto || '').trim().slice(0, 300) }
    if (p.codigo) estado.codigo_articulo = p.codigo.slice(0, 50)
    return estado
  }
  const estado: Record<string, string> = {
    calificacion: `${p.rating ?? '?'} de 5`,
    comentario_cliente: (p.texto || '').trim().slice(0, 500)
  }
  if (p.contexto) estado.trabajo_realizado = p.contexto.slice(0, 300)
  return estado
}

export function instruccionesPara(tipo: TipoClasificacion): string {
  return tipo === 'rubro_venta_item'
    ? 'Rubro al que corresponde este ítem vendido por una imprenta / empresa de producción gráfica.'
    : 'Motivo principal por el que el cliente quedó insatisfecho con la entrega de su trabajo.'
}

/** Interpreta la respuesta: fuera de la lista o con confianza baja → queda para revisar. */
export function interpretarRespuesta(
  tipo: TipoClasificacion,
  entidadId: number,
  opciones: Record<string, string | null>,
  respuesta: { choice?: string; confidence?: number } | undefined
): Clasificacion {
  const choice = String(respuesta?.choice || '')
  const confianza = Number.isFinite(Number(respuesta?.confidence)) ? Number(respuesta?.confidence) : 0
  const valida = choice in opciones
  const categoria = !valida
    ? CATEGORIA_OTRO
    : tipo === 'motivo_falla_entrega'
      ? MOTIVOS_FALLA[choice]?.label || CATEGORIA_OTRO
      : choice
  return {
    entidad_id: entidadId,
    categoria,
    confianza: Math.round(confianza * 10000) / 10000,
    fuente: 'ia',
    revisar: !valida || confianza < CONFIANZA_MINIMA
  }
}
