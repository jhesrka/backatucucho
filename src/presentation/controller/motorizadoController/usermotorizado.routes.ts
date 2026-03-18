// src/presentation/motorizado/motorizado.routes.ts
import { Router } from "express";
import { UserMotorizadoService } from "../../services";
import { MotorizadoController } from "./usermotorizado.controller";
import { AuthAdminMiddleware } from "../../../middlewares/auth-admin.middleware";
import multer from "multer";
import { AuthMotorizadoMiddleware } from "../../../middlewares";

export class UserMotorizadoRoutes {
  static get routes(): Router {
    const router = Router();
    const motorizadoService = new UserMotorizadoService();
    const motorizadoController = new MotorizadoController(motorizadoService);
    const upload = multer();
    // Login público
    router.post("/login", motorizadoController.loginMotorizado);
    router.post(
      "/logout",
      AuthMotorizadoMiddleware.protect,
      motorizadoController.logoutMotorizado
    );

    router.post(
      "/",
      upload.none(),
      AuthAdminMiddleware.protect,
      motorizadoController.createMotorizado
    );
    router.post("/forgot-password", motorizadoController.forgotPassword);
    router.post("/reset-password", motorizadoController.resetPassword);

    // Ejemplos de rutas protegidas
    router.get("/profile", (req, res) => {
      // req.body.sessionMotorizado tiene al motorizado logueado
      res.json(req.body.sessionMotorizado);
    });
    router.get(
      "/me",
      AuthMotorizadoMiddleware.protect,
      motorizadoController.getMotorizadoMe
    );
    router.post(
      "/me/change-password",
      AuthMotorizadoMiddleware.protect,
      motorizadoController.cambiarPasswordSelf
    );

    // 🔄 Gestión de Pedidos (Admin)
    router.patch("/orders/:pedidoId/status", motorizadoController.changeOrderStatus);

    // Billetera & Finanzas (Globales primero para evitar interferencia con :id)
    router.get("/wallet/global-stats", AuthAdminMiddleware.protect, motorizadoController.getGlobalWalletStats);
    router.get("/wallet/global-withdrawals", AuthAdminMiddleware.protect, motorizadoController.getAllGlobalWithdrawals);
    router.get("/wallet/withdrawals-stats-today", AuthAdminMiddleware.protect, motorizadoController.getWithdrawalStats);
    router.get("/wallet/control-data", AuthAdminMiddleware.protect, motorizadoController.getWalletControlData);

    router.get("/", motorizadoController.findAllMotorizados);
    router.get("/:id", motorizadoController.findMotorizadoById);
    router.get("/:id/orders", motorizadoController.getOrdersHistory);
    router.patch("/:id", motorizadoController.updateMotorizado);
    router.patch("/toggle-active/:id", motorizadoController.toggleActivo);
    router.patch("/change-password/:id", motorizadoController.cambiarPassword);
    router.get("/:id/stats/monthly", motorizadoController.getMonthlyPerformance);

    router.get("/:id/wallet/stats", AuthAdminMiddleware.protect, motorizadoController.getWalletStats);
    router.get("/:id/wallet/transactions", AuthAdminMiddleware.protect, motorizadoController.getTransactions);
    router.post("/:id/wallet/adjust", AuthAdminMiddleware.protect, motorizadoController.adjustBalance);

    // Solicitudes de Retiro
    router.get("/:id/wallet/withdrawals", AuthAdminMiddleware.protect, motorizadoController.getWithdrawals);
    router.post("/:id/wallet/withdrawals/:transactionId/approve", AuthAdminMiddleware.protect, upload.single('file'), motorizadoController.approveWithdrawal);
    router.post("/:id/wallet/withdrawals/:transactionId/reject", AuthAdminMiddleware.protect, motorizadoController.rejectWithdrawal);

    router.delete("/:id/force", AuthAdminMiddleware.protect, motorizadoController.deleteForce);
    router.delete("/:id", motorizadoController.deleteMotorizado);

    return router;
  }
}
