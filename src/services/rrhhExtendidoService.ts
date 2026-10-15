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
import type {
  AlicuotasLct,
  ReciboExtra,
  RrhhLibroSueldos,
  RrhhLibroSueldosItem,
  RrhhSueldoFicha
} from '../utils/rrhhLibroSueldos'

function err(e: unknown, fb: string): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return fb
}

/** IDs de personal activo (`listar_usuarios`). Las bajas no deben figurar en módulos operativos. */
async function idsUsuariosActivos(): Promise<Set<number>> {
  if (!supabase) return new Set()
  const { data, error } = await supabase.rpc('listar_usuarios')
  if (error) throw error
  return new Set(
    ((data as Array<{ id: number }> | null) || [])
      .map((u) => Number(u.id))
      .filter((id) => id > 0)
  )
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
    const activos = await idsUsuariosActivos()
    const instancias = ((data || []) as RrhhOnboardingInstancia[]).filter((i) =>
      activos.has(Number(i.id_usuario))
    )
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
    const [{ data, error }, { data: users, error: usersErr }] = await Promise.all([
      supabase
        .from('legajos_empleados')
        .select('id_usuario, nombre, apellido, sector, id_puesto, id_jefe, foto_url'),
      supabase.rpc('listar_usuarios')
    ])
    if (error) throw error
    if (usersErr) throw usersErr
    const activos = new Set(
      ((users as Array<{ id: number }> | null) || [])
        .map((u) => Number(u.id))
        .filter((id) => id > 0)
    )
    return {
      success: true,
      data: (data || [])
        .filter((r) => activos.has(Number(r.id_usuario)))
        .map((r) => ({
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
    let rows = (data || []) as RrhhMedicinaRegistro[]
    if (!idUsuario) {
      const activos = await idsUsuariosActivos()
      rows = rows.filter((r) => activos.has(Number(r.id_usuario)))
    }
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
    let rows = (data || []) as RrhhDocItem[]
    // En listados generales (sin lote/usuario), ocultar ítems de personal de baja.
    if (!idLote && !idUsuario) {
      const activos = await idsUsuariosActivos()
      rows = rows.filter((r) => activos.has(Number(r.id_usuario)))
    }
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

// ——— Libro de sueldos ———

function num(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function parseExtras(raw: unknown): ReciboExtra[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x, i) => {
    const r = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>
    const tipo = r.tipo
    return {
      id: String(r.id || `x-${i}`),
      concepto: String(r.concepto || ''),
      tipo:
        tipo === 'no_remunerativo' || tipo === 'descuento' || tipo === 'empleador' ? tipo : 'remunerativo',
      unidad: String(r.unidad || ''),
      base: r.base == null || r.base === '' ? null : num(r.base),
      monto: num(r.monto),
      codigo_lsd: String(r.codigo_lsd || '')
    }
  })
}

function mapLibro(row: Record<string, unknown>): RrhhLibroSueldos {
  return {
    id: num(row.id),
    periodo: String(row.periodo || ''),
    estado: row.estado === 'cerrado' ? 'cerrado' : 'borrador',
    empresa_nombre: String(row.empresa_nombre || 'PLOT CENTER SRL'),
    empresa_domicilio: String(row.empresa_domicilio || ''),
    empresa_cuit: String(row.empresa_cuit || '30715518801'),
    jurisdiccion: String(row.jurisdiccion || 'SAN JUAN'),
    cct_default: String(row.cct_default || '0409/05'),
    art_codigo: String(row.art_codigo || '00000'),
    scvo_cia: String(row.scvo_cia || 'S880 EXPERTA SEGUROS'),
    banco: row.banco == null ? null : String(row.banco),
    fecha_pago: row.fecha_pago == null ? null : String(row.fecha_pago).slice(0, 10),
    scvo_default: num(row.scvo_default),
    os_base_mult: num(row.os_base_mult, 2),
    nro_liquidacion: num(row.nro_liquidacion, 1),
    dias_base: num(row.dias_base, 30),
    tipo_empleador: String(row.tipo_empleador || '1'),
    codigo_actividad: String(row.codigo_actividad || '049'),
    codigo_localidad: String(row.codigo_localidad || '00'),
    codigo_os_default: row.codigo_os_default == null ? null : String(row.codigo_os_default),
    importe_detraer: num(row.importe_detraer),
    alicuotas: (row.alicuotas && typeof row.alicuotas === 'object' ? row.alicuotas : {}) as Partial<AlicuotasLct>,
    notas: row.notas == null ? null : String(row.notas),
    id_lote_recibos: row.id_lote_recibos == null ? null : num(row.id_lote_recibos),
    created_by: row.created_by == null ? null : num(row.created_by),
    created_at: String(row.created_at || '')
  }
}

function mapItem(row: Record<string, unknown>): RrhhLibroSueldosItem {
  return {
    id: num(row.id),
    id_libro: num(row.id_libro),
    id_usuario: num(row.id_usuario),
    incluido: row.incluido !== false,
    n_legajo: num(row.n_legajo),
    apellido_nombre: String(row.apellido_nombre || ''),
    cuil: String(row.cuil || ''),
    categoria: row.categoria == null ? null : String(row.categoria),
    fecha_ingreso: row.fecha_ingreso == null ? null : String(row.fecha_ingreso).slice(0, 10),
    antiguedad_reconocida: num(row.antiguedad_reconocida),
    anios_antiguedad: num(row.anios_antiguedad),
    dias: num(row.dias, 30),
    etiqueta_basico: String(row.etiqueta_basico || 'Sueldo básico'),
    sueldo_basico: num(row.sueldo_basico),
    adicional_antiguedad: num(row.adicional_antiguedad),
    scvo: num(row.scvo),
    banco: row.banco == null ? null : String(row.banco),
    cbu: row.cbu == null ? null : String(row.cbu),
    forma_pago: String(row.forma_pago || '1'),
    conyuge: row.conyuge === true,
    hijos: num(row.hijos),
    cct: row.cct !== false,
    cct_codigo: row.cct_codigo == null ? null : String(row.cct_codigo),
    cobertura_scvo: row.cobertura_scvo !== false,
    situacion_revista: String(row.situacion_revista || '01'),
    condicion: String(row.condicion || '01'),
    actividad: row.actividad == null ? null : String(row.actividad),
    modalidad: String(row.modalidad || '001'),
    codigo_os: row.codigo_os == null ? null : String(row.codigo_os),
    horas_trabajadas: num(row.horas_trabajadas),
    extras: parseExtras(row.extras)
  }
}

function mapFicha(row: Record<string, unknown>): RrhhSueldoFicha {
  return {
    id_usuario: num(row.id_usuario),
    n_legajo: row.n_legajo == null ? null : num(row.n_legajo),
    cuil: row.cuil == null ? null : String(row.cuil),
    categoria: row.categoria == null ? null : String(row.categoria),
    etiqueta_basico: row.etiqueta_basico == null ? null : String(row.etiqueta_basico),
    sueldo_basico: row.sueldo_basico == null ? null : num(row.sueldo_basico),
    adicional_antiguedad: row.adicional_antiguedad == null ? null : num(row.adicional_antiguedad),
    antiguedad_reconocida: row.antiguedad_reconocida == null ? null : num(row.antiguedad_reconocida),
    scvo: row.scvo == null ? null : num(row.scvo),
    banco: row.banco == null ? null : String(row.banco),
    cbu: row.cbu == null ? null : String(row.cbu),
    forma_pago: row.forma_pago == null ? null : String(row.forma_pago),
    conyuge: row.conyuge == null ? null : row.conyuge === true,
    hijos: row.hijos == null ? null : num(row.hijos),
    cct: row.cct == null ? null : row.cct !== false,
    cct_codigo: row.cct_codigo == null ? null : String(row.cct_codigo),
    cobertura_scvo: row.cobertura_scvo == null ? null : row.cobertura_scvo !== false,
    situacion_revista: row.situacion_revista == null ? null : String(row.situacion_revista),
    condicion: row.condicion == null ? null : String(row.condicion),
    actividad: row.actividad == null ? null : String(row.actividad),
    modalidad: row.modalidad == null ? null : String(row.modalidad),
    codigo_os: row.codigo_os == null ? null : String(row.codigo_os)
  }
}

export async function rrhhLibroSueldosObtener(periodo: string): Promise<{
  success: boolean
  data?: RrhhLibroSueldos | null
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  try {
    const { data, error } = await supabase
      .from('rrhh_libro_sueldos')
      .select('*')
      .eq('periodo', periodo)
      .maybeSingle()
    if (error) throw error
    return { success: true, data: data ? mapLibro(data as Record<string, unknown>) : null }
  } catch (e) {
    return { success: false, error: err(e, 'Error al leer el libro de sueldos') }
  }
}

export async function rrhhLibroSueldosUpsert(input: {
  periodo: string
  created_by?: number | null
  patch?: Partial<RrhhLibroSueldos>
}): Promise<{ success: boolean; data?: RrhhLibroSueldos; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  try {
    const existing = await rrhhLibroSueldosObtener(input.periodo)
    if (!existing.success) return { success: false, error: existing.error }
    const payload: Record<string, unknown> = {
      periodo: input.periodo,
      updated_at: new Date().toISOString()
    }
    if (!existing.data && input.created_by != null) payload.created_by = input.created_by
    const p = input.patch || {}
    const keys: Array<keyof RrhhLibroSueldos> = [
      'estado',
      'empresa_nombre',
      'empresa_domicilio',
      'empresa_cuit',
      'jurisdiccion',
      'cct_default',
      'art_codigo',
      'scvo_cia',
      'banco',
      'fecha_pago',
      'scvo_default',
      'os_base_mult',
      'nro_liquidacion',
      'dias_base',
      'tipo_empleador',
      'codigo_actividad',
      'codigo_localidad',
      'codigo_os_default',
      'importe_detraer',
      'alicuotas',
      'notas',
      'id_lote_recibos'
    ]
    for (const k of keys) {
      if (p[k] !== undefined) payload[k] = p[k]
    }
    const q = existing.data
      ? supabase.from('rrhh_libro_sueldos').update(payload).eq('id', existing.data.id)
      : supabase.from('rrhh_libro_sueldos').insert(payload)
    const { data, error } = await q.select('*').single()
    if (error) throw error
    return { success: true, data: mapLibro(data as Record<string, unknown>) }
  } catch (e) {
    return { success: false, error: err(e, 'Error al guardar el libro de sueldos') }
  }
}

export async function rrhhLibroSueldosItemsListar(idLibro: number): Promise<{
  success: boolean
  data?: RrhhLibroSueldosItem[]
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  try {
    const { data, error } = await supabase
      .from('rrhh_libro_sueldos_items')
      .select('*')
      .eq('id_libro', idLibro)
      .order('n_legajo', { ascending: true })
    if (error) throw error
    return { success: true, data: (data || []).map((r) => mapItem(r as Record<string, unknown>)) }
  } catch (e) {
    return { success: false, error: err(e, 'Error al listar ítems del libro') }
  }
}

export async function rrhhLibroSueldosItemsReemplazar(
  idLibro: number,
  items: Array<Omit<RrhhLibroSueldosItem, 'id' | 'id_libro'> & { id?: number; id_libro?: number }>
): Promise<{ success: boolean; data?: RrhhLibroSueldosItem[]; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  try {
    const rows = items.map((it) => ({
      id_libro: idLibro,
      id_usuario: it.id_usuario,
      incluido: it.incluido,
      n_legajo: it.n_legajo,
      apellido_nombre: it.apellido_nombre,
      cuil: it.cuil,
      categoria: it.categoria,
      fecha_ingreso: it.fecha_ingreso,
      antiguedad_reconocida: it.antiguedad_reconocida,
      anios_antiguedad: it.anios_antiguedad,
      dias: it.dias,
      etiqueta_basico: it.etiqueta_basico,
      sueldo_basico: it.sueldo_basico,
      adicional_antiguedad: it.adicional_antiguedad,
      scvo: it.scvo,
      banco: it.banco,
      cbu: it.cbu,
      forma_pago: it.forma_pago,
      conyuge: it.conyuge,
      hijos: it.hijos,
      cct: it.cct,
      cct_codigo: it.cct_codigo,
      cobertura_scvo: it.cobertura_scvo,
      situacion_revista: it.situacion_revista,
      condicion: it.condicion,
      actividad: it.actividad,
      modalidad: it.modalidad,
      codigo_os: it.codigo_os,
      horas_trabajadas: it.horas_trabajadas,
      extras: it.extras || [],
      updated_at: new Date().toISOString()
    }))
    const { error: delErr } = await supabase.from('rrhh_libro_sueldos_items').delete().eq('id_libro', idLibro)
    if (delErr) throw delErr
    if (rows.length) {
      const { error: insErr } = await supabase.from('rrhh_libro_sueldos_items').insert(rows)
      if (insErr) throw insErr
    }
    return rrhhLibroSueldosItemsListar(idLibro)
  } catch (e) {
    return { success: false, error: err(e, 'Error al guardar ítems del libro') }
  }
}

export async function rrhhSueldoFichasListar(): Promise<{
  success: boolean
  data?: RrhhSueldoFicha[]
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  try {
    const { data, error } = await supabase.from('rrhh_sueldo_fichas').select('*')
    if (error) throw error
    return { success: true, data: (data || []).map((r) => mapFicha(r as Record<string, unknown>)) }
  } catch (e) {
    return { success: false, error: err(e, 'Error al listar fichas de sueldo') }
  }
}

export async function rrhhSueldoFichasUpsert(fichas: RrhhSueldoFicha[]): Promise<{
  success: boolean
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  if (!fichas.length) return { success: true }
  try {
    const { error } = await supabase.from('rrhh_sueldo_fichas').upsert(
      fichas.map((f) => ({ ...f, updated_at: new Date().toISOString() })),
      { onConflict: 'id_usuario' }
    )
    if (error) throw error
    return { success: true }
  } catch (e) {
    return { success: false, error: err(e, 'Error al guardar fichas de sueldo') }
  }
}
