
// @ts-ignore
import { Client } from 'pg';
import { envs } from './config/env';

async function fixFinal() {
    console.log("------------------------------------------------");
    console.log("FIX DB SCRIPT STARTED");
    console.log(`Connecting to Host: ${envs.DB_HOST}, DB: ${envs.DB_DATABASE}, User: ${envs.DB_USERNAME}`);

    const client = new Client({
        user: envs.DB_USERNAME,
        host: envs.DB_HOST,
        database: envs.DB_DATABASE,
        password: envs.DB_PASSWORD,
        port: envs.DB_PORT,
    });

    try {
        await client.connect();
        console.log("Connected successfully!");

        // 1. Check if table 'user' exists
        const resTable = await client.query(`SELECT to_regclass('public.user');`);
        console.log("Table 'public.user' check:", resTable.rows[0]);

        // 2. Add column
        try {
            console.log("Attempting to add 'deletedAt' column...");
            await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;`);
            console.log("SUCCESS: Column 'deletedAt' ensured.");
        } catch (e) {
            console.error("FAIL: Could not add column 'deletedAt'", e);
        }

        // 3. Verify
        const resCol = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='user' AND column_name='deletedAt';
    `);

        if (resCol.rows.length > 0) {
            console.log("VERIFICATION: Column 'deletedAt' EXISTS.");
        } else {
            console.error("VERIFICATION: Column 'deletedAt' does NOT exist.");
        }

    } catch (error) {
        console.error("CRITICAL DB ERROR:", error);
    } finally {
        await client.end();
        console.log("------------------------------------------------");
    }
}

fixFinal();
