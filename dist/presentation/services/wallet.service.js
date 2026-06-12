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
const typeorm_1 = require("typeorm");
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
    // ✅ Restar saldo de forma ATÓMICA y SEGURA
    subtractFromWallet(userId, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            if (amount <= 0)
                throw domain_1.CustomError.badRequest("El monto debe ser mayor a cero");
            // 1. Verificar estado y existencia (Lock pesimista opcional, pero usaremos validación en Update)
            const wallet = yield data_1.Wallet.findOne({ where: { user: { id: userId } } });
            if (!wallet)
                throw domain_1.CustomError.notFound("Wallet no encontrada");
            if (wallet.status === data_1.WalletStatus.BLOQUEADO) {
                throw domain_1.CustomError.forbiden("Wallet bloqueada, no se puede realizar la operación");
            }
            // 2. Ejecutar resta atómica directamente en la DB para prevenirRace Conditions
            const updateResult = yield data_1.Wallet.createQueryBuilder()
                .update(data_1.Wallet)
                .set({ balance: () => `balance - ${amount}` })
                .where("id = :id AND balance >= :amount", { id: wallet.id, amount })
                .execute();
            if (updateResult.affected === 0) {
                throw domain_1.CustomError.badRequest("Saldo insuficiente para completar la transacción");
            }
            return yield data_1.Wallet.findOne({ where: { id: wallet.id } });
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
    // ✅ Obtener transacciones de usuario (Consolidado)
    getUserTransactions(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, page = 1, limit = 20, type, startDate, endDate) {
            const wallet = yield data_1.Wallet.findOne({ where: { user: { id: userId } } });
            if (!wallet)
                throw domain_1.CustomError.notFound("Wallet no encontrada para este usuario.");
            const whereCondition = {
                wallet: { id: wallet.id }
            };
            if (startDate) {
                // 💎 Extract only YYYY-MM-DD using regex to be completely safe from any format
                const dateRegex = /(\d{4}-\d{2}-\d{2})/;
                const startMatch = startDate.match(dateRegex);
                const endMatch = (endDate || startDate).match(dateRegex);
                if (startMatch && endMatch) {
                    const startStr = startMatch[1];
                    const endStr = endMatch[1];
                    const start = new Date(`${startStr}T00:00:00-05:00`);
                    const end = new Date(`${endStr}T23:59:59-05:00`);
                    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                        whereCondition.created_at = (0, typeorm_1.Between)(start, end);
                    }
                }
            }
            if (type) {
                whereCondition.type = type;
            }
            const [transactions, total] = yield data_1.Transaction.findAndCount({
                where: whereCondition,
                order: { created_at: 'DESC' },
                skip: (page - 1) * limit,
                take: limit,
                relations: ["admin"]
            });
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
    /**
     * 💳 Iniciar recarga con PayPhone (Tarjeta)
     */
    initializePayphoneRecharge(userId, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            if (amount <= 0)
                throw domain_1.CustomError.badRequest("Monto inválido");
            // 1. Obtener credenciales globales de PayPhone
            const settings = yield data_1.GlobalSettings.findOne({ where: {} });
            if (settings && settings.cardRechargeEnabled === false) {
                throw domain_1.CustomError.badRequest("Los pagos con tarjeta están temporalmente deshabilitados por mantenimiento.");
            }
            if (!(settings === null || settings === void 0 ? void 0 : settings.payphoneToken) || !(settings === null || settings === void 0 ? void 0 : settings.payphoneStoreId)) {
                throw domain_1.CustomError.badRequest("La pasarela de pago PayPhone no está configurada por el administrador.");
            }
            const percentage = Number(settings.payphoneRechargePercentage || 0);
            const fee = amount * (percentage / 100);
            const totalAmount = amount + fee;
            // 2. Crear solicitud de recarga pendiente
            const { RechargeRequest, StatusRecarga } = yield Promise.resolve().then(() => __importStar(require("../../data")));
            const recharge = new RechargeRequest();
            recharge.user = { id: userId };
            recharge.amount = totalAmount; // TOTAL (Base + Fee)
            recharge.baseAmount = amount; // Monto que el usuario quería
            recharge.feeAmount = fee; // Comisión aplicada
            recharge.appliedPercentage = percentage;
            recharge.bank_name = "PayPhone (Tarjeta)";
            recharge.payment_method = "CARD";
            recharge.status = StatusRecarga.PENDIENTE;
            recharge.receipt_image = "https://pay.payphonetodoesposible.com/images/Logotipo.png"; // Placeholder
            recharge.transaction_date = new Date();
            yield recharge.save();
            // 3. Devolver configuración para Widget V3 (Frontend)
            console.log(`🚀 [PayPhone Recharge] Generando config V3: User #${userId}, TotalAmount: ${totalAmount}`);
            const payphoneConfig = {
                token: settings.payphoneToken,
                storeId: settings.payphoneStoreId,
                clientTransactionId: recharge.id,
                amount: Math.round(totalAmount * 100), // En centavos
                amountWithoutTax: Math.round(totalAmount * 100),
                amountWithTax: 0,
                tax: 0,
                reference: `Recarga de Billetera - ${userId}`,
                currency: "USD"
            };
            console.log(`✅ [PayPhone Recharge] Configuración V3 generada`);
            return {
                rechargeId: recharge.id,
                payphoneConfig,
            };
        });
    }
    /**
     * ✅ Confirmación automática de recarga PayPhone
     */
    confirmPayphoneRecharge(rechargeId, remoteId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const { RechargeRequest, StatusRecarga } = yield Promise.resolve().then(() => __importStar(require("../../data")));
            const recharge = yield RechargeRequest.findOne({
                where: { id: rechargeId },
                relations: ["user"]
            });
            if (!recharge)
                throw domain_1.CustomError.notFound("Solicitud de recarga no encontrada");
            // Si ya está aprobado, no hay que hacer nada pero devolvemos éxito
            if (recharge.status === StatusRecarga.APROBADO)
                return { success: true, message: "Recarga ya procesada" };
            const settings = yield data_1.GlobalSettings.findOne({ where: {} });
            if (!(settings === null || settings === void 0 ? void 0 : settings.payphoneToken))
                throw domain_1.CustomError.internalServer("Error de configuración PayPhone");
            const { PayphoneService } = yield Promise.resolve().then(() => __importStar(require("./payphone.service")));
            let currentRemoteId = remoteId;
            // Si no tenemos el RemoteId (ID de transacción de PayPhone), lo buscamos por clientTxId (rechargeId)
            if (!currentRemoteId) {
                console.log(`🔍 [Wallet Service] Buscando RemoteId para recarga: ${rechargeId}`);
                const shortIdForSearch = rechargeId.replace(/-/g, '').slice(0, 20);
                let txInfo = yield PayphoneService.getTransactionByClientTxId(shortIdForSearch, settings.payphoneToken);
                if (!txInfo) {
                    console.warn(`🔍 [Wallet Service] No hallado con shortId, probando con fullId...`);
                    txInfo = yield PayphoneService.getTransactionByClientTxId(rechargeId, settings.payphoneToken);
                }
                if (!txInfo || !txInfo.transactionId) {
                    throw domain_1.CustomError.notFound("No se encontró la transacción en PayPhone. Verifique el estado en su panel de PayPhone.");
                }
                currentRemoteId = txInfo.transactionId;
            }
            // Verificar y Confirmar con PayPhone
            try {
                console.log(`🚀 [Payphone Service] Iniciando búsqueda exhaustiva de confirmación para: ${rechargeId}`);
                // Lista de variantes de ID para probar (PayPhone es inconsistente con el truncamiento)
                const idVariations = [
                    rechargeId, // 1. Completo con guiones
                    rechargeId.slice(0, 20), // 2. Recortado con guiones (20 chars)
                    rechargeId.replace(/-/g, ''), // 3. Completo sin guiones
                    rechargeId.replace(/-/g, '').slice(0, 20) // 4. Recortado sin guiones (20 chars)
                ];
                let verification = null;
                let lastError = null;
                let usedId = "";
                for (const idToTry of idVariations) {
                    try {
                        console.log(`🔍 [Payphone Service] Probando confirmar con ID: ${idToTry}`);
                        verification = yield PayphoneService.confirmPayment(currentRemoteId, idToTry, settings.payphoneToken);
                        if (verification) {
                            usedId = idToTry;
                            break; // ¡Encontrado y confirmado!
                        }
                    }
                    catch (err) {
                        lastError = ((_a = err === null || err === void 0 ? void 0 : err.response) === null || _a === void 0 ? void 0 : _a.data) || err.message;
                        console.warn(`❌ [Payphone Service] Falló con ID ${idToTry}:`, lastError);
                    }
                }
                if (!verification) {
                    console.error("🔥 [Payphone Service] Ninguna combinación de ID funcionó.");
                    throw domain_1.CustomError.badRequest(`PayPhone: ${(lastError === null || lastError === void 0 ? void 0 : lastError.message) || "La transacción no pudo ser vinculada"}`);
                }
                console.log(`✅ [Payphone Service] EXITOSO con ID: ${usedId}`);
                console.log("📄 [Payphone Service] Respuesta:", JSON.stringify(verification));
                if (verification && (verification.transactionStatus === "Approved" ||
                    verification.status === "Approved" ||
                    verification.transactionStatus === "approved" ||
                    verification.status === "approved" ||
                    Number(verification.statusCode) === 3)) {
                    // Acreditar saldo directamente
                    const wallet = yield data_1.Wallet.findOne({ where: { user: { id: recharge.user.id } } });
                    if (!wallet)
                        throw domain_1.CustomError.notFound("Billetera no encontrada para el usuario de la recarga");
                    const previousBalance = Number(wallet.balance || 0);
                    const amountToCredit = Number(recharge.baseAmount || recharge.amount || 0);
                    console.log(`💰 [Payphone Service] Acreditando: ${amountToCredit} | Saldo previo: ${previousBalance}`);
                    if (isNaN(amountToCredit) || amountToCredit <= 0) {
                        console.error("❌ [Payphone Service] Monto inválido detectado:", { amountToCredit, base: recharge.baseAmount, total: recharge.amount });
                        throw domain_1.CustomError.internalServer("Error técnico: Monto de acreditación inválido");
                    }
                    // 🚀 ACREDITACIÓN ATÓMICA (Protección contra Race Conditions)
                    // 1. Bloquear y marcar la recarga como aprobada de forma atómica. Si alguien más ya lo hizo, affected será 0.
                    const updateResult = yield RechargeRequest.createQueryBuilder()
                        .update(RechargeRequest)
                        .set({
                        status: StatusRecarga.APROBADO,
                        external_transaction_id: currentRemoteId.toString(),
                        resolved_at: new Date()
                    })
                        .where("id = :id AND status = :status", { id: recharge.id, status: StatusRecarga.PENDIENTE })
                        .execute();
                    if (updateResult.affected === 0) {
                        console.warn(`⚠️ [Payphone Service] Carrera detectada: La recarga ${recharge.id} ya fue procesada.`);
                        return { success: true, message: "Recarga ya procesada concurrentemente" };
                    }
                    // 2. Si ganamos la carrera, sumar el saldo atómicamente
                    yield data_1.Wallet.createQueryBuilder()
                        .update(data_1.Wallet)
                        .set({ balance: () => `balance + ${amountToCredit}` })
                        .where("id = :id", { id: wallet.id })
                        .execute();
                    // Refrescar el estado de la recarga en memoria para uso futuro si es necesario
                    recharge.status = StatusRecarga.APROBADO;
                    recharge.external_transaction_id = currentRemoteId.toString();
                    // Crear registro de transacción
                    const updatedWallet = yield data_1.Wallet.findOne({ where: { id: wallet.id } });
                    console.log(`📝 [Payphone Service] Creando registro de transacción...`);
                    const transaction = new data_1.Transaction();
                    transaction.wallet = wallet;
                    transaction.amount = amountToCredit;
                    transaction.type = 'credit';
                    transaction.status = 'APPROVED';
                    transaction.reason = data_1.TransactionReason.RECHARGE;
                    transaction.origin = data_1.TransactionOrigin.USER;
                    transaction.previousBalance = previousBalance;
                    transaction.resultingBalance = Number((updatedWallet === null || updatedWallet === void 0 ? void 0 : updatedWallet.balance) || previousBalance + amountToCredit);
                    transaction.reference = recharge.id;
                    yield transaction.save();
                    console.log(`✨ [Payphone Service] PROCESO COMPLETADO EXITOSAMENTE`);
                    return { success: true, message: "Recarga confirmada y acreditada" };
                }
                else {
                    const errorMsg = (verification === null || verification === void 0 ? void 0 : verification.message) || "La transacción no fue aprobada por PayPhone";
                    console.warn(`⚠️ [Payphone Service] Pago NO aprobado:`, verification);
                    recharge.status = StatusRecarga.RECHAZADO;
                    recharge.admin_comment = "Pago denegado por PayPhone";
                    yield recharge.save();
                    throw domain_1.CustomError.badRequest(errorMsg);
                }
            }
            catch (payError) {
                if (payError instanceof domain_1.CustomError)
                    throw payError;
                console.error("🔥 [Payphone Service] FATAL ERROR:", ((_b = payError === null || payError === void 0 ? void 0 : payError.response) === null || _b === void 0 ? void 0 : _b.data) || payError.message);
                const errorMsg = ((_d = (_c = payError === null || payError === void 0 ? void 0 : payError.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) || payError.message || "Error en la comunicación con PayPhone";
                throw domain_1.CustomError.internalServer(`PayPhone Error: ${errorMsg}`);
            }
        });
    }
    /**
     * 🔍 Buscar usuario para recarga (Admin only)
     */
    findUserForRecharge(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield data_1.User.findOne({
                where: { email: email.toLowerCase().trim() },
                relations: ["wallet"]
            });
            if (!user)
                throw domain_1.CustomError.notFound("Usuario no encontrado");
            if (user.status === data_1.Status.DELETED)
                throw domain_1.CustomError.badRequest("El usuario ha sido eliminado");
            return {
                id: user.id,
                name: user.name,
                surname: user.surname,
                email: user.email,
                whatsapp: user.whatsapp,
                status: user.status,
                balance: user.wallet ? Number(user.wallet.balance) : 0
            };
        });
    }
    /**
     * 💵 Recarga en efectivo desde Administrador
     */
    adminCashRecharge(userId, amount, adminId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (amount <= 0)
                throw domain_1.CustomError.badRequest("El monto debe ser mayor a cero");
            const wallet = yield data_1.Wallet.findOne({
                where: { user: { id: userId } },
                relations: ["user"]
            });
            if (!wallet)
                throw domain_1.CustomError.notFound("Wallet no encontrada para este usuario");
            const previousBalance = Number(wallet.balance);
            try {
                // 1. Crear Registro en Tabla de Recargas (Para Auditoría Unificada)
                const recharge = new data_1.RechargeRequest();
                recharge.user = wallet.user;
                recharge.amount = amount;
                recharge.bank_name = 'EFECTIVO';
                recharge.payment_method = 'CASH';
                recharge.status = data_1.StatusRecarga.APROBADO;
                recharge.receipt_number = `ADMIN-${adminId.slice(0, 5)}`;
                recharge.receipt_image = 'ImgStore/cash_recharge.png'; // Placeholder
                recharge.resolved_at = new Date();
                recharge.admin_comment = "Recarga manual por administrador";
                yield recharge.save();
                // 2. Actualizar Saldo
                wallet.balance = previousBalance + amount;
                yield wallet.save();
                // 3. Registro Crítico de Transacción (Vinculada)
                const transaction = new data_1.Transaction();
                transaction.wallet = wallet;
                transaction.amount = amount;
                transaction.type = 'credit';
                transaction.status = 'APPROVED';
                transaction.reason = data_1.TransactionReason.CASH_RECHARGE;
                transaction.origin = data_1.TransactionOrigin.ADMIN;
                transaction.reference = recharge.id; // Vinculación
                transaction.previousBalance = previousBalance;
                transaction.resultingBalance = Number(wallet.balance);
                transaction.observation = "Recarga en efectivo realizada por Administrador";
                transaction.admin = { id: adminId };
                yield transaction.save();
                return {
                    success: true,
                    newBalance: wallet.balance,
                    transactionId: transaction.id,
                    summary: {
                        user: `${wallet.user.name} ${wallet.user.surname}`,
                        amount: amount,
                        date: transaction.created_at,
                        method: "Efectivo",
                        whatsapp: wallet.user.whatsapp,
                        adminId: adminId
                    }
                };
            }
            catch (error) {
                console.error("Error en adminCashRecharge:", error);
                throw domain_1.CustomError.internalServer("Error al procesar la recarga en efectivo");
            }
        });
    }
}
exports.WalletService = WalletService;
