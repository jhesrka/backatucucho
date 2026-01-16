import { Router } from "express";
import { AuthAdminMiddleware } from "../../middlewares/auth-admin.middleware";
import { uploadSingleFile } from "../../config";
import { NegocioAdminService } from "../services/negocioAdmin.service";
import { NegocioAdminController } from "./negocio.admin.controller";

export class NegocioAdminRoutes {
  static get routes(): Router {
    const router = Router();

    const service = new NegocioAdminService();
    const controller = new NegocioAdminController(service);

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
      "/admin/:id",
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

    return router;
  }
}
