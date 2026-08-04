# Cómo funciona PlotLab — Catálogo completo de funciones y herramientas

**Documento funcional exhaustivo — Plot Center**  
Versión: agosto 2026 · Producción: `plotcenterlab.com.ar`  
Complemento técnico: `docs/INFORME_INFRAESTRUCTURA.md`

Este documento lista **todas** las áreas, pantallas, herramientas y superficies públicas de PlotLab (Plotrello), no solo el resumen ejecutivo.

---

## 1. Qué es PlotLab

PlotLab es el **sistema operativo** de Plot Center: producción gráfica, ventas, caja, ERP, compras, RRHH, portal de clientes, tótem de autogestión, flota, chat, IA y herramientas creativas en una sola plataforma.

- **Frontend:** React 19 + TypeScript + Vite (SPA + varias apps hermanas)
- **Datos:** Supabase (PostgreSQL, Storage, Realtime, ~263 RPC)
- **APIs:** Vercel serverless (`/api/*`)
- **Dominio:** `plotcenterlab.com.ar`

### 1.1 Aplicaciones de entrada (multi-SPA)

| App | Archivo / URL | Uso |
|-----|---------------|-----|
| App principal staff + público | `index.html` → `/` | Tablero, módulos, tótem, portal, QR, etc. |
| Panel ejecutivo | `admin.html` | Resumen gerencial / tablero embebido |
| Tablet reloj | `tablet-reloj.html` | Fichaje facial / asistencia |
| Tablet firma | `tablet-firma.html` | Firma de entrega en tablet |

---

## 2. Quiénes lo usan

| Identidad | Entrada | Alcance |
|-----------|---------|---------|
| Staff interno | `/login` | Módulos según rol |
| Operario externo diseño | `/operario-externo/login` → Plot Design | Bolsa creativa acotada |
| Operario externo bolsa | `/operario-externo/login` → Bolsa Plot | Instalaciones / metalúrgica |
| Cliente web | `/cliente/login` | Portal pedidos, presupuestos, OP, chat |
| Público sin cuenta | Rutas abiertas | Tótem, QR OP, briefs, CV, firma, encuestas |

### 2.1 Roles staff

`administracion` · `gerencia` · `mostrador` · `caja` · `presupuestos` · `asesor-tecnico` · `diseno` · `imprenta` · `taller-grafico` · `instalaciones` · `metalurgica` · `compras` · `recursos-humanos` · `operario-diseno` · `operario-bolsa`

**Regla de caja:** cada caja operativa = un usuario (`u-{id}`). El titular opera su caja; admin/gerencia pueden administrar. Fondo fijo opcional (no se autoasigna).

---

## 3. Menú de módulos (`/menu`)

Tarjetas según permisos:

| Módulo | Ruta | Para qué |
|--------|------|----------|
| Pedidos tótem (impresión) | `/impresoras/totem` | Cola del kiosco |
| Mostrador | `/mostrador/dashboard` | Entregas, ventas, clientes |
| Caja | `/caja/dashboard` | Arqueo y cierre |
| Compras | `/compras/dashboard` | Pedidos y stock |
| ERP | `/erp` | Contabilidad / AFIP |
| Presupuestos | `/asesor-presupuestos` | Fichas y oportunidades |
| RRHH | `/rrhh/dashboard` | Personal |
| Tablero | `/` | Kanban OP |
| Atención al público | `/atencion-publico` | Reclamos / cola |

Además, el **header** ofrece accesos rápidos por rol (dashboard del rol, Plot Design, Bolsa Plot, Plot AI, menú diario, flota, permisos, productos, Vía Pública, atención, etc.).

---

## 4. Producción y órdenes de trabajo

### 4.1 Tablero Kanban

| Función | Ruta / dónde |
|---------|--------------|
| Tablero principal | `/`, `/tablero` |
| Vista detalle OP | `/op/:opNumber` |
| Kanban por etapa/sector | `/kanban-etapas/:slug` |
| Estadísticas del tablero | `/statistics` |
| Calendario de entregas/vencimientos | `/calendario` |
| Gantt de producción | `/gantt` |
| OPs eliminadas (auditoría/restauración) | `/op-eliminadas` |
| Consulta OP (staff) | `/consulta-cliente` |

