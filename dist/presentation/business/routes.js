"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessRoutes = void 0;
const express_1 = require("express");
const controller_1 = require("./controller");
const business_service_1 = require("../services/business.service");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
class BusinessRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const service = new business_service_1.BusinessService();
        const controller = new controller_1.BusinessController(service);
        router.post("/login", controller.login);
        // Rutas protegidas
        router.get("/my-businesses", [auth_middleware_1.AuthMiddleware.protect], controller.getMyBusinesses);
        // Gestión de Pedidos
        router.get("/:businessId/orders", [auth_middleware_1.AuthMiddleware.protect], controller.getOrders);
        router.patch("/:businessId/orders/:orderId/status", [auth_middleware_1.AuthMiddleware.protect], controller.updateOrderStatus);
        // Reportes Financieros
        router.get("/:businessId/finance", [auth_middleware_1.AuthMiddleware.protect], controller.getFinance);
        router.post("/:businessId/finance/payment", [auth_middleware_1.AuthMiddleware.protect], controller.registerPayment);
        return router;
    }
}
exports.BusinessRoutes = BusinessRoutes;
