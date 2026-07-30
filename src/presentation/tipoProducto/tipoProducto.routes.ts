// src/routes/tipoProducto.routes.ts
import { Router } from "express";

import { AuthMiddleware } from "../../middlewares/auth.middleware";
import { AuthAdminMiddleware } from "../../middlewares/auth-admin.middleware";
import { TipoProductoService } from "../services/tipoProducto.service";
import { TipoProductoController } from "./tipoProducto.controller";

export class TipoProductoRoutes {
  static get routes(): Router {
    const router = Router();

    const tipoProductoService = new TipoProductoService();
    const tipoProductoController = new TipoProductoController(tipoProductoService);

    // Crear tipo producto (usuario autenticado)
    router.post(
      "/",
      AuthMiddleware.protect,
      tipoProductoController.createTipoProducto
    );

    // Obtener todos los tipos de producto (usuario autenticado)
        router.get(
      "/negocio/:negocioId",
      AuthMiddleware.protect,
      tipoProductoController.getTiposByNegocio
    );

    // Obtener todos los tipos de producto (admin)
    router.get(
      "/admin/negocio/:negocioId",
      AuthAdminMiddleware.protect,
      tipoProductoController.getTiposByNegocio
    );

    // Editar tipo de producto (admin)
    router.put(
      "/admin/:id",
      AuthAdminMiddleware.protect,
      tipoProductoController.updateTipoProducto
    );

    // Eliminar tipo producto por id (admin)
    router.delete(
      "/admin/:id",
      AuthAdminMiddleware.protect,
      tipoProductoController.deleteTipoProducto
    );

    // Eliminar tipo producto por id (usuario autenticado, podría restringirse a admin)
    router.delete(
      "/:id",
      AuthMiddleware.protect,
      tipoProductoController.deleteTipoProducto
    );

    // Reordenar categorías (usuario autenticado)
    router.put(
      "/reordenar",
      AuthMiddleware.protect,
      tipoProductoController.reordenarTipos
    );

    return router;
  }
}
