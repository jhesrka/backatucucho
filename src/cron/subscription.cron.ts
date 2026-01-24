import cron from "node-cron";
import { SubscriptionService } from "../presentation/services/subscription.service";

export const startSubscriptionCron = () => {
    // Ejecutar todos los días a las 2:00 AM
    cron.schedule("0 2 * * *", async () => {
        console.log("➡️ [CRON] INICIANDO COBRO DE SUSCRIPCIONES:", new Date().toLocaleString());

        const subscriptionService = new SubscriptionService();

        try {
            const results = await subscriptionService.processDailySubscriptions();
            console.log("✅ [CRON] SUSCRIPCIONES PROCESADAS:", results);
        } catch (error) {
            console.error("❌ [CRON] ERROR EN SUBSCRIPTION CRON:", error);
        }
    });

    // Nota: Para pruebas iniciales se podría agregar un cron más frecuente,
    // pero para producción 2 AM es ideal.
};
