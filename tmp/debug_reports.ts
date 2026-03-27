
import { AppDataSource } from "../src/data/postgres/data-source";
import { Report } from "../src/data/postgres/models/report.model";

async function debugReports() {
    try {
        await AppDataSource.initialize();
        console.log("DB Initialized");
        const reports = await Report.find({ relations: ["user"] });
        console.log("Found:", reports.length);
        if (reports.length > 0) {
            console.log("First report user:", reports[0].user?.id);
        }
        process.exit(0);
    } catch (err) {
        console.error("Error fetching reports:", err);
        process.exit(1);
    }
}

debugReports();
