export interface OrdenLineaM2 {
  id: number
  id_orden: number
  tipo: string
  metros_cuadrados: number
  sort_order: number
  created_at?: string | null
}

/** Fila para reporte PDF de uso de impresoras (metros y horas) */
export interface ImpresoraUsoReportFila {
  id: number
  id_impresora: number
  nombre_impresora: string
  id_orden: number
  fecha_inicio: string
  fecha_fin: string | null
  horas_usadas: number | null
  metros_cuadrados: number | null
  estado: string
  operario: string | null
  numero_op: string | null
  cliente: string | null
  descripcion: string | null
  tipo_impresion_orden: string | null
}

/** Ítem del carrusel de imágenes de la OP (editor + vista solo lectura) */
export interface OpGaleriaSlide {
  url: string
  /** Nombre descriptivo de la foto (en BD puede existir legado `titulo`) */
  nombre: string
}

/** Campos expuestos en /op-public y firma cliente (RPC acotada). */
export interface OrdenSeguimientoPublico {
  id: number
  numero_op: string
  seguimiento_token?: string | null
  cliente: string
  estado: string
  descripcion?: string | null
  fecha_entrega?: string | null
}

export interface OrdenTrabajo {
  id: number
  numero_op: string
  seguimiento_token?: string | null
  cliente: string
  dni_cuit?: string | null
  descripcion?: string | null
  estado: string
  prioridad: string
  fecha_creacion?: string | null
  fecha_entrega?: string | null
  fecha_ingreso?: string | null
  operario_asignado?: string | null
  complejidad?: string | null
  sector?: string | null // Sector único (para compatibilidad)
  sectores?: string[] | null // Array de sectores requeridos
  sector_inicial?: string | null // Sector donde aparece la ficha principal (puede NO estar en sectores[])
  materiales?: string | null
  nombre_creador?: string | null
  foto_url?: string | null
  usuario_trabajando_nombre?: string | null
  telefono_cliente?: string | null
  email_cliente?: string | null
  direccion_cliente?: string | null
  whatsapp_link?: string | null
  ubicacion_link?: string | null
  drive_link?: string | null
  es_duplicado?: boolean | null // Indica si es una ficha duplicada
  id_orden_original?: number | null // ID de la ficha original (si es duplicada)
  ubicacion_final?: string | null // Sector físico previo al pasar a Finalizado en Taller
  entregado?: boolean | null // Indica si la ficha fue entregada y está archivada
  /** Fecha/hora en que se marcó entregada (firma / cierre de entrega) */
  fecha_entrega_efectiva?: string | null
  etiquetas?: string[] | null // Etiquetas de colores
  metros_cuadrados?: number | null // Metros cuadrados para impresión (especialmente en Taller Gráfico)
  /** Tipo o familia de impresión en la OP (texto libre) */
  tipo_impresion?: string | null
  /** Relleno en cliente tras getOrdenes/getOrden: líneas m² por ítem */
  orden_lineas_m2?: OrdenLineaM2[] | null
  etapa_taller_grafico?: string | null // Etapa actual dentro de Taller Gráfico
  etapa_taller_grafico_fecha_inicio?: string | null // Fecha de inicio de la etapa actual
  etapa_instalaciones?: string | null // Etapa actual dentro de Instalaciones
  etapa_instalaciones_fecha_inicio?: string | null // Fecha de inicio de la etapa actual en Instalaciones
  etapa_taller_imprenta?: string | null // Etapa actual dentro de Taller de Imprenta
  etapa_taller_imprenta_fecha_inicio?: string | null // Fecha de inicio de la etapa actual en Taller de Imprenta
  etapa_impresion_digital?: string | null // Etapa en Imprenta (Área de Impresión): En Proceso, Pausa, Fichas técnicas, etc.
  etapa_impresion_digital_fecha_inicio?: string | null // Fecha de inicio de la etapa actual
  etapa_metalurgica?: string | null // Etapa actual dentro de Metalúrgica
  etapa_metalurgica_fecha_inicio?: string | null // Fecha de inicio de la etapa actual en Metalúrgica
  id_pedido_cliente?: number | null // ID del pedido web que originó esta OP
  origen_pedido_web?: boolean | null // Indica si la OP viene de un pedido web
  brief_publico?: string | null // Brief público del proyecto
  objetivo_proyecto?: string | null // Objetivo principal del proyecto
  publico_objetivo?: string | null // Público objetivo del diseño
  estilo_diseno?: string | null // Estilo de diseño requerido
  referencias?: string | null // Referencias visuales o enlaces
  deadline_brief?: string | null // Fecha límite para completar el brief
  estado_revision?: string | null // Estado de revisión: 'pendiente', 'en_revision', 'aprobado', 'requiere_cambios'
  brief_token?: string | null // Token único para acceso público al formulario de brief
  cliente_nombre_completo?: string | null // Nombre completo del cliente (del brief)
  cliente_empresa?: string | null // Empresa/Emprendimiento del cliente
  tipo_producto_servicio?: string[] | null // Array de tipos de productos/servicios seleccionados
  tipo_producto_otro?: string | null // Otro tipo de producto especificado
  necesita_asesoramiento?: boolean | null // Si necesita asesoramiento
  donde_colocados?: string | null // Dónde serán colocados los productos
  digital_o_impresion?: string | null // Si es digital, impresión o ambos
  cantidades?: string | null // Cantidades requeridas
  material_logo?: string | null // Estado del material de logo
  material_textos?: string | null // Estado del material de textos
  material_imagenes?: string | null // Estado del material de imágenes
  tiene_referencias?: boolean | null // Si tiene referencias de estilo
  referencias_links?: string | null // Links o descripción de referencias
  fecha_limite_brief?: string | null // Fecha límite del proyecto
  es_urgencia?: boolean | null // Si es un pedido urgente
  es_ficha_no_op?: boolean | null // Indica si es una ficha No OP (sin número de OP real)
  planilla_preliminar?: boolean | null // Indica si es una planilla preliminar
  ficha_tecnica_pdf_url?: string | null // URL del PDF de la ficha técnica
  ficha_tecnica_cargada?: boolean | null // Indica si la ficha técnica fue cargada (checklist)
  /** Marcado manual: la ficha técnica aún está incompleta */
  ficha_tecnica_incompleta?: boolean | null
  presupuesto_enviado_cliente?: boolean | null // Indica si el presupuesto fue enviado al cliente (checklist)
  /** Presupuestos: checklist "Armado" */
  presupuesto_armado?: boolean | null
  /** Presupuestos: checklist "En espera" */
  presupuesto_en_espera?: boolean | null
  /** Si true, la ficha no debe editarse ni moverse (operario asignado puede destablar; admin/gerencia omiten) */
  op_bloqueada?: boolean | null
  /** OP multi-sector: replicar datos comunes entre fichas del mismo `numero_op` al guardar (todas las filas del grupo comparten el mismo valor). */
  espejo_sectores_op?: boolean | null
  /** false = no listar en tablero; la fila sigue en BD (fusión / unificación sin DELETE) */
  visible_en_tablero?: boolean | null
  /** true = borrado lógico; la fila sigue en BD con motivo_eliminacion */
  eliminada?: boolean | null
  motivo_eliminacion?: string | null
  fecha_eliminacion?: string | null
  /** Número FICHA-* antes de convertir a OP (historial) */
  numero_ficha_original?: string | null
  /** Reclamo: el trabajo debe rehacerse (marca visual en tablero + comentario/historial) */
  en_reclamo?: boolean | null
  /** Motivo del reclamo (texto libre; ver también comentarios_orden) */
  reclamo_motivo?: string | null
  /** Costo monetario extra por reclamo (remake, materiales) — ARS */
  reclamo_costo_monto?: number | null
  /** Etiquetas de causa RRHH (clasificación) */
  reclamo_etiquetas?: string[] | null
  /** Carrusel de imágenes con título (JSON en BD) */
  galeria_carrusel?: OpGaleriaSlide[] | null
}

