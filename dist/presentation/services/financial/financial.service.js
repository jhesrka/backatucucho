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
exports.FinancialService = void 0;
const typeorm_1 = require("typeorm");
const data_1 = require("../../../data");
const FinancialClosing_1 = require("../../../data/postgres/models/financial/FinancialClosing");
const upload_files_cloud_adapter_1 = require("../../../config/upload-files-cloud-adapter");
const config_1 = require("../../../config");
const domain_1 = require("../../../domain");
const date_utils_1 = require("../../../utils/date-utils");
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
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
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
                    // data = await Promise.all(storiesTx.map(async (t) => {
                    data = yield Promise.all(storiesTx.map((t) => __awaiter(this, void 0, void 0, function* () {
                        var _a, _b;
                        let storyDetail = 'Historia';
                        if (t.reference) {
                            const s = yield data_1.Storie.findOne({ where: { id: t.reference } });
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
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            // 🔍 CHECK FOR HISTORICAL CLOSING SNAPSHOT
            const dateStr = date_utils_1.DateUtils.toLocalDateString(endDate);
            const closingSnapshot = yield FinancialClosing_1.FinancialClosing.findOne({ where: { closingDate: dateStr } });
            // 1. RECARGAS (DINERO REAL EN BANCO)
            const recharges = yield data_1.RechargeRequest.createQueryBuilder("r")
                .select("SUM(r.amount)", "total")
                .addSelect("COUNT(r.id)", "count")
                .where("r.status = :status", { status: data_1.StatusRecarga.APROBADO })
                .andWhere("r.payment_method <> 'CASH'") // EXCLUDE CASH TO AVOID DOUBLE COUNTING WITH MANUALTX
                .andWhere("r.created_at BETWEEN :start AND :end", { start: start, end: end })
                .getRawOne();
            const totalRecargasAprobadas = Number(recharges.total || 0);
            // 1.5. RECARGAS MANUALES (ADMIN_ADJUSTMENT / CASH_RECHARGE)
            // A. SOLO EFECTIVO (CASH_RECHARGE)
            const cashRaw = yield data_1.Transaction.createQueryBuilder("t")
                .select("SUM(t.amount)", "total")
                .addSelect("COUNT(t.id)", "count")
                .where("t.reason = 'CASH_RECHARGE'")
                .andWhere("t.status = 'APPROVED'")
                .andWhere("t.created_at BETWEEN :start AND :end", { start, end })
                .getRawOne();
            const totalEfectivo = Number(cashRaw.total || 0);
            // B. SOLO AJUSTES (ADMIN_ADJUSTMENT)
            const adjustmentsRaw = yield data_1.Transaction.createQueryBuilder("t")
                .select("SUM(t.amount)", "total")
                .addSelect("COUNT(t.id)", "count")
                .where("t.reason = 'ADMIN_ADJUSTMENT'")
                .andWhere("t.status = 'APPROVED'")
                .andWhere("t.created_at BETWEEN :start AND :end", { start, end })
                .getRawOne();
            const totalAjustes = Number(adjustmentsRaw.total || 0);
            // C. BREAKDOWN RECARGAS TABLA (TRANSFER vs CARD)
            const transferRaw = yield data_1.RechargeRequest.createQueryBuilder("r")
                .select("SUM(r.amount)", "total")
                .where("r.status = :status", { status: data_1.StatusRecarga.APROBADO })
                .andWhere("r.payment_method = 'TRANSF'")
                .andWhere("r.created_at BETWEEN :start AND :end", { start, end })
                .getRawOne();
            const totalTransferencia = Number(transferRaw.total || 0);
            const cardRaw = yield data_1.RechargeRequest.createQueryBuilder("r")
                .select("SUM(r.amount)", "total")
                .where("r.status = :status", { status: data_1.StatusRecarga.APROBADO })
                .andWhere("r.payment_method = 'CARD'")
                .andWhere("r.created_at BETWEEN :start AND :end", { start, end })
                .getRawOne();
            const totalTarjeta = Number(cardRaw.total || 0);
            const totalRecargasManuales = totalEfectivo + totalAjustes;
            const totalRecargasObjectivo = totalRecargasAprobadas + totalRecargasManuales;
            const countRecargas = Number(recharges.count || 0) + (Number(cashRaw.count || 0) || 0) + (Number(adjustmentsRaw.count || 0) || 0);
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
            // We look at ENTREGADO and CANCELADO orders in the period
            const orders = yield data_1.Pedido.find({
                where: {
                    estado: (0, typeorm_1.In)([data_1.EstadoPedido.ENTREGADO, data_1.EstadoPedido.CANCELADO, data_1.EstadoPedido.RETORNO_PENDIENTE, data_1.EstadoPedido.DEVUELTO_A_LOCAL]),
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
                const isCanceled = order.estado === data_1.EstadoPedido.CANCELADO;
                // 1. PRODUCT COMMISSION
                let comProd = Number(order.total_comision_productos || 0);
                if (comProd === 0 && !isCanceled) { // Only fallback for ENTREGADO
                    comProd = Number(order.ganancia_app_producto || 0);
                    if (comProd === 0 && order.comisionTotal > 0) {
                        comProd = Number(order.comisionTotal) - Number(order.comision_app_domicilio || 0);
                    }
                    if (comProd === 0 && ((_a = order.productos) === null || _a === void 0 ? void 0 : _a.length) > 0) {
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
                    if (order.metodoPago === data_1.MetodoPago.TRANSFERENCIA) {
                        // Local has 100%, App must recover it.
                        totalDepositoTransferencia += Number(order.total || 0);
                    }
                    // Efvo canceled doesn't affect these totals
                }
                else {
                    // ENTREGADO
                    totalComisionProductos += comProd;
                    totalComisionDomicilios += comDom;
                    totalPagoMotorizadosArr += pagoMoto;
                    if (order.metodoPago === data_1.MetodoPago.EFECTIVO) {
                        totalDepositoEfectivo += (Number(order.total || 0) + Number(order.costoEnvio || 0));
                    }
                    else if (order.metodoPago === data_1.MetodoPago.TRANSFERENCIA) {
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
                    directos: totalSubsUser + totalSubsBiz + totalStories,
                    comisiones: totalComisionProductos + totalComisionDomicilios,
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
        });
    }
    getUnifiedTransactions(date, types, statuses) {
        return __awaiter(this, void 0, void 0, function* () {
            const { start, end } = date_utils_1.DateUtils.getDayRange(date);
            // 1. Fetch Manual Transactions (The Ledger)
            const manualTxQuery = data_1.Transaction.createQueryBuilder("t")
                .leftJoinAndSelect("t.wallet", "wallet")
                .leftJoinAndSelect("wallet.user", "user")
                .leftJoinAndSelect("t.admin", "admin")
                .where("(t.reason = 'ADMIN_ADJUSTMENT' OR t.reason = 'CASH_RECHARGE' OR t.reason = 'RECHARGE')", {})
                .andWhere("t.created_at BETWEEN :start AND :end", { start, end })
                .orderBy("t.created_at", "DESC");
            if (statuses && statuses.length > 0) {
                const dbStatuses = statuses.map(s => {
                    const map = { 'APROBADO': 'APPROVED', 'PENDIENTE': 'PENDING', 'RECHAZADO': 'REJECTED' };
                    return map[s] || s;
                });
                manualTxQuery.andWhere("t.status IN (:...statuses)", { statuses: dbStatuses });
            }
            // Apply types to Transaction (Manual)
            if (types && types.length > 0) {
                const txParts = [];
                if (types.includes('recarga_efectivo'))
                    txParts.push("t.reason = 'CASH_RECHARGE'");
                if (types.includes('recarga_transferencia'))
                    txParts.push("t.reason = 'RECHARGE'");
                if (types.includes('credito_manual'))
                    txParts.push("(t.reason = 'ADMIN_ADJUSTMENT' AND t.type = 'credit')");
                if (types.includes('debito_manual'))
                    txParts.push("(t.reason = 'ADMIN_ADJUSTMENT' AND t.type = 'debit')");
                if (txParts.length > 0) {
                    manualTxQuery.andWhere(`(${txParts.join(" OR ")})`);
                }
                else if (!types.includes('payphone')) {
                    manualTxQuery.andWhere("1=0");
                }
            }
            const manualTx = yield manualTxQuery.getMany();
            // 2. Recharge Requests (Automatic/Bank)
            const linkedRequestIds = manualTx
                .filter(t => t.reason === data_1.TransactionReason.RECHARGE && t.reference)
                .map(t => t.reference);
            const requestsQuery = data_1.RechargeRequest.createQueryBuilder("r")
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
                if (types.includes('payphone'))
                    reqParts.push("r.payment_method = 'CARD'");
                if (types.includes('recarga_transferencia'))
                    reqParts.push("r.payment_method = 'TRANSFER'");
                if (reqParts.length > 0) {
                    requestsQuery.andWhere(`(${reqParts.join(" OR ")})`);
                }
                else if (!types.includes('recarga_efectivo') && !types.includes('credito_manual') && !types.includes('debito_manual')) {
                    requestsQuery.andWhere("1=0");
                }
            }
            if (linkedRequestIds.length > 0) {
                requestsQuery.andWhere("r.id NOT IN (:...ids)", { ids: linkedRequestIds });
            }
            const requests = yield requestsQuery.getMany();
            const formattedRequests = yield Promise.all(requests.map((r) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                // If approved, try to find the actual transaction to get balance_after
                let balanceAfter = null;
                if (r.status === data_1.StatusRecarga.APROBADO) {
                    const tx = yield data_1.Transaction.findOneBy({ reference: r.id });
                    if (tx)
                        balanceAfter = Number(tx.resultingBalance);
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
                        current_balance: Number(((_a = r.user.wallet) === null || _a === void 0 ? void 0 : _a.balance) || 0)
                    },
                    balance_after: balanceAfter
                };
            })));
            const formattedManual = yield Promise.all(manualTx.map((t) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                let imageUrl = null;
                try {
                    if (t.receipt_image) {
                        imageUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: t.receipt_image,
                        });
                    }
                }
                catch (e) {
                    console.error("Error fetching receipt image:", e);
                }
                // Attempt to enrich "RECHARGE" with info from the request if reference exists
                let bankInfo = (t.reason === 'RECHARGE' || t.reason === 'CASH_RECHARGE') ? 'BANCO / EFECTIVO' : 'AJUSTE INTERNO';
                let refInfo = t.admin ? `ADMIN: ${t.admin.name}` : 'SISTEMA';
                if (t.reason === data_1.TransactionReason.RECHARGE && t.reference) {
                    const req = yield data_1.RechargeRequest.findOneBy({ id: t.reference });
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
                        current_balance: Number(((_a = t.wallet.user.wallet) === null || _a === void 0 ? void 0 : _a.balance) || 0)
                    },
                    balance_after: Number(t.resultingBalance)
                };
            })));
            // Combine and Sort
            return [...formattedRequests, ...formattedManual].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        });
    }
    // ===================================
    // 🔎 AUDITORÍA DE COMPROBANTES
    // ===================================
    getComprobantesAuditoria(query_1, startDate_1, endDate_1, amount_1, type_1) {
        return __awaiter(this, arguments, void 0, function* (query, startDate, endDate, amount, type, page = 1, limit = 20) {
            let allReceipts = [];
            // Parsing dates
            let start = new Date(0);
            let end = new Date();
            if (startDate) {
                start = date_utils_1.DateUtils.parseLocalDate(startDate);
                start.setHours(0, 0, 0, 0);
            }
            if (endDate) {
                end = date_utils_1.DateUtils.parseLocalDate(endDate);
                end.setHours(23, 59, 59, 999);
            }
            else if (startDate) {
                end = new Date(start);
                end.setHours(23, 59, 59, 999);
            }
            // 1. Fetch from RechargeRequest
            if (!type || type === 'ALL' || type === 'RECARGA') {
                const reqQuery = data_1.RechargeRequest.createQueryBuilder("r")
                    .leftJoinAndSelect("r.user", "user")
                    .where("r.receipt_image IS NOT NULL")
                    .andWhere("r.created_at BETWEEN :start AND :end", { start, end });
                if (amount) {
                    reqQuery.andWhere("r.amount = :amount", { amount });
                }
                if (query) {
                    reqQuery.andWhere("(r.receipt_number ILIKE :query OR user.name ILIKE :query OR user.email ILIKE :query OR user.surname ILIKE :query)", { query: `%${query}%` });
                }
                const recargas = yield reqQuery.getMany();
                const mappedRecargas = recargas.map(r => ({
                    id: r.id,
                    origin: 'RECARGA',
                    date: r.created_at,
                    amount: Number(r.amount),
                    status: r.status,
                    user: {
                        id: r.user.id,
                        name: `${r.user.name} ${r.user.surname}`,
                        email: r.user.email
                    },
                    receipt_number: r.receipt_number || 'S/N',
                    rawUrl: r.receipt_image
                }));
                allReceipts = allReceipts.concat(mappedRecargas);
            }
            // 2. Fetch from Pedido
            if (!type || type === 'ALL' || type === 'PEDIDO') {
                const pQuery = data_1.Pedido.createQueryBuilder("p")
                    .leftJoinAndSelect("p.cliente", "cliente")
                    .leftJoinAndSelect("p.negocio", "negocio")
                    .where("p.comprobantePagoUrl IS NOT NULL")
                    .andWhere("p.updatedAt BETWEEN :start AND :end", { start, end });
                if (amount) {
                    pQuery.andWhere("p.total = :amount", { amount });
                }
                if (query) {
                    pQuery.andWhere("(p.id::text ILIKE :query OR cliente.name ILIKE :query OR cliente.email ILIKE :query OR cliente.surname ILIKE :query OR negocio.nombre ILIKE :query)", { query: `%${query}%` });
                }
                const pedidos = yield pQuery.getMany();
                const mappedPedidos = pedidos.map(p => {
                    var _a, _b, _c, _d, _e;
                    return ({
                        id: p.id,
                        origin: 'PEDIDO',
                        date: p.updatedAt,
                        amount: Number(p.total),
                        status: p.estado,
                        user: {
                            id: (_a = p.cliente) === null || _a === void 0 ? void 0 : _a.id,
                            name: `${((_b = p.cliente) === null || _b === void 0 ? void 0 : _b.name) || ''} ${((_c = p.cliente) === null || _c === void 0 ? void 0 : _c.surname) || ''}`.trim(),
                            email: (_d = p.cliente) === null || _d === void 0 ? void 0 : _d.email
                        },
                        receipt_number: `Order ID: ${p.id.split('-')[0]}`,
                        rawUrl: p.comprobantePagoUrl,
                        shopName: (_e = p.negocio) === null || _e === void 0 ? void 0 : _e.nombre
                    });
                });
                allReceipts = allReceipts.concat(mappedPedidos);
            }
            // Sort globally
            allReceipts.sort((a, b) => b.date.getTime() - a.date.getTime());
            // Pagination
            const total = allReceipts.length;
            const skip = (page - 1) * limit;
            const paginated = allReceipts.slice(skip, skip + limit);
            // Sign URLs
            const resultsWithSignedUrls = yield Promise.all(paginated.map((r) => __awaiter(this, void 0, void 0, function* () {
                let signedUrl = r.rawUrl;
                if (r.rawUrl && !r.rawUrl.startsWith('http')) {
                    try {
                        signedUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({ bucketName: config_1.envs.AWS_BUCKET_NAME, key: r.rawUrl });
                    }
                    catch (e) {
                        console.error("Error signing URL", e);
                    }
                }
                return Object.assign(Object.assign({}, r), { imageUrl: signedUrl });
            })));
            return {
                data: resultsWithSignedUrls,
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
    // 🏪 SHOP RECONCILIATION (CUADRE POR LOCAL)
    // ===================================
    getShopReconciliation(startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            const { DateUtils } = yield Promise.resolve().then(() => __importStar(require("../../../utils/date-utils")));
            // Convert to string to avoid timezone shifts when passing to getDayRange
            const startStr = DateUtils.toLocalDateString(startDate);
            const endStr = DateUtils.toLocalDateString(endDate);
            const { start } = DateUtils.getDayRange(startStr);
            const { end } = DateUtils.getDayRange(endStr);
            const dateStr = DateUtils.toLocalDateString(endDate);
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
                        estado: (0, typeorm_1.In)([
                            data_1.EstadoPedido.ENTREGADO,
                            data_1.EstadoPedido.CANCELADO,
                            data_1.EstadoPedido.RETORNO_PENDIENTE,
                            data_1.EstadoPedido.DEVUELTO_A_LOCAL
                        ]),
                        createdAt: (0, typeorm_1.Between)(start, end)
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
                    if ([data_1.EstadoPedido.CANCELADO, data_1.EstadoPedido.RETORNO_PENDIENTE, data_1.EstadoPedido.DEVUELTO_A_LOCAL].includes(order.estado)) {
                        if (order.metodoPago === data_1.MetodoPago.TRANSFERENCIA) {
                            // User Rule: If canceled transfer, local has the money and owes 100% to App (App returns it to client)
                            totalTransfer += total;
                            owedToApp += total;
                        }
                        else {
                            // If Efvo canceled, just show it for visibility but it doesn't affect balances
                            totalEfectivo += total;
                        }
                    }
                    else {
                        // ENTREGADO
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
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            const biz = yield data_1.Negocio.findOne({ where: { id: shopId } });
            if (!biz)
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            const orders = yield data_1.Pedido.find({
                where: {
                    negocio: { id: shopId },
                    estado: (0, typeorm_1.In)([data_1.EstadoPedido.ENTREGADO, data_1.EstadoPedido.CANCELADO]),
                    updatedAt: (0, typeorm_1.Between)(start, end)
                },
                relations: ["cliente", "productos", "productos.producto"]
            });
            const transfers = [];
            const cash = [];
            for (const o of orders) {
                const isCanceled = o.estado === data_1.EstadoPedido.CANCELADO;
                let comEnvio = Number(o.costoEnvio) || 0;
                let rawComProd = Number(o.total_comision_productos);
                let comProd = rawComProd ? rawComProd : 0;
                let rawTotalPub = Number(o.total_precio_venta_publico);
                let totalProducts = rawTotalPub ? rawTotalPub : (Number(o.total) - comEnvio);
                // FALLBACK FOR LEGACY ORDERS THAT DON'T HAVE total_comision_productos
                if (!rawComProd && o.productos && o.productos.length > 0) {
                    let calcComProd = 0;
                    let calcTotalProducts = 0;
                    for (const pp of o.productos) {
                        const p = pp.producto;
                        const q = Number(pp.cantidad || 1);
                        if (p) {
                            calcTotalProducts += Number(p.precio_venta || 0) * q;
                            calcComProd += (Number(p.precio_venta || 0) - Number(p.precio_app || 0)) * q;
                        }
                    }
                    if (calcComProd > 0)
                        comProd = calcComProd;
                    if (calcTotalProducts > 0)
                        totalProducts = calcTotalProducts;
                }
                let rawPrecioApp = Number(o.total_precio_app);
                let precioApp = rawPrecioApp ? rawPrecioApp : (totalProducts - comProd);
                let rawGananciaMoto = Number(o.ganancia_motorizado);
                let gananciaMoto = rawGananciaMoto ? rawGananciaMoto : Number((comEnvio * 0.8).toFixed(2));
                let rawComEnvioApp = Number(o.comision_app_domicilio);
                let comisionAppEnvio = rawComEnvioApp ? rawComEnvioApp : Number((comEnvio - gananciaMoto).toFixed(2));
                // Adjust values for specialized canceled logic
                if (isCanceled) {
                    if (o.metodoPago === data_1.MetodoPago.TRANSFERENCIA) {
                        // Canceled Transfer: Shop holds 100%, owes 100% to App
                        comProd = Number(o.total); // Set as full debt to app inside comProd for list calc
                        comEnvio = 0;
                        precioApp = 0;
                    }
                    else {
                        // Canceled Cash: Nothing owed
                        comProd = 0;
                        comEnvio = 0;
                        precioApp = 0;
                    }
                }
                let resolvedComprobante = o.comprobantePagoUrl;
                if (resolvedComprobante && !resolvedComprobante.startsWith('http')) {
                    try {
                        resolvedComprobante = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: resolvedComprobante
                        });
                    }
                    catch (e) {
                        console.error("Error signing receipt for shop breakdown:", e);
                    }
                }
                const detail = {
                    id: o.id,
                    date: o.updatedAt,
                    client: `${((_a = o.cliente) === null || _a === void 0 ? void 0 : _a.name) || ''} ${((_b = o.cliente) === null || _b === void 0 ? void 0 : _b.surname) || ''}`,
                    total: Number(o.total),
                    estado: o.estado,
                    isCanceled,
                    comprobanteUrl: resolvedComprobante,
                    breakdown: {
                        totalProducts: isCanceled ? 0 : totalProducts,
                        comisionProd: comProd,
                        precioApp: precioApp,
                        totalEnvio: comEnvio,
                        gananciaMoto: isCanceled ? 0 : gananciaMoto,
                        comisionAppEnvio: isCanceled ? 0 : comisionAppEnvio
                    }
                };
                if (o.metodoPago === data_1.MetodoPago.TRANSFERENCIA) {
                    transfers.push(detail);
                }
                else {
                    cash.push(detail);
                }
            }
            const dateStr = date_utils_1.DateUtils.toLocalDateString(date);
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
            const todayStr = date_utils_1.DateUtils.toLocalDateString(new Date());
            const dateStr = date_utils_1.DateUtils.toLocalDateString(date);
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
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
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
            start.setHours(0, 0, 0, 0); // Start of day Ecuador
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999); // End of day Ecuador
            const orders = yield data_1.Pedido.find({
                where: {
                    estado: data_1.EstadoPedido.ENTREGADO, // Ensure enum match
                    updatedAt: (0, typeorm_1.Between)(start, end)
                },
                relations: ["motorizado"],
                order: { updatedAt: "DESC" }
            });
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
                    let comisionApp = Number(order.comision_moto_app) || Number(order.comision_app_domicilio) || 0;
                    if (comisionApp === 0)
                        comisionApp = Number(order.costoEnvio) * 0.20 || 0;
                    gananciaMoto = Number(order.costoEnvio) - comisionApp || 0;
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
        });
    }
}
exports.FinancialService = FinancialService;
