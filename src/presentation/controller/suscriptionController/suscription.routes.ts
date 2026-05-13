import { Router } from "express";
import { FreePostTrackerService, SubscriptionService, GlobalSettingsService } from "../../services";
import { SubscriptionController } from "./suscription.controller";
import { AuthAdminMiddleware, AuthMiddleware } from "../../../middlewares";

export class SubscriptionRoutes {
  static get routes(): Router {
    const router = Router();
    const subscriptionService = new SubscriptionService();
    const freePostTrackerService = new FreePostTrackerService();
    const globalSettingsService = new GlobalSettingsService();
    const subscriptionController = new SubscriptionController(
      subscriptionService,
      freePostTrackerService,
      globalSettingsService
    );

    // ================= USER ROUTES (Protected by AuthMiddleware) =================
    // 🌟 NUEVA RUTA: obtener estado de publicaciones (gratis + suscripción)
    router.get("/status", [AuthMiddleware.protect], subscriptionController.getUserPostStatus);

    // Activar o renovar suscripción
    router.post(
      "/activate-or-renew",
      [AuthMiddleware.protect],
      subscriptionController.activateOrRenewSubscription
    );

    // Verificar si tiene suscripción activa
    router.get("/is-active", [AuthMiddleware.protect], subscriptionController.hasActiveSubscription);

    // ================= ADMIN ROUTES (Protected by AuthAdminMiddleware) =================
    // Cambiar costo de la suscripción (solo admin)
    router.patch("/set-cost", [AuthAdminMiddleware.protect], subscriptionController.setSubscriptionCost);

    // Actualizar configuración de posts gratuitos (solo admin)
    router.patch("/update-free-posts-settings", [AuthAdminMiddleware.protect], subscriptionController.updateFreePostSettings);

    // Obtener configuración de posts gratuitos (solo admin)
    router.get("/get-free-posts-settings", [AuthAdminMiddleware.protect], subscriptionController.getFreePostSettings);

    // Listar suscripciones de un usuario
    router.get("/admin/user/:id/subscriptions", [AuthAdminMiddleware.protect], subscriptionController.getSubscriptionsByUserAdmin);

    // Editar suscripción
    router.put("/admin/:id", [AuthAdminMiddleware.protect], subscriptionController.updateSubscriptionAdmin);

    // Cambiar estado suscripción
    router.put("/admin/status/:id", [AuthAdminMiddleware.protect], subscriptionController.changeSubscriptionStatusAdmin);

    // ================= MASTER PIN OPERATIONS =================
    // Activar suscripción sin cobro (requiere Master PIN)
    router.post("/admin/activate-without-charge", [AuthAdminMiddleware.protect], subscriptionController.activateSubscriptionWithoutCharge);

    // Modificar fecha de expiración (requiere Master PIN)
    router.put("/admin/:id/expiration-date", [AuthAdminMiddleware.protect], subscriptionController.updateSubscriptionExpirationDate);

    // Configurar Master PIN (primera vez, sin PIN actual)
    router.post("/admin/master-pin/set", [AuthAdminMiddleware.protect], subscriptionController.setMasterPin);

    // Cambiar Master PIN (requiere PIN actual)
    router.post("/admin/master-pin/change", [AuthAdminMiddleware.protect], subscriptionController.changeMasterPin);

    // Verificar estado del Master PIN
    router.get("/admin/master-pin/status", [AuthAdminMiddleware.protect], subscriptionController.getMasterPinStatus);

    // Verificar Master PIN (solo verificación)
    router.post("/admin/master-pin/verify", [AuthAdminMiddleware.protect], subscriptionController.verifyMasterPin);

    return router;
  }
}
