"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserMotorizadoRoutes = void 0;
// src/presentation/motorizado/motorizado.routes.ts
const express_1 = require("express");
const services_1 = require("../../services");
const usermotorizado_controller_1 = require("./usermotorizado.controller");
const auth_admin_middleware_1 = require("../../../middlewares/auth-admin.middleware");
const multer_1 = __importDefault(require("multer"));
const middlewares_1 = require("../../../middlewares");
class UserMotorizadoRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const motorizadoService = new services_1.UserMotorizadoService();
        const motorizadoController = new usermotorizado_controller_1.MotorizadoController(motorizadoService);
        const upload = (0, multer_1.default)();
        // Login público
        router.post("/login", motorizadoController.loginMotorizado);
        router.post("/logout", middlewares_1.AuthMotorizadoMiddleware.protect, motorizadoController.logoutMotorizado);
        router.post("/", upload.none(), auth_admin_middleware_1.AuthAdminMiddleware.protect, motorizadoController.createMotorizado);
        router.post("/forgot-password", motorizadoController.forgotPassword);
        router.post("/reset-password", motorizadoController.resetPassword);
        // Ejemplos de rutas protegidas
        router.get("/profile", (req, res) => {
            // req.body.sessionMotorizado tiene al motorizado logueado
            res.json(req.body.sessionMotorizado);
        });
        router.get("/me", middlewares_1.AuthMotorizadoMiddleware.protect, motorizadoController.getMotorizadoMe);
        // 🔄 Gestión de Pedidos (Admin)
        router.patch("/orders/:pedidoId/status", motorizadoController.changeOrderStatus);
        router.get("/", motorizadoController.findAllMotorizados);
        router.get("/:id", motorizadoController.findMotorizadoById);
        router.get("/:id/orders", motorizadoController.getOrdersHistory);
        router.patch("/:id", motorizadoController.updateMotorizado);
        router.patch("/toggle-active/:id", motorizadoController.toggleActivo);
        router.patch("/change-password/:id", motorizadoController.cambiarPassword);
        router.get("/:id/stats/monthly", motorizadoController.getMonthlyPerformance);
        // Billetera & Finanzas
        router.get("/wallet/global-stats", auth_admin_middleware_1.AuthAdminMiddleware.protect, motorizadoController.getGlobalWalletStats);
        router.get("/wallet/global-withdrawals", auth_admin_middleware_1.AuthAdminMiddleware.protect, motorizadoController.getAllGlobalWithdrawals);
        router.get("/:id/wallet/stats", auth_admin_middleware_1.AuthAdminMiddleware.protect, motorizadoController.getWalletStats);
        router.get("/:id/wallet/transactions", auth_admin_middleware_1.AuthAdminMiddleware.protect, motorizadoController.getTransactions);
        router.post("/:id/wallet/adjust", auth_admin_middleware_1.AuthAdminMiddleware.protect, motorizadoController.adjustBalance);
        // Solicitudes de Retiro
        router.get("/:id/wallet/withdrawals", auth_admin_middleware_1.AuthAdminMiddleware.protect, motorizadoController.getWithdrawals);
        router.post("/:id/wallet/withdrawals/:transactionId/approve", auth_admin_middleware_1.AuthAdminMiddleware.protect, upload.single('file'), motorizadoController.approveWithdrawal);
        router.post("/:id/wallet/withdrawals/:transactionId/reject", auth_admin_middleware_1.AuthAdminMiddleware.protect, motorizadoController.rejectWithdrawal);
        router.delete("/:id/force", auth_admin_middleware_1.AuthAdminMiddleware.protect, motorizadoController.deleteForce);
        router.delete("/:id", motorizadoController.deleteMotorizado);
        return router;
    }
}
exports.UserMotorizadoRoutes = UserMotorizadoRoutes;
