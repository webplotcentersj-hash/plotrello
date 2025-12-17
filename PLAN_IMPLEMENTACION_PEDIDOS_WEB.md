# 📋 Plan de Implementación - Sistema de Pedidos Web

## FASE 1 - MVP (Funcionalidad Básica)

### 1. Base de Datos
- [x] Tabla `clientes` (autenticación y datos)
- [x] Tabla `articulos_empresa` (catálogo)
- [x] Tabla `pedidos_clientes` (pedidos principales)
- [x] Tabla `pedidos_clientes_items` (artículos del pedido)
- [x] Tabla `pedidos_clientes_archivos` (archivos adjuntos)
- [x] Agregar campos a `ordenes_trabajo` (id_pedido_cliente, origen_pedido_web)

### 2. Autenticación de Clientes
- [x] Sistema de login para clientes
- [x] Registro manual (solo trabajadores pueden crear clientes)
- [x] Gestión de clientes desde RRHH o Admin

### 3. Gestión de Artículos
- [x] CRUD de artículos (para trabajadores)
- [x] Catálogo público (para clientes)
- [x] Categorías de artículos
- [x] Precios y visibilidad

### 4. Sistema de Pedidos
- [x] Crear pedido (cliente)
- [x] Ver pedidos (cliente)
- [x] Editar pedido pendiente (cliente)
- [x] Cancelar pedido pendiente (cliente)
- [x] Ver pedidos pendientes (trabajadores)
- [x] Rechazar items del pedido
- [x] Modificar precios antes de convertir
- [x] Convertir pedido a OP

### 5. Integración con OP
- [x] Crear OP desde pedido
- [x] Copiar datos del cliente
- [x] Copiar archivos adjuntos
- [x] Asociar OP al pedido
- [x] Indicador visual en tablero (OP viene de pedido web)

---

## FASE 2 - Mejoras Básicas

### 6. Historial y Auditoría
- [ ] Historial de cambios en pedidos
- [ ] Log de acciones del cliente
- [ ] Historial de conversiones

### 7. Comunicación
- [ ] Sistema de comentarios en pedidos
- [ ] Notas internas (solo trabajadores)
- [ ] Notas visibles para cliente
- [ ] Threads de conversación

### 8. Dashboard Mejorado
- [ ] Estadísticas del cliente
- [ ] Historial completo
- [ ] Filtros y búsqueda avanzada
- [ ] Exportar historial

### 9. Validaciones Avanzadas
- [ ] Validación de formatos de archivo
- [ ] Límite de tamaño
- [ ] Validación de fechas
- [ ] Validación de stock/disponibilidad

---

## FASE 3 - Funcionalidades Avanzadas

### 10. Sistema de Cotización
- [ ] Generar presupuesto desde pedido
- [ ] Aprobación de presupuesto por cliente
- [ ] Historial de presupuestos
- [ ] Solo convertir si está aprobado

### 11. Reportes y Analytics
- [ ] Reportes de pedidos por cliente
- [ ] Artículos más pedidos
- [ ] Tiempo promedio de conversión
- [ ] Tasa de rechazo

### 12. Integración con Facturación
- [ ] Asociar factura a pedido/OP
- [ ] Estado de pago
- [ ] Recordatorios de pago

### 13. Favoritos y Plantillas
- [ ] Guardar pedidos como favoritos
- [ ] Reutilizar pedidos anteriores
- [ ] Pedidos recurrentes

---

## FASE 4 - Funcionalidades Premium

### 14. Sistema de Aprobaciones
- [ ] Aprobación multi-nivel
- [ ] Aprobación automática para VIP
- [ ] Reglas de aprobación por monto

### 15. Prioridades y Urgencias
- [ ] Marcar urgencia (cliente)
- [ ] Ajustar prioridad (trabajador)
- [ ] Filtros por prioridad

### 16. Referidos y Descuentos
- [ ] Códigos de descuento
- [ ] Descuentos por volumen
- [ ] Programa de referidos

### 17. Exportación e Impresión
- [ ] Imprimir pedido como PDF
- [ ] Exportar a Excel
- [ ] Etiquetas/QR codes

### 18. Notificaciones
- [ ] Notificaciones por email
- [ ] Notificaciones de cambios de estado
- [ ] Notificaciones de completado
- [ ] Notificaciones de retrasos

### 19. Timeline y Seguimiento
- [ ] Timeline visual del pedido
- [ ] Fotos del proceso
- [ ] Seguimiento avanzado

### 20. Gestión de Archivos Mejorada
- [ ] Preview de archivos
- [ ] Validación de formatos
- [ ] Galería de archivos
- [ ] Límites de tamaño

---

## Estructura de Archivos a Crear

### Backend (SQL)
- `supabase/patches/2025-01-17_create_tablas_clientes_pedidos.sql`
- `supabase/patches/2025-01-17_create_tabla_articulos_empresa.sql`
- `supabase/patches/2025-01-17_add_campos_op_pedido_web.sql`
- `supabase/patches/2025-01-17_create_funciones_pedidos_clientes.sql`

### Frontend - Clientes
- `src/pages/ClienteLoginPage.tsx`
- `src/pages/ClienteDashboardPage.tsx`
- `src/pages/ClienteCatalogoPage.tsx`
- `src/pages/ClienteCrearPedidoPage.tsx`
- `src/pages/ClientePedidoDetallePage.tsx`

### Frontend - Trabajadores
- `src/pages/PedidosClientesPage.tsx`
- `src/pages/PedidoClienteDetallePage.tsx`
- `src/pages/ArticulosEmpresaPage.tsx`

### Componentes
- `src/components/ClienteHeader.tsx`
- `src/components/ArticuloCard.tsx`
- `src/components/PedidoClienteCard.tsx`
- `src/components/ConvertirPedidoModal.tsx`

### Servicios
- `src/services/clienteAuth.ts`
- `src/services/pedidosClientesService.ts`
- `src/services/articulosService.ts`

---

## Notas de Implementación

- Los clientes tienen su propio sistema de autenticación separado
- Las rutas de cliente empiezan con `/cliente/`
- Las rutas de trabajadores empiezan con `/pedidos-clientes/`
- Los archivos de clientes se almacenan en bucket `pedidos-clientes` en Storage
- Las notificaciones por email se implementarán usando Supabase Edge Functions o servicio externo

