import { Router } from "express";
import { BusinessController } from "./controller";
import { BusinessService } from "../services/business.service";
import { AuthMiddleware } from "../../middlewares/auth.middleware";
import { uploadSingleFile } from "../../config";

export class BusinessRoutes {
    static get routes(): Router {
        const router = Router();
        const service = new BusinessService();
        const controller = new BusinessController(service);

        router.post("/login", controller.login);

        // Rutas protegidas
        router.get("/my-businesses", [AuthMiddleware.protect], controller.getMyBusinesses);
        router.patch("/:businessId/settings", [AuthMiddleware.protect], controller.updateSettings);

        // Gestión de Pedidos
        router.get("/:businessId/orders", [AuthMiddleware.protect], controller.getOrders);
        router.patch("/:businessId/orders/:orderId/status", [AuthMiddleware.protect], controller.updateOrderStatus);
        router.post("/:businessId/orders/:orderId/verify-pickup", [AuthMiddleware.protect], controller.verifyPickupCode);
        router.patch("/:businessId/orders/:orderId/confirm-transfer-cancellation", [AuthMiddleware.protect], controller.confirmTransferCancellation);

        // Reportes Financieros
        router.get("/:businessId/finance", [AuthMiddleware.protect], controller.getFinance);
        router.get("/:businessId/unclosed-days", [AuthMiddleware.protect], controller.getUnclosedDays);
        router.post("/:businessId/finance/payment", [AuthMiddleware.protect, uploadSingleFile('file')], controller.registerPayment);
        router.post("/:businessId/finance/close-day", [AuthMiddleware.protect], controller.closeDay);

        return router;
    }
}
