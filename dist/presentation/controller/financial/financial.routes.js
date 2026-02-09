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
        router.post('/summary', controller.getSummary);
        router.post('/shops', controller.getShopReconciliation);
        router.post('/drivers', controller.getDriverReconciliation);
        router.post('/shop-details', controller.getShopDetails);
        // Daily Closing
        router.post('/upload-statement', [middlewares_1.AuthAdminMiddleware.protect, (0, config_1.uploadSingleFile)('file')], controller.uploadBankStatement);
        router.get('/day-status', middlewares_1.AuthAdminMiddleware.protect, controller.getDayStatus);
        router.post('/close-day', middlewares_1.AuthAdminMiddleware.protect, controller.closeDay);
        // Detailed Revenue (Auditable)
        router.get('/revenue-details', middlewares_1.AuthAdminMiddleware.protect, controller.getAppRevenueDetails);
        return router;
    }
}
exports.FinancialRoutes = FinancialRoutes;
