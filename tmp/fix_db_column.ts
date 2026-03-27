
import { AppDataSource } from "../src/data/postgres/postgres-database";

async function addColumn() {
    try {
        await AppDataSource.initialize();
        console.log("DB Initialized");
        await AppDataSource.query("ALTER TABLE report ADD COLUMN IF NOT EXISTS \"resolvedAt\" TIMESTAMP");
        console.log("Column added or already exists");
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

addColumn();
