"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardRoutes = void 0;
const express_1 = require("express");
const dashboard_controller_1 = require("./dashboard.controller");
const dashboard_service_1 = require("../services/dashboard.service");
// import { AuthMiddleware } from "../../middlewares/auth.middleware"; // Uncomment if auth is needed
class DashboardRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const service = new dashboard_service_1.DashboardService();
        const controller = new dashboard_controller_1.DashboardController(service);
        // Definir la ruta, por ejemplo: /api/dashboard/stats
        // router.use(AuthMiddleware.protect); // Protegemos todas las rutas
        // router.use(AuthMiddleware.protect); // Protegemos todas las rutas
        router.get("/stats", controller.getStats);
        // 👇 Nuevo endpoint para gráfico de barras
        router.get("/estadisticas/publicaciones-7dias", controller.getWeeklyPostStats);
        // 👇 Nuevo endpoint para estadísticas avanzadas (8 gráficos)
        router.get("/estadisticas/avanzadas-7dias", controller.getAdvancedStats7Days);
        // 👇 Nuevo Dashboard Operativo Diario (Tiempo Real)
        router.get("/dashboard-operativo-hoy", controller.getOperationalDashboardToday);
        return router;
    }
}
exports.DashboardRoutes = DashboardRoutes;
