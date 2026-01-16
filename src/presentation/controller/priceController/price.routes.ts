import { Router } from "express";
import { PriceController } from "./price-controller.controller";
import { PriceService } from "../../services";
import { AuthAdminMiddleware, AuthMiddleware } from "../../../middlewares";

export class PriceRoutes {
  static get routes(): Router {
    const router = Router();

    const priceService = new PriceService();
    const priceController = new PriceController(priceService);

  

    // Obtener configuración actual de precios
    router.get(
      "/",
      AuthMiddleware.protect,
      priceController.getPriceSettings
    );

    // Actualizar precios (admin)
    router.patch(
      "/",
      AuthAdminMiddleware.protect,
      priceController.updatePriceSettings
    );

    // Calcular precio según días
    router.get(
      "/calculate",
      AuthMiddleware.protect,
      priceController.calculateStoriePrice
    );

    return router;
  }
}
