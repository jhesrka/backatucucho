import { Request, Response } from 'express';
import { FinancialService } from '../../services/financial/financial.service';
import { CustomError } from '../../../domain';
import { Useradmin } from '../../../data/postgres/models/useradmin.model';

export class FinancialController {
    constructor(private readonly financialService: FinancialService) { }

    private handleError = (error: unknown, res: Response) => {
        if (error instanceof CustomError) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    };

    getSummary = async (req: Request, res: Response) => {
        try {
            const { startDate, endDate } = req.query; // Changed to query for GET requests consistency
            if (!startDate || !endDate) {
                // Try body fallback if not in query
                if (req.body.startDate && req.body.endDate) {
                    const { startDate, endDate } = req.body;
                    const summary = await this.financialService.getFinancialSummary(new Date(startDate), new Date(endDate));
                    return res.json(summary);
                }
                throw CustomError.badRequest("Fechas requeridas");
            }

            const summary = await this.financialService.getFinancialSummary(new Date(startDate as string), new Date(endDate as string));
            res.json(summary);
        } catch (error) {
            this.handleError(error, res);
        }
    };

    getShopReconciliation = async (req: Request, res: Response) => {
        try {
            const { startDate, endDate } = req.query;
            const start = startDate ? new Date(startDate as string) : new Date();
            const end = endDate ? new Date(endDate as string) : new Date();

            const shops = await this.financialService.getShopReconciliation(start, end);
            res.json(shops);
        } catch (error) {
            this.handleError(error, res);
        }
    };

    getDriverReconciliation = async (req: Request, res: Response) => {
        try {
            // Supports both query (standard) and body (legacy)
            const startDate = req.query.startDate || req.body.startDate;
            const endDate = req.query.endDate || req.body.endDate;

            if (!startDate || !endDate) throw CustomError.badRequest("Start and End Date required");

            const drivers = await this.financialService.getDriverReconciliation(new Date(startDate as string), new Date(endDate as string));
            res.json(drivers);
        } catch (error) {
            this.handleError(error, res);
        }
    };

    // --- NEW METHOD ---
    getMovimientosMotorizados = async (req: Request, res: Response) => {
        try {
            const { fechaInicio, fechaFin } = req.query;
            if (!fechaInicio) throw CustomError.badRequest("Fecha inicio requerida");

            // If fechaFin is missing, default to fechaInicio (single day)
            const start = new Date(fechaInicio as string);
            const end = fechaFin ? new Date(fechaFin as string) : new Date(fechaInicio as string);

            const result = await this.financialService.getMovimientosMotorizados(start, end);
            res.json(result);
        } catch (error) {
            this.handleError(error, res);
        }
    };

    getShopClosingDetails = async (req: Request, res: Response) => {
        try {
            // Check body first (POST), then query/params as fallback if needed, but primarily body for this route.
            const shopId = req.body.shopId || req.params.shopId || req.query.shopId;
            const date = req.body.date || req.query.date;

            if (!shopId || !date) throw CustomError.badRequest("Shop ID and Date required");
            const details = await this.financialService.getShopClosingDetails(shopId, new Date(date as string));
            res.json(details);
        } catch (error) {
            this.handleError(error, res);
        }
    }

    closeShopDay = async (req: Request, res: Response) => {
        try {
            const { shopId, date, sessionAdmin, comprobanteUrl } = req.body;
            if (!shopId || !date) throw CustomError.badRequest("Shop ID and Date required");
            const result = await this.financialService.closeShopDay(shopId, new Date(date), sessionAdmin as Useradmin, comprobanteUrl);
            res.json(result);
        } catch (error) {
            this.handleError(error, res);
        }
    }

    uploadShopReceipt = async (req: Request, res: Response) => {
        try {
            const { shopId, date } = req.body;
            // Validar que file exista
            if (!req.file) throw CustomError.badRequest("File required");

            const result = await this.financialService.uploadShopClosingReceipt(shopId, date, req.file as Express.Multer.File);
            res.json(result);
        } catch (error) {
            this.handleError(error, res);
        }
    }

    getAppRevenueDetails = async (req: Request, res: Response) => {
        try {
            const { date, type, page = 1, limit = 20 } = req.query;
            if (!date || !type) throw CustomError.badRequest("Date and Type are required");

            const result = await this.financialService.getAppRevenueDetails(
                new Date(date as string),
                type as string,
                Number(page),
                Number(limit)
            );
            res.json(result);
        } catch (error) {
            this.handleError(error, res);
        }
    };

    // DAILY CLOSING //
    uploadBankStatement = async (req: Request, res: Response) => {
        try {
            const result = await this.financialService.uploadBankStatement(req.file as Express.Multer.File);
            res.json(result);
        } catch (error) {
            this.handleError(error, res);
        }
    };

    getDayStatus = async (req: Request, res: Response) => {
        try {
            const { date } = req.query;
            if (!date) throw CustomError.badRequest("Date query param required");
            const result = await this.financialService.getDayStatus(new Date(date as string));
            res.json(result);
        } catch (error) {
            this.handleError(error, res);
        }
    };


    getPendingShopClosings = async (req: Request, res: Response) => {
        try {
            const result = await this.financialService.getPendingShopClosings();
            res.json(result);
        } catch (error) {
            this.handleError(error, res);
        }
    }

    closeDay = async (req: Request, res: Response) => {
        try {
            const { date, statementUrl, sessionAdmin } = req.body; // sessionAdmin via Auth Middleware
            if (!date || !statementUrl) throw CustomError.badRequest("Fecha y URL de archivo requeridos");

            const result = await this.financialService.closeDay(new Date(date), statementUrl, sessionAdmin);
            res.json(result);
        } catch (error) {
            this.handleError(error, res);
        }
    };
}
