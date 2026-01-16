import { Router } from "express";
import { FreePostTrackerService, SubscriptionService } from "../../services";
import { SubscriptionController } from "./suscription.controller";
import { AuthAdminMiddleware, AuthMiddleware } from "../../../middlewares";

export class SubscriptionRoutes {
  static get routes(): Router {
    const router = Router();
    const subscriptionService = new SubscriptionService();
    const freePostTrackerService = new FreePostTrackerService();
    const subscriptionController = new SubscriptionController(
      subscriptionService,
      freePostTrackerService
    );

    // Todas las rutas protegidas
    router.use(AuthMiddleware.protect);
    // 🌟 NUEVA RUTA: obtener estado de publicaciones (gratis + suscripción)
    router.get("/status", subscriptionController.getUserPostStatus);

    // Activar o renovar suscripción
    router.post(
      "/activate-or-renew",
      subscriptionController.activateOrRenewSubscription
    );

    // Verificar si tiene suscripción activa
    router.get("/is-active", subscriptionController.hasActiveSubscription);

    // Cambiar costo de la suscripción (solo admin)
    router.patch("/set-cost", subscriptionController.setSubscriptionCost);

    return router;
  }
}
