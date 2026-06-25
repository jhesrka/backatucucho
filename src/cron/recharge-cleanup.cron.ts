import { withRedisLock } from "../utils/cron-lock";
import cron from "node-cron";
import { RechargeRequest, StatusRecarga } from "../data";
import { LessThan } from "typeorm";

export const startRechargeCleanupCron = () => {
    console.log("⏳ [CRON] Limpiador de recargas huérfanas iniciado (corre cada hora)");

    // Corre en el minuto 0 de cada hora
    cron.schedule("0 * * * *", async () => {
        await withRedisLock("recharge-cleanup", 55, async () => {
        try {
            const twoHoursAgo = new Date();
            twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

            const result = await RechargeRequest.createQueryBuilder()
                .update(RechargeRequest)
                .set({ 
                    status: StatusRecarga.RECHAZADO, 
                    admin_comment: "Expirado automáticamente por inactividad" 
                })
                .where("status = :status AND created_at < :limitDate AND payment_method = 'CARD'", { 
                    status: StatusRecarga.PENDIENTE, 
                    limitDate: twoHoursAgo 
                })
                .execute();

            if (result.affected && result.affected > 0) {
                console.log(`🧹 [CRON] Se limpiaron ${result.affected} recargas huérfanas/abandonadas.`);
            }
        } catch (error) {
            console.error("❌ [CRON Error] Limpiando recargas huérfanas:", error);
        }
            });
    }, { timezone: "America/Guayaquil" });
};