**Columnas típicas:** Diseño Gráfico · Diseño en Proceso · En Espera · Imprenta · Taller de Imprenta · Taller Gráfico · Instalaciones · Metalúrgica · Finalizado en Taller · Almacén de Entrega.

**Sobre cada OP / tarjeta (capacidades):**

- Drag & drop entre columnas / sectores
- Fotos y miniaturas; adjuntos
- Comentarios e historial de movimientos
- Subítems / tareas
- Líneas m², materiales, costos
- Relevamiento (notas + checklist)
- Recomendación PlotAI por ficha
- Impresión **QR cliente** (PDF A4 + **ticket térmico ~80 mm** + guardar imagen)
- Multi-sector / fichas de grupo
- Firma de entrega (flujo + tablet firma)
- Búsqueda de OP (incluye traer de BD si no está en el listado cargado)
- Scroll de columnas con carga incremental

### 4.2 Asesor técnico y presupuestos

| Función | Ruta |
|---------|------|
| Kanban Asesor → Presupuestos → Finalizado (fichas No OP) | `/asesor-presupuestos` |
| Alias corto | `/as` |

Crear/editar/eliminar fichas, filtros, sincronización de tasks, conversión a producción.

### 4.3 Plot Design y Bolsa Plot (work pool)

| Función | Ruta |
|---------|------|
| Admin Plot Design (bolsa creativa) | `/plot-design` |
| Admin Bolsa Plot (instalaciones/metalúrgica) | `/bolsa-plot` |
| Redirect legacy | `/bolsa` |
| App campo instalaciones | `/app-campo` |
| Solicitud operario bolsa (pública) | `/operario-bolsa/solicitud` |
| Panel operario externo | `/operario-externo`, `/operario-externo/diseno`, `/operario-externo/bolsa` |
| Landing pública phi (Plot Design) | `https://phi-omega-one.vercel.app/` (también `/phi` en app) |

Incluye: fuentes de entrada, clasificación de tareas, recomendaciones a operarios, mensajes, postulación a trabajos.

### 4.4 Diseño gráfico (sector)

| Función | Ruta |
|---------|------|
| Dashboard diseño | `/diseno/dashboard`, `/diseno` |
| Plot AI Studio | `/diseno/plot-ai` |
| Galería | `/galeria`, `/galeria-trabajos` |
| Briefs pendientes | `/briefs-pendientes` |

### 4.5 Plot AI Studio (herramientas creativas Gemini)

Ruta: `/diseno/plot-ai`

| Herramienta | Descripción |
|-------------|-------------|
| Panel principal | Accesos a todas las tools |
| Asistente de chat | Brainstorming, textos, consultas creativas |
| Generador de imágenes | Piezas desde descripción |
| Editor de imágenes | Edición por instrucciones de texto |
| Generador de videos | Videos cortos (Veo si habilitado) |
| Análisis profundo | Estrategias, guiones, briefs (Gemini Pro) |
| Búsqueda en tiempo real | Info web con grounding |
| Texto a voz | Locuciones |

### 4.6 Herramientas web Plot Center (externas, enlazadas)

Desde `/herramienta`, dashboard diseño, Plot AI Studio y panel admin:

| Herramienta | URL |
|-------------|-----|
| Herramientas Plot Center | https://tools.plotcenter.com.ar/ |
| AI Tools | https://aitools.plotcenter.com.ar/ |
| Generador QR / Link WhatsApp | https://qr.plotcenter.com.ar/ |
| Generador de Códigos QR | https://generadorqr.plotcenter.com.ar/ |
| Verificador contraste WCAG | https://wcag.plotcenter.com.ar/ |
| Studio Resizer Pro | https://resizer.plotcenter.com.ar/ |
| Color Intelligence Studio | https://extractor.plotcenter.com.ar/ |
| Vía Pública | https://vp-zeta-eight.vercel.app/ |

Página hub interna: `/herramienta`.

---

## 5. Mostrador, clientes, ventas y atención

### 5.1 Mostrador

