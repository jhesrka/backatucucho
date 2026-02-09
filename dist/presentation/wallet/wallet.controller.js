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
const domain_1 = require("../../domain");
const CreateWallet_dto_1 = require("../../domain/dtos/wallet/CreateWallet.dto");
class WalletController {
    constructor(walletService) {
        this.walletService = walletService;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            console.error("Unhandled error:", error);
            return res.status(500).json({ message: "Error inesperado del servidor" });
        };
        this.createWallet = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const [error, createDto] = CreateWallet_dto_1.CreateWalletDTO.create(req.body);
            if (error)
                return res.status(422).json({ message: error });
            try {
                const wallet = yield this.walletService.createWallet(createDto);
                return res.status(201).json(wallet);
            }
            catch (err) {
                return this.handleError(err, res);
            }
        });
        this.getWalletByUserId = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { userId } = req.params;
            try {
                const wallet = yield this.walletService.findWalletByUser(userId);
                return res.status(200).json(wallet);
            }
            catch (err) {
                return this.handleError(err, res);
            }
        });
        this.getAllWallets = (_req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const wallets = yield this.walletService.findAllWallets();
                return res.status(200).json(wallets);
            }
            catch (err) {
                return this.handleError(err, res);
            }
        });
        // ✅ Restar saldo
        this.subtractBalance = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { userId } = req.params;
            let { amount } = req.body;
            amount = Number(amount); // Asegúrate de que sea un número
            if (isNaN(amount) || amount <= 0) {
                return res.status(400).json({ message: "Monto inválido para restar" });
            }
            try {
                const result = yield this.walletService.subtractFromWallet(userId, amount);
                return res
                    .status(200)
                    .json({ message: "Saldo actualizado", wallet: result });
            }
            catch (err) {
                return this.handleError(err, res);
            }
        });
        // ✅ Total de todas las billeteras
        this.getTotalBalance = (_req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.walletService.getTotalBalanceOfAllWallets();
                return res.status(200).json(result);
            }
            catch (err) {
                return this.handleError(err, res);
            }
        });
        // ✅ Usuarios con balance = 0
        this.getCountZeroBalance = (_req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.walletService.countWalletsWithZeroBalance();
                return res.status(200).json(result);
            }
            catch (err) {
                return this.handleError(err, res);
            }
        });
        // ✅ Usuarios con balance > 0
        this.getCountPositiveBalance = (_req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.walletService.countWalletsWithPositiveBalance();
                return res.status(200).json(result);
            }
            catch (err) {
                return this.handleError(err, res);
            }
        });
        // ✅ Bloquear billetera
        this.blockWallet = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { userId } = req.params;
            try {
                const result = yield this.walletService.blockWallet(userId);
                return res
                    .status(200)
                    .json({ message: "Wallet bloqueada", wallet: result });
            }
            catch (err) {
                return this.handleError(err, res);
            }
        });
        // ✅ Activar billetera
        this.activateWallet = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { userId } = req.params;
            try {
                const result = yield this.walletService.activateWallet(userId);
                return res
                    .status(200)
                    .json({ message: "Wallet activada", wallet: result });
            }
            catch (err) {
                return this.handleError(err, res);
            }
        });
        // ✅ Solicitar Retiro
        this.requestWithdrawal = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { userId } = req.params; // Or from session
            const { amount, bankInfo } = req.body;
            // TODO: Validate user owns wallet via sessionUser (middleware already does most)
            // Assuming auth middleware puts sessionUser in body
            const sessionUser = req.body.sessionUser;
            if (sessionUser && sessionUser.id !== userId) {
                return res.status(403).json({ message: "No autorizado" });
            }
            try {
                const result = yield this.walletService.requestWithdrawal(userId, Number(amount), bankInfo);
                return res.status(201).json(result);
            }
            catch (err) {
                return this.handleError(err, res);
            }
        });
        this.getUserTransactions = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { userId } = req.params;
            const { page = 1, limit = 10, type, startDate, endDate } = req.query;
            try {
                const result = yield this.walletService.getUserTransactions(userId, Number(page), Number(limit), type, startDate, endDate);
                return res.status(200).json(result);
            }
            catch (err) {
                return this.handleError(err, res);
            }
        });
    }
}
exports.WalletController = WalletController;
