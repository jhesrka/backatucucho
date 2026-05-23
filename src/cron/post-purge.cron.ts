import cron from "node-cron";
import { PostService } from "../presentation/services/post.service";
import { UserService } from "../presentation/services/usuario/user.service";
import { EmailService } from "../presentation/services/email.service";
import { envs } from "../config";
import { SubscriptionService, FreePostTrackerService, GlobalSettingsService } from "../presentation/services";

/**
 * Automáticamente purga los posts eliminados que han superado el tiempo de retención.
 * Se ejecuta una vez al día a las 04:00 AM.
 * Lee la configuración 'postsRetentionDays' desde GlobalSettings.
 */
export const startPostPurgeCron = () => {
    // Ejecutar todos los días a las 4:00 AM
    cron.schedule("0 4 * * *", async () => {
        console.log("[CRON] Iniciando purga automática de posts eliminados...");
        try {
            const emailService = new EmailService(
                envs.MAILER_SERVICE,
                envs.MAILER_EMAIL,
                envs.MAILER_SECRET_KEY,
                envs.SEND_EMAIL
            );
            const userService = new UserService(emailService);
            const subscriptionService = new SubscriptionService();
            const freePostTrackerService = new FreePostTrackerService();
            const globalSettingsService = new GlobalSettingsService();

            const postService = new PostService(
                userService,
                subscriptionService,
                freePostTrackerService,
                globalSettingsService
            );

            const { deletedCount } = await postService.autoPurgeOldPosts();
            if (deletedCount > 0) {
                console.log(`[CRON] Purga automática completada. Posts eliminados definitivamente: ${deletedCount}`);
            } else {
                console.log(`[CRON] Purga automática completada. No hubo candidatos.`);
            }
        } catch (error) {
            console.error("[CRON] Error durante la purga automática de posts:", error);
        }
    }, { timezone: "America/Guayaquil" });

    console.log("[CRON] Sistema de purga automática de posts inicializado (4 AM daily)");
};
