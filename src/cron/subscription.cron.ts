import cron from "node-cron";
import { SubscriptionService as BusinessSubscriptionService } from "../presentation/services/subscription.service";
import { SubscriptionService as UserSubscriptionService } from "../presentation/services/postService/subscription.service";

export const startSubscriptionCron = () => {
    // Ejecutar todos los días a las 2:00 AM
    cron.schedule("0 2 * * *", async () => {
        console.log("➡️ [CRON] INICIANDO PROCESAMIENTO DE SUSCRIPCIONES:", new Date().toLocaleString());

        const businessService = new BusinessSubscriptionService();
        const userService = new UserSubscriptionService();

        try {
            // 1. Procesar suscripciones de Negocios
            const businessResults = await businessService.processDailySubscriptions();
            console.log("✅ [CRON] NEGOCIOS PROCESADOS:", businessResults);

            // 2. Procesar suscripciones de Usuarios (BASIC)
            const userResults = await userService.processUserAutoRenewals();
            console.log("✅ [CRON] USUARIOS PROCESADOS:", userResults);

        } catch (error) {
            console.error("❌ [CRON] ERROR CRÍTICO EN SUBSCRIPTION CRON:", error);
        }
    }, { timezone: "America/Guayaquil" });

    console.log("[CRON] Sistema de renovación automática (Negocios y Usuarios) inicializado (2:00 AM daily)");
};
