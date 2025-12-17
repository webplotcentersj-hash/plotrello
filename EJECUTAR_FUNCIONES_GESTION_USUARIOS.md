# ⚠️ EJECUTAR ESTO EN LA BASE DE DATOS PRINCIPAL

**Base de datos:** https://bwdtrzcdzbzrtykjzber.supabase.co

## Pasos:

1. Ve a: https://bwdtrzcdzbzrtykjzber.supabase.co
2. Abre el **SQL Editor**
3. Copia y pega el contenido del archivo `supabase/patches/2025-01-17_add_funciones_gestion_usuarios.sql`
4. Haz clic en **RUN** o presiona `Ctrl+Enter`
5. Verifica que no haya errores

## Funciones creadas:

1. **`actualizar_usuario`**: Permite actualizar nombre, rol y/o contraseña de un usuario
2. **`eliminar_usuario`**: Permite eliminar un usuario (no permite eliminar administradores)

Estas funciones son necesarias para que el sistema de Recursos Humanos pueda gestionar usuarios completamente.

