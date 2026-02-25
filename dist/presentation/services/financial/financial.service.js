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
            // NEW: Financial Reconciliation Accumulators
            let totalDepositoEfectivo = 0; // Cash Orders (Total + Delivery)
            let totalDepositoTransferencia = 0; // Transfer Orders (Delivery + Product Commission)
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
                // 4. DEPOSIT CALCULATIONS (New Requirement)
                if (order.metodoPago === data_1.MetodoPago.EFECTIVO) {
                    // Depósito App (Efectivo) = TOTAL PEDIDO + COSTO DOMICILIO
                    // The driver collects this sum physically.
                    totalDepositoEfectivo += (Number(order.total || 0) + Number(order.costoEnvio || 0));
                }
                else if (order.metodoPago === data_1.MetodoPago.TRANSFERENCIA) {
                    // Depósito App (Transferencia) = Costo domicilio + comisiones app
                    // User Rule: "Sumar: Costo domicilio + comisiones app" (excluding shop price)
                    // Note: comProd is the "comisión app".
                    totalDepositoTransferencia += (Number(order.costoEnvio || 0) + comProd);
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
                deposits: {
                    cash: totalDepositoEfectivo,
                    transferApp: totalDepositoTransferencia
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
    // 🏪 SHOP RECONCILIATION (CUADRE POR LOCAL)
    // ===================================
    getShopReconciliation(startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            const start = new Date(startDate);
            start.setUTCHours(5, 0, 0, 0);
            const end = new Date(endDate);
            end.setUTCHours(28, 59, 59, 999);
            const dateStr = new Date(endDate).toISOString().split('T')[0];
            // 1. Get all businesses
            const businesses = yield data_1.Negocio.find();
            const results = [];
            for (const biz of businesses) {
                // 2. Check for frozen snapshot
                let snapshot = yield data_1.BalanceNegocio.findOne({
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
                const orders = yield data_1.Pedido.find({
                    where: {
                        negocio: { id: biz.id },
                        estado: data_1.EstadoPedido.ENTREGADO,
                        updatedAt: (0, typeorm_1.Between)(start, end)
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
                    if (order.metodoPago === data_1.MetodoPago.TRANSFERENCIA) {
                        totalTransfer += total;
                        // Local has 100%. Local owes App: comProd + comEnvio.
                        owedToApp += (comProd + comEnvio);
                    }
                    else {
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
                    isClosed: (snapshot === null || snapshot === void 0 ? void 0 : snapshot.isClosed) || false,
                    closedBy: (snapshot === null || snapshot === void 0 ? void 0 : snapshot.closedBy) || null,
                    comprobanteUrl: (snapshot === null || snapshot === void 0 ? void 0 : snapshot.comprobanteUrl) || null
                });
            }
            // Sign URLs
            const resultsWithSignedUrls = yield Promise.all(results.map((r) => __awaiter(this, void 0, void 0, function* () {
                return (Object.assign(Object.assign({}, r), { comprobanteUrl: yield this.signUrlIfNeeded(r.comprobanteUrl) }));
            })));
            return resultsWithSignedUrls;
        });
    }
    getShopClosingDetails(shopId, date) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const start = new Date(date);
            start.setUTCHours(5, 0, 0, 0);
            const end = new Date(date);
            end.setUTCHours(28, 59, 59, 999);
            const biz = yield data_1.Negocio.findOne({ where: { id: shopId } });
            if (!biz)
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            const orders = yield data_1.Pedido.find({
                where: {
                    negocio: { id: shopId },
                    estado: data_1.EstadoPedido.ENTREGADO,
                    updatedAt: (0, typeorm_1.Between)(start, end)
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
                    client: `${((_a = o.cliente) === null || _a === void 0 ? void 0 : _a.name) || ''} ${((_b = o.cliente) === null || _b === void 0 ? void 0 : _b.surname) || ''}`,
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
                if (o.metodoPago === data_1.MetodoPago.TRANSFERENCIA) {
                    transfers.push(detail);
                }
                else {
                    cash.push(detail);
                }
            }
            const dateStr = date.toISOString().split('T')[0];
            const closure = yield data_1.BalanceNegocio.findOne({
                where: { negocio: { id: shopId }, fecha: dateStr },
                relations: ["closedBy"]
            });
            return {
                shop: biz.nombre,
                date: dateStr,
                isClosed: (closure === null || closure === void 0 ? void 0 : closure.isClosed) || false,
                comprobanteUrl: yield this.signUrlIfNeeded((closure === null || closure === void 0 ? void 0 : closure.comprobanteUrl) || null),
                closedBy: (closure === null || closure === void 0 ? void 0 : closure.closedBy) || null,
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
        });
    }
    closeShopDay(shopId, date, admin, comprobanteUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. Time check: Only past days
            const todayStr = new Date().toISOString().split('T')[0];
            const dateStr = date.toISOString().split('T')[0];
            if (dateStr === todayStr) {
                throw domain_1.CustomError.badRequest("No se puede cerrar el día actual. Solo fechas anteriores.");
            }
            const existing = yield data_1.BalanceNegocio.findOne({
                where: { negocio: { id: shopId }, fecha: dateStr }
            });
            if (existing && existing.isClosed)
                throw domain_1.CustomError.badRequest("Este día ya está cerrado.");
            // Fetch data to verify balance
            const summary = yield this.getShopReconciliation(date, date);
            const bizData = summary.find(s => s.id === shopId);
            if (!bizData)
                throw domain_1.CustomError.notFound("No hay datos para esta fecha.");
            // 2. Receipt requirement check
            if (bizData.saldo_neto !== 0 && !comprobanteUrl) {
                const payer = bizData.saldo_neto < 0 ? "APP" : "LOCAL";
                throw domain_1.CustomError.badRequest(`Se requiere el comprobante de depósito (${payer} paga) para cerrar el día.`);
            }
            // Case A (App pays Local) or Case C (Squared)
            const record = existing || new data_1.BalanceNegocio();
            record.fecha = dateStr;
            record.negocio = { id: shopId };
            record.totalVendido = bizData.totalVentas;
            record.totalComisionApp = bizData.comisiones;
            record.totalEfectivo = bizData.efectivo;
            record.totalTransferencia = bizData.transferencias;
            record.balanceFinal = bizData.saldo_neto;
            record.isClosed = true;
            record.closedBy = admin;
            record.comprobanteUrl = comprobanteUrl || record.comprobanteUrl;
            record.estado = (bizData.saldo_neto === 0 || record.comprobanteUrl) ? data_1.EstadoBalance.LIQUIDADO : data_1.EstadoBalance.PENDIENTE;
            yield record.save();
            return { success: true, message: "Día cerrado correctamente", data: record };
        });
    }
    signUrlIfNeeded(keyOrUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!keyOrUrl)
                return null;
            if (typeof keyOrUrl !== 'string')
                return keyOrUrl;
            if (keyOrUrl.startsWith('http'))
                return keyOrUrl;
            try {
                return yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: keyOrUrl
                });
            }
            catch (error) {
                console.error("Error signing URL:", error);
                return keyOrUrl;
            }
        });
    }
    uploadShopClosingReceipt(shopId, date, file) {
        return __awaiter(this, void 0, void 0, function* () {
            // Just upload, don't check for snapshot or close day.
            try {
                const key = yield upload_files_cloud_adapter_1.UploadFilesCloud.uploadSingleFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: `financial/shop-closings/${shopId}-${date}-${Date.now()}.png`,
                    body: file.buffer,
                    contentType: file.mimetype,
                    isReceipt: true
                });
                const url = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key
                });
                return { success: true, url, key };
            }
            catch (error) {
                throw domain_1.CustomError.internalServer("Error subiendo comprobante");
            }
        });
    }
    // Helper for Summary
    calculateShopBalances(start, end) {
        return __awaiter(this, void 0, void 0, function* () {
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
                throw domain_1.CustomError.badRequest("El día ya está cerrado, no se puede sobrescribir.");
            // 2. Validate S3 URL
            if (!statementUrl.includes(config_1.envs.AWS_BUCKET_NAME)) {
                // throw CustomError.badRequest("URL de archivo inválida"); 
                // Warning: Maybe user pasted external link? Let's allow but maybe warn log.
            }
            // 3. Snapshot Data (Freeze)
            // We reuse master summary logic for the snapshot
            const summary = yield this.getFinancialSummary(date, date);
            // 4. Save
            const closing = new FinancialClosing_1.FinancialClosing();
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
            yield closing.save();
            return { success: true, message: "Día cerrado exitosamente" };
        });
    }
    // ===================================
    // 🚨 PENDING CLOSINGS (GLOBAL)
    // ===================================
    getPendingShopClosings() {
        return __awaiter(this, void 0, void 0, function* () {
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
            const activeDays = yield data_1.Pedido.createQueryBuilder("p")
                .select("DATE(p.updatedAt)", "date")
                .addSelect("p.negocioId", "shopId")
                .addSelect("SUM(p.total)", "total")
                .where("p.updatedAt >= :limit", { limit: limitDate })
                .andWhere("p.estado = :status", { status: data_1.EstadoPedido.ENTREGADO })
                .groupBy("DATE(p.updatedAt), p.negocioId")
                .getRawMany();
            // B. Get Closed Days
            const closedDays = yield data_1.BalanceNegocio.find({
                where: {
                    fecha: (0, typeorm_1.MoreThanOrEqual)(limitDate.toISOString().split('T')[0])
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
                const shops = yield data_1.Negocio.find({ where: { id: (0, typeorm_1.In)(shopIds) }, select: ["id", "nombre"] });
                shopMap = new Map(shops.map(s => [s.id, s.nombre]));
            }
            for (const day of activeDays) {
                // day.date type depends on driver, usually Date object or string
                let dateStr = day.date;
                if (day.date instanceof Date)
                    dateStr = day.date.toISOString().split('T')[0];
                else if (typeof day.date === 'string' && day.date.includes('T'))
                    dateStr = day.date.split('T')[0];
                const key = `${day.shopId}|${dateStr}`;
                // Skip today
                const todayStr = new Date().toISOString().split('T')[0];
                if (dateStr === todayStr)
                    continue;
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
        });
    }
    // ===================================
    // 🏍️ DRIVER MOVEMENTS (MOVIMIENTOS MOTORIZADOS)
    // ===================================
    getMovimientosMotorizados(startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            const start = new Date(startDate);
            start.setUTCHours(5, 0, 0, 0); // Start of day Ecuador
            const end = new Date(endDate);
            end.setUTCHours(28, 59, 59, 999); // End of day Ecuador
            const orders = yield data_1.Pedido.find({
                where: {
                    estado: data_1.EstadoPedido.ENTREGADO, // Ensure enum match
                    updatedAt: (0, typeorm_1.Between)(start, end)
                },
                relations: ["motorizado"],
                order: { updatedAt: "DESC" }
            });
            console.log(`[DEBUG] getMovimientosMotorizados found ${orders.length} orders for range ${start.toISOString()} - ${end.toISOString()}`);
            let totalDeuda = 0;
            const movimientos = [];
            for (const order of orders) {
                const moto = order.motorizado;
                let motorizadoName = 'Motorizado No Encontrado';
                if (moto) {
                    motorizadoName = `${moto.nombre || moto.name || ''} ${moto.apellido || moto.surname || ''}`.trim();
                }
                // Calculate Driver Gain (Without App Commission)
                let gananciaMoto = 0;
                // 1. Try direct field (NEWEST)
                gananciaMoto = Number(order.pago_motorizado || 0);
                // 2. Try legacy field
                if (gananciaMoto === 0) {
                    gananciaMoto = Number(order.ganancia_motorizado || 0);
                }
                // 3. Fallback calculation
                if (gananciaMoto === 0) {
                    let comisionApp = Number(order.comision_moto_app || order.comision_app_domicilio || 0);
                    if (comisionApp === 0)
                        comisionApp = Number(order.costoEnvio || 0) * 0.20;
                    gananciaMoto = Number(order.costoEnvio || 0) - comisionApp;
                }
                console.log(`[DEBUG] Order #${order.id.slice(0, 5)} | Moto: ${motorizadoName} | Gain: ${gananciaMoto}`);
                // Format Time (Ecuador UTC-5)
                const dateObj = new Date(order.updatedAt);
                const ecuadorTime = new Date(dateObj.getTime() - (5 * 60 * 60 * 1000));
                const fechaStr = ecuadorTime.toISOString().split('T')[0];
                const horaStr = ecuadorTime.toISOString().split('T')[1].substring(0, 5); // HH:mm
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
            console.log("[DEBUG] Final Result to Return:", JSON.stringify(result, null, 2));
            return result;
        });
    }
}
exports.FinancialService = FinancialService;
