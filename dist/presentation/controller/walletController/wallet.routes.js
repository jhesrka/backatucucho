"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletRoutes = void 0;
const express_1 = require("express");
const wallet_controller_1 = require("./wallet.controller");
const auth_admin_middleware_1 = require("../../../middlewares/auth-admin.middleware");
class WalletRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const walletController = new wallet_controller_1.WalletController();
        // ================= ADMIN ROUTES (Protected by AuthAdminMiddleware) =================
        // Obtener lista de usuarios con billetera (Paginado)
        router.get("/admin/users", [auth_admin_middleware_1.AuthAdminMiddleware.protect], walletController.getWalletUsers);
        // Obtener estadísticas globales
        router.get("/admin/stats/global", [auth_admin_middleware_1.AuthAdminMiddleware.protect], walletController.getGlobalDashStats);
        // Obtener billetera de un usuario
        router.get("/admin/user/:userId", [auth_admin_middleware_1.AuthAdminMiddleware.protect], walletController.getWalletByUserId);
        // Obtener historial de transacciones
        router.get("/admin/:walletId/transactions", [auth_admin_middleware_1.AuthAdminMiddleware.protect], walletController.getTransactionHistory);
        // 📅 Cierre Financiero Diario
        router.get("/admin/financial/closing", [auth_admin_middleware_1.AuthAdminMiddleware.protect], walletController.getDailyClosing);
        router.post("/admin/financial/closing", [auth_admin_middleware_1.AuthAdminMiddleware.protect], walletController.closeDay);
        // Obtener estadísticas de la billetera
        router.get("/admin/:walletId/stats", [auth_admin_middleware_1.AuthAdminMiddleware.protect], walletController.getWalletStats);
        // Ajustar saldo manualmente (requiere Master PIN)
        router.post("/admin/:walletId/adjust", [auth_admin_middleware_1.AuthAdminMiddleware.protect], walletController.adjustBalance);
        // Bloquear/Desbloquear billetera (requiere Master PIN)
        router.put("/admin/:walletId/toggle-status", [auth_admin_middleware_1.AuthAdminMiddleware.protect], walletController.toggleWalletStatus);
        return router;
    }
}
exports.WalletRoutes = WalletRoutes;
