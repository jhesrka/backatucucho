"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorieRoutes = void 0;
const express_1 = require("express");
const user_service_1 = require("../services/usuario/user.service");
const email_service_1 = require("../services/email.service");
const config_1 = require("../../config");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const storie_controller_1 = require("./storie.controller");
const storie_service_1 = require("../services/storie.service");
const wallet_service_1 = require("../services/postService/wallet.service");
const price_service_service_1 = require("../services/priceService/price-service.service");
const middlewares_1 = require("../../middlewares");
class StorieRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const emailService = new email_service_1.EmailService(config_1.envs.MAILER_SERVICE, config_1.envs.MAILER_EMAIL, config_1.envs.MAILER_SECRET_KEY, config_1.envs.SEND_EMAIL);
        const userService = new user_service_1.UserService(emailService);
        const walletService = new wallet_service_1.WalletService();
        const priceService = new price_service_service_1.PriceService();
        const storieService = new storie_service_1.StorieService(userService, walletService, priceService);
        const storieController = new storie_controller_1.StorieController(storieService);
        router.get("/", auth_middleware_1.AuthMiddleware.protect, storieController.findAllStorie);
        router.get("/user", auth_middleware_1.AuthMiddleware.protect, storieController.getStoriesByUser);
        router.post("/", auth_middleware_1.AuthMiddleware.protect, (0, config_1.uploadSingleFile)("imgstorie"), storieController.createStorie);
        router.delete("/:id", auth_middleware_1.AuthMiddleware.protect, storieController.deleteStorie);
        // ---------- RUTAS ADMIN ----------
        router.get("/admin/search-by-id/:id", middlewares_1.AuthAdminMiddleware.protect, storieController.findStorieByIdAdmin);
        router.post("/admin/:id/block", middlewares_1.AuthAdminMiddleware.protect, storieController.blockStorieAdmin);
        router.delete("/admin/purge-deleted", middlewares_1.AuthAdminMiddleware.protect, storieController.purgeDeletedStoriesOlderThan3Days);
        // NUEVO: Admin Purge Old (+30 Days) - MUST BE BEFORE /admin/purge/:id
        router.delete("/admin/purge/old-stories", middlewares_1.AuthAdminMiddleware.protect, storieController.purgeOldStories);
        // NUEVO: Admin Purge Individual
        router.delete("/admin/purge/:id", middlewares_1.AuthAdminMiddleware.protect, storieController.purgeStorieAdmin);
        // NUEVO: Admin - Get All Stories of User
        router.get("/admin/user/:id/stories", middlewares_1.AuthAdminMiddleware.protect, storieController.getStoriesByUserAdmin);
        // NUEVO: Admin Change Status
        router.put("/admin/status/:id", middlewares_1.AuthAdminMiddleware.protect, storieController.changeStatusStorieAdmin);
        router.get("/admin/metrics/paid", middlewares_1.AuthAdminMiddleware.protect, storieController.countPaidStories);
        router.get("/admin/metrics/paid/last24h", middlewares_1.AuthAdminMiddleware.protect, storieController.countPaidStoriesLast24h);
        // NUEVO: Admin Stats Dashboard
        router.get("/admin/stats/dashboard", middlewares_1.AuthAdminMiddleware.protect, storieController.getAdminStats);
        // NUEVO: Admin List Filtered
        router.get("/admin/list/all", middlewares_1.AuthAdminMiddleware.protect, storieController.getAllStoriesAdmin);
        return router;
    }
}
exports.StorieRoutes = StorieRoutes;
