-- Agregar rol 'compras' al sistema
DO $$
BEGIN
  -- Eliminar constraint existente si la hubiera
  ALTER TABLE public.usuarios
    DROP CONSTRAINT IF EXISTS usuarios_rol_check;

  -- Crear nuevo constraint con el rol 'compras' agregado
  ALTER TABLE public.usuarios
    ADD CONSTRAINT usuarios_rol_check CHECK (
      rol IN (
        'administracion',
        'gerencia',
        'recursos-humanos',
        'diseno',
        'imprenta',
        'taller-grafico',
        'instalaciones',
        'metalurgica',
        'caja',
        'mostrador',
        'compras'
      )
    );
END $$;

