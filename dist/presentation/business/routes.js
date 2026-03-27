"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessRoutes = void 0;
const express_1 = require("express");
const controller_1 = require("./controller");
const business_service_1 = require("../services/business.service");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const config_1 = require("../../config");
class BusinessRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const service = new business_service_1.BusinessService();
        const controller = new controller_1.BusinessController(service);
        router.post("/login", controller.login);
        // Rutas protegidas
        router.get("/my-businesses", [auth_middleware_1.AuthMiddleware.protect], controller.getMyBusinesses);
        router.patch("/:businessId/settings", [auth_middleware_1.AuthMiddleware.protect], controller.updateSettings);
        // Gestión de Pedidos
        router.get("/:businessId/orders", [auth_middleware_1.AuthMiddleware.protect], controller.getOrders);
        router.patch("/:businessId/orders/:orderId/status", [auth_middleware_1.AuthMiddleware.protect], controller.updateOrderStatus);
        router.post("/:businessId/orders/:orderId/verify-pickup", [auth_middleware_1.AuthMiddleware.protect], controller.verifyPickupCode);
        router.patch("/:businessId/orders/:orderId/confirm-transfer-cancellation", [auth_middleware_1.AuthMiddleware.protect], controller.confirmTransferCancellation);
        // Reportes Financieros
        router.get("/:businessId/finance", [auth_middleware_1.AuthMiddleware.protect], controller.getFinance);
        router.get("/:businessId/unclosed-days", [auth_middleware_1.AuthMiddleware.protect], controller.getUnclosedDays);
        router.post("/:businessId/finance/payment", [auth_middleware_1.AuthMiddleware.protect, (0, config_1.uploadSingleFile)('file')], controller.registerPayment);
        router.post("/:businessId/finance/close-day", [auth_middleware_1.AuthMiddleware.protect], controller.closeDay);
        return router;
    }
}
exports.BusinessRoutes = BusinessRoutes;
