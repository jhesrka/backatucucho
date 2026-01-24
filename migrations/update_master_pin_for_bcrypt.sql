-- Migración: Actualizar columna masterPin para almacenar hash bcrypt
-- Fecha: 2026-01-18
-- Descripción: Cambia masterPin de VARCHAR(4) a VARCHAR(60) para almacenar hash bcrypt

-- IMPORTANTE: Esta migración eliminará cualquier PIN existente en texto plano
-- Después de ejecutarla, deberás configurar un nuevo PIN desde la interfaz

DO $$ 
BEGIN
    -- Verificar si la columna existe
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'global_settings' 
        AND column_name = 'masterPin'
    ) THEN
        -- Limpiar valores existentes (texto plano)
        UPDATE "global_settings" SET "masterPin" = NULL;
        
        -- Cambiar tipo de dato para almacenar hash bcrypt (60 caracteres)
        ALTER TABLE "global_settings" 
        ALTER COLUMN "masterPin" TYPE VARCHAR(60);
        
        RAISE NOTICE 'Columna masterPin actualizada a VARCHAR(60) para bcrypt. PIN anterior eliminado por seguridad.';
    ELSE
        -- Si no existe, crearla directamente con el tamaño correcto
        ALTER TABLE "global_settings" 
        ADD COLUMN "masterPin" VARCHAR(60) NULL;
        
        RAISE NOTICE 'Columna masterPin creada con VARCHAR(60)';
    END IF;
END $$;

-- Verificar la estructura actualizada
SELECT column_name, data_type, character_maximum_length, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'global_settings'
ORDER BY ordinal_position;
