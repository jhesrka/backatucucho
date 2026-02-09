import { Router } from "express";
import { AuthAdminMiddleware } from "../../middlewares/auth-admin.middleware";
import { uploadSingleFile } from "../../config";
import { NegocioAdminService } from "../services/negocioAdmin.service";
import { NegocioAdminController } from "./negocio.admin.controller";
import { SubscriptionService } from "../services/subscription.service";

export class NegocioAdminRoutes {
  static get routes(): Router {
    const router = Router();

    const subscriptionService = new SubscriptionService();
    const service = new NegocioAdminService(subscriptionService);
    const controller = new NegocioAdminController(service, subscriptionService);

    // Crear negocio (admin)
    router.post(
      "/",
      AuthAdminMiddleware.protect,
      uploadSingleFile("imagenNegocio"),
      controller.createNegocioAdmin
    );

    // Obtener negocios con filtros (paginados)
    router.get("/", AuthAdminMiddleware.protect, controller.getNegociosAdmin);

    // Exportar negocios a CSV
    router.get(
      "/export",
      AuthAdminMiddleware.protect,
      controller.exportNegociosToCSV
    );

    // ===================== NUEVO: ESTADÍSTICAS ADMIN =====================
    router.get(
      "/stats",
      AuthAdminMiddleware.protect,
      controller.getNegociosStatsAdmin
    );

    // ========================= ACTUALIZAR NEGOCIO =========================
    router.patch(
      "/:id",
      AuthAdminMiddleware.protect,
      controller.updateNegocioAdmin
    );
    // ===================== CAMBIAR ESTADO =====================
    // 🔄 Alternar entre ABIERTO / CERRADO (solo el dueño del negocio o admin)
    router.patch(
      "/:id/toggle-estado",
      AuthAdminMiddleware.protect, // o AuthAdminMiddleware si quieres solo admin
      controller.toggleEstadoNegocioAdmin
    );

    // Eliminar definitivamente
    router.delete(
      "/:id",
      AuthAdminMiddleware.protect,
      controller.deleteNegocioAdmin
    );

    // NUEVO: Admin Purge Individual
    router.delete(
      "/purge/:id",
      AuthAdminMiddleware.protect,
      controller.purgeNegocioAdmin
    );

    // NUEVO: Admin Change Status
    router.put(
      "/status/:id",
      AuthAdminMiddleware.protect,
      controller.changeStatusNegocioAdmin
    );

    // NUEVO: Admin - Get All Businesses of User
    router.get(
      "/user/:id/negocios",
      AuthAdminMiddleware.protect,
      controller.getNegociosByUserAdmin
    );

    // NUEVO: Admin - Forzar cobro de suscripción
    router.post(
      "/:id/force-subscription",
      AuthAdminMiddleware.protect,
      controller.forceChargeSubscription
    );

    return router;
  }
}