| Función | Ruta |
|---------|------|
| Dashboard mostrador | `/mostrador`, `/mostrador/dashboard` |
| Órdenes listas para entrega | `/mostrador/ordenes-listas` |
| Flujo de entrega | `/mostrador/entrega/:id` |
| Buscar cliente | `/mostrador/buscar-cliente` |
| Calendario de entregas | `/mostrador/calendario` |
| Reportes mostrador | `/mostrador/reportes` |
| Ventas (alias mostrador) | `/mostrador/ventas` |
| Reportes ventas | `/mostrador/ventas/reportes` |
| Clientes frecuentes | `/mostrador/clientes-frecuentes` |
| Cuenta corriente | `/mostrador/cuenta-corriente`, `.../cliente/:idCliente` |

Desde el dashboard también se llega a: nueva venta, clientes web, artículos, pedidos portal, pedidos tótem, atención al público, tablero.

### 5.2 CRM clientes

| Función | Ruta |
|---------|------|
| Dashboard clientes | `/clientes/dashboard` |
| Buscar | `/clientes/buscar` |
| Perfil | `/clientes/cliente/:idCliente` |
| Frecuentes | `/clientes/frecuentes` |
| Agregar | `/clientes/agregar` |
| Cuenta corriente | `/clientes/cuenta-corriente`, `.../cliente/:idCliente` |

### 5.3 Ventas (CRM)

| Función | Ruta |
|---------|------|
| Ventas / cobros | `/ventas` |
| Reportes de ventas | `/ventas/reportes` |
| Aliases legacy | `/crm-ventas`, `/crm-ventas/reportes` |

Al cobrar, puede **sincronizar movimiento a caja** (`plotlab_venta`).

### 5.4 Atención al público

| Función | Ruta |
|---------|------|
| Dashboard atención / reclamos | `/atencion-publico` |
| Reclamos públicos | `/reclamos` |
| Satisfacción entrega (público) | `/satisfaccion-cliente` |
| Presence / PlotAI atención | API `plotai/atencion-presence`, informe satisfacción |

---

## 6. Portal de clientes web (admin + cliente)

### 6.1 Admin / staff — Clientes web

| Función | Ruta |
|---------|------|
| Dashboard | `/clientes-web/dashboard` |
| Gestión clientes web | `/clientes-web/gestion` |
| Pedidos portal | `/clientes-web/pedidos` |
| Detalle pedido | `/clientes-web/pedidos/:id/detalle` |
| Convertir pedido → OP | `/clientes-web/pedidos/:id/convertir` |
| Artículos empresa (catálogo) | `/clientes-web/articulos` |
| Categorías artículos | `/clientes-web/categorias` |
| Presupuestos clientes | `/clientes-web/presupuestos` |
| Detalle presupuesto | `/clientes-web/presupuestos/:id` |

### 6.2 App del cliente (`/cliente/*`)

| Función | Ruta |
|---------|------|
| Login | `/cliente/login` |
| Dashboard | `/cliente/dashboard` |
| Catálogo | `/cliente/catalogo` |
| Carrito | `/cliente/carrito` |
| Checkout | `/cliente/checkout` |
| Detalle pedido | `/cliente/pedido/:id` |
| Presupuestos | `/cliente/presupuestos` |
| Nuevo / editar / detalle presupuesto | `/cliente/presupuesto/...` |
| Buscar OP | `/cliente/buscar-op/:numeroOp?` |
| Mensajes | `/cliente/mensajes/:idPedido?` |
| Diseños / briefs | `/cliente/disenos`, `/cliente/brief/:token` |
| Reclamos | `/cliente/reclamos` |
| Chat | `/cliente/chat` |
| Notificaciones | `/cliente/notificaciones` |
| Ayuda | `/cliente/ayuda` |

Pagos: Mercado Pago (`/api/mp/checkout`, status, webhook) + fulfillment portal.

---

## 7. Tótem de autogestión y pantallas de salón

### 7.1 Autogestión (kiosco)

