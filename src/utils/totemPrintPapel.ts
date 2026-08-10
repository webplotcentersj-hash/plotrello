/** Tipos de papel del tótem (gramos; en UI se muestra “g”). */
export type TotemPrintPapelId =
  | 'obra_80'
  | 'obra_120'
  | 'obra_180'
  | 'obra_240'
  | 'ilust_115'
  | 'ilust_170'
  | 'ilust_300'
  | 'ilust_350'
  | 'adh_ilust'
  | 'adh_obra'
  | 'esp_texturado'
  | 'esp_metalizado'
  | 'esp_perlado'

export type TotemPrintPapelOption = {
  id: TotemPrintPapelId
  label: string
  group: 'Obra' | 'Ilustración' | 'Adhesivo' | 'Papel especial'
}

export const TOTEM_PRINT_PAPEL_OPTIONS: TotemPrintPapelOption[] = [
  { id: 'obra_80', label: 'Obra 80 g', group: 'Obra' },
  { id: 'obra_120', label: 'Obra 120 g', group: 'Obra' },
  { id: 'obra_180', label: 'Obra 180 g', group: 'Obra' },
  { id: 'obra_240', label: 'Obra 240 g', group: 'Obra' },
  { id: 'ilust_115', label: 'Ilustración 115 g', group: 'Ilustración' },
  { id: 'ilust_170', label: 'Ilustración 170 g', group: 'Ilustración' },
  { id: 'ilust_300', label: 'Ilustración 300 g', group: 'Ilustración' },
  { id: 'ilust_350', label: 'Ilustración 350 g', group: 'Ilustración' },
  { id: 'adh_ilust', label: 'Papel adhesivo ilustración', group: 'Adhesivo' },
  { id: 'adh_obra', label: 'Papel adhesivo obra', group: 'Adhesivo' },
  { id: 'esp_texturado', label: 'Especial texturado', group: 'Papel especial' },
  { id: 'esp_metalizado', label: 'Especial metalizado', group: 'Papel especial' },
  { id: 'esp_perlado', label: 'Especial perlado', group: 'Papel especial' }
]

export const TOTEM_PRINT_PAPEL_DEFAULT: TotemPrintPapelId = 'ilust_115'

export function isTotemPrintPapelId(v: string): v is TotemPrintPapelId {
  return TOTEM_PRINT_PAPEL_OPTIONS.some((o) => o.id === v)
}

export function labelTotemPrintPapel(id: TotemPrintPapelId): string {
  return TOTEM_PRINT_PAPEL_OPTIONS.find((o) => o.id === id)?.label || id
}

export function gruposTotemPrintPapel(): Array<{
  group: TotemPrintPapelOption['group']
  options: TotemPrintPapelOption[]
}> {
  const order: TotemPrintPapelOption['group'][] = ['Obra', 'Ilustración', 'Adhesivo', 'Papel especial']
  return order.map((group) => ({
    group,
    options: TOTEM_PRINT_PAPEL_OPTIONS.filter((o) => o.group === group)
  }))
}
