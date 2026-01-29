import cron from "node-cron";
import { PostService } from "../presentation/services/post.service";
import { UserService } from "../presentation/services/usuario/user.service";
import { EmailService } from "../presentation/services/email.service";
import { envs } from "../config";
import { SubscriptionService, FreePostTrackerService, GlobalSettingsService } from "../presentation/services";

export const startPostExpirationCron = () => {
    // Ejecutar cada hora
    cron.schedule("0 * * * *", async () => {
        console.log("[CRON] Verificando expiración de posts gratuitos...");
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

            const count = await postService.expirePosts();
            if (count > 0) {
                console.log(`[CRON] Se han expirado ${count} posts.`);
            }
        } catch (error) {
            console.error("[CRON] Error en expiración de posts:", error);
        }
    });
};
