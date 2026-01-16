import { Router } from "express";
import { EmailService, RechargeRequestService, UserService } from "../services";
import { AuthAdminMiddleware, AuthMiddleware } from "../../middlewares";
import { RechargeRequestController } from "./recharge-request.controller";
import { envs, uploadSingleFile } from "../../config";

export class RechargeRoutes {
  static get routes(): Router {
    const router = Router();

    const emailService = new EmailService(
      envs.MAILER_SERVICE,
      envs.MAILER_EMAIL,
      envs.MAILER_SECRET_KEY,
      envs.SEND_EMAIL
    );
    const userService = new UserService(emailService);
    const rechargeService = new RechargeRequestService(userService);
    const rechargeRequestController = new RechargeRequestController(
      rechargeService
    );

    //USUARIO

    //CREAR RECARGA
    router.post(
      "/",
      AuthMiddleware.protect,
      uploadSingleFile("receipt_image"),
      rechargeRequestController.createRecharge
    );

    // OBTENER RECARGAS POR PAGINACION 3
    router.get(
      "/user/:userId",
      AuthMiddleware.protect,
      rechargeRequestController.getRechargeRequestsByUser
    );
    // FILTRAR POR ESTADO
    router.get(
      "/filter/status/:status",
      AuthMiddleware.protect,
      rechargeRequestController.filterByStatus
    );

    // FILTRAR POR RANGO DE FECHAS (solo admin)
    // Query params: startDate, endDate
    // routes/recharge.js
    router.get(
      "/user/:userId/filter/date-range",
      AuthMiddleware.protect,
      rechargeRequestController.filterByDateRange
    );

    //ACTUALIZAR ES EL ESTADO Y LOS DATOS PARA LA RECARGA
    router.patch(
      "/:id/status",
      AuthAdminMiddleware.protect,
      rechargeRequestController.updateStatus
    );

    //ADMINISTRADOR
    //1 Obtener todas las recargas paginadas (solo admin)
    router.get(
      "/all/paginated",
      AuthAdminMiddleware.protect,
      rechargeRequestController.getAllRequestsPaginated
    );

    //2 Búsqueda por término (solo admin o usuario protegido)
    router.get(
      "/search",
      AuthAdminMiddleware.protect,
      rechargeRequestController.searchRechargeRequests
    );
    //3
    router.get(
      "/all",
      AuthAdminMiddleware.protect,
      rechargeRequestController.getAllRechargeRequests
    );
    //4
    router.get(
      "/filter/date-range",
      AuthAdminMiddleware.protect,
      rechargeRequestController.filterByDateRangePaginated
    );
    //5
    router.patch(
      "/update-status/:id",
      AuthAdminMiddleware.protect,
      rechargeRequestController.updateStatus
    );
    //6
    router.get(
      "/export/csv",
      AuthAdminMiddleware.protect,
      rechargeRequestController.exportToCSVByDate
    );
    //7
    // recharge.routes.ts
    router.get(
      "/filter/status/admin/:status",
      AuthAdminMiddleware.protect,
      rechargeRequestController.filterByStatusAdmin
    );
    // 8. Eliminar solicitudes de recarga viejas (más de 2 días por ahora)
    router.delete(
      "/delete-old",
      AuthAdminMiddleware.protect,
      rechargeRequestController.deleteOldRechargeRequests
    );

    return router;
  }
}
