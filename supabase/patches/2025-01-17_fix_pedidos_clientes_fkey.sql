-- ============================================
-- FIX: Actualizar restricción de clave foránea de pedidos_clientes
-- ============================================

BEGIN;

-- Eliminar la restricción de clave foránea antigua que apunta a clientes_web
ALTER TABLE public.pedidos_clientes
DROP CONSTRAINT IF EXISTS pedidos_clientes_id_cliente_fkey;

-- Crear nueva restricción de clave foránea que apunta a clientes unificada
ALTER TABLE public.pedidos_clientes
ADD CONSTRAINT pedidos_clientes_id_cliente_fkey
FOREIGN KEY (id_cliente)
REFERENCES public.clientes(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

COMMIT;