| Función | Ruta |
|---------|------|
| Shell / home tótem | `/totem` |
| Home autogestión | `/totem/autogestion` |
| **Imprimir** (subir por QR, cotizar, pagar) | `/totem/autogestion/imprimir` |
| Subir archivo desde celular (sesión QR) | `/totem/subir-archivo/:sessionId` |
| **Averiguar OP** | `/totem/consulta-cliente` |
| Entrada taller (señalética) | `/totem/consulta-cliente/entrada-taller` |
| **Catálogo / elegir productos** | `/totem/autogestion/catalogo` |
| Checkout autogestión | `/totem/autogestion/checkout` |
| Diseño desde tótem | `/totem/diseno` |
| Brief diseño tótem | `/totem/diseno/brief` |
| Finalizado taller | `/totem/finalizado-taller` |
| Chat tótem | (TotemChatPage / flujos relacionados) |
| PlotAI en kiosco (chat/voz) | componente + API `totem-live-context`, `live-voice`, TTS |

**Imprimir — detalle:** cotización (`/api/totem/cotizar-impresion`), Mercado Pago tótem (`mp-preference`, `mp-checkout`, status, webhook), cola staff, preview de impresión, pago caja/MP.

### 7.2 Tablets y pantallas

| Función | Ruta |
|---------|------|
| Pantalla informativa de salón | `/totem/pantalla` |
| Tablet asesor | `/asesor` |
| Tablet diseñador | `/disenador` |
| Dashboard pantallas internas | `/dashboard-pantallas` |
| Consulta cliente (no kiosco) | `/consulta-cliente` |

### 7.3 Backoffice impresión tótem

| Función | Ruta |
|---------|------|
| Cola pedidos impresión tótem | `/impresoras/totem` |
| Estado / ocupación impresoras | `/impresoras` |

---

## 8. Seguimiento público OP y entrega

| Función | Ruta |
|---------|------|
| Seguimiento OP por QR | `/op-public/:opNumber` |
| Firma entrega cliente | `/firma-cliente/:opNumber` |
| Brief público por token | `/brief/:token` |
| Tablet firma (app) | `tablet-firma.html` |

---

## 9. Caja

| Función | Ruta |
|---------|------|
| Router caja | `/caja/dashboard` |
| Vista operativa (cajero) | `/caja/dashboard/caja` |
| Vista administración | `/caja/dashboard/admin` |

### 9.1 Secciones caja operativa

Menú · Mi arqueo · Cierre de turno · Egresos · Mis movimientos · Asistente IA  

También: sync ventas PlotLab, billetes/denominaciones, turnos, PDF arqueo/planilla/cierre, notificaciones, ownership por usuario, subida inteligente / parseo planillas, diferencias.

### 9.2 Secciones admin caja

Calendario · Cierre de turno (todas las cajas) · Egresos · Arqueos · Movimientos · Nuevo cierre · Conciliación Mercado Pago · Conciliación banco · Centro IA

---

## 10. ERP (contable / AFIP)

| Función | Ruta |
|---------|------|
| Dashboard ERP | `/erp` |
| Facturas | `/erp/facturas` |
| Nueva factura | `/erp/facturas/nueva` |
| Detalle factura | `/erp/facturas/:id` |
| Nota de crédito/débito | `/erp/facturas/:id/nota` |
| Asientos contables | `/erp/asientos` |
| Tesorería | `/erp/tesoreria` |
| Cuentas bancarias | `/erp/tesoreria/cuentas` |
| Contabilidad | `/erp/contabilidad` |
| Reportes contables | `/erp/contabilidad/reportes` |
| Impuestos | `/erp/impuestos` |
| Cuentas por cobrar | `/erp/cuentas-por-cobrar` |
| Cuentas por pagar | `/erp/cuentas-por-pagar` |
| Compras (puente ERP) | `/erp/compras` |
| Stock (puente ERP) | `/erp/stock` |
| CRM (puente ERP) | `/erp/crm` |
| Gastos (+ OCR tickets) | `/erp/gastos` |
| Plan de cuentas | `/erp/plan-cuentas` |
| Costos | `/erp/costos` |
| Reportes ERP | `/erp/reportes` |
| Admin ERP | `/erp/admin` |
| Condiciones de venta | `/erp/admin/condiciones-venta` |
| Configuración AFIP | `/erp/configuracion-afip` |

**APIs:** `/api/erp/afip-autorizar`, `/api/erp/afip-test`, `/api/erp/extract-ticket`.

---

