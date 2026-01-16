"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UseradminRoutes = void 0;
const express_1 = require("express");
const useradmin_controller_1 = require("./useradmin.controller");
const useradmin_service_1 = require("../services/useradmin.service");
class UseradminRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const useradminService = new useradmin_service_1.UseradminService();
        const useradminController = new useradmin_controller_1.UseradminController(useradminService);
        //crear usuarios administrativos
        router.post("/register", useradminController.createUseradmin);
        //buscar todos los usuarios administrativos
        router.get("/", useradminController.findAllUsersadmin);
        return router;
    }
}
exports.UseradminRoutes = UseradminRoutes;
