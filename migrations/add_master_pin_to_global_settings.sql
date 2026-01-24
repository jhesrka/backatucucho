-- Migración: Agregar columna masterPin a la tabla global_settings
-- Fecha: 2026-01-18
-- Descripción: Agrega el campo masterPin (VARCHAR(4)) para almacenar el PIN maestro global

-- Verificar si la columna ya existe antes de agregarla
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'global_settings' 
        AND column_name = 'masterPin'
    ) THEN
        ALTER TABLE "global_settings" 
        ADD COLUMN "masterPin" VARCHAR(4) NULL;
        
        RAISE NOTICE 'Columna masterPin agregada exitosamente';
    ELSE
        RAISE NOTICE 'La columna masterPin ya existe';
    END IF;
END $$;

-- Verificar la estructura de la tabla
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'global_settings'
ORDER BY ordinal_position;
