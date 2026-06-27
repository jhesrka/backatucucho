"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const data_1 = require("../../../data");
const transactionType_model_1 = require("../../../data/postgres/models/transactionType.model");
const typeorm_1 = require("typeorm");
const domain_1 = require("../../../domain");
const config_1 = require("../../../config");
class WalletService {
    /**
     * 🔐 Validar Master PIN (reutilizado de SubscriptionService)
     */
    validateMasterPin(pin) {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = yield data_1.GlobalSettings.findOne({ where: {} });
            if (!settings || !settings.masterPin) {
                throw domain_1.CustomError.badRequest("PIN maestro no configurado en el sistema");
            }
            return config_1.encriptAdapter.compare(pin, settings.masterPin);
        });
    }
    /**
     * 💰 Obtener billetera por ID de usuario
     */
    getWalletByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const wallet = yield data_1.Wallet.findOne({
                where: { user: { id: userId } },
                relations: ['user']
            });
            if (!wallet) {
                throw domain_1.CustomError.notFound("Billetera no encontrada");
            }
            return wallet;
        });
    }
    /**
     * 📜 Obtener historial de transacciones (paginado)
     */
    getTransactionHistory(walletId_1) {
        return __awaiter(this, arguments, void 0, function* (walletId, page = 1, limit = 20, startDate, endDate, type // 'credit' | 'debit' or specific reasons logic
        ) {
            const skip = (page - 1) * limit;
            const { DateUtils } = yield Promise.resolve().then(() => __importStar(require("../../../utils/date-utils")));
            const start = DateUtils.getDayRange(startDate || new Date()).start;
            const end = DateUtils.getDayRange(endDate || startDate || new Date()).end;
            const query = transactionType_model_1.Transaction.createQueryBuilder("t")
                .leftJoinAndSelect("t.admin", "admin")
                .where("t.wallet = :walletId", { walletId })
                .andWhere("t.created_at BETWEEN :start AND :end", { start, end })
                .orderBy("t.created_at", "DESC")
                .skip(skip)
                .take(limit);
            if (type && type !== 'ALL') {
                // If type matches 'credit'/'debit', filter by type.
                // If type is a Reason (e.g. SUBSCRIPTION), filter by reason.
                if (['credit', 'debit'].includes(type)) {
                    query.andWhere("t.type = :type", { type });
                }
                else {
                    query.andWhere("t.reason = :reason", { reason: type });
                }
            }
            const [transactions, total] = yield query.getManyAndCount();
            // INICIO: Enriquecimiento dinámico de la observación
            const { Servicio } = yield Promise.resolve().then(() => __importStar(require("../../../data/postgres/models/Servicio")));
            const serviceIds = transactions
                .filter(t => t.reason === transactionType_model_1.TransactionReason.SERVICE_SUBSCRIPTION && t.reference)
                .map(t => t.reference);
            if (serviceIds.length > 0) {
                const servicios = yield Servicio.find({ where: { id: (0, typeorm_1.In)(serviceIds) } });
                transactions.forEach(t => {
                    if (t.reason === transactionType_model_1.TransactionReason.SERVICE_SUBSCRIPTION && t.reference) {
                        const servicio = servicios.find(s => s.id === t.reference);
                        if (servicio) {
                            const shortId = servicio.id.split('-')[0].toUpperCase();
                            t.observation = `Pago por publicación de servicio (${servicio.statusServicio} - ID: ${shortId})`;
                        }
                    }
                });
            }
            // FIN
            const totalPages = Math.ceil(total / limit);
            return {
                transactions,
                total,
                currentPage: page,
                totalPages,
                limit
            };
        });
    }
    /**
     * ✏️ Ajustar saldo manualmente (requiere Master PIN)
     */
    adjustBalance(walletId, amount, masterPin, adminId, observation) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validar PIN maestro
            const isValidPin = yield this.validateMasterPin(masterPin);
            if (!isValidPin) {
                throw domain_1.CustomError.unAuthorized("PIN maestro incorrecto");
            }
            // Validaciones
            if (amount === 0) {
                throw domain_1.CustomError.badRequest("El monto no puede ser 0");
            }
            if (!observation || observation.trim().length === 0) {
                throw domain_1.CustomError.badRequest("La observación es obligatoria");
            }
            // Obtener billetera
            const wallet = yield data_1.Wallet.findOne({
                where: { id: walletId },
                relations: ['user']
            });
            if (!wallet) {
                throw domain_1.CustomError.notFound("Billetera no encontrada");
            }
            // Verificar que no quede en negativo
            const newBalance = Number(wallet.balance) + amount;
            if (newBalance < 0) {
                throw domain_1.CustomError.badRequest("El saldo no puede quedar negativo");
            }
            // Crear transacción
            const transaction = new transactionType_model_1.Transaction();
            transaction.wallet = wallet;
            transaction.amount = Math.abs(amount);
            transaction.type = amount > 0 ? 'credit' : 'debit';
            transaction.reason = transactionType_model_1.TransactionReason.ADMIN_ADJUSTMENT;
            transaction.origin = transactionType_model_1.TransactionOrigin.ADMIN;
            transaction.previousBalance = Number(wallet.balance);
            transaction.resultingBalance = newBalance;
            transaction.reference = null;
            transaction.admin = { id: adminId };
            transaction.observation = observation;
            yield transaction.save();
            // Actualizar saldo de la billetera
            wallet.balance = newBalance;
            yield wallet.save();
            return { wallet, transaction };
        });
    }
    /**
     * 🔒 Bloquear/Desbloquear billetera (requiere Master PIN)
     */
    toggleWalletStatus(walletId, masterPin, adminId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validar PIN maestro
            const isValidPin = yield this.validateMasterPin(masterPin);
            if (!isValidPin) {
                throw domain_1.CustomError.unAuthorized("PIN maestro incorrecto");
            }
            // Obtener billetera
            const wallet = yield data_1.Wallet.findOne({
                where: { id: walletId },
                relations: ['user']
            });
            if (!wallet) {
                throw domain_1.CustomError.notFound("Billetera no encontrada");
            }
            // Cambiar estado
            wallet.status = wallet.status === data_1.WalletStatus.ACTIVO
                ? data_1.WalletStatus.BLOQUEADO
                : data_1.WalletStatus.ACTIVO;
            yield wallet.save();
            // TODO: Registrar en log de auditoría
            console.log(`[AUDIT] Admin ${adminId} cambió estado de billetera ${walletId} a ${wallet.status}`);
            return wallet;
        });
    }
    /**
     * 📊 Obtener estadísticas de la billetera
     */
    getWalletStats(walletId) {
        return __awaiter(this, void 0, void 0, function* () {
            const transactions = yield transactionType_model_1.Transaction.find({
                where: { wallet: { id: walletId } }
            });
            const totalCredits = transactions
                .filter((t) => t.type === 'credit')
                .reduce((sum, t) => sum + Number(t.amount), 0);
            const totalDebits = transactions
                .filter((t) => t.type === 'debit')
                .reduce((sum, t) => sum + Number(t.amount), 0);
            return {
                totalCredits,
                totalDebits,
                transactionCount: transactions.length
            };
        });
    }
    /**
     * 💸 Descontar saldo de la billetera (Método interno para servicios)
     */
    subtractFromWallet(userId_1, amount_1) {
        return __awaiter(this, arguments, void 0, function* (userId, amount, description = "Consumo de servicio", reasonStr = "ORDER", auditSubscription, receiptImage) {
            const wallet = yield data_1.Wallet.findOne({
                where: { user: { id: userId } },
                relations: ["user"]
            });
            if (!wallet)
                throw domain_1.CustomError.notFound("Billetera no encontrada");
            if (wallet.status === data_1.WalletStatus.BLOQUEADO)
                throw domain_1.CustomError.badRequest("La billetera está bloqueada");
            if (wallet.balance < amount)
                throw domain_1.CustomError.badRequest("El negocio no tiene saldo suficiente para activar la suscripción");
            const previousBalance = Number(wallet.balance);
            wallet.balance = Number(wallet.balance) - amount;
            yield wallet.save();
            const transaction = new transactionType_model_1.Transaction();
            transaction.wallet = wallet;
            transaction.amount = amount;
            transaction.type = 'debit';
            transaction.status = 'APPROVED';
            transaction.previousBalance = previousBalance;
            transaction.resultingBalance = Number(wallet.balance);
            transaction.observation = description;
            // Map reason
            const reason = reasonStr;
            transaction.reason = Object.values(transactionType_model_1.TransactionReason).includes(reason)
                ? reason
                : transactionType_model_1.TransactionReason.ORDER;
            transaction.origin = transactionType_model_1.TransactionOrigin.USER;
            // Apply audit fields if present
            if (auditSubscription) {
                transaction.daysBought = auditSubscription.daysBought || null;
                transaction.prevEndDate = auditSubscription.prevEndDate || null;
                transaction.newEndDate = auditSubscription.newEndDate || null;
            }
            if (receiptImage) {
                transaction.receipt_image = receiptImage;
            }
            return yield transaction.save();
        });
    }
    /**
     * 👥 Obtener lista de usuarios con información de billetera
     */
    getWalletUsers() {
        return __awaiter(this, arguments, void 0, function* (page = 1, limit = 10, term = "") {
            const skip = (page - 1) * limit;
            const queryBuilder = data_1.Wallet.createQueryBuilder("wallet")
                .leftJoinAndSelect("wallet.user", "user")
                .orderBy("wallet.updated_at", "DESC") // Ordenar por actividad reciente
                .skip(skip)
                .take(limit);
            if (term) {
                queryBuilder.where("user.name ILIKE :term OR user.email ILIKE :term", { term: `%${term}%` });
            }
            const [wallets, total] = yield queryBuilder.getManyAndCount();
            // Mapear resultado con info extra (Dummy por ahora para lastSpend/lastRecharge si no hay transactions unificadas)
            // Idealmente haríamos subqueries.
            const users = yield Promise.all(wallets.map((w) => __awaiter(this, void 0, void 0, function* () {
                // Buscar última transacción
                const lastTx = yield transactionType_model_1.Transaction.findOne({
                    where: { wallet: { id: w.id } },
                    order: { created_at: 'DESC' }
                });
                return {
                    id: w.user.id,
                    walletId: w.id,
                    name: `${w.user.name} ${w.user.surname}`,
                    email: w.user.email,
                    balance: Number(w.balance),
                    status: w.status,
                    lastMovement: lastTx ? lastTx.created_at : w.updated_at ? w.updated_at : null // Fallback
                };
            })));
            return {
                users,
                total,
                totalPages: Math.ceil(total / limit)
            };
        });
    }
    /**
     * 📈 Obtener estadísticas globales de billeteras (Dashboard)
     */
    /**
     * 📈 Obtener estadísticas globales de billeteras (Dashboard)
     */
    getGlobalWalletStats(dateStr) {
        return __awaiter(this, void 0, void 0, function* () {
            const { DateUtils } = yield Promise.resolve().then(() => __importStar(require("../../../utils/date-utils")));
            const { start, end } = DateUtils.getDayRange(dateStr);
            // 1. Saldo en Circulación (TOTAL GLOBAL - no depende de fecha)
            const totalBalanceData = yield data_1.Wallet.createQueryBuilder("wallet")
                .select("SUM(wallet.balance)", "total")
                .getRawOne();
            const totalBalance = parseFloat(totalBalanceData.total || "0");
            // 2. Gasto en Historias (Día Seleccionado)
            const storiesData = yield data_1.Storie.createQueryBuilder("s")
                .select("SUM(s.total_pagado)", "total")
                .where("s.createdAt >= :start AND s.createdAt <= :end", { start, end })
                .getRawOne();
            const totalStories = parseFloat(storiesData.total || "0");
            // 3. Suscripciones (Día Seleccionado)
            // Necesitamos unir con la tabla Subscription para filtrar por plan (BUSINESS vs others)
            const subsQuery = transactionType_model_1.Transaction.createQueryBuilder("t")
                .leftJoin(data_1.Subscription, "sub", "t.reference = CAST(sub.id AS VARCHAR)")
                .select([
                "SUM(CASE WHEN sub.plan = 'business' THEN t.amount ELSE 0 END) AS businessTotal",
                "SUM(CASE WHEN sub.plan != 'business' OR sub.id IS NULL THEN t.amount ELSE 0 END) AS userTotal"
            ])
                .where("t.created_at >= :start AND t.created_at <= :end", { start, end })
                .andWhere("t.reason = :reason", { reason: transactionType_model_1.TransactionReason.SUBSCRIPTION })
                .andWhere("t.type = 'debit'")
                .andWhere("t.status = 'APPROVED'");
            const subsData = yield subsQuery.getRawOne();
            const totalUserSubs = parseFloat(subsData.userTotal || "0");
            const totalBusinessSubs = parseFloat(subsData.businessTotal || "0");
            // 4. Suscripciones de Servicios (Día Seleccionado)
            const serviceSubsQuery = yield transactionType_model_1.Transaction.createQueryBuilder("t")
                .select("SUM(t.amount)", "total")
                .where("t.created_at >= :start AND t.created_at <= :end", { start, end })
                .andWhere("t.reason = :reason", { reason: transactionType_model_1.TransactionReason.SERVICE_SUBSCRIPTION })
                .andWhere("t.type = 'debit'")
                .andWhere("t.status = 'APPROVED'")
                .getRawOne();
            const totalServiceSubs = parseFloat(serviceSubsQuery.total || "0");
            return {
                totalBalance,
                dailyStats: {
                    stories: totalStories,
                    userSubscriptions: totalUserSubs,
                    businessSubscriptions: totalBusinessSubs,
                    servicesSubscriptions: totalServiceSubs
                }
            };
        });
    }
    /**
     * 📅 Obtener resumen financiero diario (Cierre) e Historial
     */
    getDailyFinancialSummary(dateStr) {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. Verificar si ya está cerrado
            const existingClosing = yield data_1.FinancialClosing.findOne({
                where: { closingDate: dateStr },
                relations: ['closedBy']
            });
            // Parse Date Intervals (Adjusted for Ecuador UTC-5)
            const { DateUtils } = yield Promise.resolve().then(() => __importStar(require("../../../utils/date-utils")));
            const { start, end } = DateUtils.getDayRange(dateStr);
            // 2. INGRESOS: Recargas Aprobadas
            const recharges = yield data_1.RechargeRequest.find({
                where: {
                    status: data_1.StatusRecarga.APROBADO
                },
                relations: ['user']
            });
            // Filtrar manualmente por fecha en Ecuador
            const dayRecharges = recharges.filter(r => {
                const d = new Date(r.created_at);
                const ecDate = d.toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
                return ecDate === dateStr;
            });
            const totalIncome = dayRecharges.reduce((sum, r) => sum + Number(r.amount), 0);
            // 3. EGRESOS: Transacciones de Uso (Historias/Subs)
            const expensesQuery = transactionType_model_1.Transaction.createQueryBuilder("t")
                .leftJoinAndSelect("t.wallet", "w")
                .leftJoinAndSelect("w.user", "u")
                .where("t.created_at >= :start AND t.created_at <= :end", { start, end }) // Better date comparison
                .andWhere("t.type = 'debit'")
                .andWhere("t.reason != :reason", { reason: transactionType_model_1.TransactionReason.ADMIN_ADJUSTMENT });
            const expensesDetails = yield expensesQuery.getMany();
            const totalExpenses = expensesDetails.reduce((sum, t) => sum + Number(t.amount), 0);
            const expensesByType = expensesDetails.reduce((acc, t) => {
                if (t.reason === transactionType_model_1.TransactionReason.SUBSCRIPTION)
                    acc.subscriptions += Number(t.amount);
                else if (t.reason === transactionType_model_1.TransactionReason.SERVICE_SUBSCRIPTION)
                    acc.services += Number(t.amount);
                else
                    acc.stories += Number(t.amount);
                return acc;
            }, { stories: 0, subscriptions: 0, services: 0 });
            return {
                date: dateStr,
                isClosed: !!existingClosing,
                closingData: existingClosing ? yield (() => __awaiter(this, void 0, void 0, function* () {
                    const rawKey = existingClosing.backupFileUrl;
                    // Sanitize: If it's a full URL, extract key. If starts with 'uploads/', assume it's key.
                    let key = rawKey;
                    if (rawKey.startsWith('http')) {
                        try {
                            key = new URL(rawKey).pathname.substring(1); // strips leading slash
                        }
                        catch (e) {
                            key = rawKey;
                        }
                    }
                    // Verify existence
                    const exists = yield config_1.UploadFilesCloud.checkFileExists({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: key
                    });
                    if (!exists) {
                        return Object.assign(Object.assign({}, existingClosing), { backupFileUrl: null });
                    }
                    return Object.assign(Object.assign({}, existingClosing), { backupFileUrl: yield config_1.UploadFilesCloud.getFile({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: key
                        }) });
                }))() : null,
                income: {
                    total: totalIncome,
                    count: dayRecharges.length,
                    details: dayRecharges.map(r => ({
                        id: r.id,
                        user: r.user,
                        amount: r.amount,
                        time: r.created_at,
                        method: r.bank_name
                    }))
                },
                expenses: {
                    total: totalExpenses,
                    breakdown: expensesByType,
                    details: expensesDetails.map(t => ({
                        id: t.id,
                        user: t.wallet.user,
                        type: t.reason,
                        amount: t.amount,
                        time: t.created_at,
                        reference: t.reference
                    }))
                }
            };
        });
    }
    /**
     * 🔒 Cerrar día financiero
     */
    closeFinancialDay(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const existing = yield data_1.FinancialClosing.findOne({ where: { closingDate: data.date } });
            if (existing) {
                throw domain_1.CustomError.badRequest("El día ya se encuentra cerrado.");
            }
            const closing = new data_1.FinancialClosing();
            closing.closingDate = data.date;
            closing.totalIncome = data.totalIncome;
            closing.totalExpenses = data.totalExpenses;
            closing.backupFileUrl = data.fileUrl;
            closing.totalRechargesCount = data.totalCount;
            closing.closedBy = { id: data.adminId };
            return yield closing.save();
        });
    }
    /**
     * 💳 Iniciar recarga con PayPhone (Tarjeta)
     */
    initializePayphoneRecharge(userId, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            if (amount <= 0)
                throw domain_1.CustomError.badRequest("Monto inválido");
            // 1. Obtener credenciales globales de PayPhone
            const settings = yield data_1.GlobalSettings.findOne({ where: {} });
            if (!(settings === null || settings === void 0 ? void 0 : settings.payphoneToken) || !(settings === null || settings === void 0 ? void 0 : settings.payphoneStoreId)) {
                throw domain_1.CustomError.badRequest("La pasarela de pago PayPhone no está configurada por el administrador.");
            }
            // 2. Crear solicitud de recarga pendiente
            const recharge = new data_1.RechargeRequest();
            recharge.user = { id: userId };
            recharge.amount = amount;
            recharge.bank_name = "PayPhone (Tarjeta)";
            recharge.payment_method = "CARD";
            recharge.status = data_1.StatusRecarga.PENDIENTE;
            recharge.receipt_image = "https://pay.payphonetodoesposible.com/images/Logotipo.png"; // Placeholder representativo
            recharge.transaction_date = new Date();
            yield recharge.save();
            console.log(`🚀 [Wallet PayPhone] Iniciando recarga`);
            // En lugar de llamar a createCheckout (V1), simplemente devolvemos la configuración V3 al Frontend
            const payphoneConfig = {
                token: settings.payphoneToken,
                storeId: settings.payphoneStoreId,
                clientTransactionId: recharge.id,
                amount: Math.round(amount * 100),
                amountWithoutTax: Math.round(amount * 100),
                amountWithTax: 0,
                tax: 0,
                reference: `Recarga de Billetera - ${userId}`,
                currency: "USD"
            };
            console.log(`✅ [Wallet PayPhone] Configuración Generada para frontend (Botón V3) | Amount Cents: ${payphoneConfig.amount}`);
            return {
                rechargeId: recharge.id,
                payphoneConfig
            };
        });
    }
    /**
     * ✅ Confirmación automática de recarga PayPhone
     */
    confirmPayphoneRecharge(rechargeId, remoteId) {
        return __awaiter(this, void 0, void 0, function* () {
            const recharge = yield data_1.RechargeRequest.findOne({
                where: { id: rechargeId },
                relations: ["user"]
            });
            if (!recharge)
                throw domain_1.CustomError.notFound("Solicitud de recarga no encontrada");
            if (recharge.status === data_1.StatusRecarga.APROBADO)
                return { message: "Recarga ya procesada" };
            const settings = yield data_1.GlobalSettings.findOne({ where: {} });
            if (!(settings === null || settings === void 0 ? void 0 : settings.payphoneToken))
                throw domain_1.CustomError.internalServer("Error de configuración PayPhone");
            // Verificar con PayPhone usando Get en lugar de Confirm para links de tipo Prepare
            const { PayphoneService } = yield Promise.resolve().then(() => __importStar(require("../payphone.service")));
            console.log(`🔍 [Wallet PayPhone] Verificando estado | Recharge ID: ${rechargeId} | Remote ID: ${remoteId}`);
            const verification = yield PayphoneService.getTransactionByClientTxId(rechargeId, settings.payphoneToken);
            console.log(`📡 [Wallet PayPhone] Respuesta de Verificación:`, JSON.stringify(verification));
            if (verification && (verification.transactionStatus === "Approved" ||
                verification.status === "Approved" ||
                verification.transactionStatus === "approved" ||
                verification.statusCode === 3)) {
                // Acreditar saldo directamente
                const wallet = yield this.getWalletByUserId(recharge.user.id);
                const previousBalance = Number(wallet.balance);
                const amount = Number(recharge.amount);
                wallet.balance = previousBalance + amount;
                yield wallet.save();
                // Actualizar solicitud
                recharge.status = data_1.StatusRecarga.APROBADO;
                recharge.external_transaction_id = remoteId.toString();
                recharge.resolved_at = new Date();
                yield recharge.save();
                // Crear registro de transacción
                const transaction = new transactionType_model_1.Transaction();
                transaction.wallet = wallet;
                transaction.amount = amount;
                transaction.type = 'credit';
                transaction.status = 'APPROVED'; // Aprobado automáticamente
                transaction.reason = transactionType_model_1.TransactionReason.RECHARGE;
                transaction.origin = transactionType_model_1.TransactionOrigin.USER;
                transaction.previousBalance = previousBalance;
                transaction.resultingBalance = Number(wallet.balance);
                transaction.observation = "Recarga automática con PayPhone (Tarjeta)";
                transaction.reference = recharge.id;
                yield transaction.save();
                console.log(`💰 [Wallet PayPhone] Saldo Acreditado Exitosamente | User ID: ${recharge.user.id} | Nuevo Saldo: ${wallet.balance}`);
                return { success: true, newBalance: wallet.balance };
            }
            else {
                recharge.status = data_1.StatusRecarga.RECHAZADO;
                recharge.admin_comment = "Pago denegado por PayPhone";
                yield recharge.save();
                console.error(`❌ [Wallet PayPhone] Confirmación Fallida o Rechazada | Recharge ID: ${rechargeId}`);
                throw domain_1.CustomError.badRequest("El pago no fue aprobado por el banco.");
            }
        });
    }
}
exports.WalletService = WalletService;