/** Fila listada en historial de fichas (asesor-presupuestos) */
export interface FichaHistorialItem {
  id: number
  numero_op: string
  cliente: string | null
  estado: string | null
  sector: string | null
  fecha_creacion: string | null
  nombre_creador: string | null
  es_ficha_no_op: boolean | null
  numero_ficha_original: string | null
  descripcion: string | null
}

export interface RevisionOrden {
  id: number
  id_orden: number
  usuario_revisor_id: number
  usuario_revisor_nombre: string
  estado_revision: 'pendiente' | 'en_revision' | 'aprobado' | 'requiere_cambios'
  comentarios: string | null
  fecha_revision: string
  fecha_aprobacion: string | null
}

export interface TrabajoGaleria {
  id: number
  id_orden: number
  numero_op: string
  cliente: string
  titulo: string | null
  descripcion: string | null
  imagen_url: string
  categoria: string | null
  tags: string[] | null
  fecha_completado: string
  usuario_subio_nombre: string | null
  visible_publico: boolean
  destacado: boolean
  created_at: string
}

export interface CategoriaGaleria {
  categoria: string
  cantidad: number
}

export interface RegistroTiempo {
  id: number
  id_orden: number
  usuario_id: number
  usuario_nombre: string
  fecha: string
  hora_inicio: string
  hora_fin: string | null
  tiempo_minutos: number | null
  descripcion: string | null
  tipo_trabajo: 'diseno' | 'revision' | 'correccion' | 'consulta' | 'otro'
  created_at: string
}

export interface TiempoUsuario {
  fecha: string
  total_minutos: number
  registros: number
}

// Subtareas / checklist por ficha
export interface TareaSubitem {
  id: number
  id_orden: number
  titulo: string
  done: boolean
  duracion_estimada_min?: number | null
  tiempo_invertido_seg: number
  iniciado_en?: string | null
  completado_en?: string | null
  creado_en?: string
  actualizado_en?: string
}

/** Notas de relevamiento (app campo Instalaciones / Metalúrgica). */
export interface OrdenRelevamientoRecord {
  id_orden: number
  notas: string
  actualizado_en?: string
  actualizado_por?: string | null
}

/** Checklist de relevamiento, aparte de tarea_subitems. */
export interface RelevamientoSubitemRecord {
  id: number
  id_orden: number
  titulo: string
  done: boolean
  creado_en?: string
  actualizado_en?: string
}

export type UserRole =
  | 'administracion'
  | 'gerencia'
  | 'recursos-humanos'
  | 'diseno'
  | 'imprenta'
  | 'taller-grafico'
  | 'instalaciones'
  | 'metalurgica'
  | 'caja'
  | 'mostrador'
  | 'compras'
  | 'asesor-tecnico'
  | 'presupuestos'
  | 'operario-diseno'
  | 'operario-bolsa'

export interface UsuarioRecord {
  id: number
  nombre: string
  rol: UserRole
}

/** Adjunto de documentación de baja laboral (bucket archivos / rrhh-bajas/). */
export interface RrhhBajaAdjunto {
  url: string
  nombre: string
  mime: string
}

/** Evento formal de hoja de vida laboral (cambio de puesto, reconocimiento, sanción). */
export type RrhhEventoLaboralTipo = 'cambio_puesto' | 'reconocimiento' | 'sancion'

export interface RrhhEventoLaboral {
  id: number
  id_usuario: number
  tipo: RrhhEventoLaboralTipo
  fecha: string
  titulo: string
  descripcion: string | null
  sector_anterior: string | null
  sector_nuevo: string | null
  registrado_por: number | null
  created_at: string
}

/** Registro formal de baja laboral (auditoría RRHH, historial preservado). */
export interface UsuarioBajaLog {
  id: number
  id_usuario: number
  nombre_snapshot: string
  motivo: string
  registrado_por: number | null
  created_at: string
  fecha_desvinculacion: string | null
  tipo_desvinculacion: string | null
  observaciones_finales: string | null
  adjuntos: RrhhBajaAdjunto[]
  rol_snapshot: string | null
}

export interface ProtocoloBaseRecord {
  id: string
  titulo: string
  tipo: 'protocolo' | 'base' | 'otro'
  categoria: string | null
  tags: string[] | null
  archivo_url: string | null
  archivo_nombre: string | null
  file_mime: string | null
  contenido_texto: string | null
  creado_por: number | null
  creado_por_nombre: string | null
  created_at: string
}

/** Pregunta de prueba de conocimiento (RRHH) */
export type PruebaPreguntaTipo = 'multiple_choice' | 'desarrollo' | 'verdadero_falso'

/** Asignación de prueba de conocimiento para un colaborador (legajo / mis pruebas). */
export interface PruebaAsignacionColaborador {
  id_asignacion: string
  id_prueba: string
  titulo: string
  descripcion?: string | null
  tiempo_total_segundos?: number | null
  porcentaje_aprobacion?: number | null
  estado: string
  iniciado_at?: string | null
  finalizado_at?: string | null
  tiempo_limite_fin?: string | null
  puntaje_obtenido?: number | null
  puntaje_maximo?: number | null
  aprobado?: boolean | null
  calificacion_pendiente?: boolean
}

export interface PruebaPreguntaInput {
  orden: number
  texto: string
  tipo: PruebaPreguntaTipo
  tiempo_segundos?: number | null
  /** Puntos que vale la pregunta (mínimo 0.01 en BD) */
  puntos?: number | null
  opciones?: string[]
  indice_correcto?: number | null
}

export interface LegajoEmpleado {
  id?: number
  id_usuario: number
  nombre?: string | null
  apellido?: string | null
  telefono?: string | null
  ubicacion?: string | null
  foto_url?: string | null
  sector?: string | null
  funciones?: string | null
  fecha_ingreso?: string | null
  fecha_nacimiento?: string | null
  dni?: string | null
  direccion?: string | null
  email?: string | null
  estado_civil?: string | null
  contacto_emergencia_nombre?: string | null
  contacto_emergencia_telefono?: string | null
  observaciones?: string | null
  created_at?: string
  updated_at?: string
}

