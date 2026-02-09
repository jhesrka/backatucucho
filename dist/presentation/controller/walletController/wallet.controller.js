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
exports.WalletController = void 0;
const wallet_service_1 = require("../../services/postService/wallet.service");
const domain_1 = require("../../../domain");
class WalletController {
    constructor(walletService = new wallet_service_1.WalletService()) {
        this.walletService = walletService;
        /**
         * Manejo de errores centralizado
         */
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            const message = error instanceof Error ? error.message : "Error interno de billetera";
            console.error("Wallet Error:", error);
            return res.status(500).json({
                message: `Error de Billetera: ${message}`
            });
        };
        /**
         * 💰 Obtener billetera de un usuario
         * GET /api/wallets/admin/user/:userId
         */
        this.getWalletByUserId = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId } = req.params;
                const wallet = yield this.walletService.getWalletByUserId(userId);
                res.json({
                    success: true,
                    wallet
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        /**
         * 📜 Obtener historial de transacciones
         * GET /api/wallets/admin/:walletId/transactions?page=1&limit=20
         */
        this.getTransactionHistory = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { walletId } = req.params;
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 20;
                const startDate = req.query.startDate;
                const endDate = req.query.endDate;
                const type = req.query.type;
                const history = yield this.walletService.getTransactionHistory(walletId, page, limit, startDate, endDate, type);
                res.json(Object.assign({ success: true }, history));
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        /**
         * ✏️ Ajustar saldo manualmente
         * POST /api/wallets/admin/:walletId/adjust
         * Body: { amount, masterPin, observation }
         */
        this.adjustBalance = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { walletId } = req.params;
                const { amount, masterPin, observation } = req.body;
                const adminId = (_a = req.body.sessionAdmin) === null || _a === void 0 ? void 0 : _a.id;
                if (!adminId) {
                    return res.status(401).json({ message: "Admin no autenticado" });
                }
                if (amount === undefined || !masterPin || !observation) {
                    return res.status(400).json({
                        message: "amount, masterPin y observation son requeridos"
                    });
                }
                const result = yield this.walletService.adjustBalance(walletId, Number(amount), masterPin, adminId, observation);
                res.json({
                    success: true,
                    message: "Saldo ajustado correctamente",
                    wallet: result.wallet,
                    transaction: result.transaction
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        /**
         * 🔒 Bloquear/Desbloquear billetera
         * PUT /api/wallets/admin/:walletId/toggle-status
         * Body: { masterPin }
         */
        this.toggleWalletStatus = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { walletId } = req.params;
                const { masterPin } = req.body;
                const adminId = (_a = req.body.sessionAdmin) === null || _a === void 0 ? void 0 : _a.id;
                if (!adminId) {
                    return res.status(401).json({ message: "Admin no autenticado" });
                }
                if (!masterPin) {
                    return res.status(400).json({ message: "masterPin es requerido" });
                }
                const wallet = yield this.walletService.toggleWalletStatus(walletId, masterPin, adminId);
                res.json({
                    success: true,
                    message: `Billetera ${wallet.status === 'ACTIVO' ? 'desbloqueada' : 'bloqueada'} correctamente`,
                    wallet
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        /**
         * 📊 Obtener estadísticas de la billetera
         * GET /api/wallets/admin/:walletId/stats
         */
        this.getWalletStats = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { walletId } = req.params;
                const stats = yield this.walletService.getWalletStats(walletId);
                res.json({
                    success: true,
                    stats
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        /**
         * 👥 Obtener lista de usuarios con billeteras (Paginado)
         * GET /api/wallets/admin/users?page=1&limit=10&term=...
         */
        this.getWalletUsers = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 10;
                const term = req.query.term || "";
                const result = yield this.walletService.getWalletUsers(page, limit, term);
                res.json(Object.assign({ success: true }, result));
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        /**
         * 📈 Obtener dashboard global de billeteras
         * GET /api/wallets/admin/dashboard/stats?period=today
         */
        this.getGlobalDashStats = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const period = req.query.period || 'today';
                const stats = yield this.walletService.getGlobalWalletStats(period);
                res.json({
                    success: true,
                    stats
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        /**
         * 📅 Obtener cierre diario
         * GET /api/wallets/admin/financial/closing?date=YYYY-MM-DD
         */
        this.getDailyClosing = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const date = req.query.date || new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'America/Guayaquil',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }).format(new Date());
                const data = yield this.walletService.getDailyFinancialSummary(date);
                res.json({
                    success: true,
                    data
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        /**
         * 🔒 Realizar cierre diario
         * POST /api/wallets/admin/financial/closing
         */
        this.closeDay = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { date, fileUrl, totalIncome, totalExpenses, totalCount } = req.body;
                const adminId = (_a = req.body.sessionAdmin) === null || _a === void 0 ? void 0 : _a.id;
                if (!adminId)
                    return res.status(401).json({ message: "No autorizado" });
                if (!date || !fileUrl)
                    return res.status(400).json({ message: "Faltan datos requeridos (fecha o archivo)" });
                const result = yield this.walletService.closeFinancialDay({
                    date,
                    totalIncome: Number(totalIncome),
                    totalExpenses: Number(totalExpenses),
                    fileUrl,
                    adminId,
                    totalCount: Number(totalCount)
                });
                res.json({
                    success: true,
                    message: "Día cerrado correctamente",
                    result
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
    }
}
exports.WalletController = WalletController;
