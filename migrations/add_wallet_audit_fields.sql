-- Migración: Agregar campos de auditoría a la tabla transactions
-- Fecha: 2026-01-18
-- Descripción: Agrega campos necesarios para el sistema de billetera admin

-- Agregar nuevas columnas a la tabla transactions
ALTER TABLE "transactions" 
ADD COLUMN IF NOT EXISTS "reason" VARCHAR DEFAULT 'RECHARGE',
ADD COLUMN IF NOT EXISTS "origin" VARCHAR DEFAULT 'SYSTEM',
ADD COLUMN IF NOT EXISTS "previousBalance" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "resultingBalance" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "reference" VARCHAR,
ADD COLUMN IF NOT EXISTS "adminId" UUID,
ADD COLUMN IF NOT EXISTS "observation" TEXT;

-- Agregar foreign key para admin (si no existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_transactions_admin'
    ) THEN
        ALTER TABLE "transactions"
        ADD CONSTRAINT "fk_transactions_admin"
        FOREIGN KEY ("adminId") REFERENCES "useradmin"("id");
    END IF;
END $$;

-- Verificar la estructura actualizada
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'transactions'
ORDER BY ordinal_position;
