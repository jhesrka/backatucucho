// src/presentation/motorizado/motorizado.routes.ts
import { Router } from "express";
import { UserMotorizadoService } from "../../services";
import { MotorizadoController } from "./usermotorizado.controller";
import { AuthAdminMiddleware } from "../../../middlewares/auth-admin.middleware";
import multer from "multer";
import { AuthMotorizadoMiddleware } from "../../../middlewares";

export class UserMotorizadoRoutes {
  static get routes(): Router {
    const router = Router();
    const motorizadoService = new UserMotorizadoService();
    const motorizadoController = new MotorizadoController(motorizadoService);
    const upload = multer();
    // Login público
    router.post("/login", motorizadoController.loginMotorizado);
    router.post(
      "/logout",
      AuthMotorizadoMiddleware.protect,
      motorizadoController.logoutMotorizado
    );

    router.post(
      "/",
      upload.none(),
      AuthAdminMiddleware.protect,
      motorizadoController.createMotorizado
    );
    router.post("/forgot-password", motorizadoController.forgotPassword);
    router.post("/reset-password", motorizadoController.resetPassword);

    // Ejemplos de rutas protegidas
    router.get("/profile", (req, res) => {
      // req.body.sessionMotorizado tiene al motorizado logueado
      res.json(req.body.sessionMotorizado);
    });
    router.get(
      "/me",
      AuthMotorizadoMiddleware.protect,
      motorizadoController.getMotorizadoMe
    );

    router.get("/", motorizadoController.findAllMotorizados);
    router.get("/:id", motorizadoController.findMotorizadoById);
    router.patch("/:id", motorizadoController.updateMotorizado);
    router.patch("/toggle-active/:id", motorizadoController.toggleActivo);
    router.delete("/:id", motorizadoController.deleteMotorizado);
    router.patch("/change-password/:id", motorizadoController.cambiarPassword);

    return router;
  }
}
