import cron from "node-cron";
import { PedidoMotoService } from "../presentation/services/pedidosServices/pedidoMoto.service";

export const startPedidoMotoCron = () => {

  let isRunning = false;

  cron.schedule("*/3 * * * * *", async () => {
    if (isRunning) {
      console.log("⚠️ Cron de asignación omitido: Ejecución anterior en progreso.");
      return;
    }

    isRunning = true;
    const ecuadorTime = new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" });
    console.log("CRON EJECUTADO:", ecuadorTime);

    try {
      await PedidoMotoService.asignarPedidosAutomaticamente();
      console.log("➡️ ASIGNACIÓN EJECUTADA");

    } catch (error) {
      console.error("❌ ERROR EN CRON:", error);
    } finally {
      isRunning = false;
    }
  });
};
