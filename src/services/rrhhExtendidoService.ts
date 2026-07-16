import { supabase } from './supabaseClient'
import type {
  RrhhClimaEncuesta,
  RrhhClimaPregunta,
  RrhhDocItem,
  RrhhDocLote,
  RrhhMedicinaRegistro,
  RrhhMedicinaResultado,
  RrhhMedicinaTipo,
  RrhhOnboardingInstancia,
  RrhhOnboardingItem,
  RrhhOnboardingProgreso,
  RrhhPuesto
} from '../types/api'

function err(e: unknown, fb: string): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return fb
}

// ——— Onboarding ———

export async function rrhhOnboardingIniciar(idUsuario: number) {
  if (!supabase) return { success: false as const, error: 'Supabase no inicializado' }
  try {
    const { data, error } = await supabase.rpc('rrhh_onboarding_iniciar', {
      p_id_usuario: idUsuario,
      p_id_plantilla: null
    })
    if (error) throw error
    return { success: true as const, data }
  } catch (e) {
    return { success: false as const, error: err(e, 'No se pudo iniciar onboarding') }
  }
}

export async function rrhhOnboardingListarInstancias(): Promise<{
  success: boolean
  data?: RrhhOnboardingInstancia[]
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  try {
    const { data, error } = await supabase
      .from('rrhh_onboarding_instancias')
      .select('*')
      .order('started_at', { ascending: false })
    if (error) throw error
    const instancias = (data || []) as RrhhOnboardingInstancia[]
    const ids = instancias.map((i) => i.id_usuario)
    const nameById = new Map<number, string>()
    if (ids.length) {
      const { data: users } = await supabase.rpc('obtener_usuarios_por_ids', { p_ids: ids })
      if (Array.isArray(users)) {
        for (const u of users as { id: number; nombre: string }[]) {
          nameById.set(u.id, u.nombre)
        }
      }
    }
    const withProg: RrhhOnboardingInstancia[] = []
    for (const inst of instancias) {
      const { data: prog } = await supabase
        .from('rrhh_onboarding_progreso')
        .select('*')
        .eq('id_instancia', inst.id)
      const { data: items } = await supabase
        .from('rrhh_onboarding_items')
        .select('*')
        .eq('id_plantilla', inst.id_plantilla)
        .order('orden')
      const itemsById = new Map((items || []).map((it) => [Number((it as RrhhOnboardingItem).id), it as RrhhOnboardingItem]))
      const progreso = ((prog || []) as RrhhOnboardingProgreso[]).map((p) => ({
        ...p,
        item: itemsById.get(p.id_item)
      }))
      withProg.push({
        ...inst,
        nombre_usuario: nameById.get(inst.id_usuario) || `Usuario ${inst.id_usuario}`,
        progreso
      })
    }
    return { success: true, data: withProg }
  } catch (e) {
    return { success: false, error: err(e, 'Error al listar onboarding') }
  }
}

export async function rrhhOnboardingResumenUsuario(idUsuario: number): Promise<{
  success: boolean
  data?: { hechos: number; total: number; estado: string } | null
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  try {
    const { data: inst } = await supabase
      .from('rrhh_onboarding_instancias')
      .select('id, estado')
      .eq('id_usuario', idUsuario)
      .maybeSingle()
    if (!inst) return { success: true, data: null }
    const { data: prog } = await supabase
      .from('rrhh_onboarding_progreso')
      .select('hecho')
      .eq('id_instancia', inst.id)
    const total = (prog || []).length
    const hechos = (prog || []).filter((p) => p.hecho).length
    return { success: true, data: { hechos, total, estado: String(inst.estado) } }
  } catch (e) {
    return { success: false, error: err(e, 'Error resumen onboarding') }
  }
}

