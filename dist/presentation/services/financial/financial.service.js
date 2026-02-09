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
exports.FinancialService = void 0;
const typeorm_1 = require("typeorm");
const data_1 = require("../../../data");
const FinancialClosing_1 = require("../../../data/postgres/models/financial/FinancialClosing");
const upload_files_cloud_adapter_1 = require("../../../config/upload-files-cloud-adapter");
const config_1 = require("../../../config");
const domain_1 = require("../../../domain");
class FinancialService {
    // ===================================
    // 📊 MASTER SUMMARY
    // ===================================
    // ===================================
    // 🔍 APP REVENUE DETAILS (AUDITABLE)
    // ===================================
    getAppRevenueDetails(date_1, type_1) {
        return __awaiter(this, arguments, void 0, function* (date, type, page = 1, limit = 20) {
            const start = new Date(date);
            start.setUTCHours(5, 0, 0, 0);
            const end = new Date(date);
            end.setUTCHours(28, 59, 59, 999);
            const skip = (page - 1) * limit;
            let data = [];
            let total = 0;
            switch (type) {
                case 'suscripciones': // Suscripciones Usuarios (reference IS NOT NULL)
                    const [subsUser, countSubUser] = yield data_1.Transaction.findAndCount({
                        where: {
                            reason: data_1.TransactionReason.SUBSCRIPTION,
                            created_at: (0, typeorm_1.Between)(start, end),
                            reference: (0, typeorm_1.Not)((0, typeorm_1.IsNull)())
                        },
                        relations: ["wallet", "wallet.user"], // Removed wallet.user.subscriptions redundant join for list
                        order: { created_at: "DESC" },
                        take: limit,
                        skip: skip
                    });
                    data = subsUser.map(t => {
                        var _a, _b, _c, _d, _e, _f, _g;
                        return ({
                            id: t.id,
                            user: `${((_b = (_a = t.wallet) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.name) || ''} ${((_d = (_c = t.wallet) === null || _c === void 0 ? void 0 : _c.user) === null || _d === void 0 ? void 0 : _d.surname) || ''}`,
                            email: (_f = (_e = t.wallet) === null || _e === void 0 ? void 0 : _e.user) === null || _f === void 0 ? void 0 : _f.email,
                            amount: Math.abs(Number(t.amount)),
                            paymentDate: t.created_at,
                            daysBought: t.daysBought || '-',
                            prevEndDate: t.prevEndDate ? new Date(t.prevEndDate).toISOString() : 'N/A',
                            newEndDate: t.newEndDate ? new Date(t.newEndDate).toISOString() : 'N/A',
                            receiptImage: null, // No receipt for internal wallet movements usually
                            walletBalance: Number(((_g = t.wallet) === null || _g === void 0 ? void 0 : _g.balance) || 0),
                            status: 'COBRADO',
                            concept: t.observation || 'Suscripción Usuario'
                        });
                    });
                    total = countSubUser;
                    break;
                case 'suscripcionesNegocios': // Suscripciones Negocios (reference IS NULL)
                    const [subsBiz, countSubBiz] = yield data_1.Transaction.findAndCount({
                        where: {
                            reason: data_1.TransactionReason.SUBSCRIPTION,
                            created_at: (0, typeorm_1.Between)(start, end),
                            reference: (0, typeorm_1.IsNull)()
                        },
                        relations: ["wallet", "wallet.user"],
                        order: { created_at: "DESC" },
                        take: limit,
                        skip: skip
                    });
                    data = subsBiz.map(t => {
                        var _a, _b, _c, _d;
                        // Extract Business Name from Observation if possible "Pago de suscripción: [Name]"
                        let businessName = 'Desconocido';
                        if (t.observation && t.observation.includes('Pago de suscripción:')) {
                            businessName = t.observation.split('Pago de suscripción:')[1].trim();
                        }
                        return {
                            id: t.id,
                            user: `${((_b = (_a = t.wallet) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.name) || ''} ${((_d = (_c = t.wallet) === null || _c === void 0 ? void 0 : _c.user) === null || _d === void 0 ? void 0 : _d.surname) || ''}`, // Owner
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
                    const [storiesTx, countStories] = yield data_1.Transaction.findAndCount({
                        where: {
                            reason: data_1.TransactionReason.STORIE,
                            created_at: (0, typeorm_1.Between)(start, end),
                            status: 'APPROVED'
                        },
                        relations: ["wallet", "wallet.user"],
                        order: { created_at: "DESC" },
                        take: limit,
                        skip: skip
                    });
                    const { Storie } = require("../../../data/postgres/models/stories.model");
                    data = yield Promise.all(storiesTx.map((t) => __awaiter(this, void 0, void 0, function* () {
                        var _a, _b;
                        let storyDetail = 'Historia';
                        if (t.reference) {
                            const s = yield Storie.findOne({ where: { id: t.reference } });
                            if (s) {
                                storyDetail = s.description || `Historia #${s.id.slice(0, 5)}`;
                            }
                        }
                        else if (t.observation && t.observation.toLowerCase().includes('historia')) {
                            storyDetail = t.observation;
                        }
                        return {
                            id: t.id,
                            email: ((_b = (_a = t.wallet) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.email) || 'N/A',
                            story: storyDetail,
                            amount: Math.abs(Number(t.amount)),
                            date: t.created_at,
                            previousBalance: Number(t.previousBalance || 0),
                            resultingBalance: Number(t.resultingBalance || 0),
                            type: 'Egreso',
                            concept: 'Pago de historia'
                        };
                    })));
                    total = countStories;
                    break;
                case 'comisionProductos':
                    const [ordersProd, countProd] = yield data_1.Pedido.findAndCount({
                        where: {
                            estado: data_1.EstadoPedido.ENTREGADO,
                            updatedAt: (0, typeorm_1.Between)(start, end)
                        },
                        relations: ["cliente", "negocio", "productos", "productos.producto"],
                        order: { updatedAt: "DESC" },
                        take: limit,
                        skip: skip
                    });
                    data = ordersProd.map(o => {
                        var _a, _b;
                        // Use new field if available, otherwise fallback to old/calculation
                        let comVal = Number(o.total_comision_productos || 0);
                        if (comVal === 0) {
                            comVal = Number(o.ganancia_app_producto || 0);
                            if (comVal === 0 && o.comisionTotal > 0) {
                                comVal = Number(o.comisionTotal) - Number(o.comision_app_domicilio || 0);
                            }
                            if (comVal === 0 && ((_a = o.productos) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                                comVal = o.productos.reduce((acc, p) => acc + (Number(p.comision_producto) * p.cantidad), 0);
                            }
                        }
                        const buyer = o.cliente;
                        return {
                            id: o.id,
                            buyer: `${(buyer === null || buyer === void 0 ? void 0 : buyer.name) || ''} ${(buyer === null || buyer === void 0 ? void 0 : buyer.surname) || ''}`,
                            shop: ((_b = o.negocio) === null || _b === void 0 ? void 0 : _b.nombre) || 'Desconocido',
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
                            productList: o.productos.map(pp => {
                                var _a;
                                return ({
                                    name: ((_a = pp.producto) === null || _a === void 0 ? void 0 : _a.nombre) || 'Producto eliminado',
                                    quantity: pp.cantidad,
                                    priceClient: Number(pp.precio_venta),
                                    priceLocal: Number(pp.precio_app),
                                    commission: Number(pp.comision_producto),
                                    subtotal: Number(pp.subtotal)
                                });
                            })
                        };
                    });
                    total = countProd;
                    break;
                case 'comisionDomicilio':
                    const [ordersDel, countDel] = yield data_1.Pedido.findAndCount({
                        where: {
                            estado: data_1.EstadoPedido.ENTREGADO,
                            updatedAt: (0, typeorm_1.Between)(start, end)
                        },
                        relations: ["motorizado"],
                        order: { updatedAt: "DESC" },
                        take: limit,
                        skip: skip
                    });
                    data = ordersDel.map(o => {
                        const moto = o.motorizado;
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
                    throw domain_1.CustomError.badRequest("Invalid revenue type");
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
        });
    }
    // ===================================
    // 📊 MASTER SUMMARY
    // ===================================
    getFinancialSummary(startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Fix: Ensure endDate covers the entire day in Ecuador Time (UTC-5)
            // Matches logic in RechargeRequestService.filterByDateRangePaginated
            const start = new Date(startDate);
            start.setUTCHours(5, 0, 0, 0);
            const end = new Date(endDate);
            end.setUTCHours(28, 59, 59, 999); // 04:59 AM next day UTC
            // 🔍 CHECK FOR HISTORICAL CLOSING SNAPSHOT
            const dateStr = new Date(endDate).toISOString().split('T')[0];
            const closingSnapshot = yield FinancialClosing_1.FinancialClosing.findOne({ where: { closingDate: dateStr } });
            // 1. RECARGAS (DINERO REAL EN BANCO)
            const recharges = yield data_1.RechargeRequest.createQueryBuilder("r")
                .select("SUM(r.amount)", "total")
                .addSelect("COUNT(r.id)", "count")
                .where("r.status = :status", { status: data_1.StatusRecarga.APROBADO })
                .andWhere("r.created_at BETWEEN :start AND :end", { start: start, end: end })
                .getRawOne();
            const totalRecargasObjectivo = Number(recharges.total || 0);
            // 2. INGRESOS APP (GANANCIA REAL)
            // 2. INGRESOS APP (GANANCIA REAL)
            // A. Suscripciones Usuarios (Transaction -> Reason SUBSCRIPTION + Ref OK)
            const subsUserIncome = yield data_1.Transaction.createQueryBuilder("t")
                .select("SUM(t.amount)", "total")
                .where("t.reason = :reason", { reason: data_1.TransactionReason.SUBSCRIPTION })
                .andWhere("t.reference IS NOT NULL")
                .andWhere("t.created_at BETWEEN :start AND :end", { start: start, end: end })
                .getRawOne();
            const totalSubsUser = Math.abs(Number(subsUserIncome.total || 0));
            // B. Suscripciones Negocios (Transaction -> Reason SUBSCRIPTION + Ref NULL)
            const subsBizIncome = yield data_1.Transaction.createQueryBuilder("t")
                .select("SUM(t.amount)", "total")
                .where("t.reason = :reason", { reason: data_1.TransactionReason.SUBSCRIPTION })
                .andWhere("t.reference IS NULL")
                .andWhere("t.created_at BETWEEN :start AND :end", { start: start, end: end })
                .getRawOne();
            const totalSubsBiz = Math.abs(Number(subsBizIncome.total || 0));
            // C. Historias (Transaction -> Reason STORIE)
            const storiesIncome = yield data_1.Transaction.createQueryBuilder("t")
                .select("SUM(t.amount)", "total")
                .where("t.reason = :reason", { reason: data_1.TransactionReason.STORIE })
                .andWhere("t.created_at BETWEEN :start AND :end", { start: start, end: end })
                .getRawOne();
            const totalStories = Math.abs(Number(storiesIncome.total || 0));
            // D. Orders (Commissions)
            // We look at ENTREGADO orders in the period
            const orders = yield data_1.Pedido.find({
                where: {
                    estado: data_1.EstadoPedido.ENTREGADO,
                    updatedAt: (0, typeorm_1.Between)(start, end)
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
                    if (comProd === 0 && ((_a = order.productos) === null || _a === void 0 ? void 0 : _a.length) > 0) {
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
            }
            else {
                // ⚠️ LIVE CALCULATION (Open Days)
                // User Balance Total
                const usersWalletSum = yield data_1.Wallet.createQueryBuilder("w")
                    .select("SUM(w.balance)", "total")
                    .getRawOne();
                totalSaldoUsuarios = Number(usersWalletSum.total || 0);
                // Motorizados Info
                const motorizados = yield data_1.UserMotorizado.find();
                totalPorPagarMotorizados = motorizados.reduce((acc, m) => acc + Number(m.saldo), 0);
            }
            // Note: 'saldo' in Driver is what we owe them (earnings).
            // 4. TIENDAS (Consolidated Logic)
            const { totalPorPagarTiendas, totalPorCobrarTiendas } = yield this.calculateShopBalances(startDate, endDate);
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
        });
    }
    // ===================================
    // 🏪 SHOP RECONCILIATION
    // ===================================
    getShopReconciliation(startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            const start = new Date(startDate);
            start.setUTCHours(5, 0, 0, 0);
            const end = new Date(endDate);
            end.setUTCHours(28, 59, 59, 999);
            // Get all ENTREGADO orders in period
            const orders = yield data_1.Pedido.find({
                where: {
                    estado: data_1.EstadoPedido.ENTREGADO,
                    updatedAt: (0, typeorm_1.Between)(start, end)
                },
                relations: ["negocio", "productos"]
            });
            // Group by Shop
            const shopMap = new Map();
            for (const order of orders) {
                if (!order.negocio)
                    continue;
                const shopId = order.negocio.id;
                if (!shopMap.has(shopId)) {
                    shopMap.set(shopId, {
                        id: shopId,
                        name: order.negocio.nombre,
                        totalVentas: 0,
                        transferencias: 0, // Entregado via Transferencia (App holds funds)
                        efectivo: 0, // Entregado via Efectivo (Shop/Driver holds funds)
                        comisiones: 0, // Total Commissions (App Revenue)
                        neto: 0 // Logic placeholder
                    });
                }
                const data = shopMap.get(shopId);
                const total = Number(order.total);
                // Let's stick to: ComisionProd + (DeliveryComm?)
                // Usually Delivery Commission is paid by Driver. BUT if Shop uses own delivery?
                // Assuming Standard: Shop pays Product Commission.
                // Fix: User says "Debe el local = (comisiones producto + domicilio + motorizado)"
                // Use ALL app commissions from this order.
                let comApp = Number(order.total_comision_productos || 0) + Number(order.comision_moto_app || 0);
                // Legacy Fallback
                if (comApp === 0) {
                    comApp = Number(order.comisionTotal || 0) + (Number(order.costoEnvio) * 0.2);
                }
                data.totalVentas += total;
                data.comisiones += comApp;
                if (order.metodoPago === data_1.MetodoPago.TRANSFERENCIA) {
                    // App holds money
                    data.transferencias += total;
                }
                else {
                    // Shop/Driver holds money
                    data.efectivo += total;
                }
            }
            // Final Calculation per Shop
            // Saldo = Commissions - Transfers_Held_By_App
            // Interpretation:
            // Shop owes App (Commissions).
            // App owes Shop (Transfers_Held).
            // Net = Commissions - Transfers.
            // If Net > 0: Shop owes App.
            // If Net < 0: App owes Shop.
            const result = Array.from(shopMap.values()).map(shop => {
                const saldo = shop.comisiones - shop.transferencias;
                return Object.assign(Object.assign({}, shop), { saldo_neto: Number(saldo.toFixed(2)), estado: saldo > 0 ? "DEBE_PAGAR" : (saldo < 0 ? "A_FAVOR_LOCAL" : "CUADRADO"), 
                    // Formatting for UI
                    totalVentas: Number(shop.totalVentas.toFixed(2)), transferencias: Number(shop.transferencias.toFixed(2)), efectivo: Number(shop.efectivo.toFixed(2)), comisiones: Number(shop.comisiones.toFixed(2)) });
            });
            return result;
        });
    }
    // Helper for Summary
    calculateShopBalances(start, end) {
        return __awaiter(this, void 0, void 0, function* () {
            // Reuse getShopReconciliation logic but need to pass raw dates as getShopRec adjusts them again?
            // Wait, getShopReconciliation expects RAW dates and adjusts them.
            // If I call it with 'startDate' (raw), it adjusts. Good.
            // CAUTION: calculateShopBalances is called from getFinancialSummary which ALREADY adjusted 'start' and 'end' ??
            // In getFinancialSummary I have:
            // const start = adjusted;
            // this.calculateShopBalances(startDate, endDate); <-- Passing original RAW dates.
            // So this is correct. I am passing raw dates to helper.
            const shops = yield this.getShopReconciliation(start, end);
            let totalPagar = 0; // App owes Shop (Saldo < 0)
            let totalCobrar = 0; // Shop owes App (Saldo > 0)
            shops.forEach(s => {
                if (s.saldo_neto < 0)
                    totalPagar += Math.abs(s.saldo_neto);
                else
                    totalCobrar += s.saldo_neto;
            });
            return { totalPorPagarTiendas: totalPagar, totalPorCobrarTiendas: totalCobrar };
        });
    }
    // ===================================
    // 📈 DRILLDOWN (Orders per Shop)
    // ===================================
    getShopDetails(shopId, startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            const start = new Date(startDate);
            start.setUTCHours(5, 0, 0, 0);
            const end = new Date(endDate);
            end.setUTCHours(28, 59, 59, 999);
            return data_1.Pedido.find({
                where: {
                    negocio: { id: shopId },
                    estado: data_1.EstadoPedido.ENTREGADO,
                    updatedAt: (0, typeorm_1.Between)(start, end)
                },
                relations: ["cliente", "productos", "motorizado"],
                order: { updatedAt: "DESC" }
            });
        });
    }
    // ===================================
    // 🏍️ DRIVER RECONCILIATION
    // ===================================
    getDriverReconciliation(startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            const start = new Date(startDate);
            start.setUTCHours(5, 0, 0, 0);
            const end = new Date(endDate);
            end.setUTCHours(28, 59, 59, 999);
            // Only show active drivers or those with activity
            const drivers = yield data_1.UserMotorizado.find();
            // This is tricky. User wants "Total acreditado", "Total retirado" in period?
            // Or "Total accumulated"?
            // Prompt: "Por motorizado: Total acreditado, Total retirado, Saldo pendiente (Debt)"
            // "Saldo pendiente" is usually the current live balance.
            // "Acreditado/Retirado" should be over the period.
            const report = [];
            for (const driver of drivers) {
                // Stats in period
                const { incomeSum } = (yield data_1.TransaccionMotorizado.createQueryBuilder("tm")
                    .select("SUM(tm.monto)", "incomeSum")
                    .where("tm.motorizadoId = :id", { id: driver.id })
                    .andWhere("tm.tipo = :type", { type: "GANANCIA_ENVIO" })
                    .andWhere("tm.createdAt BETWEEN :start AND :end", { start: start, end: end })
                    .getRawOne()) || { incomeSum: 0 };
                const { withdrawalSum } = (yield data_1.TransaccionMotorizado.createQueryBuilder("tm")
                    .select("SUM(tm.monto)", "withdrawalSum")
                    .where("tm.motorizadoId = :id", { id: driver.id })
                    .andWhere("tm.tipo = :type", { type: "RETIRO" })
                    .andWhere("tm.createdAt BETWEEN :start AND :end", { start: start, end: end })
                    .getRawOne()) || { withdrawalSum: 0 };
                report.push({
                    id: driver.id,
                    name: `${driver.name} ${driver.surname}`,
                    acreditado: Number(incomeSum || 0),
                    retirado: Math.abs(Number(withdrawalSum || 0)),
                    saldo_pendiente: Number(driver.saldo) // Live balance
                });
            }
            return report;
        });
    }
    // ===================================
    // 🔐 DAILY CLOSING
    // ===================================
    // A. Upload Statement (S3)
    uploadBankStatement(file) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!file)
                throw domain_1.CustomError.badRequest("Archivo requerido");
            try {
                const key = yield upload_files_cloud_adapter_1.UploadFilesCloud.uploadSingleFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: `financial/statements/${Date.now()}-${file.originalname}`,
                    body: file.buffer,
                    contentType: file.mimetype,
                });
                const url = yield upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key
                });
                return { url };
            }
            catch (error) {
                throw domain_1.CustomError.internalServer("Error subiendo el estado de cuenta");
            }
        });
    }
    // B. Get Day Status
    getDayStatus(date) {
        return __awaiter(this, void 0, void 0, function* () {
            const dateStr = date.toISOString().split('T')[0];
            const closing = yield FinancialClosing_1.FinancialClosing.findOne({
                where: { closingDate: dateStr },
                relations: ["closedBy"]
            });
            return {
                isClosed: !!closing,
                details: closing || null
            };
        });
    }
    // C. Close Day (Logic)
    closeDay(date, statementUrl, adminUser) {
        return __awaiter(this, void 0, void 0, function* () {
            const dateStr = date.toISOString().split('T')[0];
            // 1. Check if already closed
            const existing = yield FinancialClosing_1.FinancialClosing.findOne({ where: { closingDate: dateStr } });
            if (existing)
                throw domain_1.CustomError.conflict(`El día ${dateStr} ya está cerrado.`);
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
            const summary = yield this.getFinancialSummary(start, start);
            // 2.1 Critical: Check for PENDING or IN_REVIEW transactions
            // 2.1 Critical: Check for PENDING transactions in Ecuador Time
            const startEcuador = new Date(dateStr);
            startEcuador.setUTCHours(5, 0, 0, 0);
            const endEcuador = new Date(dateStr);
            endEcuador.setUTCHours(28, 59, 59, 999);
            const pendingTransactions = yield data_1.RechargeRequest.find({
                where: {
                    status: (0, typeorm_1.In)([data_1.StatusRecarga.PENDIENTE]),
                    created_at: (0, typeorm_1.Between)(startEcuador, endEcuador)
                },
                take: 3
            });
            if (pendingTransactions.length > 0) {
                const ids = pendingTransactions.map(t => `#${t.id.slice(0, 8)}`).join(", ");
                throw domain_1.CustomError.badRequest(`No se puede cerrar el día: Existen ${pendingTransactions.length} transacciones pendientes de aprobación (${ids}).`);
            }
            // 3. Create Record
            const closing = new FinancialClosing_1.FinancialClosing();
            closing.closingDate = dateStr;
            closing.totalIncome = summary.appRevenue.total;
            closing.totalExpenses = 0;
            // 📸 SAVE SNAPSHOTS
            closing.totalUserBalance = summary.liabilities.usuarios;
            closing.totalMotorizadoDebt = summary.liabilities.motorizados;
            closing.totalRechargesCount = summary.bank.countRecargas;
            closing.backupFileUrl = statementUrl;
            closing.closedBy = adminUser;
            yield closing.save();
            return {
                success: true,
                message: `Día ${dateStr} cerrado correctamente.`,
                data: closing
            };
        });
    }
}
exports.FinancialService = FinancialService;
