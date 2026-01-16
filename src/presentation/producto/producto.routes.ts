import { Router } from "express";
import { ProductoService } from "../services/producto.service";
import { ProductoController } from "./producto.controller";
import { AuthMiddleware } from "../../middlewares/auth.middleware";
import { AuthAdminMiddleware } from "../../middlewares/auth-admin.middleware";
import { uploadSingleFile } from "../../config";

export class ProductoRoutes {
  static get routes(): Router {
    const router = Router();

    const productoService = new ProductoService();
    const productoController = new ProductoController(productoService);

    // Crear producto (usuario autenticado)
    router.post(
      "/",
      AuthMiddleware.protect,
      uploadSingleFile("imagen"),
      productoController.createProducto
    );

    // Obtener productos por negocio (usuario autenticado)
    router.get(
      "/negocio/:negocioId",
      AuthMiddleware.protect,
      productoController.getProductosPorNegocio
    );
    router.get(
      "/negocio/:negocioId/disponibles",
       AuthMiddleware.protect,
      productoController.getProductosDisponiblesPorNegocio
    );

    // Cambiar estado (sólo admin)
    router.patch(
      "/:id/estado",
      AuthMiddleware.protect,
      productoController.toggleEstadoProducto
    );

    // Actualizar producto (usuario autenticado, puede ser dueño del negocio)
    router.patch(
      "/:id",
      AuthMiddleware.protect,
      uploadSingleFile("imagen"),
      productoController.updateProducto
    );

    // Eliminar producto (sólo admin o dueño del negocio)
    router.delete(
      "/:id",
      AuthMiddleware.protect,
      productoController.deleteProducto
    );

    return router;
  }
}