/** Fila de listar_fechas_plot_hoy (cumples / aniversarios de alta hoy, visible para todo el equipo) */
export interface FechaPlotHoyItem {
  id_usuario: number
  nombre_mostrar: string
  cumple_hoy: boolean
  aniversario_empresa_hoy: boolean
  anios_en_empresa: number | null
  /** Foto subida al legajo (RRHH); opcional. */
  foto_url?: string | null
}

export interface ClienteRecord {
  id: number
  nombre: string
  dni_cuit?: string | null
  telefono?: string | null
  email?: string | null
  direccion?: string | null
  ubicacion_link?: string | null
  drive_link?: string | null
  usuario?: string | null
  password_hash?: string | null
  apellido?: string | null
  empresa?: string | null
  activo?: boolean | null
  es_cliente_web?: boolean | null
}

/** Ficha de alta en `clientes_cuenta_corriente` (requisitos fiscales + documentos). */
export interface ClienteCuentaCorrienteRecord {
  id: number
  id_cliente: number
  tipo_cliente?: 'empresa' | 'persona_fisica' | null
  cuit: string | null
  nombre?: string | null
  apellido?: string | null
  razon_social: string | null
  condicion_iva: string | null
  email: string | null
  whatsapp: string | null
  persona_contacto: string | null
  domicilio: string | null
  localidad: string | null
  provincia: string | null
  codigo_postal: string | null
  url_constancia_afip: string | null
  url_estatuto: string | null
  url_comprobante_domicilio: string | null
  url_documento_dni?: string | null
  url_pagare?: string | null
  score?: number | null
  score_nivel?: 'excelente' | 'bueno' | 'regular' | 'riesgo' | 'critico' | null
  score_detalle?: Record<string, unknown> | null
  score_actualizado_at?: string | null
  limite_credito?: number | null
  limite_credito_sugerido?: number | null
  score_ajuste_manual?: number | null
  score_notas_internas?: string | null
  alta_completa: boolean
  estado: 'pendiente' | 'aprobada' | 'rechazada'
  id_usuario_solicita?: number | null
  id_usuario_revisor?: number | null
  revisado_at?: string | null
  motivo_rechazo?: string | null
  saldo_actual?: number | null
  total_cargos?: number | null
  total_pagos?: number | null
  ultimo_pago_at?: string | null
  ultimo_movimiento_at?: string | null
  porcentaje_interes_mensual?: number | null
  porcentaje_interes_mora_mensual?: number | null
  dias_gracia?: number | null
  created_at?: string
  updated_at?: string | null
}

export type CcMovimientoTipo = 'venta' | 'pago' | 'ajuste' | 'interes'

export interface CcInteresDevengadoItem {
  id_movimiento?: number
  id_venta?: number | null
  numero_venta?: string
  concepto?: string
  debe?: number
  fecha_vencimiento?: string
  dias_mora?: number
  tasa_mensual?: number
  interes_calculado?: number
  ya_registrado?: boolean
}

export interface CcInteresesDevengados {
  tasa_mora_mensual: number
  dias_gracia: number
  periodo: string
  total_devengado: number
  items: CcInteresDevengadoItem[]
}

export interface CcCuentaMovimiento {
  id: number
  id_cliente: number
  tipo: CcMovimientoTipo
  id_venta?: number | null
  fecha: string
  fecha_vencimiento?: string | null
  concepto: string
  debe: number
  haber: number
  saldo_acumulado?: number
  url_comprobante?: string | null
  metodo_pago?: string | null
  referencia?: string | null
  notas?: string | null
  id_usuario?: number | null
  metadata?: Record<string, unknown>
  created_at?: string
}

export interface CcVentaResumen {
  id: number
  numero_venta: string
  valor_total: number
  estado_pago: string
  metodo_pago: string | null
  fecha_venta: string
  comprobante_pago_url?: string | null
  observaciones?: string | null
  id_vendedor?: number | null
  nombre_vendedor?: string | null
  monto_pagado?: number | null
  monto_pendiente?: number | null
  fecha_vencimiento?: string | null
  dias_vencido?: number | null
  bucket?: CcCobranzaAgingBucket | null
}

export interface CcPerfilResumen {
  saldo_actual: number
  total_cargos: number
  total_pagos: number
  ultimo_pago_at?: string | null
  limite_credito?: number | null
  limite_credito_sugerido?: number | null
  score?: number | null
  score_nivel?: string | null
  porcentaje_interes_mensual?: number | null
  porcentaje_interes_mora_mensual?: number | null
  dias_gracia?: number | null
  tasa_mora_vigente?: number | null
  intereses_devengados?: CcInteresesDevengados | null
  ventas_pendientes: number
  monto_pendiente_ventas: number
}

export interface CcPerfilCliente {
  ficha: ClienteCuentaCorrienteRecord
  resumen: CcPerfilResumen
  movimientos: CcCuentaMovimiento[]
  ventas_cc: CcVentaResumen[]
}

export type CcCobranzaAgingBucket = 'al_dia' | '1_30' | '31_60' | '61_90' | '90_mas'

export interface CcCobranzaVentaItem {
  id_venta: number
  numero_venta: string
  id_cliente: number
  cliente_nombre: string
  valor_total: number
  monto_pendiente: number
  estado_pago: string
  fecha_venta: string
  fecha_vencimiento: string
  dias_vencido: number
  bucket: CcCobranzaAgingBucket
  id_vendedor: number | null
  nombre_vendedor: string
}

export interface CcCobranzaVendedorResumen {
  id_vendedor: number | null
  nombre_vendedor: string
  ventas_count: number
  monto_pendiente: number
  ventas_pendientes: number
}

export interface CcCobranzasPanelData {
  ventas_abiertas: CcCobranzaVentaItem[]
  por_vendedor: CcCobranzaVendedorResumen[]
  aging: Record<CcCobranzaAgingBucket, { count: number; monto: number }>
  cobrado_mes: number
  pagos_mes_count: number
  total_por_cobrar: number
  total_vencido: number
  clientes_con_deuda: number
  tasa_cobranza_mes: number
  top_clientes: CcCobranzaClienteResumen[]
  pagos_recientes: CcCobranzaPagoReciente[]
}

export interface CcCobranzaClienteResumen {
  id_cliente: number
  cliente_nombre: string
  ventas_abiertas: number
  monto_pendiente: number
  peor_dias_vencido: number
}

export interface CcCobranzaPagoReciente {
  id_movimiento: number
  fecha: string
  monto: number
  id_cliente: number
  cliente_nombre: string
  concepto?: string | null
  url_comprobante?: string | null
}

