import { Router } from "express";
import multer from "multer";
import { UseradminService } from "../../../services";
import { AuthAdminMiddleware } from "../../../../middlewares";
import { UseradminController } from "./useradmin.controller";

export class UseradminRoutes {
  static get routes(): Router {
    const router = Router();
    const useradminService = new UseradminService();
    const useradminController = new UseradminController(useradminService);

    const upload = multer(); // Inicializamos multer

    //ADMINISTRADOR
    router.post(
      "/register",
      upload.none(),
      AuthAdminMiddleware.protect,
      useradminController.createUseradmin
    );

    router.post(
      "/validate-pin",
      AuthAdminMiddleware.protect,
      useradminController.validateMasterPin
    );

    router.post("/loginadmin", useradminController.loginAdmin);
    router.post("/forgot-password", useradminController.forgotPassword);
    router.post("/reset-password", useradminController.resetPassword);

    router.patch(
      "/update-password",
      AuthAdminMiddleware.protect,
      useradminController.updatePassword
    );
    router.patch(
      "/update-security-pin",
      AuthAdminMiddleware.protect,
      useradminController.updateSecurityPin
    );

    // Buscar todos los usuarios administrativos
    router.get("/", useradminController.findAllUsersadmin);


    return router;
  }
}
