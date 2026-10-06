/**
 * Cliente mínimo de TypeSafe (https://docs.typesafe.ai/api.md) — solo servidor.
 * Llama al endpoint REST directo para no sumar dependencias.
 */

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone'
const MODEL = 'jev-latest'
const TIMEOUT_MS = 15_000
const MAX_REINTENTOS = 2

export type TypeSafeChoiceQuestion = {
  type: 'choice'
  instructions: string
  /** Opción → descripción (o null). La respuesta devuelve la clave elegida. */
  criteria: Record<string, string | null>
}

export type TypeSafeChoiceAnswer = {
  type: 'choice'
  choice: string
  probabilities?: Record<string, number>
  confidence: number
}

export type TypeSafeResponse = {
  model: string
  answers: Record<string, TypeSafeChoiceAnswer>
}

/** 401 / 422: no tiene sentido reintentar (clave inválida o pedido mal armado). */
export class TypeSafeConfigError extends Error {}

export function getTypeSafeApiKey(): string {
  return (process.env.TYPESAFE_API_KEY || '').trim()
}

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function typeSafeSystemOne(
  state: unknown,
  questions: Record<string, TypeSafeChoiceQuestion>
): Promise<TypeSafeResponse> {
  const apiKey = getTypeSafeApiKey()
  if (!apiKey) throw new TypeSafeConfigError('TYPESAFE_API_KEY no configurada en el servidor.')

  let ultimoError: Error = new Error('TypeSafe no respondió')
  for (let intento = 0; intento <= MAX_REINTENTOS; intento++) {
    if (intento > 0) await esperar(500 * 2 ** intento)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, model: MODEL, questions }),
        signal: controller.signal
      })
      if (res.ok) return (await res.json()) as TypeSafeResponse

      const detalle = await res.text().catch(() => '')
      if (res.status === 401) throw new TypeSafeConfigError('TYPESAFE_API_KEY inválida (401).')
      if (res.status === 422) throw new TypeSafeConfigError(`Pedido rechazado por TypeSafe (422): ${detalle.slice(0, 200)}`)
      // 429 (límite) / 529 (sobrecarga) / 5xx: reintentar con backoff
      ultimoError = new Error(`TypeSafe HTTP ${res.status}`)
    } catch (error) {
      if (error instanceof TypeSafeConfigError) throw error
      ultimoError = error instanceof Error ? error : new Error(String(error))
    } finally {
      clearTimeout(timer)
    }
  }
  throw ultimoError
}
