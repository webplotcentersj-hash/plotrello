import {
  buildMockupImagePrompt,
  resolveMockupProduct,
  resolveMockupScene,
  type MockupProductKind,
  type MockupSceneKind
} from './clientePedidoMockup'

export type BriefMockupState = {
  productKind: MockupProductKind
  sceneKind: MockupSceneKind
  productLabel: string
  empty: boolean
  progress: number
}

export function resolveBriefMockup(
  tipos: string[],
  tipoOtro: string,
  dondeColocados: string,
  digitalOImpresion: string,
  necesitaAsesoramiento: boolean
): BriefMockupState {
  const hasSelection = tipos.length > 0 || Boolean(tipoOtro.trim()) || necesitaAsesoramiento
  if (!hasSelection) {
    return {
      productKind: 'generic',
      sceneKind: 'interior',
      productLabel: 'Tu proyecto',
      empty: true,
      progress: 0
    }
  }

  const labelSource =
    tipos.find((t) => resolveMockupProduct(t) !== 'generic') ||
    tipos[0] ||
    tipoOtro.trim() ||
    (necesitaAsesoramiento ? 'Asesoramiento personalizado' : 'Proyecto gráfico')
  // Preferir el primer tipo concreto (Flyer, Carpetas…) sobre genéricos tipo “Diseño de una pieza…”
  let productKind = resolveMockupProduct(labelSource)
  for (const t of tipos) {
    const k = resolveMockupProduct(t)
    if (k !== 'generic') {
      productKind = k
      break
    }
  }
  const sceneKind = resolveMockupScene(dondeColocados, productKind, digitalOImpresion)

  return {
    productKind,
    sceneKind,
    productLabel: labelSource,
    empty: false,
    progress: calcBriefProgress(tipos, tipoOtro, dondeColocados, digitalOImpresion, necesitaAsesoramiento)
  }
}

export function calcBriefProgress(
  tipos: string[],
  tipoOtro: string,
  dondeColocados: string,
  digitalOImpresion: string,
  necesitaAsesoramiento: boolean,
  objetivo?: string,
  brief?: string,
  estilo?: string
): number {
  let score = 0
  const max = 7
  if (tipos.length > 0 || tipoOtro.trim() || necesitaAsesoramiento) score += 1
  if (dondeColocados.trim()) score += 1
  if (digitalOImpresion) score += 1
  if (objetivo?.trim()) score += 1
  if (brief?.trim()) score += 1
  if (estilo?.trim()) score += 1
  if (tipos.length >= 1 && dondeColocados.trim()) score += 1
  return Math.min(100, Math.round((score / max) * 100))
}

export function buildBriefMockupImagePrompt(input: {
  productLabel: string
  productKind: MockupProductKind
  sceneKind: MockupSceneKind
  tipos: string[]
  donde_colocados: string
  objetivo_proyecto: string
  brief_publico: string
  estilo_diseno: string
  digital_o_impresion: string
  cantidades: string
}): string {
  const tiposLine = input.tipos.length ? input.tipos.join(', ') : input.productLabel
  const spec = [input.objetivo_proyecto, input.brief_publico, input.estilo_diseno ? `Style: ${input.estilo_diseno}` : '']
    .filter(Boolean)
    .join('. ')
  return buildMockupImagePrompt({
    productLabel: tiposLine,
    productKind: input.productKind,
    sceneKind: input.sceneKind,
    especificacion: spec,
    donde_colocados: input.donde_colocados
  }).replace(
    'printed graphic product',
    input.cantidades.trim() ? `printed graphic product, quantity context: ${input.cantidades.trim()}` : 'printed graphic product'
  )
}

export function buildBriefIaContext(input: {
  tipos_producto: string[]
  tipo_producto_otro?: string
  necesita_asesoramiento?: boolean
  donde_colocados?: string
  digital_o_impresion?: string
  cantidades?: string
  objetivo_proyecto?: string
  brief_publico?: string
  estilo_diseno?: string
  material_logo?: string
  material_textos?: string
  material_imagenes?: string
  referencias_links?: string
  cliente_empresa?: string
}): string {
  const lines: string[] = []
  if (input.cliente_empresa?.trim()) lines.push(`Empresa: ${input.cliente_empresa.trim()}`)
  const tipos = [
    ...input.tipos_producto,
    input.tipo_producto_otro?.trim(),
    input.necesita_asesoramiento ? 'Necesita asesoramiento' : ''
  ].filter(Boolean)
  if (tipos.length) lines.push(`Productos/servicios: ${tipos.join('; ')}`)
  if (input.donde_colocados?.trim()) lines.push(`Ubicación: ${input.donde_colocados.trim()}`)
  if (input.digital_o_impresion) lines.push(`Formato: ${input.digital_o_impresion}`)
  if (input.cantidades?.trim()) lines.push(`Cantidades: ${input.cantidades.trim()}`)
  if (input.objetivo_proyecto?.trim()) lines.push(`Objetivo (borrador): ${input.objetivo_proyecto.trim()}`)
  if (input.brief_publico?.trim()) lines.push(`Descripción (borrador): ${input.brief_publico.trim()}`)
  if (input.estilo_diseno?.trim()) lines.push(`Estilo (borrador): ${input.estilo_diseno.trim()}`)
  if (input.material_logo) lines.push(`Logo: ${input.material_logo}`)
  if (input.material_textos) lines.push(`Textos: ${input.material_textos}`)
  if (input.material_imagenes) lines.push(`Imágenes: ${input.material_imagenes}`)
  if (input.referencias_links?.trim()) lines.push(`Referencias: ${input.referencias_links.trim()}`)
  return lines.join('\n')
}
