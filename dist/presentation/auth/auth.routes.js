"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRoutes = void 0;
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_service_1 = require("./auth.service");
class AuthRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const service = new auth_service_1.AuthService();
        const controller = new auth_controller_1.AuthController(service);
        router.post("/refresh", controller.refreshToken);
        return router;
    }
}
exports.AuthRoutes = AuthRoutes;
