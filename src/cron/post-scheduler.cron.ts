import cron from "node-cron";
import { PostService } from "../presentation/services/post.service";
import { UserService } from "../presentation/services/usuario/user.service";
import { SubscriptionService, FreePostTrackerService, GlobalSettingsService } from "../presentation/services";
import { EmailService } from "../presentation/services/email.service";
import { envs } from "../config";

export const startPostSchedulerCron = () => {
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

    // Ejecutar cada minuto
    cron.schedule("* * * * *", async () => {
        try {
            // console.log("⏳ Buscando publicaciones programadas...");
            await postService.processScheduledPosts();
        } catch (error) {
            console.error("❌ ERROR EN CRON POST SCHEDULER:", error);
        }
    });
};
