
import { envs } from './config/env';
import { PostgresDatabase } from './data/postgres/postgres-database';
import { GlobalSettings } from './data/postgres/models/global-settings.model';
import { encriptAdapter } from './config/bcrypt.adapter';
import fs from 'fs';

async function testPin() {
    const logFile = 'pin_comparison_test.txt';
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

    log("--- PIN COMPARISON TEST ---");

    try {
        const settings = await GlobalSettings.findOne({ where: {}, order: { updatedAt: "DESC" } });
        if (!settings || !settings.masterPin) {
            log("FATAL: No Master PIN found in DB.");
            process.exit(1);
        }

        log(`Found PIN Hash in DB: ${settings.masterPin}`);

        const pinToTest = "1503"; // Reemplaza por tu PIN real para probar localmente si quieres
        log(`Testing comparison with hardcoded PIN: ${pinToTest}`);

        const isValid = encriptAdapter.compare(pinToTest, settings.masterPin);
        log(`Comparison Result: ${isValid ? "MATCH" : "NO MATCH"}`);

    } catch (error: any) {
        log(`Error: ${error.message}`);
    }

    log("--- TEST END ---");
    process.exit();
}

testPin();
