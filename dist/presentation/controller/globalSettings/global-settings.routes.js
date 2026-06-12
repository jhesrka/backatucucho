"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalSettingsRoutes = void 0;
const express_1 = require("express"); // Force recompile
const global_settings_controller_1 = require("./global-settings.controller");
const global_settings_service_1 = require("../../services/globalSettings/global-settings.service");
const middlewares_1 = require("../../../middlewares");
const upload_files_adapter_1 = require("../../../config/upload-files.adapter");
class GlobalSettingsRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const service = new global_settings_service_1.GlobalSettingsService();
        const controller = new global_settings_controller_1.GlobalSettingsController(service);
        router.get("/", controller.getSettings);
        router.patch("/", [middlewares_1.AuthAdminMiddleware.protect, (0, upload_files_adapter_1.uploadSingleFile)("coverImage")], controller.updateSettings);
        router.patch("/logo", [middlewares_1.AuthAdminMiddleware.protect, (0, upload_files_adapter_1.uploadSingleFile)("logoImage")], controller.updateLogo);
        router.patch("/favicon", [middlewares_1.AuthAdminMiddleware.protect, (0, upload_files_adapter_1.uploadSingleFile)("faviconImage")], controller.updateFavicon);
        router.get("/manifest.json", controller.getManifest);
        // Control Manual de la App
        router.put("/app/cerrar", middlewares_1.AuthAdminMiddleware.protect, controller.closeApp);
        router.put("/app/activar-auto", middlewares_1.AuthAdminMiddleware.protect, controller.enableAuto);
        return router;
    }
}
exports.GlobalSettingsRoutes = GlobalSettingsRoutes;
