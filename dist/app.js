"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dns_1 = __importDefault(require("dns"));
dns_1.default.setDefaultResultOrder("ipv4first");
process.env.TZ = "America/Guayaquil"; // Forzar Node.js a operar siempre en la zona horaria de Ecuador
require("reflect-metadata"); // esto si bien instalamos depues siempre debe ir primero
const config_1 = require("./config");
const data_1 = require("./data");
const routes_1 = require("./presentation/routes");
const server_1 = require("./presentation/server");
require("dotenv/config");
const pedidoMoto_cron_1 = require("./cron/pedidoMoto.cron");
const subscription_cron_1 = require("./cron/subscription.cron");
const post_expiration_cron_1 = require("./cron/post-expiration.cron");
const pedidoPurge_cron_1 = require("./cron/pedidoPurge.cron");
const report_purge_cron_1 = require("./cron/report-purge.cron");
const global_schedule_cron_1 = require("./cron/global-schedule.cron");
const storie_expiration_cron_1 = require("./cron/storie-expiration.cron");
const pedidoAcceptanceExpiration_cron_1 = require("./cron/pedidoAcceptanceExpiration.cron");
const subscription_cleanup_cron_1 = require("./cron/subscription-cleanup.cron");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const postgres = new data_1.PostgresDatabase({
            username: config_1.envs.DB_USERNAME,
            password: config_1.envs.DB_PASSWORD,
            host: config_1.envs.DB_HOST,
            database: config_1.envs.DB_DATABASE,
            port: config_1.envs.DB_PORT,
        });
        yield postgres.connect();
        const server = new server_1.Server({
            port: config_1.envs.PORT,
            routes: routes_1.AppRoutes.routes, //este viene de un metodo estatico por es no ponemos new
        });
        // 👇 INICIAR CRONES
        (0, pedidoMoto_cron_1.startPedidoMotoCron)();
        (0, subscription_cron_1.startSubscriptionCron)();
        (0, post_expiration_cron_1.startPostExpirationCron)();
        (0, pedidoPurge_cron_1.startOrderPurgeCron)();
        (0, report_purge_cron_1.startReportPurgeCron)();
        (0, global_schedule_cron_1.startGlobalScheduleCron)();
        (0, storie_expiration_cron_1.startStorieExpirationCron)();
        (0, pedidoAcceptanceExpiration_cron_1.startPedidoExpirationCron)();
        (0, subscription_cleanup_cron_1.startSubscriptionCleanupCron)();
        yield server.start();
    });
}
main();
