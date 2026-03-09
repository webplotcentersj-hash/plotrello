# Resumen de la app – Plot Lab

## 1. Estructura de rutas y páginas

### Puntos de entrada
- **`index.html`** → App principal
- **`admin.html`** → Panel Admin
- **`tablet-firma.html`** → Tablet de firma digital

### Rutas públicas (sin login)
| Ruta | Página | Descripción |
|------|--------|-------------|
| `/login` | Login | Inicio de sesión empleados |
| `/embed/chat` | EmbedChatPage | Chat embebido |
| `/embed/chat-widget` | EmbedChatWidgetPage | Widget de chat |
| `/totem` | TotemChatPage | Chat tipo totem |
| `/consulta-cliente` | ClienteConsultaPage | Consulta de clientes |
| `/dashboard-pantallas` | DashboardPantallasPage | Dashboard para pantallas |
| `/op-public/:opNumber` | OpPublicPage | Vista pública de OP |
| `/firma-cliente/:opNumber` | FirmaClientePage | Firma digital del cliente |
| `/brief/:token` | BriefPublicoPage | Formulario de brief público |
| `/reclamos` | ReclamosPublicoPage | Formulario público de reclamos (sin login) |

### Rutas de clientes web (`/cliente/*`)
| Ruta | Página |
|------|--------|
| `/cliente/login` | ClienteLoginPage |
| `/cliente/dashboard` | ClienteDashboardPage |
| `/cliente/catalogo` | ClienteCatalogoPage |
| `/cliente/nuevo-pedido` | ClienteNuevoPedidoPage |
| `/cliente/pedido/:id` | ClientePedidoDetallePage |
| `/cliente/presupuestos` | ClientePresupuestosPage |
| `/cliente/presupuesto/nuevo` | ClientePresupuestoFormPage |
| `/cliente/presupuesto/:id` | ClientePresupuestoDetallePage |
| `/cliente/buscar-op/:numeroOp?` | ClienteBuscarOpPage |
| `/cliente/mensajes/:idPedido?` | ClienteMensajesPage |

### Rutas protegidas (requieren autenticación)
| Ruta | Página |
|------|--------|
| `/` | BoardPage (tablero Kanban principal) |
| `/statistics` | StatisticsPage |
| `/calendario` | CalendarPage |
| `/gantt` | GanttPage |
| `/op/:opNumber` | OpViewPage |
| `/chat` | ChatPage |
| `/usuarios` | UsuariosPage |
| `/impresoras` | ImpresorasPage |
| `/herramienta` | HerramientaPage |
| `/mostrador/dashboard` | MostradorDashboardPage |
| `/mostrador/ordenes-listas` | OrdenesListasPage |
| `/mostrador/buscar-cliente` | BuscarClientePage |
| `/mostrador/entrega/:id` | EntregaPage |
| `/mostrador/calendario` | CalendarioEntregasPage |
| `/mostrador/reportes` | ReportesMostradorPage |
| `/mostrador/ventas` | CRMVentasPage |
| `/mostrador/ventas/reportes` | ReportesVentasPage |
| `/mostrador/clientes-frecuentes` | ClientesFrecuentesPage |
| `/mostrador/cuenta-corriente` | CuentaCorrientePage |
| `/atencion-publico` | AtencionPublicoDashboardPage |
| `/caja/dashboard` | CajaDashboardPage |
| `/compras/dashboard` | ComprasDashboardPage |
| `/compras/pedidos/:id` | PedidoCompraDetallePage |
| `/compras/gestion-stock` | GestionStockPage |
| `/compras/proveedores` | ProveedoresPage |
| `/compras/crear-pedido` | CrearPedidoCompraPage |
| `/compras/conciliacion-bancaria` | ConciliacionBancariaPage |
| `/diseno/dashboard` | DisenoDashboardPage |
| `/asesor-presupuestos` | AsesorPresupuestosPage |
| `/galeria-trabajos` | GaleriaTrabajosPage |
| `/briefs-pendientes` | BriefsPendientesPage |
| `/libro-actas` | LibroActasPage |
| `/libro-actas/sector/:sectorId` | LibroActasSectorPage |
| `/flota` | FlotaPage |
| `/flota/admin` | FlotaAdminDashboard |
| `/erp/*` | ERP (facturas, asientos, AFIP) |
| `/rrhh/*` | Recursos Humanos |
| `/clientes-web/*` | Gestión de clientes web |

---

## 2. Componentes principales

### Tablero Kanban
| Componente | Función |
|------------|---------|
| **Board** | Contenedor del tablero con drag & drop |
| **Column** | Columna droppable con tareas agrupadas por estado |
| **TaskCard** | Tarjeta de tarea con acciones, etapas por sector, checklist, QR, historial |
| **FiltersBar** | Filtros por estado, prioridad, sector y búsqueda |
| **StatsPanel** | Panel de estadísticas del tablero |
| **ActivityFeed** | Feed de actividad reciente |

