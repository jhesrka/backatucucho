
import { envs } from './config/env';
import { PostgresDatabase } from './data/postgres/postgres-database';
import { GlobalSettings } from './data/postgres/models/global-settings.model';
import fs from 'fs';

async function verifyQuery() {
    const logFile = 'debug_query_output.txt';
    const log = (msg: string) => { console.log(msg); fs.appendFileSync(logFile, msg + '\n'); };
    if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

    const db = new PostgresDatabase({
        host: envs.DB_HOST,
        port: envs.DB_PORT,
        username: envs.DB_USERNAME,
        password: envs.DB_PASSWORD,
        database: envs.DB_DATABASE,
    });

    await db.connect();

    log("--- QUERY TEST START ---");

    try {
        // Test 1: findOne with order
        const res1 = await GlobalSettings.findOne({ order: { updatedAt: "DESC" } });
        log(`Result 1 (order only): Found=${!!res1}, PIN=${res1?.masterPin ? 'PRESENT' : 'NULL'}`);

        // Test 2: findOne with empty where and order
        const res2 = await GlobalSettings.findOne({ where: {}, order: { updatedAt: "DESC" } });
        log(`Result 2 (where:{} + order): Found=${!!res2}, PIN=${res2?.masterPin ? 'PRESENT' : 'NULL'}`);

        // Test 3: find with order
        const res3 = await GlobalSettings.find({ order: { updatedAt: "DESC" }, take: 1 });
        log(`Result 3 (find + take:1): Found=${res3.length > 0}, PIN=${res3[0]?.masterPin ? 'PRESENT' : 'NULL'}`);

    } catch (error: any) {
        log(`Error: ${error.message}`);
    }

    log("--- QUERY TEST END ---");
    process.exit();
}

verifyQuery();
