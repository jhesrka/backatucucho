import { Router } from "express";
import { BusinessController } from "./controller";
import { BusinessService } from "../services/business.service";
import { AuthMiddleware } from "../../middlewares/auth.middleware";

export class BusinessRoutes {
    static get routes(): Router {
        const router = Router();
        const service = new BusinessService();
        const controller = new BusinessController(service);

        router.post("/login", controller.login);

        // Rutas protegidas
        router.get("/my-businesses", [AuthMiddleware.protect], controller.getMyBusinesses);

        // Gestión de Pedidos
        router.get("/:businessId/orders", [AuthMiddleware.protect], controller.getOrders);
        router.patch("/:businessId/orders/:orderId/status", [AuthMiddleware.protect], controller.updateOrderStatus);


        // Reportes Financieros
        router.get("/:businessId/finance", [AuthMiddleware.protect], controller.getFinance);
        router.post("/:businessId/finance/payment", [AuthMiddleware.protect], controller.registerPayment);

        return router;
    }
}
