
import { Router } from "express";
import { FinancialController } from "../controller/financial.controller";
import { AuthMiddleware } from "../../middlewares/auth.middleware";
import { FinancialService } from "../../services/financial/financial.service";
import multer from "multer";

export class FinancialRoutes {
    static get routes(): Router {
        const router = Router();
        const service = new FinancialService();
        const controller = new FinancialController(service);

        const upload = multer();

        // Admin Auth
        router.use(AuthMiddleware.validateJWTAdmin);

        // ... existing routes ...
        router.get('/summary', controller.getSummary);
        router.get('/revenue-details', controller.getRevenueDetails);
        router.get('/shop-reconciliation', controller.getShopReconciliation);
        router.get('/driver-reconciliation', controller.getDriverReconciliation);

        // --- NEW ROUTE ---
        router.get('/movimientos-motorizados', controller.getMovimientosMotorizados);


        // Closings
        router.post('/close-day', controller.closeDay);
        router.get('/day-status', controller.getDayStatus);

        // Uploads
        router.post('/upload-statement', upload.single('file'), controller.uploadBankStatement);
        router.post('/upload-shop-receipt', upload.single('file'), controller.uploadShopReceipt);

        // Shop Specific
        router.get('/shop-details/:shopId', controller.getShopClosingDetails);
        router.post('/close-shop-day', controller.closeShopDay);

        // Pending Closings
        router.get('/pending-shop-closings', controller.getPendingShopClosings);

        return router;
    }
}
