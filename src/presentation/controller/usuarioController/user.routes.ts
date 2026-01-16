// src/presentation/user/user.routes.ts
import { Router } from "express";
import { UserController } from "./user.controller";
import { UserService } from "../../services/usuario/user.service";
import dotenv from "dotenv";
import { EmailService } from "../../services/email.service";
import { envs, uploadSingleFile } from "../../../config";
import { AuthMiddleware } from "../../../middlewares/auth.middleware";
import { UserRole } from "../../../data";
import { AuthAdminMiddleware } from "../../../middlewares";

dotenv.config();
export class UserRoutes {
  static get routes(): Router {
    const router = Router();
    const emailService = new EmailService(
      envs.MAILER_SERVICE,
      envs.MAILER_EMAIL,
      envs.MAILER_SECRET_KEY,
      envs.SEND_EMAIL
    );
    const userService = new UserService(emailService);
    const userController = new UserController(userService);

    // // router.get("/profile", AuthMiddleware.protect, userController.getProfile);
    // // router.patch(
    // //   "/block-account/:id",
    // //   AuthMiddleware.protect,
    // //   AuthMiddleware.restrictTo(UserRole.ADMIN),
    // //   userController.blockAccount
    // // );
    // // router.get(
    // //   "/full-profile",
    // //   AuthMiddleware.protect,
    // //   userController.getFullProfile
    // // );
    // // router.get("/me", AuthMiddleware.protect, userController.getLoggedUserInfo);

    // // //USUARIO
    // // //PUBLICO
    // // router.post("/login", userController.login);
    // // router.post(
    // //   "/register",
    // //   uploadSingleFile("photoperfil"),
    // //   userController.createUser
    // // );
    // // router.get("/validate-email/:token", userController.validateAccount);
    // // router.post("/forgot-password", userController.forgotPassword);
    // // router.post("/reset-password", userController.resetPassword);
    // // //PROTEGIDO

    // // //ADMINISTRADOR
    // // //PROTEGIDO

    // // //Listar todos los usuarios
    // // router.get("/", AuthAdminMiddleware.protect, userController.findAllUsers);

    // // //Buscar usuarios por campos (query)
    // // router.get(
    // //   "/search",
    // //   AuthAdminMiddleware.protect,
    // //   userController.searchUsersByFields
    // // );

    // // // Filtrar usuarios por estado
    // // router.post(
    // //   "/filter-status",
    // //   AuthAdminMiddleware.protect,
    // //   userController.filterUsersByStatus
    // // );

    // // // Obtener perfil completo por ID
    // // router.get(
    // //   "/full-profile/:id",
    // //   AuthAdminMiddleware.protect,
    // //   userController.getFullUserProfile
    // // );

    // // //Actualizar usuario desde Admin
    // // router.patch(
    // //   "/admin/:id",
    // //   AuthMiddleware.protect,
    // //   AuthMiddleware.restrictTo(UserRole.ADMIN),
    // //   uploadSingleFile("photoperfil"),
    // //   userController.updateUserFromAdmin
    // // );

    // // //Cambiar estado del usuario
    // // router.patch(
    // //   "/change-status/:id",
    // //   AuthMiddleware.protect,
    // //   AuthMiddleware.restrictTo(UserRole.ADMIN),
    // //   userController.changeUserStatus
    // // );

    // // //Restaurar usuario eliminado
    // // router.patch(
    // //   "/restore/:id",
    // //   AuthMiddleware.protect,
    // //   AuthMiddleware.restrictTo(UserRole.ADMIN),
    // //   userController.restoreDeletedUser
    // // );

    // // //Estadísticas del usuario
    // // router.get(
    // //   "/stats/:id",
    // //   AuthAdminMiddleware.protect,
    // //   userController.getUserStats
    // // );

    // // //Exportar usuarios a CSV
    // // router.get(
    // //   "/export-users",
    // //   AuthMiddleware.protect,
    // //   AuthMiddleware.restrictTo(UserRole.ADMIN),
    // //   userController.exportUsersToCSV
    // // );

    // // //Enviar notificación a usuario
    // // router.post(
    // //   "/notify/:id",
    // //   AuthMiddleware.protect,
    // //   AuthMiddleware.restrictTo(UserRole.ADMIN),
    // //   userController.sendNotificationToUser
    // // );

    // // router.get("/:id", userController.findOneUser);
    // // router.delete("/:id", userController.deleteUser);
    // // router.patch(
    // //   "/:id",
    // //   AuthMiddleware.protect,
    // //   uploadSingleFile("photoperfil"),
    // //   userController.updateUser
    // // );

    router.get("/profile", AuthMiddleware.protect, userController.getProfile);
    router.patch(
      "/block-account/:id",
      AuthMiddleware.protect,
      AuthMiddleware.restrictTo(UserRole.ADMIN),
      userController.blockAccount
    );
    router.get(
      "/full-profile",
      AuthMiddleware.protect,
      userController.getFullProfile
    );
    router.get("/me", AuthMiddleware.protect, userController.getLoggedUserInfo);
    router.post("/logout", AuthMiddleware.protect, userController.logout);

    //USUARIO
    //PUBLICO
    router.post("/login", userController.login);
    router.post("/google-login", userController.loginGoogle);
    router.post(
      "/register",
      uploadSingleFile("photoperfil"),
      userController.createUser
    );
    router.get("/validate-email/:token", userController.validateAccount);
    router.post("/forgot-password", userController.forgotPassword);
    router.post("/reset-password", userController.resetPassword);
    //PROTEGIDO

    //ADMINISTRADOR
    //PROTEGIDO

    //Listar todos los usuarios
    router.get("/", AuthAdminMiddleware.protect, userController.findAllUsers);

    //Buscar usuarios por campos (query)
    router.get(
      "/search",
      AuthAdminMiddleware.protect,
      userController.searchUsersByFields
    );

    // Filtrar usuarios por estado
    router.post(
      "/filter-status",
      AuthAdminMiddleware.protect,
      userController.filterUsersByStatus
    );

    // Obtener perfil completo por ID
    router.get(
      "/full-profile/:id",
      AuthAdminMiddleware.protect,
      userController.getFullUserProfile
    );

    //Actualizar usuario desde Admin
    router.patch(
      "/admin/:id",
      AuthAdminMiddleware.protect,
      uploadSingleFile("photoperfil"),
      userController.updateUserFromAdmin
    );

    //Cambiar estado del usuario
    router.patch(
      "/change-status/",
      AuthAdminMiddleware.protect,
      userController.changeUserStatus
    );

    //Exportar usuarios a CSV
    router.get(
      "/export-users",
      AuthAdminMiddleware.protect,
      userController.exportUsersToCSV
    );

    //Enviar notificación a usuario
    router.post(
      "/notify",
      AuthAdminMiddleware.protect,
      userController.sendNotificationToUser
    );

    router.post(
      "/notify/all",
      AuthAdminMiddleware.protect,
      userController.sendNotificationToAllUsers
    );

    router.get("/:id", userController.findOneUser);
    router.delete("/:id", userController.deleteUser);
    router.patch(
      "/:id",
      AuthMiddleware.protect,
      uploadSingleFile("photoperfil"),
      userController.updateUser
    );
    router.get(
      "/admin/metrics/active",
      AuthAdminMiddleware.protect,
      userController.countActiveUsers
    );

    router.get(
      "/admin/metrics/registered/last24h",
      AuthAdminMiddleware.protect,
      userController.countUsersRegisteredLast24h
    );
    return router;
  }
}
