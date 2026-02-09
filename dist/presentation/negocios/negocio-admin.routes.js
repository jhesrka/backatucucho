"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NegocioAdminRoutes = void 0;
const express_1 = require("express");
const auth_admin_middleware_1 = require("../../middlewares/auth-admin.middleware");
const config_1 = require("../../config");
const negocioAdmin_service_1 = require("../services/negocioAdmin.service");
const negocio_admin_controller_1 = require("./negocio.admin.controller");
const subscription_service_1 = require("../services/subscription.service");
class NegocioAdminRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const subscriptionService = new subscription_service_1.SubscriptionService();
        const service = new negocioAdmin_service_1.NegocioAdminService(subscriptionService);
        const controller = new negocio_admin_controller_1.NegocioAdminController(service, subscriptionService);
        // Crear negocio (admin)
        router.post("/", auth_admin_middleware_1.AuthAdminMiddleware.protect, (0, config_1.uploadSingleFile)("imagenNegocio"), controller.createNegocioAdmin);
        // Obtener negocios con filtros (paginados)
        router.get("/", auth_admin_middleware_1.AuthAdminMiddleware.protect, controller.getNegociosAdmin);
        // Exportar negocios a CSV
        router.get("/export", auth_admin_middleware_1.AuthAdminMiddleware.protect, controller.exportNegociosToCSV);
        // ===================== NUEVO: ESTADÍSTICAS ADMIN =====================
        router.get("/stats", auth_admin_middleware_1.AuthAdminMiddleware.protect, controller.getNegociosStatsAdmin);
        // ========================= ACTUALIZAR NEGOCIO =========================
        router.patch("/:id", auth_admin_middleware_1.AuthAdminMiddleware.protect, controller.updateNegocioAdmin);
        // ===================== CAMBIAR ESTADO =====================
        // 🔄 Alternar entre ABIERTO / CERRADO (solo el dueño del negocio o admin)
        router.patch("/:id/toggle-estado", auth_admin_middleware_1.AuthAdminMiddleware.protect, // o AuthAdminMiddleware si quieres solo admin
        controller.toggleEstadoNegocioAdmin);
        // Eliminar definitivamente
        router.delete("/:id", auth_admin_middleware_1.AuthAdminMiddleware.protect, controller.deleteNegocioAdmin);
        // NUEVO: Admin Purge Individual
        router.delete("/purge/:id", auth_admin_middleware_1.AuthAdminMiddleware.protect, controller.purgeNegocioAdmin);
        // NUEVO: Admin Change Status
        router.put("/status/:id", auth_admin_middleware_1.AuthAdminMiddleware.protect, controller.changeStatusNegocioAdmin);
        // NUEVO: Admin - Get All Businesses of User
        router.get("/user/:id/negocios", auth_admin_middleware_1.AuthAdminMiddleware.protect, controller.getNegociosByUserAdmin);
        // NUEVO: Admin - Forzar cobro de suscripción
        router.post("/:id/force-subscription", auth_admin_middleware_1.AuthAdminMiddleware.protect, controller.forceChargeSubscription);
        return router;
    }
}
exports.NegocioAdminRoutes = NegocioAdminRoutes;
