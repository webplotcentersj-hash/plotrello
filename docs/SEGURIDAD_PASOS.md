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

## Paso 3 — Rotación de keys (manual) ⏳

**Tiempo:** ~15 min · **Solo paneles** (el código del Paso 13 ya no usa `VITE_` en Production).

### 3.1 Gemini (prioridad alta)

1. Confirmar `GEMINI_API_KEY` (sin `VITE_`) en Vercel Production + Preview
2. **Eliminar** `VITE_GEMINI_API_KEY` de **Production** (y Preview si está)
3. Dejar `VITE_GEMINI_API_KEY` solo en local (`.env.local`, sin `vercel dev`)
4. **Redeploy** Production

**Verificar:** PlotAI tablero, caja, tótem voz, `/embed/chat`, portal `/cliente/chat`.

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

---

## Paso 7 — Gate actor en RPCs de usuarios ✅ (2026-08-13)

**Problema:** `crear_usuario`, `actualizar_usuario` y `dar_de_baja_usuario` eran SECURITY DEFINER ejecutables por anon **sin chequear quién llama**. Con la anon key cualquiera podía crear un admin o dar de baja gente.

**Qué hicimos (sin revocar EXECUTE ni tocar RLS):**
- Helpers internos `actor_puede_gestionar_usuarios` / `actor_puede_asignar_rol` (admin, gerencia, RRHH activos)
- RRHH no asigna gerencia/admin; gerencia no asigna admin
- Baja: `p_registrado_por` debe ser gestor y distinto del dado de baja
- Front: `createUsuario` / `updateUsuario` envían `actorId`
- Telegram: si `TELEGRAM_WEBHOOK_SECRET` está seteado, exige el header de Telegram

**Verificar (después de deploy del front):**
1. RRHH / admin crea un usuario mostrador → OK
2. RRHH intenta crear rol `administracion` → error no autorizado
3. Usuario inactivo o rol taller no puede crear (aunque mande su id)
4. Bot Telegram sigue andando; si configurás secret en setWebhook, los POST sin header se ignoran

**Rollback:** reaplicar firmas viejas de `2025-01-17_add_funciones_gestion_usuarios.sql` / `2026-06-12_fix_dar_de_baja_sin_updated_at.sql` (solo emergencia)

**Siguiente:** no ENABLE RLS en notificaciones todavía. Después: `clientes` (PII) con el mismo patrón RPC-first, o quitar `VITE_GEMINI_API_KEY` de Production (manual Vercel).

---

## Paso 8 — `clientes` sin `password_hash` ✅ (2026-08-13)

**Problema:** `clientes` sin RLS, anon con GRANT ALL (incluía TRUNCATE) y el front hacía `select('*')` → filtraba hashes + DNI/email.

**Qué hicimos (sin RLS, sin revocar SELECT/UPDATE de la tabla todavía):**
- Vista `clientes_publico` (todos los campos salvo `password_hash`)
- GRANT solo SELECT en la vista
- Revocados TRUNCATE / REFERENCES / TRIGGER en `clientes`
- Lecturas en `api.ts`, PlotAI y chat público → `clientes_publico`
- Escrituras (fusión / update ficha) siguen en `clientes`

**Verificar (después de deploy del front):**
1. Buscador de clientes / duplicados
2. Login portal cliente
3. Alta ficha sin portal + habilitar acceso
4. Fusión de duplicados

**No hacer todavía:** `REVOKE SELECT` en `clientes` (rompe fusión/update directo) ni ENABLE RLS.

**Siguiente:** gate actor en `crear_cliente` / `habilitar_acceso_cliente`, o recortar SELECT de `clientes` cuando esas escrituras pasen a RPC.

---

## Paso 9 — Gate actor en RPCs de portal cliente ✅ (2026-08-13)

**Problema:** `crear_cliente`, `habilitar_acceso_cliente`, `quitar_acceso_cliente` y `actualizar_cliente` eran DEFINER sin actor → cualquiera con anon key podía crear logins de portal.

**Qué hicimos (sin RLS, sin tocar tótem/OP):**
- Helper `actor_puede_gestionar_clientes` (admin, gerencia, mostrador, caja, presupuestos activos = `canAccessMostradorViews`)
- Esas RPCs + `crear_cliente_sin_acceso` exigen `p_actor_id`
- **No** se tocó `buscar_o_crear_cliente` (tótem, venta rápida, crear OP)
- Front: gestión web + agregar ficha envían `actorId`

**Verificar (después de deploy del front):**
1. Mostrador/admin crea ficha y habilita portal → OK
2. Usuario taller (u otro rol) aunque mande un id, la RPC rechaza
3. Tótem checkout / crear OP con cliente nuevo → sigue igual

