"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRoutes = void 0;
// src/presentation/user/user.routes.ts
const express_1 = require("express");
const user_controller_1 = require("./user.controller");
const user_service_1 = require("../../services/usuario/user.service");
const dotenv_1 = __importDefault(require("dotenv"));
const email_service_1 = require("../../services/email.service");
const config_1 = require("../../../config");
const auth_middleware_1 = require("../../../middlewares/auth.middleware");
const data_1 = require("../../../data");
const middlewares_1 = require("../../../middlewares");
dotenv_1.default.config();
class UserRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const emailService = new email_service_1.EmailService(config_1.envs.MAILER_SERVICE, config_1.envs.MAILER_EMAIL, config_1.envs.MAILER_SECRET_KEY, config_1.envs.SEND_EMAIL);
        const userService = new user_service_1.UserService(emailService);
        const userController = new user_controller_1.UserController(userService);
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
        router.get("/profile", auth_middleware_1.AuthMiddleware.protect, userController.getProfile);
        router.patch("/block-account/:id", auth_middleware_1.AuthMiddleware.protect, auth_middleware_1.AuthMiddleware.restrictTo(data_1.UserRole.ADMIN), userController.blockAccount);
        router.get("/full-profile", auth_middleware_1.AuthMiddleware.protect, userController.getFullProfile);
        router.get("/me", auth_middleware_1.AuthMiddleware.protect, userController.getLoggedUserInfo);
        router.post("/logout", auth_middleware_1.AuthMiddleware.protect, userController.logout);
        router.patch("/complete-profile", auth_middleware_1.AuthMiddleware.protect, userController.completeProfile);
        //USUARIO
        //PUBLICO
        router.post("/login", userController.login);
        router.post("/google-login", userController.loginGoogle);
        router.post("/register", (0, config_1.uploadSingleFile)("photoperfil"), userController.createUser);
        router.get("/validate-email/:token", userController.validateAccount);
        router.post("/forgot-password", userController.forgotPassword);
        router.post("/reset-password", userController.resetPassword);
        router.post("/change-password", auth_middleware_1.AuthMiddleware.protect, userController.changePassword);
        //PROTEGIDO
        //ADMINISTRADOR
        //PROTEGIDO
        //Listar todos los usuarios
        router.get("/", middlewares_1.AuthAdminMiddleware.protect, userController.findAllUsers);
        //Buscar usuarios por campos (query)
        router.get("/search", middlewares_1.AuthAdminMiddleware.protect, userController.searchUsersByFields);
        // Filtrar usuarios por estado
        router.post("/filter-status", middlewares_1.AuthAdminMiddleware.protect, userController.filterUsersByStatus);
        // Obtener perfil completo por ID
        router.get("/full-profile/:id", middlewares_1.AuthAdminMiddleware.protect, userController.getFullUserProfile);
        //Actualizar usuario desde Admin
        router.patch("/admin/:id", middlewares_1.AuthAdminMiddleware.protect, (0, config_1.uploadSingleFile)("photoperfil"), userController.updateUserFromAdmin);
        //Cambiar estado del usuario
        router.patch("/change-status/", middlewares_1.AuthAdminMiddleware.protect, userController.changeUserStatus);
        //Exportar usuarios a CSV
        router.get("/export-users", middlewares_1.AuthAdminMiddleware.protect, userController.exportUsersToCSV);
        //Enviar notificación a usuario
        router.post("/notify", middlewares_1.AuthAdminMiddleware.protect, userController.sendNotificationToUser);
        router.post("/notify/all", middlewares_1.AuthAdminMiddleware.protect, userController.sendNotificationToAllUsers);
        router.get("/:id", userController.findOneUser);
        router.delete("/:id", userController.deleteUser);
        router.patch("/:id", auth_middleware_1.AuthMiddleware.protect, (0, config_1.uploadSingleFile)("photoperfil"), userController.updateUser);
        router.get("/admin/metrics/active", middlewares_1.AuthAdminMiddleware.protect, userController.countActiveUsers);
        router.delete("/admin/purge/:id", middlewares_1.AuthAdminMiddleware.protect, userController.purgeUser);
        router.get("/admin/metrics/registered/last24h", middlewares_1.AuthAdminMiddleware.protect, userController.countUsersRegisteredLast24h);
        // NUEVO: Gestión Avanzada de Usuarios (Admin)
        router.patch("/admin/manage/:id", middlewares_1.AuthAdminMiddleware.protect, userController.updateUserAdminAction);
        router.post("/admin/force-logout/:id", middlewares_1.AuthAdminMiddleware.protect, userController.forceLogoutAdminAction);
        router.post("/admin/reset-password-email/:id", middlewares_1.AuthAdminMiddleware.protect, userController.sendPasswordResetAdminAction);
        router.delete("/admin/purge-hard/:id", middlewares_1.AuthAdminMiddleware.protect, userController.purgeUserAdminAction);
        return router;
    }
}
exports.UserRoutes = UserRoutes;
