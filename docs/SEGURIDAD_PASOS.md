# Seguridad — implementación paso a paso

Implementación lenta y segura. **Un paso por vez**, verificar, luego el siguiente.

---

## Paso 1 — Proteger `usuarios.password_hash` ✅ Completado (2026-06-03)

**Problema:** Cualquiera con la anon key podía `SELECT password_hash` de todos los usuarios.

**Qué hicimos:**
- Vista `usuarios_publico` (sin hash)
- RPC `usuarios_ids_por_roles` para notificaciones
- RPC `sync_usuario_notificacion` para sync interno
- `REVOKE` SELECT/INSERT/UPDATE/DELETE en `usuarios` para rol `anon`
- Login sigue con `login_usuario` (SECURITY DEFINER, no usa permisos de anon)
- Código frontend usa vista/RPC en lugar de tabla directa

**Cómo verificar:**
1. Login staff en PlotLab → debe funcionar
2. Gestión usuarios (listar/crear) → debe funcionar vía RPC
3. `/op-public/...` → debe seguir mostrando estado
4. En SQL Editor (como anon): `SELECT * FROM usuarios` → debe fallar
5. `SELECT * FROM usuarios_publico` → debe funcionar

**Rollback:** reaplicar grants de `2024-11-24_ensure_usuarios_table.sql` (solo emergencia)

---

## Paso 2 — Variables Vercel obligatorias ✅ Completado

- `PLOT_LAB_BACKUP_TOKEN`
- `NOTIFY_ORDEN_WEBHOOK_SECRET`
- `GEMINI_API_KEY` (sin `VITE_`)

Email “listo para retirar”: PlotLab llama desde el mismo origen (sin exponer el secret en el bundle). Webhooks externos usan Bearer.

---

## Paso 3 — Rotación de keys (manual) ⏳ Siguiente

**Tiempo:** ~15 min · **Sin deploy de código** — solo paneles.

### 3.1 Gemini (prioridad alta)

1. [Google AI Studio](https://aistudio.google.com/apikey) → **Create API key** (nueva)
2. Vercel → **Add New** `GEMINI_API_KEY` (sin prefijo `VITE_`, Sensitive ON, Production + Preview)
3. **Eliminar** `VITE_GEMINI_API_KEY` de **Production** — seguro desde 2026-06-03: PlotAI staff, caja, tótem, portal y chat público usan `/api/plotai/generate-content`
4. Dejar `VITE_GEMINI_API_KEY` solo en **Development** (local con `vite` sin `vercel dev`)
5. **Redeploy** Production

**Verificar:** PlotAI tablero, caja (planilla PDF + comprobantes), tótem, `/embed/chat`, portal `/cliente/chat`.

### 3.2 Supabase anon key (si sospechás filtración)

1. Supabase → **Project Settings → API**
2. **Reset JWT secret** (invalida anon + service role actuales — planificar ventana corta)
3. Copiar **anon** y **service_role** nuevos
4. Vercel → actualizar:
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Local `.env` → mismas keys
6. **Redeploy** + avisar al equipo que recarguen PlotLab (F5)

**Verificar:** login staff, `/op-public/...`, kanban carga órdenes.

### 3.3 Tokens propios (opcional si ya los pusiste en Paso 2)

Si rotás por precaución, generá strings aleatorios 32+ chars y **Edit** (no Add New):
- `PLOT_LAB_BACKUP_TOKEN`
- `NOTIFY_ORDEN_WEBHOOK_SECRET`

**Verificar:** backup admin con Bearer; email al pasar orden a “Almacén de Entrega”.

### Cuando termines

Marcá Paso 3 ✅ y seguimos con **Paso 5** (JWT post-login).

---

## Paso 4 — Cerrar `configuracion_afip` ✅ Completado (2026-06-03)

- Vista `configuracion_afip_resumen` (sin certificado ni tokens)
- RPC `get_configuracion_afip_resumen`, `get_configuracion_afip_facturacion`, `guardar_configuracion_afip`
- `REVOKE` acceso directo `anon` a tabla `configuracion_afip`

**Verificar:** ERP → Configuración AFIP carga y guarda. Facturación sigue numerando con punto de venta.

---

## Paso 5 — JWT sesión staff ✅ Completado (2026-06-04)

**Problema:** Cualquiera podía editar `localStorage.usuario` y fingir ser admin.

**Qué hicimos:**
- `/api/auth/staff-login` — valida con `login_usuario` (service role) y emite JWT firmado (12 h)
- `/api/auth/staff-session` — verifica Bearer en cada recarga
- Frontend guarda `auth_token` y valida al abrir PlotLab
- Fallback legacy: si falta `PLOT_LAB_STAFF_JWT_SECRET`, login sigue vía RPC directo (hasta configurar Vercel)

**Variables Vercel (necesarias para Paso 5):**

| Variable | Sensitive | Valor |
|----------|-----------|--------|
| `PLOT_LAB_STAFF_JWT_SECRET` | ON | string aleatorio 32+ chars (distinto de backup/notify) |
| `PLOT_LAB_ALLOWED_ORIGINS` | OFF | `https://trello.plotcenter.com.ar,https://plotrello.vercel.app` |
| `SUPABASE_SERVICE_ROLE_KEY` | ON | ya deberías tenerla (login valida password en servidor) |

PowerShell para generar el secret:
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

Después: **Redeploy** · el equipo debe **cerrar sesión y volver a entrar** (sesiones viejas sin `auth_token` quedan invalidadas).

**Verificar:**
1. Login staff → en DevTools → Application → `auth_token` debe existir (JWT)
2. Recargar página → sigue logueado
3. Borrar `auth_token` y recargar → pide login de nuevo
4. `/op-public/...` y tótem → sin cambios (zona pública)

**Pendiente Paso 6:** RLS en Supabase que use el JWT (hoy el token verifica identidad en APIs Vercel; PostgREST sigue con anon key).

---

## Paso 6 — RLS por dominio (incremental)

### 6.1 — Activar RLS + bloquear DELETE ✅ (2026-06-04)

**Hallazgo:** `ordenes_trabajo` tenía policies creadas pero **`relrowsecurity = false`** → no se aplicaban.

**Qué hicimos:**
- `ENABLE ROW LEVEL SECURITY` en `ordenes_trabajo` y `historial_movimientos`
- Policies `anon` para SELECT/INSERT/UPDATE (staff usa anon key)
- `REVOKE DELETE, TRUNCATE` para `anon` en ambas tablas
- RPC `list_ordenes_trabajo_tablero` (preparación 6.2)
- Seguimiento público: sin fallback a `SELECT *` — solo `get_orden_seguimiento_publico`

**Verificar:** Kanban carga, mover OP, crear ficha, `/op-public/...`, historial de movimientos.

### 6.2 — Cerrar SELECT anon en `ordenes_trabajo` ⏳ Siguiente

Revocar `SELECT` directo de `anon` y usar RPC `list_ordenes_trabajo_tablero` + APIs con JWT staff.

### 6.3+ — ERP, caja, RRHH, clientes

Tabla por tabla, sin romper zona pública.