### Selectores de etapa (por sector)
- **EtapaTallerGraficoSelector** – Taller Gráfico
- **EtapaInstalacionesSelector** – Instalaciones
- **EtapaTallerImprentaSelector** – Taller de Imprenta
- **EtapaImpresionDigitalSelector** – Imprenta (área de impresión)
- **EtapaMetalurgicaSelector** – Metalúrgica

### Historial de etapas
- **HistorialEtapasTallerGrafico**
- **HistorialEtapasInstalaciones**
- **HistorialEtapasTallerImprenta**
- **HistorialEtapasMetalurgica**

### Header y navegación
- **Header** – Logo, reloj, clima, notificaciones, menú de acciones
- **ClockWidget** – Hora actual
- **WeatherWidget** – Clima
- **NotificationsDropdown** – Notificaciones
- **AdminAlertButton** – Alertas para admin

### Otros componentes
- **Login** – Formulario de login
- **ClienteProtectedRoute** – Protección de rutas de clientes
- **ErrorBoundary** – Manejo de errores
- **ChatAI** / **PlotAIChat** – Chat con IA
- **PlotAIFloatingButton** – Botón flotante del chat IA
- **ChatFloatingButton** – Botón flotante del chat
- **SolicitudesPermisosFloatingButton** – Botón de solicitudes y permisos
- **Subtasks** – Checklist de subtareas
- **BriefLinkSection** – Enlace al brief
- **RevisionesSection** – Revisiones
- **TiempoTrabajoSection** – Tiempo de trabajo
- **AgendaAsesorTecnico** – Agenda del asesor técnico
- **QRPrintView** – Vista de impresión de QR

---

## 3. Funcionalidades del tablero Kanban

### Columnas (estados)
1. Diseño Gráfico
2. Diseño en Proceso
3. En Espera
4. Imprenta (Área de Impresión)
5. Taller de Imprenta
6. Taller Gráfico
7. Instalaciones
8. Metalúrgica
9. Finalizado en Taller
10. Almacén de Entrega
11. Asesor Técnico
12. Presupuestos
13. Finalizado (asesor presupuestos)

### Operaciones principales
- **Drag & drop** entre columnas con persistencia en Supabase
- **Filtros**: estado, prioridad, sector, búsqueda por OP/título/resumen
- **Atajos**: `Ctrl+K` o `/` búsqueda, `C` nueva orden, `L` biblioteca, flechas para mover ficha seleccionada, `Escape` deseleccionar
- **Sub-etapas** por sector (Taller Gráfico, Instalaciones, Taller de Imprenta, Impresión Digital, Metalúrgica)
- **Historial de etapas** por sector
- **Checklist/Subtareas** con cronómetro
- **Trabajador activo** (`workingUser`) por ficha
- **Marcar entregado** y archivar
- **Fichas No OP** (sin número de OP)
- **Duplicar fichas**
- **Vista QR** para impresión
- **Asignación a impresoras** desde la ficha
- **Menú contextual** (clic derecho): "Mover a" con columnas
- **Botones de flecha** (← →) en cada tarjeta para mover entre columnas

### Realtime
- Suscripción a `ordenes_trabajo` y `historial_movimientos`
- Evita efecto espejo con eventos `user-moved-task` y `user-edited-task`

---

## 4. Modales y diálogos

| Modal | Función |
|-------|---------|
| **TaskEditModal** | Editar ficha completa |
| **TaskCreateModal** | Crear nueva orden |
| **TaskLibraryModal** | Biblioteca de plantillas |
| **SprintOptimizerModal** | Optimización de sprint con IA |
| **FichaNoOPModal** | Crear ficha sin OP |
| **VentaRapidaModal** | Venta rápida en mostrador |
| **CrearPresupuestoModal** | Crear presupuesto |
| **BuscadorClientesModal** | Buscar clientes |
| **RegistroSalidaModal** | Registro de salida de vehículo |
| **SolicitudPermisoModal** | Solicitudes de permisos |
| **LegajoEmpleadoModal** | Editar legajo |
| **VerLegajoModal** | Ver legajo |
| **SeleccionarProductoStockModal** | Seleccionar producto de stock |
| **RegistrarAtencionModal** | Registrar atención |
| **SolicitarProductosModal** | Solicitar productos |
| **CitaModal** | Crear/editar cita (asesor técnico) |
| **QRPrintView** | Vista de impresión de QR |

---

## 5. Integraciones

### Supabase
- Cliente principal y cliente stock
- Realtime: `ordenes_trabajo`, `historial_movimientos`
- Tablas: `ordenes_trabajo`, `historial_movimientos`, `usuarios`, `sectores`, `materiales`, `firmas_entrega_cliente`, etc.

### APIs externas
- **Google Gemini**: Plot AI, Sprint Optimizer

### Librerías
- **@hello-pangea/dnd** – Drag & drop
- **date-fns** – Fechas
- **recharts** – Gráficos
- **html2canvas** + **jspdf** – Export PDF
- **qrcode** – Generación de QR
- **xlsx** – Export Excel
- **marked** – Markdown
- **bcryptjs** – Hash de contraseñas

