import cron from "node-cron";
import { MeritocracyService } from "../presentation/services/pedidosServices/meritocracy.service";
import { PriceSettings } from "../data";

export const startMeritocracyCron = () => {
    const service = new MeritocracyService();

    // Ejecutar una vez al día a las 00:00:05 para comprobar si toca cierre
    cron.schedule("5 0 * * *", async () => {
        try {
            console.log("⏳ [CRON] Comprobando cierre de ciclo de Meritocracia...");
            
            const config = await PriceSettings.findOne({ where: {} });
            if (!config) return;

            const period = config.rankingEvaluationPeriodDays || 7;
            const lastUpdate = config.lastRankingUpdate;

            if (!lastUpdate) {
                console.log("⚠️ No hay registro de último cierre. Ejecutando cierre inicial...");
                await service.processTierUpdate();
                return;
            }

            // Calcular diferencia en días
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - lastUpdate.getTime());
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays >= period) {
                console.log(`✅ [CRON] Periodo cumplido (${diffDays}/${period} días). Cerrando ciclo...`);
                await service.processTierUpdate();
            } else {
                console.log(`ℹ️ [CRON] Faltan ${period - diffDays} días para el cierre del ciclo.`);
            }

        } catch (error) {
            console.error("❌ ERROR EN CRON MERITOCRACIA:", error);
        }
    });
};
