-- Paso 20 seguridad (comercial): higiene de grants peligrosos.
-- NO revoca SELECT/INSERT/UPDATE/DELETE (api.ts aún escribe directo a ventas/pagos).
-- Igual que Paso 16 en caja: sacar TRUNCATE / REFERENCES / TRIGGER.

REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.ventas FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.ventas_items FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.pagos FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.pagos_cobros FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.pagos_proveedores FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.cuentas_por_cobrar FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.facturas_venta FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.oportunidades_venta FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.seguimientos_venta FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.presupuestos_ventas FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.presupuestos_ventas_items FROM anon, authenticated;

COMMENT ON TABLE public.ventas IS
  'Paso 20: anon sin TRUNCATE. DML directo hasta RPC+REVOKE (Paso 21+).';
COMMENT ON TABLE public.pagos IS
  'Paso 20: anon sin TRUNCATE. DML directo hasta RPC+REVOKE (Paso 21+).';
