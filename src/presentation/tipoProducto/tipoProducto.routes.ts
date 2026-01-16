// src/routes/tipoProducto.routes.ts
import { Router } from "express";

import { AuthMiddleware } from "../../middlewares/auth.middleware";
import { TipoProductoService } from "../services/tipoProducto.service";
import { TipoProductoController } from "./tipoProducto.controller";
// Si quieres un middleware admin, podrías importarlo también y usarlo en rutas sensibles

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

    // Eliminar tipo producto por id (usuario autenticado, podría restringirse a admin)
    router.delete(
      "/:id",
      AuthMiddleware.protect,
      tipoProductoController.deleteTipoProducto
    );

    return router;
  }
}
