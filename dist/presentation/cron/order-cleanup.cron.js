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
exports.startOrderCleanupCron = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const pedidoAdmin_service_1 = require("../services/pedidosServices/pedidoAdmin.service");
// Ejecutar todos los días a las 04:00 AM
const startOrderCleanupCron = () => {
    node_cron_1.default.schedule("0 4 * * *", () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("[CRON] Iniciando purga de pedidos antiguos...");
        try {
            const pedidoAdminService = new pedidoAdmin_service_1.PedidoAdminService();
            const result = yield pedidoAdminService.purgeOldOrders();
            console.log(`[CRON] Purga finalizada. Eliminados: ${result.deletedCount} pedidos.`);
        }
        catch (error) {
            console.error("[CRON] Error en purga de pedidos:", error);
        }
    }));
};
exports.startOrderCleanupCron = startOrderCleanupCron;
