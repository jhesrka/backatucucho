
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
            const days = settings.reportsRetentionDays || 30;

            console.log(`🧹 Purging reports older than ${days} days...`);
            const result = await adminReportService.purgeOldReports(days);

            console.log(`✅ Report purge complete. Deleted records:`, result);
        } catch (error) {
            console.error("❌ Error in report purge cron job:", error);
        }
    });
};