export type AltaCuentaCorrientePayload = {
  tipo_cliente?: 'empresa' | 'persona_fisica'
  nombre?: string
  apellido?: string
  cuit: string
  razon_social: string
  condicion_iva: string
  email: string
  whatsapp: string
  persona_contacto: string
  domicilio: string
  localidad: string
  provincia: string
  codigo_postal: string
  url_constancia_afip: string
  url_estatuto: string
  url_comprobante_domicilio: string
  url_documento_dni?: string
  url_pagare?: string
  id_cliente?: number | null
  id_usuario_solicita: number
}

// ============================================
// SISTEMA DE PEDIDOS WEB
// ============================================

export interface ClienteWebRecord {
  id: number
  usuario: string
  nombre: string
  apellido?: string | null
  empresa?: string | null
  telefono?: string | null
  email?: string | null
  dni_cuit?: string | null
  direccion?: string | null
  activo: boolean
  created_at?: string
  updated_at?: string
}

export type ModoVentaArticulo = 'compra' | 'cotizacion' | 'ambos'

export type TipoIntencionPedido = 'compra' | 'cotizacion'

export type CanalComercialCatalogo = 'portal' | 'web_publica' | 'totem' | 'stickers'

export interface ArticuloEmpresaRecord {
  id: number
  codigo: string
  nombre: string
  descripcion?: string | null
  categoria?: string | null
  subcategoria?: string | null
  precio_base?: number | null
  precio_lista_1?: number | null
  precio_lista_2?: number | null
  precio_lista_3?: number | null
  precio_lista_4?: number | null
  precio_lista_5?: number | null
  activo: boolean
  imagen_url?: string | null
  tiempo_estimado_dias?: number | null
  requiere_archivos: boolean
  /** Compatibilidad: sincronizar con visible_portal al guardar */
  visible_clientes: boolean
  id_articulo_stock?: number | null
  modo_venta?: ModoVentaArticulo | null
  controla_stock?: boolean | null
  unidades_por_venta?: number | null
  visible_portal?: boolean | null
  visible_web_publica?: boolean | null
  visible_totem?: boolean | null
  visible_stickers?: boolean | null
  /** Solo lectura en listados: stock disponible si hay enlace */
  stock_disponible?: number | null
  created_at?: string
  updated_at?: string
}

export interface CamposComercioArticuloEmpresa {
  id_articulo_stock?: number | null
  modo_venta?: ModoVentaArticulo
  controla_stock?: boolean
  unidades_por_venta?: number
  visible_portal?: boolean
  visible_web_publica?: boolean
  visible_totem?: boolean
  visible_stickers?: boolean
  visible_clientes?: boolean
}

export interface ArticuloEmpresaImagenRecord {
  id: number
  id_articulo: number
  imagen_url: string
  orden: number
  created_at?: string
}

export interface PedidoClienteRecord {
  id: number
  id_cliente: number
  numero_pedido: string
  estado: 'pendiente' | 'en_revision' | 'aprobado' | 'rechazado' | 'convertido_parcial' | 'convertido_completo' | 'cancelado'
  id_op_asociada?: number | null
  id_venta_asociada?: number | null
  numero_op?: string | null
  estado_op?: string | null
  fecha_pedido: string
  fecha_limite_deseada?: string | null
  observaciones_cliente?: string | null
  observaciones_internas?: string | null
  precio_total: number
  tipo_intencion?: TipoIntencionPedido | null
  es_urgente?: boolean
  requiere_delivery?: boolean
  direccion_delivery?: string | null
  tipo_producto_servicio?: string[] | null
  tipo_producto_otro?: string | null
  necesita_asesoramiento?: boolean
  donde_colocados?: string | null
  digital_o_impresion?: string | null
  cantidades?: string | null
  objetivo_proyecto?: string | null
  material_logo?: string | null
  material_textos?: string | null
  material_imagenes?: string | null
  tiene_referencias?: boolean
  referencias_links?: string | null
  brief_publico?: string | null
  estilo_diseno?: string | null
  referencias?: string | null
  created_at?: string
  updated_at?: string
}

export interface MensajePedidoClienteRecord {
  id: number
  id_pedido_cliente: number
  id_cliente: number
  id_usuario?: number | null
  mensaje: string
  es_del_cliente: boolean
  leido: boolean
  fecha_creacion: string
  nombre_usuario?: string | null
}

export type EstadoPresupuestoCliente = 'borrador' | 'enviado' | 'aceptado' | 'rechazado' | 'cancelado' | 'convertido'

export interface PresupuestoClienteRecord {
  id: number
  id_cliente: number
  numero_presupuesto: string
  estado: EstadoPresupuestoCliente
  fecha_creacion: string
  fecha_envio?: string | null
  fecha_respuesta?: string | null
  fecha_vencimiento?: string | null
  observaciones_cliente?: string | null
  observaciones_internas?: string | null
  precio_total: number
  id_pedido_asociado?: number | null
  id_op_asociada?: number | null
  created_at?: string
  updated_at?: string
}

export interface PresupuestoClienteItemRecord {
  id: number
  id_presupuesto: number
  id_articulo: number
  cantidad: number
  precio_unitario: number
  precio_total: number
  descripcion_personalizada?: string | null
  created_at?: string
  updated_at?: string
  articulo?: ArticuloEmpresaRecord
}

// Presupuestos de ventas presenciales (CRM/Mostrador)
export interface PresupuestoVentaRecord {
  id: number
  id_cliente?: number | null
  numero_presupuesto: string
  estado: EstadoPresupuestoCliente
  fecha_creacion: string
  fecha_envio?: string | null
  fecha_respuesta?: string | null
  fecha_vencimiento?: string | null
  observaciones_cliente?: string | null
  observaciones_internas?: string | null
  precio_total: number
  id_op_asociada?: number | null
  id_venta_asociada?: number | null
  id_vendedor?: number | null
  nombre_vendedor?: string | null
  cliente_nombre?: string | null
  cliente_telefono?: string | null
  cliente_email?: string | null
  cliente_dni_cuit?: string | null
  cliente_empresa?: string | null
  cliente_direccion?: string | null
  tipo_lista_precio?: 'lista_1' | 'lista_2' | null
  created_at?: string
  updated_at?: string
}

export interface PresupuestoVentaItemRecord {
  id: number
  id_presupuesto: number
  id_articulo_stock?: number | null
  codigo_articulo?: string | null
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento: number
  precio_total: number
  observaciones?: string | null
  created_at?: string
}

// ============================================
// SISTEMA ERP
// ============================================

export interface PlanCuentaRecord {
  id: number
  codigo: string
  nombre: string
  tipo: 'Activo' | 'Pasivo' | 'Patrimonio' | 'Ingreso' | 'Costo' | 'Gasto' | 'Cuenta de Orden'
  nivel: number
  cuenta_padre_id?: number | null
  naturaleza: 'Deudora' | 'Acreedora'
  activa: boolean
  created_at?: string
  updated_at?: string
}

