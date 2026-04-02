
import { Between, In, LessThanOrEqual, MoreThanOrEqual, IsNull, Not } from "typeorm";
import {
    Pedido,
    EstadoPedido,
    MetodoPago,
    RechargeRequest,
    StatusRecarga,
    Transaction,
    TransactionReason,
    UserMotorizado,
    Wallet,
    Negocio,
    TransaccionMotorizado,
    Subscription,
    BalanceNegocio,
    EstadoBalance,
    Storie
} from "../../../data";
import { FinancialClosing } from "../../../data/postgres/models/financial/FinancialClosing";
import { Useradmin } from "../../../data/postgres/models/useradmin.model";
import { UploadFilesCloud } from "../../../config/upload-files-cloud-adapter";
import { envs } from "../../../config";
import { CustomError } from "../../../domain";
import { DateUtils } from "../../../utils/date-utils";

export class FinancialService {

    // ===================================
    // 📊 MASTER SUMMARY
    // ===================================
    // ===================================
    // 🔍 APP REVENUE DETAILS (AUDITABLE)
    // ===================================
    async getAppRevenueDetails(date: Date, type: string, page: number = 1, limit: number = 20) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        const skip = (page - 1) * limit;

        let data = [];
        let total = 0;

        switch (type) {
            case 'suscripciones': // Suscripciones Usuarios (reference IS NOT NULL)
                const [subsUser, countSubUser] = await Transaction.findAndCount({
                    where: {
                        reason: TransactionReason.SUBSCRIPTION,
                        created_at: Between(start, end),
                        reference: Not(IsNull())
                    },
                    relations: ["wallet", "wallet.user"], // Removed wallet.user.subscriptions redundant join for list
                    order: { created_at: "DESC" },
                    take: limit,
                    skip: skip
                });

                data = subsUser.map(t => ({
                    id: t.id,
                    user: `${t.wallet?.user?.name || ''} ${t.wallet?.user?.surname || ''}`,
                    email: t.wallet?.user?.email,
                    amount: Math.abs(Number(t.amount)),
                    paymentDate: t.created_at,
                    daysBought: t.daysBought || '-',
                    prevEndDate: t.prevEndDate ? new Date(t.prevEndDate).toISOString() : 'N/A',
                    newEndDate: t.newEndDate ? new Date(t.newEndDate).toISOString() : 'N/A',
                    receiptImage: null, // No receipt for internal wallet movements usually
                    walletBalance: Number(t.wallet?.balance || 0),
                    status: 'COBRADO',
                    concept: t.observation || 'Suscripción Usuario'
                }));
                total = countSubUser;
                break;

            case 'suscripcionesNegocios': // Suscripciones Negocios (reference IS NULL)
                const [subsBiz, countSubBiz] = await Transaction.findAndCount({
                    where: {
                        reason: TransactionReason.SUBSCRIPTION,
                        created_at: Between(start, end),
                        reference: IsNull()
                    },
                    relations: ["wallet", "wallet.user"],
                    order: { created_at: "DESC" },
                    take: limit,
                    skip: skip
                });

                data = subsBiz.map(t => {
                    // Extract Business Name from Observation if possible "Pago de suscripción: [Name]"
                    let businessName = 'Desconocido';
                    if (t.observation && t.observation.includes('Pago de suscripción:')) {
                        businessName = t.observation.split('Pago de suscripción:')[1].trim();
                    }

                    return {
                        id: t.id,
                        user: `${t.wallet?.user?.name || ''} ${t.wallet?.user?.surname || ''}`, // Owner
                        businessName: businessName,
                        amount: Math.abs(Number(t.amount)),
                        paymentDate: t.created_at,
                        daysBought: t.daysBought || '30',
                        prevEndDate: t.prevEndDate ? new Date(t.prevEndDate).toISOString() : 'N/A',
                        newEndDate: t.newEndDate ? new Date(t.newEndDate).toISOString() : 'N/A',
                        status: 'COBRADO_WALLET',
                        observation: t.observation
                    };
                });
                total = countSubBiz;
                break;

            case 'historias':
                const [storiesTx, countStories] = await Transaction.findAndCount({
                    where: {
                        reason: TransactionReason.STORIE,
                        created_at: Between(start, end),
                        status: 'APPROVED'
                    },
                    relations: ["wallet", "wallet.user"],
                    order: { created_at: "DESC" },
                    take: limit,
                    skip: skip
                });

                // data = await Promise.all(storiesTx.map(async (t) => {

                data = await Promise.all(storiesTx.map(async (t) => {
                    let storyDetail = 'Historia';
                    if (t.reference) {
                        const s = await Storie.findOne({ where: { id: t.reference } });
                        if (s) {
                            storyDetail = s.description || `Historia #${s.id.slice(0, 5)}`;
                        }
                    } else if (t.observation && t.observation.toLowerCase().includes('historia')) {
                        storyDetail = t.observation;
                    }

                    return {
                        id: t.id,
                        email: t.wallet?.user?.email || 'N/A',
                        story: storyDetail,
                        amount: Math.abs(Number(t.amount)),
                        date: t.created_at,
                        previousBalance: Number(t.previousBalance || 0),
                        resultingBalance: Number(t.resultingBalance || 0),
                        type: 'Egreso',
                        concept: 'Pago de historia'
                    };
                }));
                total = countStories;
                break;

            case 'comisionProductos':
                const [ordersProd, countProd] = await Pedido.findAndCount({
                    where: {
                        estado: EstadoPedido.ENTREGADO,
                        updatedAt: Between(start, end)
                    },
                    relations: ["cliente", "negocio", "productos", "productos.producto"],
                    order: { updatedAt: "DESC" },
                    take: limit,
                    skip: skip
                });

                data = ordersProd.map(o => {
                    // Use new field if available, otherwise fallback to old/calculation
                    let comVal = Number(o.total_comision_productos || 0);
                    if (comVal === 0) {
                        comVal = Number(o.ganancia_app_producto || 0);
                        if (comVal === 0 && o.comisionTotal > 0) {
                            comVal = Number(o.comisionTotal) - Number(o.comision_app_domicilio || 0);
                        }
                        if (comVal === 0 && o.productos?.length > 0) {
                            comVal = o.productos.reduce((acc, p) => acc + (Number(p.comision_producto) * p.cantidad), 0);
                        }
                    }

                    const buyer = o.cliente;
                    return {
                        id: o.id,
                        buyer: `${buyer?.name || ''} ${buyer?.surname || ''}`,
                        shop: o.negocio?.nombre || 'Desconocido',
                        totalSale: Number(o.total || 0),
                        deliveryCost: Number(o.costoEnvio || 0),
                        commission: comVal,
                        totalNegocio: Number(o.totalNegocio || 0),
                        date: o.updatedAt,
                        status: o.estado,
                        paymentMethod: o.metodoPago,
                        // Persisted Fields for Transparency
                        total_precio_venta_publico: Number(o.total_precio_venta_publico || 0),
                        total_precio_app: Number(o.total_precio_app || 0),
                        total_comision_productos: Number(o.total_comision_productos || 0),
                        pago_motorizado: Number(o.pago_motorizado || 0),
                        comision_moto_app: Number(o.comision_moto_app || 0),
                        productList: o.productos.map(pp => ({
                            name: pp.producto?.nombre || 'Producto eliminado',
                            quantity: pp.cantidad,
                            priceClient: Number(pp.precio_venta),
                            priceLocal: Number(pp.precio_app),
                            commission: Number(pp.comision_producto),
                            subtotal: Number(pp.subtotal)
                        }))
                    };
                });
                total = countProd;
                break;

            case 'comisionDomicilio':
                const [ordersDel, countDel] = await Pedido.findAndCount({
                    where: {
                        estado: EstadoPedido.ENTREGADO,
                        updatedAt: Between(start, end)
                    },
                    relations: ["motorizado"],
                    order: { updatedAt: "DESC" },
                    take: limit,
                    skip: skip
                });

                data = ordersDel.map(o => {
                    const moto = (o.motorizado as any);

                    // Use new field as priority
                    let comDom = Number(o.comision_moto_app || 0);

                    if (comDom === 0) {
                        comDom = Number(o.comision_app_domicilio || 0);
                        if (comDom === 0) {
                            comDom = Number(o.costoEnvio || 0) * 0.20; // Fallback legacy
                        }
                    }

                    return {
                        id: o.id,
                        driver: moto ? `${moto.nombre || moto.name || ''} ${moto.apellido || moto.surname || ''}` : 'Sin Asignar',
                        orderId: o.id,
                        deliveryCost: Number(o.costoEnvio || 0),
                        commission: comDom,
                        date: o.updatedAt,
                        status: o.estado,
                        // Persisted Fields for Transparency
                        total_precio_venta_publico: Number(o.total_precio_venta_publico || 0),
                        total_precio_app: Number(o.total_precio_app || 0),
                        total_comision_productos: Number(o.total_comision_productos || 0),
                        pago_motorizado: Number(o.pago_motorizado || 0),
                        comision_moto_app: Number(o.comision_moto_app || 0),
                        totalSale: Number(o.total || 0),
                        totalNegocio: Number(o.totalNegocio || 0),
                        paymentMethod: o.metodoPago
                    };
                });
                total = countDel;
                break;

            default:
                throw CustomError.badRequest("Invalid revenue type");
        }

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    // ===================================
    // 📊 MASTER SUMMARY
    // ===================================
    async getFinancialSummary(startDate: Date, endDate: Date) {
        // Fix: Ensure endDate covers the entire day in Ecuador Time (UTC-5)
        // Matches logic in RechargeRequestService.filterByDateRangePaginated
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // 🔍 CHECK FOR HISTORICAL CLOSING SNAPSHOT
        const dateStr = DateUtils.toLocalDateString(endDate);
        const closingSnapshot = await FinancialClosing.findOne({ where: { closingDate: dateStr } });

        // 1. RECARGAS (DINERO REAL EN BANCO)
        const recharges = await RechargeRequest.createQueryBuilder("r")
            .select("SUM(r.amount)", "total")
            .addSelect("COUNT(r.id)", "count")
            .where("r.status = :status", { status: StatusRecarga.APROBADO })
            .andWhere("r.payment_method <> 'CASH'") // EXCLUDE CASH TO AVOID DOUBLE COUNTING WITH MANUALTX
            .andWhere("r.created_at BETWEEN :start AND :end", { start: start, end: end })
            .getRawOne();

        const totalRecargasAprobadas = Number(recharges.total || 0);

        // 1.5. RECARGAS MANUALES (ADMIN_ADJUSTMENT / CASH_RECHARGE)
        // A. SOLO EFECTIVO (CASH_RECHARGE)
        const cashRaw = await Transaction.createQueryBuilder("t")
            .select("SUM(t.amount)", "total")
            .addSelect("COUNT(t.id)", "count")
            .where("t.reason = 'CASH_RECHARGE'")
            .andWhere("t.status = 'APPROVED'")
            .andWhere("t.created_at BETWEEN :start AND :end", { start, end })
            .getRawOne();
        const totalEfectivo = Number(cashRaw.total || 0);

        // B. SOLO AJUSTES (ADMIN_ADJUSTMENT)
        const adjustmentsRaw = await Transaction.createQueryBuilder("t")
            .select("SUM(t.amount)", "total")
            .addSelect("COUNT(t.id)", "count")
            .where("t.reason = 'ADMIN_ADJUSTMENT'")
            .andWhere("t.status = 'APPROVED'")
            .andWhere("t.created_at BETWEEN :start AND :end", { start, end })
            .getRawOne();
        const totalAjustes = Number(adjustmentsRaw.total || 0);

        // C. BREAKDOWN RECARGAS TABLA (TRANSFER vs CARD)
        const transferRaw = await RechargeRequest.createQueryBuilder("r")
            .select("SUM(r.amount)", "total")
            .where("r.status = :status", { status: StatusRecarga.APROBADO })
            .andWhere("r.payment_method = 'TRANSF'")
            .andWhere("r.created_at BETWEEN :start AND :end", { start, end })
            .getRawOne();
        const totalTransferencia = Number(transferRaw.total || 0);

        const cardRaw = await RechargeRequest.createQueryBuilder("r")
            .select("SUM(r.amount)", "total")
            .where("r.status = :status", { status: StatusRecarga.APROBADO })
            .andWhere("r.payment_method = 'CARD'")
            .andWhere("r.created_at BETWEEN :start AND :end", { start, end })
            .getRawOne();
        const totalTarjeta = Number(cardRaw.total || 0);

        const totalRecargasManuales = totalEfectivo + totalAjustes;
        const totalRecargasObjectivo = totalRecargasAprobadas + totalRecargasManuales;
        const countRecargas = Number(recharges.count || 0) + (Number(cashRaw.count || 0) || 0) + (Number(adjustmentsRaw.count || 0) || 0);

        // 2. INGRESOS APP (GANANCIA REAL)
        // A. Suscripciones Usuarios (Transaction -> Reason SUBSCRIPTION + Ref OK)
        const subsUserIncome = await Transaction.createQueryBuilder("t")
            .select("SUM(t.amount)", "total")
            .where("t.reason = :reason", { reason: TransactionReason.SUBSCRIPTION })
            .andWhere("t.reference IS NOT NULL")
            .andWhere("t.created_at BETWEEN :start AND :end", { start: start, end: end })
            .getRawOne();
        const totalSubsUser = Math.abs(Number(subsUserIncome.total || 0));

        // B. Suscripciones Negocios (Transaction -> Reason SUBSCRIPTION + Ref NULL)
        const subsBizIncome = await Transaction.createQueryBuilder("t")
            .select("SUM(t.amount)", "total")
            .where("t.reason = :reason", { reason: TransactionReason.SUBSCRIPTION })
            .andWhere("t.reference IS NULL")
            .andWhere("t.created_at BETWEEN :start AND :end", { start: start, end: end })
            .getRawOne();
        const totalSubsBiz = Math.abs(Number(subsBizIncome.total || 0));

        // C. Historias (Transaction -> Reason STORIE)
        const storiesIncome = await Transaction.createQueryBuilder("t")
            .select("SUM(t.amount)", "total")
            .where("t.reason = :reason", { reason: TransactionReason.STORIE })
            .andWhere("t.created_at BETWEEN :start AND :end", { start: start, end: end })
            .getRawOne();
        const totalStories = Math.abs(Number(storiesIncome.total || 0));

        // D. Orders (Commissions)
        // We look at ENTREGADO and CANCELADO orders in the period
        const orders = await Pedido.find({
            where: {
                estado: In([EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO]),
                updatedAt: Between(start, end)
            },
            relations: ["productos"]
        });

        let totalComisionProductos = 0;
        let totalComisionDomicilios = 0;
        let totalPagoMotorizadosArr = 0;

        // NEW: Financial Reconciliation Accumulators
        let totalDepositoEfectivo = 0; // Cash Orders (Total + Delivery)
        let totalDepositoTransferencia = 0; // Transfer Orders (Delivery + Product Commission)

        for (const order of orders) {
            const isCanceled = order.estado === EstadoPedido.CANCELADO;

            // 1. PRODUCT COMMISSION
            let comProd = Number(order.total_comision_productos || 0);

            if (comProd === 0 && !isCanceled) { // Only fallback for ENTREGADO
                comProd = Number(order.ganancia_app_producto || 0);
                if (comProd === 0 && order.comisionTotal > 0) {
                    comProd = Number(order.comisionTotal) - Number(order.comision_app_domicilio || 0);
                }
                if (comProd === 0 && order.productos?.length > 0) {
                    comProd = order.productos.reduce((acc, p) => acc + (Number(p.comision_producto) * p.cantidad), 0);
                }
            }

            // 2. DELIVERY COMMISSION (App Gain)
            let comDom = Number(order.comision_moto_app || 0);
            if (comDom === 0 && !isCanceled) {
                comDom = Number(order.comision_app_domicilio || 0);
                if (comDom === 0) {
                    comDom = (Number(order.costoEnvio || 0) * 0.20); 
                }
            }

            // 3. MOTORIZADO PAYMENT 
            let pagoMoto = Number(order.pago_motorizado || 0);
            if (pagoMoto === 0 && !isCanceled) {
                pagoMoto = Number(order.ganancia_motorizado || 0);
            }

            // --- ACCUMULATE ---
            if (isCanceled) {
                if (order.metodoPago === MetodoPago.TRANSFERENCIA) {
                    // Local has 100%, App must recover it.
                    totalDepositoTransferencia += Number(order.total || 0);
                }
                // Efvo canceled doesn't affect these totals
            } else {
                // ENTREGADO
                totalComisionProductos += comProd;
                totalComisionDomicilios += comDom;
                totalPagoMotorizadosArr += pagoMoto;

                if (order.metodoPago === MetodoPago.EFECTIVO) {
                    totalDepositoEfectivo += (Number(order.total || 0) + Number(order.costoEnvio || 0));
                } else if (order.metodoPago === MetodoPago.TRANSFERENCIA) {
                    totalDepositoTransferencia += (Number(order.costoEnvio || 0) + comProd);
                }
            }
        }

        const totalIngresosApp = totalSubsUser + totalSubsBiz + totalStories + totalComisionProductos + totalComisionDomicilios;


        // 3. PASIVOS (DEUDAS) - HISTORICAL VS LIVE LOGIC
        let totalSaldoUsuarios = 0;
        let totalPorPagarMotorizados = 0;

        if (closingSnapshot) {
            // ✅ USE HISTORICAL SNAPSHOT
            totalSaldoUsuarios = Number(closingSnapshot.totalUserBalance);
            totalPorPagarMotorizados = Number(closingSnapshot.totalMotorizadoDebt);
        } else {
            // ⚠️ LIVE CALCULATION (Open Days)
            // User Balance Total
            const usersWalletSum = await Wallet.createQueryBuilder("w")
                .select("SUM(w.balance)", "total")
                .getRawOne();
            totalSaldoUsuarios = Number(usersWalletSum.total || 0);

            // Motorizados Info
            const motorizados = await UserMotorizado.find();
            totalPorPagarMotorizados = motorizados.reduce((acc, m) => acc + Number(m.saldo), 0);
        }
        // Note: 'saldo' in Driver is what we owe them (earnings).


        // 4. TIENDAS (Consolidated Logic)
        const { totalPorPagarTiendas, totalPorCobrarTiendas } = await this.calculateShopBalances(startDate, endDate);

        return {
            period: { start: start, end: end },
            bank: {
                totalRecargas: totalRecargasObjectivo,
                countRecargas: countRecargas,
                breakdown: {
                    transferencia: totalTransferencia,
                    tarjeta: totalTarjeta,
                    efectivo: totalEfectivo,
                    ajustes: totalAjustes
                }
            },
            appRevenue: {
                total: totalIngresosApp + totalRecargasManuales, 
                breakdown: {
                    suscripciones: totalSubsUser,
                    suscripcionesNegocios: totalSubsBiz,
                    historias: totalStories,
                    comisionProductos: totalComisionProductos,
                    comisionDomicilio: totalComisionDomicilios,
                    recargasManuales: totalRecargasManuales
                }
            },
            deposits: {
                cash: totalDepositoEfectivo,
                transferApp: totalDepositoTransferencia
            },
            liabilities: {
                usuarios: totalSaldoUsuarios,
                motorizados: totalPorPagarMotorizados,
                tiendasPagar: totalPorPagarTiendas, 
                tiendasCobrar: totalPorCobrarTiendas 
            },
            expenses: {
                motorizados: totalPagoMotorizadosArr
            },
            alert: (totalRecargasObjectivo - totalIngresosApp),
            isClosed: !!closingSnapshot
        };
    }

