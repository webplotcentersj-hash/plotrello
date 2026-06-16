# Plotlab + n8n — agenda para más adelante

Notas para cuando retomen automatizaciones (sin implementar ahora).

## Enfoque (orden sugerido)

1. **Flujos clásicos** (cron/webhook → HTTP Supabase → Telegram/email): recordatorios, alertas de OPs, reclamos, salud del sistema.
2. **Un nodo LLM** (Gemini/OpenAI en n8n) donde haga falta texto: resumen ejecutivo, clasificación, borradores — siempre con datos mínimos y revisión humana si aplica.
3. **AI Agent** (n8n) solo si hace falta diálogo + varias herramientas HTTP; con límites, memoria acotada y aprobación humana en acciones sensibles.

## Referencias

- [n8n AI Agents](https://n8n.io/ai-agents/)
- [Plantillas / workflows](https://n8n.io/workflows/)
- [Documentación n8n](https://docs.n8n.io/)

## Ya en marcha (referencia interna)

- Recordatorio Telegram ~30 min antes de citas (agenda asesor): `agenda-telegram-reminders-30m.json` + parche SQL unificado citas/RPC.

## Ideas útiles recordadas (Plotlab)

- OPs atascadas + resumen para reunión diaria.
- Triage de reclamos (severidad, sector, borrador de primera respuesta).
- Post‑cita / preparación visita (si hay datos en Supabase).
- Guardián de ejecuciones fallidas n8n → resumen con LLM.
- RAG con documentación interna cuando la precisión lo justifique.
