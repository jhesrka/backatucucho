import { Router } from "express";
import { UserService } from "../services/usuario/user.service";
import { EmailService } from "../services/email.service";
import { envs, uploadSingleFile } from "../../config";
import { AuthMiddleware } from "../../middlewares/auth.middleware";
import { StorieController } from "./storie.controller";
import { StorieService } from "../services/storie.service";
import { WalletService } from "../services/postService/wallet.service";
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
    const walletService = new WalletService();
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

    // NUEVO: Admin Purge Old (+30 Days) - MUST BE BEFORE /admin/purge/:id
    router.delete(
      "/admin/purge/old-stories",
      AuthAdminMiddleware.protect,
      storieController.purgeOldStories
    );

    // NUEVO: Admin Purge Individual
    router.delete(
      "/admin/purge/:id",
      AuthAdminMiddleware.protect,
      storieController.purgeStorieAdmin
    );

    // NUEVO: Admin - Get All Stories of User
    router.get(
      "/admin/user/:id/stories",
      AuthAdminMiddleware.protect,
      storieController.getStoriesByUserAdmin
    );


    // NUEVO: Admin Change Status
    router.put(
      "/admin/status/:id",
      AuthAdminMiddleware.protect,
      storieController.changeStatusStorieAdmin
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
    // NUEVO: Admin Stats Dashboard
    router.get(
      "/admin/stats/dashboard",
      AuthAdminMiddleware.protect,
      storieController.getAdminStats
    );

    // NUEVO: Admin List Filtered
    router.get(
      "/admin/list/all",
      AuthAdminMiddleware.protect,
      storieController.getAllStoriesAdmin
    );



    return router;
  }
}
