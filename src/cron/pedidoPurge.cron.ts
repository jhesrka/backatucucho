import cron from "node-cron";
import { PedidoAdminService } from "../presentation/services/pedidosServices/pedidoAdmin.service";

/**
 * Automáticamente purga los pedidos antiguos del sistema.
 * Se ejecuta una vez al día a las 03:00 AM.
 * Lee la configuración de días de retención desde la base de datos (GlobalSettings).
 */
export const startOrderPurgeCron = () => {
    // Ejecutar todos los días a las 3:00 AM
    cron.schedule("0 3 * * *", async () => {
        console.log("[CRON] Iniciando purga automática de pedidos...");
        try {
            const service = new PedidoAdminService();
            const { deletedCount } = await service.purgeOldOrders();
            console.log(`[CRON] Purga completada. Pedidos eliminados: ${deletedCount}`);
        } catch (error) {
            console.error("[CRON] Error durante la purga de pedidos:", error);
        }
    });

    console.log("[CRON] Sistema de purga automática de pedidos inicializado (3 AM daily)");
};