export async function rrhhOnboardingToggleItem(params: {
  idProgreso: number
  hecho: boolean
  hechoPor: number
  idInstancia: number
}) {
  if (!supabase) return { success: false as const, error: 'Supabase no inicializado' }
  try {
    const { error } = await supabase
      .from('rrhh_onboarding_progreso')
      .update({
        hecho: params.hecho,
        hecho_por: params.hecho ? params.hechoPor : null,
        hecho_at: params.hecho ? new Date().toISOString() : null
      })
      .eq('id', params.idProgreso)
    if (error) throw error

    const { data: prog } = await supabase
      .from('rrhh_onboarding_progreso')
      .select('hecho')
      .eq('id_instancia', params.idInstancia)
    const allDone = (prog || []).length > 0 && (prog || []).every((p) => p.hecho)
    if (allDone) {
      await supabase
        .from('rrhh_onboarding_instancias')
        .update({ estado: 'completo', completed_at: new Date().toISOString() })
        .eq('id', params.idInstancia)
    } else {
      await supabase
        .from('rrhh_onboarding_instancias')
        .update({ estado: 'en_curso', completed_at: null })
        .eq('id', params.idInstancia)
    }
    return { success: true as const }
  } catch (e) {
    return { success: false as const, error: err(e, 'Error al actualizar ítem') }
  }
}

// ——— Organigrama ———

export async function rrhhPuestosListar(): Promise<{ success: boolean; data?: RrhhPuesto[]; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  try {
    const { data, error } = await supabase.from('rrhh_puestos').select('*').eq('activo', true).order('nombre')
    if (error) throw error
    return { success: true, data: (data || []) as RrhhPuesto[] }
  } catch (e) {
    return { success: false, error: err(e, 'Error al listar puestos') }
  }
}

export async function rrhhPuestoCrear(input: {
  nombre: string
  sector?: string | null
  id_puesto_padre?: number | null
  descripcion?: string | null
}) {
  if (!supabase) return { success: false as const, error: 'Supabase no inicializado' }
  try {
    const { data, error } = await supabase
      .from('rrhh_puestos')
      .insert({
        nombre: input.nombre,
        sector: input.sector ?? null,
        id_puesto_padre: input.id_puesto_padre ?? null,
        descripcion: input.descripcion ?? null
      })
      .select('*')
      .single()
    if (error) throw error
    return { success: true as const, data: data as RrhhPuesto }
  } catch (e) {
    return { success: false as const, error: err(e, 'Error al crear puesto') }
  }
}

export async function rrhhPuestoActualizar(
  id: number,
  input: {
    nombre: string
    sector?: string | null
    id_puesto_padre?: number | null
    descripcion?: string | null
    activo?: boolean
  }
) {
  if (!supabase) return { success: false as const, error: 'Supabase no inicializado' }
  try {
    if (input.id_puesto_padre != null && Number(input.id_puesto_padre) === id) {
      return { success: false as const, error: 'Un puesto no puede ser padre de sí mismo' }
    }
    const { data, error } = await supabase
      .from('rrhh_puestos')
      .update({
        nombre: input.nombre,
        sector: input.sector ?? null,
        id_puesto_padre: input.id_puesto_padre ?? null,
        descripcion: input.descripcion ?? null,
        activo: input.activo ?? true
      })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return { success: true as const, data: data as RrhhPuesto }
  } catch (e) {
    return { success: false as const, error: err(e, 'Error al actualizar puesto') }
  }
}

export async function rrhhLegajoAsignarPuestoJefe(params: {
  idUsuario: number
  idPuesto: number | null
  idJefe: number | null
}) {
  if (!supabase) return { success: false as const, error: 'Supabase no inicializado' }
  try {
    const { error } = await supabase
      .from('legajos_empleados')
      .update({ id_puesto: params.idPuesto, id_jefe: params.idJefe })
      .eq('id_usuario', params.idUsuario)
    if (error) throw error
    return { success: true as const }
  } catch (e) {
    return { success: false as const, error: err(e, 'Error al asignar puesto/jefe') }
  }
}

