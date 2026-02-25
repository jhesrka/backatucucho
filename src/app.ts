process.env.TZ = 'UTC'; // Forzar Node.js a operar siempre en UTC
import "reflect-metadata"; // esto si bien instalamos depues siempre debe ir primero
import { envs } from "./config";
import { PostgresDatabase } from "./data";
import { AppRoutes } from "./presentation/routes";
import { Server } from "./presentation/server";
import "dotenv/config";
import { startPedidoMotoCron } from "./cron/pedidoMoto.cron";
import { startSubscriptionCron } from "./cron/subscription.cron";
import { startPostExpirationCron } from "./cron/post-expiration.cron";
import { startOrderPurgeCron } from "./cron/pedidoPurge.cron";
import { startReportPurgeCron } from "./cron/report-purge.cron";
import { startGlobalScheduleCron } from "./cron/global-schedule.cron";
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
  startPedidoMotoCron();
  startSubscriptionCron();
  startPostExpirationCron();
  startOrderPurgeCron();
  startOrderPurgeCron();
  startReportPurgeCron();
  startGlobalScheduleCron();

  await server.start();
}

main();
