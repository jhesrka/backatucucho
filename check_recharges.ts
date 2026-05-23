import { AppDataSource } from "./src/data/postgres/init";
import { RechargeRequest } from "./src/data/postgres/models/rechargeStatus.model";

async function run() {
    await AppDataSource.initialize();
    console.log("DB connected");

    const recharges = await RechargeRequest.find({
        order: { created_at: "DESC" },
        take: 5
    });

    console.log(JSON.stringify(recharges, null, 2));
    process.exit(0);
}

run().catch(console.error);
