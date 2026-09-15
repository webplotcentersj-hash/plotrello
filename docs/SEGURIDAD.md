# Seguridad Plotrello — resumen operativo

> Última actualización: 2026-09-15 · Paso 19 caja completa sin DML anon.

---

## 1. Mapa de infraestructura y puertos

| Servicio | Puerto / URL | Acceso | Notas |
|----------|----------------|--------|-------|
| **Frontend (Vercel)** | `443` HTTPS | Público | SPA React, headers en `vercel.json` |
| **API Vercel** | `/api/*` | Mixto | Ver lista blanca abajo |
| **Supabase PostgREST** | `443` → `*.supabase.co` | Anon key en bundle | **Riesgo principal** — RLS debe acotar |
| **Supabase Storage** | `443` | Anon (hoy público) | Migrar a signed URLs |
| **Supabase Realtime** | `443` wss | Anon | Revisar canales |
| **Gemini API** | `443` Google | Solo servidor (`GEMINI_API_KEY`) | Borrar `VITE_GEMINI` de Production |
| **Resend** | `443` | Solo server | OK |
| **Telegram** | `443` | Webhook `/api/telegram/webhook` | Secret obligatorio en prod |
| **Dev Vite** | `5173` localhost | Solo dev | `host` solo con `VITE_DEV_LAN=1` |
| **n8n** | externo | Credenciales vault | No service role en JSON |

**No hay servidores propios con puertos abiertos** — todo es serverless + Supabase managed.

---

## 2. Cambios aplicados (documentados)

| Archivo | Cambio |
|---------|--------|
| `api/_lib/security.ts` | **Nuevo** — auth Bearer fail-closed, CORS restrictivo, keys server-only |
| `api/admin/backup-json.ts` | Token **obligatorio** en producción (`PLOT_LAB_BACKUP_TOKEN`) |
| `api/admin/fichas-activas-pdf.ts` | Idem backup |
| `api/notify-orden-lista.ts` | `NOTIFY_ORDEN_WEBHOOK_SECRET` obligatorio en prod |
| `api/plotai/generate-image.ts` | `GEMINI_API_KEY` server-only en prod |
| `api/plotai/generate-content.ts` | PlotAI staff/caja vía servidor (sin `VITE_GEMINI`) |
| `src/services/geminiLiveKey.ts` | Live: key vía `/api/plotai/live-voice`; `VITE_` solo en vite dev |
| `api/auth/staff-login.ts` | JWT staff post-login (`PLOT_LAB_STAFF_JWT_SECRET`) |
| `api/auth/staff-session.ts` | Verificación de sesión staff |
| `src/hooks/useAuth.ts` | Mock admin solo con `VITE_DEV_MOCK_AUTH=1` |
| `vite.config.ts` | Dev no expone LAN salvo `VITE_DEV_LAN=1` |
| `vercel.json` | HSTS, Referrer-Policy, Permissions-Policy |
| `.env.example` | Plantilla sin secretos reales |
| `supabase/patches/2026-06-02_seguimiento_publico_seguro.sql` | RPC pública acotada + `seguimiento_token` |
| `src/services/api.ts` | `getOrdenSeguimientoPublico()` |
| `OpPublicPage` / `FirmaClientePage` | Usan RPC acotada (fallback legacy) |
| `src/utils/sanitizeHtml.ts` | Anti-XSS en salidas IA |
| Componentes IA | `sanitizeHtml` en markdown renderizado |
| `supabase/patches/2026-08-13_user_notifications_rpcs_paso1.sql` | RPCs campanita; sin RLS |
| `supabase/patches/2026-08-13_usuarios_rpc_actor_gate.sql` | Gate actor en crear/actualizar/baja |
| `api/telegram/webhook.ts` | `TELEGRAM_WEBHOOK_SECRET` obligatorio en Production |
| `supabase/patches/2026-08-13_clientes_publico_sin_hash.sql` | Vista sin hash + recortar TRUNCATE |
| `supabase/patches/2026-08-13_clientes_rpc_actor_gate.sql` | Gate actor en crear/habilitar/quitar/actualizar portal |
| `supabase/patches/2026-08-13_clientes_ficha_fusion_rpc.sql` | Ficha + fusión con actor |
| `supabase/patches/2026-08-13_clientes_revoke_dml.sql` | REVOKE SELECT/DML anon en `clientes`; vistas solo SELECT |
| `supabase/patches/2026-09-15_control_caja_revoke_truncate.sql` | Caja: sin TRUNCATE/REFERENCES/TRIGGER para anon (Paso 16) |
| `supabase/patches/2026-09-15_control_caja_rpcs_actor_gate.sql` | Caja: RPCs upsert/delete con actor gate (Paso 17) |
| `supabase/patches/2026-09-15_control_caja_revoke_dml.sql` | Caja: REVOKE DML; solo SELECT + RPC (Paso 18) |
| `supabase/patches/2026-09-15_control_caja_paso19_aux_revoke.sql` | Caja resto: upsert_aux + REVOKE (Paso 19) |

