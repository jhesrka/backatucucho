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
exports.WalletService = void 0;
const data_1 = require("../../data");
const domain_1 = require("../../domain");
const upload_files_cloud_adapter_1 = require("../../config/upload-files-cloud-adapter");
const config_1 = require("../../config");
class WalletService {
    constructor(userService) {
        this.userService = userService;
    }
    //USUARIO
    findWalletByUser(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield this.userService.findOneUser(userId);
            const wallet = yield data_1.Wallet.findOne({
                where: { user: { id: userId } },
                relations: ["user"],
            });
            if (!wallet) {
                throw domain_1.CustomError.notFound("No se encontró la wallet del usuario.");
            }
            return {
                id: wallet.id,
                balance: Number(wallet.balance),
                status: wallet.status,
                created_at: wallet.created_at,
                updated_at: wallet.updated_at,
            };
        });
    }
    //ADMINISTRADOR
    findAllWallets() {
        return __awaiter(this, void 0, void 0, function* () {
            const wallets = yield data_1.Wallet.find({ relations: ["user"] });
            return wallets.map((wallet) => ({
                id: wallet.id,
                balance: wallet.balance,
                status: wallet.status,
                created_at: wallet.created_at,
                updated_at: wallet.updated_at,
                user: {
                    id: wallet.user.id,
                    name: wallet.user.name,
                    surname: wallet.user.surname,
                    email: wallet.user.email,
                },
            }));
        });
    }
    createWallet(walletData) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield this.userService.findOneUser(walletData.userId);
            const existing = yield data_1.Wallet.findOne({ where: { user: { id: user.id } } });
            if (existing) {
                throw domain_1.CustomError.badRequest("El usuario ya tiene una wallet.");
            }
            const wallet = new data_1.Wallet();
            wallet.user = user;
            wallet.balance = walletData.balance;
            try {
                const savedWallet = yield wallet.save();
                return savedWallet;
            }
            catch (_a) {
                throw domain_1.CustomError.internalServer("Error creando la wallet.");
            }
        });
    }
    // ✅ Restar saldo manualmente (solo si está ACTIVA)
    subtractFromWallet(userId, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            const wallet = yield data_1.Wallet.findOne({ where: { user: { id: userId } } });
            if (!wallet) {
                throw domain_1.CustomError.notFound("Wallet no encontrada");
            }
            if (wallet.status === data_1.WalletStatus.BLOQUEADO) {
                throw domain_1.CustomError.forbiden("Wallet bloqueada, no se puede modificar saldo");
            }
            if (wallet.balance < amount) {
                throw domain_1.CustomError.badRequest("Saldo insuficiente");
            }
            wallet.balance -= amount;
            try {
                return yield wallet.save();
            }
            catch (_a) {
                throw domain_1.CustomError.internalServer("Error al actualizar el saldo de la wallet");
            }
        });
    }
    // ✅ Obtener total de saldo de todas las billeteras
    getTotalBalanceOfAllWallets() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield data_1.Wallet.createQueryBuilder("wallet")
                .select("SUM(wallet.balance)", "total")
                .getRawOne();
            return { totalBalance: parseFloat(result.total || "0") };
        });
    }
    // ✅ Contar usuarios con saldo cero
    countWalletsWithZeroBalance() {
        return __awaiter(this, void 0, void 0, function* () {
            const count = yield data_1.Wallet.count({ where: { balance: 0 } });
            return { totalZeroBalance: count };
        });
    }
    // ✅ Contar usuarios con saldo mayor a cero
    countWalletsWithPositiveBalance() {
        return __awaiter(this, void 0, void 0, function* () {
            const count = yield data_1.Wallet.createQueryBuilder("wallet")
                .where("wallet.balance > 0")
                .getCount();
            return { totalPositiveBalance: count };
        });
    }
    // ✅ Bloquear wallet (solo cambia estado, no toca saldo)
    blockWallet(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const wallet = yield data_1.Wallet.findOne({ where: { user: { id: userId } } });
            if (!wallet)
                throw domain_1.CustomError.notFound("Wallet no encontrada");
            wallet.status = data_1.WalletStatus.BLOQUEADO;
            return yield wallet.save();
        });
    }
    // ✅ Activar wallet
    activateWallet(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const wallet = yield data_1.Wallet.findOne({ where: { user: { id: userId } } });
            if (!wallet)
                throw domain_1.CustomError.notFound("Wallet no encontrada");
            wallet.status = data_1.WalletStatus.ACTIVO;
            return yield wallet.save();
        });
    }
    // ✅ Obtener transacciones de usuario
    getUserTransactions(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, page = 1, limit = 10, type, startDate, endDate) {
            const wallet = yield data_1.Wallet.findOne({ where: { user: { id: userId } } });
            if (!wallet)
                throw domain_1.CustomError.notFound("Wallet no encontrada");
            const query = data_1.Transaction.createQueryBuilder("transaction")
                .where("transaction.walletId = :walletId", { walletId: wallet.id })
                .orderBy("transaction.created_at", "DESC")
                .skip((page - 1) * limit)
                .take(limit);
            if (type) {
                query.andWhere("transaction.type = :type", { type });
            }
            if (startDate && endDate) {
                let start;
                let end;
                // Intentamos parsear como ISO primero. Si falla o es solo fecha, ajustamos.
                const isShortDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
                if (isShortDate(startDate)) {
                    const [y, m, d] = startDate.split('-').map(Number);
                    // 05:00 UTC = 00:00 Ecuador
                    start = new Date(Date.UTC(y, m - 1, d, 5, 0, 0));
                }
                else {
                    start = new Date(startDate);
                }
                if (isShortDate(endDate)) {
                    const [y, m, d] = endDate.split('-').map(Number);
                    // 04:59:59 UTC del día siguiente = 23:59:59 Ecuador (mismo día al final)
                    end = new Date(Date.UTC(y, m - 1, d + 1, 4, 59, 59, 999));
                }
                else {
                    end = new Date(endDate);
                }
                // Validar que sean fechas válidas antes de aplicar al query
                if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                    query.andWhere("transaction.created_at BETWEEN :startDate AND :endDate", {
                        startDate: start.toISOString(),
                        endDate: end.toISOString(),
                    });
                }
            }
            const [transactions, total] = yield query.getManyAndCount();
            const transactionsSigned = yield Promise.all(transactions.map((tx) => __awaiter(this, void 0, void 0, function* () {
                if (tx.receipt_image && !tx.receipt_image.startsWith('http')) {
                    try {
                        const signedUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: tx.receipt_image
                        });
                        tx.receipt_image = signedUrl;
                    }
                    catch (error) {
                        console.error(`Error signing receipt for transaction ${tx.id}`, error);
                    }
                }
                return tx;
            })));
            return {
                data: transactionsSigned,
                pagination: {
                    currentPage: Number(page),
                    totalPages: Math.ceil(total / limit),
                    total,
                },
            };
        });
    }
    // ✅ Solicitar Retiro (Genera transacción PENDIENTE)
    requestWithdrawal(userId, amount, bankInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            const wallet = yield data_1.Wallet.findOne({ where: { user: { id: userId } } });
            if (!wallet)
                throw domain_1.CustomError.notFound("Wallet no encontrada");
            // Validar Saldo disponible (considerando que otros retiros pendientes NO han descontado saldo fisica pero deberian descontar "disponible")
            // Para simplificar según reglas: "El saldo anterior y posterior deben mostrarse sin cambios" en 1️⃣.
            // Pero lógicamente no debería poder pedir más de lo que tiene.
            if (Number(wallet.balance) < amount) {
                throw domain_1.CustomError.badRequest("Saldo insuficiente para realizar el retiro");
            }
            const transaction = new data_1.Transaction();
            transaction.wallet = wallet;
            transaction.amount = amount;
            transaction.type = 'debit';
            transaction.reason = data_1.TransactionReason.WITHDRAWAL; // Asegurar que el enum incluya WITHDRAWAL
            transaction.origin = data_1.TransactionOrigin.USER;
            transaction.status = 'PENDING';
            transaction.observation = `Solicitud de Retiro a: ${bankInfo}`;
            // VISUALIZACIÓN: No afecta saldo aún
            transaction.previousBalance = Number(wallet.balance);
            transaction.resultingBalance = Number(wallet.balance); // Sin cambios
            yield transaction.save();
            return transaction;
        });
    }
}
exports.WalletService = WalletService;
