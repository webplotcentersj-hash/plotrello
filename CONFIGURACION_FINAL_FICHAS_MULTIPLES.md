# 📋 Configuración Final: Sistema de Fichas Múltiples

## ✅ Estado Final - Funcionamiento Correcto

Esta es la configuración final y definitiva del sistema de fichas múltiples. **NO MODIFICAR** sin revisar este documento primero.

---

## 🎯 Comportamiento Esperado

### Creación de Fichas
- **1 sector** → **1 ficha** (sin duplicados)
- **2 sectores** → **2 fichas** (1 original + 1 duplicada)
- **3 sectores** → **3 fichas** (1 original + 2 duplicadas)
- **N sectores** → **N fichas** (1 original + N-1 duplicadas)

### Movimiento Independiente
- ✅ Cada ficha se mueve **INDEPENDIENTEMENTE** por su sector
- ✅ Las fichas duplicadas **NO se afectan entre sí** al moverse
- ✅ Solo se sincronizan **datos** (descripción, prioridad, materiales, etc.)
- ✅ **NO se sincronizan** estado ni sector

### Unificación
- ✅ Cuando **TODAS** las fichas relacionadas (mismo OP) llegan a **"Finalizado en Taller"**
- ✅ Se unifican automáticamente en **una sola ficha**
- ✅ Las fichas duplicadas se **eliminan** después de consolidar trazabilidad
- ✅ Se conserva: historial, comentarios, archivos, enlaces, materiales

---

## 🔧 Componentes Críticos

### 1. Función: `crear_fichas_por_sector()`
**Ubicación:** `supabase/patches/2024-11-24_fix_multiplicacion_fichas.sql`

**Comportamiento:**
- Solo se ejecuta en `INSERT` (no en UPDATE)
- Solo procesa fichas con `es_duplicado = false`
- Verifica existencia antes de crear (previene duplicaciones)
- Crea exactamente N-1 fichas adicionales para N sectores

**Trigger:** `trigger_crear_fichas_por_sector` (AFTER INSERT)

---

### 2. Función: `sincronizar_fichas_duplicadas()`
**Ubicación:** `supabase/patches/2024-11-24_fix_completo_movimiento_fichas.sql`

**Comportamiento:**
- ⚠️ **NO sincroniza** `estado` ni `sector`
- Solo sincroniza campos de datos:
  - descripcion, prioridad, fecha_entrega, materiales
  - telefono_cliente, email_cliente, direccion_cliente
  - whatsapp_link, ubicacion_link, drive_link
  - foto_url, dni_cuit, operario_asignado, complejidad

**Trigger:** `trigger_sincronizar_duplicados` (AFTER UPDATE)
- Solo se ejecuta cuando cambian campos de **datos**
- **NO se ejecuta** cuando cambian `estado` o `sector`

---

### 3. Función: `unificar_fichas_completadas()`
**Ubicación:** `supabase/patches/2024-11-24_corregir_unificacion_fichas.sql`

**Comportamiento:**
- Solo se ejecuta cuando `estado = 'Finalizado en Taller'`
- Verifica que **TODAS** las fichas relacionadas estén en "Finalizado en Taller"
- Consolida trazabilidad antes de eliminar:
  - Historial de movimientos
  - Comentarios
  - Archivos adjuntos
  - Enlaces adjuntos
  - Materiales (evitando duplicados)
- Elimina fichas duplicadas
- Actualiza ficha original

**Trigger:** `trigger_unificar_fichas` (AFTER UPDATE)
- Solo se ejecuta cuando `estado` cambia a "Finalizado en Taller"

---

### 4. Función: `crear_sub_tareas_automaticas()`
**Ubicación:** `supabase/patches/2024-11-24_fix_sub_tareas_duplicadas.sql`

**Comportamiento:**
- ⚠️ **NO crea sub-tareas** para fichas duplicadas
- Solo procesa fichas con `es_duplicado = false`
- Las fichas duplicadas ya representan cada sector, no necesitan sub-tareas

