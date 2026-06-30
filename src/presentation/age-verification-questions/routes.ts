import { Router } from "express";
import { AgeVerificationQuestionService } from "./age-verification-questions.service";
import { AgeVerificationQuestionController } from "./age-verification-questions.controller";
import { AuthAdminMiddleware } from "../../middlewares/auth-admin.middleware";
import { AuthMiddleware } from "../../middlewares/auth.middleware";
import { UserRoleAdmin } from "../../data";

export class AgeVerificationQuestionRoutes {
  static get routes(): Router {
    const router = Router();

    const service = new AgeVerificationQuestionService();
    const controller = new AgeVerificationQuestionController(service);

    // Motorizados and Users might need to read the active questions, but mostly motorizados.
    // Let's expose GET / to authenticated users.
    router.get("/", AuthMiddleware.protect, controller.getAllQuestions);

    // Admin CRUD routes
    router.post("/", AuthAdminMiddleware.protect, AuthAdminMiddleware.restrictTo(UserRoleAdmin.ADMIN), controller.createQuestion);
    router.patch("/:id", AuthAdminMiddleware.protect, AuthAdminMiddleware.restrictTo(UserRoleAdmin.ADMIN), controller.updateQuestion);
    router.delete("/:id", AuthAdminMiddleware.protect, AuthAdminMiddleware.restrictTo(UserRoleAdmin.ADMIN), controller.deleteQuestion);

    return router;
  }
}
