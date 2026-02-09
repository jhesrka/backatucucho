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
exports.startOrderPurgeCron = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const pedidoAdmin_service_1 = require("../presentation/services/pedidosServices/pedidoAdmin.service");
/**
 * Automáticamente purga los pedidos antiguos del sistema.
 * Se ejecuta una vez al día a las 03:00 AM.
 * Lee la configuración de días de retención desde la base de datos (GlobalSettings).
 */
const startOrderPurgeCron = () => {
    // Ejecutar todos los días a las 3:00 AM
    node_cron_1.default.schedule("0 3 * * *", () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("[CRON] Iniciando purga automática de pedidos...");
        try {
            const service = new pedidoAdmin_service_1.PedidoAdminService();
            const { deletedCount } = yield service.purgeOldOrders();
            console.log(`[CRON] Purga completada. Pedidos eliminados: ${deletedCount}`);
        }
        catch (error) {
            console.error("[CRON] Error durante la purga de pedidos:", error);
        }
    }));
    console.log("[CRON] Sistema de purga automática de pedidos inicializado (3 AM daily)");
};
exports.startOrderPurgeCron = startOrderPurgeCron;
