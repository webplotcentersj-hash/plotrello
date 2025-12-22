# Sistema de Presupuestos de Clientes Web

## 📋 Descripción

Sistema completo para que los clientes web puedan crear presupuestos, guardarlos como borrador y enviarlos a la empresa. Los presupuestos tienen números únicos automáticos y pueden ser convertidos a pedidos desde la administración.

## 🗄️ Instalación de Base de Datos

### Paso 1: Ejecutar el Patch SQL

Ejecuta el siguiente archivo en Supabase SQL Editor:

```
supabase/patches/2025-01-17_create_presupuestos_clientes.sql
```

Este patch crea:
- Tabla `presupuestos_clientes` con todos los campos necesarios
- Tabla `presupuestos_clientes_items` para los artículos del presupuesto
- Función `generar_numero_presupuesto_cliente()` para números únicos (formato: PCL-YYYYMM-0001)
- Funciones RPC:
  - `crear_presupuesto_cliente()` - Crear nuevo presupuesto
  - `actualizar_presupuesto_cliente()` - Actualizar presupuesto existente
  - `enviar_presupuesto_cliente()` - Cambiar estado de borrador a enviado
  - `obtener_presupuestos_cliente()` - Listar presupuestos de un cliente
  - `obtener_detalle_presupuesto_cliente()` - Obtener detalle completo
  - `listar_presupuestos_clientes_admin()` - Listar todos los presupuestos (admin)
  - `convertir_presupuesto_a_pedido_cliente()` - Convertir presupuesto a pedido

### Paso 2: Verificar que la función `generar_numero_pedido_cliente()` existe

Esta función debe existir en tu base de datos (se crea en `2025-01-17_create_sistema_pedidos_web.sql`). Si no existe, el sistema de conversión a pedidos no funcionará.

## 🎯 Funcionalidades

### Portal de Clientes

1. **Lista de Presupuestos** (`/cliente/presupuestos`)
   - Ver todos los presupuestos del cliente
   - Filtrar por estado (borrador, enviado, aceptado, etc.)
   - Acciones: Ver detalle, Editar (si es borrador), Enviar (si es borrador)

2. **Crear/Editar Presupuesto** (`/cliente/presupuesto/nuevo` o `/cliente/presupuesto/:id/editar`)
   - Seleccionar artículos del catálogo
   - Agregar cantidades y precios
   - Agregar descripciones personalizadas
   - Fecha de vencimiento (opcional)
   - Observaciones (opcional)
   - Botones:
     - **Guardar Borrador**: Guarda sin enviar
     - **Enviar a la Empresa**: Guarda y cambia estado a "enviado"

3. **Detalle de Presupuesto** (`/cliente/presupuesto/:id`)
   - Ver información completa del presupuesto
   - Ver todos los artículos con precios
   - Ver estado actual
   - Si está en borrador, puede editar

### Administración

1. **Lista de Presupuestos** (`/clientes-web/presupuestos`)
   - Ver todos los presupuestos de todos los clientes
   - Buscar por número, cliente, empresa o email
   - Filtrar por estado
   - Ordenar por cualquier columna
   - Acción: Ver detalle

2. **Detalle de Presupuesto** (`/clientes-web/presupuestos/:id`)
   - Ver información completa del cliente
   - Ver información completa del presupuesto
   - Ver todos los artículos con precios
   - Acciones disponibles según estado:
     - **Si está enviado**: Puede aceptar o rechazar
     - **Si está enviado o aceptado**: Puede convertir a pedido
   - Campo para observaciones internas al convertir

## 🔄 Flujo de Trabajo

1. **Cliente crea presupuesto**:
   - Cliente va a `/cliente/presupuestos` → "Nuevo Presupuesto"
   - Selecciona artículos, completa información
   - Guarda como borrador o envía directamente

2. **Cliente envía presupuesto**:
   - Si estaba en borrador, puede enviarlo desde la lista o detalle
   - Al enviar, cambia a estado "enviado" y se registra fecha de envío

3. **Administración revisa**:
   - Ve el presupuesto en `/clientes-web/presupuestos`
   - Puede ver el detalle completo
   - Puede aceptar o rechazar el presupuesto

4. **Conversión a pedido**:
   - Si el presupuesto está enviado o aceptado, puede convertirlo a pedido
   - Se crea un nuevo pedido con todos los items del presupuesto
   - El presupuesto queda marcado como "convertido"
   - Se asocia el pedido al presupuesto

## 📊 Estados del Presupuesto

- **borrador**: Cliente lo está armando, no enviado
- **enviado**: Cliente lo envió a la empresa
- **aceptado**: Empresa lo aceptó
- **rechazado**: Empresa lo rechazó
- **cancelado**: Cancelado por el cliente o empresa
- **convertido**: Convertido a pedido

## 🔗 Navegación

### Desde Portal de Clientes:
- Dashboard → Botón "💰 Presupuestos"
- Menú lateral (si existe) → Presupuestos

### Desde Administración:
- Gestión de Clientes Web → Botón "💰 Presupuestos"
- O directamente: `/clientes-web/presupuestos`

## ⚠️ Notas Importantes

1. **Números únicos**: Los números de presupuesto se generan automáticamente con formato `PCL-YYYYMM-0001` y se reinician cada mes.

2. **Permisos**: Solo clientes web activos pueden crear presupuestos. Solo administradores y mostradores pueden ver la lista de presupuestos en administración.

3. **Conversión**: Solo se pueden convertir presupuestos que estén en estado "enviado" o "aceptado".

4. **Edición**: Los clientes solo pueden editar presupuestos en estado "borrador". Una vez enviados, no pueden modificarlos.

5. **Relación con pedidos**: Cuando se convierte un presupuesto a pedido, se crea un nuevo pedido y se asocia al presupuesto. El presupuesto queda marcado como "convertido".

## 🐛 Solución de Problemas

### Error: "No se puede convertir presupuesto"
- Verifica que el presupuesto esté en estado "enviado" o "aceptado"
- Verifica que la función `generar_numero_pedido_cliente()` exista en la base de datos

### Error: "Cliente no encontrado o inactivo"
- Verifica que el cliente tenga `es_cliente_web = true` y `activo = true`

### Los presupuestos no aparecen
- Verifica que el cliente esté autenticado correctamente
- Verifica que el cliente tenga `es_cliente_web = true`

## ✅ Checklist de Implementación

- [ ] Ejecutar patch SQL en Supabase
- [ ] Verificar que todas las funciones se crearon correctamente
- [ ] Verificar que las tablas tienen los índices correctos
- [ ] Probar crear un presupuesto desde el portal de clientes
- [ ] Probar guardar como borrador
- [ ] Probar enviar presupuesto
- [ ] Probar ver presupuestos en administración
- [ ] Probar convertir presupuesto a pedido
- [ ] Verificar que los números únicos se generan correctamente

