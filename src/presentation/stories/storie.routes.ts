import { Router } from "express";
import { UserService } from "../services/usuario/user.service";
import { EmailService } from "../services/email.service";
import { envs, uploadSingleFile } from "../../config";
import { AuthMiddleware } from "../../middlewares/auth.middleware";
import { StorieController } from "./storie.controller";
import { StorieService } from "../services/storie.service";
import { WalletService } from "../services/wallet.service";
import { PriceService } from "../services/priceService/price-service.service";
import { AuthAdminMiddleware } from "../../middlewares";

export class StorieRoutes {
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
    const priceService = new PriceService();
    const storieService = new StorieService(
      userService,
      walletService,
      priceService
    );
    const storieController = new StorieController(storieService);

    router.get("/", AuthMiddleware.protect, storieController.findAllStorie);
    router.get(
      "/user",
      AuthMiddleware.protect,
      storieController.getStoriesByUser
    );
    router.post(
      "/",
      AuthMiddleware.protect,
      uploadSingleFile("imgstorie"),
      storieController.createStorie
    );
    router.delete(
      "/:id",
      AuthMiddleware.protect,
      storieController.deleteStorie
    );
    // ---------- RUTAS ADMIN ----------
    router.get(
      "/admin/search-by-id/:id",
      AuthAdminMiddleware.protect,
      storieController.findStorieByIdAdmin
    );
    router.post(
      "/admin/:id/block",
      AuthAdminMiddleware.protect,
      storieController.blockStorieAdmin
    );
    router.delete(
      "/admin/purge-deleted",
      AuthAdminMiddleware.protect,
      storieController.purgeDeletedStoriesOlderThan3Days
    );
    router.get(
      "/admin/metrics/paid",
      AuthAdminMiddleware.protect,
      storieController.countPaidStories
    );
    router.get(
      "/admin/metrics/paid/last24h",
      AuthAdminMiddleware.protect,
      storieController.countPaidStoriesLast24h
    );
    return router;
  }
}
