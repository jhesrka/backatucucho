
import { AppDataSource } from "../src/data/postgres/app-datasource";
import { Campaign } from "../src/data/postgres/models/Campaign";
import { CampaignLog } from "../src/data/postgres/models/CampaignLog";

async function investigate() {
    try {
        await AppDataSource.initialize();
        console.log("DB Connected.");

        const latestCampaign = await Campaign.findOne({
            order: { createdAt: 'DESC' },
            relations: ['logs']
        });

        if (!latestCampaign) {
            console.log("No campaigns found.");
            return;
        }

        console.log("LATEST CAMPAIGN:", latestCampaign.id, latestCampaign.name);
        console.log("CONTENT:", latestCampaign.content);

        const logs = await CampaignLog.find({
            where: { campaign: { id: latestCampaign.id } },
            take: 5
        });

        console.log("NUM LOGS:", logs.length);
        logs.forEach((log, i) => {
            console.log(`LOG #${i+1} (${log.targetContact}):`);
            console.log("ATTRIBUTES (raw):", JSON.stringify(log.dynamicAttributes, null, 2));
        });

    } catch (e) {
        console.error("DEBUG ERROR:", e);
    } finally {
        process.exit(0);
    }
}

investigate();
