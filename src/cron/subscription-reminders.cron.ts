import { withRedisLock } from "../utils/cron-lock";
import cron from "node-cron";
import { Negocio, StatusNegocio } from "../data";
import { NotificationService } from "../presentation/services/NotificationService";

export const startSubscriptionRemindersCron = () => {
    // Ejecutar todos los días a las 9:00 AM
    cron.schedule("0 9 * * *", async () => {
        await withRedisLock("subscription-reminders", 55, async () => {
            console.log("🔔 [CRON RECORDATORIOS] Buscando suscripciones por vencer o vencidas...", new Date().toLocaleString());

            const notificationService = new NotificationService();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Buscar negocios activos o no pagados con suscripción
            const negocios = await Negocio.createQueryBuilder("negocio")
                .leftJoinAndSelect("negocio.usuario", "usuario")
                .where("negocio.statusNegocio IN (:...statuses)", { 
                    statuses: [StatusNegocio.ACTIVO, StatusNegocio.NO_PAGADO] 
                })
                .andWhere("negocio.fechaFinSuscripcion IS NOT NULL")
                .getMany();

            for (const negocio of negocios) {
                if (!negocio.fechaFinSuscripcion || !negocio.usuario) continue;

                const fechaFin = new Date(negocio.fechaFinSuscripcion);
                fechaFin.setHours(0, 0, 0, 0);

                const difTime = fechaFin.getTime() - today.getTime();
                const difDays = Math.ceil(difTime / (1000 * 3600 * 24));

                let title = "";
                let body = "";

                // MODO PREVENTIVO (Antes de caducar)
                if (negocio.statusNegocio === StatusNegocio.ACTIVO) {
                    if (difDays === 2) {
                        title = "⚠️ Tu suscripción vence pronto";
                        body = `La suscripción de ${negocio.nombre} vence en 2 días. Asegúrate de tener saldo en tu Wallet.`;
                    } else if (difDays === 1) {
                        title = "🚨 Tu suscripción vence MAÑANA";
                        body = `Mañana vence la suscripción de ${negocio.nombre}. Recuerda recargar tu Wallet hoy para evitar interrupciones.`;
                    }
                }

                // MODO REACTIVO (Después de caducar)
                if (negocio.statusNegocio === StatusNegocio.NO_PAGADO || (negocio.statusNegocio === StatusNegocio.ACTIVO && difDays < 0)) {
                    // Notificar los días 1, 2 y 3 de atraso
                    if (difDays === -1 || difDays === -2 || difDays === -3) {
                        title = "❌ Negocio oculto por pago pendiente";
                        body = `Tu negocio ${negocio.nombre} está oculto por falta de pago. Recarga tu Wallet ahora para reactivarlo automáticamente.`;
                    }
                }

                if (title && body) {
                    try {
                        await notificationService.sendPushNotification(
                            negocio.usuario.id,
                            title,
                            body,
                            { url: '/user/mis-negocios' } 
                        );
                        console.log(`🔔 Notificación enviada a usuario ${negocio.usuario.id} (Negocio: ${negocio.nombre}) - Diferencia días: ${difDays}`);
                    } catch (error) {
                        console.error(`Error enviando recordatorio a ${negocio.usuario.id}:`, error);
                    }
                }
            }
        });
    }, { timezone: "America/Guayaquil" });

    console.log("[CRON] Sistema de recordatorios de suscripciones inicializado (9:00 AM daily)");
};
