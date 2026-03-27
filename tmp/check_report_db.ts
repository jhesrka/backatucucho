
import { AppDataSource } from "../src/data/postgres/postgres-database";
import { Report } from "../src/data/postgres/models/report.model";

async function checkTable() {
    try {
        await AppDataSource.initialize();
        console.log("DB Initialized");
        const count = await Report.count();
        console.log("Report count:", count);
        const columns = await AppDataSource.query("SELECT * FROM information_schema.columns WHERE table_name = 'report'");
        console.log("Columns:", columns.map(c => c.column_name));
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

checkTable();
