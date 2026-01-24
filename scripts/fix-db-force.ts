
import { envs } from './config/env';
import { PostgresDatabase } from './data/postgres/postgres-database';

async function fix() {
    console.log("Initializing DB connection for fix...");
    const db = new PostgresDatabase({
        username: envs.DB_USERNAME,
        password: envs.DB_PASSWORD,
        host: envs.DB_HOST,
        database: envs.DB_DATABASE,
        port: envs.DB_PORT,
    });

    try {
        await db.connect();
        console.log("Connected to DB via TypeORM class.");

        const runner = db.datasource.createQueryRunner();
        await runner.connect();

        console.log("Checking for deletedAt column in user table...");
        try {
            await runner.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP`);
            console.log("Executed ALTER TABLE command successfully.");
        } catch (err) {
            console.error("Error running ALTER TABLE:", err);
        }

        await runner.release();
        await db.datasource.destroy();
        console.log("Fix script finished.");

    } catch (error) {
        console.error("Error in fix script:", error);
    }
}

fix();
