/** Filtra filas por texto en campos string (case-insensitive). */
export function matchSearchQuery(
  q: string,
  fields: (string | null | undefined)[]
): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return fields.some((f) => (f ?? '').toLowerCase().includes(needle))
}

export const LIST_PAGE_SIZE = 40