export interface AsientoContableRecord {
  id: number
  numero_asiento: string
  fecha: string
  concepto: string
  tipo_asiento: 'Manual' | 'Automático' | 'Facturación' | 'Compra' | 'Pago' | 'Cobro' | 'Ajuste'
  id_origen?: number | null
  tipo_origen?: string | null
  total_debe: number
  total_haber: number
  estado: 'Borrador' | 'Contabilizado' | 'Anulado'
  id_usuario?: number | null
  observaciones?: string | null
  created_at?: string
  updated_at?: string
}

export interface AsientoDetalleRecord {
  id: number
  id_asiento: number
  id_cuenta: number
  debe: number
  haber: number
  concepto?: string | null
  created_at?: string
}

export interface FacturaVentaRecord {
  id: number
  numero_factura: string
  punto_venta: number
  numero_comprobante: number
  tipo_comprobante: 'Factura A' | 'Factura B' | 'Factura C' | 'Nota de Crédito A' | 'Nota de Crédito B' | 'Nota de Crédito C' | 'Nota de Débito A' | 'Nota de Débito B' | 'Nota de Débito C'
  fecha_emision: string
  fecha_vencimiento?: string | null
  id_cliente?: number | null
  cliente_nombre: string
  cliente_dni_cuit?: string | null
  cliente_direccion?: string | null
  cliente_condicion_iva?: 'Responsable Inscripto' | 'Monotributista' | 'Exento' | 'Consumidor Final' | 'No Responsable' | null
  id_op?: number | null
  numero_op?: string | null
  id_venta?: number | null
  id_factura_referencia?: number | null
  subtotal: number
  descuento: number
  iva: number
  total: number
  estado: 'Borrador' | 'Emitida' | 'Anulada' | 'Cancelada'
  estado_afip?: 'Pendiente' | 'Autorizada' | 'Rechazada' | 'Error' | 'Enviando' | null
  cae?: string | null
  numero_cae?: string | null
  fecha_vencimiento_cae?: string | null
  resultado_afip?: string | null
  codigo_resultado_afip?: string | null
  fecha_autorizacion_afip?: string | null
  id_asiento_contable?: number | null
  id_usuario?: number | null
  observaciones?: string | null
  created_at?: string
  updated_at?: string
}

export interface FacturaItemRecord {
  id: number
  id_factura: number
  item_numero: number
  descripcion: string
  cantidad: number
  unidad_medida?: string | null
  precio_unitario: number
  descuento: number
  iva_porcentaje: number
  iva_monto: number
  subtotal: number
  total: number
  id_articulo?: number | null
  created_at?: string
}

export interface FacturaCompraRecord {
  id: number
  tipo_comprobante: 'Factura' | 'Nota de Crédito' | 'Nota de Débito'
  letra: 'A' | 'B' | 'C'
  punto_venta: number
  numero_comprobante: number
  numero_factura: string
  fecha_emision: string
  id_proveedor?: number | null
  proveedor_nombre: string
  proveedor_cuit?: string | null
  subtotal: number
  iva: number
  total: number
  observaciones?: string | null
  id_pedido_compra?: number | null
  id_cuenta_por_pagar?: number | null
  id_usuario?: number | null
  created_at?: string
  updated_at?: string
}

export interface FacturaCompraItemRecord {
  id: number
  id_factura: number
  item_numero: number
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento: number
  iva_porcentaje: number
  iva_monto: number
  subtotal: number
  total: number
  created_at?: string
}

export interface CostoOPRecord {
  id: number
  id_op: number
  numero_op: string
  tipo_costo: 'Materiales' | 'Mano de Obra' | 'Gastos Generales' | 'Subcontratación' | 'Otros'
  concepto: string
  cantidad: number
  costo_unitario: number
  costo_total: number
  id_material?: number | null
  id_usuario?: number | null
  fecha_costo: string
  observaciones?: string | null
  created_at?: string
  updated_at?: string
}

export interface CuentaPorCobrarRecord {
  id: number
  id_factura: number
  id_cliente?: number | null
  cliente_nombre: string
  monto_total: number
  monto_pagado: number
  monto_pendiente: number
  fecha_emision: string
  fecha_vencimiento?: string | null
  estado: 'Pendiente' | 'Parcial' | 'Pagado' | 'Vencido' | 'Cancelado'
  observaciones?: string | null
  created_at?: string
  updated_at?: string
}

export interface CuentaPorPagarRecord {
  id: number
  id_pedido_compra?: number | null
  id_proveedor?: number | null
  proveedor_nombre: string
  numero_documento?: string | null
  monto_total: number
  monto_pagado: number
  monto_pendiente: number
  fecha_emision: string
  fecha_vencimiento?: string | null
  estado: 'Pendiente' | 'Parcial' | 'Pagado' | 'Vencido' | 'Cancelado'
  observaciones?: string | null
  created_at?: string
  updated_at?: string
}

export interface PagoCobroRecord {
  id: number
  tipo: 'Pago' | 'Cobro'
  id_cuenta_por_cobrar?: number | null
  id_cuenta_por_pagar?: number | null
  monto: number
  fecha_pago: string
  metodo_pago: 'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Cheque' | 'Depósito' | 'Otro'
  numero_comprobante?: string | null
  id_cuenta_bancaria?: number | null
  id_asiento_contable?: number | null
  observaciones?: string | null
  id_usuario?: number | null
  created_at?: string
}

export interface StockDepositoRecord {
  id: number
  nombre: string
  codigo?: string | null
  activo: boolean
  created_at?: string
  updated_at?: string
}

export interface StockSaldoDepositoRow {
  id_deposito: number
  deposito_nombre: string
  deposito_codigo?: string | null
  cantidad: number
}

export interface CuentaBancariaRecord {
  id: number
  nombre: string
  banco?: string | null
  tipo?: string | null
  moneda: string
  activa: boolean
  saldo_inicial: number
  created_at?: string
  updated_at?: string
}

export interface ConfiguracionAFIPRecord {
  id: number
  cuit: string
  punto_venta: number
  razon_social: string
  domicilio_comercial?: string | null
  condicion_iva: string
  ingresos_brutos?: string | null
  fecha_inicio_actividades?: string | null
  actividad_principal?: string | null
  certificado_afip?: string | null
  clave_certificado?: string | null
  /** Indicador: hay certificado cargado en servidor (sin exponer el archivo). */
  tiene_certificado?: boolean
  webservice: 'wsfev1' | 'wsmtxca' | 'wsfexv1' // wsmtxca recomendado para facturas con items
  ambiente: 'Testing' | 'Homologación' | 'Producción'
  homologacion_aprobada: boolean
  fecha_aprobacion_homologacion?: string | null
  numero_expediente_homologacion?: string | null
  url_wsaa_testing?: string | null
  url_wsaa_produccion?: string | null
  url_wsmtxca_testing?: string | null
  url_wsmtxca_produccion?: string | null
  token_afip?: string | null
  sign_afip?: string | null
  token_expira_en?: string | null
  ultimo_numero_factura_a: number
  ultimo_numero_factura_b: number
  ultimo_numero_factura_c: number
  activo: boolean
  created_at?: string
  updated_at?: string
}

