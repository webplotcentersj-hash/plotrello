export const SATISFACCION_RATINGS = [
  { value: 1 as const, emoji: '😠', label: 'Muy malo' },
  { value: 2 as const, emoji: '😕', label: 'Malo' },
  { value: 3 as const, emoji: '😐', label: 'Regular' },
  { value: 4 as const, emoji: '🙂', label: 'Bueno' },
  { value: 5 as const, emoji: '😀', label: 'Excelente' }
] as const

export function emojiRating(r: number): string {
  return SATISFACCION_RATINGS.find((x) => x.value === r)?.emoji ?? String(r)
}
