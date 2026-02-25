import { Router } from "express";
import { GlobalSettingsController } from "./global-settings.controller";
import { GlobalSettingsService } from "../../services/globalSettings/global-settings.service";
import { AuthAdminMiddleware } from "../../../middlewares";

export class GlobalSettingsRoutes {
    static get routes(): Router {
        const router = Router();
        const service = new GlobalSettingsService();
        const controller = new GlobalSettingsController(service);

        router.get("/", controller.getSettings);
        router.patch("/", AuthAdminMiddleware.protect, controller.updateSettings);

        // Control Manual de la App
        router.put("/app/cerrar", AuthAdminMiddleware.protect, controller.closeApp);
        router.put("/app/activar-auto", AuthAdminMiddleware.protect, controller.enableAuto);

        return router;
    }
}
