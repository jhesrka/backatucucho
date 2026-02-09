
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
            const { startDate, endDate } = req.body;
            if (!startDate || !endDate) throw CustomError.badRequest("Fechas requeridas");

            const summary = await this.financialService.getFinancialSummary(new Date(startDate), new Date(endDate));
            res.json(summary);
        } catch (error) {
            this.handleError(error, res);
        }
    };

    getShopReconciliation = async (req: Request, res: Response) => {
        try {
            const { startDate, endDate } = req.body;
            const shops = await this.financialService.getShopReconciliation(new Date(startDate), new Date(endDate));
            res.json(shops);
        } catch (error) {
            this.handleError(error, res);
        }
    };

    getDriverReconciliation = async (req: Request, res: Response) => {
        try {
            const { startDate, endDate } = req.body;
            const drivers = await this.financialService.getDriverReconciliation(new Date(startDate), new Date(endDate));
            res.json(drivers);
        } catch (error) {
            this.handleError(error, res);
        }
    };

    getShopDetails = async (req: Request, res: Response) => {
        try {
            const { shopId, date } = req.body;
            if (!shopId || !date) throw CustomError.badRequest("Shop ID and Date required");
            const details = await this.financialService.getShopClosingDetails(shopId, new Date(date));
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

    uploadShopClosingReceipt = async (req: Request, res: Response) => {
        try {
            const { shopId, date } = req.body;
            if (!shopId || !date) throw CustomError.badRequest("Shop ID and Date required");
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