## 11. Compras, proveedores, stock y conciliaciones

| Función | Ruta |
|---------|------|
| Dashboard compras | `/compras`, `/compras/dashboard` |
| Listado pedidos | `/compras/pedidos` |
| Detalle pedido | `/compras/pedidos/:id` |
| Crear pedido | `/compras/crear-pedido` |
| Mis pedidos | `/mis-pedidos` |
| Presupuesto compra | `/compras/presupuestos/:id` |
| Gestión de stock | `/compras/gestion-stock` |
| Reportes stock / reportes | `/compras/reportes` |
| Estadísticas compras | `/compras/estadisticas` |
| Proveedores | `/compras/proveedores` |
| Deudas proveedores | `/compras/deudas-proveedores` |
| Pagos proveedores | `/compras/pagos-proveedores` |
| Movimientos proveedores | `/compras/movimientos-proveedores` |
| Deuda CC proveedores | `/compras/deuda-cc-proveedores` |
| Conciliación bancaria | `/compras/conciliacion-bancaria` |
| Conciliación Mercado Pago | `/compras/conciliacion-mercadopago` |

Incluye parsers de extractos MP, export CSV, match de movimientos, hub finanzas proveedor.

---

## 12. Recursos Humanos (completo)

### 12.1 Panel RRHH

| Función | Ruta |
|---------|------|
| Dashboard | `/rrhh`, `/rrhh/dashboard` |
| Usuarios + legajos | `/rrhh/usuarios` |
| Desvinculaciones | `/rrhh/desvinculaciones` |
| Incidencias | `/rrhh/incidencias` |
| Novedades | `/rrhh/novedades` |
| Postulaciones | `/rrhh/postulaciones` |
| Reportes | `/rrhh/reportes` |
| Horarios / turnos | `/rrhh/horarios` |
| Liquidación | `/rrhh/liquidacion` |
| Vacaciones | `/rrhh/vacaciones` |
| Onboarding | `/rrhh/onboarding` |
| Organigrama | `/rrhh/organigrama` |
| Medicina laboral | `/rrhh/medicina` |
| Recibos (admin) | `/rrhh/recibos` |
| Clima laboral | `/rrhh/clima` |
| Evaluaciones | `/rrhh/evaluaciones` |
| Pruebas / competencias | `/rrhh/pruebas` |
| Capacitaciones (admin) | `/rrhh/capacitaciones` |
| Menú diario (admin) | `/rrhh/menu-diario` |
| Estadísticas | `/rrhh/estadisticas` |
| Permisos laborales | `/rrhh/permisos` |
| Notificaciones por audiencia | `/rrhh/notificaciones` |

### 12.2 Self-service empleado (todos / según rol)

| Función | Ruta |
|---------|------|
| Menú del día | `/menu-diario` |
| Mis recibos | `/mis-recibos` |
| Avisar ausencia / permisos | `/avisar-ausencia`, `/permisos` |
| Mis pruebas | `/mis-pruebas` |
| Capacitaciones (empleado) | `/capacitaciones` |
| Encuesta clima | `/encuesta-clima/:id` |

### 12.3 Reclutamiento público

| Función | Ruta |
|---------|------|
| Trabajá con nosotros / CV | `/trabaja-con-nosotros` |
| Convocatoria por slug | `/convocatoria/:slug` |
| Postulación operarios | `/postulacion-operarios` |

**APIs RRHH:** submit CV, extract CV, extract certificado, filter postulaciones, upload foto legajo, submit formulario externo, facial índice, marcaciones reloj.

### 12.4 Reloj / asistencia (tablet)

App: `tablet-reloj.html`

- Identificación facial / detectar / precalentar
- Marcación manual y automática
- Verificación, empleados, índice facial
- Asistencia reloj (PlotAI/API)

---

## 13. Logística, talleres e impresión

| Función | Ruta |
|---------|------|
| Flota (reservas / salidas) | `/flota` |
| Flota admin | `/flota/admin` |
| Taller gráfico dashboard | `/taller-grafico/dashboard` |
| Inventario taller gráfico | `/taller-grafico/inventario` |
| Inventario metalúrgica | `/metalurgica/inventario` |
| Impresoras | `/impresoras` |
| Cola tótem | `/impresoras/totem` |
| App campo | `/app-campo` |
| Libro de actas | `/libro-actas` |
| Actas por sector | `/libro-actas/sector/:sectorId` |
| Protocolos y bases | `/protocolos-bases` |

