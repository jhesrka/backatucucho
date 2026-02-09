import { startOfDay, endOfDay } from "date-fns";
import { Between } from "typeorm";
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

export class DashboardService {
    async getAdminStats() {
        const fs = require('fs');
        const log = (msg: string) => {
            try {
                fs.appendFileSync('dashboard_debug.txt', `${new Date().toISOString()} - DEBUG: ${msg}\n`);
            } catch (e) {
                console.error(e);
            }
        };

        try {
            log("Starting getAdminStats - Timezone Fix (UTC-5)");

            // Verificacion de Modelos
            if (!Pedido) throw new Error("Pedido model is undefined");
            if (!Negocio) throw new Error("Negocio model is undefined");

            /*
               TIMEZONE FIX:
               El servidor corre en UTC. El usuario está en UTC-5.
               Si son las 21:00 del dia 13 (Local) -> Son las 02:00 del dia 14 (UTC).
               Si calculamos "Hoy" con UTC puro, obtenemos Dia 14 (00:00 - 23:59).
               Pero el usuario quiere ver los datos DEL DIA 13 (Su "Hoy").
               
               Solucion: Restamos 5 horas a la fecha actual para obtener la fecha "Local",
               calculamos el start/end de ese dia local, y luego lo pasamos a query.
               
               (Si la DB guarda en UTC, debemos ajustar el rango de query acorde).
             */
            const now = new Date();
            const utcMinus5 = new Date(now.getTime() - (5 * 60 * 60 * 1000));

            const localStart = startOfDay(utcMinus5); // 00:00 del dia local
            const localEnd = endOfDay(utcMinus5);     // 23:59 del dia local

            // Ajuste para query: Si DB está en UTC, convertir localStart a UTC REAL (+5h)
            // Si localStart es "2026-01-13 00:00:00.000Z" (porque startOfDay preserva el objeto Date pero resetea hora)
            // Queremos que el query busque desde "2026-01-13 05:00:00 UTC" hasta "2026-01-14 05:00:00 UTC".
            // Para eso sumamos 5h a los bordes.

            const queryStart = new Date(localStart.getTime() + (5 * 60 * 60 * 1000));
            const queryEnd = new Date(localEnd.getTime() + (5 * 60 * 60 * 1000));

            // Use these for querying
            const todayStart = queryStart;
            const todayEnd = queryEnd;

            log(`Server Time: ${now.toISOString()}`);
            log(`User Local Time (~): ${utcMinus5.toISOString()}`);
            log(`Query Range (UTC): ${todayStart.toISOString()} - ${todayEnd.toISOString()}`);

            // ============================================
            // 1. FINANCIALS (INGRESOS REFINADOS)
            // ============================================

            /*
              A) INGRESOS HOY (APP / FACE)
              - Suscripciones pagadas hoy (asumiendo costo base $1.00 si no hay setting)
              - Historias pagadas hoy
            */
            log(`Date Range: ${todayStart.toISOString()} - ${todayEnd.toISOString()}`);

            /*
              A) INGRESOS HOY (APP / FACE)
              - Suscripciones pagadas hoy (asumiendo costo base $1.00 si no hay setting)
              - Historias pagadas hoy
            */
            const SUBSCRIPTION_PRICE = 1.0; // Precio base de suscripción

            // Suscripciones activas actualizadas hoy (cubre nuevas y renovaciones)
            const suscripcionesHoyCount = await Subscription.count({
                where: {
                    status: "ACTIVA" as any,
                    updatedAt: Between(todayStart, todayEnd)
                }
            });
            log(`Suscripciones hoy (by updatedAt) found: ${suscripcionesHoyCount}`);
            const ingresosSuscripciones = suscripcionesHoyCount * SUBSCRIPTION_PRICE;

            // Historias pagadas hoy (Suma real de total_pagado)
            const { sum: storiesSum } = await Storie.createQueryBuilder("storie")
                .select("SUM(storie.total_pagado)", "sum")
                .where("storie.statusStorie = :status", { status: "PUBLISHED" })
                .andWhere("storie.createdAt BETWEEN :start AND :end", { start: todayStart, end: todayEnd })
                .getRawOne();

            const ingresosStories = Number(storiesSum) || 0;
            log(`Stories revenue (SUM total_pagado): ${ingresosStories}`);

            const ingresosAppTotal = ingresosSuscripciones + ingresosStories;


            /*
              B) INGRESOS HOY – DELIVERY
              - Comisión por productos (Precio normal - Precio app)
              - Comisión por domicilio (20% del costo del domicilio)
            */

            // Pedidos Entregados Hoy con sus Productos para calcular comisión precisa
            const pedidosEntregadosHoy = await Pedido.find({
                where: {
                    estado: "ENTREGADO" as any,
                    updatedAt: Between(todayStart, todayEnd),
                },
                relations: ["productos"]
            });

            // Comisión por Productos: Suma de (pp.comision_producto * pp.cantidad)
            const comisionProductos = pedidosEntregadosHoy.reduce((total, pedido) => {
                const comisionPedido = pedido.productos.reduce((subtotal, pp) => {
                    return subtotal + (Number(pp.comision_producto) * pp.cantidad);
                }, 0);
                return total + comisionPedido;
            }, 0);

            // Comisión por Domicilio: 20% del costoEnvio
            const comisionDomicilios = pedidosEntregadosHoy.reduce(
                (acc, p) => acc + (Number(p.costoEnvio) * 0.2),
                0
            );

            const ingresosDeliveryTotal = comisionProductos + comisionDomicilios;

            const totalIngresosHoy = ingresosAppTotal + ingresosDeliveryTotal;

            // 2. PEDIDOS
            const pedidosHoy = await Pedido.find({
                where: {
                    createdAt: Between(todayStart, todayEnd),
                },
            });

            const pedidosCount = {
                total: pedidosHoy.length,
                pendientes: pedidosHoy.filter(p => p.estado === "PENDIENTE").length,
                preparando: pedidosHoy.filter(p => p.estado.includes("PREPARANDO")).length,
                enCamino: pedidosHoy.filter(p => p.estado === "EN_CAMINO").length,
                entregados: pedidosHoy.filter(p => p.estado === "ENTREGADO").length,
                cancelados: pedidosHoy.filter(p => p.estado === "CANCELADO").length,
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

            // ============================================
            // 5. USUARIOS
            // ============================================
            const usuariosNuevos = await User.count({
                where: { createdAt: Between(todayStart, todayEnd) }
            });

            // ============================================
            // 6. ACTIVIDAD RECIENTE (Mix)
            // ============================================
            // Getting last 5 orders
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

            // Getting last 5 posts
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

            // Merge and sort
            const activityFeed = [...lastOrders, ...lastPosts]
                .sort((a, b) => b.date.getTime() - a.date.getTime())
                .slice(0, 10);

            // ============================================
            // 7. LOGISTICS (MOTORIZADOS DISPONIBLES)
            // ============================================
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


            log("Finished getAdminStats");
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
            log(`ERROR CRITICO EN SERVICIO: ${String(error)}`);
            throw error;
        }
    }
}
