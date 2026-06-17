/** Datos del esquema Plot Lab — cada sección con problema, funcionamiento y detalle. */
export const meta = {
  title: 'Plot Lab — Esquema completo del sistema',
  subtitle:
    'Guía exhaustiva de módulos, herramientas, flujos y el problema de negocio que resuelve cada parte del ecosistema Plot Center.',
  version: 'Junio 2026',
  domain: 'plotrello.vercel.app'
}

export const rolesTable = [
  ['administracion / gerencia', 'Tablero, ERP, usuarios', 'Visión global, Work Pool admin, estadísticas, backup'],
  ['mostrador', '/mostrador', 'Entregas, ventas rápidas, cuenta corriente, CRM, consulta cliente'],
  ['caja', '/caja/dashboard', 'Arqueos, egresos, planillas medios de pago, pase de caja, conciliación MP'],
  ['compras', '/compras', 'Pedidos proveedor, stock, conciliación bancaria, mis-pedidos internos'],
  ['diseno', '/diseno', 'Briefs, galería, Plot Design, publicar jobs en bolsa'],
  ['taller-grafico', '/taller-grafico/dashboard', 'Kanban taller, inventario, overlay pedido listo'],
  ['imprenta', '/impresoras', 'Cola impresoras, totem impresión, etapas imprenta en OP'],
  ['instalaciones', '/app-campo', 'Obra en campo, Bolsa Plot, historial etapas instalaciones'],
  ['metalurgica', '/metalurgica/inventario', 'Inventario piezas, Bolsa Plot metalúrgica'],
  ['recursos-humanos', '/rrhh', 'Legajos, postulaciones IA, permisos, reloj biométrico, capacitaciones'],
  ['asesor-tecnico / presupuestos', '/asesor-presupuestos', 'Kanban No OP: DT → Presupuestos → Finalizado'],
  ['operario-diseno', '/operario-externo/diseno', 'Panel aislado: jobs asignados, mensajes, sin OP'],
  ['operario-bolsa', '/operario-externo/bolsa', 'Idem para instalaciones/metalúrgica externa']
]

