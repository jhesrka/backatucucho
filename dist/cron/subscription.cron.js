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
const cron_lock_1 = require("../utils/cron-lock");
const node_cron_1 = __importDefault(require("node-cron"));
const subscription_service_1 = require("../presentation/services/subscription.service");
const subscription_service_2 = require("../presentation/services/postService/subscription.service");
const startSubscriptionCron = () => {
    // Ejecutar todos los días a las 2:00 AM
    node_cron_1.default.schedule("0 2 * * *", () => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, cron_lock_1.withRedisLock)("subscription", 55, () => __awaiter(void 0, void 0, void 0, function* () {
            console.log("➡️ [CRON] INICIANDO PROCESAMIENTO DE SUSCRIPCIONES:", new Date().toLocaleString());
            const businessService = new subscription_service_1.SubscriptionService();
            const userService = new subscription_service_2.SubscriptionService();
            try {
                // 1. Procesar suscripciones de Negocios
                const businessResults = yield businessService.processDailySubscriptions();
                console.log("✅ [CRON] NEGOCIOS PROCESADOS:", businessResults);
                // 2. Procesar suscripciones de Usuarios (BASIC)
                const userResults = yield userService.processUserAutoRenewals();
                console.log("✅ [CRON] USUARIOS PROCESADOS:", userResults);
            }
            catch (error) {
                console.error("❌ [CRON] ERROR CRÍTICO EN SUBSCRIPTION CRON:", error);
            }
        }));
    }), { timezone: "America/Guayaquil" });
    console.log("[CRON] Sistema de renovación automática (Negocios y Usuarios) inicializado (2:00 AM daily)");
};
exports.startSubscriptionCron = startSubscriptionCron;
