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
exports.startSubscriptionCron = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const subscription_service_1 = require("../presentation/services/subscription.service");
const startSubscriptionCron = () => {
    // Ejecutar todos los días a las 2:00 AM
    node_cron_1.default.schedule("0 2 * * *", () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("➡️ [CRON] INICIANDO COBRO DE SUSCRIPCIONES:", new Date().toLocaleString());
        const subscriptionService = new subscription_service_1.SubscriptionService();
        try {
            const results = yield subscriptionService.processDailySubscriptions();
            console.log("✅ [CRON] SUSCRIPCIONES PROCESADAS:", results);
        }
        catch (error) {
            console.error("❌ [CRON] ERROR EN SUBSCRIPTION CRON:", error);
        }
    }));
    // Nota: Para pruebas iniciales se podría agregar un cron más frecuente,
    // pero para producción 2 AM es ideal.
};
exports.startSubscriptionCron = startSubscriptionCron;