**Trigger:** `trigger_crear_sub_tareas` (AFTER INSERT)

---

## 🚫 Lo que NO debe hacer el sistema

1. ❌ **NO multiplicar fichas más allá de N sectores**
2. ❌ **NO sincronizar estado/sector entre fichas duplicadas**
3. ❌ **NO crear sub-tareas para fichas duplicadas**
4. ❌ **NO unificar fichas antes de que todas estén en "Finalizado en Taller"**
5. ❌ **NO revertir movimientos de fichas** (efecto espejo)

---

## 📝 Estructura de Datos

### Tabla: `ordenes_trabajo`
- `id`: ID único de la ficha
- `numero_op`: Número de OP (común para todas las fichas relacionadas)
- `sector`: Sector actual donde aparece la ficha
- `sectores`: Array de sectores requeridos (común para todas)
- `estado`: Estado actual (puede ser diferente entre fichas)
- `es_duplicado`: `true` si es duplicada, `false` si es original
- `id_orden_original`: ID de la ficha original (NULL para la original)

### Relaciones
- Ficha original: `es_duplicado = false`, `id_orden_original = NULL`
- Fichas duplicadas: `es_duplicado = true`, `id_orden_original = ID de la original`

---

## 🔍 Verificación de Estado

Para verificar que el sistema está funcionando correctamente:

```sql
-- Ver fichas relacionadas por OP
SELECT 
  numero_op,
  COUNT(*) as total_fichas,
  COUNT(CASE WHEN es_duplicado = false THEN 1 END) as originales,
  COUNT(CASE WHEN es_duplicado = true THEN 1 END) as duplicadas,
  array_agg(sector ORDER BY id) as sectores
FROM ordenes_trabajo
WHERE numero_op = 'TU_OP_NUMBER'
GROUP BY numero_op;
```

---

## 🛠️ Scripts de Mantenimiento

### Limpiar sub-tareas de fichas duplicadas
```sql
DELETE FROM public.tareas
WHERE es_sub_tarea = true
  AND id_orden IN (
    SELECT id FROM public.ordenes_trabajo
    WHERE es_duplicado = true
  );
```

### Verificar triggers activos
```sql
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'ordenes_trabajo'
ORDER BY trigger_name;
```

---

## 📚 Archivos de Referencia

1. **`supabase/patches/2024-11-24_fix_multiplicacion_fichas.sql`**
   - Función: `crear_fichas_por_sector()`
   - Previene multiplicación excesiva

2. **`supabase/patches/2024-11-24_fix_completo_movimiento_fichas.sql`**
   - Función: `sincronizar_fichas_duplicadas()`
   - Garantiza movimiento independiente

3. **`supabase/patches/2024-11-24_corregir_unificacion_fichas.sql`**
   - Función: `unificar_fichas_completadas()`
   - Unificación automática

4. **`supabase/patches/2024-11-24_fix_sub_tareas_duplicadas.sql`**
   - Función: `crear_sub_tareas_automaticas()`
   - Previene sub-tareas en duplicadas

---

## ⚠️ ADVERTENCIAS

1. **NO modificar** los triggers sin revisar este documento
2. **NO cambiar** la lógica de sincronización sin considerar el movimiento independiente
3. **NO crear** sub-tareas para fichas duplicadas
4. **NO unificar** fichas antes de que todas estén en "Finalizado en Taller"

---

## ✅ Checklist de Funcionamiento Correcto

- [ ] 2 sectores → 2 fichas (no más, no menos)
- [ ] 3 sectores → 3 fichas (no más, no menos)
- [ ] Cada ficha se mueve independientemente
- [ ] No hay efecto espejo (las fichas no vuelven atrás)
- [ ] Solo se sincronizan datos, no estado/sector
- [ ] No se crean sub-tareas para fichas duplicadas
- [ ] Unificación solo cuando todas están en "Finalizado en Taller"

---

**Última actualización:** 2024-12-05
**Estado:** ✅ FUNCIONANDO CORRECTAMENTE - NO MODIFICAR

