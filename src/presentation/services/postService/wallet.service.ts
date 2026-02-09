import { Wallet, WalletStatus, GlobalSettings, Storie, FinancialClosing, RechargeRequest, StatusRecarga } from "../../../data";
import { Transaction, TransactionType, TransactionOrigin, TransactionReason } from "../../../data/postgres/models/transactionType.model";
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

        const query = Transaction.createQueryBuilder("t")
            .leftJoinAndSelect("t.admin", "admin")
            .where("t.walletId = :walletId", { walletId })
            .orderBy("t.created_at", "DESC")
            .skip(skip)
            .take(limit);

        if (startDate && endDate) {
            query.andWhere("t.created_at BETWEEN :start AND :end", { start: startDate, end: endDate });
        }

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
    async getGlobalWalletStats(period: 'today' | '7days' | '30days' | 'all' = 'today'): Promise<any> {
        const startOfPeriod = new Date();
        if (period === 'today') startOfPeriod.setHours(0, 0, 0, 0);
        if (period === '7days') startOfPeriod.setDate(startOfPeriod.getDate() - 7);
        if (period === '30days') startOfPeriod.setDate(startOfPeriod.getDate() - 30);
        if (period === 'all') startOfPeriod.setFullYear(2000);

        // 1. Resumen General
        const totalBalanceData = await Wallet.createQueryBuilder("wallet")
            .select("SUM(wallet.balance)", "total")
            .getRawOne();
        const totalBalance = parseFloat(totalBalanceData.total || "0");
        const positivewallets = await Wallet.createQueryBuilder("w").where("w.balance > 0").getCount();

        // 2. Regularizaciones
        const regularizations = await Transaction.createQueryBuilder("t")
            .where("t.created_at >= :start", { start: startOfPeriod })
            .andWhere("t.reason = :reason", { reason: TransactionReason.ADMIN_ADJUSTMENT })
            .getCount();

        // 3. Gastos: Historias (Storie) vs Suscripciones (Transaction)
        // A) Historias: Total pagado en Storie
        const storiesData = await Storie.createQueryBuilder("s")
            .select("SUM(s.total_pagado)", "total")
            .where("s.createdAt >= :start", { start: startOfPeriod })
            .getRawOne();
        const totalStories = parseFloat(storiesData.total || "0");

        // B) Suscripciones: Total debitado por SUBSCRIPTION en Transacciones
        const subsData = await Transaction.createQueryBuilder("t")
            .select("SUM(t.amount)", "total")
            .where("t.created_at >= :start", { start: startOfPeriod })
            .andWhere("t.reason = :reason", { reason: TransactionReason.SUBSCRIPTION })
            .andWhere("t.type = :type", { type: 'debit' })
            .getRawOne();
        const totalSubscriptions = parseFloat(subsData.total || "0");

        // 4. Top Gastadores (Total Debitado excluyendo admin)
        const topSpendersRaw = await Transaction.createQueryBuilder("t")
            .leftJoinAndSelect("t.wallet", "wallet")
            .leftJoinAndSelect("wallet.user", "user")
            .select(["user.name AS name", "user.surname AS surname", "user.email AS email", "SUM(t.amount) AS totalSpent"])
            .where("t.created_at >= :start", { start: startOfPeriod })
            .andWhere("t.type = 'debit'")
            .andWhere("t.reason != :reason", { reason: TransactionReason.ADMIN_ADJUSTMENT })
            .groupBy("wallet.id, user.id")
            .orderBy("SUM(t.amount)", "DESC")
            .limit(5)
            .getRawMany();

        // 5. Top Acumuladores (Mayor Saldo Actual)
        const topSaversRaw = await Wallet.createQueryBuilder("w")
            .leftJoinAndSelect("w.user", "user")
            .orderBy("w.balance", "DESC")
            .take(5)
            .getMany();

        return {
            totalBalance,
            usersWithBalance: positivewallets,
            averageBalance: positivewallets > 0 ? (totalBalance / positivewallets).toFixed(2) : 0,
            regularizationsInPeriod: regularizations,
            spendingStats: {
                stories: totalStories,
                subscriptions: totalSubscriptions
            },
            topSpenders: topSpendersRaw.map(r => ({
                name: `${r.name} ${r.surname}`,
                email: r.email,
                amount: parseFloat(r.totalSpent || "0")
            })),
            topSavers: topSaversRaw.map(w => ({
                name: `${w.user.name} ${w.user.surname}`,
                email: w.user.email,
                amount: Number(w.balance)
            }))
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
        // dateStr is YYYY-MM-DD
        const start = new Date(`${dateStr}T00:00:00-05:00`);
        const end = new Date(`${dateStr}T23:59:59.999-05:00`);

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
}
