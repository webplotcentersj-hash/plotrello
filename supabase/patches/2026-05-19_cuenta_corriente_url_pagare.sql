-- URL del pagaré prearmado (Storage) en alta persona física
ALTER TABLE public.clientes_cuenta_corriente
  ADD COLUMN IF NOT EXISTS url_pagare text;

-- RPC registrar_alta_cuenta_corriente: p_url_pagare obligatorio si tipo = persona_fisica
-- (aplicado vía MCP: cuenta_corriente_url_pagare)
