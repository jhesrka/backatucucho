import cron from "node-cron";
import { StorieService } from "../presentation/services/storie.service";
import { UserService } from "../presentation/services/usuario/user.service";
import { EmailService } from "../presentation/services/email.service";
import { WalletService } from "../presentation/services/postService/wallet.service";
import { PriceService } from "../presentation/services/priceService/price-service.service";
import { GlobalSettingsService } from "../presentation/services/globalSettings/global-settings.service";
import { envs } from "../config";

export const startStorieExpirationCron = () => {
    // Ejecutar cada 5 minutos
    // 1. Verificación de Expiración (Cada 5 minutos)
    // Cambia el estado a EXPIRED pero no borra físicamente de inmediato
    cron.schedule("*/5 * * * *", async () => {
        try {
            const storieService = createStorieService();
            const count = await storieService.processExpiredStories();
            if (count > 0) {
                console.log(`[CRON] Se han procesado ${count} historias vencidas.`);
            }
        } catch (error) {
            console.error("[CRON] Error en verificación de expiración:", error);
        }
    }, { timezone: "America/Guayaquil" });

    // 2. Purga Automática Definitiva (Todos los días a las 4:00 AM)
    // Borra físicamente historias DELETED/FLAGGED antiguas de la DB y S3
    cron.schedule("0 4 * * *", async () => {
        console.log("[CRON] Iniciando Purga Automática Programada (04:00 AM)...");
        try {
            const priceService = new PriceService();
            const settings = await priceService.getCurrentPriceSettings();
            
            if (settings.storyAutoPurge) {
                const storieService = createStorieService();
                const purgeCount = await storieService.autoPurgeOldStories(settings.storyPurgeDays);
                if (purgeCount > 0) {
                    console.log(`[CRON] Purga 04:00 AM: Se eliminaron ${purgeCount} historias antiguas (+${settings.storyPurgeDays} días).`);
                }
            }
        } catch (error) {
            console.error("[CRON] Error en purga automática de las 04:00 AM:", error);
        }
    }, { timezone: "America/Guayaquil" });
};

// Helper para evitar duplicación de instanciación
const createStorieService = () => {
    const emailService = new EmailService(
        envs.MAILER_SERVICE,
        envs.MAILER_EMAIL,
        envs.MAILER_SECRET_KEY,
        envs.SEND_EMAIL
    );
    const userService = new UserService(emailService);
    const walletService = new WalletService();
    const priceService = new PriceService();
    const globalSettingsService = new GlobalSettingsService();

    return new StorieService(
        userService,
        walletService,
        priceService,
        globalSettingsService
    );
};