    async getUnifiedTransactions(date: Date, types?: string[], statuses?: string[]) {
        const { start, end } = DateUtils.getDayRange(date);

        // 1. Fetch Manual Transactions (The Ledger)
        const manualTxQuery = Transaction.createQueryBuilder("t")
            .leftJoinAndSelect("t.wallet", "wallet")
            .leftJoinAndSelect("wallet.user", "user")
            .leftJoinAndSelect("t.admin", "admin")
            .where("(t.reason = 'ADMIN_ADJUSTMENT' OR t.reason = 'CASH_RECHARGE' OR t.reason = 'RECHARGE')", { })
            .andWhere("t.created_at BETWEEN :start AND :end", { start, end })
            .orderBy("t.created_at", "DESC");

        if (statuses && statuses.length > 0) {
            const dbStatuses = statuses.map(s => {
                const map: any = { 'APROBADO': 'APPROVED', 'PENDIENTE': 'PENDING', 'RECHAZADO': 'REJECTED' };
                return map[s] || s;
            });
            manualTxQuery.andWhere("t.status IN (:...statuses)", { statuses: dbStatuses });
        }

        // Apply types to Transaction (Manual)
        if (types && types.length > 0) {
            const txParts = [];
            if (types.includes('recarga_efectivo')) txParts.push("t.reason = 'CASH_RECHARGE'");
            if (types.includes('recarga_transferencia')) txParts.push("t.reason = 'RECHARGE'");
            if (types.includes('credito_manual')) txParts.push("(t.reason = 'ADMIN_ADJUSTMENT' AND t.type = 'credit')");
            if (types.includes('debito_manual')) txParts.push("(t.reason = 'ADMIN_ADJUSTMENT' AND t.type = 'debit')");

            if (txParts.length > 0) {
                manualTxQuery.andWhere(`(${txParts.join(" OR ")})`);
            } else if (!types.includes('payphone')) {
                manualTxQuery.andWhere("1=0");
            }
        }

        const manualTx = await manualTxQuery.getMany();

        // 2. Recharge Requests (Automatic/Bank)
        const linkedRequestIds = manualTx
            .filter(t => t.reason === TransactionReason.RECHARGE && t.reference)
            .map(t => t.reference);

        const requestsQuery = RechargeRequest.createQueryBuilder("r")
            .leftJoinAndSelect("r.user", "user")
            .leftJoinAndSelect("user.wallet", "wallet")
            .where("r.created_at BETWEEN :start AND :end", { start, end })
            .andWhere("r.payment_method <> 'CASH'");

        if (statuses && statuses.length > 0) {
            requestsQuery.andWhere("r.status IN (:...reqStatuses)", { reqStatuses: statuses });
        }

        // Apply types to RechargeRequest
        if (types && types.length > 0) {
            const reqParts = [];
            if (types.includes('payphone')) reqParts.push("r.payment_method = 'CARD'");
            if (types.includes('recarga_transferencia')) reqParts.push("r.payment_method = 'TRANSFER'");
            
            if (reqParts.length > 0) {
                requestsQuery.andWhere(`(${reqParts.join(" OR ")})`);
            } else if (!types.includes('recarga_efectivo') && !types.includes('credito_manual') && !types.includes('debito_manual')) {
                requestsQuery.andWhere("1=0");
            }
        }

        if (linkedRequestIds.length > 0) {
            requestsQuery.andWhere("r.id NOT IN (:...ids)", { ids: linkedRequestIds });
        }

        const requests = await requestsQuery.getMany();

        const formattedRequests = await Promise.all(requests.map(async (r) => {
            // If approved, try to find the actual transaction to get balance_after
            let balanceAfter = null;
            if (r.status === StatusRecarga.APROBADO) {
                const tx = await Transaction.findOneBy({ reference: r.id });
                if (tx) balanceAfter = Number(tx.resultingBalance);
            }

            return {
                id: r.id,
                created_at: r.created_at,
                amount: Number(r.amount),
                status: r.status,
                bank_name: r.bank_name || 'RECARGA EXTERNA',
                receipt_number: r.receipt_number || 'S/N',
                type: r.payment_method === 'CARD' ? 'payphone' : 'recarga_transferencia',
                user: {
                    name: r.user.name,
                    surname: r.user.surname,
                    email: r.user.email,
                    whatsapp: r.user.whatsapp,
                    current_balance: Number(r.user.wallet?.balance || 0)
                },
                balance_after: balanceAfter
            };
        }));

        const formattedManual = await Promise.all(manualTx.map(async (t) => {
            let imageUrl = null;
            try {
                if (t.receipt_image) {
                    imageUrl = await UploadFilesCloud.getFile({
                        bucketName: envs.AWS_BUCKET_NAME,
                        key: t.receipt_image,
                    });
                }
            } catch (e) {
                console.error("Error fetching receipt image:", e);
            }

            // Attempt to enrich "RECHARGE" with info from the request if reference exists
            let bankInfo = (t.reason === 'RECHARGE' || t.reason === 'CASH_RECHARGE') ? 'BANCO / EFECTIVO' : 'AJUSTE INTERNO';
            let refInfo = t.admin ? `ADMIN: ${t.admin.name}` : 'SISTEMA';

            if (t.reason === TransactionReason.RECHARGE && t.reference) {
                const req = await RechargeRequest.findOneBy({ id: t.reference });
                if (req) {
                    bankInfo = req.bank_name || bankInfo;
                    refInfo = req.receipt_number || refInfo;
                }
            }

            return {
                id: t.id,
                created_at: t.created_at,
                amount: Number(t.amount),
                status: 'APROBADO', // Manuals are approved if they exist
                bank_name: bankInfo,
                receipt_number: refInfo,
                receiptImage: imageUrl,
                type: (t.reason === 'CASH_RECHARGE') ? 'recarga_efectivo' :
                      (t.reason === 'RECHARGE') ? 'recarga_transferencia' :
                      (t.type === 'credit') ? 'credito_manual' : 'debito_manual',
                user: {
                    name: t.wallet.user.name,
                    surname: t.wallet.user.surname,
                    email: t.wallet.user.email,
                    whatsapp: t.wallet.user.whatsapp,
                    current_balance: Number(t.wallet.user.wallet?.balance || 0)
                },
                balance_after: Number(t.resultingBalance)
            };
        }));

        // Combine and Sort
        return [...formattedRequests, ...formattedManual].sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }

