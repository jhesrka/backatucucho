
// @ts-ignore
import { Client } from 'pg';
import { envs } from './config';

async function addDeletedAtColumn() {
    const client = new Client({
        user: envs.DB_USERNAME,
        host: envs.DB_HOST,
        database: envs.DB_DATABASE,
        password: envs.DB_PASSWORD,
        port: envs.DB_PORT,
    });

    try {
        await client.connect();
        console.log('Connected to database to check columns...');

        // Check if column exists
        const checkQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'user' AND column_name = 'deletedAt';
    `;
        const res = await client.query(checkQuery);

        if (res.rows.length === 0) {
            console.log("Column 'deletedAt' NOT found in table 'user'. Adding it...");
            await client.query('ALTER TABLE "user" ADD COLUMN "deletedAt" TIMESTAMP;');
            console.log("Column 'deletedAt' added successfully.");
        } else {
            console.log("Column 'deletedAt' already exists.");
        }

    } catch (error) {
        console.error('Error executing script:', error);
    } finally {
        await client.end();
    }
}

addDeletedAtColumn();
