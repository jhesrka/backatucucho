"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriceRoutes = void 0;
const express_1 = require("express");
const price_controller_controller_1 = require("./price-controller.controller");
const services_1 = require("../../services");
const middlewares_1 = require("../../../middlewares");
const useradmin_service_1 = require("../../services/administradorService/useradmin.service");
class PriceRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const priceService = new services_1.PriceService();
        const userAdminService = new useradmin_service_1.UseradminService();
        const priceController = new price_controller_controller_1.PriceController(priceService, userAdminService);
        // Obtener configuración actual de precios
        router.get("/", priceController.getPriceSettings);
        // Actualizar precios (admin)
        router.patch("/", middlewares_1.AuthAdminMiddleware.protect, priceController.updatePriceSettings);
        router.patch("/commissions", middlewares_1.AuthAdminMiddleware.protect, priceController.updateCommissionSettings);
        // Calcular precio según días
        router.get("/calculate", priceController.calculateStoriePrice);
        return router;
    }
}
exports.PriceRoutes = PriceRoutes;
