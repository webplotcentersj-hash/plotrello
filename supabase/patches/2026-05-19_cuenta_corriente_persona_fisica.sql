-- Persona física en cuenta corriente + pagaré (validación por tipo en RPC)
ALTER TABLE public.clientes_cuenta_corriente
  ADD COLUMN IF NOT EXISTS tipo_cliente text NOT NULL DEFAULT 'empresa',
  ADD COLUMN IF NOT EXISTS nombre text,
  ADD COLUMN IF NOT EXISTS apellido text,
  ADD COLUMN IF NOT EXISTS url_documento_dni text;

-- Ver migración aplicada vía MCP: cuenta_corriente_tipo_persona_fisica
