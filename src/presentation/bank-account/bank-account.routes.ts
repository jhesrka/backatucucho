import { Router } from "express";
import { BankAccountService } from "../services/bank-account.service";
import { BankAccountController } from "./bank-account.controller";
import { AuthAdminMiddleware } from "../../middlewares";
import { UseradminService } from "../services/administradorService/useradmin.service";

export class BankAccountRoutes {
    static get routes(): Router {
        const router = Router();
        const service = new BankAccountService();
        const userAdminService = new UseradminService();
        const controller = new BankAccountController(service, userAdminService);

        // Public/User (GET)
        router.get("/", controller.findAll);

        // Admin constrained (POST, PATCH, DELETE)
        router.post("/", AuthAdminMiddleware.protect, controller.create);
        router.patch("/:id", AuthAdminMiddleware.protect, controller.update);
        router.delete("/:id", AuthAdminMiddleware.protect, controller.delete);

        return router;
    }
}
