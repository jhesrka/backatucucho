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
exports.DashboardService = void 0;
const date_fns_1 = require("date-fns");
const typeorm_1 = require("typeorm");
/*
  IMPORTANTE: Restaurando importaciones directas.
  Si hay error circular probaré otra estrategia.
*/
const Negocio_1 = require("../../data/postgres/models/Negocio");
const Pedido_1 = require("../../data/postgres/models/Pedido");
const post_model_1 = require("../../data/postgres/models/post.model");
const stories_model_1 = require("../../data/postgres/models/stories.model");
const user_model_1 = require("../../data/postgres/models/user.model");
const UserMotorizado_1 = require("../../data/postgres/models/UserMotorizado");
const subscriptionStatus_model_1 = require("../../data/postgres/models/subscriptionStatus.model");
const global_settings_model_1 = require("../../data/postgres/models/global-settings.model");
class DashboardService {
    getAdminStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Timezone Fix
                const now = new Date();
                const utcMinus5 = new Date(now.getTime() - (5 * 60 * 60 * 1000));
                const localStart = (0, date_fns_1.startOfDay)(utcMinus5);
                const localEnd = (0, date_fns_1.endOfDay)(utcMinus5);
                const todayStart = new Date(localStart.getTime() + (5 * 60 * 60 * 1000));
                const todayEnd = new Date(localEnd.getTime() + (5 * 60 * 60 * 1000));
                // ============================================
                // 1. FINANCIALS (INGRESOS REFINADOS)
                // ============================================
                const SUBSCRIPTION_PRICE = 1.0;
                // Suscripciones
                const suscripcionesHoyCount = yield subscriptionStatus_model_1.Subscription.count({
                    where: {
                        status: "ACTIVA",
                        updatedAt: (0, typeorm_1.Between)(todayStart, todayEnd)
                    }
                });
                const ingresosSuscripciones = suscripcionesHoyCount * SUBSCRIPTION_PRICE;
                // Historias
                const { sum: storiesSum } = yield stories_model_1.Storie.createQueryBuilder("storie")
                    .select("SUM(storie.total_pagado)", "sum")
                    .where("storie.statusStorie = :status", { status: "PUBLISHED" })
                    .andWhere("storie.createdAt BETWEEN :start AND :end", { start: todayStart, end: todayEnd })
                    .getRawOne();
                const ingresosStories = Number(storiesSum) || 0;
                const ingresosAppTotal = ingresosSuscripciones + ingresosStories;
                // Delivery Revenues
                const pedidosEntregadosHoy = yield Pedido_1.Pedido.find({
                    where: {
                        estado: "ENTREGADO",
                        updatedAt: (0, typeorm_1.Between)(todayStart, todayEnd),
                    },
                    relations: ["productos"]
                });
                const comisionProductos = pedidosEntregadosHoy.reduce((total, pedido) => {
                    const comisionPedido = pedido.productos.reduce((subtotal, pp) => {
                        return subtotal + (Number(pp.comision_producto) * pp.cantidad);
                    }, 0);
                    return total + comisionPedido;
                }, 0);
                const comisionDomicilios = pedidosEntregadosHoy.reduce((acc, p) => acc + (Number(p.costoEnvio) * 0.2), 0);
                const ingresosDeliveryTotal = comisionProductos + comisionDomicilios;
                const totalIngresosHoy = ingresosAppTotal + ingresosDeliveryTotal;
                // 2. PEDIDOS (NEW BREAKDOWN)
                const pedidosHoy = yield Pedido_1.Pedido.find({
                    where: {
                        createdAt: (0, typeorm_1.Between)(todayStart, todayEnd),
                    },
                });
                const pedidosCount = {
                    total: pedidosHoy.length,
                    pendiente: pedidosHoy.filter(p => p.estado === "PENDIENTE").length,
                    aceptado: pedidosHoy.filter(p => p.estado === "ACEPTADO").length,
                    preparando: pedidosHoy.filter(p => p.estado === "PREPARANDO").length,
                    preparando_asignado: pedidosHoy.filter(p => p.estado === "PREPARANDO_ASIGNADO").length,
                    preparando_no_asignado: pedidosHoy.filter(p => p.estado === "PREPARANDO_NO_ASIGNADO").length,
                    en_camino: pedidosHoy.filter(p => p.estado === "EN_CAMINO").length,
                    entregado: pedidosHoy.filter(p => p.estado === "ENTREGADO").length,
                    cancelado: pedidosHoy.filter(p => p.estado === "CANCELADO").length,
                    efectivo: pedidosHoy.filter(p => p.metodoPago === "EFECTIVO").length,
                    transferencia: pedidosHoy.filter(p => p.metodoPago === "TRANSFERENCIA").length,
                };
                // 3. NEGOCIOS
                const negociosNuevosHoy = yield Negocio_1.Negocio.count({
                    where: { created_at: (0, typeorm_1.Between)(todayStart, todayEnd) },
                });
                const negociosInactivos = yield Negocio_1.Negocio.count({
                    where: { statusNegocio: "SUSPENDIDO" },
                });
                // 4. MOTORIZADOS
                const motorizadosActivos = yield UserMotorizado_1.UserMotorizado.count({
                    where: { estadoCuenta: "ACTIVO" }
                });
                // 5. USUARIOS
                const usuariosNuevos = yield user_model_1.User.count({
                    where: { createdAt: (0, typeorm_1.Between)(todayStart, todayEnd) }
                });
                // 6. ACTIVIDAD RECIENTE
                const lastOrders = yield Pedido_1.Pedido.find({
                    take: 5,
                    order: { createdAt: "DESC" },
                    relations: ['negocio']
                }).then(orders => orders.map(o => {
                    var _a;
                    return ({
                        type: 'ORDER',
                        id: o.id,
                        text: `Pedido #${o.id.slice(0, 6)} creado en ${((_a = o.negocio) === null || _a === void 0 ? void 0 : _a.nombre) || "Negocio desconocido"}`,
                        date: o.createdAt,
                        status: o.estado
                    });
                }));
                const lastPosts = yield post_model_1.Post.find({
                    take: 5,
                    where: { isPaid: true },
                    order: { createdAt: "DESC" },
                    relations: ['user']
                }).then(posts => posts.map(p => {
                    var _a;
                    return ({
                        type: 'POST',
                        id: p.id,
                        text: `Post pagado publicado por ${((_a = p.user) === null || _a === void 0 ? void 0 : _a.name) || "Usuario desconocido"}`,
                        date: p.createdAt
                    });
                }));
                const activityFeed = [...lastOrders, ...lastPosts]
                    .sort((a, b) => b.date.getTime() - a.date.getTime())
                    .slice(0, 10);
                // 7. LOGISTICS
                const availableMotorizados = yield UserMotorizado_1.UserMotorizado.find({
                    where: {
                        estadoTrabajo: "DISPONIBLE",
                        quiereTrabajar: true,
                        estadoCuenta: "ACTIVO"
                    },
                    order: {
                        fechaHoraDisponible: "ASC"
                    }
                });
                const logistics = {
                    availableCount: availableMotorizados.length,
                    list: availableMotorizados.map(m => ({
                        id: m.id,
                        name: `${m.name} ${m.surname}`,
                        phone: m.whatsapp,
                        availableSince: m.fechaHoraDisponible,
                        status: "DISPONIBLE"
                    }))
                };
                return {
                    financials: {
                        totalIngresosHoy: Number(totalIngresosHoy.toFixed(2)),
                        ingresosAppTotal: Number(ingresosAppTotal.toFixed(2)),
                        ingresosDeliveryTotal: Number(ingresosDeliveryTotal.toFixed(2)),
                        details: {
                            suscripciones: Number(ingresosSuscripciones.toFixed(2)),
                            stories: Number(ingresosStories.toFixed(2)),
                            comisionProductos: Number(comisionProductos.toFixed(2)),
                            comisionDomicilios: Number(comisionDomicilios.toFixed(2))
                        }
                    },
                    pedidos: pedidosCount,
                    negocios: {
                        nuevosHoy: negociosNuevosHoy,
                        inactivos: negociosInactivos,
                    },
                    motorizados: {
                        activos: motorizadosActivos,
                    },
                    usuarios: {
                        nuevosHoy: usuariosNuevos,
                    },
                    activityFeed,
                    logistics
                };
            }
            catch (error) {
                console.error(`ERROR CRITICO EN SERVICIO: ${String(error)}`);
                throw error;
            }
        });
    }
    getWeeklyPostStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 1. Array de los últimos 7 días (formato YYYY-MM-DD)
                // Se usa "America/Guayaquil" para asegurar concordancia con cliente
                const last7Days = [];
                const today = new Date();
                // Función auxiliar para formatear fecha en zona horaria específica
                const getEcuadorDateString = (date) => {
                    // Truco: obtener componentes en la zona horaria deseada
                    return date.toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
                };
                for (let i = 6; i >= 0; i--) {
                    const day = new Date();
                    day.setDate(today.getDate() - i);
                    last7Days.push(getEcuadorDateString(day));
                }
                // 2. Consulta SQL pura para agrupar por fecha (driver Postgres)
                // IMPORTANTE: "AT TIME ZONE 'America/Guayaquil'" convierte el timestamp UTC al local para agrupar correctamente
                const query = `
                SELECT 
                    TO_CHAR("createdAt" AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD') as fecha,
                    COUNT(*)::int as total
                FROM post
                WHERE "createdAt" >= (NOW() - INTERVAL '7 days') 
                GROUP BY fecha
                ORDER BY fecha ASC;
            `;
                const rawResults = yield post_model_1.Post.query(query);
                // 3. Cruzar datos: Array de 7 días vs Resultados BD
                const stats = last7Days.map(dateStr => {
                    const found = rawResults.find((r) => r.fecha === dateStr);
                    return {
                        fecha: dateStr,
                        total: found ? parseInt(found.total) : 0
                    };
                });
                return stats;
            }
            catch (error) {
                console.error("Error getting weekly post stats:", error);
                const fs = require('fs');
                fs.appendFileSync('dashboard_debug.txt', `${new Date().toISOString()} - ERROR getWeeklyPostStats: ${String(error)}\n`);
                throw new Error("Error al obtener estadísticas de publicaciones");
            }
        });
    }
    getAdvancedStats7Days() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 1. Array de los últimos 7 días
                const last7Days = [];
                const today = new Date();
                const getEcuadorDateString = (date) => {
                    return date.toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
                };
                for (let i = 6; i >= 0; i--) {
                    const day = new Date();
                    day.setDate(today.getDate() - i);
                    last7Days.push(getEcuadorDateString(day));
                }
                // Helper para ejecutar query y mapear
                const executeAndMap = (query_1, ...args_1) => __awaiter(this, [query_1, ...args_1], void 0, function* (query, countOrSum = 'count') {
                    const rawResults = yield post_model_1.Post.query(query); // Usamos Post.query como runner generico
                    return last7Days.map(dateStr => {
                        const found = rawResults.find((r) => r.fecha === dateStr);
                        const val = found ? (countOrSum === 'count' ? parseInt(found.total) : parseFloat(found.total)) : 0;
                        return { fecha: dateStr, total: val };
                    });
                });
                // 1. Historias Creadas
                const statsHistorias = yield executeAndMap(`
                SELECT TO_CHAR("createdAt" AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD') as fecha, COUNT(*)::int as total
                FROM storie
                WHERE "createdAt" >= (NOW() - INTERVAL '7 days') 
                GROUP BY fecha ORDER BY fecha ASC;
            `);
                // 2. Recargas (Suma Monto) - APROBADAS
                const statsRecargas = yield executeAndMap(`
                SELECT TO_CHAR("created_at" AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD') as fecha, SUM(amount)::decimal as total
                FROM recharge_requests
                WHERE "created_at" >= (NOW() - INTERVAL '7 days') AND status = 'APROBADO'
                GROUP BY fecha ORDER BY fecha ASC;
            `, 'sum');
                // 3. Ingresos Suscripciones + Historias (Transactions)
                // Reason: SUBSCRIPTION, STORIE. Type: debit (users paying). Status: APPROVED
                const statsIngresosSubStories = yield executeAndMap(`
                SELECT TO_CHAR("created_at" AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD') as fecha, SUM(amount)::decimal as total
                FROM transactions
                WHERE "created_at" >= (NOW() - INTERVAL '7 days') 
                AND reason IN ('SUBSCRIPTION', 'STORIE') 
                AND type = 'debit'
                GROUP BY fecha ORDER BY fecha ASC;
            `, 'sum');
                // 4. Ingresos Comisiones App (Pedidos Entregados)
                const statsIngresosComisiones = yield executeAndMap(`
                SELECT TO_CHAR("createdAt" AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD') as fecha, SUM(ganancia_app_producto + comision_app_domicilio)::decimal as total
                FROM pedido
                WHERE "createdAt" >= (NOW() - INTERVAL '7 days') 
                AND estado = 'ENTREGADO'
                GROUP BY fecha ORDER BY fecha ASC;
            `, 'sum');
                // 5. Pedidos Entregados (Cantidad)
                const statsPedidosEntregados = yield executeAndMap(`
                SELECT TO_CHAR("createdAt" AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD') as fecha, COUNT(*)::int as total
                FROM pedido
                WHERE "createdAt" >= (NOW() - INTERVAL '7 days') 
                AND estado = 'ENTREGADO'
                GROUP BY fecha ORDER BY fecha ASC;
            `);
                // 6. Nuevos Usuarios
                const statsNuevosUsuarios = yield executeAndMap(`
                SELECT TO_CHAR("createdAt" AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD') as fecha, COUNT(*)::int as total
                FROM "user"
                WHERE "createdAt" >= (NOW() - INTERVAL '7 days') 
                GROUP BY fecha ORDER BY fecha ASC;
            `);
                // Resumen Usuarios
                const usuariosPendientes = yield user_model_1.User.count({ where: { status: 'INACTIVE' } });
                const usuariosActivos = yield user_model_1.User.count({ where: { status: 'ACTIVE' } });
                // 7. Nuevos Negocios
                const statsNuevosNegocios = yield executeAndMap(`
                SELECT TO_CHAR("created_at" AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD') as fecha, COUNT(*)::int as total
                FROM negocio
                WHERE "created_at" >= (NOW() - INTERVAL '7 days') 
                GROUP BY fecha ORDER BY fecha ASC;
            `);
                // 8. Nuevos Productos
                const statsNuevosProductos = yield executeAndMap(`
                SELECT TO_CHAR("created_at" AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD') as fecha, COUNT(*)::int as total
                FROM producto
                WHERE "created_at" >= (NOW() - INTERVAL '7 days') 
                GROUP BY fecha ORDER BY fecha ASC;
            `);
                return {
                    historias: statsHistorias,
                    recargas: statsRecargas,
                    ingresosSuscripcionesHistorias: statsIngresosSubStories,
                    ingresosComisiones: statsIngresosComisiones,
                    pedidosEntregados: statsPedidosEntregados,
                    nuevosUsuarios: statsNuevosUsuarios,
                    resumenUsuarios: {
                        pendientes: usuariosPendientes,
                        activos: usuariosActivos
                    },
                    nuevosNegocios: statsNuevosNegocios,
                    nuevosProductos: statsNuevosProductos
                };
            }
            catch (error) {
                console.error("Error getting advanced stats:", error);
                throw new Error("Error al obtener estadísticas avanzadas");
            }
        });
    }
    getOperationalDashboardToday() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Configurar "Hoy" en Guayaquil
                const queryDate = `(NOW() AT TIME ZONE 'America/Guayaquil')::date`;
                // 1. Negocios Abiertos (Tiempo Real)
                const negociosAbiertos = yield Negocio_1.Negocio.find({
                    where: { estadoNegocio: "ABIERTO" },
                    select: ["id", "nombre", "imagenNegocio"],
                });
                // Count active orders for each open business
                const negociosAbiertosWithCount = yield Promise.all(negociosAbiertos.map((n) => __awaiter(this, void 0, void 0, function* () {
                    const activeOrders = yield Pedido_1.Pedido.count({
                        where: {
                            negocio: { id: n.id },
                            estado: (0, typeorm_1.Not)((0, typeorm_1.In)(["ENTREGADO", "CANCELADO"]))
                        }
                    });
                    return {
                        id: n.id,
                        nombre: n.nombre,
                        imagen: n.imagenNegocio,
                        pedidosActivos: activeOrders
                    };
                })));
                // 2. Top 10 Publicaciones del Día
                const topPostsToday = yield post_model_1.Post.createQueryBuilder("post")
                    .leftJoinAndSelect("post.user", "user")
                    .where(`("post"."createdAt" AT TIME ZONE 'America/Guayaquil')::date = ${queryDate}`)
                    .orderBy("post.createdAt", "DESC")
                    .take(10)
                    .select(["post.id", "post.title", "post.createdAt", "post.statusPost", "user.name", "user.surname", "user.email"])
                    .getMany();
                // 3. Últimas 10 Historias del Día
                const topStoriesToday = yield stories_model_1.Storie.createQueryBuilder("storie")
                    .leftJoinAndSelect("storie.user", "user")
                    .where(`("storie"."createdAt" AT TIME ZONE 'America/Guayaquil')::date = ${queryDate}`)
                    .orderBy("storie.createdAt", "DESC")
                    .take(10)
                    .select(["storie.id", "storie.createdAt", "storie.statusStorie", "user.name", "user.surname", "user.email"])
                    .getMany();
                // 4. Estado Global de la App
                const globalSettings = yield global_settings_model_1.GlobalSettings.findOne({ where: {} });
                // 5. Top 5 Negocios con Más Ventas (Hoy)
                const topNegociosRaw = yield post_model_1.Post.query(`
                SELECT n.nombre, COUNT(p.id)::int as cantidad, SUM(p.total)::decimal as ingresos
                FROM pedido p
                JOIN negocio n ON p."negocioId" = n.id
                WHERE p.estado = 'ENTREGADO'
                AND (p."createdAt" AT TIME ZONE 'America/Guayaquil')::date = ${queryDate}
                GROUP BY n.id, n.nombre
                ORDER BY cantidad DESC
                LIMIT 5
            `);
                // 6. Top 5 Productos Más Vendidos
                const topProductosRaw = yield post_model_1.Post.query(`
                SELECT pr.nombre, n.nombre as negocio, SUM(pp.cantidad)::int as cantidad, SUM(pp.precio_venta * pp.cantidad)::decimal as total
                FROM producto_pedido pp
                JOIN producto pr ON pp."productoId" = pr.id
                JOIN pedido p ON pp."pedidoId" = p.id
                JOIN negocio n ON pr."negocioId" = n.id
                WHERE p.estado = 'ENTREGADO'
                AND (p."createdAt" AT TIME ZONE 'America/Guayaquil')::date = ${queryDate}
                GROUP BY pr.id, pr.nombre, n.id, n.nombre
                ORDER BY cantidad DESC
                LIMIT 5
            `);
                // 7. Motorizados con Más Entregas (Ranking)
                const topMotorizadosRaw = yield post_model_1.Post.query(`
                SELECT u.name, u.surname, COUNT(p.id)::int as entregas
                FROM pedido p
                JOIN user_motorizado u ON p."motorizadoId" = u.id
                WHERE p.estado = 'ENTREGADO'
                AND (p."createdAt" AT TIME ZONE 'America/Guayaquil')::date = ${queryDate}
                GROUP BY u.id, u.name, u.surname
                ORDER BY entregas DESC
                LIMIT 5
            `);
                // 8. Motorizados Disponibles (Tiempo Real)
                const motorizadosDisponibles = yield UserMotorizado_1.UserMotorizado.find({
                    where: {
                        estadoTrabajo: 'DISPONIBLE',
                        estadoCuenta: 'ACTIVO',
                        quiereTrabajar: true
                    },
                    select: ["id", "name", "surname", "whatsapp", "fechaHoraDisponible"]
                });
                return {
                    negociosAbiertos: negociosAbiertosWithCount,
                    publicacionesHoy: topPostsToday.map(p => {
                        var _a, _b, _c;
                        return ({
                            id: p.id,
                            usuario: `${((_a = p.user) === null || _a === void 0 ? void 0 : _a.name) || ''} ${((_b = p.user) === null || _b === void 0 ? void 0 : _b.surname) || ''}`.trim() || 'Desconocido',
                            email: ((_c = p.user) === null || _c === void 0 ? void 0 : _c.email) || '',
                            titulo: p.title,
                            hora: new Date(p.createdAt).toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit' }),
                            estado: p.statusPost
                        });
                    }),
                    historiasHoy: topStoriesToday.map(s => {
                        var _a, _b, _c;
                        return ({
                            id: s.id,
                            usuario: `${((_a = s.user) === null || _a === void 0 ? void 0 : _a.name) || ''} ${((_b = s.user) === null || _b === void 0 ? void 0 : _b.surname) || ''}`.trim() || 'Desconocido',
                            email: ((_c = s.user) === null || _c === void 0 ? void 0 : _c.email) || '',
                            hora: new Date(s.createdAt).toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit' }),
                            estado: s.statusStorie
                        });
                    }),
                    estadoApp: globalSettings,
                    topNegocios: topNegociosRaw,
                    topProductos: topProductosRaw,
                    topMotorizados: topMotorizadosRaw,
                    motorizadosDisponibles: motorizadosDisponibles.map(m => ({
                        id: m.id,
                        nombre: `${m.name} ${m.surname}`,
                        telefono: m.whatsapp,
                        hora: m.fechaHoraDisponible ? new Date(m.fechaHoraDisponible).toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit' }) : 'Reciente'
                    }))
                };
            }
            catch (error) {
                console.error("Error getting operational dashboard stats:", error);
                throw new Error("Error al obtener dashboard operativo");
            }
        });
    }
}
exports.DashboardService = DashboardService;
