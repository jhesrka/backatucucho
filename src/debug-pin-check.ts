
import { envs } from './config/env';
import { PostgresDatabase } from './data/postgres/postgres-database';
import { GlobalSettings } from './data/postgres/models/global-settings.model';
import { Useradmin } from './data/postgres/models/useradmin.model';
import fs from 'fs';

async function verifyPins() {
    const logFile = 'debug_pin_output_v2.txt';
    const log = (msg: string) => {
        console.log(msg);
        fs.appendFileSync(logFile, msg + '\n');
    };

    if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

    const db = new PostgresDatabase({
        host: envs.DB_HOST,
        port: envs.DB_PORT,
        username: envs.DB_USERNAME,
        password: envs.DB_PASSWORD,
        database: envs.DB_DATABASE,
    });

    await db.connect();

    log("--- DEBUGGER START V2 ---");

    try {
        const allSettings = await GlobalSettings.find({ order: { updatedAt: "DESC" } });
        log(`Total GlobalSettings Records: ${allSettings.length}`);
        allSettings.forEach((s, i) => {
            log(`Record ${i}: ID=${s.id}, PIN=${s.masterPin ? 'PRESENT' : 'NULL'}, Updated=${s.updatedAt}`);
            if (s.masterPin) log(`  Hash=${s.masterPin}`);
        });

        const admins = await Useradmin.find();
        log(`Total Admins: ${admins.length}`);
        admins.forEach(admin => {
            log(`Admin ${admin.id} (${admin.email}): Security PIN Present: ${!!admin.securityPin}`);
        });
    } catch (error: any) {
        log(`Error running debug script: ${error.message}`);
    }

    log("--- DEBUGGER END ---");
    process.exit();
}

verifyPins();
