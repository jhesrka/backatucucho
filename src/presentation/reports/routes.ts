
import { Router } from "express";
import { AdminReportController } from "./controller";
import { AdminReportService } from "../services/report/admin-report.service";
import { AuthAdminMiddleware } from "../../middlewares/auth-admin.middleware";

export class AdminReportRoutes {
    static get routes(): Router {
        const router = Router();
        const service = new AdminReportService();
        const controller = new AdminReportController(service);

        // Apply middlewares to protect all admin routes
        router.use(AuthAdminMiddleware.protect);

        // Define routes
        router.get("/", controller.getAggregatedReports);
        router.get("/stats", controller.getStatistics);
        router.delete("/purge", controller.purgeOldReports);
        router.get("/:type/:id", controller.getReportDetails);
        router.get("/pending-count", controller.getGlobalPendingCount);

        // Resolve report (Hide, Delete, Restore)
        router.post("/:type/:id/resolve", controller.resolveReport);

        return router;
    }
}
