import { Router } from "express";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "../services/dashboard.service";
// import { AuthMiddleware } from "../../middlewares/auth.middleware"; // Uncomment if auth is needed

export class DashboardRoutes {
    static get routes(): Router {
        const router = Router();
        const service = new DashboardService();
        const controller = new DashboardController(service);

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
