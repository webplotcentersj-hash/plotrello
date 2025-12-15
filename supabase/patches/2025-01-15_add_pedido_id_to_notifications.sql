-- Agregar campo pedido_id a user_notifications para notificaciones de pedidos de compra
BEGIN;

-- Agregar columna pedido_id si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_notifications'
      AND column_name = 'pedido_id'
  ) THEN
    ALTER TABLE public.user_notifications
    ADD COLUMN pedido_id integer REFERENCES public.pedidos_compras(id) ON DELETE CASCADE;
    
    RAISE NOTICE '✅ Columna pedido_id agregada a user_notifications';
  ELSE
    RAISE NOTICE 'ℹ️ Columna pedido_id ya existe en user_notifications';
  END IF;
END $$;

-- Crear índice para mejorar el rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_user_notifications_pedido_id 
ON public.user_notifications(pedido_id);

COMMIT;