**Queda:** `actualizarClienteDatos` y fusión siguen con UPDATE directo a `clientes` (por eso no hay `REVOKE SELECT/UPDATE` todavía).

**Siguiente:** RPC para ficha/fusión y recortar UPDATE/SELECT de la tabla, o Gemini `VITE_` en Production (manual).

---

## Paso 10 — Ficha y fusión vía RPC ✅ (2026-08-13)

**Problema:** `actualizarClienteDatos` y `fusionarClientes` hacían `UPDATE` directo a `clientes` (anon aún tiene UPDATE).

**Qué hicimos (sin RLS, sin recortar SELECT/UPDATE todavía):**
- RPC `actualizar_cliente_ficha` + `fusionar_clientes` con `actor_puede_gestionar_clientes`
- Front (gestión web + duplicados) manda `actorId`
- Fallback a tabla **solo** si la función no existe (no si “No autorizado”)
- `buscar_o_crear_cliente` intacto (tótem / OP)

**Verificar (después de deploy):**
1. Editar ficha sin portal
2. Unificar duplicados (historial pasa al principal, secundaria inactiva)
3. Crear OP / tótem sin cambios

**Hecho después:** Paso 11 recortó SELECT/DML de la tabla.

---

## Paso 11 — REVOKE `clientes` (anon) ✅ (2026-08-13)

**Problema:** con la anon key se podía `SELECT *` / `UPDATE` / `DELETE` directo a `clientes` (PII + `password_hash`).

**Qué hicimos (sin RLS):**
- `REVOKE SELECT, INSERT, UPDATE, DELETE` en `public.clientes` para `anon` y `authenticated`
- Lecturas: `clientes_publico` (SELECT only; vista owner, no invoker)
- Escrituras: RPCs DEFINER (`crear_cliente`, `actualizar_cliente_ficha`, `fusionar_clientes`, `buscar_o_crear_cliente`, portal)
- Front: sin fallback a la tabla
- Higiene: `usuarios_publico` también queda solo SELECT (antes heredaba ALL)

**Smoke SQL:** anon no tiene SELECT/UPDATE en `clientes`; sí SELECT en `clientes_publico`; RPCs siguen con EXECUTE.

**Verificar en Plot Lab (después de deploy del front):**
1. Buscador / listado de clientes
2. Editar ficha + unificar duplicados (mostrador/admin)
3. Alta OP / tótem con cliente nuevo (`buscar_o_crear_cliente`)
4. Login portal cliente

**Rollback (solo emergencia):**
`GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO anon, authenticated;`

**Siguiente:** recortar fallback de tabla en notificaciones (campanita) **sin** ENABLE RLS, o quitar `VITE_GEMINI_API_KEY` de Production (manual Vercel).

---

## Paso 12 — Campanita: fallback solo si falta la RPC ✅ (2026-08-13)

**Problema:** si `listar_notificaciones_usuario` / marcar / crear fallaba por cualquier motivo, el front iba directo a `user_notifications` (anon sigue con SELECT/UPDATE/INSERT). Eso eludía el recorte futuro y permitía marcar por `id` sin `user_id`.

**Qué hicimos (sin RLS, sin REVOKE, Realtime igual):**
- Listar / crear / marcar / marcar todas / `notif_existe_reciente`: fallback a tabla **solo** si la función no existe (`PGRST202`)
- `markNotificationAsRead` exige `userId` (ya no UPDATE suelto por `id`)
- `postgres_changes` en campanita / chat / badges **sin cambios**

**No hacer todavía:** `REVOKE SELECT/INSERT/UPDATE` ni `ENABLE RLS` en `user_notifications` (vaciaría la campanita: policies viejas usan `auth.uid()`).

**Verificar (después de deploy):**
1. Campanita lista y marca leídas
2. “Marcar todas”
3. Llega una nueva (realtime / poll)
4. Comunicados RRHH masivos

**Siguiente:** Gemini sin `VITE_` en el bundle de Production (Paso 13 + borrar la var en Vercel).

---

## Paso 13 — Gemini: `VITE_` solo en vite dev ✅ (2026-08-13)

**Problema:** `VITE_GEMINI_API_KEY` en Vercel Production se embebe en el JS. Chat ya iba a `/api/plotai/generate-content`, pero Live (tótem / staff) leía la key del bundle.

**Qué hicimos (código; falta el recorte manual en Vercel):**
- `fetchGeminiLiveApiKey`: prod → `/api/plotai/live-voice`; `VITE_` solo si `import.meta.env.DEV`
- `callGeminiGenerateContent`: no cae a Gemini directo en prod (ni en 404)
- `PlotAILiveVoice` pide la key al iniciar la llamada
- `.env.example`: `GEMINI_API_KEY` servidor; `VITE_` comentada como local

