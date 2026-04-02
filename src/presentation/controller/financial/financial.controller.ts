import { Request, Response } from 'express';
import { FinancialService } from '../../services/financial/financial.service';
import { CustomError } from '../../../domain';
import { Useradmin } from '../../../data/postgres/models/useradmin.model';
import { DateUtils } from '../../../utils/date-utils';

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
            const startDate = req.query.startDate || req.body.startDate;
            const endDate = req.query.endDate || req.body.endDate;

            if (!startDate || !endDate) {
                throw CustomError.badRequest("Fechas requeridas");
            }

            const summary = await this.financialService.getFinancialSummary(
                DateUtils.parseLocalDate(startDate as string), 
                DateUtils.parseLocalDate(endDate as string)
            );
            res.json(summary);
        } catch (error) {
            this.handleError(error, res);
        }
    };

    getShopReconciliation = async (req: Request, res: Response) => {
        try {
            const startDate = req.query.startDate || req.body.startDate;
            const endDate = req.query.endDate || req.body.endDate;

            const start = startDate ? DateUtils.parseLocalDate(startDate as string) : new Date();
            const end = endDate ? DateUtils.parseLocalDate(endDate as string) : new Date();

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

            const drivers = await this.financialService.getDriverReconciliation(DateUtils.parseLocalDate(startDate as string), DateUtils.parseLocalDate(endDate as string));
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
            const start = DateUtils.parseLocalDate(fechaInicio as string);
            const end = fechaFin ? DateUtils.parseLocalDate(fechaFin as string) : DateUtils.parseLocalDate(fechaInicio as string);

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
            const details = await this.financialService.getShopClosingDetails(shopId, DateUtils.parseLocalDate(date as string));
            res.json(details);
        } catch (error) {
            this.handleError(error, res);
        }
    }

    closeShopDay = async (req: Request, res: Response) => {
        try {
            const { shopId, date, sessionAdmin, comprobanteUrl } = req.body;
            if (!shopId || !date) throw CustomError.badRequest("Shop ID and Date required");
            const result = await this.financialService.closeShopDay(shopId, DateUtils.parseLocalDate(date), sessionAdmin as Useradmin, comprobanteUrl);
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
                DateUtils.parseLocalDate(date as string),
                type as string,
                Number(page),
                Number(limit)
            );
            res.json(result);
        } catch (error) {
            this.handleError(error, res);
        }
    };

    getUnifiedTransactions = async (req: Request, res: Response) => {
        try {
            const { date, type, status } = req.query;
            if (!date) throw CustomError.badRequest("Date required");

            const types = typeof type === 'string' ? type.split(',') : (Array.isArray(type) ? type as string[] : undefined);
            const statuses = typeof status === 'string' ? status.split(',') : (Array.isArray(status) ? status as string[] : undefined);

            const result = await this.financialService.getUnifiedTransactions(
                DateUtils.parseLocalDate(date as string),
                types,
                statuses
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
            const result = await this.financialService.getDayStatus(DateUtils.parseLocalDate(date as string));
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

            const result = await this.financialService.closeDay(DateUtils.parseLocalDate(date), statementUrl, sessionAdmin);
            res.json(result);
        } catch (error) {
            this.handleError(error, res);
        }
    };
} 