export const sections = [
  {
    id: 'arquitectura',
    num: '1',
    title: 'Arquitectura y entradas de la aplicación',
    problema:
      'Plot Center combina producción gráfica, instalaciones, metalúrgica, ventas, diseño y administración. Sin una plataforma única, cada área trabajaría con Excel, WhatsApp y sistemas aislados: se pierde trazabilidad de la OP desde el pedido hasta la factura, y el cliente recibe respuestas contradictorias según a quién pregunte.',
    comoFunciona:
      'Plot Lab es una SPA React desplegada en Vercel que se conecta a Supabase (PostgreSQL, Storage, Realtime, RPC). Tiene tres puntos de entrada HTML independientes (Vite multi-entry): la app principal para staff y módulos, admin.html para métricas administrativas, y tablet-firma.html para firmas en mostrador. Las rutas públicas, el portal cliente y el operario externo viven en el mismo dominio pero con guards de autenticación distintos.',
    quienUsa: 'Todo el personal interno, clientes web, operarios externos y visitantes del local (tótem).',
    flujo: [
      'Usuario abre plotrello.vercel.app → React Router resuelve la ruta.',
      'Si requiere login staff → JWT vía /api/auth/staff-login y tabla usuarios.',
      'Páginas consumen api.ts → Supabase RPC/REST + APIs Vercel para IA y tareas sensibles.',
      'Realtime actualiza tablero y notificaciones entre dispositivos conectados.'
    ],
    items: [
      { name: 'index.html → App principal', desc: 'Tablero, ERP, mostrador, RRHH, compras, diseño, flota.', detalle: 'Bundle principal con cientos de rutas bajo StaffAppHost.' },
      { name: 'admin.html', desc: 'Dashboard y reportes admin en app separada.', detalle: 'Rutas / y /reportes — métricas globales sin cargar el tablero.' },
      { name: 'tablet-firma.html', desc: 'Tablet en mostrador solo para firmas.', detalle: 'Lista entregas → pantalla firma táctil, desacoplada del tablero.' },
      { name: 'Supabase', desc: 'BD única: OPs, pedidos, ERP, work_pool, RRHH.', detalle: 'Auth custom con RPC login_usuario; opcional segundo proyecto para stock.' },
      { name: 'APIs Vercel /api/*', desc: 'PlotAI, RRHH CV, auth JWT, telegram, backup.', detalle: 'Lógica sensible y claves API nunca en el navegador.' },
      { name: 'PWA', desc: 'Instalable en móvil para campo y mostrador.', detalle: 'vite-plugin-pwa — acceso rápido sin buscar URL.' }
    ],
    diagram: 'arch'
  },
  {
    id: 'auth',
    num: '2',
    title: 'Autenticación, sesiones y enrutamiento',
    problema:
      'Mezclar sesiones de empleado, cliente web y operario externo en una sola cookie genera fugas de información: un freelancer no debe ver el tablero de OPs ni datos de otros clientes. Tampoco puede un visitante anónimo acceder a compras o ERP.',
    comoFunciona:
      'El staff inicia sesión en /login; staffAuthApi valida contra Supabase y opcionalmente emite JWT (staff-session). useAuth expone rol y flags (canManageCaja, canManageWorkPool, etc.). Los roles operario-diseno y operario-bolsa son interceptados por OperarioExternoStaffShell antes de montar StaffAppHost, redirigiendo a /operario-externo/*. Los clientes usan ClienteProtectedRoute con sesión aparte en /cliente/login.',
    quienUsa: 'Todos los usuarios identificados; guards automáticos según rol.',
    flujo: [
      'Login staff → guardar token → navigate según operarioExternoHomeRoute() o /.',
      'Catch-all /* → OperarioExternoStaffShell → si externo, panel; si no, StaffAppHost.',
      'Cliente → ClientePortalRoutes con redirect a login si no hay sesión.',
      'Público → rutas sin guard (brief con token, tótem, reclamos).'
    ],
    items: [
      { name: '/login', desc: 'Formulario usuario/contraseña staff.', detalle: 'flushSync + navigate al panel externo si aplica.' },
      { name: 'useAuth / AuthProvider', desc: 'Estado global de usuario y permisos.', detalle: 'isAdmin, canManageWorkPool, isOperarioExterno*, etc.' },
      { name: 'OperarioExternoGate', desc: 'Bloquea rutas admin de bolsa a externos.', detalle: 'Dentro de StaffAppHost para capa extra.' },
      { name: 'OperarioExternoStaffShell', desc: 'Evita que externo vea tablero Plot Lab.', detalle: 'Crítico: sin esto caían en / tras login.' },
      { name: '/cliente/login', desc: 'Auth clientes web (email/password).', detalle: 'Tabla clientes_web separada de usuarios staff.' },
      { name: 'staff-jwt-status', desc: 'API verifica validez sesión JWT.', detalle: 'Renovación y logout seguro.' }
    ],
    diagram: 'auth'
  },
  {
    id: 'tablero',
    num: '3',
    title: 'Tablero Kanban y órdenes de producción (OP)',
    problema:
      'Una imprenta con múltiples sectores (diseño, taller, imprenta, instalación) necesita saber en tiempo real qué OP está en qué etapa, quién la tiene y cuándo prometió entregar. Las planillas no escalan, no avisan retrasos y no vinculan materiales, cliente y historial en un solo lugar.',
    comoFunciona:
      'BoardPage muestra columnas Kanban con drag-and-drop (@hello-pangea/dnd). Cada tarjeta (Task) representa una OP o ficha; TaskEditModal es la ficha completa con sectores, materiales, subtareas, tiempo de trabajo y revisiones. El modo espejo replica la misma OP en el kanban de cada sector involucrado. Filtros, biblioteca de tareas y atajos de teclado aceleran la operación diaria.',
    quienUsa: 'Producción, gerencia, administración, y sectores con permiso en sectorPermissions.',
    flujo: [
      'Crear OP (TaskCreateModal) o desde pedido web / brief.',
      'Mover entre columnas → actualiza estado y dispara activity feed.',
      'Sector completa etapa → historial por sector (taller, imprenta, etc.).',
      'Marcar entregada → visible en mostrador órdenes listas.',
      'QR impreso → cliente consulta en tótem o /op-public.'
    ],
    items: [
      { name: '/', desc: 'Tablero principal Kanban.', detalle: 'ActivityFeed, FiltersBar, StatsPanel, WeatherWidget, ClockWidget.' },
      { name: '/op/:opNumber', desc: 'Vista detalle OP enlazable.', detalle: 'OpViewPage — lectura rápida sin modal.' },
      { name: 'TaskEditModal / TaskViewModal', desc: 'Edición y vista completa de ficha.', detalle: 'Materiales, cliente, fechas, responsables, adjuntos.' },
      { name: 'Modo espejo (espejo sectores)', desc: 'OP multi-sector sincronizada.', detalle: 'handleEspejoSectoresOpSynced — misma OP en varios kanbans.' },
      { name: '/kanban-etapas/:slug', desc: 'Kanban filtrado por etapa.', detalle: 'SectorEtapaKanbanPage para foco en una cola.' },
      { name: 'Biblioteca de tareas', desc: 'TaskLibraryModal — plantillas reutilizables.', detalle: 'Acelera OPs repetitivas (cartelería, vinilos estándar).' },
      { name: 'Subtareas y tiempo', desc: 'Subtasks, TiempoTrabajoSection.', detalle: 'Desglose interno y registro horas por OP.' },
      { name: 'RevisionesSection', desc: 'Control de calidad por revisión.', detalle: 'Trazabilidad de quién aprobó arte o muestra.' },
      { name: 'Alertas vencimiento', desc: 'alertas_vencimiento en BD.', detalle: 'AdminAlertButton avisa OPs próximas a vencer.' },
      { name: '/op-eliminadas', desc: 'Auditoría OPs borradas.', detalle: 'Recuperación y control — solo admin.' },
      { name: 'Export PDF/Excel', desc: 'exportUtils, fichas-activas-pdf API.', detalle: 'Reportes offline del estado del tablero.' }
    ],
    diagram: 'tablero'
  },
  {
    id: 'insights',
    num: '4',
    title: 'Herramientas rápidas del tablero (Insights Tools)',
    problema:
      'El operador del tablero no puede abandonar la ficha cada vez que necesita chatear, pedir un permiso o ver si la impresora está libre. Interrumpir el flujo genera errores al mover OPs y olvidos en solicitudes al equipo.',
    comoFunciona:
      'InsightsToolsMenu es un menú flotante (⋯) en BoardPage con acceso a Chat interno, PlotAI, impresoras y permisos. ChatFloatingButton muestra badge de no leídos. StaffFloatingDock en móvil repite impresoras + SolicitudesPermisosFloatingButton. Todo sin cambiar de ruta.',
    quienUsa: 'Cualquier usuario logueado en el tablero; impresoras según rol.',
    items: [
      { name: 'PlotAI (toggle)', desc: 'Abre PlotAIChat overlay contextual.', detalle: 'Conoce tasks, activity, teamMembers; crea tareas.' },
      { name: 'Chat interno', desc: 'Canales y menciones entre staff.', detalle: '/chat página completa; preview en floating.' },
      { name: 'Impresoras', desc: 'Navigate a /impresoras.', detalle: 'Ocupación y cola en tiempo real.' },
      { name: 'Permisos / turnos', desc: 'SolicitudPermisoModal.', detalle: 'Vacaciones, cambio turno — badge pendientes RRHH.' },
      { name: 'Solicitar productos', desc: 'SolicitarProductosModal desde header.', detalle: 'Pedido interno de insumos a compras.' },
      { name: 'Sprint Optimizer', desc: 'SprintOptimizerModal + PlotAI.', detalle: 'Sugerencias de reordenar carga del sprint.' },
      { name: 'QR ficha OP', desc: 'QRPrintView al imprimir.', detalle: 'Cliente escanea → consulta estado sin molestar mostrador.' }
    ]
  },
  {
    id: 'plotai',
    num: '5',
    title: 'PlotAI — asistente inteligente',
    problema:
      'Buscar datos en fichas, redactar briefs, interpretar PDFs escaneados o calcular riesgos del sprint consume horas. El equipo necesita respuestas en lenguaje natural con contexto real del negocio, no un chat genérico.',
    comoFunciona:
      'PlotAIChat usa plotAIContextService para inyectar OPs, tareas, equipo y memoria (plotAIMemoryService). Las APIs Vercel (/api/plotai/*) llaman a Gemini y ElevenLabs. Soporta voz, adjuntos, generación de imagen/video, y acciones como crear tareas. En tótem y web pública usa chat-public sin contexto staff.',
    quienUsa: 'Staff en tablero; clientes en tótem, embed y portal; RRHH para CVs y asistencia.',
    flujo: [
      'Usuario abre PlotAI → se arma prompt con formatCompleteContextForPrompt().',
      'Mensaje + adjuntos → /api/plotai/generate-content o chat-public.',
      'Opcional: TTS, live-voice, generate-image/video.',
      'Memoria local guarda patrones para futuras conversaciones.'
    ],
    items: [
      { name: 'PlotAIChat', desc: 'UI principal en tablero.', detalle: 'Panel lateral inteligencia + stream de mensajes.' },
      { name: 'plotAIKanbanContext', desc: 'Busca OPs mencionadas en el chat.', detalle: 'extractOpTokensFromUserMessage → fichas relevantes.' },
      { name: 'plotAIManualService', desc: 'Manual interno searchable.', detalle: 'PlotAI responde según procedimientos documentados.' },
      { name: 'Sprint predict/report', desc: 'APIs sprint-predict, sprint-report.', detalle: 'Análisis de velocidad y riesgo de entregas.' },
      { name: 'brief-completo', desc: 'Completa campos de brief con IA.', detalle: 'Cliente escribe poco; IA estructura el pedido de diseño.' },
      { name: 'pedido-especificacion', desc: 'Cliente describe pedido en texto libre.', detalle: 'Genera ítems de pedido web automáticamente.' },
      { name: 'asistencia-reloj', desc: 'Informe tardanzas/ausencias.', detalle: 'Tras importar Excel del reloj biométrico.' },
      { name: 'filter-postulaciones / extract-cv', desc: 'RRHH filtra CVs con IA.', detalle: 'Metadata y scoring de candidatos.' },
      { name: 'Caja PlotAI', desc: 'CajaMiniPlotAI en módulo caja.', detalle: 'Consultas sobre arqueos y movimientos.' },
      { name: 'Totem / embed', desc: 'chat-public, chat-widget.', detalle: 'PlotAI en plotcenter.com.ar y pantalla local.' }
    ]
  },
  {
    id: 'estadisticas',
    num: '6',
    title: 'Estadísticas, calendario y Gantt',
    problema:
      'El tablero muestra el presente pero gerencia necesita tendencias: cuántas OPs se retrasan, carga por sector, distribución en el tiempo. Sin vistas analíticas las decisiones de capacidad y contratación son a ciegas.',
    comoFunciona:
      'StatisticsPage agrega métricas del tablero con Recharts (agentInsights, stats utils). CalendarPage superpone entregas y eventos. GanttPage muestra línea temporal de OPs. dashboard-pantallas adapta métricas para TVs en planta.',
    quienUsa: 'Gerencia, administración, jefes de sector.',
    items: [
      { name: '/statistics', desc: 'Dashboard analítico producción.', detalle: 'Gráficos por sector, estado, responsable.' },
      { name: '/calendario', desc: 'Vista calendario de tareas.', detalle: 'Fechas prometidas y hitos.' },
      { name: '/gantt', desc: 'Diagrama Gantt.', detalle: 'Solapamientos y duración de OPs.' },
      { name: '/dashboard-pantallas', desc: 'Modo TV / señalética.', detalle: 'Métricas en pantallas del taller o recepción.' },
      { name: 'Sprint snapshots', desc: 'plotAiRecordSprintSnapshot.', detalle: 'Histórico para predicción PlotAI.' }
    ]
  },
  {
    id: 'workpool',
    num: '7',
    title: 'Work Pool — Plot Design y Bolsa Plot',
    problema:
      'Picos de diseño gráfico, instalaciones en obra y trabajos metalúrgicos exceden al plantel fijo. Sin bolsa de trabajos no hay forma ordenada de publicar excedente, postular operarios externos, asignar con trazabilidad y comunicarse sin exponer datos internos de la OP.',
    comoFunciona:
      'WorkPoolAdminPanel en /plot-design y /bolsa-plot gestiona jobs (work_pool_jobs). WorkPoolFuentesEntrada trae candidatos desde tablero (OPs en cola del sector), briefs pendientes y pedidos portal sin OP. Al publicar un job, se asigna a operario interno o externo. El externo solo ve maskJobForOperarioExterno (sin numero_op). Postulaciones pasan por work_pool_solicitudes → RRHH aprueba → usuario operario-bolsa/diseno.',
    quienUsa: 'Admin/diseño/instalaciones publican; operarios internos y externos ejecutan.',
    flujo: [
      'Admin abre fuentes → selecciona OP, brief o pedido web.',
      'Publica job con rubro, plazo, monto.',
      'Asigna operario (perfil work_pool_profiles).',
      'Operario externo ve job en /operario-externo → mensajes por pedido.',
      'Admin cierra job → historial en bolsa.'
    ],
    items: [
      { name: '/plot-design', desc: 'Admin bolsa diseño gráfico.', detalle: 'WorkPoolModule product=plot-design.' },
      { name: '/bolsa-plot', desc: 'Admin bolsa instalaciones/metalúrgica.', detalle: 'Mismo módulo, sector distinto.' },
      { name: 'WorkPoolFuentesEntrada', desc: 'Tablero + briefs + pedidos portal.', detalle: 'Tres pestañas de origen de trabajo.' },
      { name: 'WorkPoolSolicitudesPanel', desc: 'Aprueba/rechaza postulantes.', detalle: 'RPC work_pool_aprobar_solicitud.' },
      { name: 'WorkPoolOperarioDashboard', desc: 'Panel externo: Entrantes, Mensajes, Cuenta.', detalle: 'Modal atractivo con foto, stats, trabajos.' },
      { name: '/operario-bolsa/solicitud', desc: 'Formulario postulación pública.', detalle: 'Post-envío: panel si ya es operario, si no login.' },
      { name: '/postulacion-operarios', desc: 'Landing postulación operarios.', detalle: 'Alternativa pública al formulario bolsa.' },
      { name: 'Recomendaciones operario', desc: 'workPoolOperarioRecommendations.', detalle: 'Sugiere mejor operario según skills/zona.' }
    ],
    diagram: 'workpool'
  },
  {
    id: 'asesor',
    num: '8',
    title: 'Asesor técnico y presupuestos (No OP)',
    problema:
      'Antes de existir una OP hay consultas técnicas, mediciones y presupuestos que no encajan en el kanban de producción. Mezclarlos con OPs activas satura el tablero y confunde al taller con trabajos que aún no se confirmaron.',
    comoFunciona:
      'AsesorPresupuestosPage es un kanban dedicado con columnas Asesor Técnico → Presupuestos → Finalizado (asesorPresupuestosColumns). FichaNoOPModal gestiona fichas sin número OP. AgendaAsesorTecnico y CitaModal coordinan visitas y mediciones en terreno.',
    quienUsa: 'Asesor técnico, presupuestos, administración.',
    items: [
      { name: '/asesor-presupuestos', desc: 'Kanban No OP.', detalle: 'Skill Cursor: fichas, filtros, sync tasks.' },
      { name: 'AgendaAsesorTecnico', desc: 'Calendario citas técnicas.', detalle: 'Vinculado a fichas en columna DT.' },
      { name: 'CrearPresupuestoModal', desc: 'Alta presupuesto desde ficha.', detalle: 'Puente hacia venta u OP futura.' },
      { name: 'Vía Pública (externo)', desc: 'vp-zeta-eight.vercel.app.', detalle: 'Señalética urbana — enlace header admin/presupuestos.' }
    ]
  },
  {
    id: 'mostrador',
    num: '9',
    title: 'Mostrador, entregas y CRM ventas',
    problema:
      'El mostrador es el punto de contacto físico: retiros, pagos, consultas y ventas espontáneas. Sin sistema, el vendedor interrumpe al taller, no registra entregas legalmente y pierde oportunidades de venta y seguimiento comercial.',
    comoFunciona:
      'MostradorDashboardPage centraliza OPs del día. OrdenesListasPage filtra listas para avisar clientes (notify-orden-lista API). EntregaPage guía el proceso con firma (o redirige a tablet-firma). VentaRapidaModal y CRMVentasPage registran ventas y oportunidades. Cuenta corriente consolida deuda por cliente.',
    quienUsa: 'Mostrador, caja (cobros vinculados), gerencia comercial.',
    flujo: [
      'OP pasa a “lista” en tablero → aparece en órdenes listas.',
      'Cliente llega → buscar cliente / escanear QR.',
      'EntregaPage → firma tablet o /firma-cliente/:op.',
      'Opcional: venta adicional o carga a cuenta corriente.',
      'Mensajería envía comprobante con token verificación.'
    ],
    items: [
      { name: '/mostrador', desc: 'Dashboard mostrador.', detalle: 'Vista operativa del día.' },
      { name: '/mostrador/ordenes-listas', desc: 'Cola de retiros.', detalle: 'Integración notificación orden lista.' },
      { name: '/mostrador/entrega/:id', desc: 'Flujo entrega completo.', detalle: 'RegistroSalidaModal, comprobante.' },
      { name: '/mostrador/buscar-cliente', desc: 'BuscadorClientesModal persistente.', detalle: 'Historial OPs y datos cliente.' },
      { name: '/mostrador/ventas', desc: 'Venta rápida y registro.', detalle: 'VentaRapidaModal desde tablero también.' },
      { name: '/crm-ventas', desc: 'Pipeline oportunidades.', detalle: 'oportunidades_venta, presupuestos_ventas.' },
      { name: '/mostrador/cuenta-corriente', desc: 'Saldos y movimientos.', detalle: 'Perfil por cliente /cliente/:id.' },
      { name: '/mostrador/clientes-frecuentes', desc: 'CRM ligero clientes habituales.', detalle: 'Agiliza atención repetitiva.' },
      { name: '/mostrador/reportes', desc: 'Reportes operación mostrador.', detalle: 'Export PDF/Excel vía crmExportUtils.' },
      { name: 'tablet-firma.html', desc: 'App dedicada firma táctil.', detalle: 'TabletFirmaSelectPage → TabletFirmaPage.' },
      { name: '/firma-cliente/:op', desc: 'Firma desde móvil del cliente.', detalle: 'Link enviado por mail/WhatsApp.' }
    ],
    diagram: 'entrega'
  },
  {
    id: 'cuenta-corriente',
    num: '9A',
    title: 'Cuenta corriente (mostrador) — módulo completo',
    problema:
      'Clientes corporativos y habituales compran a crédito. Sin cuenta corriente digital, la deuda vive en planillas: no hay límite de crédito, no se exige documentación para fiar, los pagos no tienen comprobante auditado y gerencia no ve la cartera total adeudada. El vendedor no sabe si el cliente está aprobado o si tiene mal scoring.',
    comoFunciona:
      'Rutas /mostrador/cuenta-corriente (cartera) y /mostrador/cuenta-corriente/cliente/:id (perfil). Alta con CuentaCorrienteAltaForm: documentos en Storage, pagaré PDF para persona física, RPC registrar_alta_cuenta_corriente. Admin aprueba → cliente_habilitado_cuenta_corriente habilita ventas fiadas en VentaRapidaModal. Cada venta CC genera cargo en cc_cuenta_movimientos; cada pago con comprobante genera haber. Scoring 0–100 (excelente→crítico) y límite_credito alertan en venta. PDF dedicado: docs/CUENTA_CORRIENTE_PLOT_LAB.pdf.',
    quienUsa: 'Mostrador (altas, consultas), administración (aprobación, scoring, intereses), caja (cobros).',
    flujo: [
      'Alta con docs → pendiente → admin aprueba → scoring y límite.',
      'VentaRapidaModal con toggle CC → validación habilitado + badge scoring.',
      'Cargo automático en libro → perfil muestra saldo corrido.',
      'Pago con comprobante obligatorio → haber → recalcula scoring.',
      'Opcional: intereses devengados por mora (admin configura tasas).'
    ],
    items: [
      { name: '/mostrador/cuenta-corriente', desc: 'Listado y dashboard cartera.', detalle: 'KPIs deuda total, filtros, export CSV cartera.' },
      { name: '/mostrador/cuenta-corriente/cliente/:id', desc: 'Perfil cliente CC.', detalle: 'Libro movimientos, ventas CC, registro pagos, intereses.' },
      { name: 'Estados ficha', desc: 'pendiente · aprobada · rechazada.', detalle: 'Solo aprobada opera fiado.' },
      { name: 'Scoring', desc: 'calcular_scoring_cuenta_corriente.', detalle: 'Niveles excelente→crítico; alerta en venta si riesgo.' },
      { name: 'Documentación alta', desc: 'AFIP, estatuto, DNI, domicilio, pagaré.', detalle: 'Máx 8 MB por archivo en Storage.' },
      { name: 'cc_registrar_pago', desc: 'Pago con comprobante.', detalle: 'Vinculación opcional a venta pendiente.' },
      { name: 'Intereses mora', desc: 'cc_registrar_intereses_devengados.', detalle: '% mensual, días gracia, proporcional 30 días.' },
      { name: 'Exports', desc: 'PDF estado cuenta, CSV libro/ventas.', detalle: 'downloadEstadoCuentaPdf, downloadPerfilCsvPack.' }
    ],
    diagram: 'cc-libro'
  },
  {
    id: 'caja',
    num: '10',
    title: 'Control de cajas y tesorería operativa',
    problema:
      'Varios puntos de cobro (mostrador, tótem impresión) y egresos diarios requieren arqueos, planillas por medio de pago y traspasos entre cajas. En Excel no hay trazabilidad ni alertas de diferencias al cierre de turno.',
    comoFunciona:
      'El feature control-cajas en CajaDashboardPage gestiona arqueos, movimientos, egresos, pase de caja, traspasos y planillas de medios de pago. Sincroniza ventas Plot Lab (plotlabVentaCajaSync) y egresos ERP. CajaPlotAI ayuda a consultar movimientos. Export PDF de arqueos y cierres.',
    quienUsa: 'Cajeros, administración, gerencia.',
    items: [
      { name: '/caja/dashboard', desc: 'Router según rol admin/cajero.', detalle: 'CajaDashboardPage con ControlCajasModule.' },
      { name: 'Arqueos', desc: 'CajaSectionArqueo, ArqueoDetalleModal.', detalle: 'Conteo efectivo vs sistema.' },
      { name: 'Cierre de turno', desc: 'CajaSectionCierreTurno, snapshot.', detalle: 'exportCierreTurno PDF único.' },
      { name: 'Planillas medios de pago', desc: 'planillaMediosPago, import Excel.', detalle: 'Tarjetas, transferencias, MP por línea.' },
      { name: 'Pase de caja', desc: 'CajaSectionPaseCaja.', detalle: 'Entrega efectivo entre turnos/cajeros.' },
      { name: 'Egresos', desc: 'CajaSectionEgresos + plotlabEgresosSync.', detalle: 'Salidas vinculadas a ERP gastos.' },
      { name: 'Conciliación MP en caja', desc: 'CajaSectionConcilMP.', detalle: 'Cruce con MercadoPago del día.' },
      { name: 'Ventas diarias', desc: 'CajaSectionVentasDiarias.', detalle: 'Panel ventas Plot Lab del turno.' },
      { name: 'Caja inteligencia', desc: 'CajaCentroInteligente, alertas.', detalle: 'Detecta anomalías en cierres.' }
    ]
  },
  {
    id: 'compras',
    num: '11',
    title: 'Compras, stock y proveedores',
    problema:
      'Faltan insumos en medio de una OP crítica, los pedidos a proveedor no se centralizan y el stock real no coincide con lo que compras registró. La conciliación bancaria manual demora el cierre contable.',
    comoFunciona:
      'ComprasDashboardPage unifica pedidos, proveedores y alertas. CrearPedidoCompraPage genera pedido con ítems y seguimiento. GestionStockPage actualiza niveles; mis-pedidos permite a cualquier sector solicitar insumos. ConciliacionBancariaPage y feature conciliacion-mp cruzan extractos con movimientos (incluye asistencia Gemini).',
    quienUsa: 'Compras, gerencia, sectores que solicitan (mis-pedidos).',
    items: [
      { name: '/compras', desc: 'Dashboard y listado pedidos.', detalle: 'PedidoCompraDetallePage con estados.' },
      { name: '/compras/proveedores', desc: 'CRUD proveedores.', detalle: 'Datos fiscales, contacto, plazos.' },
      { name: '/compras/gestion-stock', desc: 'Inventario materiales.', detalle: 'Opcional Supabase stock separado.' },
      { name: '/compras/crear-pedido', desc: 'Alta pedido compra.', detalle: 'Presupuestos proveedor /compras/presupuestos/:id.' },
      { name: '/mis-pedidos', desc: 'Solicitudes internas staff.', detalle: 'Desde SolicitarProductosModal en tablero.' },
      { name: '/compras/conciliacion-bancaria', desc: 'Import extracto banco.', detalle: 'Match con pagos registrados.' },
      { name: '/compras/conciliacion-mercadopago', desc: 'Motor conciliacion-mp.', detalle: 'reconciliation-engine + Gemini hints.' },
      { name: '/compras/calendario-entregas', desc: 'Fechas llegada materiales.', detalle: 'Compartido lógica con mostrador calendario.' },
      { name: '/compras/reportes', desc: 'ReportesComprasPage, stock.', detalle: 'Export y análisis de compras.' }
    ]
  },
  {
    id: 'diseno',
    num: '12',
    title: 'Diseño gráfico interno',
    problema:
      'Los briefs llegan por canales distintos (mail, WhatsApp, portal). El diseñador no tiene cola única ni repositorio de trabajos aprobados para reutilizar criterios. Se retrabaja y se pierden archivos fuente.',
    comoFunciona:
      'DisenoDashboardPage resume carga del sector. BriefsPendientesPage lista briefs de portal y tokens públicos. Al aprobar brief, puede abrirse TaskCreateModal en tablero con brief_token. GaleriaTrabajosPage archiva referencias. BriefPublicoPage y ClienteBriefFormPage capturan requerimientos estructurados con ayuda IA.',
    quienUsa: 'Diseño gráfico, mostrador (genera link brief), clientes web.',
    items: [
      { name: '/diseno', desc: 'Dashboard sector diseño.', detalle: 'Acceso Plot Design admin si aplica.' },
      { name: '/briefs-pendientes', desc: 'Cola briefs sin OP.', detalle: 'Priorización y asignación.' },
      { name: '/brief/:token', desc: 'Formulario público brief.', detalle: 'BriefPublicoPage — sin login.' },
      { name: 'BriefLinkSection', desc: 'En ficha OP — link al cliente.', detalle: 'Cliente completa desde casa.' },
      { name: '/galeria-trabajos', desc: 'Portfolio interno.', detalle: 'Búsqueda por rubro, cliente, técnica.' },
      { name: 'clienteBriefAiService', desc: 'IA sugiere campos de brief.', detalle: 'Reduce ida y vuelta con cliente.' }
    ]
  },
  {
    id: 'produccion',
    num: '13',
    title: 'Sectores productivos',
    problema:
      'Taller gráfico, imprenta, metalúrgica e instalaciones tienen colas y recursos distintos (mesas de corte, plotters, soldadura, cuadrillas en obra). Un tablero genérico no refleja inventario ni ocupación de máquinas.',
    comoFunciona:
      'Cada sector tiene dashboard o inventario propio y selectores de etapa en la ficha OP (EtapaTallerGraficoSelector, EtapaTallerImprentaSelector, etc.) con historial por sector. ImpresorasPage muestra cola en vivo. App campo (InstalacionesMetalurgicaCampoPage) optimiza móvil en obra. TallerGraficoPedidoEntregaOverlay avisa pedidos listos.',
    quienUsa: 'Operarios de planta, jefes de sector, imprenta.',
    items: [
      { name: '/taller-grafico/dashboard', desc: 'Kanban taller gráfico.', detalle: 'HistorialEtapasTallerGrafico en OP.' },
      { name: '/taller-grafico/inventario', desc: 'Stock insumos taller.', detalle: 'TallerGraficoInventarioPage.' },
      { name: '/impresoras', desc: 'Estado plotters/impresoras.', detalle: 'Totem impresión /impresoras/totem.' },
      { name: '/metalurgica/inventario', desc: 'Piezas y materiales.', detalle: 'HistorialEtapasMetalurgica.' },
      { name: '/app-campo', desc: 'OPs en obra, fotos, avances.', detalle: 'GPS/flota complementa logística.' },
      { name: 'EtapaImpresionDigitalSelector', desc: 'Micro-etapas impresión.', detalle: 'RIP, impresión, corte, etc.' },
      { name: 'SeleccionarProductoStockModal', desc: 'Descuenta stock al cargar material en OP.', detalle: 'commerceStockService.' }
    ]
  },
  {
    id: 'rrhh',
    num: '14',
    title: 'Recursos Humanos',
    problema:
      'CVs por email, permisos por WhatsApp y asistencia en planillas del reloj biométrico no escalan. RRHH no puede filtrar candidatos rápido ni demostrar tardanzas objetivas en una discusión laboral.',
    comoFunciona:
      'RecursosHumanosDashboardPage concentra módulos. Postulaciones integran submit-cv público, extract-cv IA y filter-postulaciones. Permisos fluyen SolicitudPermisoModal → RRHH aprueba. relojBiometricoService importa Excel, matchea empleados, calcula tardanzas y genera informe PlotAI. Capacitaciones y pruebas técnicas con /mis-pruebas para empleados.',
    quienUsa: 'RRHH, gerencia, todos los empleados (permisos, menú, capacitaciones).',
    items: [
      { name: '/rrhh/postulaciones', desc: 'Pipeline candidatos.', detalle: 'Estados: Nuevo, En revisión, Entrevista, etc.' },
      { name: '/trabaja-con-nosotros', desc: 'CV público empleados.', detalle: 'CvPublicoPage + API submit-cv.' },
      { name: '/rrhh/permisos', desc: 'Gestión solicitudes.', detalle: 'solicitudes_permisos en BD.' },
      { name: '/rrhh/horarios', desc: 'Turnos y horarios fijos.', detalle: 'Vinculación id reloj ↔ usuario.' },
      { name: 'Reloj biométrico', desc: 'Import 29.xls, planilla, export XLSX.', detalle: 'RelojHistorialCalendario + informe IA.' },
      { name: '/rrhh/capacitaciones', desc: 'Cursos admin; /capacitaciones empleado.', detalle: 'Seguimiento cumplimiento.' },
      { name: '/rrhh/evaluaciones', desc: 'Evaluaciones desempeño.', detalle: 'Histórico por legajo.' },
      { name: '/rrhh/incidencias', desc: 'Registro incidentes laborales.', detalle: 'Trazabilidad RRHH.' },
      { name: '/rrhh/desvinculaciones', desc: 'Proceso de baja.', detalle: 'Checklist y documentación.' },
      { name: '/rrhh/pruebas', desc: 'Pruebas técnicas contratación.', detalle: '/mis-pruebas para postulante interno.' },
      { name: '/menu-diario', desc: 'Empleado elige plato.', detalle: '/rrhh/menu-diario administra menú.' },
      { name: 'LegajoEmpleadoModal', desc: 'Datos completos empleado.', detalle: 'Documentos, historial, sectores.' }
    ]
  },
  {
    id: 'clientes',
    num: '15',
    title: 'Portal y administración clientes web',
    problema:
      'Clientes corporativos quieren pedir online, ver estado y chatear sin llamar. Sin portal, cada pedido se reescribe en mostrador y no hay autoservicio de presupuestos ni briefs de diseño.',
    comoFunciona:
      'ClientePortalShell envuelve rutas /cliente/*. commerceCartService maneja carrito; checkout genera pedido_cliente. Staff en /clientes-web revisa, detalla y convierte a OP (ConvertirPedidoAOpPage). Artículos y categorías definen catálogo con visibilidad por canal (COLUMNA_VISIBILIDAD_POR_CANAL).',
    quienUsa: 'Clientes registrados; marketing/admin clientes web; diseño (briefs).',
    flujo: [
      'Cliente login → dashboard → catálogo o nuevo pedido.',
      'Checkout / presupuesto / brief según tipo producto.',
      'Staff notificado → revisa en clientes-web/pedidos.',
      'Convertir a OP → aparece en tablero y puede ir a Work Pool.',
      'Mensajes y chat por pedido.'
    ],
    items: [
      { name: '/cliente/dashboard', desc: 'Hub cliente.', detalle: 'Accesos pedidos, mensajes, notificaciones.' },
      { name: '/cliente/catalogo + carrito', desc: 'E-commerce B2B.', detalle: 'articuloPermiteCompra, control stock.' },
      { name: '/cliente/checkout', desc: 'Cierre pedido.', detalle: 'aplicarStockDesdePedidoCliente al confirmar.' },
      { name: '/cliente/presupuestos', desc: 'Cotizaciones formales.', detalle: 'Form crear/editar presupuesto.' },
      { name: '/cliente/disenos', desc: 'Briefs de diseño.', detalle: 'ClienteBriefsPage + brief por token.' },
      { name: '/cliente/buscar-op', desc: 'Seguimiento OP propia.', detalle: 'Sin acceso a OPs de otros.' },
      { name: '/cliente/mensajes', desc: 'Hilo por pedido.', detalle: 'Comunicación async con Plot Center.' },
      { name: '/clientes-web/pedidos/:id/convertir', desc: 'Staff crea OP.', detalle: 'Puente web → producción.' },
      { name: '/clientes-web/articulos', desc: 'Catálogo admin.', detalle: 'ArticulosEmpresaPage, categorías.' },
      { name: '/cliente/ayuda + reclamos', desc: 'Soporte autogestionado.', detalle: 'Reduce carga atención telefónica.' }
    ],
    diagram: 'cliente'
  },
  {
    id: 'erp',
    num: '16',
    title: 'ERP — contabilidad y facturación AFIP',
    problema:
      'Facturar en un sistema, llevar libros en otro y pagar proveedores en planillas genera diferencias entre ventas mostrador y declaración fiscal. AFIP exige numeración, CAE y notas vinculadas con rigor.',
    comoFunciona:
      'ERPDashboardPage resume salud financiera. FacturasPage integra AFIP (ConfiguracionAFIPPage, homologación). AsientosContablesPage registra movimientos; plan de cuentas y centros de costo alimentan reportes. Tesorería concilia bancos; impuestos calcula obligaciones. OCR extract-ticket digitaliza gastos desde foto.',
    quienUsa: 'Administración, contador externo, gerencia.',
    items: [
      { name: '/erp/facturas', desc: 'Emisión y listado facturas.', detalle: 'CrearFacturaPage, notas crédito/débito.' },
      { name: '/erp/asientos', desc: 'Libro diario.', detalle: 'Asientos manuales y automáticos desde ventas.' },
      { name: '/erp/tesoreria', desc: 'Bancos y flujo de fondos.', detalle: 'ErpCuentasBancariasPage.' },
      { name: '/erp/contabilidad', desc: 'Mayor y balances.', detalle: 'ErpContabilidadReportesPage.' },
      { name: '/erp/impuestos', desc: 'IVA, retenciones.', detalle: 'Calendario fiscal.' },
      { name: '/erp/cuentas-por-cobrar|pagar', desc: 'CxC / CxP.', detalle: 'Vinculado clientes y proveedores.' },
      { name: '/erp/stock', desc: 'Stock valorizado contable.', detalle: 'Distinto de stock operativo compras.' },
      { name: '/erp/crm', desc: 'CRM contable / clientes fiscales.', detalle: 'ErpCrmPage.' },
      { name: '/erp/gastos', desc: 'Registro gastos + OCR ticket.', detalle: 'extract-ticket API.' },
      { name: '/erp/costos', desc: 'Costeo por OP o centro.', detalle: 'Análisis margen.' },
      { name: '/erp/reportes', desc: 'Reportes financieros consolidados.', detalle: 'Export contador.' },
      { name: '/erp/admin', desc: 'Parámetros sistema ERP.', detalle: 'ErpAdminPage.' }
    ]
  },
  {
    id: 'publico',
    num: '17',
    title: 'Tótem y autoservicio en local',
    problema:
      'Filas en mostrador, clientes que solo quieren imprimir un PDF o consultar su OP, y visitantes que no saben a quién preguntar. El personal se distrae de tareas de valor y la experiencia es lenta.',
    comoFunciona:
      'TotemAutogestionHomePage guía flujos: catálogo, checkout, imprimir, consulta. TotemAutogestionPlotAiChat integra PlotAI en pantalla. Subida de archivos vía QR a /totem/subir-archivo/:session. Pagos impresión pueden marcarse en caja. Pantalla /totem/pantalla para señalética.',
    quienUsa: 'Clientes en local; mostrador supervisa; caja cierra cobros tótem.',
    items: [
      { name: '/totem', desc: 'Chat PlotAI pantalla recepción.', detalle: 'TotemChatPage.' },
      { name: '/totem/autogestion', desc: 'Menú self-service.', detalle: 'Catálogo, checkout, imprimir.' },
      { name: '/totem/consulta-cliente', desc: 'Estado OP por número/QR.', detalle: 'Misma lógica que consulta pública.' },
      { name: '/totem/subir-archivo/:session', desc: 'Upload desde celular.', detalle: 'Sesión vinculada a tótem.' },
      { name: '/totem/pantalla', desc: 'Modo display fullscreen.', detalle: 'TotemPantallaPage.' },
      { name: '/consulta-cliente', desc: 'Consulta sin login (web/local).', detalle: 'ClienteConsultaPage.' },
      { name: '/op-public/:op', desc: 'Seguimiento OP link compartido.', detalle: 'OpPublicPage — datos no sensibles.' }
    ]
  },
  {
    id: 'atencion',
    num: '18',
    title: 'Atención al público, reclamos y satisfacción',
    problema:
      'Reclamos por redes sociales se pierden; no hay registro central ni medición de satisfacción post-entrega. Atención telefónica y presencial compiten sin cola ni priorización.',
    comoFunciona:
      'AtencionPublicoDashboardPage gestiona cola y embed de chat para plotcenter.com.ar (código iframe documentado en pantalla). ReclamosPublicoPage y /cliente/reclamos capturan casos. SatisfaccionClientePublicPage envía encuesta tras entrega (API satisfaccion-entrega-informe). MensajeriaProofVerifyPage valida comprobantes.',
    quienUsa: 'Atención al público, mostrador, clientes.',
    items: [
      { name: '/atencion-publico', desc: 'Dashboard cola y embeds.', detalle: 'RegistrarAtencionModal.' },
      { name: '/reclamos', desc: 'Formulario público reclamos.', detalle: 'Trazabilidad y respuesta.' },
      { name: '/satisfaccion-cliente', desc: 'Encuesta NPS/satisfacción.', detalle: 'Post-entrega automatizable.' },
      { name: '/mensajeria', desc: 'Mensajes a clientes staff.', detalle: 'Comprobante entrega digital.' },
      { name: '/mensajeria/verificar/:token', desc: 'Cliente verifica autenticidad.', detalle: 'MensajeriaProofVerifyPage.' },
      { name: '/embed/chat-widget', desc: 'Widget web Plot Center.', detalle: 'PlotAI busca trabajos por nombre empresa.' }
    ]
  },
  {
    id: 'comunicacion',
    num: '19',
    title: 'Chat, notificaciones e integraciones',
    problema:
      'Coordinar en grupos de WhatsApp mezcla vida personal y laboral; no queda historial vinculado a la OP ni alertas automáticas de agenda o orden lista.',
    comoFunciona:
      'ChatPage persiste en chat_messages. NotificationsDropdown centraliza avisos. Telegram webhook envía recordatorios de agenda (cron agenda-telegram-reminders). notify-orden-lista API dispara aviso al cliente. Work pool tiene work_pool_notificar_operario para externos.',
    quienUsa: 'Todo el staff; clientes en mensajería; operarios externos.',
    items: [
      { name: '/chat', desc: 'Chat interno persistente.', detalle: 'Canales por equipo o tema.' },
      { name: 'Notificaciones', desc: 'notificaciones tabla + dropdown.', detalle: 'Navegación directa a OP o permiso.' },
      { name: 'Telegram', desc: '/api/telegram/webhook.', detalle: 'Recordatorios citas asesor/agenda.' },
      { name: 'notify-orden-lista', desc: 'Aviso automático cliente.', detalle: 'Cuando OP pasa a lista en mostrador.' },
      { name: 'Realtime Supabase', desc: 'Sync tablero multiusuario.', detalle: 'Varios operadores mismas columnas.' }
    ]
  },
  {
    id: 'documentacion',
    num: '20',
    title: 'Libro de actas, protocolos y flota',
    problema:
      'Actas de reunión en PDF sueltos y vehículos de instalación sin ubicación dificultan coordinar obra y cumplir protocolos de seguridad documentados.',
    comoFunciona:
      'LibroActasPage indexa por sector; LibroActasSectorPage guarda entradas cronológicas. ProtocolosBasesPage centraliza documentos operativos. FlotaPage muestra mapa (Leaflet + flotaGeocode); FlotaAdminDashboard administra unidades.',
    quienUsa: 'Jefes de sector, instalaciones, gerencia.',
    items: [
      { name: '/libro-actas', desc: 'Índice actas por sector.', detalle: 'Registro decisiones y acuerdos.' },
      { name: '/protocolos-bases', desc: 'Documentación operativa.', detalle: 'Procedimientos obligatorios.' },
      { name: '/flota', desc: 'Mapa vehículos.', detalle: 'Instalaciones sigue cuadrillas.' },
      { name: '/flota/admin', desc: 'ABM flota.', detalle: 'Conductores, mantenimiento.' }
    ]
  },
  {
    id: 'herramientas',
    num: '21',
    title: 'Herramientas Plot Center (externas)',
    problema:
      'Redimensionar arte, sacar paletas, generar QR o validar WCAG en herramientas genéricas rompe estándares de Plot Center (perfiles de color, márgenes, accesibilidad de carteles municipales).',
    comoFunciona:
      'HerramientaPage enlaza subdominios especializados. El header y tablero derivan según necesidad. Vía Pública es app aparte para señalética urbana del municipio/Plot Center.',
    quienUsa: 'Diseño, producción, marketing, presupuestos (vía pública).',
    items: [
      { name: 'tools.plotcenter.com.ar', desc: 'Suite producción general.', detalle: 'Calculadoras, utilidades taller.' },
      { name: 'aitools.plotcenter.com.ar', desc: 'IA creativa y automatización.', detalle: 'Complemento PlotAI interno.' },
      { name: 'resizer.plotcenter.com.ar', desc: 'Studio Resizer Pro.', detalle: 'Multi-formato, encuadre, batch.' },
      { name: 'extractor.plotcenter.com.ar', desc: 'Color Intelligence Studio.', detalle: 'Paletas desde imagen cliente.' },
      { name: 'qr.plotcenter.com.ar', desc: 'QR + WhatsApp.', detalle: 'Cartelería con contacto directo.' },
      { name: 'generadorqr.plotcenter.com.ar', desc: 'QR estilizado.', detalle: 'Colores marca, descarga PNG.' },
      { name: 'wcag.plotcenter.com.ar', desc: 'Contraste WCAG 2.1.', detalle: 'Obligatorio en trabajos municipales.' },
      { name: 'vp-zeta-eight.vercel.app', desc: 'Vía Pública.', detalle: 'Proyecto señalética — header staff.' },
      { name: '/herramienta', desc: 'Portal enlaces en Plot Lab.', detalle: 'Acceso unificado desde staff.' }
    ]
  },
  {
    id: 'admin-tecnico',
    num: '22',
    title: 'Administración técnica, backup y APIs',
    problema:
      'Sin respaldo de fichas activas, export administrativo ni APIs seguras, un error humano o caída de servicio puede perder estado del tablero o exponer credenciales en el frontend.',
    comoFunciona:
      'UsuariosPage gestiona roles. admin.html concentra reportes pesados. APIs Vercel ejecutan backup JSON, PDF fichas activas, auth JWT. n8n puede automatizar flujos externos (docs/n8n-integration.md). Legacy PHP fallback en api.ts para migración gradual.',
    quienUsa: 'Administración, DevOps, integradores.',
    items: [
      { name: '/usuarios', desc: 'CRUD usuarios y roles.', detalle: 'bcrypt, sectores asignados.' },
      { name: 'admin.html', desc: 'AdminDashboard, AdminReports.', detalle: 'Bundle liviano reportes.' },
      { name: '/api/admin/backup-json', desc: 'Respaldo datos.', detalle: 'Programable o manual.' },
      { name: '/api/admin/fichas-activas-pdf', desc: 'PDF tablero activo.', detalle: 'Reunión producción diaria.' },
      { name: 'n8n', desc: 'Automatización workflows.', detalle: 'Webhooks Plot Lab ↔ externos.' },
      { name: 'ErrorBoundary + EnvDebug', desc: 'Estabilidad y debug dev.', detalle: 'Captura errores React.' }
    ]
  },
  {
    id: 'datos',
    num: '23',
    title: 'Modelo de datos e integraciones',
    problema:
      'Datos en silos impiden responder “¿cuánto ganamos en esta OP?” ni vincular pedido web, producción y factura. Un modelo relacional en Supabase une el ciclo completo.',
    comoFunciona:
      'Núcleo: ordenes_trabajo + orden_sectores + tareas. Ventas y CRM en ventas/oportunidades. Clientes web en pedidos_clientes. Work pool en work_pool_*. ERP en tablas contables y facturas AFIP. RPC encapsula lógica (login_usuario, work_pool_crear_job, etc.). Storage para CVs y adjuntos.',
    quienUsa: 'Desarrollo, administración, reporting.',
    items: [
      { name: 'ordenes_trabajo / tareas', desc: 'Núcleo OP y tablero.', detalle: 'Realtime sync.' },
      { name: 'pedidos_clientes / briefs_publicos', desc: 'Canal web.', detalle: 'Conversión a OP.' },
      { name: 'work_pool_*', desc: 'Bolsa trabajos.', detalle: '4 tablas principales.' },
      { name: 'usuarios / usuario_sectores', desc: 'Auth y permisos sector.', detalle: 'sectorPermissions en UI.' },
      { name: 'solicitudes_permisos / asistencia', desc: 'RRHH operativo.', detalle: 'Vinculado reloj.' },
      { name: 'AFIP / facturas', desc: 'Cumplimiento fiscal.', detalle: 'Ver docs/HOMOLOGACION_AFIP.md.' },
      { name: 'Integraciones', desc: 'AFIP, MercadoPago, Telegram, Gemini, ElevenLabs.', detalle: 'Claves solo en Vercel env.' }
    ]
  }
]

