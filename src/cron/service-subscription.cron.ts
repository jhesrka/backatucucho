import { withRedisLock } from "../utils/cron-lock";
import cron from "node-cron";
import { UserServiceService } from "../presentation/services/serviciosUsuario/user-service.service";

export const startServiceSubscriptionCron = () => {
    // Se ejecuta cada hora
    cron.schedule("0 * * * *", async () => {
        await withRedisLock("service-subscription", 55, async () => {
        console.log("🕒 [CRON] Iniciando revisión de suscripciones y vencimientos de servicios...");
        try {
            const userService = new UserServiceService();
            await userService.processServiceExpirations();
        } catch (error) {
            console.error("❌ [CRON] Error global en revisión de suscripciones de servicios:", error);
        }
            });
    }, {
        timezone: "America/Guayaquil"
    });
};