    // ===================================
    // 🏪 SHOP RECONCILIATION (CUADRE POR LOCAL)
    // ===================================
    async getShopReconciliation(startDate: Date, endDate: Date) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const dateStr = DateUtils.toLocalDateString(endDate);

        // 1. Get all businesses
        const businesses = await Negocio.find();
        const results = [];

        for (const biz of businesses) {
            // 2. Check for frozen snapshot
            let snapshot = await BalanceNegocio.findOne({
                where: {
                    negocio: { id: biz.id },
                    fecha: dateStr
                },
                relations: ["closedBy"]
            });

            if (snapshot && snapshot.isClosed) {
                // Return Frozen Data
                results.push({
                    id: biz.id,
                    name: biz.nombre,
                    totalVentas: Number(snapshot.totalVendido),
                    transferencias: Number(snapshot.totalTransferencia),
                    efectivo: Number(snapshot.totalEfectivo),
                    comisiones: Number(snapshot.totalComisionApp),
                    saldo_neto: Number(snapshot.balanceFinal),
                    estado: snapshot.balanceFinal > 0 ? "DEBE_PAGAR" : (snapshot.balanceFinal < 0 ? "A_FAVOR_LOCAL" : "CUADRADO"),
                    isClosed: true,
                    comprobanteUrl: snapshot.comprobanteUrl,
                    closedBy: snapshot.closedBy || null
                });
                continue;
            }

            // 3. Live Calculation for unclosed/non-existent days
            const orders = await Pedido.find({
                where: {
                    negocio: { id: biz.id },
                    estado: In([EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO]),
                    updatedAt: Between(start, end)
                }
            });

            let totalVentas = 0;
            let totalTransfer = 0;
            let totalEfectivo = 0;
            let totalComisionApp = 0; // (prod + env)
            let owedToApp = 0; // On Transfers
            let owedToShop = 0; // On Cash

            for (const order of orders) {
                const total = Number(order.total);
                const comProd = Number(order.total_comision_productos || 0);
                const comEnvio = Number(order.costoEnvio || 0);
                // precioApp is what shop should get for products
                const precioApp = Number(order.total_precio_app || (total - comProd - comEnvio));

                if (order.estado === EstadoPedido.CANCELADO) {
                    if (order.metodoPago === MetodoPago.TRANSFERENCIA) {
                        // User Rule: If canceled transfer, local has the money and owes 100% to App (App returns it to client)
                        totalTransfer += total;
                        owedToApp += total;
                    } else {
                        // If Efvo canceled, just show it for visibility but it doesn't affect balances
                        totalEfectivo += total;
                    }
                } else {
                    // ENTREGADO
                    totalVentas += total;
                    totalComisionApp += (comProd + comEnvio);

                    if (order.metodoPago === MetodoPago.TRANSFERENCIA) {
                        totalTransfer += total;
                        // Local has 100%. Local owes App: comProd + comEnvio.
                        owedToApp += (comProd + comEnvio);
                    } else {
                        totalEfectivo += total;
                        // App (Driver) has 100%. App owes Local: precioApp.
                        owedToShop += precioApp;
                    }
                }
            }

            const balanceFinal = Number((owedToApp - owedToShop).toFixed(2));

            results.push({
                id: biz.id,
                name: biz.nombre,
                totalVentas: Number(totalVentas.toFixed(2)),
                transferencias: Number(totalTransfer.toFixed(2)),
                efectivo: Number(totalEfectivo.toFixed(2)),
                comisiones: Number(totalComisionApp.toFixed(2)),
                saldo_neto: balanceFinal,
                estado: balanceFinal > 0 ? "DEBE_PAGAR" : (balanceFinal < 0 ? "A_FAVOR_LOCAL" : "CUADRADO"),
                isClosed: snapshot?.isClosed || false,
                closedBy: snapshot?.closedBy || null,
                comprobanteUrl: snapshot?.comprobanteUrl || null
            });
        }

