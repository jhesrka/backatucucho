import { Router } from "express";
import { WalletController } from "./wallet.controller";
import { WalletService } from "../services/wallet.service";
import { UserService } from "../services/usuario/user.service";
import { EmailService } from "../services/email.service";
import { envs } from "../../config";
import { AuthMiddleware } from "../../middlewares/auth.middleware";
import { AuthAdminMiddleware } from "../../middlewares";

export class WalletRoutes {
  static get routes(): Router {
    const router = Router();

    const emailService = new EmailService(
      envs.MAILER_SERVICE,
      envs.MAILER_EMAIL,
      envs.MAILER_SECRET_KEY,
      envs.SEND_EMAIL
    );
    const userService = new UserService(emailService);
    const walletService = new WalletService(userService);
    const walletController = new WalletController(walletService);

    //USUARIO

    router.post("/", AuthMiddleware.protect, walletController.createWallet);
    router.get(
      "/:userId",
      AuthMiddleware.protect,
      walletController.getWalletByUserId
    );
    //ADMINISTRADOR
    // Todas las wallets
    router.get(
      "/",
      AuthAdminMiddleware.protect,
      walletController.getAllWallets
    );

    // ✅ Restar saldo
    router.patch(
      "/admin/:userId/subtract",
      AuthAdminMiddleware.protect,
      walletController.subtractBalance
    );

    // ✅ Total de todas las billeteras
    router.get(
      "/admin/total-balance",
      AuthAdminMiddleware.protect,
      walletController.getTotalBalance
    );

    // ✅ Cantidad de wallets con balance 0
    router.get(
      "/admin/count/zero",
      AuthAdminMiddleware.protect,
      walletController.getCountZeroBalance
    );

    // ✅ Cantidad de wallets con balance > 0
    router.get(
      "/admin/count/positive",
      AuthAdminMiddleware.protect,
      walletController.getCountPositiveBalance
    );

    // ✅ Bloquear wallet
    router.patch(
      "/admin/:userId/block",
      AuthAdminMiddleware.protect,
      walletController.blockWallet
    );

    // ✅ Activar wallet
    router.patch(
      "/admin/:userId/activate",
      AuthAdminMiddleware.protect,
      walletController.activateWallet
    );

    return router;
  }
}
