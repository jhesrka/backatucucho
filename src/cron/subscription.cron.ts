import { withRedisLock } from "../utils/cron-lock";
import cron from "node-cron";
import { SubscriptionService as BusinessSubscriptionService } from "../presentation/services/subscription.service";
import { SubscriptionService as UserSubscriptionService } from "../presentation/services/postService/subscription.service";

export const startSubscriptionCron = () => {
    // Ejecutar cuatro veces al día: 2 AM, 8 AM, 2 PM, 8 PM
    cron.schedule("0 2,8,14,20 * * *", async () => {
        await withRedisLock("subscription", 55, async () => {
        const currentHour = new Date().getHours();
        console.log(`➡️ [CRON] INICIANDO PROCESAMIENTO DE SUSCRIPCIONES (Ciclo: ${currentHour}:00):`, new Date().toLocaleString());

        const businessService = new BusinessSubscriptionService();
        const userService = new UserSubscriptionService();

        try {
            // 1. Procesar suscripciones de Negocios
            const businessResults = await businessService.processDailySubscriptions(currentHour);
            console.log("✅ [CRON] NEGOCIOS PROCESADOS:", businessResults);

            // 2. Procesar suscripciones de Usuarios (BASIC)
            const userResults = await userService.processUserAutoRenewals();
            console.log("✅ [CRON] USUARIOS PROCESADOS:", userResults);

        } catch (error) {
            console.error("❌ [CRON] ERROR CRÍTICO EN SUBSCRIPTION CRON:", error);
        }
            });
    }, { timezone: "America/Guayaquil" });

    console.log("[CRON] Sistema de renovación automática (Negocios y Usuarios) inicializado (4 veces al día)");
};
