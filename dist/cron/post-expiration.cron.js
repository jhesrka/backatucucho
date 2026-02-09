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
exports.startPostExpirationCron = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const post_service_1 = require("../presentation/services/post.service");
const user_service_1 = require("../presentation/services/usuario/user.service");
const email_service_1 = require("../presentation/services/email.service");
const config_1 = require("../config");
const services_1 = require("../presentation/services");
const startPostExpirationCron = () => {
    // Ejecutar cada hora
    node_cron_1.default.schedule("0 * * * *", () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("[CRON] Verificando expiración de posts gratuitos...");
        try {
            const emailService = new email_service_1.EmailService(config_1.envs.MAILER_SERVICE, config_1.envs.MAILER_EMAIL, config_1.envs.MAILER_SECRET_KEY, config_1.envs.SEND_EMAIL);
            const userService = new user_service_1.UserService(emailService);
            const subscriptionService = new services_1.SubscriptionService();
            const freePostTrackerService = new services_1.FreePostTrackerService();
            const globalSettingsService = new services_1.GlobalSettingsService();
            const postService = new post_service_1.PostService(userService, subscriptionService, freePostTrackerService, globalSettingsService);
            const count = yield postService.expirePosts();
            if (count > 0) {
                console.log(`[CRON] Se han expirado ${count} posts.`);
            }
        }
        catch (error) {
            console.error("[CRON] Error en expiración de posts:", error);
        }
    }));
};
exports.startPostExpirationCron = startPostExpirationCron;
