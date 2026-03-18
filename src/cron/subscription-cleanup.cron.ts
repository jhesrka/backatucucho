import cron from "node-cron";
import { CleanupService } from "../presentation/services/cleanup.service";

/**
 * Automáticamente limpia el contenido y cuentas de usuarios con suscripciones
 * inactivas por más de 60 días.
 * Se ejecuta una vez al día a las 02:30 AM.
 */
export const startSubscriptionCleanupCron = () => {
    // Ejecutar todos los días a las 2:30 AM
    cron.schedule("30 2 * * *", async () => {
        console.log("[CRON] Iniciando limpieza de suscripciones inactivas > 60 días...");
        try {
            const cleanupService = new CleanupService();
            const results = await cleanupService.cleanupInactiveSubscriptions();
            
            console.log(`[CRON] Limpieza completada:
              - Usuarios procesados: ${results.usersProcessed}
              - Publicaciones eliminadas: ${results.postsDeleted}
              - Historias eliminadas: ${results.storiesDeleted}
              - Archivos S3 eliminados: ${results.filesDeleted}`);
              
        } catch (error) {
            console.error("[CRON] Error durante la limpieza de suscripciones:", error);
        }
    });

    console.log("[CRON] Sistema de limpieza automática de suscripciones inicializado (2:30 AM daily)");
};