export const diagrams = {
  arch: `<svg viewBox="0 0 560 220" xmlns="http://www.w3.org/2000/svg" class="diagram-svg">
    <text x="280" y="22" text-anchor="middle" font-size="11" font-weight="700" fill="#111">ENTRADAS Y CAPAS</text>
    <rect x="20" y="35" width="100" height="40" rx="6" fill="#f8fafc" stroke="#334155" stroke-width="1.5"/>
    <text x="70" y="58" text-anchor="middle" font-size="9" fill="#111">index.html</text>
    <rect x="140" y="35" width="90" height="40" rx="6" fill="#f8fafc" stroke="#334155"/>
    <text x="185" y="58" text-anchor="middle" font-size="9" fill="#111">admin.html</text>
    <rect x="250" y="35" width="100" height="40" rx="6" fill="#f8fafc" stroke="#334155"/>
    <text x="300" y="58" text-anchor="middle" font-size="8" fill="#111">tablet-firma</text>
    <rect x="370" y="35" width="170" height="40" rx="6" fill="#fff7ed" stroke="#eb671b" stroke-width="2"/>
    <text x="455" y="58" text-anchor="middle" font-size="9" font-weight="600" fill="#111">React Router</text>
    <rect x="30" y="100" width="115" height="44" rx="5" fill="#eff6ff" stroke="#2563eb"/><text x="87" y="120" text-anchor="middle" font-size="8" fill="#111">Staff / Tablero</text><text x="87" y="134" text-anchor="middle" font-size="7" fill="#666">ERP · Mostrador</text>
    <rect x="160" y="100" width="115" height="44" rx="5" fill="#f0fdf4" stroke="#16a34a"/><text x="217" y="120" text-anchor="middle" font-size="8" fill="#111">Operario ext.</text><text x="217" y="134" text-anchor="middle" font-size="7" fill="#666">/operario-externo</text>
    <rect x="290" y="100" width="115" height="44" rx="5" fill="#f5f3ff" stroke="#7c3aed"/><text x="347" y="120" text-anchor="middle" font-size="8" fill="#111">Cliente web</text><text x="347" y="134" text-anchor="middle" font-size="7" fill="#666">/cliente/*</text>
    <rect x="420" y="100" width="115" height="44" rx="5" fill="#ecfeff" stroke="#0891b2"/><text x="477" y="120" text-anchor="middle" font-size="8" fill="#111">Público</text><text x="477" y="134" text-anchor="middle" font-size="7" fill="#666">Tótem · Brief</text>
    <line x1="280" y1="75" x2="280" y2="95" stroke="#94a3b8" stroke-width="1.5"/>
    <rect x="130" y="165" width="300" height="40" rx="6" fill="#f1f5f9" stroke="#64748b" stroke-width="2"/>
    <text x="280" y="182" text-anchor="middle" font-size="9" font-weight="600" fill="#111">Supabase + APIs Vercel (/api/*)</text>
    <text x="280" y="196" text-anchor="middle" font-size="7" fill="#666">PostgreSQL · Storage · Realtime · PlotAI · Auth</text>
  </svg>`,
  auth: `<svg viewBox="0 0 520 170" xmlns="http://www.w3.org/2000/svg" class="diagram-svg">
    <rect x="20" y="30" width="90" height="36" rx="5" fill="#fff" stroke="#333"/><text x="65" y="52" text-anchor="middle" font-size="9" fill="#111">/login</text>
    <line x1="110" y1="48" x2="140" y2="48" stroke="#666"/><polygon points="135,43 145,48 135,53" fill="#666"/>
    <rect x="145" y="30" width="100" height="36" rx="5" fill="#fff7ed" stroke="#eb671b"/><text x="195" y="52" text-anchor="middle" font-size="9" fill="#111">Validar rol</text>
    <line x1="195" y1="66" x2="100" y2="105" stroke="#16a34a"/><text x="120" y="88" font-size="8" fill="#16a34a">operario-*</text>
    <rect x="40" y="105" width="120" height="32" rx="4" fill="#f0fdf4" stroke="#16a34a"/><text x="100" y="125" text-anchor="middle" font-size="8" fill="#111">/operario-externo/*</text>
    <line x1="245" y1="66" x2="245" y2="105" stroke="#eb671b"/><text x="255" y="88" font-size="8" fill="#eb671b">staff</text>
    <rect x="185" y="105" width="120" height="32" rx="4" fill="#fff7ed" stroke="#eb671b"/><text x="245" y="125" text-anchor="middle" font-size="8" fill="#111">Tablero + módulos</text>
    <line x1="245" y1="48" x2="360" y2="48" stroke="#7c3aed"/><text x="300" y="42" font-size="8" fill="#7c3aed">cliente</text>
    <rect x="365" y="30" width="130" height="36" rx="5" fill="#f5f3ff" stroke="#7c3aed"/><text x="430" y="52" text-anchor="middle" font-size="9" fill="#111">/cliente/login</text>
    <rect x="185" y="145" width="150" height="22" rx="4" fill="#f8fafc" stroke="#94a3b8"/><text x="260" y="160" text-anchor="middle" font-size="7" fill="#555">Anónimo → tótem, brief, reclamos</text>
  </svg>`,
  tablero: `<svg viewBox="0 0 540 130" xmlns="http://www.w3.org/2000/svg" class="diagram-svg">
    <text x="10" y="16" font-size="9" font-weight="600" fill="#444">CICLO DE VIDA OP EN TABLERO</text>
    <rect x="10" y="28" width="95" height="70" rx="4" fill="#fef9c3" stroke="#ca8a04"/><text x="57" y="55" text-anchor="middle" font-size="8" fill="#111">Nueva OP</text><text x="57" y="68" text-anchor="middle" font-size="7" fill="#666">Create modal</text>
    <rect x="115" y="28" width="95" height="70" rx="4" fill="#dbeafe" stroke="#2563eb"/><text x="162" y="55" text-anchor="middle" font-size="8" fill="#111">Sectores</text><text x="162" y="68" text-anchor="middle" font-size="7" fill="#666">Modo espejo</text>
    <rect x="220" y="28" width="95" height="70" rx="4" fill="#e0e7ff" stroke="#4f46e5"/><text x="267" y="55" text-anchor="middle" font-size="8" fill="#111">Producción</text><text x="267" y="68" text-anchor="middle" font-size="7" fill="#666">Etapas</text>
    <rect x="325" y="28" width="95" height="70" rx="4" fill="#dcfce7" stroke="#16a34a"/><text x="372" y="55" text-anchor="middle" font-size="8" fill="#111">Lista</text><text x="372" y="68" text-anchor="middle" font-size="7" fill="#666">Mostrador</text>
    <rect x="430" y="28" width="100" height="70" rx="4" fill="#f3f4f6" stroke="#6b7280"/><text x="480" y="55" text-anchor="middle" font-size="8" fill="#111">Entregada</text><text x="480" y="68" text-anchor="middle" font-size="7" fill="#666">Firma</text>
    <line x1="105" y1="63" x2="115" y2="63" stroke="#999"/><line x1="210" y1="63" x2="220" y2="63" stroke="#999"/><line x1="315" y1="63" x2="325" y2="63" stroke="#999"/><line x1="420" y1="63" x2="430" y2="63" stroke="#999"/>
    <text x="10" y="115" font-size="8" fill="#666">PlotAI · QR · Biblioteca · Sprint optimizer · Alertas vencimiento</text>
  </svg>`,
  workpool: `<svg viewBox="0 0 540 150" xmlns="http://www.w3.org/2000/svg" class="diagram-svg">
    <text x="10" y="16" font-size="9" font-weight="600" fill="#444">WORK POOL — TRES CAPAS</text>
    <rect x="10" y="28" width="150" height="36" rx="5" fill="#fff7ed" stroke="#eb671b"/><text x="85" y="50" text-anchor="middle" font-size="8" fill="#111">Admin /plot-design /bolsa-plot</text>
    <rect x="10" y="72" width="150" height="32" rx="5" fill="#e0e7ff" stroke="#4f46e5"/><text x="85" y="92" text-anchor="middle" font-size="8" fill="#111">Staff diseño / campo</text>
    <rect x="10" y="112" width="150" height="32" rx="5" fill="#f0fdf4" stroke="#16a34a"/><text x="85" y="132" text-anchor="middle" font-size="8" fill="#111">Operario externo aislado</text>
    <rect x="200" y="50" width="130" height="50" rx="5" fill="#f8fafc" stroke="#64748b"/><text x="265" y="72" text-anchor="middle" font-size="8" fill="#111">Fuentes</text><text x="265" y="86" text-anchor="middle" font-size="7" fill="#666">Tablero · Brief · Pedido</text>
    <rect x="360" y="50" width="80" height="50" rx="5" fill="#fef3c7" stroke="#d97706"/><text x="400" y="78" text-anchor="middle" font-size="8" fill="#111">Job</text>
    <rect x="460" y="50" width="70" height="50" rx="5" fill="#dcfce7" stroke="#16a34a"/><text x="495" y="78" text-anchor="middle" font-size="8" fill="#111">Asignado</text>
    <line x1="160" y1="46" x2="200" y2="75" stroke="#999"/><line x1="330" y1="75" x2="360" y2="75" stroke="#999"/><line x1="440" y1="75" x2="460" y2="75" stroke="#999"/>
  </svg>`,
  cliente: `<svg viewBox="0 0 520 90" xmlns="http://www.w3.org/2000/svg" class="diagram-svg">
    <rect x="10" y="25" width="75" height="40" rx="4" fill="#f5f3ff" stroke="#7c3aed"/><text x="47" y="50" text-anchor="middle" font-size="8" fill="#111">Cliente</text>
    <line x1="85" y1="45" x2="115" y2="45" stroke="#666"/><polygon points="110,40 120,45 110,50" fill="#666"/>
    <rect x="125" y="25" width="85" height="40" rx="4" fill="#fff7ed" stroke="#eb671b"/><text x="167" y="50" text-anchor="middle" font-size="8" fill="#111">Pedido web</text>
    <line x1="210" y1="45" x2="240" y2="45" stroke="#666"/><polygon points="235,40 245,45 235,50" fill="#666"/>
    <rect x="250" y="25" width="85" height="40" rx="4" fill="#dbeafe" stroke="#2563eb"/><text x="292" y="50" text-anchor="middle" font-size="8" fill="#111">Staff valida</text>
    <line x1="335" y1="45" x2="365" y2="45" stroke="#666"/><polygon points="360,40 370,45 360,50" fill="#666"/>
    <rect x="375" y="25" width="70" height="40" rx="4" fill="#dcfce7" stroke="#16a34a"/><text x="410" y="45" text-anchor="middle" font-size="8" fill="#111">OP</text><text x="410" y="58" text-anchor="middle" font-size="7" fill="#666">Tablero</text>
    <line x1="445" y1="45" x2="465" y2="45" stroke="#666"/><rect x="470" y="25" width="45" height="40" rx="4" fill="#f0fdf4" stroke="#16a34a"/><text x="492" y="50" text-anchor="middle" font-size="7" fill="#111">Bolsa</text>
  </svg>`,
  entrega: `<svg viewBox="0 0 520 100" xmlns="http://www.w3.org/2000/svg" class="diagram-svg">
    <rect x="10" y="30" width="90" height="40" rx="4" fill="#dcfce7" stroke="#16a34a"/><text x="55" y="55" text-anchor="middle" font-size="8" fill="#111">OP lista</text>
    <line x1="100" y1="50" x2="125" y2="50" stroke="#666"/><polygon points="120,45 130,50 120,55" fill="#666"/>
    <rect x="135" y="30" width="90" height="40" rx="4" fill="#fff7ed" stroke="#eb671b"/><text x="180" y="55" text-anchor="middle" font-size="8" fill="#111">Mostrador</text>
    <line x1="225" y1="50" x2="250" y2="50" stroke="#666"/><polygon points="245,45 255,50 245,55" fill="#666"/>
    <rect x="260" y="30" width="90" height="40" rx="4" fill="#dbeafe" stroke="#2563eb"/><text x="305" y="50" text-anchor="middle" font-size="8" fill="#111">Entrega +</text><text x="305" y="62" text-anchor="middle" font-size="7" fill="#666">firma tablet</text>
    <line x1="350" y1="50" x2="375" y2="50" stroke="#666"/><polygon points="370,45 380,50 370,55" fill="#666"/>
    <rect x="385" y="30" width="125" height="40" rx="4" fill="#f5f3ff" stroke="#7c3aed"/><text x="447" y="50" text-anchor="middle" font-size="8" fill="#111">Comprobante +</text>    <text x="447" y="62" text-anchor="middle" font-size="7" fill="#666">satisfacción</text>
  </svg>`,
  'cc-libro': `<svg viewBox="0 0 480 100" xmlns="http://www.w3.org/2000/svg" class="diagram-svg">
    <text x="240" y="14" text-anchor="middle" font-size="9" font-weight="600" fill="#444">CUENTA CORRIENTE — LIBRO</text>
    <rect x="20" y="28" width="130" height="36" rx="4" fill="#fee2e2" stroke="#dc2626"/><text x="85" y="50" text-anchor="middle" font-size="8" fill="#111">Venta CC → DEBE</text>
    <rect x="175" y="28" width="130" height="36" rx="4" fill="#dcfce7" stroke="#16a34a"/><text x="240" y="50" text-anchor="middle" font-size="8" fill="#111">Pago → HABER</text>
    <rect x="330" y="28" width="130" height="36" rx="4" fill="#fef3c7" stroke="#d97706"/><text x="395" y="50" text-anchor="middle" font-size="8" fill="#111">Interés → DEBE</text>
    <text x="240" y="88" text-anchor="middle" font-size="7" fill="#666">saldo_actual en ficha · scoring tras cada movimiento</text>
  </svg>`
}
