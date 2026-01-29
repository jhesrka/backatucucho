import { Router } from "express";
import { PriceController } from "./price-controller.controller";
import { PriceService } from "../../services";
import { AuthAdminMiddleware, AuthMiddleware } from "../../../middlewares";

import { UseradminService } from "../../services/administradorService/useradmin.service";

export class PriceRoutes {
  static get routes(): Router {
    const router = Router();

    const priceService = new PriceService();
    const userAdminService = new UseradminService();
    const priceController = new PriceController(priceService, userAdminService);



    // Obtener configuración actual de precios
    router.get(
      "/",
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
      priceController.calculateStoriePrice
    );

    return router;
  }
}