**Vos en Vercel (Paso 3.1):**
1. `GEMINI_API_KEY` presente en Production
2. Borrar `VITE_GEMINI_API_KEY` de Production (+ Preview)
3. Redeploy

**Verificar después del deploy + recorte de env:**
1. PlotAI texto (tablero / caja / portal)
2. Tótem voz + `/embed/chat`
3. DevTools → Sources: el bundle **no** debe contener la key de Gemini

**Siguiente:** Telegram webhook fail-closed (Paso 14), o campanita sin fallback de tabla.

---

## Paso 14 — Telegram webhook fail-closed ✅ (2026-08-13)

**Problema:** sin `TELEGRAM_WEBHOOK_SECRET`, cualquier POST a `/api/telegram/webhook` llegaba al bot (PlotAI + agenda DT).

**Qué hicimos:**
- En **Production**, si falta el secret → no procesa updates (sigue respondiendo 200 a Telegram)
- Si el secret está, exige header `x-telegram-bot-api-secret-token`
- Preview/dev sin secret: sigue (como backup token)
- `TELEGRAM_ALLOWED_USERS` sigue opcional (allowlist extra)

**Vos en Vercel + Telegram:**
1. `TELEGRAM_WEBHOOK_SECRET` en Production (string aleatorio)
2. `setWebhook` con el mismo `secret_token`:
   `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://trello.plotcenter.com.ar/api/telegram/webhook&secret_token=<MISMO_SECRET>`

**Verificar:** `/start` y `/agenda` en el bot; un POST sin header no dispara PlotAI.

**Siguiente:** campanita sin fallback de tabla (aún sin RLS), o storage signed URLs, o `ordenes_trabajo` SELECT (6.2).

---

## Paso 15 — Campanita solo RPC ✅ (2026-08-13)

**Problema:** el fallback a `user_notifications` (aunque recortado a “función faltante”) seguía permitiendo DML/SELECT directo con la anon key.

**Qué hicimos (sin RLS, sin REVOKE, Realtime igual):**
- Listar / crear / marcar / marcar todas / `notif_existe_reciente`: **solo** RPCs DEFINER
- `postgres_changes` en campanita / chat / badges **sin cambios** (anon aún tiene SELECT en la tabla para Realtime)

**No hacer todavía:** `REVOKE SELECT/INSERT/UPDATE` ni `ENABLE RLS` (policies viejas con `auth.uid()` vaciarían la campanita; Realtime necesita SELECT).

**Verificar (después de deploy):**
1. Campanita lista y marca leídas
2. “Marcar todas”
3. Llega una nueva (realtime)
4. Comunicados RRHH masivos

**Siguiente:** storage signed URLs, o Paso 6.2 (`ordenes_trabajo` SELECT vía RPC), o recortar TRUNCATE residual en `usuarios` (anon).

---

## Paso 16 — Caja: sin TRUNCATE (anon) ✅ (2026-09-15)

**Problema:** las 11 tablas `control_caja_*` tenían RLS ON pero policy `USING (true)` + `GRANT ALL` (incluía **TRUNCATE**). Cualquiera con la anon key podía vaciar plata.

**Qué hicimos (sin romper el módulo):**
- `REVOKE TRUNCATE, REFERENCES, TRIGGER` en las 11 tablas para `anon` y `authenticated`
- **No** se tocó SELECT/INSERT/UPDATE/DELETE (el front aún escribe directo vía `cajaRepository`)
- **No** se cambió la policy abierta (viene en Paso 17)

**Patch:** `supabase/patches/2026-09-15_control_caja_revoke_truncate.sql` (aplicado en prod)

**Verificar:**
1. Abrir Control de cajas → listar cajas, movimientos, arqueos
2. Registrar un movimiento / egreso de prueba
3. En SQL Editor como rol `anon`: `TRUNCATE control_caja_movimientos` → debe fallar
4. `SELECT * FROM control_caja_movimientos LIMIT 1` → aún funciona (esperado hasta Paso 17)

**Siguiente (Paso 17):** RPC DEFINER para escrituras de movimientos/arqueos/cierres + actor gate; después REVOKE DML y policy real (caja = usuario).

---

## Paso 17 — Caja: RPCs con actor gate ✅ (2026-09-15)

**Problema:** cualquiera con la anon key podía INSERT/UPDATE/DELETE en `control_caja_*` (policy `USING true`). El front validaba dueño solo en cliente.

