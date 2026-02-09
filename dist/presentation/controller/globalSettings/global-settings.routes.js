"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalSettingsRoutes = void 0;
const express_1 = require("express");
const global_settings_controller_1 = require("./global-settings.controller");
const global_settings_service_1 = require("../../services/globalSettings/global-settings.service");
const middlewares_1 = require("../../../middlewares");
class GlobalSettingsRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const service = new global_settings_service_1.GlobalSettingsService();
        const controller = new global_settings_controller_1.GlobalSettingsController(service);
        router.get("/", controller.getSettings);
        router.patch("/", middlewares_1.AuthAdminMiddleware.protect, controller.updateSettings);
        return router;
    }
}
exports.GlobalSettingsRoutes = GlobalSettingsRoutes;
