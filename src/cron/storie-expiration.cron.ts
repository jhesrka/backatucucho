import cron from "node-cron";
import { StorieService } from "../presentation/services/storie.service";
import { UserService } from "../presentation/services/usuario/user.service";
import { EmailService } from "../presentation/services/email.service";
import { WalletService } from "../presentation/services/postService/wallet.service";
import { PriceService } from "../presentation/services/priceService/price-service.service";
import { envs } from "../config";

export const startStorieExpirationCron = () => {
    // Ejecutar cada 5 minutos
    cron.schedule("*/5 * * * *", async () => {
        // console.log("[CRON] Verificando expiración de historias...");
        try {
            const emailService = new EmailService(
                envs.MAILER_SERVICE,
                envs.MAILER_EMAIL,
                envs.MAILER_SECRET_KEY,
                envs.SEND_EMAIL
            );
            const userService = new UserService(emailService);
            const walletService = new WalletService();
            const priceService = new PriceService();

            const storieService = new StorieService(
                userService,
                walletService,
                priceService
            );

            const count = await storieService.processExpiredStories();
            if (count > 0) {
                console.log(`[CRON] Se han eliminado (Hard Delete) de DB y S3 un total de ${count} historias vencidas.`);
            }
        } catch (error) {
            console.error("[CRON] Error en purga dura de historias vencidas:", error);
        }
    });
};