export interface PedidoClienteItemRecord {
  id: number
  id_pedido: number
  id_articulo: number
  cantidad: number
  precio_unitario: number
  precio_total: number
  descripcion_personalizada?: string | null
  created_at?: string
  updated_at?: string
}

export interface PedidoClienteArchivoRecord {
  id: number
  id_pedido: number
  id_item?: number | null
  url: string
  nombre_archivo: string
  tipo?: string | null
  tamaño?: number | null
  uploaded_at?: string
}

export interface PedidoClienteDetalle {
  pedido: PedidoClienteRecord & {
    cliente: ClienteWebRecord
  }
  items: Array<PedidoClienteItemRecord & {
    articulo: ArticuloEmpresaRecord
  }>
  archivos: PedidoClienteArchivoRecord[]
}

export interface SectorRecord {
  id: number
  nombre: string
  color?: string | null
  activo?: boolean | null
}

export type TipoNovedad = 'general' | 'problema' | 'mejora' | 'incidente' | 'reunion' | 'capacitacion' | 'otro'

export interface ActaSectorRecord {
  id: number
  id_sector: number
  sector_nombre: string
  fecha: string
  usuario_id: number | null
  usuario_nombre: string
  titulo: string
  contenido: string
  tipo_novedad: TipoNovedad
  created_at: string
  updated_at: string
}

export interface MaterialRecord {
  id: number
  codigo?: string | null
  descripcion: string
  stock?: number | null // Cantidad disponible en stock
}

export interface HistorialEtapaInstalaciones {
  id: number
  id_orden: number
  etapa_anterior?: string | null
  etapa_nueva: string
  id_usuario?: number | null
  nombre_usuario?: string | null
  comentario?: string | null
  fecha_cambio: string
  fecha_inicio_etapa: string
  fecha_fin_etapa?: string | null
  tiempo_en_etapa_seg?: number | null
  tiempo_formateado?: string | null
}

export interface HistorialEtapaTallerImprenta {
  id: number
  id_orden: number
  etapa_anterior?: string | null
  etapa_nueva: string
  id_usuario?: number | null
  nombre_usuario?: string | null
  comentario?: string | null
  fecha_cambio: string
  fecha_inicio_etapa: string
  fecha_fin_etapa?: string | null
  tiempo_en_etapa_seg?: number | null
  tiempo_formateado?: string | null
}

export interface HistorialEtapaMetalurgica {
  id: number
  id_orden: number
  etapa_anterior?: string | null
  etapa_nueva: string
  id_usuario?: number | null
  nombre_usuario?: string | null
  comentario?: string | null
  fecha_cambio: string
  fecha_inicio_etapa: string
  fecha_fin_etapa?: string | null
  tiempo_en_etapa_seg?: number | null
  tiempo_formateado?: string | null
}

export interface HistorialEtapaTallerGrafico {
  id: number
  id_orden: number
  etapa_anterior?: string | null
  etapa_nueva: string
  id_usuario?: number | null
  nombre_usuario?: string | null
  comentario?: string | null
  fecha_cambio: string
  fecha_inicio_etapa: string
  fecha_fin_etapa?: string | null
  tiempo_en_etapa_seg?: number | null
  tiempo_formateado?: string | null
}

export interface HistorialMovimiento {
  id: number
  id_orden: number
  estado_anterior: string | null
  estado_nuevo: string | null
  id_usuario: number
  nombre_usuario?: string | null
  timestamp: string
  comentario?: string | null
  accion_tipo?: string | null
  cambios_detallados?: any
}

export interface ChatMessage {
  id: number
  room_id: number
  id_usuario: number
  nombre_usuario?: string
  mensaje: string
  tipo?: 'message' | 'alert' | 'buzz'
  timestamp: string
}

export interface ComentarioOrden {
  id: number
  id_orden: number
  comentario: string
  usuario_nombre: string
  mencionados?: any
  timestamp: string
}

export interface Notification {
  id: number
  user_id: number
  title: string
  description: string | null
  type: 'info' | 'success' | 'warning' | 'error' | 'mention'
  /** sistema | rrhh_masivo (notificador masivo en /rrhh/notificaciones) */
  origen?: string | null
  orden_id: number | null
  pedido_id: number | null
  solicitud_id?: number | null
  solicitud_chat_id?: number | null
  capacitacion_id?: number | null
  oportunidad_id?: number | null
  venta_id?: number | null
  reclamo_id?: number | null
  /** Canal del chat interno donde se publicó el aviso (ej. tótem / crear_atencion_mostrador). */
  chat_canal?: string | null
  is_read: boolean
  timestamp: string
}

export interface TareaRecord {
  id: number
  id_orden: number
  descripcion_tarea: string
  estado_kanban: 'Pendiente' | 'En Proceso' | 'Finalizado'
  sector?: string | null
  es_sub_tarea?: boolean
}

// ============================================
// SISTEMA DE HORARIOS Y TURNOS
// ============================================

export interface HorarioEmpleado {
  id: number
  id_usuario: number
  tipo_horario: 'fijo' | 'flexible' | 'turnos'
  dia_semana: number | null // 0=Domingo, 1=Lunes, ..., 6=Sábado
  hora_entrada: string | null // time format
  hora_salida: string | null // time format
  horas_semanales: number | null
  activo: boolean
  fecha_inicio: string | null
  fecha_fin: string | null
  observaciones: string | null
  created_at: string
  updated_at: string
}

export interface Turno {
  id: number
  id_usuario: number
  nombre_usuario?: string
  fecha: string
  hora_entrada: string // time format
  hora_salida: string // time format
  tipo_turno: 'normal' | 'extra' | 'nocturno'
  observaciones: string | null
  created_at: string
  updated_at: string
}

export interface Ausencia {
  id: number
  id_usuario: number
  nombre_usuario?: string
  tipo_ausencia: 'vacaciones' | 'licencia' | 'inasistencia' | 'permiso' | 'enfermedad'
  fecha_inicio: string
  fecha_fin: string
  dias: number
  motivo: string | null
  estado: 'pendiente' | 'aprobado' | 'rechazado'
  aprobado_por: number | null
  aprobado_por_nombre?: string | null
  fecha_aprobacion: string | null
  observaciones: string | null
  created_at: string
  updated_at: string
}

export interface Asistencia {
  id: number
  id_usuario: number
  nombre_usuario?: string
  fecha: string
  hora_entrada: string | null
  hora_salida: string | null
  horas_trabajadas: number | null
  tipo_registro: 'normal' | 'tarde' | 'ausente' | 'justificado'
  observaciones: string | null
  created_at: string
  updated_at: string
}

/** Reporte semanal guardado del importador de reloj biométrico. */
export interface RrhhRelojReporteSemanal {
  id: number
  periodo_desde: string
  periodo_hasta: string
  archivo_nombre: string | null
  payload: Record<string, unknown>
  registrado_por: number | null
  created_at: string
  updated_at: string
}

