"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinancialController = void 0;
const domain_1 = require("../../../domain");
class FinancialController {
    constructor(financialService) {
        this.financialService = financialService;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ error: error.message });
            }
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        };
        this.getSummary = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { startDate, endDate } = req.body;
                if (!startDate || !endDate)
                    throw domain_1.CustomError.badRequest("Fechas requeridas");
                const summary = yield this.financialService.getFinancialSummary(new Date(startDate), new Date(endDate));
                res.json(summary);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.getShopReconciliation = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { startDate, endDate } = req.body;
                const shops = yield this.financialService.getShopReconciliation(new Date(startDate), new Date(endDate));
                res.json(shops);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.getDriverReconciliation = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { startDate, endDate } = req.body;
                const drivers = yield this.financialService.getDriverReconciliation(new Date(startDate), new Date(endDate));
                res.json(drivers);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.getShopDetails = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { shopId, startDate, endDate } = req.body;
                if (!shopId)
                    throw domain_1.CustomError.badRequest("Shop ID required");
                const details = yield this.financialService.getShopDetails(shopId, new Date(startDate), new Date(endDate));
                res.json(details);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.getAppRevenueDetails = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { date, type, page = 1, limit = 20 } = req.query;
                if (!date || !type)
                    throw domain_1.CustomError.badRequest("Date and Type are required");
                const result = yield this.financialService.getAppRevenueDetails(new Date(date), type, Number(page), Number(limit));
                res.json(result);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        // DAILY CLOSING //
        this.uploadBankStatement = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.financialService.uploadBankStatement(req.file);
                res.json(result);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.getDayStatus = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { date } = req.query;
                if (!date)
                    throw domain_1.CustomError.badRequest("Date query param required");
                const result = yield this.financialService.getDayStatus(new Date(date));
                res.json(result);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.closeDay = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { date, statementUrl, sessionAdmin } = req.body; // sessionAdmin via Auth Middleware
                if (!date || !statementUrl)
                    throw domain_1.CustomError.badRequest("Fecha y URL de archivo requeridos");
                const result = yield this.financialService.closeDay(new Date(date), statementUrl, sessionAdmin);
                res.json(result);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
    }
}
exports.FinancialController = FinancialController;
