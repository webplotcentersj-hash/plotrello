# Manual Plotrello (Plot Lab)

**Plotrello** es la aplicación web de gestión de producción de **Plot Center**: tablero tipo Kanban, órdenes de trabajo (OP), chat, módulos por sector (mostrador, compras, diseño, RRHH, ERP, etc.) y portal para clientes.

> También existe el documento detallado `MANUAL_USUARIO.md` (“Trello Plot”). Este manual resume rutas, módulos y flujos principales bajo el nombre **Plotrello**.

---

## Contenido

1. [Acceso](#1-acceso)
2. [Pantalla principal y menú](#2-pantalla-principal-y-menú)
3. [Tablero y OPs](#3-tablero-y-ops)
4. [Vistas globales](#4-vistas-globales)
5. [Recursos Humanos](#5-recursos-humanos)
6. [Mostrador y ventas](#6-mostrador-y-ventas)
7. [Compras y stock](#7-compras-y-stock)
8. [Caja](#8-caja)
9. [Diseño y briefs](#9-diseño-y-briefs)
10. [Clientes web (administración)](#10-clientes-web-administración)
11. [Portal del cliente](#11-portal-del-cliente)
12. [ERP (facturación y contabilidad)](#12-erp-facturación-y-contabilidad)
13. [Flota](#13-flota)
14. [Otros](#14-otros)
15. [Enlaces públicos (sin login interno)](#15-enlaces-públicos-sin-login-interno)
16. [Consejos](#16-consejos)

---

## 1. Acceso

| Acción | Detalle |
|--------|---------|
| **Login interno** | Ruta `/login`. Con sesión iniciada entrás al tablero `/`. |
| **Sin sesión** | Si abrís una ruta protegida, verás la pantalla de login. |
| **Cliente web** | Login en `/cliente/login`; el área del cliente vive bajo `/cliente/...`. |
| **PWA** | Podés instalar la app desde el navegador (botón de actualización / instalación según el navegador). |
| **Manual en la app** | En el menú ☰ del encabezado hay opción para descargar el manual en Markdown (si está configurado en `public/`). |

---

## 2. Pantalla principal y menú

En **Plot Lab** (encabezado) tenés:

- **Reloj y clima** (widgets).
- **Notificaciones** (campana): menciones de chat y avisos.
- **Menú ☰ (acciones)**: accesos rápidos según tu rol — estadísticas, calendario, Gantt, usuarios, herramientas, mostrador, CRM ventas, compras, caja, diseño, RRHH, clientes, DT, taller gráfico, atención al público, flota, ERP, libro de actas, protocolos, galería, capacitaciones, **Mis evaluaciones**, menú diario, mis pedidos, chat, salir, etc.

Los ítems visibles dependen de **rol** y permisos (administración, mostrador, compras, RRHH, etc.).

---

## 3. Tablero y OPs

| Ruta | Uso |
|------|-----|
| `/` | Tablero Kanban principal: columnas por sector/estado, tarjetas de OP, arrastrar y soltar. |
| `/op/:opNumber` | Detalle de una orden por número de OP. |
| `/kanban-etapas/:slug` | Vista Kanban por etapa/sector según `slug`. |
| `/op-eliminadas` | Listado de OP eliminadas (requiere sesión). |

**Flujo típico:** crear o mover tarjetas, abrir OP para ver datos, materiales, historial y enlaces (QR, vista pública si aplica).

---

## 4. Vistas globales

| Ruta | Descripción |
|------|-------------|
| `/statistics` | Estadísticas y métricas sobre tareas y actividad. |
| `/calendario` | Calendario de trabajos. |
| `/gantt` | Diagrama de Gantt. |
| `/chat` | Chat interno entre el equipo (canales/mensajes según implementación). |
| `/usuarios` | Gestión de usuarios (según permisos). |
| `/impresoras` | Estado/ocupación de impresoras. Botón flotante 🖨️ en el tablero. |
| `/herramienta` | Herramientas personalizadas. |

---

## 5. Recursos Humanos

Entrada típica: menú ☰ → **Recursos Humanos** o `/rrhh/dashboard`.

| Ruta | Módulo |
|------|--------|
| `/rrhh/dashboard` | Panel RRHH, accesos rápidos. |
| `/rrhh/usuarios` | Usuarios / legajos. |
| `/rrhh/reportes` | Reportes de personal. |
| `/rrhh/horarios` | Horarios y turnos. |
| `/rrhh/evaluaciones` | Evaluaciones de desempeño. |
| `/rrhh/pruebas` | **Pruebas de conocimiento**: crear evaluaciones (preguntas desarrollo o multiple choice), tiempos, puntos, % de aprobación, asignar a usuarios, ver resultados y calificar desarrollo. |
| `/rrhh/capacitaciones` | Gestión de capacitaciones (RRHH). |
| `/rrhh/estadisticas` | Estadísticas RRHH. |
| `/rrhh/menu-diario` | Menú diario (admin). |
| `/rrhh/permisos` | Permisos y roles. |
| `/rrhh/notificaciones` | Notificador masivo. |

**Todos los empleados**

| Ruta | Descripción |
|------|-------------|
| `/mis-pruebas` | **Mis evaluaciones**: pruebas asignadas por RRHH; iniciar, responder, enviar y ver resultado/nota. |
| `/capacitaciones` | Capacitaciones (vista empleado). |
| `/menu-diario` | Menú del día (selección de platos si aplica). |

---

## 6. Mostrador y ventas

| Ruta | Uso |
|------|-----|
| `/mostrador/dashboard` o `/mostrador` | Dashboard de mostrador. |
| `/mostrador/ordenes-listas` | Órdenes listas. |
| `/mostrador/buscar-cliente` | Búsqueda de cliente. |
| `/mostrador/entrega/:id` | Entrega por id. |
| `/mostrador/calendario` | Calendario de entregas. |
| `/mostrador/reportes` | Reportes de mostrador. |
| `/mostrador/ventas` | CRM ventas. |
| `/mostrador/ventas/reportes` | Reportes de ventas. |
| `/mostrador/clientes-frecuentes` | Clientes frecuentes. |
| `/mostrador/cuenta-corriente` | Cuenta corriente. |
| `/crm-ventas` | CRM (atajo; también desde menú). |
| `/crm-ventas/reportes` | Reportes CRM. |
| `/atencion-publico` | Dashboard atención al público. |

---

## 7. Compras y stock

| Ruta | Uso |
|------|-----|
| `/compras/dashboard` o `/compras` | Panel de compras. |
| `/compras/pedidos` | Listado de pedidos. |
| `/compras/pedidos/:id` | Detalle de un pedido de compra. |
| `/compras/crear-pedido` | Alta de pedido. |
| `/compras/gestion-stock` | Gestión de stock. |
| `/compras/proveedores` | Proveedores. |
| `/compras/presupuestos/:id` | Presupuestos de compra. |
| `/compras/calendario-entregas` | Calendario de entregas (compras). |
| `/compras/reportes` | Reportes (stock / compras según pantalla). |
| `/compras/conciliacion-bancaria` | Conciliación bancaria. |
| `/mis-pedidos` | Pedidos propios (solicitudes de productos, etc.). |

---

## 8. Caja

| Ruta | Uso |
|------|-----|
| `/caja/dashboard` | Panel de caja. |

---

## 9. Diseño y briefs

| Ruta | Uso |
|------|-----|
| `/diseno/dashboard` o `/diseno` | Dashboard de diseño. |
| `/briefs-pendientes` | Briefs pendientes. |
| `/galeria` o `/galeria-trabajos` | Galería de trabajos. |
| `/asesor-presupuestos` | Módulo DT (asesor técnico / presupuestos). |

---

## 10. Clientes web (administración)

Gestión de pedidos y catálogo que hacen los clientes por la web.

| Ruta | Uso |
|------|-----|
| `/clientes-web/dashboard` | Panel. |
| `/clientes-web/gestion` | Gestión de clientes web. |
| `/clientes-web/pedidos` | Pedidos. |
| `/clientes-web/pedidos/:id/detalle` | Detalle. |
| `/clientes-web/pedidos/:id/convertir` | Convertir pedido a OP. |
| `/clientes-web/articulos` | Artículos. |
| `/clientes-web/categorias` | Categorías. |
| `/clientes-web/presupuestos` | Presupuestos (admin). |
| `/clientes-web/presupuestos/:id` | Detalle presupuesto. |

---

## 11. Portal del cliente

Tras `/cliente/login`, rutas bajo `/cliente/`:

- `dashboard`, `catalogo`, `nuevo-pedido`, `pedido/:id`
- `presupuestos`, `presupuesto/nuevo`, `presupuesto/:id`, edición
- `buscar-op`, `mensajes`, `disenos`, `brief/:token`, `reclamos`, `chat`, `notificaciones`

---

## 12. ERP (facturación y contabilidad)

| Ruta | Uso |
|------|-----|
| `/erp` | Dashboard ERP. |
| `/erp/facturas` | Listado de facturas. |
| `/erp/facturas/nueva` | Nueva factura. |
| `/erp/facturas/:id` | Detalle. |
| `/erp/asientos` | Asientos contables. |
| `/erp/configuracion-afip` | Configuración AFIP. |

---

## 13. Flota

| Ruta | Uso |
|------|-----|
| `/flota` | Gestión de flota. |
| `/flota/admin` | Administración de flota. |

---

## 14. Otros

| Ruta | Uso |
|------|-----|
| `/taller-grafico/inventario` | Inventario taller gráfico. |
| `/taller-grafico/dashboard` | Panel niveles / dashboard TG. |
| `/libro-actas` | Libro de actas. |
| `/libro-actas/sector/:sectorId` | Actas por sector. |
| `/protocolos-bases` | Protocolos y bases documentales. |
| `/dashboard-pantallas` | Dashboard para pantallas. |
| `/consulta-cliente` | Consulta de trabajos para clientes (pantalla interna o autoservicio). |

**PlotAI:** asistente en el chat según la implementación actual (ver `MANUAL_USUARIO.md` sección PlotAI).

---

## 15. Enlaces públicos (sin login interno)

Útiles para compartir con clientes o usar en totems:

| Ruta | Descripción |
|------|-------------|
| `/op-public/:opNumber` | Vista pública de una OP. |
| `/firma-cliente/:opNumber` | Firma de cliente en OP. |
| `/brief/:token` | Brief público por token. |
| `/reclamos` | Reclamos (formulario público). |
| `/embed/chat`, `/embed/chat-widget` | Chat embebido. |
| `/totem`, `/totem/consulta-cliente` | Modo tótem / consulta. |

---

## 16. Consejos

1. **Roles:** Si no ves una opción del menú, tu usuario puede no tener el rol necesario (hablar con administración o RRHH).
2. **Sincronización:** El tablero usa datos en tiempo real; si algo no actualiza, recargá la página o revisá la conexión.
3. **Pruebas RRHH:** Las funciones de puntajes y aprobación requieren que en la base de datos estén aplicados los scripts SQL de pruebas (patches en `supabase/patches/`).
4. **Documentación ampliada:** Para capturas, atajos y troubleshooting detallado, abrí `MANUAL_USUARIO.md`.

---

*Documento generado como referencia de módulos Plotrello. Actualizá las rutas si el equipo agrega nuevas pantallas.*