---

## 6. Autenticación y roles

### Login
- Usuario/contraseña vía `apiService.login()`
- Datos en `localStorage`: `usuario`, `usuario_id`, `auth_token`

### Roles (`useAuth`)
| Rol | Descripción |
|-----|-------------|
| `administracion` | Admin |
| `gerencia` | Gerencia |
| `recursos-humanos` | RRHH |
| `diseno` | Diseño |
| `imprenta` | Imprenta |
| `taller-grafico` | Taller Gráfico |
| `instalaciones` | Instalaciones |
| `metalurgica` | Metalúrgica |
| `caja` | Caja |
| `mostrador` | Mostrador |
| `compras` | Compras |
| `asesor-tecnico` | Asesor Técnico |
| `presupuestos` | Presupuestos |

### Permisos
- `isAdmin`, `isMostrador`, `isCaja`, `isDiseno`, etc.
- `canManageImpresoras`, `canManageCompras`, `canManageCaja`, `canManageRecursosHumanos`, etc.
- `canAccessAtencionPublico` – cualquier usuario logueado

---

## 7. Servicios y utilidades

### Servicios principales
| Servicio | Función |
|----------|---------|
| **api.ts** | API central: órdenes, usuarios, sectores, materiales, chat, notificaciones, impresoras, pedidos de compra, stock, atención mostrador, etiquetas, revisiones, galería, legajos, actas, clientes, etc. |
| **supabaseClient.ts** | Cliente Supabase principal y stock |
| **plotAIService.ts** | Chat IA con Gemini |
| **plotAIContextService.ts** | Contexto del sistema para Plot AI |
| **plotAIKanbanContext.ts** | Contexto detallado del Kanban |
| **plotAIMemoryService.ts** | Memoria de conversaciones y patrones |
| **plotAIManualService.ts** | Manual de usuario para Plot AI |
| **plotAIGenerationService.ts** | Generación de contenido con IA |
| **geminiService.ts** | Reportes de sprint con Gemini |

### Utilidades
| Utilidad | Función |
|----------|---------|
| **dataMappers.ts** | `ordenToTask`, `taskToOrdenPayload`, mapeos de estado/prioridad |
| **exportUtils.ts** | Export a CSV y PDF |
| **crmExportUtils.ts** | Export ventas, oportunidades, facturas, pagarés |
| **dateUtils.ts** | Fechas Argentina, formateo, comparación |
| **sectorPermissions.ts** | Permisos por sector |
| **stats.ts** | Distribución de estado, throughput, carga por miembro |

---

## 8. Otras características

### Plot AI
- Chat con IA (Gemini) con contexto del Kanban
- Memoria de conversaciones y patrones
- Manual de usuario precargado
- Sugerencias basadas en tareas, actividad y equipo

### Sistema de pedidos web
- Catálogo, pedidos, presupuestos
- Conversión de pedido a OP
- Mensajes entre cliente y admin

### ERP
- Facturas (A/B/C, notas de crédito/débito)
- Asientos contables
- Configuración AFIP
- Cuentas por cobrar/pagar

### RRHH
- Usuarios, horarios, turnos
- Ausencias, asistencias
- Evaluaciones, criterios
- Capacitaciones, inscripciones
- Menú diario
- Solicitudes de permisos
- Notificaciones

### Flota
- Vehículos
- Registro de salidas (km, motivo, hora)
- Estado en uso/retrasado/finalizado

### CRM / Ventas
- Oportunidades (Prospecto → Cerrado/Perdido)
- Ventas, items
- Seguimientos
- Reportes

### Compras
- Pedidos de compra
- Proveedores
- Stock
- Conciliación bancaria

### Mostrador
- Órdenes listas
- Entrega con firma en tablet
- Cuenta corriente
- Clientes frecuentes
- Reportes

### Brief público
- Formulario por token
- Campos de brief (objetivo, público, estilo, referencias, etc.)

### Impresoras
- Ocupación
- Asignación de OP a impresora
- Historial de uso
- Gestión de impresoras (admin)

### Libro de actas
- Actas por sector
- Tipos: general, problema, mejora, incidente, reunión, capacitación

---

## 9. Variables de entorno

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_STOCK_SUPABASE_URL`, `VITE_STOCK_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL` (legacy)
- `VITE_GEMINI_API_KEY` (Plot AI)

---

## 10. Scripts NPM

| Script | Descripción |
|--------|-------------|
| `dev` | Vite dev server |
| `dev:admin` | Vite con admin.html |
| `dev:tablet-firma` | Vite con tablet-firma.html |
| `build` | Build producción |
| `build:admin` | Build admin |
| `build:tablet-firma` | Build tablet firma |
| `preview` | Preview build |
| `clear-cache`, `clean`, `clean-all` | Limpieza |

---

En conjunto, **Plot Lab** es un sistema de gestión de órdenes de trabajo tipo Kanban para una gráfica/imprenta, con ERP, CRM, RRHH, flota, clientes web, IA conversacional y múltiples módulos integrados.
