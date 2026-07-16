import dns from "dns";
dns.setDefaultResultOrder("ipv4first");
process.env.TZ = "UTC"; // Forzar Node.js a operar siempre en Hora Universal (UTC)
import "reflect-metadata"; // esto si bien instalamos depues siempre debe ir primero
import { envs, redisClient } from "./config";
import { PostgresDatabase } from "./data";
import { AppRoutes } from "./presentation/routes";
import { Server } from "./presentation/server";
import "dotenv/config";
import { startPedidoMotoCron } from "./cron/pedidoMoto.cron";
import { startSubscriptionCron } from "./cron/subscription.cron";
import { startSubscriptionGuardianCron } from "./cron/subscription-guardian.cron";
import { startSubscriptionRemindersCron } from "./cron/subscription-reminders.cron";
import { startPostExpirationCron } from "./cron/post-expiration.cron";
import { startOrderPurgeCron } from "./cron/pedidoPurge.cron";
import { startReportPurgeCron } from "./cron/report-purge.cron";
import { startGlobalScheduleCron } from "./cron/global-schedule.cron";
import { startStorieExpirationCron } from "./cron/storie-expiration.cron";
import { startPedidoExpirationCron } from "./cron/pedidoAcceptanceExpiration.cron";
import { startSubscriptionCleanupCron } from "./cron/subscription-cleanup.cron";
import { startPostPurgeCron } from "./cron/post-purge.cron";
import { startPostSchedulerCron } from "./cron/post-scheduler.cron";
import { startMeritocracyCron } from "./cron/meritocracy.cron";
import { startRechargeCleanupCron } from "./cron/recharge-cleanup.cron";
import { startServiceSubscriptionCron } from "./cron/service-subscription.cron";

import { ActivityService } from "./presentation/services/activity.service";
import { getIO } from "./config/socket";
import { PedidoUsuarioService } from "./presentation/services/pedidosServices/pedidoUsuario.service";

async function main() {


  const postgres = new PostgresDatabase({
    username: envs.DB_USERNAME,
    password: envs.DB_PASSWORD,
    host: envs.DB_HOST,
    database: envs.DB_DATABASE,
    port: envs.DB_PORT,
  });

  await postgres.connect();

  const server = new Server({
    port: envs.PORT,
    routes: AppRoutes.routes, //este viene de un metodo estatico por es no ponemos new
  });
  // 👇 INICIAR CRONES
  if (envs.ENABLE_CRON_JOBS) {
    console.log("⏰ Cron jobs habilitados.");
    startPedidoMotoCron();
    startSubscriptionCron();
    startSubscriptionGuardianCron();
    startSubscriptionRemindersCron();
    startPostExpirationCron();
    startOrderPurgeCron();
    startReportPurgeCron();
    startGlobalScheduleCron();
    startStorieExpirationCron();
    startPedidoExpirationCron();
    startSubscriptionCleanupCron();
    startPostPurgeCron();
    startPostSchedulerCron();
    startMeritocracyCron();
    startRechargeCleanupCron();
    startServiceSubscriptionCron();
    PedidoUsuarioService.startMaintenanceJob(); // 🚀 Activar limpieza de pedidos y auto-cancelación
  } else {
    console.log("⏸️ Cron jobs deshabilitados por variable de entorno.");
  }

  console.log("🚀 Iniciando servidor...");
  await server.start();
  console.log("✅ Servidor ONLINE");

  // 🟢 TIEMPO REAL (Socket.io) - Emitir cada 10 segundos
  const activityService = new ActivityService();
  setInterval(async () => {
    try {
      const { onlineNow } = await activityService.getOnlineStats();
      const io = getIO();
      io.emit("onlineUsers:update", { online: onlineNow });
    } catch (error) {
      console.error("Error broadcasting online users:", error);
    }
  }, 10000);
}

main();

// Trigger reload
