import { encriptAdapter } from "./config/bcrypt.adapter";
import { GlobalSettings } from "./data";
import { PostgresDatabase } from "./data/postgres/postgres-database";
import { envs } from "./config";
import fs from "fs";

async function testPin() {
    await PostgresDatabase.connect({
        dbName: envs.POSTGRES_DB,
        host: envs.POSTGRES_HOST,
        password: envs.POSTGRES_PASSWORD,
        user: envs.POSTGRES_USER,
        port: envs.POSTGRES_PORT,
    });

    const settings = await GlobalSettings.findOne({ where: {}, order: { updatedAt: "DESC" } });
    if (!settings || !settings.masterPin) {
        console.log("No PIN found in GlobalSettings");
        process.exit(1);
    }

    const testPins = ["1503", "1234", "0000", "1111"];
    let output = `Testing against hash: ${settings.masterPin}\n`;

    for (const pin of testPins) {
        const match = encriptAdapter.compare(pin, settings.masterPin);
        output += `PIN [${pin}]: ${match ? "MATCH" : "NO MATCH"}\n`;
    }

    fs.writeFileSync("pin_comparison_test.txt", output);
    console.log("Test finished. Results in pin_comparison_test.txt");
    process.exit(0);
}

testPin();