### Variables nuevas en Vercel (configurar ya)

```bash
PLOT_LAB_BACKUP_TOKEN=<aleatorio 32+ chars>
NOTIFY_ORDEN_WEBHOOK_SECRET=<aleatorio 32+ chars>
PLOT_LAB_ALLOWED_ORIGINS=https://trello.plotcenter.com.ar,https://plotrello.vercel.app
GEMINI_API_KEY=<sin VITE_ en producción>
PLOT_LAB_STAFF_JWT_SECRET=<aleatorio 32+ chars>
TELEGRAM_WEBHOOK_SECRET=<aleatorio; mismo valor en setWebhook secret_token>
```

---

## 3. Tres zonas de acceso

| Zona | Rutas | Auth |
|------|-------|------|
| **Pública cliente** | `/op-public/*`, firma tablet | RPC `get_orden_seguimiento_publico` |
| **Cliente portal** | `/cliente/*` | Login cliente (pendiente JWT) |
| **Staff** | Resto PlotLab | JWT vía `/api/auth/staff-login` (12 h) |

Lo público **sigue funcionando** (QR, WhatsApp). Solo expone: estado, descripción, fecha entrega, nombre cliente.

---

## 4. Plan por sensibilidad (orden de ejecución)

### 🔴 P0 — Crítico (semana 1)

| # | Proceso | Acción | Estado |
|---|---------|--------|--------|
| 1 | Rotación keys | Anon, service role, Gemini, Resend, Telegram | **Manual Vercel/Supabase** |
| 2 | Backup admin | Token obligatorio | ✅ Código |
| 3 | Seguimiento público | RPC acotada | ✅ Código + SQL |
| 4 | `usuarios.password_hash` | Revocar SELECT anon | ✅ SQL + código |
| 5 | `configuracion_afip` | Solo RPC / vista | ✅ SQL + código |

### 🟠 P1 — Alto (semanas 2–3)

| # | Proceso | Acción |
|---|---------|--------|
| 6 | Sesión JWT staff + cliente | Emitir token post-login | ✅ Staff (Paso 5) |
| 7 | RLS `ordenes_trabajo` staff | Por rol, no `USING (true)` |
| 8 | Gemini 100% server | Proxy `/api/plotai/*`; `VITE_` solo dev. ✅ Paso 13 · falta borrar env Vercel |
| 9 | Storage `archivos` | Bucket privado + signed URL |
| 10 | Telegram webhook | Secret obligatorio en prod. ✅ Paso 14 · allowlist opcional |

### 🟡 P2 — Medio (semanas 4–6)

| # | Proceso | Acción |
|---|---------|--------|
| 11 | ERP / caja / RRHH RLS | Por dominio incremental |
| 11b | `user_notifications` | RPCs DEFINER, sin fallback de tabla. **No ENABLE RLS** hasta JWT. ✅ Pasos 1 + 12 + 15 |
| 12 | RPC admin usuarios | Gate actor admin/gerencia/RRHH en crear/actualizar/baja. **No** revocar EXECUTE anon. ✅ 2026-08-13 |
| 13 | Portal / ficha `clientes` | Vista sin hash + gate actor + REVOKE tabla. **No RLS.** ✅ Pasos 8–11 |
| 14 | DOMPurify npm | Reemplazar fallback strip-tags |
| 15 | Secret scanning CI | gitleaks en PR |

### Notificaciones — paso 1 (hecho) / paso 2 (no hacer todavía)

Staff usa `usuarios.id` entero + anon key. Las 3 policies existentes de `user_notifications` filtran con `auth.uid()` (UUID). Activarlas vaciaría la campanita.

