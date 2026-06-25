import { withRedisLock } from "../utils/cron-lock";
import cron from "node-cron";
import { GlobalSettingsService } from "../presentation/services/globalSettings/global-settings.service";

export const startGlobalScheduleCron = () => {
    const service = new GlobalSettingsService();

    // Ejecutar cada minuto
    cron.schedule("* * * * *", async () => {
        await withRedisLock("global-schedule", 55, async () => {
        try {
            // console.log("⏳ Comprobando horario de la App...");
            await service.checkAppSchedule();
        } catch (error) {
            console.error("❌ ERROR EN CRON GLOBAL SCHEDULE:", error);
        }
            });
    }, { timezone: "America/Guayaquil" });
};
