import { Router } from "express";
import { WalletController } from "./wallet.controller";
import { AuthAdminMiddleware } from "../../../middlewares/auth-admin.middleware";

export class WalletRoutes {
    static get routes(): Router {
        const router = Router();
        const walletController = new WalletController();

        // ================= ADMIN ROUTES (Protected by AuthAdminMiddleware) =================

        // Obtener lista de usuarios con billetera (Paginado)
        router.get("/admin/users", [AuthAdminMiddleware.protect], walletController.getWalletUsers);

        // Obtener estadísticas globales
        router.get("/admin/stats/global", [AuthAdminMiddleware.protect], walletController.getGlobalDashStats);

        // Obtener billetera de un usuario
        router.get("/admin/user/:userId", [AuthAdminMiddleware.protect], walletController.getWalletByUserId);

        // Obtener historial de transacciones
        router.get("/admin/:walletId/transactions", [AuthAdminMiddleware.protect], walletController.getTransactionHistory);

        // 📅 Cierre Financiero Diario
        router.get("/admin/financial/closing", [AuthAdminMiddleware.protect], walletController.getDailyClosing);
        router.post("/admin/financial/closing", [AuthAdminMiddleware.protect], walletController.closeDay);

        // Obtener estadísticas de la billetera
        router.get("/admin/:walletId/stats", [AuthAdminMiddleware.protect], walletController.getWalletStats);

        // Ajustar saldo manualmente (requiere Master PIN)
        router.post("/admin/:walletId/adjust", [AuthAdminMiddleware.protect], walletController.adjustBalance);

        // Bloquear/Desbloquear billetera (requiere Master PIN)
        router.put("/admin/:walletId/toggle-status", [AuthAdminMiddleware.protect], walletController.toggleWalletStatus);

        return router;
    }
}
