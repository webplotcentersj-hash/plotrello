-- Flota: corregir RLS (integer = uuid) — usuarios.id es integer, auth.uid() es uuid.
-- Ejecutar si falló la creación de políticas o ya existen con la comparación incorrecta.
-- Convención del proyecto: auth.uid()::text::integer (ver menu_diario, protocolos_bases).

BEGIN;

DROP POLICY IF EXISTS "Solo admin y caja pueden modificar vehículos" ON public.vehiculos;
DROP POLICY IF EXISTS "Todos pueden actualizar sus propios registros" ON public.registros_salidas_vehiculos;

CREATE POLICY "Solo admin y caja pueden modificar vehículos"
  ON public.vehiculos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid()::text::integer
      AND rol IN ('administracion', 'caja', 'gerencia')
    )
  );

CREATE POLICY "Todos pueden actualizar sus propios registros"
  ON public.registros_salidas_vehiculos FOR UPDATE
  TO authenticated
  USING (
    id_usuario = auth.uid()::text::integer
    OR EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid()::text::integer
      AND rol IN ('administracion', 'caja', 'gerencia')
    )
  );

COMMIT;
