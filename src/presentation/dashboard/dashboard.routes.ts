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
        router.get("/stats", controller.getStats);

        return router;
    }
}
