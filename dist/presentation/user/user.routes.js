"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRoutes = void 0;
// src/presentation/user/user.routes.ts
const express_1 = require("express");
const user_controller_1 = require("../user/user.controller");
const user_service_1 = require("../services/user.service");
const dotenv_1 = __importDefault(require("dotenv"));
const email_service_1 = require("../services/email.service");
const config_1 = require("../../config");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const data_1 = require("../../data");
dotenv_1.default.config();
// // Configuración de multer con S3
// const storage = multerS3({
//   s3,
//   bucket: process.env.AWS_BUCKET_NAME!,
//   metadata: (req, file, cb) => {
//     cb(null, { fieldName: file.fieldname });
//   },
//   key: (req, file, cb) => {
//     cb(null, `uploads/${Date.now()}-${file.originalname}`);
//   },
// });
// const upload = multer({
//   storage,
//   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = ['image/jpeg', 'image/png'];
//     if (!allowedTypes.includes(file.mimetype)) {
//       return cb(new Error('Tipo de archivo no permitido') as any, false);
//     }
//     cb(null, true);
//   },
// });
class UserRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const emailService = new email_service_1.EmailService(config_1.envs.MAILER_SERVICE, config_1.envs.MAILER_EMAIL, config_1.envs.MAILER_SECRET_KEY, config_1.envs.SEND_EMAIL);
        const userService = new user_service_1.UserService(emailService);
        const userController = new user_controller_1.UserController(userService);
        router.get("/profile", auth_middleware_1.AuthMiddleware.protect, userController.getProfile);
        router.patch("/block-account/:id", auth_middleware_1.AuthMiddleware.protect, auth_middleware_1.AuthMiddleware.restrictTo(data_1.UserRole.ADMIN), userController.blockAccount);
        router.post("/register", (0, config_1.uploadSingleFile)("photoperfil"), userController.createUser);
        router.get("/", userController.findAllUsers);
        router.get("/:id", userController.findOneUser);
        router.patch("/:id", userController.updateUser);
        router.delete("/:id", userController.deleteUser);
        router.post("/login", userController.login);
        router.get("/validate-email/:token", userController.validateAccount);
        return router;
    }
}
exports.UserRoutes = UserRoutes;
