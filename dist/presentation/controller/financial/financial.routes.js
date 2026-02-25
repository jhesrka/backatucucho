"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinancialRoutes = void 0;
const express_1 = require("express");
const financial_controller_1 = require("./financial.controller");
const financial_service_1 = require("../../services/financial/financial.service");
const middlewares_1 = require("../../../middlewares");
const config_1 = require("../../../config");
class FinancialRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const service = new financial_service_1.FinancialService();
        const controller = new financial_controller_1.FinancialController(service);
        // Using POST for date ranges in body to avoid query string complexity, though GET with query params is standard.
        // User requested structure is implied to be simple.
        router.post('/summary', [middlewares_1.AuthAdminMiddleware.protect], controller.getSummary);
        router.post('/shops', [middlewares_1.AuthAdminMiddleware.protect], controller.getShopReconciliation);
        router.post('/drivers', [middlewares_1.AuthAdminMiddleware.protect], controller.getDriverReconciliation);
        router.post('/shop-details', [middlewares_1.AuthAdminMiddleware.protect], controller.getShopClosingDetails);
        router.post('/close-shop-day', [middlewares_1.AuthAdminMiddleware.protect], controller.closeShopDay);
        router.post('/upload-shop-receipt', [middlewares_1.AuthAdminMiddleware.protect, (0, config_1.uploadSingleFile)('file')], controller.uploadShopReceipt);
        // New Route
        router.get('/movimientos-motorizados', [middlewares_1.AuthAdminMiddleware.protect], controller.getMovimientosMotorizados);
        // Daily Closing
        router.post('/upload-statement', [middlewares_1.AuthAdminMiddleware.protect, (0, config_1.uploadSingleFile)('file')], controller.uploadBankStatement);
        router.get('/day-status', middlewares_1.AuthAdminMiddleware.protect, controller.getDayStatus);
        router.post('/close-day', middlewares_1.AuthAdminMiddleware.protect, controller.closeDay);
        // Internal Pending Closings
        router.get('/pending-closings', middlewares_1.AuthAdminMiddleware.protect, controller.getPendingShopClosings);
        // Detailed Revenue (Auditable)
        router.get('/revenue-details', middlewares_1.AuthAdminMiddleware.protect, controller.getAppRevenueDetails);
        return router;
    }
}
exports.FinancialRoutes = FinancialRoutes;
