import { Router } from "express";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

export class AuthRoutes {
    static get routes(): Router {
        const router = Router();
        const service = new AuthService();
        const controller = new AuthController(service);

        router.post("/refresh", controller.refreshToken);

        return router;
    }
}
