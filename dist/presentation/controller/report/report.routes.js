"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportRoutes = void 0;
const express_1 = require("express");
const report_controller_1 = require("./report.controller");
const report_service_1 = require("../../services/report/report.service");
const middlewares_1 = require("../../../middlewares");
class ReportRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const service = new report_service_1.ReportService();
        const controller = new report_controller_1.ReportController(service);
        router.post("/", middlewares_1.AuthMiddleware.protect, controller.createReport);
        // Admin routes
        router.get("/", middlewares_1.AuthAdminMiddleware.protect, controller.getAllReports);
        router.patch("/:id", middlewares_1.AuthAdminMiddleware.protect, controller.updateStatus);
        return router;
    }
}
exports.ReportRoutes = ReportRoutes;
