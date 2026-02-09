"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RechargeRoutes = void 0;
const express_1 = require("express");
const services_1 = require("../services");
const middlewares_1 = require("../../middlewares");
const recharge_request_controller_1 = require("./recharge-request.controller");
const config_1 = require("../../config");
class RechargeRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const emailService = new services_1.EmailService(config_1.envs.MAILER_SERVICE, config_1.envs.MAILER_EMAIL, config_1.envs.MAILER_SECRET_KEY, config_1.envs.SEND_EMAIL);
        const userService = new services_1.UserService(emailService);
        const rechargeService = new services_1.RechargeRequestService(userService);
        const rechargeRequestController = new recharge_request_controller_1.RechargeRequestController(rechargeService);
        //USUARIO
        // SCAN COMPROBANTE
        router.post("/scan", middlewares_1.AuthMiddleware.protect, (0, config_1.uploadSingleFile)("receipt_image"), rechargeRequestController.scanReceipt);
        //CREAR RECARGA
        router.post("/", middlewares_1.AuthMiddleware.protect, (0, config_1.uploadSingleFile)("receipt_image"), rechargeRequestController.createRecharge);
        // OBTENER RECARGAS POR PAGINACION 3
        router.get("/user/:userId", middlewares_1.AuthMiddleware.protect, rechargeRequestController.getRechargeRequestsByUser);
        // FILTRAR POR ESTADO
        router.get("/filter/status/:status", middlewares_1.AuthMiddleware.protect, rechargeRequestController.filterByStatus);
        // FILTRAR POR RANGO DE FECHAS (solo admin)
        // Query params: startDate, endDate
        // routes/recharge.js
        router.get("/user/:userId/filter/date-range", middlewares_1.AuthMiddleware.protect, rechargeRequestController.filterByDateRange);
        //ACTUALIZAR ES EL ESTADO Y LOS DATOS PARA LA RECARGA
        router.patch("/:id/status", middlewares_1.AuthAdminMiddleware.protect, rechargeRequestController.updateStatus);
        //ADMINISTRADOR
        //1 Obtener todas las recargas paginadas (solo admin)
        router.get("/all/paginated", middlewares_1.AuthAdminMiddleware.protect, rechargeRequestController.getAllRequestsPaginated);
        //2 Búsqueda por término (solo admin o usuario protegido)
        router.get("/search", middlewares_1.AuthAdminMiddleware.protect, rechargeRequestController.searchRechargeRequests);
        //3
        router.get("/all", middlewares_1.AuthAdminMiddleware.protect, rechargeRequestController.getAllRechargeRequests);
        //4
        router.get("/filter/date-range", middlewares_1.AuthAdminMiddleware.protect, rechargeRequestController.filterByDateRangePaginated);
        //5
        router.patch("/update-status/:id", middlewares_1.AuthAdminMiddleware.protect, rechargeRequestController.updateStatus);
        //6
        router.get("/export/csv", middlewares_1.AuthAdminMiddleware.protect, rechargeRequestController.exportToCSVByDate);
        //7
        // recharge.routes.ts
        router.get("/filter/status/admin/:status", middlewares_1.AuthAdminMiddleware.protect, rechargeRequestController.filterByStatusAdmin);
        // 8. Eliminar solicitudes de recarga viejas (más de 2 días por ahora)
        router.delete("/delete-old", middlewares_1.AuthAdminMiddleware.protect, rechargeRequestController.deleteOldRechargeRequests);
        // 9. Reversar recarga aprobada
        router.patch("/admin/:id/reverse", middlewares_1.AuthAdminMiddleware.protect, rechargeRequestController.reverseRecharge);
        // 10. Configurar Purga
        router.post("/configure-purge", middlewares_1.AuthAdminMiddleware.protect, rechargeRequestController.configurePurge);
        return router;
    }
}
exports.RechargeRoutes = RechargeRoutes;