| Hecho | Pendiente (después de verificar campanita) |
|-------|--------------------------------------------|
| RPCs `listar_notificaciones_usuario`, `marcar_notificacion_leida`, `marcar_todas_notificaciones_leidas`, `crear_notificacion_usuario`, `notif_existe_reciente` | JWT staff en el claim → entonces RLS deny-all + drop policies viejas |
| Revocados TRUNCATE / REFERENCES / TRIGGER a anon+authenticated | Revocar SELECT/INSERT/UPDATE/DELETE directos (después de Realtime/JWT) |
| `api.ts` solo RPC ✅ Paso 15 | Realtime sigue `postgres_changes` (SELECT en tabla) |
| Patch: `supabase/patches/2026-08-13_user_notifications_rpcs_paso1.sql` | IDOR residual: el cliente aún manda `p_user_id` |

### 🟢 P3 — Mantenimiento continuo

- `npm audit` mensual
- Revisión trimestral policies RLS
- Backup Supabase PITR (no solo JSON manual)
- Limpiar credenciales de docs/SQL históricos

---

## 5. Superficie pública permitida (lista blanca)

| Endpoint | Método | Datos |
|----------|--------|-------|
| `get_orden_seguimiento_publico` | RPC | Estado OP cliente |
| `/op-public/:ref` | GET UI | Idem |
| `/api/plotai/chat-public` | POST | FAQ (rate limit pendiente) |
| `login_usuario` / `login_cliente_web` | RPC | Emite sesión |
| `firmas_entrega_cliente` upsert | REST | Solo firma entrega |

**Todo lo demás → requiere sesión staff o cliente.**

---

## 6. Análisis de rendimiento (post-hardening)

| Área | Observación | Recomendación |
|------|-------------|---------------|
| **Kanban** | Cache 800 OPs en localStorage 12h | Reducir campos cacheados; TTL 2h |
| **Bundle** | Chunks >500KB (xlsx, jspdf, plotai) | Lazy load por ruta (ya parcial) |
| **Supabase** | `select('*')` frecuente | Proyecciones por pantalla |
| **RPC pública** | 1 query indexada por QR | OK — mejor que `select *` |
| **PlotAI cliente** | Gemini directo = latencia + key | Mover a API server (P1) |
| **PWA** | Precache grande | Mantener `globIgnores` pdf/xlsx |
| **API backup** | Hasta 200k historial | Solo admin con token; no cron público |

**Impacto de seguridad en perf:** RPC pública es **igual o más rápida** que `select *`. JWT añade ~0ms (header). RLS bien indexado no degrada si policies usan columnas indexadas (`id`, `cliente_id`).

---

## 7. Mantenimiento recomendado

### Semanal
- Revisar logs Vercel (401/503 en `/api/admin/*`)
- Verificar que `PLOT_LAB_BACKUP_TOKEN` sigue configurado

### Mensual
- `npm audit fix` (sin breaking)
- Rotar tokens si hubo rotación de personal
- Revisar usuarios activos / bajas en `usuarios`

### Trimestral
- Auditoría RLS: `list_tables` + policies en Supabase
- Test penetración manual: curl anon key vs tablas sensibles
- Actualizar este documento

### Incidente (si filtran anon key)
1. Rotar anon key Supabase
2. Revisar logs PostgREST 24h
3. Rotar service role si se sospecha uso
4. Forzar re-login staff (cuando JWT esté activo)

---

## 8. Checklist deploy post-cambios

- [x] `PLOT_LAB_BACKUP_TOKEN` en Vercel Production
- [x] `NOTIFY_ORDEN_WEBHOOK_SECRET` en Vercel Production
- [ ] `GEMINI_API_KEY` (sin `VITE_`) en Vercel — Paso 3.1 (manual)
- [ ] Eliminar `VITE_GEMINI_API_KEY` de Production — Paso 3.1 (manual; código Paso 13 listo)
- [ ] `TELEGRAM_WEBHOOK_SECRET` + `setWebhook` con el mismo `secret_token` — Paso 14
- [ ] Aplicar patch `2026-06-02_seguimiento_publico_seguro.sql` en Supabase
- [ ] Probar QR `/op-public/{numero_op}` sigue mostrando estado
- [ ] Probar backup con `Authorization: Bearer <token>`

---

## 9. Referencias en código

- Librería seguridad API: `api/_lib/security.ts`
- Ejemplo env: `.env.example`
- Patch seguimiento: `supabase/patches/2026-06-02_seguimiento_publico_seguro.sql`
