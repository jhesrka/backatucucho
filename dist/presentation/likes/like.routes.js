"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LikeRoutes = void 0;
const express_1 = require("express");
const like_service_1 = require("../services/postService/like.service");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const like_controller_1 = require("./like.controller");
class LikeRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const likeService = new like_service_1.LikeService();
        const likeController = new like_controller_1.LikeController(likeService);
        // Todas las rutas protegidas (requieren usuario autenticado)
        router.use(auth_middleware_1.AuthMiddleware.protect);
        /**
         * Da like a un post (una sola vez por usuario)
         * POST /api/likes/
         * body: { userId, postId }
         */
        router.post("/", likeController.addLike);
        /**
         * Quita el like de un post
         * DELETE /api/likes/:postId
         */
        router.delete("/:postId", likeController.removeLike);
        /**
         * Cuenta la cantidad de likes de un post
         * GET /api/like/count/:postId
         */
        router.get("/count/:postId", likeController.countLikesByPost);
        /**
         * Verifica si el usuario ya dio like a un post
         * GET /api/like/has-liked/:postId/:userId
         */
        router.get("/has-liked/:postId/:userId", likeController.hasUserLikedPost);
        return router;
    }
}
exports.LikeRoutes = LikeRoutes;
