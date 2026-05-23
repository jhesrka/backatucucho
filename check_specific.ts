import { AppDataSource } from "./src/data/postgres/data-source";
import { RechargeRequest } from "./src/data/postgres/models/rechargeStatus.model";
import { Like } from "typeorm";

async function run() {
    await AppDataSource.initialize();
    
    // Look for those specific IDs
    const recharges = await RechargeRequest.find({
        where: [
            { id: Like("2a43a4e2%") },
            { id: Like("5f6689c4%") }
        ]
    });

    console.log(JSON.stringify(recharges, null, 2));
    process.exit(0);
}

run().catch(console.error);
