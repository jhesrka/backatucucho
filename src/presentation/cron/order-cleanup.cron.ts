import { CronJob } from "cron";
import { PedidoAdminService } from "../services/pedidosServices/pedidoAdmin.service";

// Ejecutar todos los días a las 04:00 AM
export const startOrderCleanupCron = () => {
    const job = new CronJob("0 4 * * *", async () => {
        console.log("[CRON] Iniciando purga de pedidos antiguos...");
        try {
            const pedidoAdminService = new PedidoAdminService();
            const result = await pedidoAdminService.purgeOldOrders();
            console.log(`[CRON] Purga finalizada. Eliminados: ${result.deletedCount} pedidos.`);
        } catch (error) {
            console.error("[CRON] Error en purga de pedidos:", error);
        }
    });

    job.start();
};