---

## 14. Comunicación, admin y sistemas

| Función | Ruta / acción |
|---------|----------------|
| Chat interno (canales) | `/chat` |
| Embed chat | `/embed/chat` |
| Embed chat widget | `/embed/chat-widget` |
| Mensajería + prueba lectura | `/mensajeria` |
| Verificar mensajería | `/mensajeria/verificar/:token` |
| Usuarios del sistema | `/usuarios` |
| Panel admin / módulos | `/admin` |
| Actividad de usuarios (dispositivo, pantallas) | `/admin/actividad-usuarios` |
| Manual de usuario (índice + búsqueda) | `/manual` |
| PlotAI asistente global | acción panel / servicio `plotAIService` |
| Backup JSON (órdenes, historial, usuarios) | acción admin + `/api/admin/backup-json` |
| Fichas activas PDF | acción admin + `/api/admin/fichas-activas-pdf` |
| Panel ejecutivo | `admin.html` |
| Notificar orden lista | `/api/notify-orden-lista` |
| Telegram webhook / recordatorios agenda | `/api/telegram/webhook`, cron agenda |

### 14.1 Capacidades PlotAI transversales

Además del Studio y el tótem:

- Asistente con contexto de tablero / toda la plataforma
- Recomendaciones por ficha OP
- Sprint: predict, report, snapshot
- Brief completo / especificación de pedido
- Chat público FAQ
- Conversation respuestas
- Design studio API
- Generate content / image / video
- ElevenLabs TTS / live voice
- Informe satisfacción entrega
- Asistente IA de caja / centro IA / OCR planillas
- Extracción CV / certificados / tickets de gasto

---

## 15. Autenticación y actividad

| Función | Endpoint / ruta |
|---------|-----------------|
| Login staff | `/login` + RPC `login_usuario` + `/api/auth/staff-login` |
| Sesión JWT staff | `/api/auth/staff-session` |
| Actividad plataforma | `/api/auth/platform-activity` |
| Login cliente | `/cliente/login` |
| Login operario externo | `/operario-externo/login` |

---

## 16. Catálogo del panel admin (módulos destacados)

El panel `/admin` agrupa por categoría:

1. **Producción & OPs** — Tablero, estadísticas, asesor, Plot Design, phi, Bolsa Plot, dashboard diseño, Plot AI Studio, tools QR/WCAG/resizer/color, calendario, Gantt, galería, briefs  
2. **Ventas** — Clientes, ventas, mostrador, CC, atención, clientes web  
3. **Finanzas & Caja** — Caja, ERP, conciliación banco, conciliación MP  
4. **Compras & Stock** — Compras, stock, proveedores  
5. **RRHH** — Dashboard, postulaciones, incidencias, menú diario  
6. **Logística & Talleres** — Flota, taller, metalúrgica, impresoras  
7. **Administración & Sistemas** — Usuarios, actividad, estadísticas, OPs eliminadas, manual, PlotAI, chat, mensajería, protocolos, panel ejecutivo, backup, PDF fichas  

---

## 17. Flujos de punta a punta

### 17.1 Pedido en mostrador
Cliente → venta/OP → tablero por sectores → QR al cliente → cobro caja/CC → entrega/firma → (opcional) factura AFIP.

### 17.2 Tótem — imprimir
Imprimir → QR subir archivo → cotizar → pagar MP/caja → cola `/impresoras/totem` → pantalla salón → imprimir → entregar.

### 17.3 Tótem / portal — productos
Catálogo → checkout → `pedidos_clientes` → admin clientes-web → convertir a OP → tablero.

### 17.4 Averiguar OP
Tótem o `/op-public` o portal buscar OP → estado real + orientación a sector.

### 17.5 Presupuesto / asesor
Ficha en `/asesor-presupuestos` → seguimiento → producción / Plot Design / bolsa.

### 17.6 Compras
Pedido compra → proveedores → stock → deudas/pagos → conciliaciones.

