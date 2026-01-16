import { Router } from "express";
import { PostController } from "./controller";
import { PostService } from "../services/post.service";
import { UserService } from "../services/usuario/user.service";
import { EmailService } from "../services/email.service";
import { envs, uploadMultipleFile } from "../../config";
import { AuthMiddleware } from "../../middlewares/auth.middleware";
import { FreePostTrackerService, SubscriptionService } from "../services";
import { AuthAdminMiddleware } from "../../middlewares";

export class PostRoutes {
  static get routes(): Router {
    const router = Router();
    const emailService = new EmailService(
      envs.MAILER_SERVICE,
      envs.MAILER_EMAIL,
      envs.MAILER_SECRET_KEY,
      envs.SEND_EMAIL
    );
    const userService = new UserService(emailService);
    const subscriptionService = new SubscriptionService(); // Nueva instancia
    const freePostTrackerService = new FreePostTrackerService(); // Nueva instancia

    // Corregimos aquí los parámetros:
    const postService = new PostService(
      userService,
      subscriptionService,
      freePostTrackerService
    );
    const postController = new PostController(postService);

    router.get(
      "/misposts",
      AuthMiddleware.protect,
      postController.getPostsByUser
    );
    router.get(
      "/paginate",
      AuthMiddleware.protect,
      postController.findAllPostPaginated
    );
    router.get("/search", AuthMiddleware.protect, postController.searchPost);

    // Totales de posts pagados activos
    router.get(
      "/paid/active/count",
      AuthAdminMiddleware.protect,
      postController.countActivePaidPosts
    );
    router.get(
      "/paid/active/count/last24h",
      AuthAdminMiddleware.protect,
      postController.countActivePaidPostsLast24h
    );
    //total de posts gratuitos publicados (vigentes)
    router.get(
      "/free/published/count",
      AuthAdminMiddleware.protect,
      postController.countFreePublishedPosts
    );
    router.get(
      "/admin/search-by-id/:id",
      AuthAdminMiddleware.protect,
      postController.getPostByIdAdmin
    );

    router.get("/:id", AuthMiddleware.protect, postController.findOnePost);

    router.post(
      "/plan",
      AuthMiddleware.protect,
      uploadMultipleFile("imgs", 4),
      postController.createPostPlan
    );
    // Bloquear post (ADMIN)
    router.post(
      "/admin/:id/block",
      AuthAdminMiddleware.protect,
      postController.blockPostAdmin
    );
    // Purgar posts ELIMINADO (> 3 días) + borrar imágenes en AWS
    router.delete(
      "/admin/purge-deleted",
      AuthAdminMiddleware.protect,
      postController.purgeDeletedPostsOlderThan3Days
    );

    router.delete("/:id", AuthMiddleware.protect, postController.deletePost);
    router.patch(
      "/:id/update-date",
      AuthMiddleware.protect,
      postController.updatePostDate
    );

    router.patch("/:id", AuthMiddleware.protect, postController.updatePost);
    //ADMINISTRADOR
    return router;
  }
}
