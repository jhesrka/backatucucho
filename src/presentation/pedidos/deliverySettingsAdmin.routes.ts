// src/presentation/routes/admin/delivery-settings.routes.ts
import { Router } from "express";
import { DeliverySettingsAdminService } from "../services/pedidosServices/deliverySettingsAdmin.service";
import { DeliverySettingsController } from "./deliverySettings.controller";
import { AuthAdminMiddleware, AuthMiddleware } from "../../middlewares";


export class DeliverySettingsAdminRoutes {
  static get routes(): Router {
    const router = Router();

    const service = new DeliverySettingsAdminService();
    const controller = new DeliverySettingsController(service);

    // Obtener configuración activa (GET /api/admin/delivery-settings)
    router.get(
      "/",
      AuthAdminMiddleware.protect,
      controller.getActive
    );

    // Crear nueva configuración activa (POST /api/admin/delivery-settings)
    router.post(
      "/",
      AuthAdminMiddleware.protect,
      controller.create
    );

    // Actualizar configuración por id (PATCH /api/admin/delivery-settings/:id)
    router.patch(
      "/:id",
      AuthAdminMiddleware.protect,
      controller.update
    );

    return router;
  }
}