### 17.7 RRHH día a día
Reloj tablet → asistencia · menú diario · permisos/ausencias · recibos · capacitaciones/pruebas · postulaciones CV.

---

## 18. Integraciones

| Servicio | Uso |
|----------|-----|
| Supabase | DB, RPC, Storage, Realtime |
| Vercel | Hosting + APIs |
| Google Gemini | PlotAI, OCR, studio, sprint, tótem |
| ElevenLabs | Voz |
| Mercado Pago | Tótem, portal, conciliaciones |
| AFIP | Factura electrónica |
| Resend | Email |
| Telegram | Bots / recordatorios |
| n8n | Automatizaciones |
| phi / Vía Pública / tools.* | Sitios hermanos Plot Center |

---

## 19. Índice rápido — ¿dónde hago X?

| Quiero… | Ir a… |
|---------|--------|
| Ver producción | `/tablero` |
| Estadísticas / Gantt / calendario | `/statistics` `/gantt` `/calendario` |
| Ficha presupuesto / DT | `/asesor-presupuestos` |
| Bolsa diseño | `/plot-design` |
| Bolsa instalaciones/metal | `/bolsa-plot` |
| App campo | `/app-campo` |
| IA creativa | `/diseno/plot-ai` |
| Tools QR, color, WCAG… | `/herramienta` o links tools.* |
| Atender mostrador | `/mostrador/dashboard` |
| Entregar OP | `/mostrador/ordenes-listas` |
| Vender / cobrar | `/ventas` |
| Cuenta corriente | `/clientes/cuenta-corriente` |
| Pedidos del portal | `/clientes-web/pedidos` |
| Convertir a OP | `/clientes-web/pedidos/:id/convertir` |
| Tótem autogestión | `/totem/autogestion` |
| Cola impresión tótem | `/impresoras/totem` |
| Pantalla salón | `/totem/pantalla` |
| QR seguimiento cliente | `/op-public/{OP}` |
| Imprimir ticket QR | Modal QR en tarjeta OP |
| Mi caja | `/caja/dashboard/caja` |
| Admin cajas | `/caja/dashboard/admin` |
| Facturar AFIP | `/erp/facturas` |
| Gastos / OCR ticket | `/erp/gastos` |
| Compras / stock | `/compras/dashboard` |
| Conciliar banco / MP | `/compras/conciliacion-*` |
| RRHH completo | `/rrhh/dashboard` |
| Postulantes | `/rrhh/postulaciones` |
| Menú del día | `/menu-diario` |
| Fichar | `tablet-reloj.html` |
| Firmar entrega | `tablet-firma.html` / `/firma-cliente/...` |
| Flota | `/flota` |
| Chat | `/chat` |
| Manual | `/manual` |
| Backup / PDF fichas | Panel `/admin` |
| Actividad usuarios | `/admin/actividad-usuarios` |
| Portal cliente | `/cliente/login` |
| CV / trabaja con nosotros | `/trabaja-con-nosotros` |
| phi | `/phi` o sitio Vercel phi |

---

## 20. Glosario

| Término | Significado |
|---------|-------------|
| OP | Orden de trabajo |
| Ficha | Tarjeta flujo asesor/presupuestos (No OP) |
| Tótem | Kiosco autogestión salón |
| Plot Design / Bolsa Plot | Work pools de diseño / campo |
| PlotAI / Plot AI Studio | Asistentes y tools creativas con Gemini |
| Caja operativa | Caja = usuario titular |
| Portal | App `/cliente` |
| Clientes web | Backoffice del portal |
| phi | Landing pública Plot Design |
| RPC | Función de negocio en PostgreSQL |

---

## 21. Conclusión

PlotLab no es un único tablero: es un **ecosistema completo** (producción, comercial, autogestión en salón, portal, caja, ERP, compras, RRHH, flota, chat e IA) con **apps dedicadas** (reloj, firma, admin) y **herramientas externas** Plot Center enlazadas.

Si necesitás el detalle técnico de tablas, RPC, RLS y variables de entorno, usá `docs/INFORME_INFRAESTRUCTURA.md` junto a este catálogo funcional.

---

*Plot Center · Documento funcional completo PlotLab · agosto 2026*
