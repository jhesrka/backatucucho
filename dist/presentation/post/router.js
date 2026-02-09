"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostRoutes = void 0;
const express_1 = require("express");
const controller_1 = require("./controller");
const post_service_1 = require("../services/post.service");
const user_service_1 = require("../services/usuario/user.service");
const email_service_1 = require("../services/email.service");
const config_1 = require("../../config");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const services_1 = require("../services");
const middlewares_1 = require("../../middlewares");
class PostRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const emailService = new email_service_1.EmailService(config_1.envs.MAILER_SERVICE, config_1.envs.MAILER_EMAIL, config_1.envs.MAILER_SECRET_KEY, config_1.envs.SEND_EMAIL);
        const userService = new user_service_1.UserService(emailService);
        const subscriptionService = new services_1.SubscriptionService(); // Nueva instancia
        const freePostTrackerService = new services_1.FreePostTrackerService(); // Nueva instancia
        const globalSettingsService = new services_1.GlobalSettingsService();
        // Corregimos aquí los parámetros:
        const postService = new post_service_1.PostService(userService, subscriptionService, freePostTrackerService, globalSettingsService);
        const postController = new controller_1.PostController(postService);
        router.get("/misposts", auth_middleware_1.AuthMiddleware.protect, postController.getPostsByUser);
        router.get("/paginate", auth_middleware_1.AuthMiddleware.protect, postController.findAllPostPaginated);
        router.get("/search", auth_middleware_1.AuthMiddleware.protect, postController.searchPost);
        // ===================================
        // 🛡️ NEW ADMIN DASHBOARD ROUTES
        // ===================================
        router.get("/admin/list", middlewares_1.AuthAdminMiddleware.protect, postController.getAdminPosts);
        router.get("/admin/stats", middlewares_1.AuthAdminMiddleware.protect, postController.getAdminStats);
        router.delete("/admin/purge/old", middlewares_1.AuthAdminMiddleware.protect, postController.purgeOldDeletedPosts);
        // Totales de posts pagados activos
        router.get("/paid/active/count", middlewares_1.AuthAdminMiddleware.protect, postController.countActivePaidPosts);
        router.get("/paid/active/count/last24h", middlewares_1.AuthAdminMiddleware.protect, postController.countActivePaidPostsLast24h);
        //total de posts gratuitos publicados (vigentes)
        router.get("/free/published/count", middlewares_1.AuthAdminMiddleware.protect, postController.countFreePublishedPosts);
        router.get("/admin/search-by-id/:id", middlewares_1.AuthAdminMiddleware.protect, postController.getPostByIdAdmin);
        // NUEVO: Admin - Get All Posts of User
        router.get("/admin/user/:id/posts", middlewares_1.AuthAdminMiddleware.protect, postController.getPostsByUserAdmin);
        router.get("/:id", auth_middleware_1.AuthMiddleware.protect, postController.findOnePost);
        router.post("/plan", auth_middleware_1.AuthMiddleware.protect, (0, config_1.uploadMultipleFile)("imgs", 5), postController.createPostPlan);
        // Bloquear post (ADMIN)
        router.post("/admin/:id/block", middlewares_1.AuthAdminMiddleware.protect, postController.blockPostAdmin);
        // Purgar posts ELIMINADO (> 3 días) + borrar imágenes en AWS
        router.delete("/admin/purge-deleted", middlewares_1.AuthAdminMiddleware.protect, postController.purgeDeletedPostsOlderThan3Days);
        // NUEVO: Admin Purge Individual
        router.delete("/admin/purge/:id", middlewares_1.AuthAdminMiddleware.protect, postController.purgePostAdmin);
        // NUEVO: Admin Change Status
        router.put("/admin/status/:id", middlewares_1.AuthAdminMiddleware.protect, postController.changeStatusPostAdmin);
        router.delete("/:id", auth_middleware_1.AuthMiddleware.protect, postController.deletePost);
        router.patch("/:id/update-date", auth_middleware_1.AuthMiddleware.protect, postController.updatePostDate);
        router.patch("/:id", auth_middleware_1.AuthMiddleware.protect, postController.updatePost);
        //ADMINISTRADOR
        return router;
    }
}
exports.PostRoutes = PostRoutes;
