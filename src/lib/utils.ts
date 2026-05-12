import { type ClassValue, clsx } from 'clsx'

/** Merge class names (shadcn-style helper; sin `tailwind-merge` en este repo). */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}
