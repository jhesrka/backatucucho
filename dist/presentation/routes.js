"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppRoutes = void 0;
const express_1 = require("express");
const router_1 = require("./post/router");
const user_routes_1 = require("./user/user.routes");
const useradmin_routes_1 = require("./useradmin/useradmin.routes");
class AppRoutes {
    //cuando hay metodoos estaticos no necesitams instanciar
    static get routes() {
        const router = (0, express_1.Router)();
        router.use(("/api/post"), router_1.PostRoutes.routes);
        router.use("/api/user", user_routes_1.UserRoutes.routes);
        router.use("/api/useradmin", useradmin_routes_1.UseradminRoutes.routes);
        return router;
    }
}
exports.AppRoutes = AppRoutes;
