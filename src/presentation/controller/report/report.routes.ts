import { Router } from "express";
import { ReportController } from "./report.controller";
import { ReportService } from "../../services/report/report.service";
import { AuthMiddleware, AuthAdminMiddleware } from "../../../middlewares";

export class ReportRoutes {
    static get routes(): Router {
        const router = Router();
        const service = new ReportService();
        const controller = new ReportController(service);

        router.post("/", AuthMiddleware.protect, controller.createReport);

        // Admin routes
        router.get("/", AuthAdminMiddleware.protect, controller.getAllReports);
        router.patch("/:id", AuthAdminMiddleware.protect, controller.updateStatus);

        return router;
    }
}
