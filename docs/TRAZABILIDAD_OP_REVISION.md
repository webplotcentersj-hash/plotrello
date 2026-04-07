# Trazabilidad de OP — revisión técnica y puntos de mejora

Referencia para alinear equipo y evolucionar el sistema sin sorpresas.

## Alcance (prioridad)

**Objetivo principal: trazabilidad interna** — que en operación se vea bien qué pasó con cada ficha: `historial_movimientos`, comentarios de orden, auditoría en la tarjeta, etapas por taller, marcas como **reclamo** (`en_reclamo`), y que los triggers/RPC no pierdan eventos ni dupliquen sin control.

La **consulta pública** (cliente / tótem) es un **derivado** de los mismos datos: sirve para que el cliente vea un recorrido coherente cuando hay varias fichas con el mismo número de OP, pero no reemplaza el trabajo de auditoría interna.

## 1. Fuentes de verdad (varias)

| Fuente | Qué guarda | Riesgo |
|--------|------------|--------|
| `historial_movimientos` | Cambios de estado / auditoría vinculados a `id_orden` | Una OP multi-sector tiene **varias filas** en `ordenes_trabajo` → el historial queda **partido por `id`** hasta que unifiquen/fusionen. |
| Trigger `registrar_historial_movimiento` | `AFTER UPDATE` en `ordenes_trabajo` (estado, operario, sector, prioridad en el WHEN) | Ver §3 (bug prioridad). No cubre **INSERT** (alta de OP). |
| RPC / cliente `registrar_cambio_manual_v2` + inserts en `api.ts` | Eventos extra (checklist DT, etc.) | Riesgo de **doble registro** si el mismo `UPDATE` también dispara el trigger. |
| Tablas de etapa (`historial_etapa_*` según patches) | Detalle por taller | No siempre unificado en la misma vista que `historial_movimientos`. |
| `numero_ficha_original` / fichas No OP | Puente FICHA → OP | Historial puede empezar en otro `id_orden`. |

**Claridad interna:** con un solo `numero_op` y varias filas en `ordenes_trabajo`, el historial sigue anclado a `id_orden`. En **uso interno** conviene saber si se muestra **por ficha** o **unificado por OP** (misma decisión de producto que en consulta pública).

## 2. Problemas detectados en código

### 2.1 Trigger SQL: cambio solo de prioridad

En `registrar_historial_movimiento` (patch 2025-01-24), si solo cambia `prioridad`:

- Se concatena texto en `comentario_historial`,
- pero **no** se hace `hay_cambio_importante := true`,
- por tanto **no se inserta** fila en `historial_movimientos` aunque el `WHEN` del trigger sí dispare el trigger.

**Mejora aplicada:** parche SQL que marca prioridad como cambio importante.

### 2.2 Usuario “falso” en historial (trigger)

Si no hay `app.current_user_name`, el trigger deduce nombre por `operario_asignado` / `nombre_creador` y si no matchea en `usuarios`, usa el **primer usuario de la tabla**. Eso puede **atribuir mal** el movimiento en entornos con muchos usuarios.

**Recomendación:** en producción, setear contexto de sesión desde el backend o estandarizar un usuario técnico “Sistema” con `id` fijo y FK permitida.

### 2.3 `getCurrentUser()` en cliente con `id: 0 → 1`

Evita FK rota pero puede **mezclar** auditoría bajo el usuario id 1.

### 2.4 Consulta pública / tótem (secundario respecto al núcleo interno)

- Antes se pedía historial **por cada `id_orden`**, con timelines confusos si había varias fichas mismo OP.
- **Mejora aplicada:** query única con `ordenIds`, reparto por ficha y bloque opcional “Recorrido completo” unificado por fecha. No cambia el modelo de datos; solo mejora la lectura para el cliente.

### 2.5 Reclamo en ficha (trazabilidad interna + marca visual)

- Columna `en_reclamo` en `ordenes_trabajo`, botón en `TaskCard`, comentario en `comentarios_orden` y registro en `historial_movimientos` vía API. Refuerza que algo **debe rehacerse** sin depender solo del chat verbal.

## 3. Qué queda para iterar (foco interno)

- Vista única en **TaskEditModal** / panel interno: timeline **unificado por `numero_op`** cuando hay varias fichas (prioridad alta para trazabilidad interna).
- **INSERT** de orden: registrar evento “Alta” en historial (trigger `AFTER INSERT` o RPC en `create_orden`).
- **Dedupe** si trigger + RPC escriben el mismo cambio (comparar timestamp + id_orden + estado).
- Exponer en UI el campo `comentario` completo (ya incluye “Sector: A → B” en trigger) con etiquetas más legibles.

## 4. Parches / código relacionados

- `supabase/patches/2025-01-24_fix_historial_movimientos_trigger.sql` — lógica base del trigger.
- `supabase/patches/2026-04-06_fix_historial_trigger_prioridad_trazabilidad.sql` — corrección prioridad.
- `supabase/patches/2026-04-07_ordenes_en_reclamo.sql` — columna `en_reclamo`.
- `src/services/api.ts` — `getHistorialMovimientos` con `ordenIds`; `marcarReclamoOrden` / `desmarcarReclamoOrden`.
- `TaskCard.tsx` — reclamo, bordes, integración con historial/comentarios.
- `ClienteConsultaPage.tsx` / `TotemConsultaClientePage.tsx` — solo capa pública sobre los mismos datos.

---

*Documento vivo: actualizar cuando se agreguen triggers, RPC o pantallas de auditoría.*
