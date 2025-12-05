# 🔗 Lógica de Unificación de Fichas

## 📋 Resumen

Cuando **TODAS** las fichas relacionadas (mismo OP) llegan a **"Finalizado en Taller"**, se unifican automáticamente en una sola ficha.

## ✅ Estado Actual

- **Función:** `unificar_fichas_completadas()` ✅ Implementada
- **Trigger:** `trigger_unificar_fichas` ✅ Activo
- **Condición:** Solo se ejecuta cuando `estado = 'Finalizado en Taller'`

## 🔄 Cómo Funciona

### 1. Detección
- Cuando una ficha se mueve a "Finalizado en Taller", el trigger se activa
- La función identifica todas las fichas relacionadas (mismo `numero_op` o `id_orden_original`)

### 2. Verificación
- Cuenta el **total de fichas relacionadas**
- Cuenta cuántas están en **"Finalizado en Taller"**
- Si **TODAS** están en "Finalizado en Taller" y hay **más de 1 ficha**, procede a unificar

### 3. Consolidación de Trazabilidad
Antes de eliminar las fichas duplicadas, consolida:
- ✅ **Historial de movimientos** → Se mueven a la ficha original
- ✅ **Comentarios** → Se mueven a la ficha original
- ✅ **Archivos adjuntos** → Se mueven a la ficha original
- ✅ **Enlaces adjuntos** → Se mueven a la ficha original
- ✅ **Materiales** → Se mueven a la ficha original (evitando duplicados)

### 4. Unificación
- **Elimina** todas las fichas duplicadas (`es_duplicado = true`)
- **Actualiza** la ficha original:
  - `estado = 'Finalizado en Taller'`
  - `sector = 'Finalizado en Taller'`
  - `sector_inicial = 'Finalizado en Taller'`
  - `es_duplicado = false` (ya no es duplicado, es la ficha unificada)

## 📝 Ejemplo

**Escenario:** Un trabajo requiere 3 sectores (Diseño, Metalúrgica, Taller Gráfico)

1. **Creación:** Se crean 3 fichas (una por cada sector)
2. **Trabajo:** Cada sector trabaja su ficha independientemente
3. **Finalización:**
   - Ficha 1 (Diseño) → "Finalizado en Taller" ✅
   - Ficha 2 (Metalúrgica) → "Finalizado en Taller" ✅
   - Ficha 3 (Taller Gráfico) → "Finalizado en Taller" ✅
4. **Unificación automática:**
   - Se consolida toda la trazabilidad
   - Se eliminan las 2 fichas duplicadas
   - Queda 1 sola ficha unificada en "Finalizado en Taller"

## ⚠️ Importante

- La unificación **solo ocurre** cuando **TODAS** las fichas están en "Finalizado en Taller"
- Si una ficha está en otro estado, **NO se unifica**
- La trazabilidad se **preserva completamente** (nada se pierde)

## 🔍 Verificación

Para verificar que funciona:
1. Crea un trabajo con 2+ sectores
2. Mueve todas las fichas a "Finalizado en Taller"
3. Deberías ver que se unifican automáticamente

