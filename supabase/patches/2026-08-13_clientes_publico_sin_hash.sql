-- Paso 8 seguridad (clientes): ocultar password_hash y recortar GRANTs peligrosos.
-- NO activa RLS. NO revoca SELECT/UPDATE todavía (fusión y algunos updates van directo).
-- Lecturas del cliente deben usar clientes_publico (igual que usuarios_publico).

CREATE OR REPLACE VIEW public.clientes_publico AS
SELECT
  id,
  nombre,
  dni_cuit,
  telefono,
  email,
  direccion,
  ubicacion_link,
  drive_link,
  created_at,
  updated_at,
  usuario,
  apellido,
  empresa,
  activo,
  es_cliente_web
FROM public.clientes;

COMMENT ON VIEW public.clientes_publico IS
  'Ficha de cliente sin password_hash. El front debe leer acá, no public.clientes.';

GRANT SELECT ON public.clientes_publico TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.clientes_publico FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.clientes_publico FROM authenticated;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.clientes FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.clientes FROM authenticated;
