"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletRoutes = void 0;
const express_1 = require("express");
const wallet_controller_1 = require("./wallet.controller");
const wallet_service_1 = require("../services/wallet.service");
const user_service_1 = require("../services/usuario/user.service");
const email_service_1 = require("../services/email.service");
const config_1 = require("../../config");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const middlewares_1 = require("../../middlewares");
class WalletRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const emailService = new email_service_1.EmailService(config_1.envs.MAILER_SERVICE, config_1.envs.MAILER_EMAIL, config_1.envs.MAILER_SECRET_KEY, config_1.envs.SEND_EMAIL);
        const userService = new user_service_1.UserService(emailService);
        const walletService = new wallet_service_1.WalletService(userService);
        const walletController = new wallet_controller_1.WalletController(walletService);
        //USUARIO
        router.post("/", auth_middleware_1.AuthMiddleware.protect, walletController.createWallet);
        router.get("/:userId", auth_middleware_1.AuthMiddleware.protect, walletController.getWalletByUserId);
        router.get("/:userId/transactions", auth_middleware_1.AuthMiddleware.protect, walletController.getUserTransactions);
        // SOLICITUD DE RETIRO
        router.post("/:userId/withdraw", auth_middleware_1.AuthMiddleware.protect, walletController.requestWithdrawal);
        //ADMINISTRADOR
        // Todas las wallets
        router.get("/", middlewares_1.AuthAdminMiddleware.protect, walletController.getAllWallets);
        // ✅ Restar saldo
        router.patch("/admin/:userId/subtract", middlewares_1.AuthAdminMiddleware.protect, walletController.subtractBalance);
        // ✅ Total de todas las billeteras
        router.get("/admin/total-balance", middlewares_1.AuthAdminMiddleware.protect, walletController.getTotalBalance);
        // ✅ Cantidad de wallets con balance 0
        router.get("/admin/count/zero", middlewares_1.AuthAdminMiddleware.protect, walletController.getCountZeroBalance);
        // ✅ Cantidad de wallets con balance > 0
        router.get("/admin/count/positive", middlewares_1.AuthAdminMiddleware.protect, walletController.getCountPositiveBalance);
        // ✅ Bloquear wallet
        router.patch("/admin/:userId/block", middlewares_1.AuthAdminMiddleware.protect, walletController.blockWallet);
        // ✅ Activar wallet
        router.patch("/admin/:userId/activate", middlewares_1.AuthAdminMiddleware.protect, walletController.activateWallet);
        return router;
    }
}
exports.WalletRoutes = WalletRoutes;