export async function rrhhLegajosOrgListar(): Promise<{
  success: boolean
  data?: Array<{
    id_usuario: number
    nombre: string
    apellido: string
    sector: string
    id_puesto: number | null
    id_jefe: number | null
    foto_url: string | null
  }>
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  try {
    const { data, error } = await supabase
      .from('legajos_empleados')
      .select('id_usuario, nombre, apellido, sector, id_puesto, id_jefe, foto_url')
    if (error) throw error
    return {
      success: true,
      data: (data || []).map((r) => ({
        id_usuario: Number(r.id_usuario),
        nombre: String(r.nombre || ''),
        apellido: String(r.apellido || ''),
        sector: String(r.sector || ''),
        id_puesto: r.id_puesto == null ? null : Number(r.id_puesto),
        id_jefe: r.id_jefe == null ? null : Number(r.id_jefe),
        foto_url: r.foto_url ? String(r.foto_url) : null
      }))
    }
  } catch (e) {
    return { success: false, error: err(e, 'Error al listar legajos org') }
  }
}

// ——— Medicina ———

export async function rrhhMedicinaListar(idUsuario?: number): Promise<{
  success: boolean
  data?: RrhhMedicinaRegistro[]
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  try {
    let q = supabase.from('rrhh_medicina_registros').select('*').order('fecha', { ascending: false })
    if (idUsuario) q = q.eq('id_usuario', idUsuario)
    const { data, error } = await q
    if (error) throw error
    const rows = (data || []) as RrhhMedicinaRegistro[]
    const ids = [...new Set(rows.map((r) => r.id_usuario))]
    const nameById = new Map<number, string>()
    if (ids.length) {
      const { data: users } = await supabase.rpc('obtener_usuarios_por_ids', { p_ids: ids })
      if (Array.isArray(users)) {
        for (const u of users as { id: number; nombre: string }[]) nameById.set(u.id, u.nombre)
      }
    }
    return {
      success: true,
      data: rows.map((r) => ({
        ...r,
        adjuntos: Array.isArray(r.adjuntos) ? r.adjuntos : [],
        nombre_usuario: nameById.get(r.id_usuario)
      }))
    }
  } catch (e) {
    return { success: false, error: err(e, 'Error al listar medicina') }
  }
}

