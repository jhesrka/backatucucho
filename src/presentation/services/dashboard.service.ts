import { startOfDay, endOfDay } from "date-fns";
import { Between, In, Not } from "typeorm";
/*
  IMPORTANTE: Restaurando importaciones directas.
  Si hay error circular probaré otra estrategia.
*/
import { Negocio } from "../../data/postgres/models/Negocio";
import { Pedido } from "../../data/postgres/models/Pedido";
import { Post } from "../../data/postgres/models/post.model";
import { Storie } from "../../data/postgres/models/stories.model";
import { User } from "../../data/postgres/models/user.model";
import { UserMotorizado } from "../../data/postgres/models/UserMotorizado";
import { PriceSettings } from "../../data/postgres/models/PriceSettings";
import { Subscription } from "../../data/postgres/models/subscriptionStatus.model";
import { RechargeRequest } from "../../data/postgres/models/rechargeStatus.model";
import { Transaction } from "../../data/postgres/models/transactionType.model";
import { Producto } from "../../data/postgres/models/Producto";
import { GlobalSettings } from "../../data/postgres/models/global-settings.model";

export class DashboardService {
    async getAdminStats() {
        try {
            // Timezone Fix
            const now = new Date();
            const utcMinus5 = new Date(now.getTime() - (5 * 60 * 60 * 1000));
            const localStart = startOfDay(utcMinus5);
            const localEnd = endOfDay(utcMinus5);
            const todayStart = new Date(localStart.getTime() + (5 * 60 * 60 * 1000));
            const todayEnd = new Date(localEnd.getTime() + (5 * 60 * 60 * 1000));

            // ============================================
            // 1. FINANCIALS (INGRESOS REFINADOS)
            // ============================================
            const SUBSCRIPTION_PRICE = 1.0;

            // Suscripciones
            const suscripcionesHoyCount = await Subscription.count({
                where: {
                    status: "ACTIVA" as any,
                    updatedAt: Between(todayStart, todayEnd)
                }
            });
            const ingresosSuscripciones = suscripcionesHoyCount * SUBSCRIPTION_PRICE;

            // Historias
            const { sum: storiesSum } = await Storie.createQueryBuilder("storie")
                .select("SUM(storie.total_pagado)", "sum")
                .where("storie.statusStorie = :status", { status: "PUBLISHED" })
                .andWhere("storie.createdAt BETWEEN :start AND :end", { start: todayStart, end: todayEnd })
                .getRawOne();
            const ingresosStories = Number(storiesSum) || 0;

            const ingresosAppTotal = ingresosSuscripciones + ingresosStories;

            // Delivery Revenues
            const pedidosEntregadosHoy = await Pedido.find({
                where: {
                    estado: "ENTREGADO" as any,
                    updatedAt: Between(todayStart, todayEnd),
                },
                relations: ["productos"]
            });

            const comisionProductos = pedidosEntregadosHoy.reduce((total, pedido) => {
                const comisionPedido = pedido.productos.reduce((subtotal, pp) => {
                    return subtotal + (Number(pp.comision_producto) * pp.cantidad);
                }, 0);
                return total + comisionPedido;
            }, 0);

            const comisionDomicilios = pedidosEntregadosHoy.reduce(
                (acc, p) => acc + (Number(p.costoEnvio) * 0.2),
                0
            );

            const ingresosDeliveryTotal = comisionProductos + comisionDomicilios;
            const totalIngresosHoy = ingresosAppTotal + ingresosDeliveryTotal;

            // 2. PEDIDOS (NEW BREAKDOWN)
            const pedidosHoy = await Pedido.find({
                where: {
                    createdAt: Between(todayStart, todayEnd),
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
            const negociosNuevosHoy = await Negocio.count({
                where: { created_at: Between(todayStart, todayEnd) },
            });
            const negociosInactivos = await Negocio.count({
                where: { statusNegocio: "SUSPENDIDO" as any },
            });

            // 4. MOTORIZADOS
            const motorizadosActivos = await UserMotorizado.count({
                where: { estadoCuenta: "ACTIVO" as any }
            });

            // 5. USUARIOS
            const usuariosNuevos = await User.count({
                where: { createdAt: Between(todayStart, todayEnd) }
            });

            // 6. ACTIVIDAD RECIENTE
            const lastOrders = await Pedido.find({
                take: 5,
                order: { createdAt: "DESC" },
                relations: ['negocio']
            }).then(orders => orders.map(o => ({
                type: 'ORDER',
                id: o.id,
                text: `Pedido #${o.id.slice(0, 6)} creado en ${o.negocio?.nombre || "Negocio desconocido"}`,
                date: o.createdAt,
                status: o.estado
            })));

            const lastPosts = await Post.find({
                take: 5,
                where: { isPaid: true },
                order: { createdAt: "DESC" },
                relations: ['user']
            }).then(posts => posts.map(p => ({
                type: 'POST',
                id: p.id,
                text: `Post pagado publicado por ${p.user?.name || "Usuario desconocido"}`,
                date: p.createdAt
            })));

            const activityFeed = [...lastOrders, ...lastPosts]
                .sort((a, b) => b.date.getTime() - a.date.getTime())
                .slice(0, 10);

            // 7. LOGISTICS
            const availableMotorizados = await UserMotorizado.find({
                where: {
                    estadoTrabajo: "DISPONIBLE" as any,
                    quiereTrabajar: true,
                    estadoCuenta: "ACTIVO" as any
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
        } catch (error) {
            console.error(`ERROR CRITICO EN SERVICIO: ${String(error)}`);
            throw error;
        }
    }

    async getWeeklyPostStats() {
        try {
            // 1. Array de los últimos 7 días (formato YYYY-MM-DD)
            // Se usa "America/Guayaquil" para asegurar concordancia con cliente
            const last7Days: string[] = [];
            const today = new Date();

            // Función auxiliar para formatear fecha en zona horaria específica
            const getEcuadorDateString = (date: Date) => {
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

            const rawResults = await Post.query(query);

            // 3. Cruzar datos: Array de 7 días vs Resultados BD
            const stats = last7Days.map(dateStr => {
                const found = rawResults.find((r: any) => r.fecha === dateStr);
                return {
                    fecha: dateStr,
                    total: found ? parseInt(found.total) : 0
                };
            });

            return stats;

        } catch (error) {
            console.error("Error getting weekly post stats:", error);
            const fs = require('fs');
            fs.appendFileSync('dashboard_debug.txt', `${new Date().toISOString()} - ERROR getWeeklyPostStats: ${String(error)}\n`);
            throw new Error("Error al obtener estadísticas de publicaciones");
        }
    }

    async getAdvancedStats7Days() {
        try {
            // 1. Array de los últimos 7 días
            const last7Days: string[] = [];
            const today = new Date();
            const getEcuadorDateString = (date: Date) => {
                return date.toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
            };

            for (let i = 6; i >= 0; i--) {
                const day = new Date();
                day.setDate(today.getDate() - i);
                last7Days.push(getEcuadorDateString(day));
            }

            // Helper para ejecutar query y mapear
            const executeAndMap = async (query: string, countOrSum: 'count' | 'sum' = 'count') => {
                const rawResults = await Post.query(query); // Usamos Post.query como runner generico
                return last7Days.map(dateStr => {
                    const found = rawResults.find((r: any) => r.fecha === dateStr);
                    const val = found ? (countOrSum === 'count' ? parseInt(found.total) : parseFloat(found.total)) : 0;
                    return { fecha: dateStr, total: val };
                });
            };

            // 1. Historias Creadas
            const statsHistorias = await executeAndMap(`
                SELECT TO_CHAR("createdAt" AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD') as fecha, COUNT(*)::int as total
                FROM storie
                WHERE "createdAt" >= (NOW() - INTERVAL '7 days') 
                GROUP BY fecha ORDER BY fecha ASC;
            `);

            // 2. Recargas (Suma Monto) - APROBADAS
            const statsRecargas = await executeAndMap(`
                SELECT TO_CHAR("created_at" AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD') as fecha, SUM(amount)::decimal as total
                FROM recharge_requests
                WHERE "created_at" >= (NOW() - INTERVAL '7 days') AND status = 'APROBADO'
                GROUP BY fecha ORDER BY fecha ASC;
            `, 'sum');

            // 3. Ingresos Suscripciones + Historias (Transactions)
            // Reason: SUBSCRIPTION, STORIE. Type: debit (users paying). Status: APPROVED
            const statsIngresosSubStories = await executeAndMap(`
                SELECT TO_CHAR("created_at" AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD') as fecha, SUM(amount)::decimal as total
                FROM transactions
                WHERE "created_at" >= (NOW() - INTERVAL '7 days') 
                AND reason IN ('SUBSCRIPTION', 'STORIE') 
                AND type = 'debit'
                GROUP BY fecha ORDER BY fecha ASC;
            `, 'sum');

            // 4. Ingresos Comisiones App (Pedidos Entregados)
            const statsIngresosComisiones = await executeAndMap(`
                SELECT TO_CHAR("createdAt" AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD') as fecha, SUM(ganancia_app_producto + comision_app_domicilio)::decimal as total
                FROM pedido
                WHERE "createdAt" >= (NOW() - INTERVAL '7 days') 
                AND estado = 'ENTREGADO'
                GROUP BY fecha ORDER BY fecha ASC;
            `, 'sum');

            // 5. Pedidos Entregados (Cantidad)
            const statsPedidosEntregados = await executeAndMap(`
                SELECT TO_CHAR("createdAt" AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD') as fecha, COUNT(*)::int as total
                FROM pedido
                WHERE "createdAt" >= (NOW() - INTERVAL '7 days') 
                AND estado = 'ENTREGADO'
                GROUP BY fecha ORDER BY fecha ASC;
            `);

            // 6. Nuevos Usuarios
            const statsNuevosUsuarios = await executeAndMap(`
                SELECT TO_CHAR("createdAt" AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD') as fecha, COUNT(*)::int as total
                FROM "user"
                WHERE "createdAt" >= (NOW() - INTERVAL '7 days') 
                GROUP BY fecha ORDER BY fecha ASC;
            `);

            // Resumen Usuarios
            const usuariosPendientes = await User.count({ where: { status: 'INACTIVE' as any } });
            const usuariosActivos = await User.count({ where: { status: 'ACTIVE' as any } });

            // 7. Nuevos Negocios
            const statsNuevosNegocios = await executeAndMap(`
                SELECT TO_CHAR("created_at" AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD') as fecha, COUNT(*)::int as total
                FROM negocio
                WHERE "created_at" >= (NOW() - INTERVAL '7 days') 
                GROUP BY fecha ORDER BY fecha ASC;
            `);

            // 8. Nuevos Productos
            const statsNuevosProductos = await executeAndMap(`
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

        } catch (error) {
            console.error("Error getting advanced stats:", error);
            throw new Error("Error al obtener estadísticas avanzadas");
        }
    }
    async getOperationalDashboardToday() {
        try {
            // Configurar "Hoy" en Guayaquil
            const queryDate = `(NOW() AT TIME ZONE 'America/Guayaquil')::date`;

            // 1. Negocios Abiertos (Tiempo Real)
            const negociosAbiertos = await Negocio.find({
                where: { estadoNegocio: "ABIERTO" as any },
                select: ["id", "nombre", "imagenNegocio"],
            });

            // Count active orders for each open business
            const negociosAbiertosWithCount = await Promise.all(negociosAbiertos.map(async (n) => {
                const activeOrders = await Pedido.count({
                    where: {
                        negocio: { id: n.id },
                        estado: Not(In(["ENTREGADO", "CANCELADO"] as any))
                    }
                });
                return {
                    id: n.id,
                    nombre: n.nombre,
                    imagen: n.imagenNegocio,
                    pedidosActivos: activeOrders
                };
            }));

            // 2. Top 10 Publicaciones del Día
            const topPostsToday = await Post.createQueryBuilder("post")
                .leftJoinAndSelect("post.user", "user")
                .where(`("post"."createdAt" AT TIME ZONE 'America/Guayaquil')::date = ${queryDate}`)
                .orderBy("post.createdAt", "DESC")
                .take(10)
                .select(["post.id", "post.title", "post.createdAt", "post.statusPost", "user.name", "user.surname", "user.email"])
                .getMany();

            // 3. Últimas 10 Historias del Día
            const topStoriesToday = await Storie.createQueryBuilder("storie")
                .leftJoinAndSelect("storie.user", "user")
                .where(`("storie"."createdAt" AT TIME ZONE 'America/Guayaquil')::date = ${queryDate}`)
                .orderBy("storie.createdAt", "DESC")
                .take(10)
                .select(["storie.id", "storie.createdAt", "storie.statusStorie", "user.name", "user.surname", "user.email"])
                .getMany();

            // 4. Estado Global de la App
            const globalSettings = await GlobalSettings.findOne({ where: {} });

            // 5. Top 5 Negocios con Más Ventas (Hoy)
            const topNegociosRaw = await Post.query(`
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
            const topProductosRaw = await Post.query(`
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
            const topMotorizadosRaw = await Post.query(`
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
            const motorizadosDisponibles = await UserMotorizado.find({
                where: {
                    estadoTrabajo: 'DISPONIBLE' as any,
                    estadoCuenta: 'ACTIVO' as any,
                    quiereTrabajar: true
                },
                select: ["id", "name", "surname", "whatsapp", "fechaHoraDisponible"]
            });

            return {
                negociosAbiertos: negociosAbiertosWithCount,
                publicacionesHoy: topPostsToday.map(p => ({
                    id: p.id,
                    usuario: `${p.user?.name || ''} ${p.user?.surname || ''}`.trim() || 'Desconocido',
                    email: p.user?.email || '',
                    titulo: p.title,
                    hora: new Date(p.createdAt).toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit' }),
                    estado: p.statusPost
                })),
                historiasHoy: topStoriesToday.map(s => ({
                    id: s.id,
                    usuario: `${s.user?.name || ''} ${s.user?.surname || ''}`.trim() || 'Desconocido',
                    email: s.user?.email || '',
                    hora: new Date(s.createdAt).toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit' }),
                    estado: s.statusStorie
                })),
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

        } catch (error) {
            console.error("Error getting operational dashboard stats:", error);
            throw new Error("Error al obtener dashboard operativo");
        }
    }
}
