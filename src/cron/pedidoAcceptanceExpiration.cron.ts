import { withRedisLock } from "../utils/cron-lock";
import cron from "node-cron";
import { PedidoExpirationService } from "../presentation/services/pedidosServices/pedidoExpiration.service";

export const startPedidoExpirationCron = () => {
  let isRunning = false;

  // Ejecutar cada minuto
  cron.schedule("*/1 * * * *", async () => {
        await withRedisLock("pedidoAcceptanceExpiration", 55, async () => {
    if (isRunning) return;

    isRunning = true;
    try {
      await PedidoExpirationService.checkExpiredPendingOrders();
    } catch (error) {
      console.error("❌ ERROR EN startPedidoExpirationCron:", error);
    } finally {
      isRunning = false;
    }
          });
    }, { timezone: "America/Guayaquil" });
};
