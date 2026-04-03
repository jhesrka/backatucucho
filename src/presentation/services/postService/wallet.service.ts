import { Wallet, WalletStatus, GlobalSettings, Storie, FinancialClosing, RechargeRequest, StatusRecarga, Subscription } from "../../../data";
import { Transaction, TransactionType, TransactionOrigin, TransactionReason } from "../../../data/postgres/models/transactionType.model";
import { Between } from "typeorm";
import { CustomError } from "../../../domain";
import { encriptAdapter, UploadFilesCloud, envs } from "../../../config";

export class WalletService {
    /**
     * 🔐 Validar Master PIN (reutilizado de SubscriptionService)
     */
    private async validateMasterPin(pin: string): Promise<boolean> {
        const settings = await GlobalSettings.findOne({ where: {} });
        if (!settings || !settings.masterPin) {
            throw CustomError.badRequest("PIN maestro no configurado en el sistema");
        }
        return encriptAdapter.compare(pin, settings.masterPin);
    }

    /**
     * 💰 Obtener billetera por ID de usuario
     */
    async getWalletByUserId(userId: string): Promise<Wallet> {
        const wallet = await Wallet.findOne({
            where: { user: { id: userId } },
            relations: ['user']
        });

        if (!wallet) {
            throw CustomError.notFound("Billetera no encontrada");
        }

        return wallet;
    }