**Qué hicimos (sin REVOKE DML todavía):**
- Helpers DEFINER: `actor_es_admin_caja`, `actor_puede_operar_caja_slug`, `actor_puede_grabar_movimiento_caja`
- RPCs: `caja_upsert_movimiento`, `caja_delete_movimiento`, `caja_insert_movimientos`, `caja_upsert_arqueo`, `caja_upsert_cierre`
- `cajaRepository`: si hay `actor.id`, escribe por RPC; sin actor (sync legacy) sigue por tabla
- Admin/gerencia en DB; titular `u-{id}` / `id_usuario`

**Patches:** `2026-09-15_control_caja_rpcs_actor_gate.sql` (+ migraciones aplicadas en prod)

**Verificar (después de deploy front):**
1. Mostrador: movimiento / arqueo / cierre en su caja → OK
2. Mostrador intenta operar caja ajena → error “No autorizado…”
3. Admin/gerencia opera cualquier caja → OK
4. Sync venta→caja sin actor (si aplica) → no rompe

**Siguiente (Paso 18):** REVOKE INSERT/UPDATE/DELETE anon en movimientos/arqueos/cierres cuando todos los caminos pasen actor; luego policy real.

---

## Paso 18 — Caja: sin DML directo (anon) ✅ (2026-09-15)

**Problema:** tras el Paso 17 el front prefería RPC, pero anon seguía con INSERT/UPDATE/DELETE + policy `USING true`.

**Qué hicimos:**
- RPCs `caja_delete_arqueo` / `caja_delete_cierre`
- Policies solo `SELECT` en movimientos / arqueos / cierres
- `REVOKE INSERT, UPDATE, DELETE` para `anon` y `authenticated`
- `cajaRepository`: escrituras remotas **solo** RPC + `actor` obligatorio
- Sync venta/CC/egreso/planilla: pasan `actorId`

**Triggers PlotLab** (DEFINER) siguen escribiendo en servidor; no usan grants de anon.

**Patches:** `2026-09-15_control_caja_revoke_dml.sql` (aplicado en prod)

**Verificar (después de deploy front):**
1. Movimiento / arqueo / cierre con usuario logueado → OK
2. SQL como anon: `INSERT INTO control_caja_movimientos ...` → falla
3. `SELECT` de movimientos → OK
4. Cobro venta → caja (con vendedor) → OK; sin usuario → omitido (trigger DB puede cubrir)

**Siguiente:** REVOKE DML en traspasos/planillas/egresos; o un origen canónico (Fase 2).

---

## Paso 19 — Caja resto: RPC aux + sin DML anon ✅ (2026-09-15)

**Problema:** tras 16–18, 8 tablas `control_caja_*` seguían con INSERT/UPDATE/DELETE + policy abierta.

**Qué hicimos:**
- RPC `caja_upsert_aux(p_actor_id, p_kind, p_row)` para: caja, traspaso, egreso, lote, planilla, concil_mp/banco, diferencia
- Policies solo SELECT + `REVOKE` DML en esas 8 tablas
- Front: escrituras por `rpcCajaUpsertAux` con actor

**Patch:** `supabase/patches/2026-09-15_control_caja_paso19_aux_revoke.sql` (aplicado en prod)

**Verificar (después de deploy):**
1. Ensure caja operativa al entrar mostrador
2. Cierre de turno / lote / egreso / planilla PDF
3. Config fondo + concil MP/banco (admin)
4. Anon: `INSERT INTO control_caja_traspasos` → falla

**Siguiente:** Paso 20 (TRUNCATE en ventas/pagos) o un origen canónico (Fase 2).

---

## Paso 20 — Ventas/pagos: sin TRUNCATE anon ✅ (2026-09-15)

**Problema:** tablas comerciales (`ventas`, `ventas_items`, `pagos`, CxC, facturas, CRM oportunidades/seguimientos, presupuestos, `pagos_cobros`/`pagos_proveedores`) tenían TRUNCATE/REFERENCES/TRIGGER para anon. Varias sin RLS. `api.ts` aún escribe DML directo → no REVOKE INSERT/UPDATE/DELETE todavía.

**Qué hicimos:**
- `REVOKE TRUNCATE, REFERENCES, TRIGGER` en esas 11 tablas (mismo patrón Paso 16 caja)
- Front sin cambios (SELECT/DML siguen)

**Patch:** `supabase/patches/2026-09-15_ventas_pagos_revoke_truncate.sql` (aplicado en prod)

**Verificar:**
1. Venta rápida / CRM ventas / cobros siguen OK
2. Anon: `TRUNCATE ventas` → falla
3. Anon grants = solo DELETE, INSERT, SELECT, UPDATE

**Siguiente (Paso 21):** RPC DEFINER + actor gate para escrituras de `ventas`/`pagos` (y luego REVOKE DML), o un origen canónico (Fase 2).
