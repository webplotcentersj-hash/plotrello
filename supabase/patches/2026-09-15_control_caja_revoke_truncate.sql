-- Paso 16 seguridad (caja): higiene de grants peligrosos.
-- NO revoca SELECT/INSERT/UPDATE/DELETE (el front aún escribe directo a tablas).
-- NO cambia policies (siguen USING true — se cierran en pasos siguientes vía RPC).
-- Igual patrón que clientes_publico: sacar TRUNCATE / REFERENCES / TRIGGER.

REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.control_caja_cajas FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.control_caja_cajas FROM authenticated;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.control_caja_arqueos FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.control_caja_arqueos FROM authenticated;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.control_caja_movimientos FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.control_caja_movimientos FROM authenticated;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.control_caja_planillas FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.control_caja_planillas FROM authenticated;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.control_caja_cierres FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.control_caja_cierres FROM authenticated;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.control_caja_traspasos FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.control_caja_traspasos FROM authenticated;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.control_caja_concil_mp FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.control_caja_concil_mp FROM authenticated;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.control_caja_concil_banco FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.control_caja_concil_banco FROM authenticated;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.control_caja_diferencias FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.control_caja_diferencias FROM authenticated;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.control_caja_egreso_solicitudes FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.control_caja_egreso_solicitudes FROM authenticated;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.control_caja_transferencia_lotes FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.control_caja_transferencia_lotes FROM authenticated;

COMMENT ON TABLE public.control_caja_movimientos IS
  'Plata operativa. Anon sin TRUNCATE. RLS ON con policy abierta (USING true) — próximo: RPC + REVOKE DML.';
