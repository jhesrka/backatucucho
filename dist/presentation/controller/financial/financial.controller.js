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
                const { startDate, endDate } = req.query; // Changed to query for GET requests consistency
                if (!startDate || !endDate) {
                    // Try body fallback if not in query
                    if (req.body.startDate && req.body.endDate) {
                        const { startDate, endDate } = req.body;
                        const summary = yield this.financialService.getFinancialSummary(new Date(startDate), new Date(endDate));
                        return res.json(summary);
                    }
                    throw domain_1.CustomError.badRequest("Fechas requeridas");
                }
                const summary = yield this.financialService.getFinancialSummary(new Date(startDate), new Date(endDate));
                res.json(summary);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.getShopReconciliation = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { startDate, endDate } = req.query;
                const start = startDate ? new Date(startDate) : new Date();
                const end = endDate ? new Date(endDate) : new Date();
                const shops = yield this.financialService.getShopReconciliation(start, end);
                res.json(shops);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.getDriverReconciliation = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                // Supports both query (standard) and body (legacy)
                const startDate = req.query.startDate || req.body.startDate;
                const endDate = req.query.endDate || req.body.endDate;
                if (!startDate || !endDate)
                    throw domain_1.CustomError.badRequest("Start and End Date required");
                const drivers = yield this.financialService.getDriverReconciliation(new Date(startDate), new Date(endDate));
                res.json(drivers);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        // --- NEW METHOD ---
        this.getMovimientosMotorizados = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { fechaInicio, fechaFin } = req.query;
                if (!fechaInicio)
                    throw domain_1.CustomError.badRequest("Fecha inicio requerida");
                // If fechaFin is missing, default to fechaInicio (single day)
                const start = new Date(fechaInicio);
                const end = fechaFin ? new Date(fechaFin) : new Date(fechaInicio);
                const result = yield this.financialService.getMovimientosMotorizados(start, end);
                res.json(result);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.getShopClosingDetails = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                // Check body first (POST), then query/params as fallback if needed, but primarily body for this route.
                const shopId = req.body.shopId || req.params.shopId || req.query.shopId;
                const date = req.body.date || req.query.date;
                if (!shopId || !date)
                    throw domain_1.CustomError.badRequest("Shop ID and Date required");
                const details = yield this.financialService.getShopClosingDetails(shopId, new Date(date));
                res.json(details);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.closeShopDay = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { shopId, date, sessionAdmin, comprobanteUrl } = req.body;
                if (!shopId || !date)
                    throw domain_1.CustomError.badRequest("Shop ID and Date required");
                const result = yield this.financialService.closeShopDay(shopId, new Date(date), sessionAdmin, comprobanteUrl);
                res.json(result);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.uploadShopReceipt = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { shopId, date } = req.body;
                // Validar que file exista
                if (!req.file)
                    throw domain_1.CustomError.badRequest("File required");
                const result = yield this.financialService.uploadShopClosingReceipt(shopId, date, req.file);
                res.json(result);
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
        this.getPendingShopClosings = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.financialService.getPendingShopClosings();
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
