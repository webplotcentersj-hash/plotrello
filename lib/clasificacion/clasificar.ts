import type { SupabaseClient } from '@supabase/supabase-js'
import { getTypeSafeApiKey, TypeSafeConfigError, typeSafeSystemOne } from '../typesafe/client'
import {
  clasificarPorRegla,
  construirOpcionesRubro,
  estadoParaIA,
  instruccionesPara,
  interpretarRespuesta,
  opcionesMotivoFalla,
  type Clasificacion,
  type Pendiente,
  type RubroCatalogo,
  type TipoClasificacion
} from './reglas'

const CONCURRENCIA = 4

export type ResultadoLote = {
  tipo: TipoClasificacion
  clasificados: { catalogo: number; regla: number; ia: number; revisar: number }
  /** Quedan registros que necesitan IA y no hay TYPESAFE_API_KEY. */
  sinClave: boolean
  error?: string
}

async function opcionesPara(supabase: SupabaseClient, tipo: TipoClasificacion) {
  if (tipo === 'motivo_falla_entrega') return opcionesMotivoFalla()
  const { data, error } = await supabase.rpc('clasificacion_ia_rubros_catalogo')
  if (error) throw new Error(error.message)
  return construirOpcionesRubro((data as RubroCatalogo[]) || [])
}

/**
 * Clasifica un lote de registros pendientes: primero reglas (catálogo, sin comentario),
 * después TypeSafe para el texto libre. Corta al llegar a `deadline` para no pasar el límite de Vercel.
 */
export async function clasificarLote(
  supabase: SupabaseClient,
  tipo: TipoClasificacion,
  opts: { limite: number; deadline: number }
): Promise<ResultadoLote> {
  const resultado: ResultadoLote = { tipo, clasificados: { catalogo: 0, regla: 0, ia: 0, revisar: 0 }, sinClave: false }

  const { data, error } = await supabase.rpc('clasificacion_ia_pendientes', { p_tipo: tipo, p_limite: opts.limite })
  if (error) throw new Error(error.message)
  const pendientes = ((data as Pendiente[]) || []).map((p) => ({ ...p, entidad_id: Number(p.entidad_id) }))

  const listos: Clasificacion[] = []
  const paraIA: Pendiente[] = []
  for (const p of pendientes) {
    const porRegla = clasificarPorRegla(tipo, p)
    if (porRegla) listos.push(porRegla)
    else paraIA.push(p)
  }

  if (paraIA.length && !getTypeSafeApiKey()) {
    resultado.sinClave = true
  } else if (paraIA.length) {
    const opciones = await opcionesPara(supabase, tipo)
    const cola = [...paraIA]
    let errorFatal: Error | null = null

    const trabajador = async () => {
      while (cola.length && !errorFatal && Date.now() < opts.deadline) {
        const p = cola.shift()!
        try {
          const res = await typeSafeSystemOne(estadoParaIA(tipo, p), {
            clasificacion: { type: 'choice', instructions: instruccionesPara(tipo), criteria: opciones }
          })
          listos.push(interpretarRespuesta(tipo, p.entidad_id, opciones, res.answers?.clasificacion))
        } catch (e) {
          // Clave inválida: cortar todo. Otro error: ese registro queda pendiente para el próximo lote.
          if (e instanceof TypeSafeConfigError) errorFatal = e
          else resultado.error = e instanceof Error ? e.message : String(e)
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCIA, paraIA.length) }, trabajador))
    if (errorFatal) resultado.error = (errorFatal as Error).message
  }

  if (listos.length) {
    const now = new Date().toISOString()
    const { error: errGuardar } = await supabase.from('clasificaciones_ia').upsert(
      listos.map((c) => ({
        tipo,
        entidad_id: c.entidad_id,
        categoria: c.categoria,
        confianza: c.confianza,
        fuente: c.fuente,
        revisar: c.revisar,
        modelo: c.fuente === 'ia' ? 'typesafe/jev-latest' : null,
        updated_at: now
      })),
      { onConflict: 'tipo,entidad_id' }
    )
    if (errGuardar) throw new Error(errGuardar.message)
  }

  for (const c of listos) {
    resultado.clasificados[c.fuente] += 1
    if (c.revisar) resultado.clasificados.revisar += 1
  }
  return resultado
}
