# ✅ Verificación y Ejecución para Dashboard de Caja

## 📋 Resumen

Este documento explica cómo verificar y ejecutar los scripts SQL necesarios para que el Dashboard de Caja funcione correctamente.

## 🔍 Verificación Requerida

El Dashboard de Caja necesita las siguientes tablas y funciones:

### Tablas Necesarias:
1. ✅ `ventas` - Ya existe (creada en `2025-01-21_create_crm_ventas.sql`)
2. ✅ `ventas_items` - Ya existe (creada en `2025-01-21_create_crm_ventas.sql`)
3. ⚠️ `cuentas_por_cobrar` - Necesita verificación
4. ⚠️ `cuentas_por_pagar` - Necesita verificación
5. ⚠️ `plan_cuentas` - Necesita verificación (para flujo de caja)
6. ⚠️ `asientos_contables` - Necesita verificación (para flujo de caja)
7. ⚠️ `asientos_detalle` - Necesita verificación (para flujo de caja)

### Funciones RPC Necesarias:
1. ⚠️ `obtener_flujo_caja(p_fecha_desde, p_fecha_hasta)` - Necesita verificación

## 🚀 Opción 1: Ejecutar Script de Verificación (Recomendado)

El script `supabase/patches/2025-01-27_verificar_caja_dashboard.sql` verifica y crea automáticamente lo que falta.

### Pasos:

1. **Abrir Supabase Dashboard**
   - Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
   - Navega a **SQL Editor**

2. **Ejecutar Script de Verificación**
   - Abre el archivo `supabase/patches/2025-01-27_verificar_caja_dashboard.sql`
   - Copia TODO el contenido
   - Pégalo en el SQL Editor
   - Haz clic en **Run** o presiona `Ctrl+Enter`
   - Verifica que no haya errores

3. **Verificar Resultados**
   - El script mostrará mensajes NOTICE indicando qué se creó o qué ya existía
   - Si hay WARNING, significa que algunas tablas del ERP no existen (el flujo de caja puede no funcionar)

## 🚀 Opción 2: Ejecutar Patch Completo del ERP

Si prefieres ejecutar todo el sistema ERP completo (incluye facturación, contabilidad, etc.):

1. **Abrir Supabase Dashboard**
   - Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
   - Navega a **SQL Editor**

2. **Ejecutar Patch Completo**
   - Abre el archivo `supabase/patches/2025-01-23_create_erp_sistema_completo.sql`
   - Copia TODO el contenido
   - Pégalo en el SQL Editor
   - Haz clic en **Run** o presiona `Ctrl+Enter`
   - ⚠️ Este script es extenso y puede tardar varios minutos

## ✅ Verificación Manual

Si quieres verificar manualmente qué existe:

```sql
-- Verificar tablas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'ventas', 
    'ventas_items', 
    'cuentas_por_cobrar', 
    'cuentas_por_pagar',
    'plan_cuentas',
    'asientos_contables',
    'asientos_detalle'
  )
ORDER BY table_name;

-- Verificar función obtener_flujo_caja
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'obtener_flujo_caja';
```

## 📊 Funcionalidades del Dashboard

Una vez ejecutado, el Dashboard de Caja mostrará:

- ✅ **Ventas del día** - Desde tabla `ventas`
- ✅ **Órdenes pendientes de facturación** - Desde tabla `ordenes_trabajo`
- ⚠️ **Cuentas por cobrar** - Requiere tabla `cuentas_por_cobrar`
- ⚠️ **Cuentas por pagar** - Requiere tabla `cuentas_por_pagar`
- ⚠️ **Flujo de caja** - Requiere función `obtener_flujo_caja` y tablas del ERP

## 🔧 Solución de Problemas

### Error: "relation does not exist"
- Significa que la tabla no existe
- Ejecuta el script de verificación o el patch completo del ERP

### Error: "function does not exist"
- Significa que la función RPC no existe
- Ejecuta el script de verificación o el patch completo del ERP

### Flujo de caja muestra 0 o vacío
- Verifica que existan las tablas `plan_cuentas`, `asientos_contables` y `asientos_detalle`
- Verifica que haya datos en estas tablas
- El flujo de caja solo funciona si hay asientos contables registrados

## 📝 Notas

- El script de verificación es **idempotente**: puedes ejecutarlo múltiples veces sin problemas
- Si las tablas ya existen, solo las verificará sin modificarlas
- El flujo de caja requiere que el sistema ERP esté configurado con plan de cuentas y asientos contables

