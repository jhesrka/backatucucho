import { Transaction } from './src/data/postgres/models/transactionType.model';
import { PostgresDatabase } from './src/data/postgres/postgres-database';
import { envs } from './src/config/env';

async function fixEnum() {
    await PostgresDatabase.connect({
        host: envs.DB_HOST,
        port: envs.DB_PORT,
        username: envs.DB_USERNAME,
        password: envs.DB_PASSWORD,
        database: envs.DB_DATABASE,
    });

    try {
        console.log("Checking and fixing transactions_reason_enum...");
        
        // Postgres query to add the value if it doesn't exist
        await Transaction.getRepository().query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'transactions_reason_enum' AND e.enumlabel = 'CASH_RECHARGE') THEN
                    ALTER TYPE transactions_reason_enum ADD VALUE 'CASH_RECHARGE';
                END IF;
            END $$;
        `);
        
        console.log("Migration successful: CASH_RECHARGE added to enum.");
    } catch (error) {
        console.error("Error during migration:", error);
    } finally {
        process.exit(0);
    }
}

fixEnum();