/** Grupo de categoría para novedades RRHH (liquidación / reportes). */
export type RrhhNovedadGrupo =
  | 'falta'
  | 'tardanza_retiro'
  | 'licencia'
  | 'horas_extra'
  | 'beneficio_comida'
  | 'parte_diario'
  | 'anticipacion_sueldo'

/** Código cerrado para filtros exactos. */
export type RrhhNovedadCodigo =
  | 'perdida_beneficio_comida'
  | 'falta_justificada_enfermedad'
  | 'falta_justificada_tramites'
  | 'falta_injustificada'
  | 'tardanza'
  | 'retiro_anticipado'
  | 'licencia_vacaciones'
  | 'licencia_examen'
  | 'licencia_maternidad'
  | 'licencia_paternidad'
  | 'licencia_casamiento'
  | 'licencia_otro'
  | 'horas_extra_50'
  | 'horas_extra_100'
  | 'parte_diario'
  | 'anticipacion_sueldo'

export interface RrhhNovedadAdjunto {
  url: string
  nombre: string
  mime: string
}

export interface RrhhNovedad {
  id: number
  id_usuario: number
  id_solicitud_permiso: number | null
  grupo: RrhhNovedadGrupo
  codigo: RrhhNovedadCodigo | string
  fecha_desde: string
  fecha_hasta: string
  duracion_minutos: number | null
  horas_extra_cantidad: number | null
  observaciones: string | null
  adjuntos: RrhhNovedadAdjunto[]
  registrado_por: number | null
  firma_data_url: string | null
  firmado_at: string | null
  created_at: string
  updated_at: string
}

export type RrhhPostulacionEstado =
  | 'nuevo'
  | 'en_revision'
  | 'entrevista'
  | 'aprobado'
  | 'descartado'

export interface RrhhPostulacion {
  id: number
  legacy_id?: number | null
  nombre: string
  email: string
  telefono: string | null
  puesto: string
  categoria_puesto: string | null
  mensaje: string | null
  cv_url: string
  cv_nombre: string | null
  cv_mime: string | null
  estado: RrhhPostulacionEstado
  metadata_ia: Record<string, unknown>
  score_ia: number | null
  notas_rrhh: string | null
  created_at: string
  updated_at: string
  revisado_por: number | null
  revisado_at: string | null
}

export interface SolicitudPermiso {
  id: number
  id_usuario: number
  nombre_usuario?: string
  tipo_solicitud: 'turno' | 'ausencia' | 'vacaciones' | 'ropa' | 'permiso' | 'otro'
  titulo: string
  descripcion: string | null
  fecha_solicitud: string
  fecha_inicio: string | null
  fecha_fin: string | null
  dias_solicitados: number | null
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'cancelado'
  aprobado_por: number | null
  aprobado_por_nombre?: string | null
  fecha_aprobacion: string | null
  motivo_rechazo: string | null
  observaciones: string | null
  archivo_adjunto_url: string | null
  created_at: string
  updated_at: string
}

export interface Evaluacion {
  id: number
  id_usuario_evaluado: number
  nombre_evaluado?: string
  id_usuario_evaluador: number
  nombre_evaluador?: string
  tipo_evaluacion: 'anual' | 'semestral' | 'trimestral' | 'mensual' | 'periodo_prueba' | 'especial'
  periodo_evaluacion: string
  fecha_evaluacion: string
  fecha_inicio_periodo: string | null
  fecha_fin_periodo: string | null
  calificacion_general: number | null
  estado: 'borrador' | 'completada' | 'revisada' | 'aprobada'
  comentarios_evaluador: string | null
  comentarios_evaluado: string | null
  objetivos_cumplidos: string | null
  areas_mejora: string | null
  recomendaciones: string | null
  aprobado_por: number | null
  aprobado_por_nombre?: string | null
  fecha_aprobacion: string | null
  created_at: string
  updated_at: string
}

export interface CriterioEvaluacion {
  id: number
  id_evaluacion: number
  criterio: string
  descripcion: string | null
  calificacion: number
  peso: number
  comentarios: string | null
  created_at: string
}

export interface Capacitacion {
  id: number
  titulo: string
  descripcion: string | null
  tipo_capacitacion: 'presencial' | 'virtual' | 'mixta' | 'online'
  categoria: string | null
  duracion_horas: number | null
  fecha_inicio: string | null
  fecha_fin: string | null
  fecha_limite_inscripcion: string | null
  cupo_maximo: number | null
  lugar: string | null
  link_virtual: string | null
  instructor: string | null
  estado: 'planificada' | 'abierta' | 'en_curso' | 'completada' | 'cancelada'
  es_obligatoria: boolean
  requiere_aprobacion: boolean
  material_adjunto_url: string | null
  observaciones: string | null
  creado_por: number
  creado_por_nombre?: string
  inscripciones_count?: number
  cupos_disponibles?: number | null
  usuario_inscrito?: boolean
  estado_inscripcion?: string | null
  asistio?: boolean
  calificacion?: number | null
  fecha_inscripcion?: string
  created_at: string
  updated_at: string
}

export interface InscripcionCapacitacion {
  id: number
  id_capacitacion: number
  id_usuario: number
  nombre_usuario?: string
  fecha_inscripcion: string
  estado: 'pendiente' | 'inscrito' | 'aprobado' | 'rechazado' | 'completado' | 'ausente' | 'cancelado'
  asistio: boolean
  calificacion: number | null
  comentarios: string | null
  aprobado_por: number | null
  aprobado_por_nombre?: string | null
  fecha_aprobacion: string | null
  motivo_rechazo: string | null
  created_at: string
  updated_at: string
}

export interface MenuPlato {
  id: number
  nombre_plato: string
  orden: number
}

export interface MenuDiario {
  id: number
  fecha: string
  creado_por: number
  creado_por_nombre?: string
  platos: MenuPlato[]
  total_selecciones?: number
  created_at: string
  updated_at: string
}

export interface MenuSeleccion {
  id: number
  id_menu: number
  id_usuario: number
  nombre_usuario?: string
  id_plato: number
  nombre_plato?: string
  fecha_seleccion: string
  created_at: string
  /** 1: 13:30–14:15, 2: 14:20–15:00, 3: 15:05–15:45 */
  turno_almuerzo: number
  emoji_estado: string
}

/** Descuento acumulativo por pedido de menú con pérdida del beneficio de comida. */
export interface MenuDescuentoBeneficioComida {
  id: number
  id_usuario: number
  nombre_usuario?: string
  id_menu: number
  id_seleccion: number | null
  id_novedad: number | null
  fecha: string
  monto: number
  nombre_plato: string | null
  created_at: string
}

export interface MenuDescuentoBeneficioResumen {
  id_usuario: number
  nombre_usuario: string
  cantidad_pedidos: number
  total_monto: number
  fecha_desde_novedad: string | null
  fecha_hasta_novedad: string | null
}

