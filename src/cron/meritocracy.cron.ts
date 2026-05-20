import cron from "node-cron";
import { MeritocracyService } from "../presentation/services/pedidosServices/meritocracy.service";

export const startMeritocracyCron = () => {
    const service = new MeritocracyService();

    // Ejecutar una vez al día a las 00:00:05 para comprobar si toca cierre
    cron.schedule("5 0 * * *", async () => {
        try {
            console.log("⏳ [CRON] Comprobando cierre de ciclo de Meritocracia...");
            
            const status = await service.getMeritocracyStatus();
            
            if (status.isPendingClosure && status.canCloseManually) {
                console.log(`✅ [CRON] Ciclo vencido (Fin de ciclo: ${status.currentCycleEnd}). Ejecutando cierre automático de ligas...`);
                await service.processTierUpdate('AUTO');
                console.log("✅ [CRON] Cierre de ciclo de Meritocracia completado con éxito.");
            } else {
                console.log(`ℹ️ [CRON] El ciclo actual no ha vencido aún (Fin de ciclo: ${status.currentCycleEnd}).`);
            }

        } catch (error) {
            console.error("❌ ERROR EN CRON MERITOCRACIA:", error);
        }
    });
};
