"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UseradminRoutes = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const services_1 = require("../../../services");
const middlewares_1 = require("../../../../middlewares");
const useradmin_controller_1 = require("./useradmin.controller");
class UseradminRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const useradminService = new services_1.UseradminService();
        const useradminController = new useradmin_controller_1.UseradminController(useradminService);
        const upload = (0, multer_1.default)(); // Inicializamos multer
        //ADMINISTRADOR
        router.post("/register", upload.none(), middlewares_1.AuthAdminMiddleware.protect, useradminController.createUseradmin);
        router.post("/validate-pin", middlewares_1.AuthAdminMiddleware.protect, useradminController.validateMasterPin);
        router.post("/loginadmin", useradminController.loginAdmin);
        router.post("/forgot-password", useradminController.forgotPassword);
        router.post("/reset-password", useradminController.resetPassword);
        router.patch("/update-password", middlewares_1.AuthAdminMiddleware.protect, useradminController.updatePassword);
        router.patch("/update-security-pin", middlewares_1.AuthAdminMiddleware.protect, useradminController.updateSecurityPin);
        // Buscar todos los usuarios administrativos
        router.get("/", useradminController.findAllUsersadmin);
        return router;
    }
}
exports.UseradminRoutes = UseradminRoutes;
