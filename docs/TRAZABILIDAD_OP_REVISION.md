# Trazabilidad de OP — revisión técnica y puntos de mejora

Referencia para alinear equipo y evolucionar el sistema sin sorpresas.

## 1. Fuentes de verdad (varias)

| Fuente | Qué guarda | Riesgo |
|--------|------------|--------|
| `historial_movimientos` | Cambios de estado / auditoría vinculados a `id_orden` | Una OP multi-sector tiene **varias filas** en `ordenes_trabajo` → el historial queda **partido por `id`** hasta que unifiquen/fusionen. |
| Trigger `registrar_historial_movimiento` | `AFTER UPDATE` en `ordenes_trabajo` (estado, operario, sector, prioridad en el WHEN) | Ver §3 (bug prioridad). No cubre **INSERT** (alta de OP). |
| RPC / cliente `registrar_cambio_manual_v2` + inserts en `api.ts` | Eventos extra (checklist DT, etc.) | Riesgo de **doble registro** si el mismo `UPDATE` también dispara el trigger. |
| Tablas de etapa (`historial_etapa_*` según patches) | Detalle por taller | No siempre unificado en la misma vista que `historial_movimientos`. |
| `numero_ficha_original` / fichas No OP | Puente FICHA → OP | Historial puede empezar en otro `id_orden`. |

**Claridad para el usuario:** “Trazabilidad de la OP” debería significar, cuando hay un solo `numero_op`, **una línea de tiempo única** (o explícitamente “por sector” si querés mostrar ambas cosas).

## 2. Problemas detectados en código

### 2.1 Consulta pública / tótem: historial fragmentado

- Se pedía `getHistorialMovimientos({ ordenId })` **una vez por cada ficha** (mismo número OP, distinto `id`).
- El cliente veía **varias tarjetas** con **timelines repetidos o incompletos** según qué ficha registró cada movimiento.
- **Mejora aplicada:** una sola consulta `ordenIds: number[]`, reparto por `id_orden`, y si hay **varias fichas con el mismo número OP**, un bloque **“Recorrido completo de la orden”** arriba (ordenado por fecha).

### 2.2 Trigger SQL: cambio solo de prioridad

En `registrar_historial_movimiento` (patch 2025-01-24), si solo cambia `prioridad`:

- Se concatena texto en `comentario_historial`,
- pero **no** se hace `hay_cambio_importante := true`,
- por tanto **no se inserta** fila en `historial_movimientos` aunque el `WHEN` del trigger sí dispare el trigger.

**Mejora aplicada:** parche SQL que marca prioridad como cambio importante.

### 2.3 Usuario “falso” en historial (trigger)

Si no hay `app.current_user_name`, el trigger deduce nombre por `operario_asignado` / `nombre_creador` y si no matchea en `usuarios`, usa el **primer usuario de la tabla**. Eso puede **atribuir mal** el movimiento en entornos con muchos usuarios.

**Recomendación:** en producción, setear contexto de sesión desde el backend o estandarizar un usuario técnico “Sistema” con `id` fijo y FK permitida.

### 2.4 `getCurrentUser()` en cliente con `id: 0 → 1`

Evita FK rota pero puede **mezclar** auditoría bajo el usuario id 1.

## 3. Qué queda para iterar (sin implementar aún)

- Vista única en **TaskEditModal** / tablero: mismo criterio “unificar por `numero_op`” opcional.
- **INSERT** de orden: registrar evento “Alta” en historial (trigger `AFTER INSERT` o RPC en `create_orden`).
- **Dedupe** si trigger + RPC escriben el mismo cambio (comparar timestamp + id_orden + estado).
- Exponer en UI el campo `comentario` completo (ya incluye “Sector: A → B” en trigger) con etiquetas más legibles.

## 4. Parches / código relacionados

- `supabase/patches/2025-01-24_fix_historial_movimientos_trigger.sql` — lógica base del trigger.
- `supabase/patches/2026-04-06_fix_historial_trigger_prioridad_trazabilidad.sql` — corrección prioridad.
- `src/services/api.ts` — `getHistorialMovimientos` con `ordenIds`.
- `ClienteConsultaPage.tsx` / `TotemConsultaClientePage.tsx` — consulta unificada + bloque “recorrido completo”.

---

*Documento vivo: actualizar cuando se agreguen triggers, RPC o pantallas de auditoría.*
