import cron from "node-cron";
import { PedidoMotoService } from "../presentation/services/pedidosServices/pedidoMoto.service";

export const startPedidoMotoCron = () => {

  cron.schedule("*/3 * * * * *", async () => {
    console.log("CRON EJECUTADO:", new Date());
    
    try {
      await PedidoMotoService.asignarPedidosAutomaticamente();
      console.log("➡️ ASIGNACIÓN EJECUTADA");

    } catch (error) {
      console.error("❌ ERROR EN CRON:", error);
    }
  });
};
