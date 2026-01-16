import { Router } from "express";

import { LikeService } from "../services/postService/like.service";
import { AuthMiddleware } from "../../middlewares/auth.middleware";
import { LikeController } from "./like.controller";

export class LikeRoutes {
  static get routes(): Router {
    const router = Router();

    const likeService = new LikeService();
    const likeController = new LikeController(likeService);

    // Todas las rutas protegidas (requieren usuario autenticado)
    router.use(AuthMiddleware.protect);

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
