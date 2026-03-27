import { Router } from "express";
import { ActivityController } from "./activity.controller";
import { ActivityService } from "../services/activity.service";
import { AuthMiddleware } from "../../middlewares/auth.middleware";

export class ActivityRoutes {
    static get routes(): Router {
        const router = Router();
        const service = new ActivityService();
        const controller = new ActivityController(service);

        // Ping User Activity (Protected)
        router.post("/ping", [AuthMiddleware.protect], controller.ping);

        return router;
    }
}
