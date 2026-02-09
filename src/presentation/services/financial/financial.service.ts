
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
    EstadoBalance
} from "../../../data";
import { FinancialClosing } from "../../../data/postgres/models/financial/FinancialClosing";
import { Useradmin } from "../../../data/postgres/models/useradmin.model";
import { UploadFilesCloud } from "../../../config/upload-files-cloud-adapter";
import { envs } from "../../../config";
import { CustomError } from "../../../domain";

export class FinancialService {

    // ===================================
    // 📊 MASTER SUMMARY
    // ===================================
    // ===================================
    // 🔍 APP REVENUE DETAILS (AUDITABLE)
    // ===================================
    async getAppRevenueDetails(date: Date, type: string, page: number = 1, limit: number = 20) {
        const start = new Date(date);
        start.setUTCHours(5, 0, 0, 0);
        const end = new Date(date);
        end.setUTCHours(28, 59, 59, 999);
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

                const { Storie } = require("../../../data/postgres/models/stories.model");

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
        start.setUTCHours(5, 0, 0, 0);

        const end = new Date(endDate);
        end.setUTCHours(28, 59, 59, 999); // 04:59 AM next day UTC

        // 🔍 CHECK FOR HISTORICAL CLOSING SNAPSHOT
        const dateStr = new Date(endDate).toISOString().split('T')[0];
        const closingSnapshot = await FinancialClosing.findOne({ where: { closingDate: dateStr } });

        // 1. RECARGAS (DINERO REAL EN BANCO)
        const recharges = await RechargeRequest.createQueryBuilder("r")
            .select("SUM(r.amount)", "total")
            .addSelect("COUNT(r.id)", "count")
            .where("r.status = :status", { status: StatusRecarga.APROBADO })
            .andWhere("r.created_at BETWEEN :start AND :end", { start: start, end: end })
            .getRawOne();

        const totalRecargasObjectivo = Number(recharges.total || 0);

        // 2. INGRESOS APP (GANANCIA REAL)
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
        // We look at ENTREGADO orders in the period
        const orders = await Pedido.find({
            where: {
                estado: EstadoPedido.ENTREGADO,
                updatedAt: Between(start, end)
            },
            relations: ["productos"]
        });

        let totalComisionProductos = 0;
        let totalComisionDomicilios = 0;
        let totalPagoMotorizadosArr = 0;

        for (const order of orders) {
            // 1. PRODUCT COMMISSION
            // Try new field first (User requirement: Only new orders fill these)
            let comProd = Number(order.total_comision_productos || 0);

            // Fallback to legacy fields if new field is 0
            if (comProd === 0) {
                comProd = Number(order.ganancia_app_producto || 0);
                if (comProd === 0 && order.comisionTotal > 0) {
                    comProd = Number(order.comisionTotal) - Number(order.comision_app_domicilio || 0);
                }
                if (comProd === 0 && order.productos?.length > 0) {
                    comProd = order.productos.reduce((acc, p) => acc + (Number(p.comision_producto) * p.cantidad), 0);
                }
            }
            totalComisionProductos += comProd;

            // 2. DELIVERY COMMISSION (App Gain)
            // Try new field first
            let comDom = Number(order.comision_moto_app || 0);

            // Fallback to legacy
            if (comDom === 0) {
                comDom = Number(order.comision_app_domicilio || 0);
                if (comDom === 0) {
                    comDom = (Number(order.costoEnvio || 0) * 0.20); // Legacy 20%
                }
            }
            totalComisionDomicilios += comDom;

            // 3. MOTORIZADO PAYMENT (App Expense / Driver Income)
            // Try new field first
            let pagoMoto = Number(order.pago_motorizado || 0);
            if (pagoMoto === 0) {
                pagoMoto = Number(order.ganancia_motorizado || 0);
            }
            totalPagoMotorizadosArr += pagoMoto;
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
                countRecargas: Number(recharges.count || 0)
            },
            appRevenue: {
                total: totalIngresosApp,
                breakdown: {
                    suscripciones: totalSubsUser,
                    suscripcionesNegocios: totalSubsBiz,
                    historias: totalStories,
                    comisionProductos: totalComisionProductos,
                    comisionDomicilio: totalComisionDomicilios
                }
            },
            liabilities: {
                usuarios: totalSaldoUsuarios,
                motorizados: totalPorPagarMotorizados,
                tiendasPagar: totalPorPagarTiendas, // We owe them
                tiendasCobrar: totalPorCobrarTiendas // They owe us
            },
            expenses: {
                motorizados: totalPagoMotorizadosArr
            },
            alert: (totalRecargasObjectivo - totalIngresosApp),
            isClosed: !!closingSnapshot
        };
    }

    // ===================================
    // 🏪 SHOP RECONCILIATION (CUADRE POR LOCAL)
    // ===================================
    async getShopReconciliation(startDate: Date, endDate: Date) {
        const start = new Date(startDate);
        start.setUTCHours(5, 0, 0, 0);
        const end = new Date(endDate);
        end.setUTCHours(28, 59, 59, 999);

        const dateStr = new Date(endDate).toISOString().split('T')[0];

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
                    estado: EstadoPedido.ENTREGADO,
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
        start.setUTCHours(5, 0, 0, 0);
        const end = new Date(date);
        end.setUTCHours(28, 59, 59, 999);

        const biz = await Negocio.findOne({ where: { id: shopId } });
        if (!biz) throw CustomError.notFound("Negocio no encontrado");

        const orders = await Pedido.find({
            where: {
                negocio: { id: shopId },
                estado: EstadoPedido.ENTREGADO,
                updatedAt: Between(start, end)
            },
            relations: ["cliente"]
        });

        const transfers = [];
        const cash = [];

        for (const o of orders) {
            const comProd = Number(o.total_comision_productos || 0);
            const comEnvio = Number(o.costoEnvio || 0);
            const precioApp = Number(o.total_precio_app || (Number(o.total) - comProd - comEnvio));

            const detail = {
                id: o.id,
                date: o.updatedAt,
                client: `${o.cliente?.name || ''} ${o.cliente?.surname || ''}`,
                total: Number(o.total),
                breakdown: {
                    totalProducts: Number(o.total_precio_venta_publico || (Number(o.total) - comEnvio)),
                    comisionProd: comProd,
                    precioApp: precioApp,
                    totalEnvio: comEnvio,
                    gananciaMoto: Number(o.ganancia_motorizado || 0),
                    comisionAppEnvio: Number(o.comision_app_domicilio || 0)
                }
            };

            if (o.metodoPago === MetodoPago.TRANSFERENCIA) {
                transfers.push(detail);
            } else {
                cash.push(detail);
            }
        }

        const dateStr = date.toISOString().split('T')[0];
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
        const todayStr = new Date().toISOString().split('T')[0];
        const dateStr = date.toISOString().split('T')[0];

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
        start.setUTCHours(5, 0, 0, 0);

        const end = new Date(endDate);
        end.setUTCHours(28, 59, 59, 999);
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
        if (existing) throw CustomError.conflict(`El día ${dateStr} ya está cerrado.`);

        // 2. Calculate Totals (Snapshot)
        // Ensure accurate range for that specific day
        const start = new Date(dateStr);
        start.setHours(0, 0, 0, 0); // Local time consideration? Backend is UTC usually.
        // Assuming dateStr is YYYY-MM-DD, new Date(dateStr) is UTC 00:00.
        // But getFinancialSummary logic used setHours override which works on local server time unless UTC is forced.
        // Let's reuse getFinancialSummary logic logic for dates:
        // Adjust for Ecuador (UTC-5) if strict, but consistency is key.
        // We will use the SAME summary function to get the values to freeze.

        // Important: getFinancialSummary adjusts 'end' to X:59:59.
        // We need to pass the date object correctly.
        // If 'date' input is "2026-02-03" (Date object), let's ensure it's treated as the start.

        const summary = await this.getFinancialSummary(start, start);

        // 2.1 Critical: Check for PENDING or IN_REVIEW transactions
        // 2.1 Critical: Check for PENDING transactions in Ecuador Time
        const startEcuador = new Date(dateStr);
        startEcuador.setUTCHours(5, 0, 0, 0);
        const endEcuador = new Date(dateStr);
        endEcuador.setUTCHours(28, 59, 59, 999);

        const pendingTransactions = await RechargeRequest.find({
            where: {
                status: In([StatusRecarga.PENDIENTE]),
                created_at: Between(startEcuador, endEcuador)
            },
            take: 3
        });

        if (pendingTransactions.length > 0) {
            const ids = pendingTransactions.map(t => `#${t.id.slice(0, 8)}`).join(", ");
            throw CustomError.badRequest(`No se puede cerrar el día: Existen ${pendingTransactions.length} transacciones pendientes de aprobación (${ids}).`);
        }

        // 3. Create Record
        const closing = new FinancialClosing();
        closing.closingDate = dateStr;
        closing.totalIncome = summary.appRevenue.total;
        closing.totalExpenses = 0;

        // 📸 SAVE SNAPSHOTS
        closing.totalUserBalance = summary.liabilities.usuarios;
        closing.totalMotorizadoDebt = summary.liabilities.motorizados;

        closing.totalRechargesCount = summary.bank.countRecargas;
        closing.backupFileUrl = statementUrl;
        closing.closedBy = adminUser;

        await closing.save();

        return {
            success: true,
            message: `Día ${dateStr} cerrado correctamente.`,
            data: closing
        };
    }
}
