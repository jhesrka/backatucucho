"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvertisingRoutes = void 0;
const express_1 = require("express");
const advertising_controller_1 = require("./advertising.controller");
const advertising_service_1 = require("../services/advertising.service");
const email_service_1 = require("../services/email.service");
const config_1 = require("../../config");
const middlewares_1 = require("../../middlewares");
class AdvertisingRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const emailService = new email_service_1.EmailService(config_1.envs.MAILER_SERVICE, config_1.envs.MAILER_EMAIL, config_1.envs.MAILER_SECRET_KEY, config_1.envs.SEND_EMAIL);
        const advertisingService = new advertising_service_1.AdvertisingService(emailService);
        const controller = new advertising_controller_1.AdvertisingController(advertisingService);
        router.use(middlewares_1.AuthAdminMiddleware.protect); // All routes protected
        router.get("/campaigns", controller.getCampaigns);
        router.post("/campaigns", controller.createCampaign);
        router.delete("/campaigns/:id", controller.deleteCampaign);
        router.get("/campaigns/:id/targets", controller.getCampaignTargets);
        router.post("/message/:logId", controller.sendOneMessage); // Manual trigger
        router.post("/estimate", controller.estimateRecipients);
        return router;
    }
}
exports.AdvertisingRoutes = AdvertisingRoutes;