/** Solicitud de intercambio de turno de almuerzo (menú diario) */
export interface MenuIntercambioTurno {
  id: number
  id_menu: number
  id_solicita: number
  id_destino: number
  nombre_solicita?: string | null
  nombre_destino?: string | null
  estado: 'pendiente' | 'aceptada' | 'rechazada' | 'cancelada'
  created_at: string
  updated_at: string
}

// ============================================
// SISTEMA CRM DE VENTAS
// ============================================

export type EtapaOportunidad = 'Prospecto' | 'Calificación' | 'Propuesta' | 'Negociación' | 'Cerrado' | 'Perdido'
export type TipoSeguimiento = 'Llamada' | 'Email' | 'Reunión' | 'WhatsApp' | 'Visita' | 'Propuesta' | 'Otro'
export type MetodoPago = 'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Cheque' | 'Cuenta Corriente' | 'Otro'
export type EstadoPago = 'Pendiente' | 'Parcial' | 'Pagado' | 'Cancelado'

export interface OportunidadVenta {
  id: number
  numero_oportunidad: string
  cliente_nombre: string
  cliente_telefono?: string | null
  cliente_email?: string | null
  cliente_dni_cuit?: string | null
  cliente_empresa?: string | null
  cliente_direccion?: string | null
  descripcion?: string | null
  valor_estimado?: number | null
  probabilidad_cierre: number
  etapa: EtapaOportunidad
  fecha_cierre_estimada?: string | null
  id_vendedor: number
  nombre_vendedor: string
  id_op?: number | null
  numero_op?: string | null
  observaciones?: string | null
  activo: boolean
  created_at: string
  updated_at: string
  seguimientos?: SeguimientoVenta[]
}

export interface SeguimientoVenta {
  id: number
  id_oportunidad: number
  tipo_seguimiento: TipoSeguimiento
  descripcion: string
  fecha_seguimiento: string
  proxima_accion?: string | null
  fecha_proxima_accion?: string | null
  id_usuario: number
  nombre_usuario: string
  created_at: string
}

export interface Venta {
  id: number
  numero_venta: string
  id_oportunidad?: number | null
  /** Cliente del catálogo (venta rápida / CRM) */
  id_cliente?: number | null
  /** Pedido web origen (portal/tótem) — usar convertir_pedido_a_op al generar OP */
  id_pedido_cliente?: number | null
  cliente_nombre: string
  cliente_telefono?: string | null
  cliente_email?: string | null
  cliente_dni_cuit?: string | null
  cliente_empresa?: string | null
  cliente_direccion?: string | null
  id_op?: number | null
  numero_op?: string | null
  valor_total: number
  metodo_pago?: MetodoPago | null
  estado_pago: EstadoPago
  /** Monto ya cobrado (ventas parciales → sync caja). */
  monto_pagado?: number | null
  /** Caja donde se registró el cobro en mostrador. */
  caja_slug_cobro?: string | null
  fecha_venta: string
  id_vendedor: number
  nombre_vendedor: string
  observaciones?: string | null
  /** URL del comprobante de pago (imagen/PDF) en Storage */
  comprobante_pago_url?: string | null
  created_at: string
  updated_at: string
  items?: VentaItem[]
}

export interface VentaItem {
  id: number
  id_venta: number
  id_articulo_stock?: number | null
  codigo_articulo?: string | null
  descripcion: string
  cantidad: number
  precio_unitario: number
  precio_total: number
  descuento?: number | null
  observaciones?: string | null
  created_at: string
}

// ============================================
// SISTEMA DE GESTIÓN DE FLOTA
// ============================================

/** Estado del vehículo en el parque (no confundir con estado de un viaje en registros_salidas). */
export type VehiculoEstadoParque = 'disponible' | 'fuera_servicio' | 'en_taller' | 'otro'

export interface Vehiculo {
  id: number
  nombre: string
  patente?: string | null
  activo: boolean
  estado_parque?: VehiculoEstadoParque | null
  estado_parque_detalle?: string | null
  created_at: string
  updated_at: string
}

export type ReservaVehiculoFlotaEstado =
  | 'pendiente_aprobacion'
  | 'aprobada'
  | 'rechazada'
  | 'cancelada'

export interface ReservaVehiculoFlota {
  id: number
  id_vehiculo: number
  id_usuario?: number | null
  nombre_usuario: string
  /** YYYY-MM-DD (día calendario en uso operativo AR) */
  fecha: string
  /** HH:MM:SS (zona operativa AR, mismo día que fecha) */
  hora_desde?: string | null
  /** HH:MM:SS inclusive */
  hora_hasta?: string | null
  estado: ReservaVehiculoFlotaEstado
  motivo?: string | null
  id_usuario_reviso?: number | null
  nombre_revisor?: string | null
  revisado_at?: string | null
  created_at: string
  updated_at: string
  vehiculo?: Vehiculo
}

export interface RegistroSalidaVehiculo {
  id: number
  id_vehiculo: number
  id_usuario?: number | null
  nombre_usuario: string
  sector: string
  km_aproximado?: number | null
  numero_op?: string | null
  motivo_salida: string
  hora_salida: string
  hora_estimada_llegada?: string | null
  hora_llegada_real?: string | null
  /** Combustible que queda en el tanque al marcar llegada (litros) */
  litros_combustible_llegada?: number | null
  /** Indica si se cumplió el objetivo de la salida (conductor, al llegar) */
  objetivo_cumplido?: boolean | null
  /** Notas del conductor al marcar llegada */
  observaciones_llegada?: string | null
  ubicacion_destino?: string | null
  latitud?: number | null
  longitud?: number | null
  /** Pasajeros que acompañan (desde catálogo usuarios) */
  acompanantes?: { id_usuario: number; nombre: string }[] | null
  estado: 'pendiente_autorizacion' | 'en_uso' | 'retrasado' | 'finalizado'
  llave_entregada: boolean
  id_usuario_caja_entrego_llave?: number | null
  nombre_usuario_caja_entrego_llave?: string | null
  observaciones?: string | null
  created_at: string
  updated_at: string
  // Relaciones
  vehiculo?: Vehiculo
}

// ============================================
// AGENDA DEL ASESOR TÉCNICO
// ============================================

export interface CitaAsesorTecnico {
  id: number
  id_asesor: number
  id_cliente?: number | null
  id_ficha_no_op?: number | null
  titulo: string
  descripcion?: string | null
  fecha_cita: string
  duracion_minutos: number
  direccion?: string | null
  ubicacion_link?: string | null
  estado: 'programada' | 'confirmada' | 'en_curso' | 'completada' | 'cancelada'
  notas?: string | null
  created_at?: string
  updated_at?: string
  created_by?: number | null
  cliente_nombre?: string | null
  cliente_telefono?: string | null
  cliente_email?: string | null
  /** Número en ordenes_trabajo (FICHA-n u OP-n); ver es_ficha_no_op */
  ficha_numero?: string | null
  /** false = ya es OP real; true/NULL = ficha No OP o sin fila vinculada */
  es_ficha_no_op?: boolean | null
}

