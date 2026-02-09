"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliverySettingsAdminRoutes = void 0;
// src/presentation/routes/admin/delivery-settings.routes.ts
const express_1 = require("express");
const deliverySettingsAdmin_service_1 = require("../services/pedidosServices/deliverySettingsAdmin.service");
const deliverySettings_controller_1 = require("./deliverySettings.controller");
const middlewares_1 = require("../../middlewares");
class DeliverySettingsAdminRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const service = new deliverySettingsAdmin_service_1.DeliverySettingsAdminService();
        const controller = new deliverySettings_controller_1.DeliverySettingsController(service);
        // Obtener configuración activa (GET /api/admin/delivery-settings)
        router.get("/", middlewares_1.AuthAdminMiddleware.protect, controller.getActive);
        // Crear nueva configuración activa (POST /api/admin/delivery-settings)
        router.post("/", middlewares_1.AuthAdminMiddleware.protect, controller.create);
        // Actualizar configuración por id (PATCH /api/admin/delivery-settings/:id)
        router.patch("/:id", middlewares_1.AuthAdminMiddleware.protect, controller.update);
        return router;
    }
}
exports.DeliverySettingsAdminRoutes = DeliverySettingsAdminRoutes;
