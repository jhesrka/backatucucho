"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionRoutes = void 0;
const express_1 = require("express");
const services_1 = require("../../services");
const suscription_controller_1 = require("./suscription.controller");
const middlewares_1 = require("../../../middlewares");
class SubscriptionRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const subscriptionService = new services_1.SubscriptionService();
        const freePostTrackerService = new services_1.FreePostTrackerService();
        const globalSettingsService = new services_1.GlobalSettingsService();
        const subscriptionController = new suscription_controller_1.SubscriptionController(subscriptionService, freePostTrackerService, globalSettingsService);
        // ================= USER ROUTES (Protected by AuthMiddleware) =================
        // 🌟 NUEVA RUTA: obtener estado de publicaciones (gratis + suscripción)
        router.get("/status", [middlewares_1.AuthMiddleware.protect], subscriptionController.getUserPostStatus);
        // Activar o renovar suscripción
        router.post("/activate-or-renew", [middlewares_1.AuthMiddleware.protect], subscriptionController.activateOrRenewSubscription);
        // Verificar si tiene suscripción activa
        router.get("/is-active", [middlewares_1.AuthMiddleware.protect], subscriptionController.hasActiveSubscription);
        // ================= ADMIN ROUTES (Protected by AuthAdminMiddleware) =================
        // Cambiar costo de la suscripción (solo admin)
        router.patch("/set-cost", [middlewares_1.AuthAdminMiddleware.protect], subscriptionController.setSubscriptionCost);
        // Actualizar configuración de posts gratuitos (solo admin)
        router.patch("/update-free-posts-settings", [middlewares_1.AuthAdminMiddleware.protect], subscriptionController.updateFreePostSettings);
        // Obtener configuración de posts gratuitos (solo admin)
        router.get("/get-free-posts-settings", [middlewares_1.AuthAdminMiddleware.protect], subscriptionController.getFreePostSettings);
        // Listar suscripciones de un usuario
        router.get("/admin/user/:id/subscriptions", [middlewares_1.AuthAdminMiddleware.protect], subscriptionController.getSubscriptionsByUserAdmin);
        // Editar suscripción
        router.put("/admin/:id", [middlewares_1.AuthAdminMiddleware.protect], subscriptionController.updateSubscriptionAdmin);
        // Cambiar estado suscripción
        router.put("/admin/status/:id", [middlewares_1.AuthAdminMiddleware.protect], subscriptionController.changeSubscriptionStatusAdmin);
        // ================= MASTER PIN OPERATIONS =================
        // Activar suscripción sin cobro (requiere Master PIN)
        router.post("/admin/activate-without-charge", [middlewares_1.AuthAdminMiddleware.protect], subscriptionController.activateSubscriptionWithoutCharge);
        // Modificar fecha de expiración (requiere Master PIN)
        router.put("/admin/:id/expiration-date", [middlewares_1.AuthAdminMiddleware.protect], subscriptionController.updateSubscriptionExpirationDate);
        // Configurar Master PIN (primera vez, sin PIN actual)
        router.post("/admin/master-pin/set", [middlewares_1.AuthAdminMiddleware.protect], subscriptionController.setMasterPin);
        // Cambiar Master PIN (requiere PIN actual)
        router.post("/admin/master-pin/change", [middlewares_1.AuthAdminMiddleware.protect], subscriptionController.changeMasterPin);
        // Verificar estado del Master PIN
        router.get("/admin/master-pin/status", [middlewares_1.AuthAdminMiddleware.protect], subscriptionController.getMasterPinStatus);
        return router;
    }
}
exports.SubscriptionRoutes = SubscriptionRoutes;
