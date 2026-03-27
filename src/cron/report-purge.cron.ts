
import cron from "node-cron";
import { AdminReportService } from "../presentation/services/report/admin-report.service";
import { GlobalSettingsService } from "../presentation/services/globalSettings/global-settings.service";

export const startReportPurgeCron = () => {
    // Run every day at 04:00 AM
    cron.schedule("0 4 * * *", async () => {
        console.log("🔄 Starting daily report purge cron job...");
        try {
            const globalSettingsService = new GlobalSettingsService();
            const adminReportService = new AdminReportService();

            const settings = await globalSettingsService.getSettings();
            const moderationDays = settings.reportsRetentionDays || 30;

            console.log(`🧹 Purging moderation reports older than ${moderationDays} days...`);
            const moderationResult = await adminReportService.purgeOldReports(moderationDays);
            
            console.log(`🧹 Purging resolved support tickets older than 5 days...`);
            const supportResult = await adminReportService.purgeResolvedSupportTickets(5);

            console.log(`✅ Purge complete. | Moderation: ${moderationResult.deleted} | Support: ${supportResult.deleted}`);
        } catch (error) {
            console.error("❌ Error in report purge cron job:", error);
        }
    });
};