    /**
     * 📜 Obtener historial de transacciones (paginado)
     */
    async getTransactionHistory(
        walletId: string,
        page: number = 1,
        limit: number = 20,
        startDate?: string,
        endDate?: string,
        type?: string // 'credit' | 'debit' or specific reasons logic
    ): Promise<{
        transactions: Transaction[];
        total: number;
        currentPage: number;
        totalPages: number;
        limit: number;
    }> {
        const skip = (page - 1) * limit;

        const { DateUtils } = await import("../../../utils/date-utils");
        const start = DateUtils.getDayRange(startDate || new Date()).start;
        const end = DateUtils.getDayRange(endDate || startDate || new Date()).end;

        const query = Transaction.createQueryBuilder("t")
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
            } else {
                query.andWhere("t.reason = :reason", { reason: type });
            }
        }

        const [transactions, total] = await query.getManyAndCount();

        const totalPages = Math.ceil(total / limit);

        return {
            transactions,
            total,
            currentPage: page,
            totalPages,
            limit
        };
    }

    /**
     * ✏️ Ajustar saldo manualmente (requiere Master PIN)
     */
    async adjustBalance(
        walletId: string,
        amount: number,
        masterPin: string,
        adminId: string,
        observation: string
    ): Promise<{ wallet: Wallet; transaction: Transaction }> {
        // Validar PIN maestro
        const isValidPin = await this.validateMasterPin(masterPin);
        if (!isValidPin) {
            throw CustomError.unAuthorized("PIN maestro incorrecto");
        }

        // Validaciones
        if (amount === 0) {
            throw CustomError.badRequest("El monto no puede ser 0");
        }

        if (!observation || observation.trim().length === 0) {
            throw CustomError.badRequest("La observación es obligatoria");
        }

        // Obtener billetera
        const wallet = await Wallet.findOne({
            where: { id: walletId },
            relations: ['user']
        });

        if (!wallet) {
            throw CustomError.notFound("Billetera no encontrada");
        }

        // Verificar que no quede en negativo
        const newBalance = Number(wallet.balance) + amount;
        if (newBalance < 0) {
            throw CustomError.badRequest("El saldo no puede quedar negativo");
        }

        // Crear transacción
        const transaction = new Transaction();
        transaction.wallet = wallet;
        transaction.amount = Math.abs(amount);
        transaction.type = amount > 0 ? 'credit' : 'debit';
        transaction.reason = TransactionReason.ADMIN_ADJUSTMENT;
        transaction.origin = TransactionOrigin.ADMIN;
        transaction.previousBalance = Number(wallet.balance);
        transaction.resultingBalance = newBalance;
        transaction.reference = null;
        transaction.admin = { id: adminId } as any;
        transaction.observation = observation;

        await transaction.save();

        // Actualizar saldo de la billetera
        wallet.balance = newBalance;
        await wallet.save();

        return { wallet, transaction };
    }

    /**
     * 🔒 Bloquear/Desbloquear billetera (requiere Master PIN)
     */
    async toggleWalletStatus(
        walletId: string,
        masterPin: string,
        adminId: string
    ): Promise<Wallet> {
        // Validar PIN maestro
        const isValidPin = await this.validateMasterPin(masterPin);
        if (!isValidPin) {
            throw CustomError.unAuthorized("PIN maestro incorrecto");
        }

        // Obtener billetera
        const wallet = await Wallet.findOne({
            where: { id: walletId },
            relations: ['user']
        });

        if (!wallet) {
            throw CustomError.notFound("Billetera no encontrada");
        }

        // Cambiar estado
        wallet.status = wallet.status === WalletStatus.ACTIVO
            ? WalletStatus.BLOQUEADO
            : WalletStatus.ACTIVO;

        await wallet.save();

        // TODO: Registrar en log de auditoría
        console.log(`[AUDIT] Admin ${adminId} cambió estado de billetera ${walletId} a ${wallet.status}`);

        return wallet;
    }

    /**
     * 📊 Obtener estadísticas de la billetera
     */
    async getWalletStats(walletId: string): Promise<{
        totalCredits: number;
        totalDebits: number;
        transactionCount: number;
    }> {
        const transactions = await Transaction.find({
            where: { wallet: { id: walletId } }
        });

        const totalCredits = transactions
            .filter((t: Transaction) => t.type === 'credit')
            .reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0);

        const totalDebits = transactions
            .filter((t: Transaction) => t.type === 'debit')
            .reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0);

        return {
            totalCredits,
            totalDebits,
            transactionCount: transactions.length
        };
    }

    /**
     * 💸 Descontar saldo de la billetera (Método interno para servicios)
     */
    async subtractFromWallet(
        userId: string,
        amount: number,
        description: string = "Consumo de servicio",
        reasonStr: string = "ORDER",
        auditSubscription?: { daysBought?: number, prevEndDate?: Date, newEndDate?: Date },
        receiptImage?: string
    ): Promise<Transaction> {
        const wallet = await Wallet.findOne({
            where: { user: { id: userId } },
            relations: ["user"]
        });

        if (!wallet) throw CustomError.notFound("Billetera no encontrada");
        if (wallet.status === WalletStatus.BLOQUEADO) throw CustomError.badRequest("La billetera está bloqueada");
        if (wallet.balance < amount) throw CustomError.badRequest("El negocio no tiene saldo suficiente para activar la suscripción");

        const previousBalance = Number(wallet.balance);
        wallet.balance = Number(wallet.balance) - amount;
        await wallet.save();

        const transaction = new Transaction();
        transaction.wallet = wallet;
        transaction.amount = amount;
        transaction.type = 'debit';
        transaction.status = 'APPROVED';
        transaction.previousBalance = previousBalance;
        transaction.resultingBalance = Number(wallet.balance);
        transaction.observation = description;

        // Map reason
        const reason = reasonStr as TransactionReason;
        transaction.reason = Object.values(TransactionReason).includes(reason)
            ? reason
            : TransactionReason.ORDER;

        transaction.origin = TransactionOrigin.USER;

        // Apply audit fields if present
        if (auditSubscription) {
            transaction.daysBought = auditSubscription.daysBought || null;
            transaction.prevEndDate = auditSubscription.prevEndDate || null;
            transaction.newEndDate = auditSubscription.newEndDate || null;
        }

        if (receiptImage) {
            transaction.receipt_image = receiptImage;
        }

        return await transaction.save();
    }

    /**
     * 👥 Obtener lista de usuarios con información de billetera
     */
    async getWalletUsers(page: number = 1, limit: number = 10, term: string = ""): Promise<{ users: any[], total: number, totalPages: number }> {
        const skip = (page - 1) * limit;

        const queryBuilder = Wallet.createQueryBuilder("wallet")
            .leftJoinAndSelect("wallet.user", "user")
            .orderBy("wallet.updated_at", "DESC") // Ordenar por actividad reciente
            .skip(skip)
            .take(limit);

        if (term) {
            queryBuilder.where("user.name ILIKE :term OR user.email ILIKE :term", { term: `%${term}%` });
        }

        const [wallets, total] = await queryBuilder.getManyAndCount();

        // Mapear resultado con info extra (Dummy por ahora para lastSpend/lastRecharge si no hay transactions unificadas)
        // Idealmente haríamos subqueries.
        const users = await Promise.all(wallets.map(async (w) => {
            // Buscar última transacción
            const lastTx = await Transaction.findOne({
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
        }));

        return {
            users,
            total,
            totalPages: Math.ceil(total / limit)
        };
    }

    /**
     * 📈 Obtener estadísticas globales de billeteras (Dashboard)
     */
    /**
     * 📈 Obtener estadísticas globales de billeteras (Dashboard)
     */
    async getGlobalWalletStats(dateStr: string): Promise<any> {
        const { DateUtils } = await import("../../../utils/date-utils");
        const { start, end } = DateUtils.getDayRange(dateStr);

        // 1. Saldo en Circulación (TOTAL GLOBAL - no depende de fecha)
        const totalBalanceData = await Wallet.createQueryBuilder("wallet")
            .select("SUM(wallet.balance)", "total")
            .getRawOne();
        const totalBalance = parseFloat(totalBalanceData.total || "0");

        // 2. Gasto en Historias (Día Seleccionado)
        const storiesData = await Storie.createQueryBuilder("s")
            .select("SUM(s.total_pagado)", "total")
            .where("s.createdAt >= :start AND s.createdAt <= :end", { start, end })
            .getRawOne();
        const totalStories = parseFloat(storiesData.total || "0");

        // 3. Suscripciones (Día Seleccionado)
        // Necesitamos unir con la tabla Subscription para filtrar por plan (BUSINESS vs others)
        const subsQuery = Transaction.createQueryBuilder("t")
            .leftJoin(Subscription, "sub", "t.reference = CAST(sub.id AS VARCHAR)")
            .select([
                "SUM(CASE WHEN sub.plan = 'business' THEN t.amount ELSE 0 END) AS businessTotal",
                "SUM(CASE WHEN sub.plan != 'business' OR sub.id IS NULL THEN t.amount ELSE 0 END) AS userTotal"
            ])
            .where("t.created_at >= :start AND t.created_at <= :end", { start, end })
            .andWhere("t.reason = :reason", { reason: TransactionReason.SUBSCRIPTION })
            .andWhere("t.type = 'debit'")
            .andWhere("t.status = 'APPROVED'");

        const subsData = await subsQuery.getRawOne();
        const totalUserSubs = parseFloat(subsData.userTotal || "0");
        const totalBusinessSubs = parseFloat(subsData.businessTotal || "0");

        return {
            totalBalance,
            dailyStats: {
                stories: totalStories,
                userSubscriptions: totalUserSubs,
                businessSubscriptions: totalBusinessSubs
            }
        };
    }

    /**
     * 📅 Obtener resumen financiero diario (Cierre) e Historial
     */
    async getDailyFinancialSummary(dateStr: string): Promise<any> {
        // 1. Verificar si ya está cerrado
        const existingClosing = await FinancialClosing.findOne({
            where: { closingDate: dateStr },
            relations: ['closedBy']
        });

        // Parse Date Intervals (Adjusted for Ecuador UTC-5)
        const { DateUtils } = await import("../../../utils/date-utils");
        const { start, end } = DateUtils.getDayRange(dateStr);

        // 2. INGRESOS: Recargas Aprobadas
        const recharges = await RechargeRequest.find({
            where: {
                status: StatusRecarga.APROBADO
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
        const expensesQuery = Transaction.createQueryBuilder("t")
            .leftJoinAndSelect("t.wallet", "w")
            .leftJoinAndSelect("w.user", "u")
            .where("t.created_at >= :start AND t.created_at <= :end", { start, end }) // Better date comparison
            .andWhere("t.type = 'debit'")
            .andWhere("t.reason != :reason", { reason: TransactionReason.ADMIN_ADJUSTMENT });

        const expensesDetails = await expensesQuery.getMany();

        const totalExpenses = expensesDetails.reduce((sum, t) => sum + Number(t.amount), 0);

        const expensesByType = expensesDetails.reduce((acc, t) => {
            if (t.reason === TransactionReason.SUBSCRIPTION) acc.subscriptions += Number(t.amount);
            else acc.stories += Number(t.amount);
            return acc;
        }, { stories: 0, subscriptions: 0 });


        return {
            date: dateStr,
            isClosed: !!existingClosing,
            closingData: existingClosing ? await (async () => {
                const rawKey = existingClosing.backupFileUrl;
                // Sanitize: If it's a full URL, extract key. If starts with 'uploads/', assume it's key.
                let key = rawKey;
                if (rawKey.startsWith('http')) {
                    try {
                        key = new URL(rawKey).pathname.substring(1); // strips leading slash
                    } catch (e) { key = rawKey; }
                }

                // Verify existence
                const exists = await UploadFilesCloud.checkFileExists({
                    bucketName: envs.AWS_BUCKET_NAME,
                    key: key
                });

                if (!exists) {
                    return { ...existingClosing, backupFileUrl: null };
                }

                return {
                    ...existingClosing,
                    backupFileUrl: await UploadFilesCloud.getFile({
                        bucketName: envs.AWS_BUCKET_NAME,
                        key: key
                    })
                };
            })() : null,
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
    }

    /**
     * 🔒 Cerrar día financiero
     */
    async closeFinancialDay(data: { date: string, totalIncome: number, totalExpenses: number, fileUrl: string, adminId: string, totalCount: number }) {
        const existing = await FinancialClosing.findOne({ where: { closingDate: data.date } });
        if (existing) {
            throw CustomError.badRequest("El día ya se encuentra cerrado.");
        }

        const closing = new FinancialClosing();
        closing.closingDate = data.date;
        closing.totalIncome = data.totalIncome;
        closing.totalExpenses = data.totalExpenses;
        closing.backupFileUrl = data.fileUrl;
        closing.totalRechargesCount = data.totalCount;
        closing.closedBy = { id: data.adminId } as any;

        return await closing.save();
    }

    /**
     * 💳 Iniciar recarga con PayPhone (Tarjeta)
     */
    async initializePayphoneRecharge(userId: string, amount: number) {
        if (amount <= 0) throw CustomError.badRequest("Monto inválido");

        // 1. Obtener credenciales globales de PayPhone
        const settings = await GlobalSettings.findOne({ where: {} });
        if (!settings?.payphoneToken || !settings?.payphoneStoreId) {
            throw CustomError.badRequest("La pasarela de pago PayPhone no está configurada por el administrador.");
        }

        // 2. Crear solicitud de recarga pendiente
        const recharge = new RechargeRequest();
        recharge.user = { id: userId } as any;
        recharge.amount = amount;
        recharge.bank_name = "PayPhone (Tarjeta)";
        recharge.payment_method = "CARD";
        recharge.status = StatusRecarga.PENDIENTE;
        recharge.receipt_image = "https://pay.payphonetodoesposible.com/images/Logotipo.png"; // Placeholder representativo
        recharge.transaction_date = new Date();
        await recharge.save();

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
    }

    /**
     * ✅ Confirmación automática de recarga PayPhone
     */
    async confirmPayphoneRecharge(rechargeId: string, remoteId: number | string) {
        const recharge = await RechargeRequest.findOne({
            where: { id: rechargeId },
            relations: ["user"]
        });

        if (!recharge) throw CustomError.notFound("Solicitud de recarga no encontrada");
        if (recharge.status === StatusRecarga.APROBADO) return { message: "Recarga ya procesada" };

        const settings = await GlobalSettings.findOne({ where: {} });
        if (!settings?.payphoneToken) throw CustomError.internalServer("Error de configuración PayPhone");

        // Verificar con PayPhone usando Get en lugar de Confirm para links de tipo Prepare
        const { PayphoneService } = await import("../payphone.service");
        
        console.log(`🔍 [Wallet PayPhone] Verificando estado | Recharge ID: ${rechargeId} | Remote ID: ${remoteId}`);
        const verification = await PayphoneService.getTransactionByClientTxId(rechargeId, settings.payphoneToken);
        console.log(`📡 [Wallet PayPhone] Respuesta de Verificación:`, JSON.stringify(verification));

        if (verification && (
            verification.transactionStatus === "Approved" || 
            verification.status === "Approved" ||
            verification.transactionStatus === "approved" ||
            verification.statusCode === 3
        )) {
            // Acreditar saldo directamente
            const wallet = await this.getWalletByUserId(recharge.user.id);
            const previousBalance = Number(wallet.balance);
            const amount = Number(recharge.amount);
            
            wallet.balance = previousBalance + amount;
            await wallet.save();

            // Actualizar solicitud
            recharge.status = StatusRecarga.APROBADO;
            recharge.external_transaction_id = remoteId.toString();
            recharge.resolved_at = new Date();
            await recharge.save();

            // Crear registro de transacción
            const transaction = new Transaction();
            transaction.wallet = wallet;
            transaction.amount = amount;
            transaction.type = 'credit';
            transaction.status = 'APPROVED'; // Aprobado automáticamente
            transaction.reason = TransactionReason.RECHARGE;
            transaction.origin = TransactionOrigin.USER;
            transaction.previousBalance = previousBalance;
            transaction.resultingBalance = Number(wallet.balance);
            transaction.observation = "Recarga automática con PayPhone (Tarjeta)";
            transaction.reference = recharge.id;
            await transaction.save();

            console.log(`💰 [Wallet PayPhone] Saldo Acreditado Exitosamente | User ID: ${recharge.user.id} | Nuevo Saldo: ${wallet.balance}`);

            return { success: true, newBalance: wallet.balance };
        } else {
            recharge.status = StatusRecarga.RECHAZADO;
            recharge.admin_comment = "Pago denegado por PayPhone";
            await recharge.save();
            
            console.error(`❌ [Wallet PayPhone] Confirmación Fallida o Rechazada | Recharge ID: ${rechargeId}`);
            
            throw CustomError.badRequest("El pago no fue aprobado por el banco.");
        }
    }
}
