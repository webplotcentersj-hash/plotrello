-- Paso 11 seguridad (clientes): recortar SELECT/INSERT/UPDATE/DELETE de la tabla.
-- NO activa RLS. Lecturas: clientes_publico (owner). Escrituras: RPCs DEFINER.
-- buscar_o_crear_cliente intacto (tótem / OP).

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.clientes FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.clientes FROM authenticated;

-- Vista: solo lectura (por si quedó GRANT ALL heredado)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.clientes_publico FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.clientes_publico FROM authenticated;
GRANT SELECT ON public.clientes_publico TO anon, authenticated;

-- Misma higiene en usuarios_publico (aún tenía ALL heredado)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.usuarios_publico FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.usuarios_publico FROM authenticated;
GRANT SELECT ON public.usuarios_publico TO anon, authenticated;

COMMENT ON TABLE public.clientes IS
  'PII + password_hash. Anon/authenticated sin DML ni SELECT; usar clientes_publico y RPCs DEFINER.';
