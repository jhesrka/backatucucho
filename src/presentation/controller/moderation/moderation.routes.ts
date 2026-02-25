import { Router } from "express";
import { AuthMiddleware, AuthAdminMiddleware } from "../../../middlewares";
import { ModerationController } from "./moderation.controller";
import { AdminModerationService } from "../../services/admin-moderation.service";
import { PostReportService } from "../../services/post-report.service";
import { ModerationLogService } from "../../services/moderation-log.service";

export class ModerationRoutes {
    static get routes(): Router {
        const router = Router();

        const logService = new ModerationLogService();
        const adminService = new AdminModerationService(logService);
        const reportService = new PostReportService();

        const controller = new ModerationController(adminService, reportService, logService);

        // Public/User Routes
        router.post("/report", [AuthMiddleware.protect], controller.reportPost);
        router.post("/report/storie", [AuthMiddleware.protect], controller.reportStorie);

        // Admin Routes
        router.post("/admin/block", [AuthAdminMiddleware.protect], controller.blockPost);
        router.post("/admin/restore", [AuthAdminMiddleware.protect], controller.restorePost);
        router.post("/admin/storie/block", [AuthAdminMiddleware.protect], controller.blockStorie);
        router.post("/admin/storie/restore", [AuthAdminMiddleware.protect], controller.restoreStorie);
        router.post("/admin/user-status", [AuthAdminMiddleware.protect], controller.changeUserStatus);
        router.get("/admin/logs", [AuthAdminMiddleware.protect], controller.getLogs);
        router.get("/admin/reports", [AuthAdminMiddleware.protect], controller.getAllReports);
        router.get("/admin/storie/reports", [AuthAdminMiddleware.protect], controller.getAllStorieReports);

        return router;
    }
}
