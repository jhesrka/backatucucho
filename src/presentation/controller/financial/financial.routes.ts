
import { Router } from 'express';
import { FinancialController } from './financial.controller';
import { FinancialService } from '../../services/financial/financial.service';
import { AuthAdminMiddleware } from '../../../middlewares';
import { uploadSingleFile } from '../../../config';

export class FinancialRoutes {
    static get routes(): Router {
        const router = Router();
        const service = new FinancialService();
        const controller = new FinancialController(service);

        // Using POST for date ranges in body to avoid query string complexity, though GET with query params is standard.
        // User requested structure is implied to be simple.

        router.post('/summary', [AuthAdminMiddleware.protect], controller.getSummary);
        router.post('/shops', [AuthAdminMiddleware.protect], controller.getShopReconciliation);
        router.post('/drivers', [AuthAdminMiddleware.protect], controller.getDriverReconciliation);
        router.post('/shop-details', [AuthAdminMiddleware.protect], controller.getShopDetails);
        router.post('/close-shop-day', [AuthAdminMiddleware.protect], controller.closeShopDay);
        router.post('/upload-shop-receipt', [AuthAdminMiddleware.protect, uploadSingleFile('file')], controller.uploadShopClosingReceipt);

        // Daily Closing
        router.post('/upload-statement', [AuthAdminMiddleware.protect, uploadSingleFile('file')], controller.uploadBankStatement);
        router.get('/day-status', AuthAdminMiddleware.protect, controller.getDayStatus);
        router.post('/close-day', AuthAdminMiddleware.protect, controller.closeDay);

        // Detailed Revenue (Auditable)
        router.get('/revenue-details', AuthAdminMiddleware.protect, controller.getAppRevenueDetails);

        return router;
    }
}