        // Sign URLs
        const resultsWithSignedUrls = await Promise.all(results.map(async (r) => ({
            ...r,
            comprobanteUrl: await this.signUrlIfNeeded(r.comprobanteUrl)
        })));

        return resultsWithSignedUrls;
    }

    async getShopClosingDetails(shopId: string, date: Date) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);

        const biz = await Negocio.findOne({ where: { id: shopId } });
        if (!biz) throw CustomError.notFound("Negocio no encontrado");

        const orders = await Pedido.find({
            where: {
                negocio: { id: shopId },
                estado: In([EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO]),
                updatedAt: Between(start, end)
            },
            relations: ["cliente"]
        });

        const transfers = [];
        const cash = [];

        for (const o of orders) {
            const isCanceled = o.estado === EstadoPedido.CANCELADO;
            let comProd = Number(o.total_comision_productos || 0);
            let comEnvio = Number(o.costoEnvio || 0);
            let precioApp = Number(o.total_precio_app || (Number(o.total) - comProd - comEnvio));

            // Adjust values for specialized canceled logic
            if (isCanceled) {
                if (o.metodoPago === MetodoPago.TRANSFERENCIA) {
                    // Canceled Transfer: Shop holds 100%, owes 100% to App
                    comProd = Number(o.total); // Set as full debt to app inside comProd for list calc
                    comEnvio = 0;
                    precioApp = 0;
                } else {
                    // Canceled Cash: Nothing owed
                    comProd = 0;
                    comEnvio = 0;
                    precioApp = 0;
                }
            }

            let resolvedComprobante = o.comprobantePagoUrl;
            if (resolvedComprobante && !resolvedComprobante.startsWith('http')) {
                try {
                    resolvedComprobante = await UploadFilesCloud.getFile({
                        bucketName: envs.AWS_BUCKET_NAME,
                        key: resolvedComprobante
                    });
                } catch (e) {
                    console.error("Error signing receipt for shop breakdown:", e);
                }
            }

            const detail = {
                id: o.id,
                date: o.updatedAt,
                client: `${o.cliente?.name || ''} ${o.cliente?.surname || ''}`,
                total: Number(o.total),
                estado: o.estado,
                isCanceled,
                comprobanteUrl: resolvedComprobante,
                breakdown: {
                    totalProducts: isCanceled ? 0 : Number(o.total_precio_venta_publico || (Number(o.total) - comEnvio)),
                    comisionProd: comProd,
                    precioApp: precioApp,
                    totalEnvio: comEnvio,
                    gananciaMoto: isCanceled ? 0 : Number(o.ganancia_motorizado || 0),
                    comisionAppEnvio: isCanceled ? 0 : Number(o.comision_app_domicilio || 0)
                }
            };

            if (o.metodoPago === MetodoPago.TRANSFERENCIA) {
                transfers.push(detail);
            } else {
                cash.push(detail);
            }
        }

        const dateStr = DateUtils.toLocalDateString(date);
        const closure = await BalanceNegocio.findOne({
            where: { negocio: { id: shopId }, fecha: dateStr },
            relations: ["closedBy"]
        });

        return {
            shop: biz.nombre,
            date: dateStr,
            isClosed: closure?.isClosed || false,
            comprobanteUrl: await this.signUrlIfNeeded(closure?.comprobanteUrl || null),
            closedBy: closure?.closedBy || null,
            columns: {
                transferencias: {
                    orders: transfers,
                    total: transfers.reduce((acc, cur) => acc + cur.total, 0),
                    owedToApp: transfers.reduce((acc, cur) => acc + (cur.breakdown.comisionProd + cur.breakdown.totalEnvio), 0)
                },
                efectivo: {
                    orders: cash,
                    total: cash.reduce((acc, cur) => acc + cur.total, 0),
                    owedToShop: cash.reduce((acc, cur) => acc + cur.breakdown.precioApp, 0)
                }
            }
        };
    }

    async closeShopDay(shopId: string, date: Date, admin: Useradmin, comprobanteUrl?: string) {
        // 1. Time check: Only past days
        const todayStr = DateUtils.toLocalDateString(new Date());
        const dateStr = DateUtils.toLocalDateString(date);

        if (dateStr === todayStr) {
            throw CustomError.badRequest("No se puede cerrar el día actual. Solo fechas anteriores.");
        }

        const existing = await BalanceNegocio.findOne({
            where: { negocio: { id: shopId }, fecha: dateStr }
        });
        if (existing && existing.isClosed) throw CustomError.badRequest("Este día ya está cerrado.");

        // Fetch data to verify balance
        const summary = await this.getShopReconciliation(date, date);
        const bizData = summary.find(s => s.id === shopId);
        if (!bizData) throw CustomError.notFound("No hay datos para esta fecha.");

        // 2. Receipt requirement check
        if (bizData.saldo_neto !== 0 && !comprobanteUrl) {
            const payer = bizData.saldo_neto < 0 ? "APP" : "LOCAL";
            throw CustomError.badRequest(`Se requiere el comprobante de depósito (${payer} paga) para cerrar el día.`);
        }

        // Case A (App pays Local) or Case C (Squared)
        const record = existing || new BalanceNegocio();
        record.fecha = dateStr;
        record.negocio = { id: shopId } as any;
        record.totalVendido = bizData.totalVentas;
        record.totalComisionApp = bizData.comisiones;
        record.totalEfectivo = bizData.efectivo;
        record.totalTransferencia = bizData.transferencias;
        record.balanceFinal = bizData.saldo_neto;
        record.isClosed = true;
        record.closedBy = admin;
        record.comprobanteUrl = comprobanteUrl || record.comprobanteUrl;
        record.estado = (bizData.saldo_neto === 0 || record.comprobanteUrl) ? EstadoBalance.LIQUIDADO : EstadoBalance.PENDIENTE;

        await record.save();

        return { success: true, message: "Día cerrado correctamente", data: record };
    }

    private async signUrlIfNeeded(keyOrUrl: string | null): Promise<string | null> {
        if (!keyOrUrl) return null;
        if (typeof keyOrUrl !== 'string') return keyOrUrl;
        if (keyOrUrl.startsWith('http')) return keyOrUrl;

        try {
            return await UploadFilesCloud.getFile({
                bucketName: envs.AWS_BUCKET_NAME,
                key: keyOrUrl
            });
        } catch (error) {
            console.error("Error signing URL:", error);
            return keyOrUrl;
        }
    }

    async uploadShopClosingReceipt(shopId: string, date: string, file: Express.Multer.File) {
        // Just upload, don't check for snapshot or close day.
        try {
            const key = await UploadFilesCloud.uploadSingleFile({
                bucketName: envs.AWS_BUCKET_NAME,
                key: `financial/shop-closings/${shopId}-${date}-${Date.now()}.png`,
                body: file.buffer,
                contentType: file.mimetype,
                isReceipt: true
            });

            const url = await UploadFilesCloud.getFile({
                bucketName: envs.AWS_BUCKET_NAME,
                key
            });

            return { success: true, url, key };
        } catch (error) {
            throw CustomError.internalServer("Error subiendo comprobante");
        }
    }

    // Helper for Summary
    private async calculateShopBalances(start: Date, end: Date) {
        const shops = await this.getShopReconciliation(start, end);
        let totalPagar = 0; // App owes Shop (Saldo < 0)
        let totalCobrar = 0; // Shop owes App (Saldo > 0)

        shops.forEach(s => {
            if (s.saldo_neto < 0) totalPagar += Math.abs(s.saldo_neto);
            else totalCobrar += s.saldo_neto;
        });

        return { totalPorPagarTiendas: totalPagar, totalPorCobrarTiendas: totalCobrar };
    }

    // ===================================
    // 🏍️ DRIVER RECONCILIATION
    // ===================================
    async getDriverReconciliation(startDate: Date, endDate: Date) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        // Only show active drivers or those with activity
        const drivers = await UserMotorizado.find();

        // This is tricky. User wants "Total acreditado", "Total retirado" in period?
        // Or "Total accumulated"?
        // Prompt: "Por motorizado: Total acreditado, Total retirado, Saldo pendiente (Debt)"
        // "Saldo pendiente" is usually the current live balance.
        // "Acreditado/Retirado" should be over the period.

        const report = [];

        for (const driver of drivers) {
            // Stats in period
            const { incomeSum } = await TransaccionMotorizado.createQueryBuilder("tm")
                .select("SUM(tm.monto)", "incomeSum")
                .where("tm.motorizadoId = :id", { id: driver.id })
                .andWhere("tm.tipo = :type", { type: "GANANCIA_ENVIO" })
                .andWhere("tm.createdAt BETWEEN :start AND :end", { start: start, end: end })
                .getRawOne() || { incomeSum: 0 };

            const { withdrawalSum } = await TransaccionMotorizado.createQueryBuilder("tm")
                .select("SUM(tm.monto)", "withdrawalSum")
                .where("tm.motorizadoId = :id", { id: driver.id })
                .andWhere("tm.tipo = :type", { type: "RETIRO" })
                .andWhere("tm.createdAt BETWEEN :start AND :end", { start: start, end: end })
                .getRawOne() || { withdrawalSum: 0 };

            report.push({
                id: driver.id,
                name: `${driver.name} ${driver.surname}`,
                acreditado: Number(incomeSum || 0),
                retirado: Math.abs(Number(withdrawalSum || 0)),
                saldo_pendiente: Number(driver.saldo) // Live balance
            });
        }

        return report;
    }

    // ===================================
    // 🔐 DAILY CLOSING
    // ===================================

    // A. Upload Statement (S3)
    async uploadBankStatement(file: Express.Multer.File) {
        if (!file) throw CustomError.badRequest("Archivo requerido");
        try {
            const key = await UploadFilesCloud.uploadSingleFile({
                bucketName: envs.AWS_BUCKET_NAME,
                key: `financial/statements/${Date.now()}-${file.originalname}`,
                body: file.buffer,
                contentType: file.mimetype,
            });
            const url = await UploadFilesCloud.getOptimizedUrls({
                bucketName: envs.AWS_BUCKET_NAME,
                key
            });
            return { url };
        } catch (error) {
            throw CustomError.internalServer("Error subiendo el estado de cuenta");
        }
    }

    // B. Get Day Status
    async getDayStatus(date: Date) {
        const dateStr = date.toISOString().split('T')[0];
        const closing = await FinancialClosing.findOne({
            where: { closingDate: dateStr },
            relations: ["closedBy"]
        });

        return {
            isClosed: !!closing,
            details: closing || null
        };
    }

    // C. Close Day (Logic)
    async closeDay(date: Date, statementUrl: string, adminUser: Useradmin) {
        const dateStr = date.toISOString().split('T')[0];

        // 1. Check if already closed
        const existing = await FinancialClosing.findOne({ where: { closingDate: dateStr } });
        if (existing) throw CustomError.badRequest("El día ya está cerrado, no se puede sobrescribir.");

        // 2. Validate S3 URL
        if (!statementUrl.includes(envs.AWS_BUCKET_NAME)) {
            // throw CustomError.badRequest("URL de archivo inválida"); 
            // Warning: Maybe user pasted external link? Let's allow but maybe warn log.
        }

        // 3. Snapshot Data (Freeze)
        // We reuse master summary logic for the snapshot
        const summary = await this.getFinancialSummary(date, date);

        // 4. Save
        const closing = new FinancialClosing();
        closing.closingDate = dateStr;
        closing.closedBy = adminUser;
        closing.backupFileUrl = statementUrl;

        // Save Snapshot Values
        if (summary) {
            closing.totalRechargesCount = summary.bank.countRecargas; // Map count
            closing.totalIncome = summary.appRevenue.total; // Map to available field
            closing.totalExpenses = 0; // Or calculate if needed
            closing.totalUserBalance = summary.liabilities.usuarios;
            closing.totalMotorizadoDebt = summary.liabilities.motorizados;
            // No snapshotData field in entity
        }

        await closing.save();

        return { success: true, message: "Día cerrado exitosamente" };
    }

    // ===================================
    // 🚨 PENDING CLOSINGS (GLOBAL)
    // ===================================
    async getPendingShopClosings() {
        // Strategy:
        // 1. Get all orders from last 60 days (reasonable window) grouped by Shop + Date
        // 2. Get all BalanceNegocio entries from last 60 days
        // 3. Diff: Any (Shop+Date) with orders but NO (BalanceNegocio.isClosed=true) is pending
        // 4. Also include any BalanceNegocio.isClosed=false (explicitly pending)

        const lookbackDays = 60;
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - lookbackDays);
        limitDate.setHours(0, 0, 0, 0);

        // A. Aggregate Orders: "Days with activity"
        // Note: Using raw query builder on Pedido repository
        const activeDays = await Pedido.createQueryBuilder("p")
            .select("DATE(p.updatedAt)", "date")
            .addSelect("p.negocioId", "shopId")
            .addSelect("SUM(p.total)", "total")
            .where("p.updatedAt >= :limit", { limit: limitDate })
            .andWhere("p.estado = :status", { status: EstadoPedido.ENTREGADO })
            .groupBy("DATE(p.updatedAt), p.negocioId")
            .getRawMany();

        // B. Get Closed Days
        const closedDays = await BalanceNegocio.find({
            where: {
                fecha: MoreThanOrEqual(limitDate.toISOString().split('T')[0])
            },
            relations: ["negocio"]
        });

        // Map closed days for fast lookup: "shopId|dateString"
        const closedMap = new Set();
        closedDays.forEach(b => {
            // If record exists and isClosed, it's done.
            // If record exists and NOT closed (PENDIENTE), it's definitely pending, but handled by logic below (it won't be in closedMap)
            if (b.isClosed) {
                closedMap.add(`${b.negocio.id}|${b.fecha}`);
            }
        });

        let pending = [];

        // C. Filter
        const uniqueActiveDays = new Map(); // Avoid duplicates if query returns multiple rows per group (shouldn't with group by)

        // Enrich Shop Names Map
        const shopIds = [...new Set(activeDays.map(d => d.shopId))];
        let shopMap = new Map();
        if (shopIds.length > 0) {
            const shops = await Negocio.find({ where: { id: In(shopIds) }, select: ["id", "nombre"] });
            shopMap = new Map(shops.map(s => [s.id, s.nombre]));
        }

        for (const day of activeDays) {
            // day.date type depends on driver, usually Date object or string
            let dateStr = day.date;
            if (day.date instanceof Date) dateStr = day.date.toISOString().split('T')[0];
            else if (typeof day.date === 'string' && day.date.includes('T')) dateStr = day.date.split('T')[0];

            const key = `${day.shopId}|${dateStr}`;

            // Skip today
            const todayStr = new Date().toISOString().split('T')[0];
            if (dateStr === todayStr) continue;

            if (!closedMap.has(key)) {
                pending.push({
                    shopId: day.shopId,
                    shopName: shopMap.get(day.shopId) || 'Desconocido',
                    date: dateStr,
                    total: Number(day.total),
                    status: 'PENDIENTE'
                });
            }
        }

        // Filter out items with total 0 just in case
        pending = pending.filter(p => p.total > 0);

        // Sort by Date Desc
        return pending.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    // ===================================
    // 🏍️ DRIVER MOVEMENTS (MOVIMIENTOS MOTORIZADOS)
    // ===================================
    public async getMovimientosMotorizados(startDate: Date, endDate: Date) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0); // Start of day Ecuador

        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // End of day Ecuador

        const orders = await Pedido.find({
            where: {
                estado: EstadoPedido.ENTREGADO, // Ensure enum match
                updatedAt: Between(start, end)
            },
            relations: ["motorizado"],
            order: { updatedAt: "DESC" }
        });


        let totalDeuda = 0;
        const movimientos: any[] = [];

        for (const order of orders) {

            const moto = (order.motorizado as any);
            let motorizadoName = 'Motorizado No Encontrado';
            if (moto) {
                motorizadoName = `${moto.nombre || moto.name || ''} ${moto.apellido || moto.surname || ''}`.trim();
            }

            // Calculate Driver Gain (Without App Commission)
            let gananciaMoto = 0;

            // 1. Try direct field (NEWEST)
            gananciaMoto = Number((order as any).pago_motorizado || 0);

            // 2. Try legacy field
            if (gananciaMoto === 0) {
                gananciaMoto = Number((order as any).ganancia_motorizado || 0);
            }

            // 3. Fallback calculation
            if (gananciaMoto === 0) {
                let comisionApp = Number((order as any).comision_moto_app || (order as any).comision_app_domicilio || 0);
                if (comisionApp === 0) comisionApp = Number(order.costoEnvio || 0) * 0.20;
                gananciaMoto = Number(order.costoEnvio || 0) - comisionApp;
            }


            // Format Time (Ecuador America/Guayaquil)
            const dateObj = new Date(order.updatedAt);
            const fechaStr = dateObj.toLocaleDateString("en-CA"); // YYYY-MM-DD
            const horaStr = dateObj.toLocaleTimeString("es-EC", { hour: '2-digit', minute: '2-digit', hour12: false }); // HH:mm

            const movObj = {
                motorizado: motorizadoName,
                pedidoId: order.id,
                shortId: `#${order.id.slice(0, 5)}`,
                valor: Number(gananciaMoto.toFixed(2)),
                fecha: fechaStr,
                hora: horaStr,
                fullDate: order.updatedAt
            };
            movimientos.push(movObj);

            totalDeuda += gananciaMoto;
        }

        const result = {
            totalDeuda: Number(totalDeuda.toFixed(2)),
            movimientos: movimientos
        };

        return result;
    }
} 

