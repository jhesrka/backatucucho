import { withRedisLock } from "../utils/cron-lock";
import cron from "node-cron";
import { SubscriptionService as BusinessSubscriptionService } from "../presentation/services/subscription.service";
import { Negocio, StatusNegocio } from "../data";

export const startSubscriptionGuardianCron = () => {
    // Ejecutar cada hora exacta (0 minutos)
    cron.schedule("0 * * * *", async () => {
        await withRedisLock("subscription-guardian", 55, async () => {
            console.log("🛡️ [CRON GUARDIAN] Buscando suscripciones de negocios recién caducadas...", new Date().toLocaleString());

            const today = new Date();
            // Buscar negocios ACTIVO cuya fecha ya venció
            const expiredNegocios = await Negocio.createQueryBuilder("negocio")
                .leftJoinAndSelect("negocio.usuario", "usuario")
                .where("negocio.statusNegocio = :status", { status: StatusNegocio.ACTIVO })
                .andWhere("negocio.fechaFinSuscripcion <= :today", { today })
                .getMany();

            if (expiredNegocios.length > 0) {
                console.log(`🛡️ [CRON GUARDIAN] Se encontraron ${expiredNegocios.length} negocios caducados. Intentando cobro...`);
                const businessService = new BusinessSubscriptionService();

                for (const negocio of expiredNegocios) {
                    try {
                        console.log(`🛡️ [CRON GUARDIAN] Cobrando suscripción a: ${negocio.nombre}...`);
                        await businessService.chargeSubscription(negocio, true);
                    } catch (error) {
                        console.warn(`🛡️ [CRON GUARDIAN] Cobro fallido para ${negocio.nombre} (Sin saldo)`);
                    }
                }
            } else {
                console.log("🛡️ [CRON GUARDIAN] Ningún negocio caducado pendiente.");
            }
        });
    }, { timezone: "America/Guayaquil" });

    console.log("[CRON] Guardián de expiración de suscripciones inicializado (Cada hora)");
};