export async function rrhhMedicinaCrear(input: {
  id_usuario: number
  tipo: RrhhMedicinaTipo
  fecha: string
  resultado: RrhhMedicinaResultado
  proxima_revision?: string | null
  proveedor?: string | null
  observaciones?: string | null
  registrado_por: number
}) {
  if (!supabase) return { success: false as const, error: 'Supabase no inicializado' }
  try {
    const { data, error } = await supabase
      .from('rrhh_medicina_registros')
      .insert({
        ...input,
        proxima_revision: input.proxima_revision || null,
        proveedor: input.proveedor || null,
        observaciones: input.observaciones || null,
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single()
    if (error) throw error
    return { success: true as const, data: data as RrhhMedicinaRegistro }
  } catch (e) {
    return { success: false as const, error: err(e, 'Error al crear registro médico') }
  }
}

// ——— Recibos ———

export async function rrhhDocLotesListar(): Promise<{ success: boolean; data?: RrhhDocLote[]; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  try {
    const { data, error } = await supabase.from('rrhh_doc_lotes').select('*').order('periodo', { ascending: false })
    if (error) throw error
    return { success: true, data: (data || []) as RrhhDocLote[] }
  } catch (e) {
    return { success: false, error: err(e, 'Error al listar lotes') }
  }
}

export async function rrhhDocLoteCrear(input: {
  periodo: string
  titulo: string
  tipo?: 'recibo_sueldo' | 'otro'
  created_by: number
}) {
  if (!supabase) return { success: false as const, error: 'Supabase no inicializado' }
  try {
    const { data, error } = await supabase
      .from('rrhh_doc_lotes')
      .insert({
        periodo: input.periodo,
        titulo: input.titulo,
        tipo: input.tipo || 'recibo_sueldo',
        created_by: input.created_by,
        estado: 'borrador'
      })
      .select('*')
      .single()
    if (error) throw error
    return { success: true as const, data: data as RrhhDocLote }
  } catch (e) {
    return { success: false as const, error: err(e, 'Error al crear lote') }
  }
}

export async function rrhhDocLoteActualizarEstado(id: number, estado: RrhhDocLote['estado']) {
  if (!supabase) return { success: false as const, error: 'Supabase no inicializado' }
  try {
    const { error } = await supabase
      .from('rrhh_doc_lotes')
      .update({ estado, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    return { success: true as const }
  } catch (e) {
    return { success: false as const, error: err(e, 'Error al actualizar lote') }
  }
}

export async function rrhhDocItemsListar(idLote?: number, idUsuario?: number): Promise<{
  success: boolean
  data?: RrhhDocItem[]
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  try {
    let q = supabase.from('rrhh_doc_items').select('*').order('created_at', { ascending: false })
    if (idLote) q = q.eq('id_lote', idLote)
    if (idUsuario) q = q.eq('id_usuario', idUsuario)
    const { data, error } = await q
    if (error) throw error
    const rows = (data || []) as RrhhDocItem[]
    const ids = [...new Set(rows.map((r) => r.id_usuario))]
    const nameById = new Map<number, string>()
    if (ids.length) {
      const { data: users } = await supabase.rpc('obtener_usuarios_por_ids', { p_ids: ids })
      if (Array.isArray(users)) {
        for (const u of users as { id: number; nombre: string }[]) nameById.set(u.id, u.nombre)
      }
    }
    return {
      success: true,
      data: rows.map((r) => ({ ...r, nombre_usuario: nameById.get(r.id_usuario) }))
    }
  } catch (e) {
    return { success: false, error: err(e, 'Error al listar ítems') }
  }
}

export async function rrhhDocItemAgregar(input: {
  id_lote: number
  id_usuario: number
  archivo_url: string
  archivo_nombre?: string | null
}) {
  if (!supabase) return { success: false as const, error: 'Supabase no inicializado' }
  try {
    const { data, error } = await supabase
      .from('rrhh_doc_items')
      .upsert(
        {
          id_lote: input.id_lote,
          id_usuario: input.id_usuario,
          archivo_url: input.archivo_url,
          archivo_nombre: input.archivo_nombre || null,
          estado: 'pendiente'
        },
        { onConflict: 'id_lote,id_usuario' }
      )
      .select('*')
      .single()
    if (error) throw error
    return { success: true as const, data: data as RrhhDocItem }
  } catch (e) {
    return { success: false as const, error: err(e, 'Error al agregar recibo') }
  }
}

export async function rrhhDocItemFirmar(id: number, firmaDataUrl: string) {
  if (!supabase) return { success: false as const, error: 'Supabase no inicializado' }
  try {
    const { data, error } = await supabase
      .from('rrhh_doc_items')
      .update({
        estado: 'firmado',
        firma_data_url: firmaDataUrl,
        firmado_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return { success: true as const, data: data as RrhhDocItem }
  } catch (e) {
    return { success: false as const, error: err(e, 'Error al firmar') }
  }
}

export async function rrhhDocSubirArchivo(file: File, idUsuario: number) {
  if (!supabase) return { success: false as const, error: 'Supabase no inicializado' }
  const ext = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `rrhh-recibos/${idUsuario}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80)}`
  try {
    const { error } = await supabase.storage.from('archivos').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || `application/${ext}`
    })
    if (error) throw error
    const { data: urlData } = supabase.storage.from('archivos').getPublicUrl(path)
    return {
      success: true as const,
      data: { url: urlData.publicUrl, nombre: file.name }
    }
  } catch (e) {
    return { success: false as const, error: err(e, 'Error al subir archivo') }
  }
}

// ——— Clima ———

export async function rrhhClimaListar(): Promise<{
  success: boolean
  data?: RrhhClimaEncuesta[]
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  try {
    const { data, error } = await supabase
      .from('rrhh_clima_encuestas')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return { success: true, data: (data || []) as RrhhClimaEncuesta[] }
  } catch (e) {
    return { success: false, error: err(e, 'Error al listar encuestas') }
  }
}

export async function rrhhClimaCrearPlantilla(params: {
  titulo: string
  created_by: number
}): Promise<{ success: boolean; data?: RrhhClimaEncuesta; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  try {
    const { data: enc, error } = await supabase
      .from('rrhh_clima_encuestas')
      .insert({
        titulo: params.titulo,
        estado: 'borrador',
        anonima: true,
        created_by: params.created_by
      })
      .select('*')
      .single()
    if (error) throw error
    const id = Number(enc.id)
    const preguntas = [
      { texto: 'En una escala de 0 a 10, ¿recomendarías Plot Center como lugar para trabajar? (eNPS)', tipo: 'enps', orden: 1 },
      { texto: 'Me siento valorado/a en mi equipo', tipo: 'likert_1_5', orden: 2 },
      { texto: 'La comunicación interna es clara', tipo: 'likert_1_5', orden: 3 },
      { texto: 'Tengo las herramientas para hacer bien mi trabajo', tipo: 'likert_1_5', orden: 4 },
      { texto: 'Comentario abierto (opcional)', tipo: 'texto', orden: 5 }
    ]
    const { error: pErr } = await supabase.from('rrhh_clima_preguntas').insert(
      preguntas.map((p) => ({ ...p, id_encuesta: id }))
    )
    if (pErr) throw pErr
    return { success: true, data: enc as RrhhClimaEncuesta }
  } catch (e) {
    return { success: false, error: err(e, 'Error al crear encuesta') }
  }
}

export async function rrhhClimaSetEstado(id: number, estado: RrhhClimaEncuesta['estado']) {
  if (!supabase) return { success: false as const, error: 'Supabase no inicializado' }
  try {
    const { error } = await supabase
      .from('rrhh_clima_encuestas')
      .update({ estado, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    return { success: true as const }
  } catch (e) {
    return { success: false as const, error: err(e, 'Error al cambiar estado') }
  }
}

export async function rrhhClimaPreguntas(idEncuesta: number): Promise<{
  success: boolean
  data?: RrhhClimaPregunta[]
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  try {
    const { data, error } = await supabase
      .from('rrhh_clima_preguntas')
      .select('*')
      .eq('id_encuesta', idEncuesta)
      .order('orden')
    if (error) throw error
    return { success: true, data: (data || []) as RrhhClimaPregunta[] }
  } catch (e) {
    return { success: false, error: err(e, 'Error al cargar preguntas') }
  }
}

export async function rrhhClimaResponder(params: {
  idEncuesta: number
  tokenAnon: string
  respuestas: Array<{ id_pregunta: number; valor_num?: number | null; valor_texto?: string | null }>
}) {
  if (!supabase) return { success: false as const, error: 'Supabase no inicializado' }
  try {
    const rows = params.respuestas.map((r) => ({
      id_encuesta: params.idEncuesta,
      id_pregunta: r.id_pregunta,
      valor_num: r.valor_num ?? null,
      valor_texto: r.valor_texto ?? null,
      token_anon: params.tokenAnon
    }))
    const { error } = await supabase.from('rrhh_clima_respuestas').upsert(rows, {
      onConflict: 'id_pregunta,token_anon'
    })
    if (error) throw error
    return { success: true as const }
  } catch (e) {
    return { success: false as const, error: err(e, 'Error al enviar respuestas') }
  }
}

export async function rrhhClimaResultados(idEncuesta: number): Promise<{
  success: boolean
  data?: Array<{ id_pregunta: number; texto: string; tipo: string; promedio: number | null; n: number }>
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  try {
    const preg = await rrhhClimaPreguntas(idEncuesta)
    if (!preg.success || !preg.data) return { success: false, error: preg.error }
    const { data: resp, error } = await supabase
      .from('rrhh_clima_respuestas')
      .select('id_pregunta, valor_num')
      .eq('id_encuesta', idEncuesta)
    if (error) throw error
    const byQ = new Map<number, number[]>()
    for (const r of resp || []) {
      if (r.valor_num == null) continue
      const arr = byQ.get(Number(r.id_pregunta)) || []
      arr.push(Number(r.valor_num))
      byQ.set(Number(r.id_pregunta), arr)
    }
    return {
      success: true,
      data: preg.data.map((p) => {
        const vals = byQ.get(p.id) || []
        const promedio =
          vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null
        return { id_pregunta: p.id, texto: p.texto, tipo: p.tipo, promedio, n: vals.length }
      })
    }
  } catch (e) {
    return { success: false, error: err(e, 'Error al calcular resultados') }
  }
}
