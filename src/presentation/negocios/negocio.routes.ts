import { Router } from "express";
import { NegocioService } from "../services/negocio.service";
import { NegocioController } from "./negocio.controller";
import { AuthMiddleware } from "../../middlewares/auth.middleware";
import { AuthAdminMiddleware } from "../../middlewares/auth-admin.middleware";
import { uploadSingleFile } from "../../config";
// ✅

export class NegocioRoutes {
  static get routes(): Router {
    const router = Router();

    const negocioService = new NegocioService();
    const negocioController = new NegocioController(negocioService);

    // ===================== CREAR =====================
    router.post(
      "/",
      AuthMiddleware.protect,
      uploadSingleFile("imagenNegocio"),
      negocioController.createNegocio
    );
    router.post(
      "/admin",
      AuthAdminMiddleware.protect,
      uploadSingleFile("imagenNegocio"),
      negocioController.createNegocio
    );

    // ===================== LEER =====================
    router.get(
      "/categoria/:categoriaId",
      AuthMiddleware.protect,
      negocioController.getNegociosByCategoria
    );
    router.get(
      "/",
      AuthAdminMiddleware.protect,
      negocioController.getNegociosFiltrados
    );

    // Obtener todos los negocios creados por un usuario
    router.get(
      "/usuario/:userId",
      AuthMiddleware.protect,
      negocioController.getNegociosByUserId
    );

    // ===================== ACTUALIZAR =====================
    router.patch(
      "/:id",
      AuthMiddleware.protect,
      uploadSingleFile("imagenNegocio"),
      negocioController.updateNegocio
    );

    // ===================== CAMBIAR ESTADO =====================
    // 🔄 Alternar entre ABIERTO / CERRADO (solo el dueño del negocio o admin)
    router.patch(
      "/:id/toggle-estado",
      AuthMiddleware.protect, // o AuthAdminMiddleware si quieres solo admin
      negocioController.toggleEstadoNegocio
    );

    // 💳 Pagar suscripción manualmente (solo dueño)
    router.post(
      "/:id/pay-subscription",
      AuthMiddleware.protect,
      negocioController.paySubscription
    );
    // ===================== ELIMINAR =====================
    router.delete(
      "/:id",
      AuthMiddleware.protect,
      negocioController.deleteIfNotActivo
    );

    return router;
  }
}
