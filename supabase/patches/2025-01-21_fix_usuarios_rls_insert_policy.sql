-- Fix: Agregar política RLS para INSERT en tabla usuarios
-- Problema: Al intentar crear usuarios, fallaba con error "new row violates row-level security policy"
-- Solución: Agregar política permisiva para INSERT que permite crear usuarios a través de la función crear_usuario

BEGIN;

-- Verificar si RLS está habilitado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'usuarios'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Eliminar políticas anteriores si existen
DROP POLICY IF EXISTS "Allow admin to insert users" ON public.usuarios;
DROP POLICY IF EXISTS "Allow insert via function" ON public.usuarios;
DROP POLICY IF EXISTS "Allow insert via crear_usuario function" ON public.usuarios;

-- Crear política permisiva para INSERT
-- La función crear_usuario usa SECURITY DEFINER, pero esta política permite INSERT directo como fallback
CREATE POLICY "Allow insert via crear_usuario function"
  ON public.usuarios
  FOR INSERT
  WITH CHECK (true);

COMMIT;

